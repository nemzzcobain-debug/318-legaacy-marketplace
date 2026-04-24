import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteFile } from '@/lib/supabase'

// DELETE /api/beats/[id] — Supprimer un beat (producteur uniquement)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const beatId = params.id

    // Recuperer le beat avec ses relations
    const beat = await prisma.beat.findUnique({
      where: { id: beatId },
      include: {
        auctions: {
          where: {
            status: { in: ['ACTIVE', 'ENDING_SOON', 'SCHEDULED'] },
          },
          select: { id: true },
        },
      },
    })

    if (!beat) {
      return NextResponse.json({ error: 'Beat introuvable' }, { status: 404 })
    }

    // Verifier que l'utilisateur est le proprietaire du beat
    if (beat.producerId !== (session.user as any).id) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
    }

    // Empecher la suppression si le beat a des encheres actives
    if (beat.auctions.length > 0) {
      return NextResponse.json(
        { error: 'Impossible de supprimer un beat avec des encheres actives' },
        { status: 400 }
      )
    }

    // Empecher la suppression si le beat est vendu
    if (beat.status === 'SOLD') {
      return NextResponse.json(
        { error: 'Impossible de supprimer un beat deja vendu' },
        { status: 400 }
      )
    }

    // 1. Supprimer les relations en base (likes, playlists, encheres terminees)
    // Ordre important : d'abord les sous-relations, puis les relations directes, puis le beat
    await prisma.$transaction([
      prisma.like.deleteMany({ where: { beatId } }),
      prisma.playlistBeat.deleteMany({ where: { beatId } }),
      // Reviews liees aux encheres du beat
      prisma.review.deleteMany({
        where: { auction: { beatId } },
      }),
      // Bids des encheres liees
      prisma.bid.deleteMany({
        where: { auction: { beatId } },
      }),
      // Watchlists liees aux encheres (cascade existe mais on securise)
      prisma.watchlist.deleteMany({
        where: { auction: { beatId } },
      }),
      // Encheres
      prisma.auction.deleteMany({ where: { beatId } }),
      // Le beat lui-meme
      prisma.beat.delete({ where: { id: beatId } }),
    ])

    // 2. Supprimer les fichiers de Supabase Storage (en arriere-plan, on ne bloque pas)
    const deletePromises: Promise<void>[] = []

    if (beat.audioUrl) {
      const audioPath = extractStoragePath(beat.audioUrl, 'beats')
      if (audioPath) deletePromises.push(deleteFile('beats', audioPath))
    }

    if (beat.audioWav) {
      const wavPath = extractStoragePath(beat.audioWav, 'beats')
      if (wavPath) deletePromises.push(deleteFile('beats', wavPath))
    }

    if (beat.stemsUrl) {
      const stemsPath = extractStoragePath(beat.stemsUrl, 'beats')
      if (stemsPath) deletePromises.push(deleteFile('beats', stemsPath))
    }

    if (beat.coverImage) {
      const coverPath = extractStoragePath(beat.coverImage, 'covers')
      if (coverPath) deletePromises.push(deleteFile('covers', coverPath))
    }

    // On attend les suppressions mais on ne bloque pas si ca echoue
    await Promise.allSettled(deletePromises)

    return NextResponse.json({ success: true, message: 'Beat supprime avec succes' })
  } catch (error) {
    console.error('Erreur suppression beat:', error)
    return NextResponse.json({ error: 'Erreur serveur lors de la suppression' }, { status: 500 })
  }
}

/**
 * Extrait le chemin relatif d'un fichier dans Supabase Storage a partir de l'URL publique
 * Ex: https://xxx.supabase.co/storage/v1/object/public/beats/userId/123_file.mp3
 *  -> userId/123_file.mp3
 */
function extractStoragePath(url: string, bucket: string): string | null {
  try {
    const marker = `/storage/v1/object/public/${bucket}/`
    const idx = url.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(url.substring(idx + marker.length))
  } catch {
    return null
  }
}
