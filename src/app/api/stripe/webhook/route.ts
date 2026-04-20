export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import Stripe from 'stripe'
import { sendAuctionWonEmail, sendPaymentReceivedEmail } from '@/lib/emails/resend'

/**
 * WEBHOOK CONSOLIDÉ STRIPE
 * Gère tous les événements Stripe pour le marketplace 318 LEGAACY
 * - checkout.session.completed (paiement via Checkout Sessions)
 * - payment_intent.succeeded (paiement direct PaymentIntent)
 * - payment_intent.payment_failed (paiement échoué)
 * - charge.refunded (remboursement)
 * - account.updated (mise à jour compte Stripe Connect)
 */

// Désactiver le body parsing automatique de Next.js pour les webhooks
export const runtime = 'nodejs'

const isDev = process.env.NODE_ENV === 'development'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      logger.error('[WEBHOOK] STRIPE_WEBHOOK_SECRET non configuré')
      return NextResponse.json({ error: 'Webhook non configuré' }, { status: 500 })
    }

    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    logger.error('[WEBHOOK] Erreur de vérification:', { error: err.message })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 400 })
  }

  if (isDev) logger.debug(`[WEBHOOK] ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutSessionCompleted(session)
        break
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentIntentSucceeded(paymentIntent)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentIntentFailed(paymentIntent)
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        await handleChargeRefunded(charge)
        break
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        await handleAccountUpdated(account)
        break
      }

      default:
        if (isDev) logger.debug(`[WEBHOOK] Événement non géré: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    logger.error('[WEBHOOK] Erreur traitement:', { error: err.message })
    // Retourner 500 pour que Stripe réessaye l'événement
    return NextResponse.json({ error: 'Erreur de traitement' }, { status: 500 })
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {}
  const { auctionId, userId, producerId, commission, producerPayout } = metadata

  if (!auctionId) {
    logger.error('[WEBHOOK] checkout.session.completed sans auctionId dans metadata')
    return
  }

  try {
    const existingAuction = await prisma.auction.findUnique({
      where: { id: auctionId },
    })

    if (!existingAuction || existingAuction.status === 'COMPLETED') return

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        beat: { include: { producer: true } },
        winner: true,
      },
    })

    if (!auction) return

    // Mettre à jour l'enchère comme payée
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: 'COMPLETED',
        paidAt: new Date(),
        stripePaymentId: session.payment_intent as string,
        commissionAmount: commission ? parseFloat(commission) : undefined,
        producerPayout: producerPayout ? parseFloat(producerPayout) : undefined,
      },
    })

    // Mettre à jour le beat comme vendu
    await prisma.beat.update({
      where: { id: auction.beatId },
      data: { status: 'SOLD' },
    })

    // Incrémenter les ventes du producteur
    if (producerId) {
      await prisma.user.update({
        where: { id: producerId },
        data: { totalSales: { increment: 1 } },
      })
    }

    // Incrémenter les achats de l'acheteur
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { totalPurchases: { increment: 1 } },
      })
    }

    // Notifier le producteur
    await prisma.notification.create({
      data: {
        type: 'PAYMENT_RECEIVED',
        title: 'Paiement reçu !',
        message: `Votre beat "${auction.beat.title}" a été vendu. Votre part: ${producerPayout || auction.producerPayout || 0}€`,
        link: '/dashboard?tab=earnings',
        userId: auction.beat.producerId,
      },
    })

    // Notifier l'acheteur
    if (userId || auction.winnerId) {
      await prisma.notification.create({
        data: {
          type: 'AUCTION_WON',
          title: 'Achat confirmé !',
          message: `Votre beat "${auction.beat.title}" est prêt à être téléchargé.`,
          link: `/dashboard?tab=purchases`,
          userId: userId || auction.winnerId || '',
        },
      })
    }

    // Envoyer les emails (non-bloquant)
    const payoutAmount = producerPayout ? parseFloat(producerPayout) : auction.producerPayout || 0
    const commissionAmount = commission ? parseFloat(commission) : auction.commissionAmount || 0
    const finalPrice = auction.finalPrice || auction.currentBid

    if (auction.beat.producer?.email) {
      sendPaymentReceivedEmail({
        to: auction.beat.producer.email,
        producerName: auction.beat.producer.displayName || auction.beat.producer.name,
        beatTitle: auction.beat.title,
        buyerName: auction.winner?.displayName || auction.winner?.name || 'Acheteur',
        finalPrice,
        commission: commissionAmount,
        payout: payoutAmount,
        license: auction.winningLicense || auction.licenseType,
      }).catch((e) => logger.error('[WEBHOOK] Erreur envoi email:', { error: e?.message }))
    }

    if (auction.winner?.email) {
      sendAuctionWonEmail({
        to: auction.winner.email,
        winnerName: auction.winner.displayName || auction.winner.name,
        beatTitle: auction.beat.title,
        producerName:
          auction.beat.producer?.displayName || auction.beat.producer?.name || 'Producteur',
        finalPrice,
        license: auction.winningLicense || auction.licenseType,
        auctionId,
      }).catch((e) => logger.error('[WEBHOOK] Erreur envoi email:', { error: e?.message }))
    }

    if (isDev) logger.debug(`[WEBHOOK] ✓ Enchère ${auctionId} complétée`)
  } catch (err: any) {
    logger.error(`[WEBHOOK] Erreur checkout (${auctionId}):`, { error: err.message })
    throw err
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata || {}

  // ─── Achat direct de beat (hors encheres) ───
  if (metadata.type === 'direct_purchase' && metadata.beatId) {
    await handleDirectPurchaseSucceeded(paymentIntent)
    return
  }

  // ─── Paiement d'enchère gagnée ───
  const auctionId = metadata.auctionId
  if (!auctionId) return

  try {
    const existingAuction = await prisma.auction.findUnique({
      where: { id: auctionId },
    })

    if (!existingAuction || existingAuction.status === 'COMPLETED') return

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        beat: { include: { producer: true } },
        winner: true,
      },
    })

    if (!auction) return

    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: 'COMPLETED',
        paidAt: new Date(),
        stripePaymentId: paymentIntent.id,
      },
    })

    await prisma.beat.update({
      where: { id: auction.beatId },
      data: { status: 'SOLD' },
    })

    await prisma.user.update({
      where: { id: auction.beat.producerId },
      data: { totalSales: { increment: 1 } },
    })

    if (auction.winnerId) {
      await prisma.user.update({
        where: { id: auction.winnerId },
        data: { totalPurchases: { increment: 1 } },
      })
    }

    await prisma.notification.create({
      data: {
        type: 'PAYMENT_RECEIVED',
        title: 'Paiement reçu !',
        message: `Votre beat "${auction.beat.title}" a été vendu pour ${auction.finalPrice || auction.currentBid}€. Votre part: ${auction.producerPayout}€`,
        link: '/dashboard?tab=earnings',
        userId: auction.beat.producerId,
      },
    })

    if (auction.winnerId) {
      await prisma.notification.create({
        data: {
          type: 'AUCTION_WON',
          title: 'Paiement confirmé !',
          message: `Votre achat de "${auction.beat.title}" est confirmé. Vous pouvez télécharger votre beat.`,
          link: `/dashboard?tab=purchases`,
          userId: auction.winnerId,
        },
      })
    }

    if (isDev) logger.debug(`[WEBHOOK] ✓ PaymentIntent ${auctionId} complété`)
  } catch (err: any) {
    logger.error(`[WEBHOOK] Erreur PaymentIntent (${auctionId}):`, { error: err.message })
    throw err
  }
}

