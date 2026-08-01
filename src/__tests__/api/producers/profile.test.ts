import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  findUnique: vi.fn(),
  auctionCount: vi.fn(),
  auctionAggregate: vi.fn(),
  beatAggregate: vi.fn(),
  likeCount: vi.fn(),
  followCount: vi.fn(),
}))

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.findUnique },
    auction: {
      count: mocks.auctionCount,
      aggregate: mocks.auctionAggregate,
    },
    beat: { aggregate: mocks.beatAggregate },
    like: { count: mocks.likeCount },
    follow: { count: mocks.followCount },
  },
}))

import { GET } from '@/app/api/producers/[id]/route'

const pendingProducer = {
  id: 'producer-pending',
  name: 'Beatmaker Test',
  displayName: null,
  avatar: null,
  bio: null,
  producerBio: 'Ma candidature',
  producerStatus: 'PENDING',
  role: 'PRODUCER',
  rating: 0,
  totalSales: 0,
  createdAt: new Date('2026-08-01T10:00:00.000Z'),
  beats: [],
  _count: { beats: 0, wonAuctions: 0 },
}

describe('profil producteur en attente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findUnique.mockResolvedValue(pendingProducer)
    mocks.auctionCount.mockResolvedValue(0)
    mocks.auctionAggregate.mockResolvedValue({ _sum: { producerPayout: 0 } })
    mocks.beatAggregate.mockResolvedValue({ _sum: { plays: 0 } })
    mocks.likeCount.mockResolvedValue(0)
    mocks.followCount.mockResolvedValue(0)
  })

  it('reste invisible pour un visiteur public', async () => {
    mocks.getServerSession.mockResolvedValue(null)

    const response = await GET(
      new Request('https://www.318marketplace.com/api/producers/producer-pending'),
      { params: Promise.resolve({ id: 'producer-pending' }) }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Producteur non trouve' })
  })

  it('est visible par l’administrateur avec les beats de candidature', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'admin-id', role: 'ADMIN' },
    })

    const response = await GET(
      new Request('https://www.318marketplace.com/api/producers/producer-pending'),
      { params: Promise.resolve({ id: 'producer-pending' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'producer-pending' },
        select: expect.objectContaining({
          beats: expect.objectContaining({
            where: {
              status: { in: ['ACTIVE', 'DRAFT', 'PENDING', 'REJECTED'] },
            },
          }),
        }),
      })
    )
  })
})
