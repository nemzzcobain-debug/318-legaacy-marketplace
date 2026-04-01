// ─── 318 LEGAACY Marketplace - Advanced Search API ───
// Searches across beats and auctions with advanced filters
// Supports: query, genre, bpmMin/bpmMax, key, mood, priceMin/priceMax, producerId, licenseType, status, sort

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const query = searchParams.get('q')?.trim()
    const genre = searchParams.get('genre')
    const bpmMin = searchParams.get('bpmMin') ? parseInt(searchParams.get('bpmMin')!) : null
    const bpmMax = searchParams.get('bpmMax') ? parseInt(searchParams.get('bpmMax')!) : null
    const key = searchParams.get('key')
    const mood = searchParams.get('mood')
    const priceMin = searchParams.get('priceMin') ? parseFloat(searchParams.get('priceMin')!) : null
    const priceMax = searchParams.get('priceMax') ? parseFloat(searchParams.get('priceMax')!) : null
    const producerId = searchParams.get('producerId')
    const licenseType = searchParams.get('licenseType')
    const status = searchParams.get('status') || 'active'
    const sort = searchParams.get('sort') || 'ending_soon'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    // Build beat filter
    const beatWhere: any = {}

    if (query) {
      beatWhere.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { genre: { contains: query, mode: 'insensitive' } },
        { tags: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { producer: { name: { contains: query, mode: 'insensitive' } } },
        { producer: { displayName: { contains: query, mode: 'insensitive' } } },
      ]
    }

    if (genre) beatWhere.genre = { equals: genre, mode: 'insensitive' }
    if (key) beatWhere.key = { equals: key, mode: 'insensitive' }
    if (mood) beatWhere.mood = { equals: mood, mode: 'insensitive' }
    if (producerId) beatWhere.producerId = producerId

    if (bpmMin || bpmMax) {
      beatWhere.bpm = {}
      if (bpmMin) beatWhere.bpm.gte = bpmMin
      if (bpmMax) beatWhere.bpm.lte = bpmMax
    }

    // Build auction filter
    const auctionWhere: any = { beat: beatWhere }

    if (status === 'active') {
      auctionWhere.status = { in: ['ACTIVE', 'ENDING_SOON'] }
      auctionWhere.endTime = { gt: new Date() }
    } else if (status === 'ending_soon') {
      auctionWhere.status = { in: ['ACTIVE', 'ENDING_SOON'] }
      auctionWhere.endTime = { gt: new Date(), lt: new Date(Date.now() + 3600000) }
    } else if (status === 'ended') {
      auctionWhere.status = { in: ['ENDED', 'COMPLETED'] }
    } else if (status === 'all') {
      // no filter
    }

    if (licenseType) auctionWhere.licenseType = licenseType

    if (priceMin || priceMax) {
      auctionWhere.currentBid = {}
      if (priceMin) auctionWhere.currentBid.gte = priceMin
      if (priceMax) auctionWhere.currentBid.lte = priceMax
    }

    // Sort
    let orderBy: any = {}
    switch (sort) {
      case 'ending_soon': orderBy = { endTime: 'asc' }; break
      case 'newest': orderBy = { createdAt: 'desc' }; break
      case 'most_bids': orderBy = { totalBids: 'desc' }; break
      case 'highest_bid': orderBy = { currentBid: 'desc' }; break
      case 'lowest_bid': orderBy = { currentBid: 'asc' }; break
      default: orderBy = { endTime: 'asc' }
    }

    const [auctions, total] = await Promise.all([
      prisma.auction.findMany({
        where: auctionWhere,
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
                  producerStatus: true,
                },
              },
              _count: { select: { likes: true } },
            },
          },
          _count: { select: { bids: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auction.count({ where: auctionWhere }),
    ])

    // Get available filter options for the sidebar
    const [genres, keys, moods] = await Promise.all([
      prisma.beat.groupBy({ by: ['genre'], _count: true, orderBy: { _count: { genre: 'desc' } }, take: 50 }),
      prisma.beat.groupBy({ by: ['key'], where: { key: { not: null } }, _count: true, orderBy: { _count: { key: 'desc' } }, take: 50 }),
      prisma.beat.groupBy({ by: ['mood'], where: { mood: { not: null } }, _count: true, orderBy: { _count: { mood: 'desc' } }, take: 50 }),
    ])

    return NextResponse.json({
      auctions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: {
        genres: genres.map(g => ({ name: g.genre, count: g._count })),
        keys: keys.map(k => ({ name: k.key!, count: k._count })),
        moods: moods.map(m => ({ name: m.mood!, count: m._count })),
      },
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
