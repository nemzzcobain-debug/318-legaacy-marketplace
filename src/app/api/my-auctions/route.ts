export const dynamic = 'force-dynamic'

// ─── 318 LEGAACY Marketplace - My Auctions API ───
// GET: returns auctions where user has placed bids
// Categories: active (en cours), won (gagnées), lost (perdues), pending_payment

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const userId = session.user.id

    // Get all auctions where user has placed at least one bid
    const userBids = await prisma.bid.findMany({
      where: { userId },
      select: { auctionId: true },
      distinct: ['auctionId'],
    })

    const auctionIds = userBids.map((b) => b.auctionId)

    if (auctionIds.length === 0) {
      return NextResponse.json({
        active: [],
        won: [],
        lost: [],
        pendingPayment: [],
        stats: { total: 0, active: 0, won: 0, lost: 0, totalSpent: 0 },
      })
    }

    // Fetch all these auctions with details
    const auctions = await prisma.auction.findMany({
      where: { id: { in: auctionIds } },
      include: {
        beat: {
          select: {
            id: true,
            title: true,
            genre: true,
            bpm: true,
            key: true,
            coverImage: true,
            audioUrl: true,
            producer: {
              select: {
                id: true,
                name: true,
                displayName: true,
                avatar: true,
              },
            },
          },
        },
        bids: {
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            amount: true,
            licenseType: true,
            createdAt: true,
          },
        },
        _count: {
          select: { bids: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Categorize
    // Le statut seul ne suffit pas : une enchère peut avoir été prolongée
    // pendant que le cron de finalisation travaillait encore sur l'ancienne date.
    const now = new Date()
    const active: any[] = []
    const won: any[] = []
    const lost: any[] = []
    const pendingPayment: any[] = []

    for (const auction of auctions) {
      const myLastBid = auction.bids[0]
      const isWinner = auction.winnerId === userId
      const isLeader = auction.currentBid === myLastBid?.amount
      const hasActuallyEnded = auction.endTime <= now
      const hasEndedStatus = auction.status === 'ENDED' || auction.status === 'COMPLETED'

      const item = {
        id: auction.id,
        beat: auction.beat,
        currentBid: auction.currentBid,
        startPrice: auction.startPrice,
        finalPrice: auction.finalPrice,
        totalBids: auction._count.bids,
        myLastBid: myLastBid?.amount || 0,
        myLicense: myLastBid?.licenseType || 'BASIC',
        myLastBidAt: myLastBid?.createdAt,
        licenseType: auction.licenseType,
        winningLicense: auction.winningLicense,
        status: auction.status,
        endTime: auction.endTime,
        startTime: auction.startTime,
        paidAt: auction.paidAt,
        isLeader,
      }

      if (
        !hasActuallyEnded &&
        (auction.status === 'ACTIVE' ||
          auction.status === 'ENDING_SOON' ||
          auction.status === 'SCHEDULED')
      ) {
        active.push(item)
      } else if (hasActuallyEnded && hasEndedStatus && isWinner && !auction.paidAt) {
        pendingPayment.push(item)
      } else if (hasEndedStatus && isWinner && auction.paidAt) {
        won.push(item)
      } else if (hasActuallyEnded && hasEndedStatus) {
        lost.push(item)
      }
    }

    // Stats
    const totalSpent = await prisma.auction.aggregate({
      where: {
        winnerId: userId,
        paidAt: { not: null },
      },
      _sum: { finalPrice: true },
    })

    return NextResponse.json({
      active,
      won,
      lost,
      pendingPayment,
      stats: {
        total: auctionIds.length,
        active: active.length,
        won: won.length,
        lost: lost.length,
        pendingPayment: pendingPayment.length,
        totalSpent: totalSpent._sum.finalPrice || 0,
      },
    })
  } catch (error) {
    console.error('My auctions error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
