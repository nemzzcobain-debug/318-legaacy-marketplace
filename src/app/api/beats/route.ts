export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { parseSupabaseUrl, getStreamUrl } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import { PUBLIC_BEAT_WHERE, getPublicLiveAuctionWhere } from '@/lib/public-catalog'
import { withoutPrivateBeatFiles } from '@/lib/public-beat-files'

// GET /api/beats - Liste des beats
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const genre = searchParams.get('genre')
    const mood = searchParams.get('mood')
    const search = searchParams.get('search')
    const producerId = searchParams.get('producerId')
    const mine = searchParams.get('mine')
    const eligibleForAuction = searchParams.get('eligibleForAuction') === 'true'
    const page = Number(searchParams.get('page') || 1)
    const limit = Number(searchParams.get('limit') || 20)

    const where: any = {}
    let isOwnerView = false

    // Si mine=true, récupérer les beats du producteur connecte (tout status)
    if (mine === 'true') {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
      }
      where.producerId = (session.user as any).id
      isOwnerView = true
      if (eligibleForAuction) {
        where.status = 'ACTIVE'
        where.auctions = {
          none: {
            status: { in: ['ACTIVE', 'SCHEDULED', 'ENDING_SOON', 'PENDING_APPROVAL'] },
          },
        }
      }
    } else {
      Object.assign(where, PUBLIC_BEAT_WHERE)
    }

    if (genre) where.genre = genre
    if (mood) where.mood = mood
    if (producerId) where.producerId = producerId
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { genre: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [beats, total] = await Promise.all([
      prisma.beat.findMany({
        where,
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
          auctions: {
            where: getPublicLiveAuctionWhere(),
            orderBy: { endTime: 'asc' },
            take: 1,
          },
          _count: {
            select: { likes: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.beat.count({ where }),
    ])

    // Generate public stream URLs for audio
    const beatsWithSignedUrls = beats.map((beat) => {
      const visibleBeat = isOwnerView ? beat : withoutPrivateBeatFiles(beat)
      if (visibleBeat.audioUrl) {
        const parsed = parseSupabaseUrl(visibleBeat.audioUrl)
        if (parsed) {
          return { ...visibleBeat, audioUrl: getStreamUrl(parsed.bucket, parsed.path) }
        }
      }
      return visibleBeat
    })

    return NextResponse.json({
      beats: beatsWithSignedUrls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Erreur listing beats:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Cet ancien endpoint contournait le stockage privé. Tous les nouveaux beats
// doivent passer par le flux signé /api/beats/upload.
export async function POST() {
  return NextResponse.json(
    { error: 'Utilisez le formulaire sécurisé d’upload producteur.' },
    { status: 410 }
  )
}
