export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  stripe,
  createAuctionPaymentIntent,
  createHeldPaymentIntent,
  isConnectAccountReady,
} from '@/lib/stripe'

// Durée pendant laquelle un paiement d'achat immédiat en cours bloque les autres acheteurs.
const BUY_NOW_RESERVATION_MS = 10 * 60 * 1000
const REUSABLE_STATUSES = ['requires_payment_method', 'requires_confirmation', 'requires_action']
const IN_FLIGHT_STATUSES = ['processing', 'requires_capture', 'succeeded']

// POST /api/auctions/[id]/buy-now — Creer un PaymentIntent pour achat immédiat
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = session.user.id
    const { id: auctionId } = await params

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
      return NextResponse.json({ error: 'Cette enchère est terminée' }, { status: 400 })
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
    const amountInCents = Math.round(amount * 100)
    const previousPaymentId = auction.stripePaymentId

    // ── Réservation : un seul acheteur à la fois peut payer un achat immédiat ──
    if (previousPaymentId) {
      try {
        const previous = await stripe.paymentIntents.retrieve(previousPaymentId)
        const isBuyNow = previous.metadata?.buyNow === 'true'
        const sameBuyer = previous.metadata?.buyerId === userId

        if (isBuyNow && sameBuyer) {
          if (IN_FLIGHT_STATUSES.includes(previous.status)) {
            return NextResponse.json(
              { error: 'Votre paiement est déjà en cours de validation.' },
              { status: 409 }
            )
          }
          // Même acheteur, paiement pas encore finalisé : on le réutilise au lieu d'en créer un second.
          if (
            REUSABLE_STATUSES.includes(previous.status) &&
            previous.amount === amountInCents &&
            previous.client_secret
          ) {
            return NextResponse.json({
              clientSecret: previous.client_secret,
              paymentIntentId: previous.id,
              amount,
              commission: auction.commissionAmount,
              producerPayout: auction.producerPayout,
              beatTitle: auction.beat.title,
              licenseType: 'EXCLUSIVE',
            })
          }
        } else if (isBuyNow) {
          const ageMs = Date.now() - previous.created * 1000
          const reserved =
            IN_FLIGHT_STATUSES.includes(previous.status) ||
            (REUSABLE_STATUSES.includes(previous.status) && ageMs < BUY_NOW_RESERVATION_MS)
          if (reserved) {
            return NextResponse.json(
              {
                error:
                  'Un autre acheteur est en train de finaliser cet achat. Réessayez dans quelques minutes.',
              },
              { status: 409 }
            )
          }
        }
      } catch (stripeErr) {
        // Paiement précédent illisible (supprimé, autre mode…) : on ne bloque pas l'achat.
        console.warn('[BUY-NOW] Paiement précédent non vérifiable:', String(stripeErr))
      }
    }

    // buyerId + buyNow permettent au webhook de finaliser la vente pour le bon acheteur,
    // même si le navigateur ne revient jamais confirmer.
    const extraMetadata = { buyerId: userId, buyNow: 'true' }
    let result

    // Si le producteur a un compte Stripe Connect actif → split direct
    if (producer.stripeAccountId && (await isConnectAccountReady(producer.stripeAccountId))) {
      result = await createAuctionPaymentIntent({
        amount,
        producerStripeAccountId: producer.stripeAccountId,
        auctionId: auction.id,
        buyerEmail: session.user.email!,
        beatTitle: auction.beat.title,
        licenseType: 'EXCLUSIVE',
        extraMetadata,
      })
    } else {
      // Pas de compte Stripe (ou pas encore vérifié) → marketplace encaisse et reversera plus tard
      result = await createHeldPaymentIntent({
        amount,
        auctionId: auction.id,
        buyerEmail: session.user.email!,
        beatTitle: auction.beat.title,
        licenseType: 'EXCLUSIVE',
        producerId: producer.id,
        extraMetadata,
      })
    }

    // Sauvegarde atomique : n'écrit que si personne n'a posé un autre paiement
    // (ni finalisé l'enchère) depuis notre lecture.
    const saved = await prisma.auction.updateMany({
      where: {
        id: auctionId,
        status: { in: ['ACTIVE', 'ENDING_SOON'] },
        stripePaymentId: previousPaymentId,
      },
      data: {
        stripePaymentId: result.paymentIntent.id,
        commissionAmount: result.commission,
        producerPayout: result.producerPayout,
      },
    })

    if (saved.count !== 1) {
      // Un autre acheteur nous a devancés : on annule notre paiement avant qu'il soit payé.
      try {
        await stripe.paymentIntents.cancel(result.paymentIntent.id)
      } catch (cancelErr) {
        console.error('[BUY-NOW] Annulation du paiement en double impossible:', String(cancelErr))
      }
      return NextResponse.json(
        {
          error:
            'Un autre acheteur est en train de finaliser cet achat. Réessayez dans quelques minutes.',
        },
        { status: 409 }
      )
    }

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
