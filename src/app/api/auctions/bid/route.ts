export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { placeBidSchema } from '@/lib/validations'
import { calculateFinalPrice } from '@/lib/stripe'
import { sendOutbidEmail } from '@/lib/emails/resend'

// POST /api/auctions/bid?auctionId=xxx - Placer une enchere
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { searchParams } = new URL(request.url)
    const auctionId = searchParams.get('auctionId')

    if (!auctionId) {
      return NextResponse.json({ error: 'auctionId requis' }, { status: 400 })
    }

    const body = await request.json()
    const validated = placeBidSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.errors[0].message }, { status: 400 })
    }

    const { amount, isAutoBid, maxAutoBid } = validated.data
    const licenseType = 'EXCLUSIVE' // Encheres = licence exclusive uniquement

    // Recuperer l'enchere avec le beat
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
      return NextResponse.json({ error: "Cette enchere n'est plus active" }, { status: 400 })
    }

    if (auction.endTime < new Date()) {
      return NextResponse.json({ error: 'Cette enchere est terminee' }, { status: 400 })
    }

    if (auction.beat.producerId === userId) {
      return NextResponse.json(
        { error: 'Tu ne peux pas encherir sur ton propre beat' },
        { status: 400 }
      )
    }

    if (amount < auction.currentBid + auction.bidIncrement) {
      return NextResponse.json(
        { error: `L'enchere minimum est de ${auction.currentBid + auction.bidIncrement}EUR` },
        { status: 400 }
      )
    }

    // Calculer le prix final avec le multiplicateur de licence
    const finalAmount = calculateFinalPrice(amount, licenseType)

    // Creer l'enchere dans une transaction avec re-validation
    const result = await prisma.$transaction(async (tx) => {
      // BUG FIX 6: Re-lire l'enchere dans la transaction pour eviter la race condition
      const freshAuction = await tx.auction.findUnique({
        where: { id: auctionId },
        select: { currentBid: true, bidIncrement: true, status: true, endTime: true },
      })
      if (!freshAuction) throw new Error('Enchere introuvable')
      if (freshAuction.status !== 'ACTIVE' && freshAuction.status !== 'ENDING_SOON') {
        throw new Error("Cette enchere n'est plus active")
      }
      if (freshAuction.endTime < new Date()) {
        throw new Error('Cette enchere est terminee')
      }
      if (amount < freshAuction.currentBid + freshAuction.bidIncrement) {
        throw new Error(`L'enchere minimum est de ${freshAuction.currentBid + freshAuction.bidIncrement}EUR`)
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

      // Mettre a jour l'enchere
      const updatedAuction = await tx.auction.update({
        where: { id: auctionId },
        data: {
          currentBid: amount,
          totalBids: { increment: 1 },
          // Anti-snipe: si l'enchere est dans les 2 dernieres minutes, on ajoute du temps
          endTime:
            auction.endTime.getTime() - Date.now() < auction.antiSnipeMinutes * 60000
              ? new Date(auction.endTime.getTime() + auction.antiSnipeExtension * 60000)
              : auction.endTime,
          // Mettre en ENDING_SOON si moins de 10 min
          status: auction.endTime.getTime() - Date.now() < 600000 ? 'ENDING_SOON' : auction.status,
        },
      })

      // Notifier le precedent encherisseur qu'il a ete surencheri
      const previousBidder = auction.bids[0]
      if (previousBidder && previousBidder.userId !== userId) {
        await tx.notification.create({
          data: {
            userId: previousBidder.userId,
            type: 'OUTBID',
            title: 'Surenchere !',
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
          title: 'Nouvelle enchere !',
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
      message: 'Enchere placee avec succes',
      bid: result.bid,
      auction: {
        currentBid: result.auction.currentBid,
        totalBids: result.auction.totalBids,
        endTime: result.auction.endTime,
      },
    })
  } catch (error) {
    const msg = String(error)
    // BUG FIX 6: Retourner 400 pour les erreurs de validation de la transaction
    if (msg.includes('enchere minimum') || msg.includes('plus active') || msg.includes('terminee')) {
      return NextResponse.json({ error: msg.replace('Error: ', '') }, { status: 400 })
    }
    console.error('Erreur placement enchere:', msg)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
