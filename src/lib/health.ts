import { prisma } from '@/lib/prisma'

export interface OperationalHealth {
  healthy: boolean
  checkedAt: string
  database: {
    healthy: boolean
    latencyMs: number
  }
  configuration: {
    stripeWebhook: boolean
    email: boolean
    alertChannel: boolean
  }
}

export async function checkOperationalHealth(): Promise<OperationalHealth> {
  const startedAt = Date.now()
  let databaseHealthy = false

  try {
    await prisma.$queryRaw`SELECT 1`
    databaseHealthy = true
  } catch {
    databaseHealthy = false
  }

  const stripeWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET)
  const email = Boolean(
    process.env.RESEND_API_KEY &&
    process.env.EMAIL_FROM &&
    (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL)
  )
  const alertChannel = Boolean(
    process.env.MONITORING_WEBHOOK_URL ||
    process.env.NTFY_MONITORING_TOPIC ||
    process.env.NTFY_TOPIC
  )

  return {
    healthy: databaseHealthy && stripeWebhook && email && alertChannel,
    checkedAt: new Date().toISOString(),
    database: {
      healthy: databaseHealthy,
      latencyMs: Date.now() - startedAt,
    },
    configuration: {
      stripeWebhook,
      email,
      alertChannel,
    },
  }
}
