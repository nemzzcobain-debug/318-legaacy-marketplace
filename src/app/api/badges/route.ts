import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ─── Badge Definitions ───
// Badges are computed dynamically based on producer stats

export interface Badge {
  id: string
  name: string
  description: string
  icon: string       // emoji
  color: string      // hex
  category: 'sales' | 'beats' | 'community' | 'quality' | 'special'
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

interface BadgeRule {
  badge: Badge
  check: (stats: ProducerStats) => boolean
}

interface ProducerStats {
  totalBeats: number
  totalSales: number
  totalRevenue: number
  totalBids: number
  totalFollowers: number
  totalReviews: number
  avgRating: number
  totalAuctions: number
  completedAuctions: number
  accountAgeDays: number
  hasStripe: boolean
}

const BADGE_RULES: BadgeRule[] = [
  // ─── SALES BADGES ───
  {
    badge: {
      id: 'first_sale',
      name: 'Premiere Vente',
      description: 'A realise sa premiere vente sur la plateforme',
      icon: '🎯',
      color: '#2ed573',
      category: 'sales',
      rarity: 'common',
    },
    check: (s) => s.totalSales >= 1,
  },
  {
    badge: {
      id: 'sales_5',
      name: 'Vendeur Confirme',
      description: 'A realise 5 ventes',
      icon: '💰',
      color: '#ffa502',
      category: 'sales',
      rarity: 'rare',
    },
    check: (s) => s.totalSales >= 5,
  },
  {
    badge: {
      id: 'sales_25',
      name: 'Machine a Hits',
      description: 'A realise 25 ventes',
      icon: '🔥',
      color: '#e11d48',
      category: 'sales',
      rarity: 'epic',
    },
    check: (s) => s.totalSales >= 25,
  },
  {
    badge: {
      id: 'sales_100',
      name: 'Platine',
      description: 'A realise 100 ventes - Legende du marketplace',
      icon: '💎',
      color: '#a855f7',
      category: 'sales',
      rarity: 'legendary',
    },
    check: (s) => s.totalSales >= 100,
  },
  {
    badge: {
      id: 'revenue_1000',
      name: '1K Club',
      description: 'A genere plus de 1 000 EUR de revenus',
      icon: '💵',
      color: '#2ed573',
      category: 'sales',
      rarity: 'rare',
    },
    check: (s) => s.totalRevenue >= 1000,
  },
  {
    badge: {
      id: 'revenue_10000',
      name: '10K Club',
      description: 'A genere plus de 10 000 EUR de revenus',
      icon: '🏆',
      color: '#ffd700',
      category: 'sales',
      rarity: 'legendary',
    },
    check: (s) => s.totalRevenue >= 10000,
  },

  // ─── BEATS BADGES ───
  {
    badge: {
      id: 'first_beat',
      name: 'Premier Beat',
      description: 'A uploade son premier beat',
      icon: '🎵',
      color: '#667eea',
      category: 'beats',
      rarity: 'common',
    },
    check: (s) => s.totalBeats >= 1,
  },
  {
    badge: {
      id: 'beats_10',
      name: 'Productif',
      description: 'A uploade 10 beats',
      icon: '🎹',
      color: '#667eea',
      category: 'beats',
      rarity: 'rare',
    },
    check: (s) => s.totalBeats >= 10,
  },
  {
    badge: {
      id: 'beats_50',
      name: 'Beatmaker Pro',
      description: 'A uploade 50 beats',
      icon: '🎛️',
      color: '#ec4899',
      category: 'beats',
      rarity: 'epic',
    },
    check: (s) => s.totalBeats >= 50,
  },
  {
    badge: {
      id: 'beats_100',
      name: 'Usine a Beats',
      description: 'A uploade 100 beats - Production industrielle',
      icon: '🏭',
      color: '#a855f7',
      category: 'beats',
      rarity: 'legendary',
    },
    check: (s) => s.totalBeats >= 100,
  },

  // ─── COMMUNITY BADGES ───
  {
    badge: {
      id: 'followers_10',
      name: 'Influent',
      description: 'A atteint 10 followers',
      icon: '👥',
      color: '#3b82f6',
      category: 'community',
      rarity: 'common',
    },
    check: (s) => s.totalFollowers >= 10,
  },
  {
    badge: {
      id: 'followers_50',
      name: 'Star Montante',
      description: 'A atteint 50 followers',
      icon: '⭐',
      color: '#f59e0b',
      category: 'community',
      rarity: 'rare',
    },
    check: (s) => s.totalFollowers >= 50,
  },
  {
    badge: {
      id: 'followers_200',
      name: 'Superstar',
      description: 'A atteint 200 followers',
      icon: '🌟',
      color: '#ffd700',
      category: 'community',
      rarity: 'epic',
    },
    check: (s) => s.totalFollowers >= 200,
  },
  {
    badge: {
      id: 'followers_1000',
      name: 'Icone',
      description: '1 000 followers - Une veritable icone du beatmaking',
      icon: '👑',
      color: '#a855f7',
      category: 'community',
      rarity: 'legendary',
    },
    check: (s) => s.totalFollowers >= 1000,
  },
  {
    badge: {
      id: 'bids_hot',
      name: 'En Demande',
      description: 'A recu plus de 50 encheres au total',
      icon: '🔔',
      color: '#ef4444',
      category: 'community',
      rarity: 'rare',
    },
    check: (s) => s.totalBids >= 50,
  },

  // ─── QUALITY BADGES ───
  {
    badge: {
      id: 'top_rated',
      name: 'Top Note',
      description: 'Note moyenne de 4.5+ avec au moins 5 avis',
      icon: '⭐',
      color: '#ffd700',
      category: 'quality',
      rarity: 'epic',
    },
    check: (s) => s.avgRating >= 4.5 && s.totalReviews >= 5,
  },
  {
    badge: {
      id: 'perfect_rating',
      name: 'Perfection',
      description: 'Note parfaite de 5/5 avec au moins 3 avis',
      icon: '💯',
      color: '#2ed573',
      category: 'quality',
      rarity: 'epic',
    },
    check: (s) => s.avgRating === 5 && s.totalReviews >= 3,
  },
  {
    badge: {
      id: 'reviews_10',
      name: 'Approuve',
      description: 'A recu 10 avis positifs',
      icon: '✅',
      color: '#10b981',
      category: 'quality',
      rarity: 'rare',
    },
    check: (s) => s.totalReviews >= 10 && s.avgRating >= 4,
  },

  // ─── SPECIAL BADGES ───
  {
    badge: {
      id: 'early_adopter',
      name: 'Early Adopter',
      description: 'A rejoint la plateforme dans les 90 premiers jours',
      icon: '🚀',
      color: '#8b5cf6',
      category: 'special',
      rarity: 'rare',
    },
    check: (s) => s.accountAgeDays >= 0, // We check date in the API
  },
  {
    badge: {
      id: 'stripe_ready',
      name: 'Pret a Encaisser',
      description: 'A connecte son compte Stripe',
      icon: '💳',
      color: '#635bff',
      category: 'special',
      rarity: 'common',
    },
    check: (s) => s.hasStripe,
  },
  {
    badge: {
      id: 'all_rounder',
      name: 'Complet',
      description: 'A des beats, des ventes, des followers et des avis',
      icon: '🎪',
      color: '#06b6d4',
      category: 'special',
      rarity: 'epic',
    },
    check: (s) => s.totalBeats >= 5 && s.totalSales >= 3 && s.totalFollowers >= 5 && s.totalReviews >= 3,
  },
]

// Platform launch date for early adopter badge
const PLATFORM_LAUNCH = new Date('2025-10-01')
const EARLY_ADOPTER_CUTOFF = new Date('2026-01-01') // 90 days after launch

// ─── LEVEL SYSTEM ───
interface Level {
  level: number
  name: string
  minXP: number
  color: string
}

const LEVELS: Level[] = [
  { level: 1, name: 'Debutant', minXP: 0, color: '#6b7280' },
  { level: 2, name: 'Amateur', minXP: 100, color: '#3b82f6' },
  { level: 3, name: 'Semi-Pro', minXP: 300, color: '#8b5cf6' },
  { level: 4, name: 'Professionnel', minXP: 700, color: '#f59e0b' },
  { level: 5, name: 'Expert', minXP: 1500, color: '#ef4444' },
  { level: 6, name: 'Maitre', minXP: 3000, color: '#e11d48' },
  { level: 7, name: 'Legende', minXP: 6000, color: '#a855f7' },
  { level: 8, name: 'Icone 318', minXP: 10000, color: '#ffd700' },
]

function calculateXP(stats: ProducerStats): number {
  let xp = 0
  xp += stats.totalBeats * 10          // 10 XP per beat uploaded
  xp += stats.totalSales * 50          // 50 XP per sale
  xp += stats.totalRevenue * 0.5       // 0.5 XP per EUR earned
  xp += stats.totalFollowers * 5       // 5 XP per follower
  xp += stats.totalBids * 2            // 2 XP per bid received
  xp += stats.totalReviews * 15        // 15 XP per review received
  xp += stats.avgRating * 20           // Up to 100 XP for perfect rating
  xp += stats.completedAuctions * 10   // 10 XP per completed auction
  return Math.floor(xp)
}

function getLevel(xp: number): Level & { xp: number; nextLevelXP: number | null; progress: number } {
  let currentLevel = LEVELS[0]
  for (const level of LEVELS) {
    if (xp >= level.minXP) {
      currentLevel = level
    } else {
      break
    }
  }

  const currentIndex = LEVELS.indexOf(currentLevel)
  const nextLevel = currentIndex < LEVELS.length - 1 ? LEVELS[currentIndex + 1] : null

  return {
    ...currentLevel,
    xp,
    nextLevelXP: nextLevel?.minXP || null,
    progress: nextLevel
      ? Math.min(100, Math.round(((xp - currentLevel.minXP) / (nextLevel.minXP - currentLevel.minXP)) * 100))
      : 100,
  }
}

// ─── GET /api/badges?userId=xxx ───
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId requis' }, { status: 400 })
  }

  try {
    // Fetch all stats in parallel
    const [
      user,
      totalBeats,
      totalSalesData,
      totalBids,
      totalFollowers,
      reviewStats,
      auctionStats,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          createdAt: true,
          stripeAccountId: true,
          totalSales: true,
          rating: true,
        },
      }),
      prisma.beat.count({ where: { producerId: userId } }),
      prisma.auction.aggregate({
        where: { beat: { producerId: userId }, paidAt: { not: null } },
        _sum: { producerPayout: true },
        _count: true,
      }),
      prisma.bid.count({
        where: { auction: { beat: { producerId: userId } } },
      }),
      prisma.follow.count({ where: { followingId: userId } }),
      prisma.review.aggregate({
        where: { producerId: userId },
        _avg: { rating: true },
        _count: true,
      }),
      prisma.auction.count({
        where: { beat: { producerId: userId }, status: 'COMPLETED' },
      }),
    ])

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 })
    }

    const stats: ProducerStats = {
      totalBeats,
      totalSales: totalSalesData._count || 0,
      totalRevenue: totalSalesData._sum.producerPayout || 0,
      totalBids,
      totalFollowers,
      totalReviews: reviewStats._count || 0,
      avgRating: reviewStats._avg.rating || 0,
      totalAuctions: auctionStats,
      completedAuctions: auctionStats,
      accountAgeDays: Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      hasStripe: !!user.stripeAccountId,
    }

    // Compute earned badges
    const earnedBadges: Badge[] = []
    for (const rule of BADGE_RULES) {
      // Special handling for early_adopter
      if (rule.badge.id === 'early_adopter') {
        if (new Date(user.createdAt) <= EARLY_ADOPTER_CUTOFF) {
          earnedBadges.push(rule.badge)
        }
        continue
      }
      if (rule.check(stats)) {
        earnedBadges.push(rule.badge)
      }
    }

    // Compute level
    const xp = calculateXP(stats)
    const level = getLevel(xp)

    // Next badges to unlock
    const unlockedIds = new Set(earnedBadges.map((b) => b.id))
    const nextBadges = BADGE_RULES
      .filter((r) => !unlockedIds.has(r.badge.id))
      .slice(0, 3)
      .map((r) => r.badge)

    return NextResponse.json({
      badges: earnedBadges,
      totalBadges: earnedBadges.length,
      maxBadges: BADGE_RULES.length,
      level,
      nextBadges,
      stats,
    })
  } catch (error) {
    console.error('Badges error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
