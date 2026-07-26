import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteFile, parseSupabaseUrl } from '@/lib/supabase'

// GET /api/beats/[id] — Charger un beat à corriger
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
      status: true,
      rejectionType: true,
      rejectionReason: true,
    },
  })

  if (!beat || beat.producerId !== (session.user as any).id) {
    return NextResponse.json({ error: 'Beat introuvable' }, { status: 404 })
  }
  if (beat.status !== 'REJECTED' || beat.rejectionType !== 'CHANGES_REQUESTED') {
    return NextResponse.json({ error: 'Ce beat ne peut pas être renvoyé' }, { status: 400 })
  }

  return NextResponse.json({ beat })
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
