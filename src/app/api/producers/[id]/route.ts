export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET — Recuperer le profil public d'un producteur
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const producer = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        displayName: true,
        avatar: true,
        bio: true,
        producerBio: true,
        producerStatus: true,
        role: true,
        rating: true,
        totalSales: true,
        createdAt: true,
        beats: {
          where: { status: { in: ['ACTIVE', 'DRAFT'] } },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            genre: true,
            mood: true,
            bpm: true,
            key: true,
            audioUrl: true,
            coverImage: true,
            plays: true,
            status: true,
            createdAt: true,
            _count: { select: { likes: true } },
            auctions: {
              where: { status: { in: ['ACTIVE', 'ENDING_SOON', 'SCHEDULED'] } },
              select: {
                id: true,
                status: true,
                currentBid: true,
                startPrice: true,
                totalBids: true,
                endTime: true,
                licenseType: true,
              },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        _count: {
          select: {
            beats: true,
            wonAuctions: true,
          },
        },
      },
    })

    if (!producer) {
      return NextResponse.json({ error: 'Producteur non trouve' }, { status: 404 })
    }

    if (producer.role !== 'PRODUCER' && producer.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Cet utilisateur n\'est pas un producteur' }, { status: 404 })
    }

    // Stats supplementaires
    const totalAuctions = await prisma.auction.count({
      where: { beat: { producerId: params.id } },
    })

    const completedAuctions = await prisma.auction.count({
      where: {
        beat: { producerId: params.id },
        status: 'COMPLETED',
      },
    })

    const totalPlays = await prisma.beat.aggregate({
      where: { producerId: params.id },
      _sum: { plays: true },
    })

    const totalLikes = await prisma.like.count({
      where: { beat: { producerId: params.id } },
    })

    const totalFollowers = await prisma.follow.count({
      where: { followingId: params.id },
    })

    // Only fetch revenue if viewing own profile
    let stats: any = {
      totalBeats: producer._count.beats,
      totalAuctions,
      completedAuctions,
      totalPlays: totalPlays._sum.plays || 0,
      totalLikes,
      totalFollowers,
      memberSince: producer.createdAt,
    }

    // Only include revenue data if the requesting user IS the producer
    if (session?.user?.id === params.id) {
      const revenue = await prisma.auction.aggregate({
        where: {
          beat: { producerId: params.id },
          status: 'COMPLETED',
        },
        _sum: { producerPayout: true },
      })
      stats.totalRevenue = revenue._sum.producerPayout || 0
    }

    return NextResponse.json({
      ...producer,
      stats,
    })
  } catch (error: any) {
    console.error('Erreur profil producteur:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
