// ─── 318 LEGAACY Marketplace - Dashboard Analytics API ───
// Returns revenue over time, top beats, audience stats, bid activity

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
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || '30' // days
    const days = Math.min(365, Math.max(7, parseInt(period)))
    const startDate = new Date(Date.now() - days * 86400000)

    // All queries in parallel
    const [
      completedAuctions,
      allAuctions,
      beats,
      followers,
      totalPlays,
      bidsReceived,
      reviews,
    ] = await Promise.all([
      // Completed auctions with payout data
      prisma.auction.findMany({
        where: {
          beat: { producerId: userId },
          status: 'COMPLETED',
          paidAt: { not: null },
        },
        select: {
          id: true,
          finalPrice: true,
          producerPayout: true,
          commissionAmount: true,
          paidAt: true,
          winningLicense: true,
          beat: { select: { title: true, genre: true } },
        },
        orderBy: { paidAt: 'desc' },
      }),

      // All auctions (for conversion rate)
      prisma.auction.findMany({
        where: { beat: { producerId: userId } },
        select: {
          id: true,
          status: true,
          totalBids: true,
          currentBid: true,
          startPrice: true,
          createdAt: true,
          endTime: true,
          licenseType: true,
        },
      }),

      // Beats with plays and likes
      prisma.beat.findMany({
        where: { producerId: userId },
        select: {
          id: true,
          title: true,
          genre: true,
          plays: true,
          createdAt: true,
          _count: { select: { likes: true, auctions: true } },
        },
        orderBy: { plays: 'desc' },
      }),

      // Follower growth
      prisma.follow.findMany({
        where: { followingId: userId, createdAt: { gte: startDate } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),

      // Total plays
      prisma.beat.aggregate({
        where: { producerId: userId },
        _sum: { plays: true },
      }),

      // Bids on my auctions
      prisma.bid.findMany({
        where: {
          auction: { beat: { producerId: userId } },
          createdAt: { gte: startDate },
        },
        select: { amount: true, createdAt: true, licenseType: true },
        orderBy: { createdAt: 'asc' },
      }),

      // Reviews received
      prisma.review.findMany({
        where: { producerId: userId },
        select: { rating: true, createdAt: true },
      }),
    ])

    // ─── Revenue over time (group by day) ───
    const revenueByDay: Record<string, { revenue: number; payout: number; sales: number }> = {}
    completedAuctions.forEach(a => {
      if (a.paidAt) {
        const day = a.paidAt.toISOString().split('T')[0]
        if (!revenueByDay[day]) revenueByDay[day] = { revenue: 0, payout: 0, sales: 0 }
        revenueByDay[day].revenue += a.finalPrice || 0
        revenueByDay[day].payout += a.producerPayout || 0
        revenueByDay[day].sales += 1
      }
    })

    // Fill missing days for the chart
    const revenueChart: { date: string; revenue: number; payout: number; sales: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const key = d.toISOString().split('T')[0]
      revenueChart.push({
        date: key,
        revenue: revenueByDay[key]?.revenue || 0,
        payout: revenueByDay[key]?.payout || 0,
        sales: revenueByDay[key]?.sales || 0,
      })
    }

    // ─── Bid activity over time ───
    const bidsByDay: Record<string, number> = {}
    bidsReceived.forEach(b => {
      const day = b.createdAt.toISOString().split('T')[0]
      bidsByDay[day] = (bidsByDay[day] || 0) + 1
    })

    const bidsChart = revenueChart.map(r => ({
      date: r.date,
      bids: bidsByDay[r.date] || 0,
    }))

    // ─── Follower growth ───
    let followerCount = await prisma.follow.count({
      where: { followingId: userId, createdAt: { lt: startDate } },
    })
    const followersByDay: Record<string, number> = {}
    followers.forEach(f => {
      const day = f.createdAt.toISOString().split('T')[0]
      followersByDay[day] = (followersByDay[day] || 0) + 1
    })

    const followersChart = revenueChart.map(r => {
      followerCount += followersByDay[r.date] || 0
      return { date: r.date, total: followerCount, new: followersByDay[r.date] || 0 }
    })

    // ─── Top beats by plays ───
    const topBeats = beats.slice(0, 10).map(b => ({
      id: b.id,
      title: b.title,
      genre: b.genre,
      plays: b.plays,
      likes: b._count.likes,
      auctions: b._count.auctions,
    }))

    // ─── Genre distribution ───
    const genreMap: Record<string, number> = {}
    beats.forEach(b => {
      genreMap[b.genre] = (genreMap[b.genre] || 0) + 1
    })
    const genreDistribution = Object.entries(genreMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // ─── License distribution from sales ───
    const licenseMap: Record<string, number> = {}
    completedAuctions.forEach(a => {
      const lic = a.winningLicense || 'BASIC'
      licenseMap[lic] = (licenseMap[lic] || 0) + 1
    })
    const licenseDistribution = Object.entries(licenseMap)
      .map(([name, count]) => ({ name, count }))

    // ─── Summary stats ───
    const totalRevenue = completedAuctions.reduce((s, a) => s + (a.finalPrice || 0), 0)
    const totalPayout = completedAuctions.reduce((s, a) => s + (a.producerPayout || 0), 0)
    const totalSales = completedAuctions.length
    const totalAuctions = allAuctions.length
    const conversionRate = totalAuctions > 0 ? Math.round((totalSales / totalAuctions) * 100) : 0
    const avgSalePrice = totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0
    const totalFollowers = followersChart.length > 0 ? followersChart[followersChart.length - 1].total : 0
    const avgRating = reviews.length > 0
      ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 10) / 10
      : 0

    return NextResponse.json({
      summary: {
        totalRevenue,
        totalPayout,
        totalSales,
        totalAuctions,
        conversionRate,
        avgSalePrice,
        totalPlays: totalPlays._sum.plays || 0,
        totalBeats: beats.length,
        totalFollowers,
        totalBidsReceived: bidsReceived.length,
        avgRating,
        totalReviews: reviews.length,
      },
      charts: {
        revenue: revenueChart,
        bids: bidsChart,
        followers: followersChart,
      },
      topBeats,
      genreDistribution,
      licenseDistribution,
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
