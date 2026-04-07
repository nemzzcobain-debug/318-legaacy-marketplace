import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auctionId = params.id

    // Get the current auction's beat details
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        beat: {
          select: { genre: true, bpm: true, producerId: true, mood: true }
        }
      }
    })

    if (!auction?.beat) {
      return NextResponse.json({ beats: [] })
    }

    const { genre, bpm, producerId, mood } = auction.beat

    // Find similar auctions by genre, BPM range, or same producer
    const similarAuctions = await prisma.auction.findMany({
      where: {
        id: { not: auctionId },
        status: 'ACTIVE',
        endTime: { gt: new Date() },
        OR: [
          { beat: { genre: genre } },
          { beat: { bpm: { gte: (bpm || 0) - 15, lte: (bpm || 0) + 15 } } },
          ...(mood ? [{ beat: { mood: mood } }] : []),
        ],
      },
      include: {
        beat: {
          select: {
            id: true,
            title: true,
            coverImage: true,
            genre: true,
            bpm: true,
            audioUrl: true,
          }
        },
        _count: { select: { bids: true } },
      },
      orderBy: { currentBid: 'desc' },
      take: 6,
    })

    return NextResponse.json({ beats: similarAuctions })
  } catch (error) {
    console.error('Error fetching similar beats:', error)
    return NextResponse.json({ beats: [] })
  }
}
