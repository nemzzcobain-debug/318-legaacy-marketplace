import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { sendPaymentReceivedEmail, sendPurchaseConfirmedEmail, sendNtfy } from '@/lib/emails/resend'
import {
  generateLicenseContractPdf,
  getContractFileName,
  type LicenseContractData,
} from '@/lib/license-contract'

/**
 * Finalisation d'une vente d'enchère (paiement d'enchère gagnée ou achat immédiat).
 *
 * Point d'entrée UNIQUE partagé par le webhook Stripe et la route buy-now/confirm :
 * les deux peuvent arriver dans n'importe quel ordre, voire en même temps.
 * Toutes les écritures sont dans une seule transaction, et l'enchère est « réclamée »
 * par un updateMany conditionnel : une seule exécution peut la faire passer à COMPLETED.
 */

const AUCTION_SALE_INCLUDE = {
  beat: { include: { producer: true } },
  winner: true,
} satisfies Prisma.AuctionInclude

type AuctionWithSaleRelations = Prisma.AuctionGetPayload<{ include: typeof AUCTION_SALE_INCLUDE }>
type PurchaseRow = Prisma.PurchaseGetPayload<object>
type UserRow = Prisma.UserGetPayload<object>

export type CompleteAuctionSaleInput = {
  auctionId: string
  paymentIntentId: string
  /** Acheteur connu de l'appelant (obligatoire pour un achat immédiat). */
  buyerId?: string | null
  /** true = achat immédiat : l'acheteur devient gagnant au prix buyNowPrice. */
  buyNow?: boolean
  commission?: number
  producerPayout?: number
}

export type CompleteAuctionSaleResult =
  | {
      outcome: 'COMPLETED'
      auction: AuctionWithSaleRelations
      purchase: PurchaseRow | null
      buyer: UserRow | null
      amount: number
      commission: number
      producerPayout: number
      licenseType: string
    }
  | { outcome: 'ALREADY_COMPLETED'; purchase: PurchaseRow | null }
  | { outcome: 'CONFLICT'; reason: string }
  | { outcome: 'NOT_FOUND' }

export async function completeAuctionSale(
  input: CompleteAuctionSaleInput
): Promise<CompleteAuctionSaleResult> {
  const { auctionId, paymentIntentId, buyNow = false } = input

  return prisma.$transaction(async (tx) => {
    const auction = await tx.auction.findUnique({
      where: { id: auctionId },
      include: AUCTION_SALE_INCLUDE,
    })
    if (!auction) return { outcome: 'NOT_FOUND' }

    const buyerId = buyNow ? input.buyerId || null : auction.winnerId || input.buyerId || null

    if (buyNow && !buyerId) {
      return { outcome: 'CONFLICT', reason: 'Achat immédiat sans acheteur identifié' }
    }

    const existingForPayment = await tx.purchase.findFirst({
      where: { stripePaymentId: paymentIntentId },
    })

    // ── Enchère déjà finalisée ──
    if (auction.status === 'COMPLETED') {
      if (existingForPayment) return { outcome: 'ALREADY_COMPLETED', purchase: existingForPayment }

      const sameSale =
        auction.stripePaymentId === paymentIntentId &&
        (!auction.winnerId || !buyerId || auction.winnerId === buyerId)
      if (!sameSale) {
        return {
          outcome: 'CONFLICT',
          reason: 'Enchère déjà vendue avec un autre paiement',
        }
      }

      // Même vente, mais aucun Purchase (ancien chemin buy-now/confirm) : on répare.
      const purchaseBuyerId = auction.winnerId || buyerId
      const anyPurchase = purchaseBuyerId
        ? await tx.purchase.findFirst({
            where: { auctionId, buyerId: purchaseBuyerId, status: 'COMPLETED' },
          })
        : null
      if (anyPurchase || !purchaseBuyerId) {
        return { outcome: 'ALREADY_COMPLETED', purchase: anyPurchase }
      }

      const amount = auction.finalPrice || auction.currentBid
      const commission = input.commission ?? auction.commissionAmount ?? 0
      const producerPayout = input.producerPayout ?? auction.producerPayout ?? 0
      const licenseType = auction.winningLicense || auction.licenseType
      const purchase = await tx.purchase.create({
        data: {
          buyerId: purchaseBuyerId,
          beatId: auction.beatId,
          type: 'AUCTION',
          licenseType,
          amount,
          commission,
          producerPayout,
          stripePaymentId: paymentIntentId,
          status: 'COMPLETED',
          auctionId,
        },
      })
      const buyer =
        auction.winner?.id === purchaseBuyerId
          ? auction.winner
          : await tx.user.findUnique({ where: { id: purchaseBuyerId } })
      return {
        outcome: 'COMPLETED',
        auction,
        purchase,
        buyer,
        amount,
        commission,
        producerPayout,
        licenseType,
      }
    }

    // ── Enchère pas encore finalisée ──
    if (existingForPayment) {
      // Ce paiement a déjà servi à un autre achat : ne rien finaliser une seconde fois.
      return { outcome: 'ALREADY_COMPLETED', purchase: existingForPayment }
    }
    if (buyNow && auction.winnerId && auction.winnerId !== buyerId) {
      return { outcome: 'CONFLICT', reason: "L'enchère a déjà un autre gagnant" }
    }
    if (buyNow && !auction.buyNowPrice) {
      return { outcome: 'CONFLICT', reason: "Pas de prix d'achat immédiat sur cette enchère" }
    }

    const now = new Date()
    const amount = buyNow
      ? (auction.buyNowPrice as number)
      : auction.finalPrice || auction.currentBid
    const commission = input.commission ?? auction.commissionAmount ?? 0
    const producerPayout = input.producerPayout ?? auction.producerPayout ?? 0
    const licenseType = buyNow ? 'EXCLUSIVE' : auction.winningLicense || auction.licenseType

    // Réclamation atomique : un seul appel concurrent peut passer l'enchère à COMPLETED.
    const claim = await tx.auction.updateMany({
      where: { id: auctionId, status: { not: 'COMPLETED' } },
      data: {
        status: 'COMPLETED',
        paidAt: now,
        stripePaymentId: paymentIntentId,
        commissionAmount: commission,
        producerPayout,
        ...(buyNow
          ? {
              winnerId: buyerId,
              finalPrice: amount,
              winningLicense: 'EXCLUSIVE',
              endTime: now,
            }
          : {}),
      },
    })
    if (claim.count !== 1) {
      const purchase = await tx.purchase.findFirst({ where: { stripePaymentId: paymentIntentId } })
      return { outcome: 'ALREADY_COMPLETED', purchase }
    }

    await tx.beat.update({ where: { id: auction.beatId }, data: { status: 'SOLD' } })

    await tx.user.update({
      where: { id: auction.beat.producerId },
      data: { totalSales: { increment: 1 } },
    })

    let purchase: PurchaseRow | null = null
    let buyer: UserRow | null = null
    if (buyerId) {
      buyer =
        auction.winner?.id === buyerId
          ? auction.winner
          : await tx.user.findUnique({ where: { id: buyerId } })

      await tx.user.update({
        where: { id: buyerId },
        data: { totalPurchases: { increment: 1 } },
      })

      purchase = await tx.purchase.create({
        data: {
          buyerId,
          beatId: auction.beatId,
          type: 'AUCTION',
          licenseType,
          amount,
          commission,
          producerPayout,
          stripePaymentId: paymentIntentId,
          status: 'COMPLETED',
          auctionId,
        },
      })

      await tx.notification.create({
        data: {
          type: 'AUCTION_WON',
          title: buyNow ? 'Achat confirmé !' : 'Paiement confirmé !',
          message: `Votre achat de "${auction.beat.title}" est confirmé. Vous pouvez télécharger votre beat.`,
          link: '/dashboard?tab=purchases',
          userId: buyerId,
        },
      })
    }

    await tx.notification.create({
      data: {
        type: 'PAYMENT_RECEIVED',
        title: 'Paiement reçu !',
        message: `Votre beat "${auction.beat.title}" a été vendu pour ${amount}€. Votre part: ${producerPayout}€`,
        link: '/dashboard?tab=earnings',
        userId: auction.beat.producerId,
      },
    })

    if (buyNow) {
      const otherBidders = await tx.bid.findMany({
        where: { auctionId, ...(buyerId ? { userId: { not: buyerId } } : {}) },
        select: { userId: true },
        distinct: ['userId'],
      })
      if (otherBidders.length > 0) {
        await tx.notification.createMany({
          data: otherBidders.map((b) => ({
            type: 'AUCTION_ENDED',
            title: `Enchère terminée — "${auction.beat.title}"`,
            message: `L'enchère sur "${auction.beat.title}" s'est terminée par un achat immédiat.`,
            link: `/auction/${auctionId}`,
            userId: b.userId,
          })),
        })
      }
    }

    return {
      outcome: 'COMPLETED',
      auction,
      purchase,
      buyer,
      amount,
      commission,
      producerPayout,
      licenseType,
    }
  })
}

