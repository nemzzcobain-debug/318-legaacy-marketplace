export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/playlists/[id] - Get playlist detail
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    const playlist = await prisma.playlist.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { id: true, name: true, displayName: true, avatar: true } },
        beats: {
          include: {
            beat: {
              select: {
                id: true, title: true, coverImage: true, genre: true, bpm: true,
                key: true, mood: true, duration: true, audioUrl: true, plays: true,
                producer: { select: { id: true, name: true, displayName: true, avatar: true } },
                auctions: {
                  where: { status: { in: ['ACTIVE', 'ENDING_SOON'] } },
                  select: { id: true, currentBid: true, endTime: true, status: true },
                  take: 1,
                },
              }
            }
          },
          orderBy: { position: 'asc' },
        },
        _count: { select: { beats: true } },
      },
    })

    if (!playlist) {
      return NextResponse.json({ error: 'Playlist non trouvée' }, { status: 404 })
    }

    // Check visibility
    if (playlist.visibility === 'PRIVATE' && playlist.userId !== userId) {
      return NextResponse.json({ error: 'Playlist privée' }, { status: 403 })
    }

    return NextResponse.json(playlist)
  } catch (error) {
    console.error('Playlist GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/playlists/[id] - Update playlist
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const userId = (session.user as any).id
    const playlist = await prisma.playlist.findUnique({ where: { id: params.id } })

    if (!playlist) return NextResponse.json({ error: 'Playlist non trouvée' }, { status: 404 })
    if (playlist.userId !== userId) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    const body = await request.json()
    const { name, description, visibility, coverImage } = body

    const updateData: any = {}
    if (name !== undefined) {
      if (name.trim().length < 1) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
      updateData.name = name.trim()
    }
    if (description !== undefined) updateData.description = description?.trim() || null
    if (visibility !== undefined) updateData.visibility = visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC'
    if (coverImage !== undefined) updateData.coverImage = coverImage || null

    const updated = await prisma.playlist.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Playlist PUT error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/playlists/[id] - Delete playlist
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const userId = (session.user as any).id
    const playlist = await prisma.playlist.findUnique({ where: { id: params.id } })

    if (!playlist) return NextResponse.json({ error: 'Playlist non trouvée' }, { status: 404 })
    if (playlist.userId !== userId) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    await prisma.playlist.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Playlist DELETE error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
