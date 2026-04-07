import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/auctions/bid/route'
import { prismaMock } from '@/__mocks__/prisma'
import { getServerSessionMock } from '@/__mocks__/next-auth'

// Mock dependencies
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
}))

describe('POST /api/auctions/bid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should place a bid successfully for authenticated user', async () => {
    const userId = 'user-123'
    const auctionId = 'auction-456'

    getServerSessionMock.mockResolvedValueOnce({
      user: {
        id: userId,
        email: 'bidder@example.com',
        name: 'Bidder User',
      },
    })

    const now = Date.now()
    const endTime = new Date(now + 1000 * 60 * 30) // 30 minutes from now

    prismaMock.auction.findUnique.mockResolvedValueOnce({
      id: auctionId,
      status: 'ACTIVE',
      endTime,
      currentBid: 100,
      bidIncrement: 5,
      antiSnipeMinutes: 2,
      antiSnipeExtension: 5,
      beat: {
        producerId: 'producer-123',
        title: 'Epic Beat',
      },
      bids: [
        {
          userId: 'old-bidder-123',
        },
      ],
    })

    prismaMock.$transaction.mockImplementationOnce(async (callback) => {
      const txResult = await callback(prismaMock)
      return txResult
    })

    prismaMock.bid.create.mockResolvedValueOnce({
      id: 'bid-789',
      amount: 110,
      licenseType: 'BASIC',
      finalAmount: 110,
      auctionId,
      userId,
    })

    prismaMock.auction.update.mockResolvedValueOnce({
      id: auctionId,
      currentBid: 110,
      totalBids: 2,
      endTime,
    })

    prismaMock.notification.create.mockResolvedValue({ id: 'notif-1' })
    prismaMock.user.findUnique.mockResolvedValueOnce({
      email: 'old-bidder@example.com',
      name: 'Old Bidder',
    })

    const request = new Request(
      `http://localhost:3000/api/auctions/bid?auctionId=${auctionId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          amount: 110,
          licenseType: 'BASIC',
          isAutoBid: false,
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBe('Enchere placee avec succes')
    expect(data.bid).toBeDefined()
    expect(data.bid.amount).toBe(110)
    expect(prismaMock.bid.create).toHaveBeenCalled()
  })

  it('should return 401 for unauthenticated user', async () => {
    getServerSessionMock.mockResolvedValueOnce(null)

    const request = new Request(
      'http://localhost:3000/api/auctions/bid?auctionId=auction-456',
      {
        method: 'POST',
        body: JSON.stringify({
          amount: 110,
          licenseType: 'BASIC',
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Non authentifie')
    expect(prismaMock.auction.findUnique).not.toHaveBeenCalled()
  })

  it('should return 401 when session has no user', async () => {
    getServerSessionMock.mockResolvedValueOnce({
      user: null,
    })

    const request = new Request(
      'http://localhost:3000/api/auctions/bid?auctionId=auction-456',
      {
        method: 'POST',
        body: JSON.stringify({
          amount: 110,
          licenseType: 'BASIC',
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Non authentifie')
  })

  it('should return 400 when auctionId is missing', async () => {
    getServerSessionMock.mockResolvedValueOnce({
      user: { id: 'user-123' },
    })

    const request = new Request('http://localhost:3000/api/auctions/bid', {
      method: 'POST',
      body: JSON.stringify({
        amount: 110,
        licenseType: 'BASIC',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('auctionId requis')
  })

  it('should reject bid below minimum increment', async () => {
    const userId = 'user-123'
    const auctionId = 'auction-456'

    getServerSessionMock.mockResolvedValueOnce({
      user: { id: userId },
    })

    const now = Date.now()
    const endTime = new Date(now + 1000 * 60 * 30)

    prismaMock.auction.findUnique.mockResolvedValueOnce({
      id: auctionId,
      status: 'ACTIVE',
      endTime,
      currentBid: 100,
      bidIncrement: 5,
      beat: {
        producerId: 'producer-123',
        title: 'Epic Beat',
      },
      bids: [],
    })

    const request = new Request(
      `http://localhost:3000/api/auctions/bid?auctionId=${auctionId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          amount: 102, // Less than 100 + 5
          licenseType: 'BASIC',
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('enchere minimum')
  })

  it('should prevent bidding on own auction', async () => {
    const userId = 'user-123'
    const auctionId = 'auction-456'

    getServerSessionMock.mockResolvedValueOnce({
      user: { id: userId },
    })

    const now = Date.now()
    const endTime = new Date(now + 1000 * 60 * 30)

    prismaMock.auction.findUnique.mockResolvedValueOnce({
      id: auctionId,
      status: 'ACTIVE',
      endTime,
      currentBid: 100,
      bidIncrement: 5,
      beat: {
        producerId: userId, // Same as bidder
        title: 'My Beat',
      },
      bids: [],
    })

    const request = new Request(
      `http://localhost:3000/api/auctions/bid?auctionId=${auctionId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          amount: 110,
          licenseType: 'BASIC',
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('propre beat')
  })

  it('should return 404 when auction does not exist', async () => {
    const userId = 'user-123'

    getServerSessionMock.mockResolvedValueOnce({
      user: { id: userId },
    })

    prismaMock.auction.findUnique.mockResolvedValueOnce(null)

    const request = new Request(
      'http://localhost:3000/api/auctions/bid?auctionId=nonexistent',
      {
        method: 'POST',
        body: JSON.stringify({
          amount: 110,
          licenseType: 'BASIC',
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Enchere introuvable')
  })

  it('should reject bid when auction is inactive', async () => {
    const userId = 'user-123'
    const auctionId = 'auction-456'

    getServerSessionMock.mockResolvedValueOnce({
      user: { id: userId },
    })

    prismaMock.auction.findUnique.mockResolvedValueOnce({
      id: auctionId,
      status: 'CLOSED',
      endTime: new Date(),
      currentBid: 100,
      bidIncrement: 5,
      beat: {
        producerId: 'producer-123',
        title: 'Epic Beat',
      },
      bids: [],
    })

    const request = new Request(
      `http://localhost:3000/api/auctions/bid?auctionId=${auctionId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          amount: 110,
          licenseType: 'BASIC',
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('plus active')
  })

  it('should reject bid when auction has ended', async () => {
    const userId = 'user-123'
    const auctionId = 'auction-456'

    getServerSessionMock.mockResolvedValueOnce({
      user: { id: userId },
    })

    const pastDate = new Date(Date.now() - 1000 * 60) // 1 minute ago

    prismaMock.auction.findUnique.mockResolvedValueOnce({
      id: auctionId,
      status: 'ACTIVE',
      endTime: pastDate,
      currentBid: 100,
      bidIncrement: 5,
      beat: {
        producerId: 'producer-123',
        title: 'Epic Beat',
      },
      bids: [],
    })

    const request = new Request(
      `http://localhost:3000/api/auctions/bid?auctionId=${auctionId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          amount: 110,
          licenseType: 'BASIC',
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('terminee')
  })

  it('should reject invalid bid amount', async () => {
    const userId = 'user-123'

    getServerSessionMock.mockResolvedValueOnce({
      user: { id: userId },
    })

    const request = new Request(
      'http://localhost:3000/api/auctions/bid?auctionId=auction-456',
      {
        method: 'POST',
        body: JSON.stringify({
          amount: -100, // Negative amount
          licenseType: 'BASIC',
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('should accept ENDING_SOON status auction', async () => {
    const userId = 'user-123'
    const auctionId = 'auction-456'

    getServerSessionMock.mockResolvedValueOnce({
      user: { id: userId },
    })

    const now = Date.now()
    const endTime = new Date(now + 1000 * 60 * 30)

    prismaMock.auction.findUnique.mockResolvedValueOnce({
      id: auctionId,
      status: 'ENDING_SOON',
      endTime,
      currentBid: 100,
      bidIncrement: 5,
      antiSnipeMinutes: 2,
      antiSnipeExtension: 5,
      beat: {
        producerId: 'producer-123',
        title: 'Epic Beat',
      },
      bids: [],
    })

    prismaMock.$transaction.mockImplementationOnce(async (callback) => {
      const txResult = await callback(prismaMock)
      return txResult
    })

    prismaMock.bid.create.mockResolvedValueOnce({
      id: 'bid-789',
      amount: 110,
      licenseType: 'BASIC',
      finalAmount: 110,
      auctionId,
      userId,
    })

    prismaMock.auction.update.mockResolvedValueOnce({
      id: auctionId,
      currentBid: 110,
      totalBids: 1,
      endTime,
    })

    prismaMock.notification.create.mockResolvedValue({ id: 'notif-1' })

    const request = new Request(
      `http://localhost:3000/api/auctions/bid?auctionId=${auctionId}`,
      {
        method: 'POST',
        body: JSON.stringify({
          amount: 110,
          licenseType: 'BASIC',
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.bid).toBeDefined()
  })

  it('should handle server errors gracefully', async () => {
    getServerSessionMock.mockResolvedValueOnce({
      user: { id: 'user-123' },
    })

    prismaMock.auction.findUnique.mockRejectedValueOnce(
      new Error('Database error')
    )

    const request = new Request(
      'http://localhost:3000/api/auctions/bid?auctionId=auction-456',
      {
        method: 'POST',
        body: JSON.stringify({
          amount: 110,
          licenseType: 'BASIC',
        }),
      }
    )

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Erreur serveur')
  })
})