/**
 * Effets externes (ntfy + emails + contrat PDF) d'une vente finalisée.
 * À appeler uniquement quand completeAuctionSale renvoie COMPLETED, hors transaction.
 * Ne jette jamais : un email raté ne doit pas faire rejouer un paiement.
 */
export function sendAuctionSaleMessages(
  sale: Extract<CompleteAuctionSaleResult, { outcome: 'COMPLETED' }>
) {
  const { auction, purchase, buyer, amount, commission, producerPayout, licenseType } = sale
  const producer = auction.beat.producer

  try {
    sendNtfy('Vente finalisee', `${auction.beat.title} vendu pour ${amount} EUR`, 'high').catch(
      () => {}
    )

    if (producer?.email) {
      sendPaymentReceivedEmail({
        to: producer.email,
        producerName: producer.displayName || producer.name,
        beatTitle: auction.beat.title,
        buyerName: buyer?.displayName || buyer?.name || 'Acheteur',
        finalPrice: amount,
        commission,
        payout: producerPayout,
        license: licenseType,
      }).catch((e) => logger.error('[VENTE] Erreur envoi email producteur:', { error: e?.message }))
    }

    if (purchase && buyer?.email) {
      const contractData: LicenseContractData = {
        purchaseId: purchase.id,
        purchaseType: purchase.type,
        transactionId: purchase.stripePaymentId,
        purchasedAt: purchase.createdAt,
        amount: purchase.amount,
        licenseType: purchase.licenseType,
        buyer: { name: buyer.displayName || buyer.name, email: buyer.email },
        producer: {
          name: producer?.displayName || producer?.name || 'Producteur',
          email: producer?.email || '',
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
        producerName: producer?.displayName || producer?.name || 'Producteur',
        licenseType: purchase.licenseType,
        finalPrice: purchase.amount,
        purchaseId: purchase.id,
        contractAttachment: {
          filename: getContractFileName(contractData),
          content: contractPdf,
        },
      }).catch((e) => logger.error('[VENTE] Erreur envoi contrat acheteur:', { error: e?.message }))
    }
  } catch (e: any) {
    logger.error('[VENTE] Erreur messages de vente:', { error: e?.message })
  }
}
