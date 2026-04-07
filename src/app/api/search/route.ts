export const dynamic = 'force-dynamic'

// ─── 318 LEGAACY Marketplace - Advanced Search API ───
// Searches across beats and auctions with advanced filters
// Supports: query, genre, bpmMin/bpmMax, key, mood, priceMin/priceMax, producerId, licenseType, status, sort

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import {
  parsePagination,
  parseAuctionSort,
  buildStatusFilter,
  parseBpmRange,
  parsePriceRange,
  buildBpmFilter,
  buildPriceFilter,
} from '@/lib/auction-helpers'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const query = searchParams.get('q')?.trim()
    const genre = searchParams.get('genre')
    const { bpmMin, bpmMax } = parseBpmRange(searchParams)
    const key = searchParams.get('key')
    const mood = searchParams.get('mood')
    const { priceMin, priceMax } = parsePriceRange(searchParams)
    const producerId = searchParams.get('producerId')
    const licenseType = searchParams.get('licenseType')
    const status = searchParams.get('status') || 'active'
    const sort = searchParams.get('sort') || 'ending_soon'

    // Parse pagination
    const { page, limit, skip } = parsePagination(searchParams, { page: 1, limit: 20 })

    // Build beat filter
    const beatWhere: Prisma.BeatWhereInput = {}

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

    // Build auction filter
    const auctionWhere: Prisma.AuctionWhereInput = {
      beat: beatWhere,
      ...buildStatusFilter(status),
      ...buildBpmFilter(bpmMin, bpmMax),
      ...buildPriceFilter(priceMin, priceMax),
    }

    if (licenseType) auctionWhere.licenseType = licenseType

    // Parse sort
    const orderBy = parseAuctionSort(sort)

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
        skip,
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
    logger.error('Search error:', { error: String(error) })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
