export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  createBeatPurchaseIntent,
  isConnectAccountReady,
  calculateFinalPrice,
  calculatePaymentSplit,
  stripe,
} from '@/lib/stripe'
import { randomBytes } from 'crypto'
import {
  getConfiguredLicensePrice,
  normalizeLicenseType,
  toPublicLicenseType,
} from '@/lib/beat-pricing'
import { getLegacyBeatFileType } from '@/lib/legacy-beat-files'
import { isLeasingLicenseAllowed } from '@/lib/beat-sale-mode'

// POST /api/beats/[id]/purchase — Achat direct d'un beat (hors enchères)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    const body = await req.json()
    const { licenseType, guestEmail } = body

    // Déterminer l'utilisateur (session ou invité)
    let userId: string
    let userEmail: string
    let isGuest = false

    if (session?.user) {
      userId = (session.user as any).id
      userEmail = session.user.email!
    } else if (guestEmail && typeof guestEmail === 'string') {
      // Mode invité : chercher ou créer le user
      const emailLower = guestEmail.toLowerCase().trim()
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(emailLower)) {
        return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
      }

      let guestUser = await prisma.user.findUnique({
        where: { email: emailLower },
        select: { id: true, email: true },
      })

      if (!guestUser) {
        // Créer un compte automatiquement
        const namePart = emailLower.split('@')[0]
        guestUser = await prisma.user.create({
          data: {
            email: emailLower,
            name: namePart,
            role: 'ARTIST',
            emailVerified: null,
          },
          select: { id: true, email: true },
        })
      }

      userId = guestUser.id
      userEmail = guestUser.email
      isGuest = true
    } else {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Valider le type de licence (anciens + nouveaux types)
    if (!['BASIC', 'PREMIUM', 'EXCLUSIVE', 'MP3', 'WAV', 'STEMS'].includes(licenseType)) {
      return NextResponse.json({ error: 'Type de licence invalide' }, { status: 400 })
    }

    // Récupérer le beat avec le producteur
    const beat = (await prisma.beat.findUnique({
      where: { id },
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
    })) as any // Cast to any to access new fields before prisma generate

    if (!beat) {
      return NextResponse.json({ error: 'Beat introuvable' }, { status: 404 })
    }

    // Vérifier que le beat n'est pas en enchères actives
    if (beat.auctions.length > 0) {
      return NextResponse.json(
        { error: "Ce beat est actuellement en enchères. Tu ne peux pas l'acheter directement." },
        { status: 400 }
      )
    }

    // Vérifier que le beat n'est pas déjà vendu en exclusif
    if (beat.status === 'SOLD') {
      return NextResponse.json({ error: 'Ce beat a déjà été vendu' }, { status: 400 })
    }
    if (beat.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Ce beat n’est pas disponible à la vente' },
        { status: 400 }
      )
    }

    // L'acheteur ne peut pas etre le producteur
    if (beat.producerId === userId) {
      return NextResponse.json({ error: 'Tu ne peux pas acheter ton propre beat' }, { status: 400 })
    }

    const normalizedLicenseType = normalizeLicenseType(licenseType)
    if (!normalizedLicenseType) {
      return NextResponse.json({ error: 'Type de licence invalide' }, { status: 400 })
    }
    if (beat.saleMode === 'LEASING' && !isLeasingLicenseAllowed(licenseType)) {
      return NextResponse.json(
        {
          error:
            'Ce beat est vendu en leasing non exclusif. Seules les licences Basic MP3 et Premium WAV sont disponibles.',
        },
        { status: 400 }
      )
    }

    const legacyFileType = getLegacyBeatFileType(beat.audioUrl)

    if (normalizedLicenseType === 'MP3' && !beat.audioOriginal && legacyFileType !== 'mp3') {
      return NextResponse.json({ error: 'Ce beat n’est pas disponible en MP3' }, { status: 400 })
    }
    if (normalizedLicenseType === 'WAV' && !beat.audioWav && legacyFileType !== 'wav') {
      return NextResponse.json({ error: 'Ce beat n’est pas disponible en WAV' }, { status: 400 })
    }
    if (normalizedLicenseType === 'STEMS' && !beat.stemsUrl && !beat.stemsFiles) {
      return NextResponse.json(
        { error: 'Les stems ne sont pas disponibles pour ce beat' },
        { status: 400 }
      )
    }

    // Vérifier si le producteur a un compte Stripe Connect actif
    let useAdminStripe = false
    if (!beat.producer.stripeAccountId) {
      useAdminStripe = true
    } else {
      const isProducerReady = await isConnectAccountReady(beat.producer.stripeAccountId)
      if (!isProducerReady) {
        useAdminStripe = true
      }
    }

    // Déterminer le prix selon la licence choisie
    let finalPrice: number
    let basePrice = 0

    // Nouveau système de prix par licence (défini par le producteur)
    const configuredPrice = getConfiguredLicensePrice(beat, normalizedLicenseType)
    if (configuredPrice) {
      finalPrice = configuredPrice
      basePrice = configuredPrice
    } else if (beat.saleMode === 'LEASING') {
      return NextResponse.json(
        { error: 'Le beatmaker n’a pas configuré le prix de cette licence leasing.' },
        { status: 400 }
      )
    } else {
      // Fallback: ancien système avec multiplicateur
      const lastAuction = await prisma.auction.findFirst({
        where: {
          beatId: beat.id,
          status: { in: ['ENDED', 'COMPLETED', 'CANCELLED'] },
        },
        orderBy: { endTime: 'desc' },
        select: { startPrice: true },
      })
      basePrice = lastAuction?.startPrice || 20
      finalPrice = calculateFinalPrice(
        basePrice,
        toPublicLicenseType(normalizedLicenseType) || licenseType
      )
    }

    // Creer le PaymentIntent
    let paymentIntent: any
    let clientSecret: string
    let commission: number
    let producerPayout: number

    if (useAdminStripe) {
      // Pas de compte Stripe producteur → paiement direct au compte admin (318 LEGAACY)
      const split = calculatePaymentSplit(finalPrice)
      commission = split.commission
      producerPayout = split.producerPayout

      const amountInCents = Math.round(finalPrice * 100)

      paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'eur',
        metadata: {
          beatId: beat.id,
          type: 'direct_purchase',
          platform: '318_legaacy',
          licenseType,
          buyerEmail: userEmail,
          adminPayout: 'true', // Flag pour le webhook: paiement allé au compte admin
          producerId: beat.producerId,
        },
        receipt_email: userEmail,
        automatic_payment_methods: { enabled: true },
      })
      clientSecret = paymentIntent.client_secret!
    } else {
      const result = await createBeatPurchaseIntent({
        amount: finalPrice,
        producerStripeAccountId: beat.producer.stripeAccountId!,
        beatId: beat.id,
        buyerEmail: userEmail,
        beatTitle: beat.title,
        licenseType,
      })
      paymentIntent = result.paymentIntent
      if (!result.clientSecret) {
        throw new Error('Stripe n’a pas retourné de client secret')
      }
      clientSecret = result.clientSecret
      commission = result.commission
      producerPayout = result.producerPayout
    }

    // Si c'est un invité, générer un magicToken pour l'email post-achat
    let guestUserId: string | undefined
    if (isGuest) {
      const magicToken = randomBytes(32).toString('hex')
      const magicTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

      await prisma.user.update({
        where: { id: userId },
        data: {
          magicToken,
          magicTokenExpiry,
        } as any,
      })
      guestUserId = userId
    }

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
      ...(isGuest && { isGuest: true, guestUserId }),
    })
  } catch (error: any) {
    console.error('Erreur achat direct beat:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
