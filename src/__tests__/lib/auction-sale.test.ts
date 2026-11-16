import { beforeEach, describe, expect, it, vi } from 'vitest'

const { tx, prismaMock } = vi.hoisted(() => {
  const tx = {
    auction: { findUnique: vi.fn(), updateMany: vi.fn() },
    purchase: { findFirst: vi.fn(), create: vi.fn() },
    beat: { update: vi.fn() },
    user: { update: vi.fn(), findUnique: vi.fn() },
    notification: { create: vi.fn(), createMany: vi.fn() },
    bid: { findMany: vi.fn() },
  }
  return {
    tx,
    prismaMock: { $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/emails/resend', () => ({
  sendPaymentReceivedEmail: vi.fn(),
  sendPurchaseConfirmedEmail: vi.fn(),
  sendNtfy: vi.fn(),
}))
vi.mock('@/lib/license-contract', () => ({
  generateLicenseContractPdf: vi.fn(),
  getContractFileName: vi.fn(),
}))

import { completeAuctionSale } from '@/lib/auction-sale'

const baseAuction = {
  id: 'auction-1',
  beatId: 'beat-1',
  status: 'ACTIVE',
  currentBid: 80,
  finalPrice: null,
  buyNowPrice: 300,
  licenseType: 'BASIC',
  winningLicense: null,
  winnerId: null,
  winner: null,
  stripePaymentId: 'pi_buyer',
  commissionAmount: 45,
  producerPayout: 255,
  beat: { id: 'beat-1', title: 'Night Show', producerId: 'producer-1', producer: {} },
}

describe('completeAuctionSale', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.purchase.findFirst.mockResolvedValue(null)
    tx.purchase.create.mockImplementation(async ({ data }: any) => ({ id: 'purchase-1', ...data }))
    tx.user.findUnique.mockResolvedValue({ id: 'buyer-1', email: 'buyer@example.com' })
    tx.bid.findMany.mockResolvedValue([{ userId: 'bidder-2' }])
  })

  it('finalise un achat immédiat : gagnant, beat vendu, Purchase et notifications dans la même transaction', async () => {
    tx.auction.findUnique.mockResolvedValue(baseAuction)
    tx.auction.updateMany.mockResolvedValue({ count: 1 })

    const result = await completeAuctionSale({
      auctionId: 'auction-1',
      paymentIntentId: 'pi_buyer',
      buyerId: 'buyer-1',
      buyNow: true,
    })

    expect(result.outcome).toBe('COMPLETED')
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.auction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'auction-1', status: { not: 'COMPLETED' } },
        data: expect.objectContaining({
          status: 'COMPLETED',
          winnerId: 'buyer-1',
          finalPrice: 300,
          winningLicense: 'EXCLUSIVE',
          stripePaymentId: 'pi_buyer',
        }),
      })
    )
    expect(tx.beat.update).toHaveBeenCalledWith({
      where: { id: 'beat-1' },
      data: { status: 'SOLD' },
    })
    expect(tx.purchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        buyerId: 'buyer-1',
        amount: 300,
        licenseType: 'EXCLUSIVE',
        stripePaymentId: 'pi_buyer',
        auctionId: 'auction-1',
      }),
    })
    expect(tx.notification.createMany).toHaveBeenCalledTimes(1)
  })

  it("ne finalise qu'une fois quand deux appels arrivent en même temps", async () => {
    tx.auction.findUnique.mockResolvedValue(baseAuction)
    tx.auction.updateMany.mockResolvedValue({ count: 0 })

    const result = await completeAuctionSale({
      auctionId: 'auction-1',
      paymentIntentId: 'pi_buyer',
      buyerId: 'buyer-1',
      buyNow: true,
    })

    expect(result.outcome).toBe('ALREADY_COMPLETED')
    expect(tx.purchase.create).not.toHaveBeenCalled()
    expect(tx.beat.update).not.toHaveBeenCalled()
    expect(tx.user.update).not.toHaveBeenCalled()
  })

  it('ne recrée rien quand le même paiement est rejoué', async () => {
    tx.auction.findUnique.mockResolvedValue({
      ...baseAuction,
      status: 'COMPLETED',
      winnerId: 'buyer-1',
    })
    tx.purchase.findFirst.mockResolvedValue({ id: 'purchase-1', buyerId: 'buyer-1' })

    const result = await completeAuctionSale({
      auctionId: 'auction-1',
      paymentIntentId: 'pi_buyer',
      buyerId: 'buyer-1',
      buyNow: true,
    })

    expect(result.outcome).toBe('ALREADY_COMPLETED')
    expect(tx.auction.updateMany).not.toHaveBeenCalled()
    expect(tx.purchase.create).not.toHaveBeenCalled()
  })

  it("signale un conflit quand l'enchère est déjà vendue avec un autre paiement", async () => {
    tx.auction.findUnique.mockResolvedValue({
      ...baseAuction,
      status: 'COMPLETED',
      winnerId: 'buyer-1',
      stripePaymentId: 'pi_buyer',
    })

    const result = await completeAuctionSale({
      auctionId: 'auction-1',
      paymentIntentId: 'pi_second_buyer',
      buyerId: 'buyer-2',
      buyNow: true,
    })

    expect(result.outcome).toBe('CONFLICT')
    expect(tx.purchase.create).not.toHaveBeenCalled()
  })

  it("répare une vente finalisée sans Purchase (ancien chemin d'achat immédiat)", async () => {
    tx.auction.findUnique.mockResolvedValue({
      ...baseAuction,
      status: 'COMPLETED',
      winnerId: 'buyer-1',
      finalPrice: 300,
      winningLicense: 'EXCLUSIVE',
    })

    const result = await completeAuctionSale({
      auctionId: 'auction-1',
      paymentIntentId: 'pi_buyer',
      buyerId: 'buyer-1',
      buyNow: true,
    })

    expect(result.outcome).toBe('COMPLETED')
    expect(tx.auction.updateMany).not.toHaveBeenCalled()
    expect(tx.user.update).not.toHaveBeenCalled()
    expect(tx.purchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        buyerId: 'buyer-1',
        amount: 300,
        stripePaymentId: 'pi_buyer',
      }),
    })
  })

  it('refuse un achat immédiat sans acheteur identifié', async () => {
    tx.auction.findUnique.mockResolvedValue(baseAuction)

    const result = await completeAuctionSale({
      auctionId: 'auction-1',
      paymentIntentId: 'pi_buyer',
      buyNow: true,
    })

    expect(result.outcome).toBe('CONFLICT')
    expect(tx.auction.updateMany).not.toHaveBeenCalled()
  })
})
