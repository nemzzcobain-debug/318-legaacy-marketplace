export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { checkOperationalHealth } from '@/lib/health'
import { reportOperationalIssue } from '@/lib/monitoring'
import { processPendingIrcamScans } from '@/lib/ircam-scan-processing'

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return process.env.NODE_ENV !== 'production'
  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const health = await checkOperationalHealth()
  let ircamScans = {
    configured: false,
    checked: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  }

  try {
    // Le cron poursuit les analyses même si l'administrateur a fermé son navigateur.
    ircamScans = await processPendingIrcamScans(10)
  } catch (error) {
    await reportOperationalIssue({
      area: 'health',
      severity: 'warning',
      message: 'Traitement automatique des analyses IRCAM indisponible',
      context: { error: String(error) },
    })
  }

  if (!health.healthy) {
    await reportOperationalIssue({
      area: 'health',
      severity: health.database.healthy ? 'error' : 'critical',
      message: 'Contrôle automatique de la marketplace en échec',
      context: {
        databaseHealthy: health.database.healthy,
        databaseLatencyMs: health.database.latencyMs,
        stripeWebhookConfigured: health.configuration.stripeWebhook,
        emailConfigured: health.configuration.email,
        alertChannelConfigured: health.configuration.alertChannel,
      },
    })
  }

  return NextResponse.json(
    {
      status: health.healthy ? 'ok' : 'degraded',
      checkedAt: health.checkedAt,
      checks: {
        database: health.database.healthy,
        stripeWebhook: health.configuration.stripeWebhook,
        email: health.configuration.email,
        alertChannel: health.configuration.alertChannel,
        ircamScans,
      },
    },
    {
      status: health.healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
