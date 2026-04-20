export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/auctions/[id]/buy-now — Achat immediat au buyNowPrice
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const userId = session.user.id
    const auctionId = params.id

    // Recuperer l'enchere
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        beat: {
          include: { producer: true },
        },
      },
    })

    if (!auction) {
      return NextResponse.json({ error: 'Enchere introuvable' }, { status: 404 })
    }

    // Verifier que l'enchere est active
    if (auction.status !== 'ACTIVE' && auction.status !== 'ENDING_SOON') {
      return NextResponse.json({ error: "Cette enchere n'est plus active" }, { status: 400 })
    }

    // Verifier qu'un buyNowPrice existe
    if (!auction.buyNowPrice) {
      return NextResponse.json(
        { error: "L'achat immediat n'est pas disponible pour cette enchere" },
        { status: 400 }
      )
    }

    // Empecher le producteur d'acheter son propre beat
    if (auction.beat.producerId === userId) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas acheter votre propre beat' },
        { status: 403 }
      )
    }

    // Terminer l'enchere immediatement avec l'acheteur comme gagnant
    const updatedAuction = await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: 'ENDED',
        winnerId: userId,
        finalPrice: auction.buyNowPrice,
        winningLicense: 'EXCLUSIVE',
        endTime: new Date(), // Termine maintenant
      },
    })

    // Mettre a jour le statut du beat
    await prisma.beat.update({
      where: { id: auction.beatId },
      data: { status: 'SOLD' },
    })

    // Notifier le producteur
    try {
      const buyerName = session.user.name || 'Un acheteur'
      await prisma.notification.create({
        data: {
          type: 'AUCTION_WON',
          title: `Achat immediat sur "${auction.beat.title}"`,
          message: `${buyerName} a achete "${auction.beat.title}" en achat immediat pour ${auction.buyNowPrice} EUR`,
          link: `/auction/${auctionId}`,
          userId: auction.beat.producerId,
        },
      })

      // Notifier les autres encherisseurs que l'enchere est terminee
      const otherBidders = await prisma.bid.findMany({
        where: {
          auctionId,
          userId: { not: userId },
        },
        select: { userId: true },
        distinct: ['userId'],
      })

      if (otherBidders.length > 0) {
        await prisma.notification.createMany({
          data: otherBidders.map((b) => ({
            type: 'AUCTION_ENDED',
            title: `Enchere terminee — "${auction.beat.title}"`,
            message: `L'enchere sur "${auction.beat.title}" s'est terminee par un achat immediat.`,
            link: `/auction/${auctionId}`,
            userId: b.userId,
          })),
        })
      }
    } catch {}

    return NextResponse.json({
      success: true,
      auction: updatedAuction,
      message: `Achat immediat confirme pour ${auction.buyNowPrice} EUR`,
    })
  } catch (error) {
    console.error('Erreur buy-now:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
