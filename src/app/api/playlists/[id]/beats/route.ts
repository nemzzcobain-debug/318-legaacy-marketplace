export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/playlists/[id]/beats - Add beat to playlist
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const userId = (session.user as any).id
    const playlist = await prisma.playlist.findUnique({ where: { id: params.id } })

    if (!playlist) return NextResponse.json({ error: 'Playlist non trouvée' }, { status: 404 })
    if (playlist.userId !== userId) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    const { beatId } = await request.json()
    if (!beatId) return NextResponse.json({ error: 'beatId requis' }, { status: 400 })

    // Check beat exists
    const beat = await prisma.beat.findUnique({ where: { id: beatId } })
    if (!beat) return NextResponse.json({ error: 'Beat non trouvé' }, { status: 404 })

    // Check if already in playlist
    const existing = await prisma.playlistBeat.findUnique({
      where: { playlistId_beatId: { playlistId: params.id, beatId } },
    })
    if (existing) return NextResponse.json({ error: 'Beat déjà dans la playlist' }, { status: 409 })

    // Limit beats per playlist (max 200)
    const count = await prisma.playlistBeat.count({ where: { playlistId: params.id } })
    if (count >= 200) return NextResponse.json({ error: 'Limite de 200 beats par playlist' }, { status: 400 })

    // Get next position
    const lastBeat = await prisma.playlistBeat.findFirst({
      where: { playlistId: params.id },
      orderBy: { position: 'desc' },
    })
    const position = (lastBeat?.position ?? -1) + 1

    const playlistBeat = await prisma.playlistBeat.create({
      data: { playlistId: params.id, beatId, position },
      include: {
        beat: {
          select: { id: true, title: true, coverImage: true, genre: true, bpm: true, audioUrl: true }
        }
      }
    })

    // Update playlist updatedAt
    await prisma.playlist.update({ where: { id: params.id }, data: { updatedAt: new Date() } })

    return NextResponse.json(playlistBeat, { status: 201 })
  } catch (error) {
    console.error('Playlist beats POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/playlists/[id]/beats - Remove beat from playlist
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const userId = (session.user as any).id
    const playlist = await prisma.playlist.findUnique({ where: { id: params.id } })

    if (!playlist) return NextResponse.json({ error: 'Playlist non trouvée' }, { status: 404 })
    if (playlist.userId !== userId) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    const { beatId } = await request.json()
    if (!beatId) return NextResponse.json({ error: 'beatId requis' }, { status: 400 })

    await prisma.playlistBeat.delete({
      where: { playlistId_beatId: { playlistId: params.id, beatId } },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Playlist beats DELETE error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
