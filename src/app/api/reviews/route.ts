// ─── 318 LEGAACY Marketplace - Reviews API ───
// POST: create a review (only for auction winners who paid)
// GET: list reviews for a producer, or check eligibility

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ─── POST: Create a review ───
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { producerId, auctionId, rating, comment } = await req.json()

    // Validate inputs
    if (!producerId || !auctionId || !rating) {
      return NextResponse.json({ error: 'producerId, auctionId et rating requis' }, { status: 400 })
    }

    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json({ error: 'Le rating doit être entre 1 et 5' }, { status: 400 })
    }

    if (comment && comment.length > 500) {
      return NextResponse.json({ error: 'Commentaire trop long (max 500 caractères)' }, { status: 400 })
    }

    // Can't review yourself
    if (producerId === session.user.id) {
      return NextResponse.json({ error: 'Impossible de se noter soi-même' }, { status: 400 })
    }

    // Verify the auction exists, is completed, paid, and user is the winner
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        beat: { select: { producerId: true, title: true } },
        review: { select: { id: true } },
      },
    })

    if (!auction) {
      return NextResponse.json({ error: 'Enchère introuvable' }, { status: 404 })
    }

    if (auction.winnerId !== session.user.id) {
      return NextResponse.json({ error: 'Seul le gagnant peut laisser un avis' }, { status: 403 })
    }

    if (!auction.paidAt) {
      return NextResponse.json({ error: 'Le paiement doit être finalisé avant de laisser un avis' }, { status: 400 })
    }

    if (auction.beat.producerId !== producerId) {
      return NextResponse.json({ error: 'Le producteur ne correspond pas à cette enchère' }, { status: 400 })
    }

    if (auction.review) {
      return NextResponse.json({ error: 'Tu as déjà laissé un avis pour cette enchère' }, { status: 409 })
    }

    // Create the review
    const review = await prisma.review.create({
      data: {
        rating,
        comment: comment?.trim() || null,
        authorId: session.user.id,
        producerId,
        auctionId,
      },
      include: {
        author: {
          select: { id: true, name: true, displayName: true, avatar: true },
        },
      },
    })

    // Update producer's average rating
    const avgResult = await prisma.review.aggregate({
      where: { producerId },
      _avg: { rating: true },
      _count: true,
    })

    await prisma.user.update({
      where: { id: producerId },
      data: { rating: Math.round((avgResult._avg.rating || 0) * 10) / 10 },
    })

    // Notify the producer
    await prisma.notification.create({
      data: {
        type: 'SYSTEM',
        title: 'Nouvel avis reçu',
        message: `${session.user.name || 'Utilisateur'} t'a donné ${rating}/5 étoiles pour "${auction.beat.title}"`,
        link: `/producer/${producerId}`,
        userId: producerId,
      },
    })

    return NextResponse.json({
      review,
      newAvgRating: avgResult._avg.rating || 0,
      totalReviews: avgResult._count,
    })
  } catch (error) {
    console.error('Review create error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ─── GET: List reviews or check eligibility ───
// ?producerId=xxx — list all reviews for a producer
// ?eligible=producerId — check which auctions user can review
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const producerId = searchParams.get('producerId')
    const eligible = searchParams.get('eligible')

    // ─── List reviews for a producer ───
    if (producerId) {
      const reviews = await prisma.review.findMany({
        where: { producerId },
        include: {
          author: {
            select: { id: true, name: true, displayName: true, avatar: true },
          },
          auction: {
            select: {
              id: true,
              beat: { select: { title: true, genre: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      const stats = await prisma.review.aggregate({
        where: { producerId },
        _avg: { rating: true },
        _count: true,
      })

      // Rating distribution
      const distribution = await prisma.review.groupBy({
        by: ['rating'],
        where: { producerId },
        _count: true,
      })

      const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      distribution.forEach(d => {
        ratingDistribution[d.rating] = d._count
      })

      return NextResponse.json({
        reviews,
        avgRating: stats._avg.rating || 0,
        totalReviews: stats._count,
        ratingDistribution,
      })
    }

    // ─── Check eligibility ───
    if (eligible) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      }

      // Find completed+paid auctions won by user for this producer, without a review
      const eligibleAuctions = await prisma.auction.findMany({
        where: {
          winnerId: session.user.id,
          paidAt: { not: null },
          beat: { producerId: eligible },
          review: null, // no review yet
        },
        select: {
          id: true,
          finalPrice: true,
          winningLicense: true,
          paidAt: true,
          beat: {
            select: { title: true, genre: true, coverImage: true },
          },
        },
        orderBy: { paidAt: 'desc' },
      })

      return NextResponse.json({ eligibleAuctions })
    }

    return NextResponse.json({ error: 'Paramètre requis: producerId ou eligible' }, { status: 400 })
  } catch (error) {
    console.error('Reviews GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
