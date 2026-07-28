import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  enforceProducerStripeAccess,
  getStripeGraceDeadline,
  STRIPE_GRACE_DAYS,
  STRIPE_GRACE_HOURS,
} from '@/lib/producer-stripe-access'

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  update: vi.fn(),
  notificationCreate: vi.fn().mockResolvedValue({ id: 'notification-id' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      updateMany: mocks.updateMany,
      update: mocks.update,
    },
    notification: {
      create: mocks.notificationCreate,
    },
  },
}))

vi.mock('@/lib/stripe', () => ({
  getConnectAccountReadiness: vi.fn(),
}))

vi.mock('@/lib/emails/resend', () => ({
  sendStripeConnectSuspensionEmail: vi.fn(),
}))

vi.mock('@/lib/web-push', () => ({
  sendPushToUser: vi.fn(),
}))

describe('délai Stripe Connect producteur', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.notificationCreate.mockResolvedValue({ id: 'notification-id' })
  })

  it('accorde exactement sept jours après l’approbation', () => {
    const approvedAt = new Date('2026-07-29T10:00:00.000Z')
    const deadline = getStripeGraceDeadline(approvedAt)

    expect(STRIPE_GRACE_DAYS).toBe(7)
    expect(STRIPE_GRACE_HOURS).toBe(168)
    expect(deadline?.toISOString()).toBe('2026-08-05T10:00:00.000Z')
  })

  it('réactive un compte suspendu encore couvert par le nouveau délai', async () => {
    const now = new Date('2026-07-31T10:00:00.000Z')
    const access = await enforceProducerStripeAccess(
      {
        id: 'producer-id',
        role: 'PRODUCER',
        producerStatus: 'SUSPENDED',
        producerApprovedAt: new Date('2026-07-29T10:00:00.000Z'),
        stripeGraceSuspendedAt: new Date('2026-07-30T10:00:00.000Z'),
        stripeAccountId: null,
      },
      now
    )

    expect(access).toEqual({
      allowed: true,
      status: 'grace_period',
      deadline: new Date('2026-08-05T10:00:00.000Z'),
      remainingMs: 5 * 24 * 60 * 60 * 1000,
    })
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'producer-id',
        producerStatus: 'SUSPENDED',
        stripeGraceSuspendedAt: { not: null },
      },
      data: {
        producerStatus: 'APPROVED',
        stripeGraceSuspendedAt: null,
      },
    })
  })
})
