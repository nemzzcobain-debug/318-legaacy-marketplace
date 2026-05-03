export const dynamic = 'force-dynamic'

// ─── 318 LEGAACY Marketplace - Homepage API ───
// Returns: platform stats, featured producers, top genres

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseSupabaseUrl, getStreamUrl } from '@/lib/supabase'

async function getNouveautesPreview() {
  try {
    const playlist = await prisma.playlist.findFirst({
      where: { name: 'Nouveautés', visibility: 'PUBLIC' },
      select: { id: true },
    })
    if (!playlist) return []

    const playlistBeats = await prisma.playlistBeat.findMany({
      where: { playlistId: playlist.id },
      orderBy: { addedAt: 'desc' },
      take: 4,
      include: {
        beat: {
          include: {
            producer: { select: { id: true, name: true, displayName: true, avatar: true } },
            auctions: {
              where: { status: { in: ['ENDED', 'COMPLETED', 'CANCELLED'] } },
              orderBy: { endTime: 'desc' },
              take: 1,
              select: { startPrice: true, buyNowPrice: true },
            },
          },
        },
      },
    })

    const results = playlistBeats
      .filter(pb => pb.beat.status !== 'SOLD')
      .map((pb) => {
        let streamUrl = pb.beat.audioUrl
        if (streamUrl) {
          const parsed = parseSupabaseUrl(streamUrl)
          if (parsed) {
            streamUrl = getStreamUrl(parsed.bucket, parsed.path)
          }
        }
        const lastAuction = pb.beat.auctions[0]
        return {
          id: pb.beat.id,
          title: pb.beat.title,
          genre: (pb.beat as any).genre || 'Trap',
          bpm: (pb.beat as any).bpm || 140,
          coverImage: (pb.beat as any).coverImage || null,
          audioUrl: streamUrl,
          producer: pb.beat.producer.displayName || pb.beat.producer.name,
          price: lastAuction?.buyNowPrice || lastAuction?.startPrice || 20,
        }
      })
    return results
  } catch {
    return []
  }
}

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
      featuredBeats,
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

      // Featured producers: top by completed sales
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
            },
          },
        },
        orderBy: { totalSales: 'desc' },
        take: 6,
      }),

      // Top genres from beats with active auctions only
      prisma.beat.groupBy({
        by: ['genre'],
        where: {
          status: 'ACTIVE',
          auctions: { some: { status: { in: ['ACTIVE', 'ENDING_SOON'] } } },
        },
        _count: true,
        orderBy: { _count: { genre: 'desc' } },
        take: 8,
      }),

      // Featured beats (admin-selected)
      prisma.beat.findMany({
        where: { isFeatured: true, status: 'ACTIVE' },
        orderBy: { featuredOrder: 'asc' },
        select: {
          id: true,
          title: true,
          genre: true,
          bpm: true,
          key: true,
          coverImage: true,
          audioUrl: true,
          producer: {
            select: { id: true, name: true, displayName: true, avatar: true },
          },
          auctions: {
            where: { status: { in: ['ACTIVE', 'ENDING_SOON'] } },
            select: {
              id: true,
              currentBid: true,
              startPrice: true,
              buyNowPrice: true,
              status: true,
              endTime: true,
              totalBids: true,
              licenseType: true,
            },
            take: 1,
          },
        },
        take: 10,
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
        totalFollowers: 0,
      })),
      topGenres: topGenres.map(g => ({
        name: g.genre,
        count: g._count,
      })),
      featuredBeats: featuredBeats.map((b) => {
        let streamUrl = b.audioUrl
        if (streamUrl) {
          const parsed = parseSupabaseUrl(streamUrl)
          if (parsed) {
            streamUrl = getStreamUrl(parsed.bucket, parsed.path)
          }
        }
        return {
          id: b.id,
          title: b.title,
          genre: b.genre,
          bpm: b.bpm,
          key: b.key,
          coverImage: b.coverImage,
          audioUrl: streamUrl,
          producer: {
            id: b.producer.id,
            name: b.producer.displayName || b.producer.name,
            avatar: b.producer.avatar,
          },
          auction: b.auctions[0] || null,
        }
      }),
      nouveautesBeats: await getNouveautesPreview(),
    })
  } catch (error) {
    console.error('Homepage API error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
