import { prisma } from '@/lib/prisma'
import { getConnectAccountReadiness } from '@/lib/stripe'
import { sendStripeConnectSuspensionEmail } from '@/lib/emails/resend'
import { sendPushToUser } from '@/lib/web-push'

export const STRIPE_GRACE_DAYS = 7
export const STRIPE_GRACE_HOURS = STRIPE_GRACE_DAYS * 24
const STRIPE_GRACE_MS = STRIPE_GRACE_HOURS * 60 * 60 * 1000

type ProducerAccessUser = {
  id: string
  role: string
  producerStatus: string | null
  producerApprovedAt: Date | null
  stripeGraceSuspendedAt: Date | null
  stripeAccountId: string | null
  email?: string | null
  name?: string | null
  displayName?: string | null
}

export type ProducerStripeAccess = {
  allowed: boolean
  status:
    | 'active'
    | 'grace_period'
    | 'stripe_suspended'
    | 'admin_suspended'
    | 'not_approved'
  message?: string
  deadline: Date | null
  remainingMs: number
}

export function getStripeGraceDeadline(approvedAt: Date | null) {
  return approvedAt ? new Date(approvedAt.getTime() + STRIPE_GRACE_MS) : null
}

async function notifyStripeSuspension(user: ProducerAccessUser) {
  const deliveries: Promise<unknown>[] = [
    prisma.notification.create({
      data: {
        userId: user.id,
        type: 'SYSTEM',
        title: 'Compte beatmaker temporairement suspendu',
        message:
          'Le délai de 7 jours est terminé. Termine ton inscription Stripe Connect pour réactiver automatiquement tes publications.',
        link: '/dashboard?tab=settings',
      },
    }),
    sendPushToUser(user.id, {
      title: 'Inscription Stripe requise',
      body: 'Ton délai de 7 jours est terminé. Termine Stripe Connect pour réactiver ton compte beatmaker.',
      url: '/dashboard?tab=settings',
      tag: `stripe-grace-suspended-${user.id}`,
    }),
  ]

  if (user.email) {
    deliveries.push(
      sendStripeConnectSuspensionEmail({
        to: user.email,
        name: user.displayName || user.name || 'Beatmaker',
      })
    )
  }

  await Promise.allSettled(deliveries)
}

async function restoreStripeSuspendedProducer(user: ProducerAccessUser) {
  const restored = await prisma.user.updateMany({
    where: {
      id: user.id,
      producerStatus: 'SUSPENDED',
      stripeGraceSuspendedAt: { not: null },
    },
    data: {
      producerStatus: 'APPROVED',
      stripeGraceSuspendedAt: null,
    },
  })

  if (restored.count > 0) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'SYSTEM',
        title: 'Compte beatmaker réactivé',
        message:
          'Ton inscription Stripe Connect est validée. Tu peux de nouveau publier et lancer des enchères.',
        link: '/dashboard',
      },
    })
  }
}

async function restoreExtendedStripeGraceProducer(
  user: ProducerAccessUser,
  deadline: Date,
  now: Date
) {
  const restored = await prisma.user.updateMany({
    where: {
      id: user.id,
      producerStatus: 'SUSPENDED',
      stripeGraceSuspendedAt: { not: null },
    },
    data: {
      producerStatus: 'APPROVED',
      stripeGraceSuspendedAt: null,
    },
  })

  if (restored.count > 0) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'SYSTEM',
        title: 'Délai Stripe Connect prolongé',
        message:
          'Ton délai Stripe Connect passe à 7 jours. Ton compte beatmaker est réactivé jusqu’à la nouvelle échéance.',
        link: '/dashboard?tab=settings',
      },
    })
  }

  return {
    allowed: true,
    status: 'grace_period' as const,
    deadline,
    remainingMs: Math.max(0, deadline.getTime() - now.getTime()),
  }
}

/**
 * Applique la règle métier au moment d'une action sensible.
 * En cas de panne Stripe, on laisse temporairement passer un compte approuvé
 * afin d'éviter une suspension injustifiée.
 */
