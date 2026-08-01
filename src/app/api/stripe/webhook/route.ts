export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { reportOperationalIssue } from '@/lib/monitoring'
import Stripe from 'stripe'
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

    // TASK48: Creer un enregistrement Purchase pour l'achat via enchère
    const buyerId = userId || auction.winnerId
    const purchaseAmount = auction.finalPrice || auction.currentBid
    const commissionAmt = commission ? parseFloat(commission) : auction.commissionAmount || 0
    const payoutAmt = producerPayout ? parseFloat(producerPayout) : auction.producerPayout || 0
    let completedPurchase: Awaited<ReturnType<typeof prisma.purchase.create>> | null = null

    if (buyerId) {
      completedPurchase = await prisma.purchase.create({
        data: {
          buyerId,
          beatId: auction.beatId,
          type: 'AUCTION',
          licenseType: auction.winningLicense || auction.licenseType,
          amount: purchaseAmount,
          commission: commissionAmt,
          producerPayout: payoutAmt,
          stripePaymentId: session.payment_intent as string,
          status: 'COMPLETED',
          auctionId,
        },
      })
    }

    // Incrémenter les ventes du producteur
    if (producerId) {
      await prisma.user.update({
        where: { id: producerId },
        data: { totalSales: { increment: 1 } },
      })
    }

    // Incrémenter les achats de l'acheteur
    if (buyerId) {
      await prisma.user.update({
        where: { id: buyerId },
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
    if (buyerId) {
      await prisma.notification.create({
        data: {
          type: 'AUCTION_WON',
          title: 'Achat confirmé !',
          message: `Votre beat "${auction.beat.title}" est prêt à être téléchargé.`,
          link: `/dashboard?tab=purchases`,
          userId: buyerId,
        },
      })
    }

    // Envoyer les emails (non-bloquant)
    const payoutAmount = producerPayout ? parseFloat(producerPayout) : auction.producerPayout || 0
    const commissionAmount = commission ? parseFloat(commission) : auction.commissionAmount || 0
    const finalPrice = auction.finalPrice || auction.currentBid

    sendNtfy('Vente finalisee', `${auction.beat.title} vendu pour ${finalPrice} EUR`, 'high').catch(
      () => {}
    )

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

    if (completedPurchase && buyerId) {
      const buyer =
        auction.winner?.id === buyerId
          ? auction.winner
          : await prisma.user.findUnique({ where: { id: buyerId } })

      if (buyer?.email) {
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
            name: auction.beat.producer?.displayName || auction.beat.producer?.name || 'Producteur',
            email: auction.beat.producer?.email || '',
          },
          beat: {
            id: auction.beat.id,
            title: auction.beat.title,
            genre: auction.beat.genre,
            bpm: auction.beat.bpm,
            key: auction.beat.key,
          },
        }
        const contractPdf = generateLicenseContractPdf(contractData)
        sendPurchaseConfirmedEmail({
          to: buyer.email,
          buyerName: buyer.displayName || buyer.name,
          beatTitle: auction.beat.title,
          producerName:
            auction.beat.producer?.displayName || auction.beat.producer?.name || 'Producteur',
          licenseType: completedPurchase.licenseType,
          finalPrice: completedPurchase.amount,
          purchaseId: completedPurchase.id,
          contractAttachment: {
            filename: getContractFileName(contractData),
            content: contractPdf,
          },
        }).catch((e) =>
          logger.error('[WEBHOOK] Erreur envoi contrat acheteur:', { error: e?.message })
        )
      }
    }

    if (isDev) logger.debug(`[WEBHOOK] ✓ Enchère ${auctionId} complétée`)
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

    const purchaseAmount = auction.finalPrice || auction.currentBid
    const commissionAmount = metadata.commission
      ? parseFloat(metadata.commission)
      : auction.commissionAmount || 0
    const payoutAmount = metadata.producerPayout
      ? parseFloat(metadata.producerPayout)
      : auction.producerPayout || 0
    let completedPurchase: Awaited<ReturnType<typeof prisma.purchase.create>> | null = null

    if (auction.winnerId) {
      const existingPurchase = await prisma.purchase.findFirst({
        where: {
          auctionId,
          buyerId: auction.winnerId,
          status: 'COMPLETED',
        },
      })
      completedPurchase =
        existingPurchase ||
        (await prisma.purchase.create({
          data: {
            buyerId: auction.winnerId,
            beatId: auction.beatId,
            type: 'AUCTION',
            licenseType: auction.winningLicense || auction.licenseType,
            amount: purchaseAmount,
            commission: commissionAmount,
            producerPayout: payoutAmount,
            stripePaymentId: paymentIntent.id,
            status: 'COMPLETED',
            auctionId,
          },
        }))
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

    sendNtfy(
      'Vente finalisee',
      `${auction.beat.title} vendu pour ${purchaseAmount} EUR`,
      'high'
    ).catch(() => {})

    if (auction.beat.producer?.email) {
      sendPaymentReceivedEmail({
        to: auction.beat.producer.email,
        producerName: auction.beat.producer.displayName || auction.beat.producer.name,
        beatTitle: auction.beat.title,
        buyerName: auction.winner?.displayName || auction.winner?.name || 'Acheteur',
        finalPrice: purchaseAmount,
        commission: commissionAmount,
        payout: payoutAmount,
        license: auction.winningLicense || auction.licenseType,
      }).catch((e) =>
        logger.error('[WEBHOOK] Erreur envoi email producteur:', { error: e?.message })
      )
    }

    if (completedPurchase && auction.winner?.email) {
      const contractData: LicenseContractData = {
        purchaseId: completedPurchase.id,
        purchaseType: completedPurchase.type,
        transactionId: completedPurchase.stripePaymentId,
        purchasedAt: completedPurchase.createdAt,
        amount: completedPurchase.amount,
        licenseType: completedPurchase.licenseType,
        buyer: {
          name: auction.winner.displayName || auction.winner.name,
          email: auction.winner.email,
        },
        producer: {
          name: auction.beat.producer.displayName || auction.beat.producer.name,
          email: auction.beat.producer.email,
        },
        beat: {
          id: auction.beat.id,
          title: auction.beat.title,
          genre: auction.beat.genre,
          bpm: auction.beat.bpm,
          key: auction.beat.key,
        },
      }
      const contractPdf = generateLicenseContractPdf(contractData)
      sendPurchaseConfirmedEmail({
        to: auction.winner.email,
        buyerName: auction.winner.displayName || auction.winner.name,
        beatTitle: auction.beat.title,
        producerName: auction.beat.producer.displayName || auction.beat.producer.name,
        licenseType: completedPurchase.licenseType,
        finalPrice: completedPurchase.amount,
        purchaseId: completedPurchase.id,
        contractAttachment: {
          filename: getContractFileName(contractData),
          content: contractPdf,
        },
      }).catch((e) =>
        logger.error('[WEBHOOK] Erreur envoi contrat acheteur:', { error: e?.message })
      )
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
    if (licenseType === 'EXCLUSIVE' && beat.saleMode !== 'LEASING') {
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
    const finalPriceAmount = paymentIntent.amount / 100
    const commissionAmt = commission ? parseFloat(commission) : 0
    const payoutAmt = producerPayout ? parseFloat(producerPayout) : 0
    let buyer: Awaited<ReturnType<typeof prisma.user.findFirst>> = null
    let completedPurchase: Awaited<ReturnType<typeof prisma.purchase.create>> | null = null

    if (buyerEmail) {
      buyer = await prisma.user.findFirst({
        where: { email: buyerEmail },
      })
      if (buyer) {
        await prisma.user.update({
          where: { id: buyer.id },
          data: { totalPurchases: { increment: 1 } },
        })

        // TASK48: Creer un enregistrement Purchase pour l'achat direct
        completedPurchase = await prisma.purchase.create({
          data: {
            buyerId: buyer.id,
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
