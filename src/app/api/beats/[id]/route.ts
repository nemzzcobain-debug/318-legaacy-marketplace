import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteFile, parseSupabaseUrl } from '@/lib/supabase'
import { getBeatEditCapabilities, updateBeatSchema } from '@/lib/beat-edit'

const EDITABLE_AUCTION_STATUSES = [
  'PENDING_APPROVAL',
  'SCHEDULED',
  'ACTIVE',
  'ENDING_SOON',
] as const

// GET /api/beats/[id] — Charger un beat appartenant au producteur
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { id } = await params
  const beat = await prisma.beat.findUnique({
    where: { id },
    select: {
      id: true,
      producerId: true,
      title: true,
      description: true,
      genre: true,
      mood: true,
      bpm: true,
      key: true,
      tags: true,
      priceMp3: true,
      priceWav: true,
      priceStems: true,
      saleMode: true,
      audioOriginal: true,
      audioWav: true,
      stemsUrl: true,
      stemsFiles: true,
      status: true,
      rejectionType: true,
      rejectionReason: true,
      auctions: {
        where: { status: { in: [...EDITABLE_AUCTION_STATUSES] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          startPrice: true,
          currentBid: true,
          buyNowPrice: true,
          startTime: true,
          endTime: true,
          totalBids: true,
          _count: { select: { bids: true } },
        },
      },
    },
  })

  if (!beat || beat.producerId !== (session.user as any).id) {
    return NextResponse.json({ error: 'Beat introuvable' }, { status: 404 })
  }
  const auction = beat.auctions[0] || null
  const capabilities = getBeatEditCapabilities({
    beatStatus: beat.status,
    rejectionType: beat.rejectionType,
    auctionStatus: auction?.status,
    totalBids: auction?._count.bids ?? auction?.totalBids ?? 0,
    auctionEndTime: auction?.endTime,
  })

  return NextResponse.json({
    beat: {
      ...beat,
      auctions: undefined,
      hasMp3: Boolean(beat.audioOriginal),
      hasWav: Boolean(beat.audioWav),
      hasStems: Boolean(beat.stemsUrl || beat.stemsFiles),
      audioOriginal: undefined,
      audioWav: undefined,
      stemsUrl: undefined,
      stemsFiles: undefined,
      auction,
    },
    capabilities,
  })
}

// PATCH /api/beats/[id] — Modifier les informations et la programmation
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const producerId = (session.user as any).id
    const beat = await prisma.beat.findUnique({
      where: { id },
      include: {
        auctions: {
          where: { status: { in: [...EDITABLE_AUCTION_STATUSES] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { _count: { select: { bids: true } } },
        },
      },
    })

    if (!beat || beat.producerId !== producerId) {
      return NextResponse.json({ error: 'Beat introuvable' }, { status: 404 })
    }

    const parsed = updateBeatSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Informations invalides' },
        { status: 400 }
      )
    }

    const auction = beat.auctions[0] || null
    const totalBids = auction?._count.bids ?? auction?.totalBids ?? 0
    const capabilities = getBeatEditCapabilities({
      beatStatus: beat.status,
      rejectionType: beat.rejectionType,
      auctionStatus: auction?.status,
      totalBids,
      auctionEndTime: auction?.endTime,
    })

    if (!capabilities.canEditMetadata) {
      return NextResponse.json(
        { error: capabilities.lockedReason || 'Ce beat ne peut plus être modifié.' },
        { status: 409 }
      )
    }

    const data = parsed.data
    if (beat.saleMode === 'LEASING') {
      const validMp3Offer = Boolean(beat.audioOriginal && data.priceMp3)
      const validWavOffer = Boolean(beat.audioWav && data.priceWav)
      if (!validMp3Offer && !validWavOffer) {
        return NextResponse.json(
          { error: 'Renseigne au moins un prix pour le fichier MP3 ou WAV disponible.' },
          { status: 400 }
        )
      }
    }

    if (data.auction && !auction) {
      return NextResponse.json({ error: 'Enchère associée introuvable.' }, { status: 404 })
    }
    if (data.auction && !capabilities.canEditAuctionSettings) {
      return NextResponse.json(
        {
          error: "Le prix et la durée ne peuvent être modifiés qu'avant le démarrage de l'enchère.",
        },
        { status: 409 }
      )
    }

    const now = new Date()
    const updated = await prisma.$transaction(async (tx) => {
      const updatedBeat = await tx.beat.update({
        where: { id: beat.id },
        data: {
          title: data.title,
          description: data.description || null,
          genre: data.genre,
          mood: data.mood || null,
          bpm: data.bpm,
          key: data.key || null,
          tags: JSON.stringify(data.tags),
          priceMp3: beat.saleMode === 'LEASING' && beat.audioOriginal ? data.priceMp3 : null,
          priceWav: beat.saleMode === 'LEASING' && beat.audioWav ? data.priceWav : null,
        },
      })

      let updatedAuction: Awaited<ReturnType<typeof tx.auction.findUnique>> | typeof auction =
        auction
      if (auction && data.auction) {
        const requestedStart = data.auction.startAt ? new Date(data.auction.startAt) : now
        const startsInFuture = requestedStart.getTime() > now.getTime()
        const startTime = startsInFuture ? requestedStart : now
        const endTime = new Date(startTime.getTime() + data.auction.durationHours * 60 * 60 * 1000)

        const result = await tx.auction.updateMany({
          where: {
            id: auction.id,
            status: { in: ['PENDING_APPROVAL', 'SCHEDULED'] },
            totalBids: 0,
          },
          data: {
            startPrice: data.auction.startPrice,
            currentBid: data.auction.startPrice,
            buyNowPrice: data.auction.buyNowPrice,
            startTime,
            endTime,
            status:
              auction.status === 'PENDING_APPROVAL'
                ? 'PENDING_APPROVAL'
                : startsInFuture
                  ? 'SCHEDULED'
                  : 'ACTIVE',
          },
        })

        if (result.count === 0) {
          throw new Error('AUCTION_CHANGED')
        }
        updatedAuction = await tx.auction.findUnique({ where: { id: auction.id } })
      }

      return { beat: updatedBeat, auction: updatedAuction }
    })

    return NextResponse.json({
      success: true,
      ...updated,
      message: 'Modifications enregistrées.',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'AUCTION_CHANGED') {
      return NextResponse.json(
        { error: "L'enchère vient de changer. Recharge la page avant de recommencer." },
        { status: 409 }
      )
    }
    console.error('Erreur modification beat:', error)
    return NextResponse.json({ error: 'Impossible de modifier ce beat.' }, { status: 500 })
  }
}