export async function enforceProducerStripeAccess(
  user: ProducerAccessUser,
  now = new Date()
): Promise<ProducerStripeAccess> {
  if (user.role === 'ADMIN') {
    return { allowed: true, status: 'active', deadline: null, remainingMs: 0 }
  }

  if (user.role !== 'PRODUCER') {
    return {
      allowed: false,
      status: 'not_approved',
      message: 'Accès réservé aux beatmakers',
      deadline: null,
      remainingMs: 0,
    }
  }

  if (user.producerStatus === 'SUSPENDED') {
    if (!user.stripeGraceSuspendedAt) {
      return {
        allowed: false,
        status: 'admin_suspended',
        message: 'Ton compte beatmaker est suspendu. Contacte 318 LEGAACY.',
        deadline: null,
        remainingMs: 0,
      }
    }

    if (user.stripeAccountId) {
      const readiness = await getConnectAccountReadiness(user.stripeAccountId)
      if (readiness === 'ready') {
        await restoreStripeSuspendedProducer(user)
        return { allowed: true, status: 'active', deadline: null, remainingMs: 0 }
      }
    }

    const extendedDeadline = getStripeGraceDeadline(user.producerApprovedAt)
    if (extendedDeadline && extendedDeadline > now) {
      return restoreExtendedStripeGraceProducer(user, extendedDeadline, now)
    }

    return {
      allowed: false,
      status: 'stripe_suspended',
      message:
        'Ton délai de 7 jours est terminé. Termine ton inscription Stripe Connect pour réactiver ton compte beatmaker.',
      deadline: extendedDeadline,
      remainingMs: 0,
    }
  }

  if (user.producerStatus !== 'APPROVED') {
    return {
      allowed: false,
      status: 'not_approved',
      message: 'Ton compte beatmaker doit d’abord être approuvé par 318 LEGAACY.',
      deadline: null,
      remainingMs: 0,
    }
  }

  // Sécurité pour les anciens comptes ou une approbation faite hors de l'API.
  let approvedAt = user.producerApprovedAt
  if (!approvedAt) {
    approvedAt = now
    await prisma.user.update({
      where: { id: user.id },
      data: { producerApprovedAt: approvedAt },
    })
  }

  const deadline = getStripeGraceDeadline(approvedAt)!
  const remainingMs = Math.max(0, deadline.getTime() - now.getTime())

  if (user.stripeAccountId) {
    const readiness = await getConnectAccountReadiness(user.stripeAccountId)
    if (readiness === 'ready') {
      return { allowed: true, status: 'active', deadline: null, remainingMs: 0 }
    }
    if (readiness === 'unavailable') {
      return {
        allowed: true,
        status: remainingMs > 0 ? 'grace_period' : 'active',
        deadline,
        remainingMs,
      }
    }
  }

  if (remainingMs > 0) {
    return {
      allowed: true,
      status: 'grace_period',
      deadline,
      remainingMs,
    }
  }

  const suspended = await prisma.user.updateMany({
    where: {
      id: user.id,
      producerStatus: 'APPROVED',
      stripeGraceSuspendedAt: null,
    },
    data: {
      producerStatus: 'SUSPENDED',
      stripeGraceSuspendedAt: now,
    },
  })

  if (suspended.count > 0) {
    await notifyStripeSuspension(user)
  }

  return {
    allowed: false,
    status: 'stripe_suspended',
    message:
      'Ton délai de 7 jours est terminé. Termine ton inscription Stripe Connect pour réactiver ton compte beatmaker.',
    deadline,
    remainingMs: 0,
  }
}

/**
 * Contrôle planifié appelé par le cron existant.
 */
export async function suspendExpiredStripeGraceProducers(now = new Date()) {
  const cutoff = new Date(now.getTime() - STRIPE_GRACE_MS)
  const producers = await prisma.user.findMany({
    where: {
      role: 'PRODUCER',
      producerStatus: 'APPROVED',
      producerApprovedAt: { lte: cutoff },
    },
    select: {
      id: true,
      role: true,
      producerStatus: true,
      producerApprovedAt: true,
      stripeGraceSuspendedAt: true,
      stripeAccountId: true,
      email: true,
      name: true,
      displayName: true,
    },
  })

  let suspended = 0
  for (const producer of producers) {
    const access = await enforceProducerStripeAccess(producer, now)
    if (!access.allowed && access.status === 'stripe_suspended') suspended++
  }

  return { checked: producers.length, suspended }
}
