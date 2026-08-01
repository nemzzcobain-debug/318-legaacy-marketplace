import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, txMock, getServerSessionMock, sendBeatReviewDecisionEmailMock } = vi.hoisted(
  () => {
    const tx = {
      user: { update: vi.fn() },
      beat: { update: vi.fn() },
      auction: { update: vi.fn() },
      notification: { create: vi.fn(), createMany: vi.fn() },
      playlist: { findFirst: vi.fn(), create: vi.fn() },
      playlistBeat: { aggregate: vi.fn(), upsert: vi.fn() },
      follow: { findMany: vi.fn() },
    }

    return {
      txMock: tx,
      prismaMock: {
        beat: { findUnique: vi.fn() },
        $transaction: vi.fn(),
      },
      getServerSessionMock: vi.fn(),
      sendBeatReviewDecisionEmailMock: vi.fn(),
    }
  }
)

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/emails/resend', () => ({
  sendBeatReviewDecisionEmail: sendBeatReviewDecisionEmailMock,
}))

import { PATCH } from '@/app/api/admin/beats/route'

const stripeSuspendedBeat = {
  id: 'beat-1',
  title: 'Beat test',
  status: 'PENDING',
  saleMode: 'AUCTION',
  producer: {
    id: 'producer-1',
    email: null,
    name: 'Beatmaker',
    displayName: 'Beatmaker 318',
    producerStatus: 'SUSPENDED',
    stripeGraceSuspendedAt: new Date('2026-08-01T10:00:00.000Z'),
  },
  auctions: [],
}

describe('PATCH /api/admin/beats — dérogation Stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    })
    prismaMock.beat.findUnique.mockResolvedValue(stripeSuspendedBeat)
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock)
    )
    txMock.follow.findMany.mockResolvedValue([])
    txMock.user.update.mockResolvedValue({})
    txMock.beat.update.mockResolvedValue({})
    txMock.notification.create.mockResolvedValue({})
  })

  it('propose la dérogation sans publier automatiquement le beat', async () => {
    const response = await PATCH(
      new Request('http://localhost/api/admin/beats', {
        method: 'PATCH',
        body: JSON.stringify({ beatId: 'beat-1', action: 'APPROVE' }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toMatchObject({
      code: 'PRODUCER_STRIPE_SUSPENDED',
      canOverrideStripeGrace: true,
      producerId: 'producer-1',
    })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('réactive le beatmaker pour 7 jours puis approuve le beat après confirmation admin', async () => {
    const response = await PATCH(
      new Request('http://localhost/api/admin/beats', {
        method: 'PATCH',
        body: JSON.stringify({
          beatId: 'beat-1',
          action: 'APPROVE',
          overrideStripeGrace: true,
        }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.stripeGraceExtended).toBe(true)
    expect(txMock.user.update).toHaveBeenCalledWith({
      where: { id: 'producer-1' },
      data: {
        producerStatus: 'APPROVED',
        producerApprovedAt: expect.any(Date),
        stripeGraceSuspendedAt: null,
      },
    })
    expect(txMock.beat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'beat-1' },
        data: expect.objectContaining({ status: 'ACTIVE' }),
      })
    )
    expect(txMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'producer-1',
        title: 'Délai Stripe Connect prolongé',
      }),
    })
  })
})
