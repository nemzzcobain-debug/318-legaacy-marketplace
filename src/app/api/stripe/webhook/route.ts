export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { reportOperationalIssue } from '@/lib/monitoring'
import Stripe from 'stripe'
import { completeAuctionSale, sendAuctionSaleMessages } from '@/lib/auction-sale'
import {
  sendPaymentReceivedEmail,
  sendGuestPurchaseEmail,
  sendPurchaseConfirmedEmail,
  sendNtfy,
} from '@/lib/emails/resend'
import {
  generateLicenseContractPdf,
  getContractFileName,
  type LicenseContractData,
} from '@/lib/license-contract'

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

// SECURITY FIX H6 + TASK51: Idempotence via table DB (resiste aux cold starts Vercel)
async function markEventProcessed(eventId: string, eventType: string): Promise<boolean> {
  try {
    await prisma.stripeEvent.create({
      data: { id: eventId, type: eventType },
    })
    return true // Nouveau, on peut traiter
  } catch (err: any) {
    // P2002 = unique constraint violation = déjà traité
    if (err?.code === 'P2002') return false
    // Autre erreur DB → on traite quand même (mieux que de perdre un événement)
    logger.error('[WEBHOOK] Erreur idempotence DB:', { error: err?.message })
    return true
  }
}

