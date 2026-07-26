import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, getServerSessionMock, enforceProducerStripeAccessMock } = vi.hoisted(
  () => ({
    prismaMock: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      auction: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    getServerSessionMock: vi.fn(),
    enforceProducerStripeAccessMock: vi.fn(),
  })
)

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('next-auth', () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/stripe', () => ({
  calculateFinalPrice: vi.fn((amount: number) => amount),
}))

vi.mock('@/lib/emails/resend', () => ({
  sendOutbidEmail: vi.fn(),
  sendAdminNewBidEmail: vi.fn(),
}))

vi.mock('@/lib/web-push', () => ({
  sendPushToUser: vi.fn(),
}))

vi.mock('@/lib/producer-stripe-access', () => ({
  enforceProducerStripeAccess: enforceProducerStripeAccessMock,
}))

import { POST } from '@/app/api/auctions/bid/route'

describe('POST /api/auctions/bid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({
      user: { id: 'artist-1' },
    })
    enforceProducerStripeAccessMock.mockResolvedValue({ allowed: true })
  })

  it('requires an auction identifier', async () => {
    const response = await POST(
      new Request('http://localhost/api/auctions/bid', {
        method: 'POST',
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'auctionId requis' })
  })

  it('requires authentication or a guest email', async () => {
    getServerSessionMock.mockResolvedValue(null)

    const response = await POST(
      new Request('http://localhost/api/auctions/bid?auctionId=auction-1', {
        method: 'POST',
        body: JSON.stringify({ amount: 110 }),
      })
    )

    expect(response.status).toBe(401)
    expect(prismaMock.auction.findUnique).not.toHaveBeenCalled()
  })

  it('rejects an invalid guest email', async () => {
    getServerSessionMock.mockResolvedValue(null)

    const response = await POST(
      new Request('http://localhost/api/auctions/bid?auctionId=auction-1', {
        method: 'POST',
        body: JSON.stringify({
          amount: 110,
          guestEmail: 'email-invalide',
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('rejects an invalid amount before loading the auction', async () => {
    const response = await POST(
      new Request('http://localhost/api/auctions/bid?auctionId=auction-1', {
        method: 'POST',
        body: JSON.stringify({ amount: -1 }),
      })
    )

    expect(response.status).toBe(400)
    expect(prismaMock.auction.findUnique).not.toHaveBeenCalled()
  })

  it('returns 404 when the auction does not exist', async () => {
    prismaMock.auction.findUnique.mockResolvedValue(null)

    const response = await POST(
      new Request('http://localhost/api/auctions/bid?auctionId=missing', {
        method: 'POST',
        body: JSON.stringify({ amount: 110 }),
      })
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Enchere introuvable' })
  })

  it('prevents a producer from bidding on their own beat', async () => {
    prismaMock.auction.findUnique.mockResolvedValue({
      id: 'auction-1',
      status: 'ACTIVE',
      endTime: new Date(Date.now() + 60_000),
      currentBid: 100,
      bidIncrement: 5,
      licenseType: 'EXCLUSIVE',
      beat: {
        producerId: 'artist-1',
        title: 'Mon beat',
        producer: { producerStatus: 'APPROVED' },
      },
    })

    const response = await POST(
      new Request('http://localhost/api/auctions/bid?auctionId=auction-1', {
        method: 'POST',
        body: JSON.stringify({ amount: 110 }),
      })
    )

    expect(response.status).toBe(400)
    expect(enforceProducerStripeAccessMock).not.toHaveBeenCalled()
  })

  it('returns the new minimum when a bid is too low', async () => {
    prismaMock.auction.findUnique.mockResolvedValue({
      id: 'auction-1',
      status: 'ACTIVE',
      endTime: new Date(Date.now() + 60_000),
      currentBid: 100,
      bidIncrement: 5,
      licenseType: 'EXCLUSIVE',
      beat: {
        producerId: 'producer-1',
        title: 'Beat test',
        producer: { producerStatus: 'APPROVED' },
      },
    })

    const response = await POST(
      new Request('http://localhost/api/auctions/bid?auctionId=auction-1', {
        method: 'POST',
        body: JSON.stringify({ amount: 102 }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('BID_TOO_LOW')
    expect(body.minimumBid).toBe(105)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
