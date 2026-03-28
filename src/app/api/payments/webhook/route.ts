import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

// POST /api/payments/webhook - Webhook Stripe pour confirmer les paiements
export async function POST(request: Request) {
  const body = await request.text()
  const signature = headers().get('stripe-signature')

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
  }

  let event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err: any) {
    console.error('Erreur verification webhook:', err.message)
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 })
  }

  // Traiter l'evenement
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any
      const { auctionId, userId, beatId, producerId, commission, producerPayout } = session.metadata

      if (!auctionId) break

      // Mettre a jour l'enchere
      await prisma.auction.update({
        where: { id: auctionId },
        data: {
          status: 'COMPLETED',
          stripePaymentId: session.payment_intent,
          paidAt: new Date(),
          commissionAmount: parseFloat(commission),
          producerPayout: parseFloat(producerPayout),
        },
      })

      // Mettre a jour le beat
      await prisma.beat.update({
        where: { id: beatId },
        data: { status: 'SOLD' },
      })

      // Incrementer les ventes du producteur
      await prisma.user.update({
        where: { id: producerId },
        data: { totalSales: { increment: 1 } },
      })

      // Incrementer les achats du gagnant
      await prisma.user.update({
        where: { id: userId },
        data: { totalPurchases: { increment: 1 } },
      })

      // Notifier le producteur
      await prisma.notification.create({
        data: {
          userId: producerId,
          type: 'PAYMENT_RECEIVED',
          title: 'Paiement recu !',
          message: `${producerPayout}EUR recus pour ton beat. Le virement sera effectue sous 7 jours.`,
          link: '/dashboard?tab=earnings',
        },
      })

      // Notifier l'acheteur
      await prisma.notification.create({
        data: {
          userId,
          type: 'AUCTION_WON',
          title: 'Achat confirme !',
          message: 'Ton beat est pret a etre telecharge.',
          link: '/dashboard?tab=purchases',
        },
      })

      console.log(`Paiement confirme pour enchere ${auctionId} - ${session.amount_total / 100}EUR`)
      break
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as any
      console.error('Paiement echoue:', paymentIntent.id)
      break
    }
  }

  return NextResponse.json({ received: true })
}
