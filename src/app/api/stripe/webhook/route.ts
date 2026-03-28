import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

// Desactiver le body parsing automatique de Next.js pour les webhooks
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Erreur verification webhook:', err.message)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  // Traiter les differents events
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      await handlePaymentSuccess(paymentIntent)
      break
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      await handlePaymentFailed(paymentIntent)
      break
    }

    case 'account.updated': {
      const account = event.data.object as Stripe.Account
      await handleAccountUpdated(account)
      break
    }

    default:
      console.log(`Event Stripe non gere: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}

/**
 * Paiement reussi — Finaliser l'enchere
 */
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const auctionId = paymentIntent.metadata.auctionId
  if (!auctionId) return

  console.log(`Paiement reussi pour l'enchere ${auctionId}`)

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      beat: { include: { producer: true } },
      winner: true,
    },
  })

  if (!auction) return

  // Mettre a jour l'enchere comme payee
  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      status: 'COMPLETED',
      paidAt: new Date(),
      stripePaymentId: paymentIntent.id,
    },
  })

  // Mettre a jour le beat comme vendu
  await prisma.beat.update({
    where: { id: auction.beatId },
    data: { status: 'SOLD' },
  })

  // Mettre a jour les stats du producteur
  await prisma.user.update({
    where: { id: auction.beat.producerId },
    data: { totalSales: { increment: 1 } },
  })

  // Mettre a jour les stats de l'acheteur
  if (auction.winnerId) {
    await prisma.user.update({
      where: { id: auction.winnerId },
      data: { totalPurchases: { increment: 1 } },
    })
  }

  // Notification au producteur
  await prisma.notification.create({
    data: {
      type: 'PAYMENT_RECEIVED',
      title: 'Paiement recu !',
      message: `Votre beat "${auction.beat.title}" a ete vendu pour ${auction.finalPrice || auction.currentBid}\u20AC. Votre part: ${auction.producerPayout}\u20AC`,
      link: `/dashboard`,
      userId: auction.beat.producerId,
    },
  })

  // Notification a l'acheteur
  if (auction.winnerId) {
    await prisma.notification.create({
      data: {
        type: 'AUCTION_WON',
        title: 'Paiement confirme !',
        message: `Votre achat de "${auction.beat.title}" est confirme. Vous pouvez telecharger votre beat.`,
        link: `/purchases/${auctionId}`,
        userId: auction.winnerId,
      },
    })
  }
}

/**
 * Paiement echoue — Notifier l'acheteur
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const auctionId = paymentIntent.metadata.auctionId
  if (!auctionId) return

  console.log(`Paiement echoue pour l'enchere ${auctionId}`)

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
  })

  if (!auction || !auction.winnerId) return

  await prisma.notification.create({
    data: {
      type: 'SYSTEM',
      title: 'Paiement echoue',
      message: `Votre paiement pour l'enchere a echoue. Veuillez reessayer avec une autre methode de paiement.`,
      link: `/checkout/${auctionId}`,
      userId: auction.winnerId,
    },
  })
}

/**
 * Compte Connect mis a jour — Mettre a jour le status du producteur
 */
async function handleAccountUpdated(account: Stripe.Account) {
  const user = await prisma.user.findFirst({
    where: { stripeAccountId: account.id },
  })

  if (!user) return

  const isReady = account.charges_enabled && account.payouts_enabled

  if (isReady && user.producerStatus === 'PENDING') {
    console.log(`Compte Stripe actif pour ${user.name}, approbation automatique`)
  }
}
