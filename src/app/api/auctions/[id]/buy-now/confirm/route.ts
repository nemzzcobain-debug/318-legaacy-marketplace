export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

// POST /api/auctions/[id]/buy-now/confirm — Finaliser apres paiement réussi
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = session.user.id
    const auctionId = params.id

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

    // Vérifier que l'enchère est encore active (pas déjà finalisée)
    if (auction.status !== 'ACTIVE' && auction.status !== 'ENDING_SOON') {
      return NextResponse.json({ error: "Cette enchère n'est plus active" }, { status: 400 })
    }

    if (!auction.buyNowPrice) {
      return NextResponse.json({ error: 'Pas de prix achat immédiat' }, { status: 400 })
    }

    // BUG FIX 4: Vérifier le paiement Stripe AVANT de finaliser
    if (!auction.stripePaymentId) {
      return NextResponse.json({ error: 'Aucun paiement Stripe associe' }, { status: 400 })
    }

    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(auction.stripePaymentId)
      if (paymentIntent.status !== 'succeeded') {
        return NextResponse.json(
          { error: `Paiement non confirmé (statut: ${paymentIntent.status})` },
          { status: 402 }
        )
      }
    } catch (stripeErr) {
      console.error('Erreur vérification Stripe:', String(stripeErr))
      return NextResponse.json({ error: 'Impossible de vérifiér le paiement' }, { status: 500 })
    }

    // Finaliser l'enchère : déclarer le gagnant (paiement vérifié)
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: 'COMPLETED',
        winnerId: userId,
        finalPrice: auction.buyNowPrice,
        winningLicense: 'EXCLUSIVE',
        endTime: new Date(),
        paidAt: new Date(),
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
          title: `Achat immédiat sur "${auction.beat.title}"`,
          message: `${buyerName} a achete "${auction.beat.title}" en achat immédiat pour ${auction.buyNowPrice} EUR`,
          link: `/auction/${auctionId}`,
          userId: auction.beat.producerId,
        },
      })

      // Notifier les autres enchérisseurs
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
            title: `Enchere terminée — "${auction.beat.title}"`,
            message: `L'enchère sur "${auction.beat.title}" s'est terminée par un achat immédiat.`,
            link: `/auction/${auctionId}`,
            userId: b.userId,
          })),
        })
      }
    } catch (notifErr) {
      console.warn('[BUY-NOW] Erreur notification bidders:', String(notifErr))
    }

    return NextResponse.json({
      success: true,
      message: `Achat confirmé pour ${auction.buyNowPrice} EUR`,
    })
  } catch (error) {
    console.error('Erreur buy-now confirm:', String(error))
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
