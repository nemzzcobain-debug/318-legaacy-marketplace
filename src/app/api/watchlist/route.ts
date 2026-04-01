// ─── 318 LEGAACY Marketplace - Watchlist API ───
// GET: mes enchères suivies
// POST: ajouter une enchère à la watchlist
// DELETE: retirer une enchère de la watchlist

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ─── GET: Mes enchères suivies ───
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const watchlist = await prisma.watchlist.findMany({
      where: { userId: session.user.id },
      include: {
        auction: {
          include: {
            beat: {
              select: {
                id: true,
                title: true,
                genre: true,
                bpm: true,
                key: true,
                mood: true,
                audioUrl: true,
                coverImage: true,
                producer: {
                  select: {
                    id: true,
                    name: true,
                    displayName: true,
                    avatar: true,
                    producerStatus: true,
                  },
                },
              },
            },
            _count: { select: { bids: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(watchlist)
  } catch (error) {
    console.error('Watchlist GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ─── POST: Ajouter à la watchlist ───
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { auctionId } = await req.json()
    if (!auctionId) {
      return NextResponse.json({ error: 'auctionId requis' }, { status: 400 })
    }

    // Vérifier que l'enchère existe
    const auction = await prisma.auction.findUnique({ where: { id: auctionId } })
    if (!auction) {
      return NextResponse.json({ error: 'Enchère introuvable' }, { status: 404 })
    }

    // Vérifier si déjà dans la watchlist
    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_auctionId: {
          userId: session.user.id,
          auctionId,
        },
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'Déjà dans votre watchlist' }, { status: 409 })
    }

    const entry = await prisma.watchlist.create({
      data: {
        userId: session.user.id,
        auctionId,
      },
    })

    return NextResponse.json({ message: 'Ajouté à la watchlist', entry }, { status: 201 })
  } catch (error) {
    console.error('Watchlist POST error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ─── DELETE: Retirer de la watchlist ───
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { auctionId } = await req.json()
    if (!auctionId) {
      return NextResponse.json({ error: 'auctionId requis' }, { status: 400 })
    }

    await prisma.watchlist.deleteMany({
      where: {
        userId: session.user.id,
        auctionId,
      },
    })

    return NextResponse.json({ message: 'Retiré de la watchlist' })
  } catch (error) {
    console.error('Watchlist DELETE error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
