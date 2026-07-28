import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  enforceProducerStripeAccess,
  getStripeGraceDeadline,
  getStripeGraceReminderAt,
  sendStripeGraceReminders,
  STRIPE_GRACE_DAYS,
  STRIPE_GRACE_HOURS,
  STRIPE_GRACE_REMINDER_HOURS,
} from '@/lib/producer-stripe-access'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  update: vi.fn(),
  notificationCreate: vi.fn().mockResolvedValue({ id: 'notification-id' }),
  readiness: vi.fn(),
  reminderEmail: vi.fn(),
  push: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: mocks.findMany,
      updateMany: mocks.updateMany,
      update: mocks.update,
    },
    notification: {
      create: mocks.notificationCreate,
    },
  },
}))

vi.mock('@/lib/stripe', () => ({
  getConnectAccountReadiness: mocks.readiness,
}))

vi.mock('@/lib/emails/resend', () => ({
  sendStripeConnectReminderEmail: mocks.reminderEmail,
  sendStripeConnectSuspensionEmail: vi.fn(),
}))

vi.mock('@/lib/web-push', () => ({
  sendPushToUser: mocks.push,
}))

describe('délai Stripe Connect producteur', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.notificationCreate.mockResolvedValue({ id: 'notification-id' })
    mocks.findMany.mockResolvedValue([])
    mocks.readiness.mockResolvedValue('pending')
    mocks.reminderEmail.mockResolvedValue({ success: true })
    mocks.push.mockResolvedValue({ sent: 1, failed: 0, removed: 0 })
  })

  it('accorde exactement sept jours après l’approbation', () => {
    const approvedAt = new Date('2026-07-29T10:00:00.000Z')
    const deadline = getStripeGraceDeadline(approvedAt)

    expect(STRIPE_GRACE_DAYS).toBe(7)
    expect(STRIPE_GRACE_HOURS).toBe(168)
    expect(deadline?.toISOString()).toBe('2026-08-05T10:00:00.000Z')
  })

  it('programme le rappel exactement 48 heures avant la fin', () => {
    const approvedAt = new Date('2026-07-29T10:00:00.000Z')

    expect(STRIPE_GRACE_REMINDER_HOURS).toBe(48)
    expect(getStripeGraceReminderAt(approvedAt)?.toISOString()).toBe('2026-08-03T10:00:00.000Z')
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

  it('envoie un seul rappel email, push et marketplace à J-2', async () => {
    const approvedAt = new Date('2026-07-29T10:00:00.000Z')
    mocks.findMany.mockResolvedValue([
      {
        id: 'producer-id',
        producerApprovedAt: approvedAt,
        stripeAccountId: null,
        email: 'producer@example.com',
        name: 'Producer',
        displayName: 'Beatmaker 318',
      },
    ])

    const result = await sendStripeGraceReminders(new Date('2026-08-03T10:00:00.000Z'))

    expect(result).toEqual({
      checked: 1,
      reminded: 1,
      alreadySent: 0,
      stripeUnavailable: 0,
    })
    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: `stripe-connect-reminder:producer-id:${approvedAt.getTime()}`,
        userId: 'producer-id',
        title: 'Plus que 48 heures pour Stripe Connect',
        link: '/dashboard?tab=settings',
      }),
    })
    expect(mocks.reminderEmail).toHaveBeenCalledWith({
      to: 'producer@example.com',
      name: 'Beatmaker 318',
      deadline: new Date('2026-08-05T10:00:00.000Z'),
    })
    expect(mocks.push).toHaveBeenCalledOnce()
  })

  it('n’envoie pas de rappel si Stripe Connect est déjà validé', async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: 'producer-ready',
        producerApprovedAt: new Date('2026-07-29T10:00:00.000Z'),
        stripeAccountId: 'acct_ready',
        email: 'ready@example.com',
        name: 'Ready',
        displayName: null,
      },
    ])
    mocks.readiness.mockResolvedValue('ready')

    const result = await sendStripeGraceReminders(new Date('2026-08-03T10:00:00.000Z'))

    expect(result.reminded).toBe(0)
    expect(mocks.notificationCreate).not.toHaveBeenCalled()
    expect(mocks.reminderEmail).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
