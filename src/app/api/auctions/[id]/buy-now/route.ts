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

// POST /api/auctions/[id]/buy-now — Creer un PaymentIntent pour achat immédiat
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = session.user.id
    const auctionId = params.id

    // Récupérer l'enchère
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

    // Vérifier que l'enchère est active
    if (auction.status !== 'ACTIVE' && auction.status !== 'ENDING_SOON') {
      return NextResponse.json({ error: "Cette enchère n'est plus active" }, { status: 400 })
    }

    // SECURITY FIX H4: Vérifier que l'enchère n'est pas expirée (même si le cron n'a pas encore mis a jour le statut)
    if (auction.endTime && new Date(auction.endTime) < new Date()) {
      return NextResponse.json({ error: "Cette enchère est terminée" }, { status: 400 })
    }

    // Vérifier qu'un buyNowPrice existe
    if (!auction.buyNowPrice) {
      return NextResponse.json(
        { error: "L'achat immédiat n'est pas disponible pour cette enchère" },
        { status: 400 }
      )
    }

    // Empêcher le producteur d'acheter son propre beat
    if (auction.beat.producerId === userId) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas acheter votre propre beat' },
        { status: 403 }
      )
    }

    const producer = auction.beat.producer
    const amount = auction.buyNowPrice
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
          licenseType: 'EXCLUSIVE',
        })
      } else {
        // Compte pas encore vérifié → marketplace encaisse
        result = await createHeldPaymentIntent({
          amount,
          auctionId: auction.id,
          buyerEmail: session.user.email!,
          beatTitle: auction.beat.title,
          licenseType: 'EXCLUSIVE',
          producerId: producer.id,
        })
      }
    } else {
      // Pas de compte Stripe → marketplace encaisse et reversera plus tard
      result = await createHeldPaymentIntent({
        amount,
        auctionId: auction.id,
        buyerEmail: session.user.email!,
        beatTitle: auction.beat.title,
        licenseType: 'EXCLUSIVE',
        producerId: producer.id,
      })
    }

    // Sauvegarder le PaymentIntent dans l'enchère
    await prisma.auction.update({
      where: { id: auctionId },
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
      licenseType: 'EXCLUSIVE',
    })
  } catch (error) {
    console.error('Erreur buy-now:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
