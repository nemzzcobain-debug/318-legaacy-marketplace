export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  createAuctionPaymentIntent,
  createHeldPaymentIntent,
  isConnectAccountReady,
} from '@/lib/stripe'

// POST — Creer un PaymentIntent pour payer une enchère gagnée
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { auctionId } = await req.json()

    if (!auctionId) {
      return NextResponse.json({ error: 'auctionId requis' }, { status: 400 })
    }

    // Récupérer l'enchère avec le beat et le producteur
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        beat: {
          include: { producer: true },
        },
        winner: true,
      },
    })

    if (!auction) {
      return NextResponse.json({ error: 'Enchere non trouvee' }, { status: 404 })
    }

    // Vérifier que l'enchère est terminée
    if (auction.status !== 'ENDED' && auction.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: "Cette enchère n'est pas encore terminée" },
        { status: 400 }
      )
    }

    // Vérifier que l'utilisateur est le gagnant
    if (auction.winnerId !== session.user.id) {
      return NextResponse.json(
        { error: "Vous n'etes pas le gagnant de cette enchère" },
        { status: 403 }
      )
    }

    // Vérifier si déjà payé
    if (auction.paidAt) {
      return NextResponse.json({ error: 'Cette enchère a déjà été payée' }, { status: 400 })
    }

    const producer = auction.beat.producer
    const amount = auction.finalPrice || auction.currentBid
    let result

    // Si le producteur a un compte Stripe Connect actif → split direct
    if (producer.stripeAccountId) {
      const isReady = await isConnectAccountReady(producer.stripeAccountId)
      if (isReady) {
        result = await createAuctionPaymentIntent({
          amount,
          producerStripeAccountId: producer.stripeAccountId,
          auctionId: auction.id,
          buyerEmail: session.user.email!,
          beatTitle: auction.beat.title,
          licenseType: auction.winningLicense || auction.licenseType,
        })
      } else {
        // Compte pas encore vérifié → marketplace encaisse
        result = await createHeldPaymentIntent({
          amount,
          auctionId: auction.id,
          buyerEmail: session.user.email!,
          beatTitle: auction.beat.title,
          licenseType: auction.winningLicense || auction.licenseType,
          producerId: producer.id,
        })
      }
    } else {
      // Pas de compte Stripe → marketplace encaisse
      result = await createHeldPaymentIntent({
        amount,
        auctionId: auction.id,
        buyerEmail: session.user.email!,
        beatTitle: auction.beat.title,
        licenseType: auction.winningLicense || auction.licenseType,
        producerId: producer.id,
      })
    }

    // Sauvegarder le PaymentIntent ID dans l'enchère
    await prisma.auction.update({
      where: { id: auction.id },
      data: {
        stripePaymentId: result.paymentIntent.id,
        commissionAmount: result.commission,
        producerPayout: result.producerPayout,
      },
    })

    return NextResponse.json({
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntent.id,
      amount,
      commission: result.commission,
      producerPayout: result.producerPayout,
      beatTitle: auction.beat.title,
      licenseType: auction.winningLicense || auction.licenseType,
    })
  } catch (error: any) {
    console.error('Erreur checkout:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
