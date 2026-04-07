import { Prisma } from '@prisma/client'

/**
 * Parse pagination parameters from URL search params
 * Ensures safe defaults and boundaries for page/limit values
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaults = { page: 1, limit: 20 }
) {
  const pageStr = parseInt(searchParams.get('page') || String(defaults.page))
  const page = Math.max(1, !isNaN(pageStr) ? pageStr : defaults.page)

  const limitStr = parseInt(searchParams.get('limit') || String(defaults.limit))
  const limit = Math.min(100, Math.max(1, !isNaN(limitStr) ? limitStr : defaults.limit))

  const skip = (page - 1) * limit
  return { page, limit, skip }
}

/**
 * Parse sort parameter and return appropriate Prisma OrderBy configuration
 * Supports: ending_soon, newest, most_bids, highest_bid, lowest_bid
 */
export function parseAuctionSort(
  sort: string | null
): Prisma.AuctionOrderByWithRelationInput {
  switch (sort) {
    case 'ending_soon':
      return { endTime: 'asc' }
    case 'newest':
      return { createdAt: 'desc' }
    case 'most_bids':
      return { totalBids: 'desc' }
    case 'highest_bid':
      return { currentBid: 'desc' }
    case 'lowest_bid':
      return { currentBid: 'asc' }
    default:
      return { createdAt: 'desc' }
  }
}

/**
 * Build status-based filter for auctions
 * Supports: active, ending_soon, ended, or returns empty for all
 */
export function buildStatusFilter(status: string | null): Prisma.AuctionWhereInput {
  const now = new Date()
  switch (status) {
    case 'active':
      return {
        status: { in: ['ACTIVE', 'ENDING_SOON'] },
        endTime: { gt: now },
      }
    case 'ending_soon':
      return {
        status: { in: ['ACTIVE', 'ENDING_SOON'] },
        endTime: { gt: now, lt: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      }
    case 'ended':
      return {
        OR: [{ status: 'ENDED' }, { status: 'COMPLETED' }],
      }
    default:
      return {}
  }
}

/**
 * Build genre-based filter for auctions
 * Filters by beat.genre when genre parameter is provided
 */
export function buildGenreFilter(genre: string | null): Prisma.AuctionWhereInput {
  if (!genre) return {}
  return { beat: { genre } }
}

/**
 * Parse numeric BPM range from search parameters
 * Returns null for invalid/missing values
 */
export function parseBpmRange(
  searchParams: URLSearchParams
): { bpmMin: number | null; bpmMax: number | null } {
  let bpmMin: number | null = null
  const bpmMinStr = searchParams.get('bpmMin')
  if (bpmMinStr) {
    const parsed = parseInt(bpmMinStr)
    bpmMin = !isNaN(parsed) ? parsed : null
  }

  let bpmMax: number | null = null
  const bpmMaxStr = searchParams.get('bpmMax')
  if (bpmMaxStr) {
    const parsed = parseInt(bpmMaxStr)
    bpmMax = !isNaN(parsed) ? parsed : null
  }

  return { bpmMin, bpmMax }
}

/**
 * Parse numeric price range from search parameters
 * Returns null for invalid/missing values
 */
export function parsePriceRange(
  searchParams: URLSearchParams
): { priceMin: number | null; priceMax: number | null } {
  let priceMin: number | null = null
  const priceMinStr = searchParams.get('priceMin')
  if (priceMinStr) {
    const parsed = parseFloat(priceMinStr)
    priceMin = !isNaN(parsed) ? parsed : null
  }

  let priceMax: number | null = null
  const priceMaxStr = searchParams.get('priceMax')
  if (priceMaxStr) {
    const parsed = parseFloat(priceMaxStr)
    priceMax = !isNaN(parsed) ? parsed : null
  }

  return { priceMin, priceMax }
}

/**
 * Build BPM filter for beat search
 * Combines min/max constraints into Prisma where condition
 */
export function buildBpmFilter(
  bpmMin: number | null,
  bpmMax: number | null
): Prisma.AuctionWhereInput {
  if (!bpmMin && !bpmMax) return {}

  const beatWhere: Prisma.BeatWhereInput = {}
  if (bpmMin || bpmMax) {
    beatWhere.bpm = {}
    if (bpmMin) (beatWhere.bpm as any).gte = bpmMin
    if (bpmMax) (beatWhere.bpm as any).lte = bpmMax
  }

  return { beat: beatWhere }
}

/**
 * Build price filter for auction currentBid
 * Combines min/max constraints into Prisma where condition
 */
export function buildPriceFilter(
  priceMin: number | null,
  priceMax: number | null
): Prisma.AuctionWhereInput {
  if (!priceMin && !priceMax) return {}

  return {
    currentBid: {
      ...(priceMin && { gte: priceMin }),
      ...(priceMax && { lte: priceMax }),
    },
  }
}
