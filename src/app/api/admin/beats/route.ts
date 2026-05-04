export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseSupabaseUrl, getStreamUrl } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const genre = searchParams.get('genre')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const page = Number(searchParams.get('page') || 1)
    const limit = Number(searchParams.get('limit') || 20)

    const where: any = {}

    // Admin voit TOUS les beats (pas de filtre status par défaut)
    if (status) where.status = status
    if (genre) where.genre = genre
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
            },
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
      if (beat.audioUrl) {
        const parsed = parseSupabaseUrl(beat.audioUrl)
        if (parsed) {
          return { ...beat, audioUrl: getStreamUrl(parsed.bucket, parsed.path) }
        }
      }
      return beat
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
    console.error('Admin beats error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
