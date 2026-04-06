export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { createAuctionSchema } from '@/lib/validations'

// GET /api/auctions - Liste des encheres actives
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'ACTIVE'
    const genre = searchParams.get('genre')
    const sort = searchParams.get('sort') || 'ending_soon'

    // Parse pagination with NaN validation
    const pageStr = parseInt(searchParams.get('page') || '1')
    const page = Math.max(1, !isNaN(pageStr) ? pageStr : 1)

    const limitStr = parseInt(searchParams.get('limit') || '20')
    const limit = Math.min(100, Math.max(1, !isNaN(limitStr) ? limitStr : 20))

    const where: any = {}

    // Filtrer par status
    if (status === 'active') {
      where.status = { in: ['ACTIVE', 'ENDING_SOON'] }
      where.endTime = { gt: new Date() }
    } else if (status === 'ending_soon') {
      where.status = { in: ['ACTIVE', 'ENDING_SOON'] }
      where.endTime = {
        gt: new Date(),
        lt: new Date(Date.now() + 3600000), // Moins d'1h
      }
    } else if (status === 'ended') {
      where.status = 'ENDED'
    }

    // Filtrer par genre du beat
    if (genre) {
      where.beat = { genre }
    }

    // Tri
    let orderBy: any = {}
    switch (sort) {
      case 'ending_soon': orderBy = { endTime: 'asc' }; break
      case 'most_bids': orderBy = { totalBids: 'desc' }; break
      case 'highest_bid': orderBy = { currentBid: 'desc' }; break
      case 'newest': orderBy = { createdAt: 'desc' }; break
      default: orderBy = { endTime: 'asc' }
    }

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
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auction.count({ where }),
    ])

    return NextResponse.json({
      auctions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Erreur listing encheres:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/auctions - Creer une enchere
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const userId = session.user.id
    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user || user.role !== 'PRODUCER' || user.producerStatus !== 'APPROVED') {
      return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
    }

    const body = await request.json()
    const validated = createAuctionSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      )
    }

    const { beatId, startPrice, reservePrice, buyNowPrice, licenseType, durationHours, bidIncrement } = validated.data

    // Verifier que le beat appartient au producteur
    const beat = await prisma.beat.findFirst({
      where: { id: beatId, producerId: userId },
    })
    if (!beat) {
      return NextResponse.json({ error: 'Beat introuvable' }, { status: 404 })
    }

    // Verifier qu'il n'y a pas deja une enchere active sur ce beat
    const existingAuction = await prisma.auction.findFirst({
      where: {
        beatId,
        status: { in: ['ACTIVE', 'SCHEDULED', 'ENDING_SOON'] },
      },
    })
    if (existingAuction) {
      return NextResponse.json(
        { error: 'Une enchere est deja en cours pour ce beat' },
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
        licenseType,
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
          data: followers.map(f => ({
            type: 'NEW_AUCTION',
            title: `Nouvelle enchere de ${producerName}`,
            message: `${producerName} a lance une enchere sur "${beat.title}" a partir de ${startPrice} EUR`,
            link: `/auction/${auction.id}`,
            userId: f.followerId,
          })),
        })
      }
    } catch {}

    return NextResponse.json({ auction }, { status: 201 })
  } catch (error) {
    console.error('Erreur creation enchere:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
