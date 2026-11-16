export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { completeAuctionSale, sendAuctionSaleMessages } from '@/lib/auction-sale'

function parseAmount(value: string | undefined | null): number | undefined {
  if (!value) return undefined
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

// POST /api/auctions/[id]/buy-now/confirm — Finaliser apres paiement réussi
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = session.user.id
    const { id: auctionId } = await params

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: { id: true, status: true, buyNowPrice: true, stripePaymentId: true, winnerId: true },
    })

    if (!auction) {
      return NextResponse.json({ error: 'Enchere introuvable' }, { status: 404 })
    }

    if (!auction.buyNowPrice) {
      return NextResponse.json({ error: 'Pas de prix achat immédiat' }, { status: 400 })
    }

    // Le webhook Stripe a pu finaliser la vente avant le retour du navigateur.
    if (auction.status === 'COMPLETED' && auction.winnerId === userId) {
      return NextResponse.json({
        success: true,
        message: `Achat confirmé pour ${auction.buyNowPrice} EUR`,
      })
    }

    // Vérifier que l'enchère est encore active (pas déjà finalisée)
    if (auction.status !== 'ACTIVE' && auction.status !== 'ENDING_SOON') {
      return NextResponse.json({ error: "Cette enchère n'est plus active" }, { status: 400 })
    }

    // BUG FIX 4: Vérifier le paiement Stripe AVANT de finaliser
    if (!auction.stripePaymentId) {
      return NextResponse.json({ error: 'Aucun paiement Stripe associe' }, { status: 400 })
    }

    let paymentIntent
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(auction.stripePaymentId)
    } catch (stripeErr) {
      console.error('Erreur vérification Stripe:', String(stripeErr))
      return NextResponse.json({ error: 'Impossible de vérifiér le paiement' }, { status: 500 })
    }

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Paiement non confirmé (statut: ${paymentIntent.status})` },
        { status: 402 }
      )
    }

    // Le paiement doit concerner CETTE enchère et appartenir à CET utilisateur :
    // sans ce contrôle, n'importe quel compte connecté pourrait se déclarer gagnant
    // juste après le paiement d'un autre.
    const metadata = paymentIntent.metadata || {}
    const sessionEmail = session.user.email?.toLowerCase()
    const paidByThisUser = metadata.buyerId
      ? metadata.buyerId === userId
      : Boolean(sessionEmail) && paymentIntent.receipt_email?.toLowerCase() === sessionEmail

    if (metadata.auctionId !== auctionId || !paidByThisUser) {
      return NextResponse.json(
        { error: "Ce paiement n'est pas associé à votre compte" },
        { status: 403 }
      )
    }

    const result = await completeAuctionSale({
      auctionId,
      paymentIntentId: paymentIntent.id,
      buyerId: userId,
      buyNow: true,
      commission: parseAmount(metadata.commission),
      producerPayout: parseAmount(metadata.producerPayout),
    })

    if (result.outcome === 'COMPLETED') {
      sendAuctionSaleMessages(result)
    } else if (result.outcome === 'ALREADY_COMPLETED') {
      if (result.purchase && result.purchase.buyerId !== userId) {
        return NextResponse.json({ error: "Cette enchère n'est plus active" }, { status: 409 })
      }
    } else if (result.outcome === 'CONFLICT') {
      return NextResponse.json({ error: "Cette enchère n'est plus active" }, { status: 409 })
    } else {
      return NextResponse.json({ error: 'Enchere introuvable' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: `Achat confirmé pour ${auction.buyNowPrice} EUR`,
    })
  } catch (error) {
    console.error('Erreur buy-now confirm:', String(error))
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
