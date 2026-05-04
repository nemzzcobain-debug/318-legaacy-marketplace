export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { placeBidSchema } from '@/lib/validations'
import { calculateFinalPrice } from '@/lib/stripe'
import { sendOutbidEmail } from '@/lib/emails/resend'
import { randomBytes } from 'crypto'

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
    const licenseType = 'EXCLUSIVE' // Encheres = licence exclusive uniquement

    // Récupérer l'enchère avec le beat
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        beat: { select: { producerId: true, title: true } },
        bids: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { userId: true },
        },
      },
    })

    if (!auction) {
      return NextResponse.json({ error: 'Enchere introuvable' }, { status: 404 })
    }

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

    if (amount < auction.currentBid + auction.bidIncrement) {
      return NextResponse.json(
        { error: `L'enchère minimum est de ${auction.currentBid + auction.bidIncrement}EUR` },
        { status: 400 }
      )
    }

    // Calculer le prix final avec le multiplicateur de licence
    const finalAmount = calculateFinalPrice(amount, licenseType)

    // Creer l'enchère dans une transaction avec re-validation
    const result = await prisma.$transaction(async (tx) => {
      // BUG FIX 6: Re-lire l'enchère dans la transaction pour eviter la race condition
      const freshAuction = await tx.auction.findUnique({
        where: { id: auctionId },
        select: { currentBid: true, bidIncrement: true, status: true, endTime: true },
      })
      if (!freshAuction) throw new Error('Enchere introuvable')
      if (freshAuction.status !== 'ACTIVE' && freshAuction.status !== 'ENDING_SOON') {
        throw new Error("Cette enchère n'est plus active")
      }
      if (freshAuction.endTime < new Date()) {
        throw new Error('Cette enchère est terminée')
      }
      if (amount < freshAuction.currentBid + freshAuction.bidIncrement) {
        throw new Error(`L'enchère minimum est de ${freshAuction.currentBid + freshAuction.bidIncrement}EUR`)
      }

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

      // Mettre a jour l'enchère
      const updatedAuction = await tx.auction.update({
        where: { id: auctionId },
        data: {
          currentBid: amount,
          totalBids: { increment: 1 },
          // Anti-snipe: si l'enchère est dans les 2 dernières minutes, on ajoute du temps
          endTime:
            auction.endTime.getTime() - Date.now() < auction.antiSnipeMinutes * 60000
              ? new Date(auction.endTime.getTime() + auction.antiSnipeExtension * 60000)
              : auction.endTime,
          // Mettre en ENDING_SOON si moins de 10 min
          status: auction.endTime.getTime() - Date.now() < 600000 ? 'ENDING_SOON' : auction.status,
        },
      })

      // Notifier le précédent enchérisseur qu'il a été surenchéri
      const previousBidder = auction.bids[0]
      if (previousBidder && previousBidder.userId !== userId) {
        await tx.notification.create({
          data: {
            userId: previousBidder.userId,
            type: 'OUTBID',
            title: 'Surenchère !',
            message: `Quelqu'un a encherit ${amount}EUR sur "${auction.beat.title}"`,
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
      let outbidEmailData: { email: string; name: string } | null = null
      if (previousBidder && previousBidder.userId !== userId) {
        const prevUser = await tx.user.findUnique({
          where: { id: previousBidder.userId },
          select: { email: true, name: true, displayName: true },
        })
        if (prevUser?.email) {
          outbidEmailData = { email: prevUser.email, name: prevUser.displayName || prevUser.name || '' }
        }
      }

      return { bid, auction: updatedAuction, outbidEmailData }
    })

    // SECURITY FIX M7: Envoyer l'email HORS de la transaction avec logging
    if (result.outbidEmailData) {
      sendOutbidEmail({
        to: result.outbidEmailData.email,
        userName: result.outbidEmailData.name,
        beatTitle: auction.beat.title,
        yourBid: auction.currentBid,
        newBid: amount,
        auctionId,
      }).catch((err) => console.warn('[BID] Erreur envoi email outbid:', String(err)))
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
    // BUG FIX 6: Retourner 400 pour les erreurs de validation de la transaction
    if (msg.includes('enchère minimum') || msg.includes('plus active') || msg.includes('terminée')) {
      return NextResponse.json({ error: msg.replace('Error: ', '') }, { status: 400 })
    }
    console.error('Erreur placement enchère:', msg)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
