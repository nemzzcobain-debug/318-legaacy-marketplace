// ─── 318 LEGAACY Marketplace - Homepage API ───
// Returns: platform stats, featured producers, top genres

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Run all queries in parallel
    const [
      totalBeats,
      totalAuctions,
      totalProducers,
      totalBids,
      totalCompleted,
      totalRevenue,
      featuredProducers,
      topGenres,
    ] = await Promise.all([
      // Total beats
      prisma.beat.count(),

      // Total active auctions
      prisma.auction.count({
        where: { status: { in: ['ACTIVE', 'ENDING_SOON'] } },
      }),

      // Total verified producers
      prisma.user.count({
        where: { role: 'PRODUCER', producerStatus: 'APPROVED' },
      }),

      // Total bids ever placed
      prisma.bid.count(),

      // Total completed sales
      prisma.auction.count({
        where: { status: 'COMPLETED' },
      }),

      // Total revenue
      prisma.auction.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { finalPrice: true },
      }),

      // Featured producers: top by completed sales + followers
      prisma.user.findMany({
        where: {
          role: 'PRODUCER',
          producerStatus: 'APPROVED',
        },
        select: {
          id: true,
          name: true,
          displayName: true,
          avatar: true,
          producerBio: true,
          totalSales: true,
          _count: {
            select: {
              beats: true,
              followers: true,
            },
          },
        },
        orderBy: { totalSales: 'desc' },
        take: 6,
      }),

      // Top genres from active beats
      prisma.beat.groupBy({
        by: ['genre'],
        _count: true,
        orderBy: { _count: { genre: 'desc' } },
        take: 8,
      }),
    ])

    return NextResponse.json({
      stats: {
        totalBeats,
        totalAuctions,
        totalProducers,
        totalBids,
        totalCompleted,
        totalRevenue: totalRevenue._sum.finalPrice || 0,
      },
      featuredProducers: featuredProducers.map(p => ({
        id: p.id,
        name: p.displayName || p.name,
        avatar: p.avatar,
        bio: p.producerBio,
        totalSales: p.totalSales,
        totalBeats: p._count.beats,
        totalFollowers: p._count.followers,
      })),
      topGenres: topGenres.map(g => ({
        name: g.genre,
        count: g._count,
      })),
    })
  } catch (error) {
    console.error('Homepage API error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
