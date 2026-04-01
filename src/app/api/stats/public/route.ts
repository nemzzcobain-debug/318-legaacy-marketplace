// ─── 318 LEGAACY Marketplace - Public Stats API ───
// Statistiques agrégées publiques (pas besoin d'auth)

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const revalidate = 300 // Cache 5 minutes

export async function GET() {
  try {
    const [
      totalUsers,
      totalProducers,
      totalBeats,
      totalAuctions,
      activeAuctions,
      completedAuctions,
      totalBids,
      topGenres,
      recentCompleted,
      volumeData,
    ] = await Promise.all([
      // Total utilisateurs
      prisma.user.count(),

      // Total producteurs approuvés
      prisma.user.count({ where: { producerStatus: 'APPROVED' } }),

      // Total beats
      prisma.beat.count({ where: { status: 'ACTIVE' } }),

      // Total enchères
      prisma.auction.count(),

      // Enchères actives
      prisma.auction.count({ where: { status: { in: ['ACTIVE', 'ENDING_SOON'] } } }),

      // Enchères complétées
      prisma.auction.count({ where: { status: 'COMPLETED' } }),

      // Total bids
      prisma.bid.count(),

      // Top genres (via beats)
      prisma.beat.groupBy({
        by: ['genre'],
        where: { status: 'ACTIVE' },
        _count: { genre: true },
        orderBy: { _count: { genre: 'desc' } },
        take: 8,
      }),

      // Dernières ventes complétées
      prisma.auction.findMany({
        where: { status: 'COMPLETED', paidAt: { not: null } },
        select: {
          id: true,
          finalPrice: true,
          licenseType: true,
          paidAt: true,
          beat: {
            select: {
              title: true,
              genre: true,
              coverImage: true,
              producer: {
                select: { name: true, displayName: true, avatar: true },
              },
            },
          },
        },
        orderBy: { paidAt: 'desc' },
        take: 6,
      }),

      // Volume total des ventes
      prisma.auction.aggregate({
        where: { status: 'COMPLETED', paidAt: { not: null } },
        _sum: { finalPrice: true },
        _avg: { finalPrice: true },
        _max: { finalPrice: true },
      }),
    ])

    // Top producteurs par ventes
    const topProducers = await prisma.user.findMany({
      where: { producerStatus: 'APPROVED', totalSales: { gt: 0 } },
      select: {
        id: true,
        name: true,
        displayName: true,
        avatar: true,
        totalSales: true,
        rating: true,
        _count: { select: { beats: true } },
      },
      orderBy: { totalSales: 'desc' },
      take: 6,
    })

    return NextResponse.json({
      overview: {
        totalUsers,
        totalProducers,
        totalBeats,
        totalAuctions,
        activeAuctions,
        completedAuctions,
        totalBids,
        totalVolume: volumeData._sum.finalPrice || 0,
        avgPrice: volumeData._avg.finalPrice || 0,
        maxPrice: volumeData._max.finalPrice || 0,
      },
      topGenres: topGenres.map((g) => ({
        name: g.genre,
        count: g._count.genre,
      })),
      recentSales: recentCompleted,
      topProducers,
    })
  } catch (error) {
    console.error('Public stats error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
