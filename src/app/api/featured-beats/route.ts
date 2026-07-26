export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PUBLIC_BEAT_WHERE } from '@/lib/public-catalog'
import { getStreamUrl, parseSupabaseUrl } from '@/lib/supabase'

export async function GET() {
  try {
    const now = new Date()
    const beats = await prisma.beat.findMany({
      where: {
        AND: [PUBLIC_BEAT_WHERE, { isFeatured: true }],
      },
      orderBy: [{ featuredOrder: 'asc' }, { featuredAt: 'desc' }],
      select: {
        id: true,
        title: true,
        genre: true,
        bpm: true,
        key: true,
        coverImage: true,
        audioUrl: true,
        priceMp3: true,
        priceWav: true,
        priceStems: true,
        producer: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatar: true,
          },
        },
        auctions: {
          where: {
            status: { in: ['ACTIVE', 'ENDING_SOON'] },
            startTime: { lte: now },
            endTime: { gt: now },
          },
          orderBy: { endTime: 'asc' },
          take: 1,
          select: {
            id: true,
            currentBid: true,
            startPrice: true,
            buyNowPrice: true,
            endTime: true,
            totalBids: true,
            licenseType: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        beats: beats.map((beat) => {
          let audioUrl = beat.audioUrl
          if (audioUrl) {
            const parsed = parseSupabaseUrl(audioUrl)
            if (parsed) audioUrl = getStreamUrl(parsed.bucket, parsed.path)
          }

          return {
            id: beat.id,
            title: beat.title,
            genre: beat.genre,
            bpm: beat.bpm,
            key: beat.key,
            coverImage: beat.coverImage,
            audioUrl,
            directPrice: beat.priceMp3 ?? beat.priceWav ?? beat.priceStems,
            producer: {
              id: beat.producer.id,
              name: beat.producer.displayName || beat.producer.name,
              avatar: beat.producer.avatar,
            },
            auction: beat.auctions[0] || null,
          }
        }),
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  } catch (error) {
    console.error('Featured beats API error:', error)
    return NextResponse.json(
      { error: 'Impossible de charger la sélection de la semaine' },
      { status: 500 }
    )
  }
}
