export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { enforceProducerStripeAccess } from '@/lib/producer-stripe-access'
import { authOptions } from '@/lib/auth'
import { createAuctionSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { withoutPrivateAuctionFiles } from '@/lib/public-beat-files'
import {
  parsePagination,
  parseAuctionSort,
  buildStatusFilter,
  buildGenreFilter,
} from '@/lib/auction-helpers'

// GET /api/auctions - Liste des enchères actives
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'ACTIVE'
    const genre = searchParams.get('genre')
    const sort = searchParams.get('sort') || 'ending_soon'

    // Parse pagination
    const { page, limit, skip } = parsePagination(searchParams)

    // Build where clause with proper typing
    const where: Prisma.AuctionWhereInput = {
      ...buildStatusFilter(status),
      ...buildGenreFilter(genre),
    }

    // Parse sort
    const orderBy = parseAuctionSort(sort)

    const [auctions, total] = await Promise.all([
      prisma.auction.findMany({
        where,
        include: {
          beat: {
            include: {
              producer: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  avatar: true,
                  rating: true,
                  totalSales: true,
                  producerStatus: true,
                },
              },
              _count: {
                select: { likes: true },
              },
            },
          },
          bids: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            include: {
              user: {
                select: { id: true, name: true, avatar: true },
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.auction.count({ where }),
    ])

    return NextResponse.json({
      auctions: auctions.map(withoutPrivateAuctionFiles),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    logger.error('Erreur listing enchères:', { error: String(error) })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/auctions - Creer une enchère
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = session.user.id
    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user || !['PRODUCER', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const producerAccess = await enforceProducerStripeAccess(user)
    if (!producerAccess.allowed) {
      return NextResponse.json(
        {
          error: producerAccess.message,
          code: producerAccess.status,
          actionUrl:
            producerAccess.status === 'stripe_suspended' ? '/dashboard?tab=settings' : undefined,
        },
        { status: 403 }
      )
    }

    // F18 FIX: Limiter la taille du payload
    const contentLength = parseInt(request.headers.get('content-length') || '0')
    if (contentLength > 10_000) {
      return NextResponse.json({ error: 'Payload trop volumineux' }, { status: 413 })
    }

    const body = await request.json()
    const validated = createAuctionSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.errors[0].message }, { status: 400 })
    }

    const { beatId, startPrice, reservePrice, buyNowPrice, durationHours, bidIncrement } =
      validated.data

    // Vérifier que le beat appartient au producteur et a déjà été validé.
    const beat = await prisma.beat.findFirst({
      where: { id: beatId, producerId: userId, status: 'ACTIVE' },
      select: {
        id: true,
        title: true,
        saleMode: true,
        stemsUrl: true,
        stemsFiles: true,
      },
    })
    if (!beat) {
      return NextResponse.json(
        {
          error: 'Beat validé introuvable. Le beat doit être approuvé avant la mise aux enchères.',
        },
        { status: 404 }
      )
    }
    if (beat.saleMode !== 'AUCTION') {
      return NextResponse.json(
        { error: 'Ce beat est en leasing et ne peut pas être mis aux enchères.' },
        { status: 409 }
      )
    }
    if (!beat.stemsUrl && !beat.stemsFiles) {
      return NextResponse.json(
        { error: 'Ajoute les stems avant de créer cette enchère exclusive.' },
        { status: 400 }
      )
    }

    // Vérifier qu'il n'y a pas déjà une enchère active sur ce beat
    const existingAuction = await prisma.auction.findFirst({
      where: {
        beatId,
        status: { in: ['ACTIVE', 'SCHEDULED', 'ENDING_SOON'] },
      },
    })
    if (existingAuction) {
      return NextResponse.json(
        { error: 'Une enchère est déjà en cours pour ce beat' },
        { status: 409 }
      )
    }

    const now = new Date()
    const endTime = new Date(now.getTime() + durationHours * 3600000)

    const auction = await prisma.auction.create({
      data: {
        beatId,
        startPrice,
        currentBid: startPrice,
        reservePrice,
        buyNowPrice,
        // Une enchère correspond toujours à la vente exclusive du beat.
        licenseType: 'EXCLUSIVE',
        bidIncrement,
        startTime: now,
        endTime,
        status: 'ACTIVE',
      },
      include: {
        beat: {
          include: {
            producer: {
              select: { id: true, name: true, avatar: true },
            },
          },
        },
      },
    })

    // Mettre a jour le status du beat
    await prisma.beat.update({
      where: { id: beatId },
      data: { status: 'ACTIVE' },
    })

    // Notifier tous les followers du producteur
    try {
      const followers = await prisma.follow.findMany({
        where: { followingId: userId },
        select: { followerId: true },
      })

      if (followers.length > 0) {
        const producerName = user.displayName || user.name
        await prisma.notification.createMany({
          data: followers.map((f) => ({
            type: 'NEW_AUCTION',
            title: `Nouvelle enchère de ${producerName}`,
            message: `${producerName} a lance une enchère sur "${beat.title}" a partir de ${startPrice} EUR`,
            link: `/auction/${auction.id}`,
            userId: f.followerId,
          })),
        })
      }
    } catch (notifErr) {
      console.warn('[AUCTION] Erreur notification followers:', String(notifErr))
    }

    return NextResponse.json({ auction }, { status: 201 })
  } catch (error) {
    logger.error('Erreur création enchère:', { error: String(error) })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
