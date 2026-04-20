export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createBeatPurchaseIntent, isConnectAccountReady, calculateFinalPrice } from '@/lib/stripe'

// POST /api/beats/[id]/purchase — Achat direct d'un beat (hors encheres)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const { licenseType } = await req.json()

    // Valider le type de licence
    if (!['BASIC', 'PREMIUM', 'EXCLUSIVE'].includes(licenseType)) {
      return NextResponse.json({ error: 'Type de licence invalide' }, { status: 400 })
    }

    // Recuperer le beat avec le producteur
    const beat = await prisma.beat.findUnique({
      where: { id: params.id },
      include: {
        producer: {
          select: {
            id: true,
            name: true,
            displayName: true,
            email: true,
            stripeAccountId: true,
          },
        },
        auctions: {
          where: {
            status: { in: ['ACTIVE', 'ENDING_SOON', 'SCHEDULED'] },
          },
          select: { id: true },
        },
      },
    })

    if (!beat) {
      return NextResponse.json({ error: 'Beat introuvable' }, { status: 404 })
    }

    // Verifier que le beat n'est pas en encheres actives
    if (beat.auctions.length > 0) {
      return NextResponse.json(
        { error: "Ce beat est actuellement en encheres. Tu ne peux pas l'acheter directement." },
        { status: 400 }
      )
    }

    // Verifier que le beat n'est pas deja vendu en exclusif
    if (beat.status === 'SOLD') {
      return NextResponse.json({ error: 'Ce beat a deja ete vendu' }, { status: 400 })
    }

    // L'acheteur ne peut pas etre le producteur
    if (beat.producerId === session.user.id) {
      return NextResponse.json({ error: 'Tu ne peux pas acheter ton propre beat' }, { status: 400 })
    }

    // Verifier que le producteur a un compte Stripe Connect actif
    if (!beat.producer.stripeAccountId) {
      return NextResponse.json(
        { error: "Le producteur n'a pas encore configure son compte de paiement" },
        { status: 400 }
      )
    }

    const isProducerReady = await isConnectAccountReady(beat.producer.stripeAccountId)
    if (!isProducerReady) {
      return NextResponse.json(
        { error: 'Le compte de paiement du producteur est en cours de verification' },
        { status: 400 }
      )
    }

    // Determiner le prix de base du beat
    // On utilise le startPrice de la derniere enchere terminee, ou un prix par defaut
    const lastAuction = await prisma.auction.findFirst({
      where: {
        beatId: beat.id,
        status: { in: ['ENDED', 'COMPLETED', 'CANCELLED'] },
      },
      orderBy: { endTime: 'desc' },
      select: { startPrice: true },
    })

    const basePrice = lastAuction?.startPrice || 20 // Prix par defaut 20 EUR si pas d'enchere precedente

    // Calculer le prix final avec le multiplicateur de licence
    const finalPrice = calculateFinalPrice(basePrice, licenseType)

    // Creer le PaymentIntent
    const { paymentIntent, clientSecret, commission, producerPayout } =
      await createBeatPurchaseIntent({
        amount: finalPrice,
        producerStripeAccountId: beat.producer.stripeAccountId,
        beatId: beat.id,
        buyerEmail: session.user.email!,
        beatTitle: beat.title,
        licenseType,
      })

    // Creer un enregistrement de vente directe (Purchase)
    // On utilise un modele simplifie en metadata du PaymentIntent
    // La confirmation se fera via webhook Stripe

    return NextResponse.json({
      clientSecret,
      paymentIntentId: paymentIntent.id,
      beatId: beat.id,
      beatTitle: beat.title,
      basePrice,
      licenseType,
      finalPrice,
      commission,
      producerPayout,
      producerName: beat.producer.displayName || beat.producer.name,
    })
  } catch (error: any) {
    console.error('Erreur achat direct beat:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