/**
 * Gère le paiement réussi d'un achat direct de beat (hors enchères)
 */
async function handleDirectPurchaseSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const { beatId, licenseType, commission, producerPayout } = paymentIntent.metadata

  try {
    const beat = await prisma.beat.findUnique({
      where: { id: beatId },
      include: { producer: true },
    })

    if (!beat) {
      logger.error(`[WEBHOOK] Achat direct: beat ${beatId} introuvable`)
      return
    }

    // Si licence EXCLUSIVE, marquer le beat comme vendu
    if (licenseType === 'EXCLUSIVE') {
      await prisma.beat.update({
        where: { id: beatId },
        data: { status: 'SOLD' },
      })

      // Retirer de la playlist Nouveautés
      const nouveautesPlaylist = await prisma.playlist.findFirst({
        where: { name: 'Nouveautés', visibility: 'PUBLIC' },
        select: { id: true },
      })
      if (nouveautesPlaylist) {
        await prisma.playlistBeat.deleteMany({
          where: { playlistId: nouveautesPlaylist.id, beatId },
        })
      }
    }

    // Incrémenter les ventes du producteur
    await prisma.user.update({
      where: { id: beat.producerId },
      data: { totalSales: { increment: 1 } },
    })

    // Trouver l'acheteur via l'email du PaymentIntent
    const buyerEmail = paymentIntent.receipt_email
    if (buyerEmail) {
      const buyer = await prisma.user.findFirst({
        where: { email: buyerEmail },
      })
      if (buyer) {
        await prisma.user.update({
          where: { id: buyer.id },
          data: { totalPurchases: { increment: 1 } },
        })

        // Notifier l'acheteur
        await prisma.notification.create({
          data: {
            type: 'AUCTION_WON',
            title: 'Achat confirmé !',
            message: `Votre achat de "${beat.title}" (Licence ${licenseType}) est confirmé.`,
            link: '/dashboard?tab=purchases',
            userId: buyer.id,
          },
        })
      }
    }

    // Notifier le producteur
    const payoutAmount = producerPayout ? parseFloat(producerPayout) : 0
    await prisma.notification.create({
      data: {
        type: 'PAYMENT_RECEIVED',
        title: 'Vente directe !',
        message: `Votre beat "${beat.title}" a été vendu (Licence ${licenseType}). Votre part: ${payoutAmount}€`,
        link: '/dashboard?tab=earnings',
        userId: beat.producerId,
      },
    })

    // Envoyer email au producteur (non-bloquant)
    if (beat.producer?.email) {
      const finalPrice = paymentIntent.amount / 100
      sendPaymentReceivedEmail({
        to: beat.producer.email,
        producerName: beat.producer.displayName || beat.producer.name,
        beatTitle: beat.title,
        buyerName: buyerEmail || 'Acheteur',
        finalPrice,
        commission: commission ? parseFloat(commission) : 0,
        payout: payoutAmount,
        license: licenseType,
      }).catch((e) =>
        logger.error('[WEBHOOK] Erreur envoi email achat direct:', { error: e?.message })
      )
    }

    if (isDev) logger.debug(`[WEBHOOK] ✓ Achat direct beat ${beatId} (${licenseType}) complété`)
  } catch (err: any) {
    logger.error(`[WEBHOOK] Erreur achat direct (${beatId}):`, { error: err.message })
    throw err
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const auctionId = paymentIntent.metadata?.auctionId
  if (!auctionId) return

  try {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
    })

    if (!auction || !auction.winnerId) return

    await prisma.notification.create({
      data: {
        type: 'SYSTEM',
        title: 'Paiement échoué',
        message: 'Votre paiement a échoué. Veuillez réessayer avec une autre méthode de paiement.',
        link: `/checkout/${auctionId}`,
        userId: auction.winnerId,
      },
    })
  } catch (err: any) {
    logger.error(`[WEBHOOK] Erreur PaymentFailed (${auctionId}):`, { error: err.message })
    throw err
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const auctionId = charge.metadata?.auctionId
  if (!auctionId) return

  try {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        beat: { include: { producer: true } },
      },
    })

    if (!auction) return

    await prisma.auction.update({
      where: { id: auctionId },
      data: { status: 'CANCELLED' },
    })

    await prisma.beat.update({
      where: { id: auction.beatId },
      data: { status: 'ACTIVE' },
    })

    await prisma.user.update({
      where: { id: auction.beat.producerId },
      data: { totalSales: { decrement: 1 } },
    })

    if (auction.winnerId) {
      await prisma.user.update({
        where: { id: auction.winnerId },
        data: { totalPurchases: { decrement: 1 } },
      })

      await prisma.notification.create({
        data: {
          type: 'SYSTEM',
          title: 'Remboursement traité',
          message: `Votre remboursement de ${charge.amount_refunded / 100}€ a été accepté et sera crédité sous 5 à 10 jours ouvrables.`,
          link: '/dashboard?tab=purchases',
          userId: auction.winnerId,
        },
      })
    }
  } catch (err: any) {
    logger.error(`[WEBHOOK] Erreur Refund (${auctionId}):`, { error: err.message })
    throw err
  }
}

async function handleAccountUpdated(account: Stripe.Account) {
  try {
    const user = await prisma.user.findFirst({
      where: { stripeAccountId: account.id },
    })

    if (!user) return

    const isReady = account.charges_enabled && account.payouts_enabled

    if (isReady && user.producerStatus === 'PENDING') {
      await prisma.user.update({
        where: { id: user.id },
        data: { producerStatus: 'APPROVED' },
      })

      await prisma.notification.create({
        data: {
          type: 'SYSTEM',
          title: 'Compte approuvé !',
          message:
            'Votre compte Stripe a été approuvé. Vous pouvez maintenant recevoir des paiements.',
          link: '/dashboard?tab=settings',
          userId: user.id,
        },
      })

      if (isDev) logger.debug(`[WEBHOOK] ✓ Producteur ${user.id} approuvé`)
    }
  } catch (err: any) {
    logger.error('[WEBHOOK] Erreur AccountUpdated:', { error: err.message })
    throw err
  }
}
