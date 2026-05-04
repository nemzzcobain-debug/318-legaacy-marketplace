export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Parallel queries for performance
    const [
      beats,
      activeAuctions,
      completedAuctions,
      totalBidsReceived,
      recentBids,
    ] = await Promise.all([
      // All beats by this producer
      prisma.beat.findMany({
        where: { producerId: userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          genre: true,
          bpm: true,
          key: true,
          status: true,
          plays: true,
          coverImage: true,
          audioUrl: true,
          createdAt: true,
          _count: { select: { auctions: true, likes: true } },
        },
      }),

      // Active auctions for this producer's beats
      prisma.auction.findMany({
        where: {
          beat: { producerId: userId },
          status: { in: ['ACTIVE', 'ENDING_SOON', 'SCHEDULED'] },
        },
        orderBy: { endTime: 'asc' },
        include: {
          beat: { select: { title: true, genre: true, coverImage: true } },
          _count: { select: { bids: true } },
        },
      }),

      // Completed/ended auctions (sales + no-sale)
      prisma.auction.findMany({
        where: {
          beat: { producerId: userId },
          status: { in: ['COMPLETED', 'ENDED'] },
        },
        orderBy: { endTime: 'desc' },
        take: 20,
        include: {
          beat: { select: { title: true, genre: true, coverImage: true } },
          winner: { select: { name: true, displayName: true } },
        },
      }),

      // Total bids received across all producer's auctions
      prisma.bid.count({
        where: {
          auction: { beat: { producerId: userId } },
        },
      }),

      // Last 10 bids on producer's auctions (activity feed)
      prisma.bid.findMany({
        where: {
          auction: { beat: { producerId: userId } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { name: true, displayName: true, avatar: true } },
          auction: {
            select: {
              id: true,
              beat: { select: { title: true } },
            },
          },
        },
      }),
    ])

    // Calculate revenue
    const sales = completedAuctions.filter(a => a.winnerId !== null)
    const totalRevenue = sales.reduce((sum, a) => sum + (a.producerPayout || 0), 0)
    const pendingRevenue = sales
      .filter(a => !a.paidAt)
      .reduce((sum, a) => sum + (a.producerPayout || 0), 0)
    const paidRevenue = sales
      .filter(a => a.paidAt)
      .reduce((sum, a) => sum + (a.producerPayout || 0), 0)
    const totalSalesAmount = sales.reduce((sum, a) => sum + (a.finalPrice || 0), 0)
    const totalCommission = sales.reduce((sum, a) => sum + (a.commissionAmount || 0), 0)

    return NextResponse.json({
      stats: {
        totalBeats: beats.length,
        activeAuctionsCount: activeAuctions.length,
        totalBidsReceived,
        totalSales: sales.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        pendingRevenue: Math.round(pendingRevenue * 100) / 100,
        paidRevenue: Math.round(paidRevenue * 100) / 100,
        totalSalesAmount: Math.round(totalSalesAmount * 100) / 100,
        totalCommission: Math.round(totalCommission * 100) / 100,
      },
      beats,
      activeAuctions,
      completedAuctions: sales,
      endedNoSale: completedAuctions.filter(a => a.winnerId === null),
      recentBids,
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
