export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/nouveautes — Recuperer les beats de la playlist "Nouveautes"
export async function GET() {
  try {
    // Trouver la playlist "Nouveautes" publique
    const playlist = await prisma.playlist.findFirst({
      where: {
        name: 'Nouveautés',
        visibility: 'PUBLIC',
      },
      include: {
        beats: {
          orderBy: { addedAt: 'desc' },
          include: {
            beat: {
              include: {
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
                    status: { in: ['ACTIVE', 'ENDING_SOON', 'SCHEDULED'] },
                  },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    })

    if (!playlist) {
      return NextResponse.json({ beats: [] })
    }

    // Filtrer: exclure les beats en encheres actives ou deja vendus
    const availableBeats = playlist.beats
      .filter((pb) => pb.beat.auctions.length === 0 && pb.beat.status !== 'SOLD')
      .map((pb) => {
        // Chercher le prix de base (on le fait en async ci-dessous)
        return pb
      })

    // Recuperer les prix de base pour chaque beat (startPrice de la derniere enchere)
    const beatsWithPrices = await Promise.all(
      availableBeats.map(async (pb) => {
        const lastAuction = await prisma.auction.findFirst({
          where: {
            beatId: pb.beat.id,
            status: { in: ['ENDED', 'COMPLETED', 'CANCELLED'] },
          },
          orderBy: { endTime: 'desc' },
          select: { startPrice: true },
        })

        return {
          id: pb.beat.id,
          title: pb.beat.title,
          genre: (pb.beat as any).genre || 'Trap',
          bpm: (pb.beat as any).bpm || 140,
          key: (pb.beat as any).key || null,
          mood: (pb.beat as any).mood || null,
          duration: (pb.beat as any).duration || null,
          coverImage: (pb.beat as any).coverImage || null,
          audioUrl: pb.beat.audioUrl,
          plays: (pb.beat as any).plays || 0,
          producer: pb.beat.producer,
          basePrice: lastAuction?.startPrice || 20,
          addedAt: pb.addedAt,
        }
      })
    )

    return NextResponse.json({
      beats: beatsWithPrices,
      playlistId: playlist.id,
      total: beatsWithPrices.length,
    })
  } catch (error) {
    console.error('Erreur API nouveautes:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
