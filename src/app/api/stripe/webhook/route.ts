import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
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

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  // Vérifier la présence de la signature
  if (!sig) {
    console.error('[WEBHOOK] Signature manquante')
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    // SÉCURITÉ: Toujours vérifier la signature Stripe
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('[WEBHOOK] STRIPE_WEBHOOK_SECRET non configuré - webhook rejeté')
      return NextResponse.json(
        { error: 'Webhook non configuré' },
        { status: 500 }
      )
    }

    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err: any) {
    console.error('[WEBHOOK] Erreur de vérification:', err.message)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 400 }
    )
  }

  console.log(`[WEBHOOK] Événement reçu: ${event.type}`)

  try {
    // Traiter les différents types d'événements Stripe
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
        console.log(`[WEBHOOK] Événement non géré: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('[WEBHOOK] Erreur lors du traitement:', err.message, err.stack)
    // Retourner 200 pour empêcher Stripe de renvoyer l'événement
    return NextResponse.json({ received: true }, { status: 200 })
  }
}

/**
 * Checkout Session complétée (paiement Stripe Checkout)
 * Finalise l'enchère, met à jour les statistiques et envoie les notifications
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const { auctionId, userId, beatId, producerId, commission, producerPayout } =
    session.metadata || {}

  if (!auctionId) {
    console.warn('[WEBHOOK] checkout.session.completed - auctionId manquant dans les metadata')
    return
  }

  try {
    // Vérifier l'idempotence: si l'enchère est déjà COMPLETED, ne rien faire
    const existingAuction = await prisma.auction.findUnique({
      where: { id: auctionId },
    })

    if (!existingAuction) {
      console.warn(
        `[WEBHOOK] Enchère ${auctionId} non trouvée lors de checkout.session.completed`
      )
      return
    }

    if (existingAuction.status === 'COMPLETED') {
      console.log(`[WEBHOOK] Enchère ${auctionId} déjà COMPLETED - éviter la duplication`)
      return
    }

    console.log(`[WEBHOOK] Paiement session complété pour enchère ${auctionId} - montant: ${session.amount_total}`)

    // Récupérer les détails complets de l'enchère
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
      console.warn(`[WEBHOOK] Enchère ${auctionId} non trouvée avec détails complets`)
      return
    }

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

    // Envoyer les emails transactionnels (non-bloquant)
    const payoutAmount = producerPayout ? parseFloat(producerPayout) : (auction.producerPayout || 0)
    const commissionAmount = commission ? parseFloat(commission) : (auction.commissionAmount || 0)
    const finalPrice = auction.finalPrice || auction.currentBid

    // Email au producteur: vente réalisée
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
      }).catch(() => {})
    }

    // Email à l'acheteur: achat confirmé
    if (auction.winner?.email) {
      sendAuctionWonEmail({
        to: auction.winner.email,
        winnerName: auction.winner.displayName || auction.winner.name,
        beatTitle: auction.beat.title,
        producerName: auction.beat.producer?.displayName || auction.beat.producer?.name || 'Producteur',
        finalPrice,
        license: auction.winningLicense || auction.licenseType,
        auctionId,
      }).catch(() => {})
    }

    console.log(`[WEBHOOK] ✓ Enchère ${auctionId} complétée avec succès`)
  } catch (err: any) {
    console.error(`[WEBHOOK] Erreur handleCheckoutSessionCompleted (${auctionId}):`, err.message)
    throw err
  }
}

/**
 * PaymentIntent réussi (paiement direct via PaymentIntent)
 * Alternative à Checkout Session pour les paiements directs
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const auctionId = paymentIntent.metadata?.auctionId

  if (!auctionId) {
    console.warn('[WEBHOOK] payment_intent.succeeded - auctionId manquant')
    return
  }

  try {
    // Vérifier l'idempotence
    const existingAuction = await prisma.auction.findUnique({
      where: { id: auctionId },
    })

    if (!existingAuction) {
      console.warn(
        `[WEBHOOK] Enchère ${auctionId} non trouvée lors de payment_intent.succeeded`
      )
      return
    }

    if (existingAuction.status === 'COMPLETED') {
      console.log(`[WEBHOOK] Enchère ${auctionId} déjà COMPLETED - éviter la duplication`)
      return
    }

    console.log(
      `[WEBHOOK] Paiement PaymentIntent réussi pour enchère ${auctionId} - montant: ${paymentIntent.amount}`
    )

    // Récupérer les détails complets de l'enchère
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
      console.warn(`[WEBHOOK] Enchère ${auctionId} non trouvée avec détails complets`)
      return
    }

    // Mettre à jour l'enchère comme payée
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: 'COMPLETED',
        paidAt: new Date(),
        stripePaymentId: paymentIntent.id,
      },
    })

    // Mettre à jour le beat comme vendu
    await prisma.beat.update({
      where: { id: auction.beatId },
      data: { status: 'SOLD' },
    })

    // Incrémenter les ventes du producteur
    await prisma.user.update({
      where: { id: auction.beat.producerId },
      data: { totalSales: { increment: 1 } },
    })

    // Incrémenter les achats de l'acheteur
    if (auction.winnerId) {
      await prisma.user.update({
        where: { id: auction.winnerId },
        data: { totalPurchases: { increment: 1 } },
      })
    }

    // Notifier le producteur
    await prisma.notification.create({
      data: {
        type: 'PAYMENT_RECEIVED',
        title: 'Paiement reçu !',
        message: `Votre beat "${auction.beat.title}" a été vendu pour ${auction.finalPrice || auction.currentBid}€. Votre part: ${auction.producerPayout}€`,
        link: '/dashboard?tab=earnings',
        userId: auction.beat.producerId,
      },
    })

    // Notifier l'acheteur
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

    console.log(`[WEBHOOK] ✓ Enchère ${auctionId} complétée avec succès`)
  } catch (err: any) {
    console.error(`[WEBHOOK] Erreur handlePaymentIntentSucceeded (${auctionId}):`, err.message)
    throw err
  }
}

/**
 * Paiement échoué
 * Notifier l'acheteur pour qu'il réessaie
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const auctionId = paymentIntent.metadata?.auctionId

  if (!auctionId) {
    console.warn('[WEBHOOK] payment_intent.payment_failed - auctionId manquant')
    return
  }

  try {
    console.log(`[WEBHOOK] Paiement échoué pour enchère ${auctionId}`)

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
    })

    if (!auction || !auction.winnerId) {
      console.warn(`[WEBHOOK] Enchère ${auctionId} non trouvée ou pas d'acheteur`)
      return
    }

    // Notifier l'acheteur de l'échec
    await prisma.notification.create({
      data: {
        type: 'SYSTEM',
        title: 'Paiement échoué',
        message: 'Votre paiement a échoué. Veuillez réessayer avec une autre méthode de paiement.',
        link: `/checkout/${auctionId}`,
        userId: auction.winnerId,
      },
    })

    console.log(`[WEBHOOK] ✓ Notification d'échec envoyée pour enchère ${auctionId}`)
  } catch (err: any) {
    console.error(`[WEBHOOK] Erreur handlePaymentIntentFailed (${auctionId}):`, err.message)
    throw err
  }
}

