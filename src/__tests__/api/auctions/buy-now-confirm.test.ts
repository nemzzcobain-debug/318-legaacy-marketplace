import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { prismaMock, getServerSessionMock, retrieveMock, completeAuctionSaleMock } = vi.hoisted(
  () => ({
    prismaMock: { auction: { findUnique: vi.fn() } },
    getServerSessionMock: vi.fn(),
    retrieveMock: vi.fn(),
    completeAuctionSaleMock: vi.fn(),
  })
)

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/stripe', () => ({ stripe: { paymentIntents: { retrieve: retrieveMock } } }))
vi.mock('@/lib/auction-sale', () => ({
  completeAuctionSale: completeAuctionSaleMock,
  sendAuctionSaleMessages: vi.fn(),
}))

import { POST } from '@/app/api/auctions/[id]/buy-now/confirm/route'

const call = () =>
  POST(
    new NextRequest('http://localhost/api/auctions/auction-1/buy-now/confirm', { method: 'POST' }),
    {
      params: Promise.resolve({ id: 'auction-1' }),
    }
  )

describe('POST /api/auctions/[id]/buy-now/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({ user: { id: 'buyer-1', email: 'buyer@example.com' } })
    prismaMock.auction.findUnique.mockResolvedValue({
      id: 'auction-1',
      status: 'ACTIVE',
      buyNowPrice: 300,
      stripePaymentId: 'pi_1',
      winnerId: null,
    })
    retrieveMock.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      receipt_email: 'buyer@example.com',
      metadata: { auctionId: 'auction-1', buyerId: 'buyer-1', buyNow: 'true' },
    })
    completeAuctionSaleMock.mockResolvedValue({ outcome: 'ALREADY_COMPLETED', purchase: null })
  })

  it("refuse de déclarer gagnant un compte qui n'a pas payé", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'intrus', email: 'intrus@example.com' } })

    const response = await call()

    expect(response.status).toBe(403)
    expect(completeAuctionSaleMock).not.toHaveBeenCalled()
  })

  it('refuse un paiement qui concerne une autre enchère', async () => {
    retrieveMock.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      metadata: { auctionId: 'autre-enchere', buyerId: 'buyer-1' },
    })

    const response = await call()

    expect(response.status).toBe(403)
    expect(completeAuctionSaleMock).not.toHaveBeenCalled()
  })

  it('refuse tant que le paiement n’est pas réussi', async () => {
    retrieveMock.mockResolvedValue({ id: 'pi_1', status: 'processing', metadata: {} })

    const response = await call()

    expect(response.status).toBe(402)
    expect(completeAuctionSaleMock).not.toHaveBeenCalled()
  })

  it("finalise pour l'acheteur qui a payé", async () => {
    const response = await call()

    expect(response.status).toBe(200)
    expect(completeAuctionSaleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        auctionId: 'auction-1',
        paymentIntentId: 'pi_1',
        buyerId: 'buyer-1',
        buyNow: true,
      })
    )
  })

  it('répond succès si le webhook a déjà finalisé la vente pour ce même acheteur', async () => {
    prismaMock.auction.findUnique.mockResolvedValue({
      id: 'auction-1',
      status: 'COMPLETED',
      buyNowPrice: 300,
      stripePaymentId: 'pi_1',
      winnerId: 'buyer-1',
    })

    const response = await call()

    expect(response.status).toBe(200)
    expect(retrieveMock).not.toHaveBeenCalled()
  })
})
