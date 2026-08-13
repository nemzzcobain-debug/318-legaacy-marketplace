export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendBeatReviewDecisionEmail } from '@/lib/emails/resend'
import { AI_REVIEW_STATUSES, parseRiskReasons } from '@/lib/beat-authenticity'
import { isIrcamAiMusicConfigured } from '@/lib/ircam-ai-music'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const genre = searchParams.get('genre')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const aiStatus = searchParams.get('aiStatus')
    const producerId = searchParams.get('producerId')
    const page = Number(searchParams.get('page') || 1)
    const limit = Number(searchParams.get('limit') || 20)

    const where: any = {}

    // Admin voit TOUS les beats (pas de filtre status par défaut)
    if (status) where.status = status
    if (aiStatus && AI_REVIEW_STATUSES.includes(aiStatus as any)) where.aiReviewStatus = aiStatus
    if (producerId) where.producerId = producerId
    if (genre) where.genre = genre
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { genre: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
        { producer: { name: { contains: search, mode: 'insensitive' } } },
        { producer: { displayName: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [beats, total] = await Promise.all([
      prisma.beat.findMany({
        where,
        include: {
          producer: {
            select: {
              id: true,
              name: true,
              displayName: true,
              avatar: true,
              email: true,
            },
          },
          _count: {
            select: { likes: true, purchases: true },
          },
          auctions: {
            select: {
              id: true,
              startPrice: true,
              currentBid: true,
              reservePrice: true,
              buyNowPrice: true,
              bidIncrement: true,
              licenseType: true,
              startTime: true,
              endTime: true,
              status: true,
              totalBids: true,
              _count: { select: { bids: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.beat.count({ where }),
    ])

    // Le lecteur admin passe par un flux authentifié du même domaine.
    // Cela fonctionne avec les aperçus publics comme avec les anciens fichiers privés.
    const beatsWithAdminPreviews = beats.map((beat) => {
      let stemFiles: Array<{ name: string; size: number | null }> = []

      if (beat.stemsFiles) {
        try {
          const parsed = JSON.parse(beat.stemsFiles) as Array<{
            name?: string
            size?: number
          }>
          stemFiles = parsed.map((stem, index) => ({
            name: stem.name || `Stem ${index + 1}`,
            size: typeof stem.size === 'number' ? stem.size : null,
          }))
        } catch {
          stemFiles = []
        }
      }

      // Les URL des fichiers complets restent privées. L'interface admin reçoit
      // uniquement leur présence et les métadonnées nécessaires au contrôle.
      const { audioOriginal, audioWav, stemsUrl, stemsFiles, ...publicBeat } = beat

      return {
        ...publicBeat,
        aiRiskReasons: parseRiskReasons(beat.aiRiskReasons),
        audioUrl: beat.audioUrl || audioOriginal ? `/api/admin/beats/${beat.id}/preview` : null,
        files: {
          hasPreview: Boolean(beat.audioUrl),
          hasMp3: Boolean(audioOriginal),
          hasWav: Boolean(audioWav),
          hasStems: Boolean(stemsUrl || stemsFiles),
          stemsFormat: stemsUrl ? 'ZIP' : stemFiles ? 'FILES' : null,
          stemsCount: stemFiles.length,
          stems: stemFiles,
        },
      }
    })

    return NextResponse.json({
      beats: beatsWithAdminPreviews,
      aiAudioDetectorConfigured: isIrcamAiMusicConfigured(),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Admin beats error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { beatId, action, reason, rejectionType, overrideStripeGrace } = await request.json()
    if (!beatId || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
    }
    if (
      action === 'REJECT' &&
      (!reason?.trim() || !['CHANGES_REQUESTED', 'FINAL'].includes(rejectionType))
    ) {
      return NextResponse.json(
        { error: 'Le type et le motif du refus sont obligatoires' },
        { status: 400 }
      )
    }

    const beat = await prisma.beat.findUnique({
      where: { id: beatId },
      include: {
        producer: {
          select: {
            id: true,
            email: true,
            name: true,
            displayName: true,
            producerStatus: true,
            stripeGraceSuspendedAt: true,
          },
        },
        auctions: { where: { status: 'PENDING_APPROVAL' } },
      },
    })

    if (!beat) {
      return NextResponse.json({ error: 'Beat introuvable' }, { status: 404 })
    }
    if (beat.status !== 'PENDING') {
      return NextResponse.json({ error: 'Ce beat a déjà été examiné' }, { status: 409 })
    }

    const isStripeGraceSuspension =
      beat.producer.producerStatus === 'SUSPENDED' && Boolean(beat.producer.stripeGraceSuspendedAt)
    const usesAdminStripeOverride =
      action === 'APPROVE' && overrideStripeGrace === true && isStripeGraceSuspension

    if (
      action === 'APPROVE' &&
      beat.producer.producerStatus !== 'APPROVED' &&
      !usesAdminStripeOverride
    ) {
      return NextResponse.json(
        isStripeGraceSuspension
          ? {
              error:
                'Le délai Stripe Connect de ce beatmaker est expiré. Tu peux lui accorder 7 jours supplémentaires.',
              code: 'PRODUCER_STRIPE_SUSPENDED',
              canOverrideStripeGrace: true,
              producerId: beat.producer.id,
              producerName: beat.producer.displayName || beat.producer.name,
            }
          : {
              error:
                'Le compte de ce beatmaker doit être approuvé avant que son beat puisse être publié.',
              code: 'PRODUCER_NOT_APPROVED',
              canOverrideStripeGrace: false,
              producerId: beat.producer.id,
            },
        { status: 409 }
      )
    }

    const approved = action === 'APPROVE'
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      if (usesAdminStripeOverride) {
        // Dérogation volontaire et temporaire : l'admin réactive le producteur
        // pour 7 jours, mais Stripe Connect reste obligatoire après ce délai.
        await tx.user.update({
          where: { id: beat.producer.id },
          data: {
            producerStatus: 'APPROVED',
            producerApprovedAt: now,
            stripeGraceSuspendedAt: null,
          },
        })

        await tx.notification.create({
          data: {
            userId: beat.producer.id,
            type: 'SYSTEM',
            title: 'Délai Stripe Connect prolongé',
            message:
              '318 LEGAACY t’accorde 7 jours supplémentaires pour terminer Stripe Connect. Ton beat peut être publié, mais l’inscription Stripe reste obligatoire.',
            link: '/dashboard?tab=settings',
          },
        })
      }

      await tx.beat.update({
        where: { id: beat.id },
        data: approved
          ? {
              status: 'ACTIVE',
              rejectionType: null,
              rejectionReason: null,
              rejectedAt: null,
            }
          : {
              status: 'REJECTED',
              rejectionType,
              rejectionReason: reason.trim(),
              rejectedAt: now,
            },
      })

      for (const auction of beat.auctions) {
        if (!approved) {
          await tx.auction.update({
            where: { id: auction.id },
            data: { status: 'CANCELLED' },
          })
          continue
        }

        const durationMs = auction.endTime.getTime() - auction.startTime.getTime()
        const remainsScheduled = auction.startTime > now
        await tx.auction.update({
          where: { id: auction.id },
          data: remainsScheduled
            ? { status: 'SCHEDULED' }
            : {
                status: 'ACTIVE',
                startTime: now,
                endTime: new Date(now.getTime() + durationMs),
              },
        })
      }

      await tx.notification.create({
        data: {
          type: approved ? 'NEW_BEAT' : 'SYSTEM',
          title: approved ? 'Beat validé !' : 'Beat non retenu',
          message: approved
            ? `"${beat.title}" est maintenant en ligne.`
            : rejectionType === 'CHANGES_REQUESTED'
              ? `Modifications demandées pour "${beat.title}". Motif : ${reason}`
              : `"${beat.title}" a été définitivement refusé. Motif : ${reason}`,
          link: '/dashboard?tab=beats',
          userId: beat.producer.id,
        },
      })

      if (approved) {
        // Un beat en leasing doit être achetable immédiatement après validation.
        // Il rejoint le catalogue d'achat direct et ne reçoit jamais d'enchère.
        if (beat.saleMode === 'LEASING') {
          let nouveautesPlaylist = await tx.playlist.findFirst({
            where: { name: 'Nouveautés', visibility: 'PUBLIC' },
            select: { id: true },
          })
          if (!nouveautesPlaylist) {
            nouveautesPlaylist = await tx.playlist.create({
              data: {
                name: 'Nouveautés',
                description: 'Les derniers beats disponibles sur la plateforme',
                visibility: 'PUBLIC',
                userId: (session.user as any).id,
              },
              select: { id: true },
            })
          }
          const maxPosition = await tx.playlistBeat.aggregate({
            where: { playlistId: nouveautesPlaylist.id },
            _max: { position: true },
          })
          await tx.playlistBeat.upsert({
            where: {
              playlistId_beatId: {
                playlistId: nouveautesPlaylist.id,
                beatId: beat.id,
              },
            },
            update: {},
            create: {
              playlistId: nouveautesPlaylist.id,
              beatId: beat.id,
              position: (maxPosition._max.position ?? -1) + 1,
            },
          })
        }

        const followers = await tx.follow.findMany({
          where: { followingId: beat.producer.id },
          select: { followerId: true },
        })
        if (followers.length > 0) {
          const publicLink =
            beat.saleMode === 'LEASING'
              ? `/nouveautes?beat=${beat.id}`
              : beat.auctions[0]
                ? `/auction/${beat.auctions[0].id}`
                : `/producer/${beat.producer.id}`
          await tx.notification.createMany({
            data: followers.map((f) => ({
              type: 'NEW_BEAT',
              title: `Nouveau beat de ${beat.producer.displayName || beat.producer.name}`,
              message: `${beat.producer.displayName || beat.producer.name} a publié "${beat.title}"`,
              link: publicLink,
              userId: f.followerId,
            })),
          })
        }
      }
    })

    if (beat.producer.email) {
      sendBeatReviewDecisionEmail({
        to: beat.producer.email,
        producerName: beat.producer.displayName || beat.producer.name || 'Producteur',
        beatTitle: beat.title,
        approved,
        reason,
      }).catch((error) => console.warn('Email décision beat échoué:', String(error)))
    }

    return NextResponse.json({
      success: true,
      stripeGraceExtended: usesAdminStripeOverride,
      message: approved ? 'Beat approuvé et mis en ligne' : 'Beat refusé',
    })
  } catch (error) {
    console.error('Admin beat review error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
