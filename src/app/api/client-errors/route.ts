export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { reportOperationalIssue } from '@/lib/monitoring'
import { checkDistributedRateLimit } from '@/lib/rate-limit-redis'

const MAX_BODY_SIZE = 10_000

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : ''
}

// Reçoit uniquement les erreurs techniques du navigateur.
// Aucun champ de formulaire ni paramètre d'URL n'est collecté.
export async function POST(request: Request) {
  try {
    const identifier =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const rateLimit = await checkDistributedRateLimit(
      `client-error:${identifier}`,
      'clientError'
    )
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Trop de rapports' }, { status: 429 })
    }

    const rawBody = await request.text()

    if (rawBody.length > MAX_BODY_SIZE) {
      return NextResponse.json({ error: 'Rapport trop volumineux' }, { status: 413 })
    }

    const body = JSON.parse(rawBody)
    const report = {
      message: cleanText(body.message, 500),
      stack: cleanText(body.stack, 2000),
      digest: cleanText(body.digest, 200),
      pathname: cleanText(body.pathname, 300),
      userAgent: cleanText(body.userAgent, 300),
      occurredAt: cleanText(body.occurredAt, 100),
    }

    await reportOperationalIssue({
      area: 'client',
      severity: 'error',
      message: report.message || 'Erreur navigateur sans message',
      context: report,
    })

    return NextResponse.json({ received: true }, { status: 202 })
  } catch {
    return NextResponse.json({ error: 'Rapport invalide' }, { status: 400 })
  }
}
