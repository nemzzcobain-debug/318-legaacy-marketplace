export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuctionPaymentIntent, isConnectAccountReady } from '@/lib/stripe'

// POST /api/auctions/[id]/buy-now — Creer un PaymentIntent pour achat immediat
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

    // Verifier que le producteur a un compte Stripe Connect actif
    const producer = auction.beat.producer
    if (!producer.stripeAccountId) {
      return NextResponse.json(
        { error: "Le producteur n'a pas encore configure son compte de paiement." },
        { status: 400 }
      )
    }

    const isProducerReady = await isConnectAccountReady(producer.stripeAccountId)
    if (!isProducerReady) {
      return NextResponse.json(
        { error: 'Le compte de paiement du producteur est en cours de verification.' },
        { status: 400 }
      )
    }

    // Creer le PaymentIntent avec le buyNowPrice
    const amount = auction.buyNowPrice
    const { paymentIntent, clientSecret, commission, producerPayout } =
      await createAuctionPaymentIntent({
        amount,
        producerStripeAccountId: producer.stripeAccountId,
        auctionId: auction.id,
        buyerEmail: session.user.email!,
        beatTitle: auction.beat.title,
        licenseType: 'EXCLUSIVE',
      })

    // Sauvegarder le PaymentIntent dans l'enchere (sans finaliser)
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        stripePaymentId: paymentIntent.id,
        commissionAmount: commission,
        producerPayout,
      },
    })

    return NextResponse.json({
      clientSecret,
      paymentIntentId: paymentIntent.id,
      amount,
      commission,
      producerPayout,
      beatTitle: auction.beat.title,
      licenseType: 'EXCLUSIVE',
    })
  } catch (error) {
    console.error('Erreur buy-now:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
