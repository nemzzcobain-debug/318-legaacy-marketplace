import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/playlists - List playlists (user's own + public)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    const { searchParams } = new URL(request.url)

    const mode = searchParams.get('mode') || 'mine' // mine | public | user
    const targetUserId = searchParams.get('userId')

    let where: any = {}

    if (mode === 'mine') {
      if (!userId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      where = { userId }
    } else if (mode === 'public') {
      where = { visibility: 'PUBLIC' }
    } else if (mode === 'user' && targetUserId) {
      where = {
        userId: targetUserId,
        ...(targetUserId !== userId ? { visibility: 'PUBLIC' } : {}),
      }
    }

    const playlists = await prisma.playlist.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, displayName: true, avatar: true } },
        beats: {
          include: {
            beat: {
              select: { id: true, title: true, coverImage: true, genre: true, bpm: true, audioUrl: true, producer: { select: { id: true, name: true, displayName: true } } }
            }
          },
          orderBy: { position: 'asc' },
          take: 4, // Preview: first 4 beats
        },
        _count: { select: { beats: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(playlists)
  } catch (error) {
    console.error('Playlists GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/playlists - Create a playlist
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const userId = (session.user as any).id
    const body = await request.json()
    const { name, description, visibility } = body

    if (!name || name.trim().length < 1) {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    }

    if (name.trim().length > 100) {
      return NextResponse.json({ error: 'Le nom ne peut pas dépasser 100 caractères' }, { status: 400 })
    }

    // Limit playlists per user (max 50)
    const count = await prisma.playlist.count({ where: { userId } })
    if (count >= 50) {
      return NextResponse.json({ error: 'Limite de 50 playlists atteinte' }, { status: 400 })
    }

    const playlist = await prisma.playlist.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        visibility: visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
        userId,
      },
      include: {
        user: { select: { id: true, name: true, displayName: true, avatar: true } },
        _count: { select: { beats: true } },
      },
    })

    return NextResponse.json(playlist, { status: 201 })
  } catch (error) {
    console.error('Playlists POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