// DELETE /api/beats/[id] — Supprimer un beat (producteur uniquement)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id: beatId } = await params

    // Récupérer le beat avec ses relations
    const beat = await prisma.beat.findUnique({
      where: { id: beatId },
      include: {
        auctions: {
          where: {
            status: { in: ['ACTIVE', 'ENDING_SOON', 'SCHEDULED'] },
          },
          select: { id: true },
        },
      },
    })

    if (!beat) {
      return NextResponse.json({ error: 'Beat introuvable' }, { status: 404 })
    }

    // Vérifier que l'utilisateur est le propriétaire du beat
    if (beat.producerId !== (session.user as any).id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Empêcher la suppression si le beat a des enchères actives
    if (beat.auctions.length > 0) {
      return NextResponse.json(
        { error: 'Impossible de supprimer un beat avec des enchères actives' },
        { status: 400 }
      )
    }

    // Empêcher la suppression si le beat est vendu
    if (beat.status === 'SOLD') {
      return NextResponse.json(
        { error: 'Impossible de supprimer un beat déjà vendu' },
        { status: 400 }
      )
    }

    // 1. Supprimer les relations en base (likes, playlists, enchères terminées)
    // Ordre important : d'abord les sous-relations, puis les relations directes, puis le beat
    await prisma.$transaction([
      prisma.like.deleteMany({ where: { beatId } }),
      prisma.playlistBeat.deleteMany({ where: { beatId } }),
      // Reviews liées aux enchères du beat
      prisma.review.deleteMany({
        where: { auction: { beatId } },
      }),
      // Bids des enchères liées
      prisma.bid.deleteMany({
        where: { auction: { beatId } },
      }),
      // Watchlists liées aux enchères (cascade existe mais on sécurisé)
      prisma.watchlist.deleteMany({
        where: { auction: { beatId } },
      }),
      // Encheres
      prisma.auction.deleteMany({ where: { beatId } }),
      // Le beat lui-meme
      prisma.beat.delete({ where: { id: beatId } }),
    ])

    // 2. Supprimer les fichiers de Supabase Storage (en arriere-plan, on ne bloque pas)
    const deletePromises: Promise<void>[] = []
    const storageUrls = new Set(
      [beat.audioUrl, beat.audioOriginal, beat.audioWav, beat.stemsUrl, beat.coverImage].filter(
        (value): value is string => Boolean(value)
      )
    )

    if (beat.stemsFiles) {
      try {
        const stems = JSON.parse(beat.stemsFiles) as Array<{ url?: string }>
        stems.forEach((stem) => {
          if (stem.url) storageUrls.add(stem.url)
        })
      } catch {
        // Un JSON historique invalide ne doit pas empêcher la suppression du beat.
      }
    }

    storageUrls.forEach((url) => {
      const parsed = parseSupabaseUrl(url)
      if (parsed) deletePromises.push(deleteFile(parsed.bucket, parsed.path))
    })

    // On attend les suppressions mais on ne bloque pas si ca échoué
    await Promise.allSettled(deletePromises)

    return NextResponse.json({ success: true, message: 'Beat supprimé avec succès' })
  } catch (error) {
    console.error('Erreur suppression beat:', error)
    return NextResponse.json({ error: 'Erreur serveur lors de la suppression' }, { status: 500 })
  }
}
