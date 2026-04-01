import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuctionPaymentIntent, isConnectAccountReady } from '@/lib/stripe'

// POST — Creer un PaymentIntent pour payer une enchere gagnee
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const { auctionId } = await req.json()

    if (!auctionId) {
      return NextResponse.json({ error: 'auctionId requis' }, { status: 400 })
    }

    // Recuperer l'enchere avec le beat et le producteur
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

    // Verifier que l'enchere est terminee
    if (auction.status !== 'ENDED' && auction.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Cette enchere n\'est pas encore terminee' }, { status: 400 })
    }

    // Verifier que l'utilisateur est le gagnant
    if (auction.winnerId !== session.user.id) {
      return NextResponse.json({ error: 'Vous n\'etes pas le gagnant de cette enchere' }, { status: 403 })
    }

    // Verifier si deja paye
    if (auction.paidAt) {
      return NextResponse.json({ error: 'Cette enchere a deja ete payee' }, { status: 400 })
    }

    // Verifier que le producteur a un compte Stripe Connect actif
    const producer = auction.beat.producer
    if (!producer.stripeAccountId) {
      return NextResponse.json(
        { error: 'Le producteur n\'a pas encore configure son compte de paiement. Contactez le support.' },
        { status: 400 }
      )
    }

    const isProducerReady = await isConnectAccountReady(producer.stripeAccountId)
    if (!isProducerReady) {
      return NextResponse.json(
        { error: 'Le compte de paiement du producteur est en cours de verification. Reessayez plus tard.' },
        { status: 400 }
      )
    }

    // Montant final de l'enchere
    const amount = auction.finalPrice || auction.currentBid

    // Creer le PaymentIntent avec split
    const { paymentIntent, clientSecret, commission, producerPayout } = await createAuctionPaymentIntent({
      amount,
      producerStripeAccountId: producer.stripeAccountId,
      auctionId: auction.id,
      buyerEmail: session.user.email!,
      beatTitle: auction.beat.title,
      licenseType: auction.winningLicense || auction.licenseType,
    })

    // Sauvegarder le PaymentIntent ID dans l'enchere
    await prisma.auction.update({
      where: { id: auction.id },
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
      licenseType: auction.winningLicense || auction.licenseType,
    })
  } catch (error: any) {
    console.error('Erreur checkout:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