/**
 * Remboursement de charge
 * Gérer les remboursements et mettre à jour le statut de l'enchère
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  // Extraire l'auctionId du metadata de la charge si disponible
  const auctionId = charge.metadata?.auctionId

  if (!auctionId) {
    console.warn('[WEBHOOK] charge.refunded - auctionId manquant dans metadata')
    return
  }

  try {
    console.log(`[WEBHOOK] Remboursement reçu pour enchère ${auctionId} - montant: ${charge.amount_refunded}`)

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        beat: { include: { producer: true } },
      },
    })

    if (!auction) {
      console.warn(`[WEBHOOK] Enchère ${auctionId} non trouvée lors du remboursement`)
      return
    }

    // Mettre à jour le statut de l'enchère (retour à CANCELLED car REFUNDED n'existe pas dans le schéma)
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: 'CANCELLED',
      },
    })

    // Remettre le beat en état ACTIVE pour qu'il puisse être remis en vente
    await prisma.beat.update({
      where: { id: auction.beatId },
      data: { status: 'ACTIVE' },
    })

    // Décrémenter les statistiques de ventes/achats
    await prisma.user.update({
      where: { id: auction.beat.producerId },
      data: { totalSales: { decrement: 1 } },
    })

    if (auction.winnerId) {
      await prisma.user.update({
        where: { id: auction.winnerId },
        data: { totalPurchases: { decrement: 1 } },
      })

      // Notifier l'acheteur du remboursement
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

    console.log(`[WEBHOOK] ✓ Remboursement traité pour enchère ${auctionId}`)
  } catch (err: any) {
    console.error(`[WEBHOOK] Erreur handleChargeRefunded (${auctionId}):`, err.message)
    throw err
  }
}

/**
 * Compte Stripe Connect mis à jour
 * Mettre à jour le statut du producteur en fonction de l'état du compte
 */
async function handleAccountUpdated(account: Stripe.Account) {
  try {
    console.log(`[WEBHOOK] Compte Stripe ${account.id} mis à jour`)

    const user = await prisma.user.findFirst({
      where: { stripeAccountId: account.id },
    })

    if (!user) {
      console.warn(`[WEBHOOK] Utilisateur non trouvé pour compte Stripe ${account.id}`)
      return
    }

    // Vérifier si le compte est prêt pour les paiements
    const isReady = account.charges_enabled && account.payouts_enabled

    if (isReady && user.producerStatus === 'PENDING') {
      console.log(`[WEBHOOK] Compte Stripe prêt pour ${user.id}, mise à jour du statut`)

      // Mettre à jour le statut du producteur (à adapter selon votre schéma)
      // await prisma.user.update({
      //   where: { id: user.id },
      //   data: { producerStatus: 'APPROVED' },
      // })

      // Notifier le producteur
      await prisma.notification.create({
        data: {
          type: 'SYSTEM',
          title: 'Compte approuvé !',
          message: 'Votre compte Stripe a été approuvé. Vous pouvez maintenant recevoir des paiements.',
          link: '/dashboard?tab=settings',
          userId: user.id,
        },
      })

      console.log(`[WEBHOOK] ✓ Statut du producteur mis à jour pour ${user.id}`)
    } else if (!isReady && user.producerStatus !== 'PENDING') {
      console.warn(
        `[WEBHOOK] Compte Stripe ${account.id} n'est pas prêt - charges_enabled: ${account.charges_enabled}, payouts_enabled: ${account.payouts_enabled}`
      )
    }
  } catch (err: any) {
    console.error(`[WEBHOOK] Erreur handleAccountUpdated:`, err.message)
    throw err
  }
}
