import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { stripe, calculatePaymentSplit, calculateFinalPrice } from '@/lib/stripe'

// POST /api/payments/checkout - Creer une session de paiement Stripe apres enchere gagnee
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { auctionId } = await request.json()

    if (!auctionId) {
      return NextResponse.json({ error: 'auctionId requis' }, { status: 400 })
    }

    // Recuperer l'enchere terminee
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        beat: {
          include: {
            producer: { select: { id: true, name: true, stripeAccountId: true } },
          },
        },
      },
    })

    if (!auction) {
      return NextResponse.json({ error: 'Enchere introuvable' }, { status: 404 })
    }

    if (auction.winnerId !== userId) {
      return NextResponse.json({ error: 'Tu n\'es pas le gagnant de cette enchere' }, { status: 403 })
    }

    if (auction.status !== 'ENDED') {
      return NextResponse.json({ error: 'Cette enchere n\'est pas terminee' }, { status: 400 })
    }

    // Calculer le prix final
    const finalPrice = auction.finalPrice || calculateFinalPrice(auction.currentBid, auction.winningLicense || 'BASIC')
    const split = calculatePaymentSplit(finalPrice)

    // Verifier que le producteur a un compte Stripe Connect
    const producerStripeAccount = auction.beat.producer.stripeAccountId

    if (!producerStripeAccount) {
      return NextResponse.json(
        { error: 'Le producteur n\'a pas encore configure son compte de paiement' },
        { status: 400 }
      )
    }

    // Creer la session de paiement Stripe avec split
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${auction.beat.title} - Licence ${auction.winningLicense || 'BASIC'}`,
              description: `Beat par ${auction.beat.producer.name} | Enchere #${auction.id.slice(-6)}`,
            },
            unit_amount: Math.round(finalPrice * 100), // Stripe utilise les centimes
          },
          quantity: 1,
        },
      ],
      // Split de paiement avec Stripe Connect
      payment_intent_data: {
        application_fee_amount: Math.round(split.commission * 100), // Commission plateforme
        transfer_data: {
          destination: producerStripeAccount, // Le producteur recoit le reste
        },
      },
      success_url: `${process.env.NEXTAUTH_URL}/dashboard?payment=success&auction=${auctionId}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard?payment=cancelled&auction=${auctionId}`,
      metadata: {
        auctionId,
        userId,
        beatId: auction.beatId,
        producerId: auction.beat.producer.id,
        commission: String(split.commission),
        producerPayout: String(split.producerPayout),
      },
    })

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
      breakdown: split,
    })
  } catch (error) {
    console.error('Erreur creation paiement:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