// Si le traitement échoue, on libère l'événement pour que le réessai Stripe le rejoue.
// Sans cela, l'événement resterait « traité » alors que rien n'a été enregistré.
async function unmarkEventProcessed(eventId: string) {
  try {
    await prisma.stripeEvent.deleteMany({ where: { id: eventId } })
  } catch (err: any) {
    logger.error('[WEBHOOK] Impossible de libérer un événement en échec:', {
      eventId,
      error: err?.message,
    })
  }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      await reportOperationalIssue({
        area: 'webhook',
        severity: 'critical',
        message: 'STRIPE_WEBHOOK_SECRET non configuré',
      })
      return NextResponse.json({ error: 'Webhook non configuré' }, { status: 500 })
    }

    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    await reportOperationalIssue({
      area: 'webhook',
      severity: 'warning',
      message: 'Signature Stripe invalide',
      context: { error: err.message },
    })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 400 })
  }

  // SECURITY FIX H6 + TASK51: Vérifier l'idempotence via DB
  const isNew = await markEventProcessed(event.id, event.type)
  if (!isNew) {
    if (isDev) logger.debug(`[WEBHOOK] Événement déjà traité: ${event.id}`)
    return NextResponse.json({ received: true, duplicate: true })
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

    logger.info('[WEBHOOK] Événement Stripe traité', {
      eventId: event.id,
      eventType: event.type,
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json({ received: true })
  } catch (err: any) {
    await unmarkEventProcessed(event.id)
    await reportOperationalIssue({
      area: 'webhook',
      severity: 'critical',
      message: `Échec du traitement Stripe ${event.type}`,
      context: {
        eventId: event.id,
        eventType: event.type,
        error: err.message,
      },
    })
    // Retourner 500 pour que Stripe réessaye l'événement
    return NextResponse.json({ error: 'Erreur de traitement' }, { status: 500 })
  }
}

function parseAmount(value: string | undefined | null): number | undefined {
  if (!value) return undefined
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

// Finalisation commune aux paiements d'enchère (Checkout Session ou PaymentIntent).
async function finalizeAuctionPayment({
  auctionId,
  paymentIntentId,
  buyerId,
  buyNow,
  commission,
  producerPayout,
  source,
}: {
  auctionId: string
  paymentIntentId: string
  buyerId?: string | null
  buyNow?: boolean
  commission?: number
  producerPayout?: number
  source: string
}) {
  const result = await completeAuctionSale({
    auctionId,
    paymentIntentId,
    buyerId,
    buyNow,
    commission,
    producerPayout,
  })

  if (result.outcome === 'COMPLETED') {
    sendAuctionSaleMessages(result)
    if (!result.purchase) {
      await reportOperationalIssue({
        area: 'webhook',
        severity: 'critical',
        message: 'Paiement encaissé sans acheteur identifié : achat à rattacher manuellement',
        context: { auctionId, paymentIntentId, source },
      })
    }
    if (isDev) logger.debug(`[WEBHOOK] ✓ Enchère ${auctionId} complétée (${source})`)
    return
  }

  if (result.outcome === 'CONFLICT') {
    // Le paiement est encaissé mais l'enchère ne peut pas lui être attribuée :
    // un humain doit rembourser. On ne rejoue pas l'événement (ça ne changerait rien).
    await reportOperationalIssue({
      area: 'webhook',
      severity: 'critical',
      message: `Paiement à rembourser manuellement : ${result.reason}`,
      context: { auctionId, paymentIntentId, source },
    })
    return
  }

  if (result.outcome === 'NOT_FOUND') {
    logger.error(`[WEBHOOK] Enchère ${auctionId} introuvable (${source})`)
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {}
  const { auctionId, userId, commission, producerPayout } = metadata

  if (!auctionId) {
    logger.error('[WEBHOOK] checkout.session.completed sans auctionId dans metadata')
    return
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  if (!paymentIntentId) {
    logger.error(`[WEBHOOK] checkout.session.completed sans payment_intent (${auctionId})`)
    return
  }

  try {
    await finalizeAuctionPayment({
      auctionId,
      paymentIntentId,
      buyerId: userId || null,
      commission: parseAmount(commission),
      producerPayout: parseAmount(producerPayout),
      source: 'checkout.session.completed',
    })
  } catch (err: any) {
    logger.error(`[WEBHOOK] Erreur checkout (${auctionId}):`, { error: err.message })
    throw err
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata || {}

  // ─── Achat direct de beat (hors enchères) ───
  if (metadata.type === 'direct_purchase' && metadata.beatId) {
    await handleDirectPurchaseSucceeded(paymentIntent)
    return
  }

  // ─── Paiement d'enchère gagnée ou achat immédiat ───
  const auctionId = metadata.auctionId
  if (!auctionId) return

  try {
    await finalizeAuctionPayment({
      auctionId,
      paymentIntentId: paymentIntent.id,
      buyerId: metadata.buyerId || null,
      buyNow: metadata.buyNow === 'true',
      commission: parseAmount(metadata.commission),
      producerPayout: parseAmount(metadata.producerPayout),
      source: 'payment_intent.succeeded',
    })
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

    const buyerEmail = paymentIntent.receipt_email
    const finalPriceAmount = paymentIntent.amount / 100
    const commissionAmt = commission ? parseFloat(commission) : 0
    const payoutAmt = producerPayout ? parseFloat(producerPayout) : 0
    const payoutAmount = payoutAmt

    // Toutes les écritures dans une seule transaction : soit la vente est entièrement
    // enregistrée, soit rien ne l'est et le réessai Stripe repart de zéro.
    const sale = await prisma.$transaction(async (tx) => {
      const alreadyRecorded = await tx.purchase.findFirst({
        where: { stripePaymentId: paymentIntent.id },
      })
      if (alreadyRecorded) return null

      // Si licence EXCLUSIVE, marquer le beat comme vendu
      if (licenseType === 'EXCLUSIVE' && beat.saleMode !== 'LEASING') {
        await tx.beat.update({
          where: { id: beatId },
          data: { status: 'SOLD' },
        })

        // Retirer de la playlist Nouveautés
        const nouveautesPlaylist = await tx.playlist.findFirst({
          where: { name: 'Nouveautés', visibility: 'PUBLIC' },
          select: { id: true },
        })
        if (nouveautesPlaylist) {
          await tx.playlistBeat.deleteMany({
            where: { playlistId: nouveautesPlaylist.id, beatId },
          })
        }
      }

      // Incrémenter les ventes du producteur
      await tx.user.update({
        where: { id: beat.producerId },
        data: { totalSales: { increment: 1 } },
      })

      // Trouver l'acheteur via l'email du PaymentIntent
      let txBuyer: Awaited<ReturnType<typeof prisma.user.findFirst>> = null
      let txPurchase: Awaited<ReturnType<typeof prisma.purchase.create>> | null = null

      if (buyerEmail) {
        txBuyer = await tx.user.findFirst({
          where: { email: buyerEmail },
        })
        if (txBuyer) {
          await tx.user.update({
            where: { id: txBuyer.id },
            data: { totalPurchases: { increment: 1 } },
          })

          // TASK48: Creer un enregistrement Purchase pour l'achat direct
          txPurchase = await tx.purchase.create({
            data: {
              buyerId: txBuyer.id,
              beatId,
              type: 'DIRECT',
              licenseType,
              amount: finalPriceAmount,
              commission: commissionAmt,
              producerPayout: payoutAmt,
              stripePaymentId: paymentIntent.id,
              status: 'COMPLETED',
            },
          })

          // Notifier l'acheteur
          await tx.notification.create({
            data: {
              type: 'AUCTION_WON',
              title: 'Achat confirmé !',
              message: `Votre achat de "${beat.title}" (Licence ${licenseType}) est confirmé.`,
              link: '/dashboard?tab=purchases',
              userId: txBuyer.id,
            },
          })
        }
      }

      // Notifier le producteur
      await tx.notification.create({
        data: {
          type: 'PAYMENT_RECEIVED',
          title: 'Vente directe !',
          message: `Votre beat "${beat.title}" a été vendu (Licence ${licenseType}). Votre part: ${payoutAmount}€`,
          link: '/dashboard?tab=earnings',
          userId: beat.producerId,
        },
      })

      return { buyer: txBuyer, completedPurchase: txPurchase }
    })

    // Paiement déjà enregistré (événement rejoué) : rien à refaire.
    if (!sale) return

    const { buyer, completedPurchase } = sale

    if (!completedPurchase) {
      await reportOperationalIssue({
        area: 'webhook',
        severity: 'critical',
        message: 'Achat direct encaissé sans compte acheteur : achat à rattacher manuellement',
        context: { beatId, paymentIntentId: paymentIntent.id },
      })
    }

    sendNtfy(
      'Vente finalisee',
      `${beat.title} vendu pour ${finalPriceAmount} EUR (${licenseType})`,
      'high'
    ).catch(() => {})

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

    if (buyerEmail && buyer && completedPurchase) {
      const contractData: LicenseContractData = {
        purchaseId: completedPurchase.id,
        purchaseType: completedPurchase.type,
        transactionId: completedPurchase.stripePaymentId,
        purchasedAt: completedPurchase.createdAt,
        amount: completedPurchase.amount,
        licenseType: completedPurchase.licenseType,
        buyer: {
          name: buyer.displayName || buyer.name,
          email: buyer.email,
        },
        producer: {
          name: beat.producer.displayName || beat.producer.name,
          email: beat.producer.email,
        },
        beat: {
          id: beat.id,
          title: beat.title,
          genre: beat.genre,
          bpm: beat.bpm,
          key: beat.key,
        },
      }
      const contractPdf = generateLicenseContractPdf(contractData)
      const contractAttachment = {
        filename: getContractFileName(contractData),
        content: contractPdf,
      }
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const contractUrl = `${baseUrl}/api/purchases/${completedPurchase.id}/contract`

      // Envoyer un accès magique aux comptes invités et la confirmation standard aux autres.
      if (!buyer.passwordHash) {
        // C'est un compte invité — générer un magic token si pas déjà fait
        let magicToken = buyer.magicToken
        if (!magicToken) {
          const { randomBytes } = await import('crypto')
          magicToken = randomBytes(32).toString('hex')
          await prisma.user.update({
            where: { id: buyer.id },
            data: {
              magicToken,
              magicTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
            } as any,
          })
        }

        const magicLoginUrl = `${baseUrl}/api/auth/magic-login?token=${magicToken}&redirect=/dashboard?tab=purchases`
        const downloadUrl = `${baseUrl}/dashboard?tab=purchases`

        sendGuestPurchaseEmail({
          to: buyerEmail,
          beatTitle: beat.title,
          producerName: beat.producer?.displayName || beat.producer?.name || 'Producteur',
          licenseType,
          finalPrice: paymentIntent.amount / 100,
          downloadUrl,
          magicLoginUrl,
          contractUrl,
          contractAttachment,
        }).catch((e) =>
          logger.error('[WEBHOOK] Erreur envoi email guest purchase:', { error: e?.message })
        )
      } else {
        sendPurchaseConfirmedEmail({
          to: buyerEmail,
          buyerName: buyer.displayName || buyer.name,
          beatTitle: beat.title,
          producerName: beat.producer.displayName || beat.producer.name,
          licenseType,
          finalPrice: finalPriceAmount,
          purchaseId: completedPurchase.id,
          contractAttachment,
        }).catch((e) =>
          logger.error('[WEBHOOK] Erreur envoi contrat achat direct:', { error: e?.message })
        )
      }
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
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  const auctionId = charge.metadata?.auctionId

  // Un remboursement partiel ne doit pas annuler la vente : un humain tranche.
  if (!charge.refunded) {
    await reportOperationalIssue({
      area: 'webhook',
      severity: 'warning',
      message: 'Remboursement partiel reçu : aucune annulation automatique',
      context: { paymentIntentId, auctionId, amountRefunded: charge.amount_refunded / 100 },
    })
    return
  }

  try {
    await prisma.$transaction(async (tx) => {
      // L'acheteur perd l'accès au téléchargement dès que l'achat est remboursé.
      if (paymentIntentId) {
        await tx.purchase.updateMany({
          where: { stripePaymentId: paymentIntentId, status: 'COMPLETED' },
          data: { status: 'REFUNDED' },
        })
      }

      if (!auctionId) return

      const auction = await tx.auction.findUnique({
        where: { id: auctionId },
        include: {
          beat: { include: { producer: true } },
        },
      })

      if (!auction) return

      // Garde atomique : un remboursement rejoué ne décrémente pas deux fois les compteurs.
      const cancelled = await tx.auction.updateMany({
        where: { id: auctionId, status: { not: 'CANCELLED' } },
        data: { status: 'CANCELLED' },
      })
      if (cancelled.count !== 1) return

      await tx.purchase.updateMany({
        where: { auctionId, status: 'COMPLETED' },
        data: { status: 'REFUNDED' },
      })

      await tx.beat.update({
        where: { id: auction.beatId },
        data: { status: 'ACTIVE' },
      })

      // Les compteurs n'ont été incrémentés que si la vente avait été payée.
      if (!auction.paidAt) return

      await tx.user.update({
        where: { id: auction.beat.producerId },
        data: { totalSales: { decrement: 1 } },
      })

      if (auction.winnerId) {
        await tx.user.update({
          where: { id: auction.winnerId },
          data: { totalPurchases: { decrement: 1 } },
        })

        await tx.notification.create({
          data: {
            type: 'SYSTEM',
            title: 'Remboursement traité',
            message: `Votre remboursement de ${charge.amount_refunded / 100}€ a été accepté et sera crédité sous 5 à 10 jours ouvrables.`,
            link: '/dashboard?tab=purchases',
            userId: auction.winnerId,
          },
        })
      }
    })
  } catch (err: any) {
    logger.error(`[WEBHOOK] Erreur Refund (${auctionId || paymentIntentId}):`, {
      error: err.message,
    })
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

    if (isReady && user.producerStatus === 'SUSPENDED' && user.stripeGraceSuspendedAt) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          producerStatus: 'APPROVED',
          stripeGraceSuspendedAt: null,
        },
      })

      await prisma.notification.create({
        data: {
          type: 'SYSTEM',
          title: 'Compte beatmaker réactivé !',
          message:
            'Ton compte Stripe est validé. Tu peux de nouveau publier et recevoir des paiements.',
          link: '/dashboard?tab=settings',
          userId: user.id,
        },
      })

      if (isDev) logger.debug(`[WEBHOOK] ✓ Producteur ${user.id} réactivé`)
    }
  } catch (err: any) {
    logger.error('[WEBHOOK] Erreur AccountUpdated:', { error: err.message })
    throw err
  }
}
