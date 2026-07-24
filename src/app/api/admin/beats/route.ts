export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendBeatReviewDecisionEmail } from '@/lib/emails/resend'

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
    const page = Number(searchParams.get('page') || 1)
    const limit = Number(searchParams.get('limit') || 20)

    const where: any = {}

    // Admin voit TOUS les beats (pas de filtre status par défaut)
    if (status) where.status = status
    if (genre) where.genre = genre
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { genre: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
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
            },
          },
          _count: {
            select: { likes: true },
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
    const beatsWithAdminPreviews = beats.map((beat) => ({
      ...beat,
      audioUrl:
        beat.audioUrl || beat.audioOriginal
          ? `/api/admin/beats/${beat.id}/preview`
          : null,
    }))

    return NextResponse.json({
      beats: beatsWithAdminPreviews,
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

    const { beatId, action, reason, rejectionType } = await request.json()
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
        producer: { select: { id: true, email: true, name: true, displayName: true } },
        auctions: { where: { status: 'PENDING_APPROVAL' } },
      },
    })

    if (!beat) {
      return NextResponse.json({ error: 'Beat introuvable' }, { status: 404 })
    }
    if (beat.status !== 'PENDING') {
      return NextResponse.json({ error: 'Ce beat a déjà été examiné' }, { status: 409 })
    }

    const approved = action === 'APPROVE'
    const now = new Date()

    await prisma.$transaction(async (tx) => {
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
        const followers = await tx.follow.findMany({
          where: { followingId: beat.producer.id },
          select: { followerId: true },
        })
        if (followers.length > 0) {
          const publicLink = beat.auctions[0]
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
      message: approved ? 'Beat approuvé et mis en ligne' : 'Beat refusé',
    })
  } catch (error) {
    console.error('Admin beat review error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
