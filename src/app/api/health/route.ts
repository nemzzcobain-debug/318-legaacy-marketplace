export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { checkOperationalHealth } from '@/lib/health'

export async function GET() {
  const health = await checkOperationalHealth()

  return NextResponse.json(
    {
      status: health.healthy ? 'ok' : 'degraded',
      checkedAt: health.checkedAt,
      databaseLatencyMs: health.database.latencyMs,
    },
    {
      status: health.healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
