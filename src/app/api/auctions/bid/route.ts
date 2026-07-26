export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { placeBidSchema } from '@/lib/validations'
import { calculateFinalPrice } from '@/lib/stripe'
import { sendOutbidEmail, sendAdminNewBidEmail } from '@/lib/emails/resend'
import { sendPushToUser } from '@/lib/web-push'
import { randomBytes } from 'crypto'
import { enforceProducerStripeAccess } from '@/lib/producer-stripe-access'

// POST /api/auctions/bid?auctionId=xxx - Placer une enchère
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    const { searchParams } = new URL(request.url)
    const auctionId = searchParams.get('auctionId')

    if (!auctionId) {
      return NextResponse.json({ error: 'auctionId requis' }, { status: 400 })
    }

    const body = await request.json()

    let userId: string
    let isGuest = false

    if (session?.user) {
      userId = (session.user as any).id
    } else {
      // Tenter le mode invité
      const guestEmail = body.guestEmail

      if (!guestEmail || typeof guestEmail !== 'string') {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
      }

      const emailLower = guestEmail.toLowerCase().trim()
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(emailLower)) {
        return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
      }

      let guestUser = await prisma.user.findUnique({
        where: { email: emailLower },
        select: { id: true },
      })

      if (!guestUser) {
        const namePart = emailLower.split('@')[0]
        guestUser = await prisma.user.create({
          data: {
            email: emailLower,
            name: namePart,
            role: 'ARTIST',
            emailVerified: null,
          },
          select: { id: true },
        })

        // Générer un magic token pour le nouveau compte
        const magicToken = randomBytes(32).toString('hex')
        await prisma.user.update({
          where: { id: guestUser.id },
          data: {
            magicToken,
            magicTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
          } as any,
        })
      }

      userId = guestUser.id
      isGuest = true
    }
    const validated = placeBidSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.errors[0].message }, { status: 400 })
    }

    const { amount, isAutoBid, maxAutoBid } = validated.data

    // Récupérer l'enchère avec le beat
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        beat: {
          select: {
            producerId: true,
            title: true,
            producer: true,
          },
        },
      },
    })

    if (!auction) {
      return NextResponse.json({ error: 'Enchere introuvable' }, { status: 404 })
    }

    const licenseType = auction.licenseType

    // Verifications
    if (auction.status !== 'ACTIVE' && auction.status !== 'ENDING_SOON') {
      return NextResponse.json({ error: "Cette enchère n'est plus active" }, { status: 400 })
    }

    if (auction.endTime < new Date()) {
      return NextResponse.json({ error: 'Cette enchère est terminée' }, { status: 400 })
    }

    if (auction.beat.producerId === userId) {
      return NextResponse.json(
        { error: 'Tu ne peux pas encherir sur ton propre beat' },
        { status: 400 }
      )
    }

    const producerAccess = await enforceProducerStripeAccess(auction.beat.producer)
    if (!producerAccess.allowed) {
      return NextResponse.json(
        {
          error:
            'Cette enchère est temporairement indisponible pendant la régularisation Stripe du beatmaker.',
          code: 'PRODUCER_STRIPE_SUSPENDED',
        },
        { status: 409 }
      )
    }

    if (amount < auction.currentBid + auction.bidIncrement) {
      const minimumBid = auction.currentBid + auction.bidIncrement
      return NextResponse.json(
        {
          error: `La mise minimale est maintenant de ${minimumBid} EUR`,
          code: 'BID_TOO_LOW',
          minimumBid,
        },
        { status: 409 }
      )
    }

    // Calculer le prix final avec le multiplicateur de licence
    const finalAmount = calculateFinalPrice(amount, licenseType)

    // Creer l'enchère dans une transaction avec re-validation
    const result = await prisma.$transaction(async (tx) => {
      // BUG FIX 6: Re-lire l'enchère dans la transaction pour eviter la race condition
      const freshAuction = await tx.auction.findUnique({
        where: { id: auctionId },
        select: {
          currentBid: true,
          bidIncrement: true,
          status: true,
          endTime: true,
          antiSnipeMinutes: true,
          antiSnipeExtension: true,
          beat: {
            select: {
              producer: { select: { producerStatus: true } },
            },
          },
        },
      })
      if (!freshAuction) throw new Error('Enchere introuvable')
      if (freshAuction.status !== 'ACTIVE' && freshAuction.status !== 'ENDING_SOON') {
        throw new Error("Cette enchère n'est plus active")
      }
      if (freshAuction.endTime < new Date()) {
        throw new Error('Cette enchère est terminée')
      }
      if (freshAuction.beat.producer.producerStatus !== 'APPROVED') {
        throw new Error('PRODUCER_STRIPE_SUSPENDED')
      }
      if (amount < freshAuction.currentBid + freshAuction.bidIncrement) {
        throw new Error(`BID_TOO_LOW:${freshAuction.currentBid + freshAuction.bidIncrement}`)
      }

      // Lire le leader actuel dans la même transaction que la nouvelle mise.
      // Ainsi, même avec deux enchères presque simultanées, seule la personne
      // réellement dépassée reçoit l'alerte.
      const previousBid = await tx.bid.findFirst({
        where: { auctionId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          amount: true,
          userId: true,
          user: {
            select: {
              email: true,
              name: true,
              displayName: true,
              notifEmail: true,
              notifBid: true,
            },
          },
        },
      })

      // Creer le bid
      const bid = await tx.bid.create({
        data: {
          amount,
          licenseType,
          finalAmount,
          isAutoBid,
          maxAutoBid,
          auctionId,
          userId,
        },
      })

      const millisecondsRemaining = freshAuction.endTime.getTime() - Date.now()
      const extendedEndTime =
        millisecondsRemaining < freshAuction.antiSnipeMinutes * 60000
          ? new Date(freshAuction.endTime.getTime() + freshAuction.antiSnipeExtension * 60000)
          : freshAuction.endTime

      // Mise à jour optimiste : si le cron ou une autre mise a changé
      // l'enchère depuis la relecture, toute la transaction est annulée.
      const updateResult = await tx.auction.updateMany({
        where: {
          id: auctionId,
          currentBid: freshAuction.currentBid,
          status: { in: ['ACTIVE', 'ENDING_SOON'] },
          endTime: freshAuction.endTime,
        },
        data: {
          currentBid: amount,
          totalBids: { increment: 1 },
          endTime: extendedEndTime,
          // Mettre en ENDING_SOON si moins de 10 min
          status: millisecondsRemaining < 600000 ? 'ENDING_SOON' : freshAuction.status,
        },
      })

      if (updateResult.count === 0) {
        throw new Error('AUCTION_CHANGED')
      }

      const updatedAuction = await tx.auction.findUniqueOrThrow({
        where: { id: auctionId },
      })

      // Notifier le précédent enchérisseur qu'il a été surenchéri
      if (previousBid && previousBid.userId !== userId && previousBid.user.notifBid) {
        await tx.notification.create({
          data: {
            userId: previousBid.userId,
            type: 'OUTBID',
            title: 'Ton enchère a été dépassée',
            message: `Ton offre de ${previousBid.amount} EUR sur "${auction.beat.title}" a été dépassée par une enchère de ${amount} EUR.`,
            link: `/auction/${auctionId}`,
          },
        })
      }

      // Notifier le producteur
      await tx.notification.create({
        data: {
          userId: auction.beat.producerId,
          type: 'BID_PLACED',
          title: 'Nouvelle enchère !',
          message: `${amount}EUR sur "${auction.beat.title}" (${licenseType})`,
          link: `/auction/${auctionId}`,
        },
      })

      // SECURITY FIX M7: Collecter les infos pour email hors transaction
      const outbidEmailData =
        previousBid &&
        previousBid.userId !== userId &&
        previousBid.user.notifBid &&
        previousBid.user.notifEmail &&
        previousBid.user.email
          ? {
              email: previousBid.user.email,
              name: previousBid.user.displayName || previousBid.user.name || '',
              yourBid: previousBid.amount,
            }
          : null

      const outbidUserId =
        previousBid &&
        previousBid.userId !== userId &&
        previousBid.user.notifBid
          ? previousBid.userId
          : null

      return { bid, auction: updatedAuction, outbidEmailData, outbidUserId }
    })

    // Envoyer l'email hors transaction, mais l'attendre : Vercel peut couper
    // une promesse laissée en arrière-plan dès que la réponse HTTP est partie.
    if (result.outbidEmailData) {
      try {
        const emailResult = await sendOutbidEmail({
          to: result.outbidEmailData.email,
          userName: result.outbidEmailData.name,
          beatTitle: auction.beat.title,
          yourBid: result.outbidEmailData.yourBid,
          newBid: amount,
          auctionId,
        })
        if (!emailResult.success) {
          console.warn('[BID] Email de surenchère non envoyé:', emailResult)
        }
      } catch (error) {
        console.warn('[BID] Erreur envoi email de surenchère:', String(error))
      }
    }

    // Push téléphone : même si l'envoi échoue, la mise reste validée.
    if (result.outbidUserId) {
      try {
        const pushResult = await sendPushToUser(result.outbidUserId, {
          title: 'Ton enchère a été dépassée',
          body: `${amount} EUR est maintenant l’offre la plus élevée sur « ${auction.beat.title} ».`,
          url: `/auction/${auctionId}`,
          tag: `outbid-${auctionId}`,
        })
        if (pushResult.failed > 0) {
          console.warn('[BID] Certains push de surenchère ont échoué:', pushResult)
        }
      } catch (error) {
        console.warn('[BID] Erreur notification push de surenchère:', String(error))
      }
    }

    // Email admin pour chaque nouvelle enchere
    try {
      const bidAdmins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { email: true },
      })
      const bidderName = (session?.user as any)?.name || 'Encherisseur'
      for (const a of bidAdmins) {
        if (a.email) {
          sendAdminNewBidEmail({
            adminEmail: a.email,
            bidderName,
            beatTitle: auction.beat.title,
            amount,
            licenseType,
            auctionId,
          }).catch((err) => console.error('Email admin bid echoue:', err))
        }
      }
    } catch (e) {
      console.warn('[BID] Erreur email admin:', String(e))
    }

    return NextResponse.json({
      message: 'Enchère placée avec succès',
      bid: result.bid,
      auction: {
        currentBid: result.auction.currentBid,
        totalBids: result.auction.totalBids,
        endTime: result.auction.endTime,
      },
      ...(isGuest && { isGuest: true, guestUserId: userId }),
    })
  } catch (error) {
    const msg = String(error)
    if (msg.includes('BID_TOO_LOW:')) {
      const minimumBid = Number(msg.split('BID_TOO_LOW:')[1])
      return NextResponse.json(
        {
          error: `La mise minimale est maintenant de ${minimumBid} EUR`,
          code: 'BID_TOO_LOW',
          minimumBid,
        },
        { status: 409 }
      )
    }
    if (msg.includes('AUCTION_CHANGED')) {
      return NextResponse.json(
        {
          error: "L'enchère vient d'être mise à jour. Réessaie avec le nouveau montant.",
          code: 'AUCTION_CHANGED',
        },
        { status: 409 }
      )
    }
    if (msg.includes('PRODUCER_STRIPE_SUSPENDED')) {
      return NextResponse.json(
        {
          error:
            'Cette enchère est temporairement indisponible pendant la régularisation Stripe du beatmaker.',
          code: 'PRODUCER_STRIPE_SUSPENDED',
        },
        { status: 409 }
      )
    }
    // BUG FIX 6: Retourner 400 pour les erreurs de validation de la transaction
    if (msg.includes('plus active') || msg.includes('terminée')) {
      return NextResponse.json({ error: msg.replace('Error: ', '') }, { status: 400 })
    }
    console.error('Erreur placement enchère:', msg)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
