import { logger } from '@/lib/logger'

export type MonitoringArea = 'client' | 'email' | 'health' | 'webhook'
export type MonitoringSeverity = 'warning' | 'error' | 'critical'

interface OperationalIssue {
  area: MonitoringArea
  message: string
  severity?: MonitoringSeverity
  context?: Record<string, unknown>
}

const SENSITIVE_PARTS = [
  'authorization',
  'cookie',
  'password',
  'secret',
  'token',
  'apikey',
  'api_key',
  'card',
]

const alertHistory = new Map<string, number>()
const ALERT_THROTTLE_MS = 2 * 60 * 1000

function cleanString(value: string, maxLength = 500): string {
  return value.replace(/[\r\n]+/g, ' ').slice(0, maxLength)
}

export function sanitizeMonitoringContext(
  context: Record<string, unknown> = {}
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(context)) {
    const normalizedKey = key.toLowerCase()
    if (SENSITIVE_PARTS.some((part) => normalizedKey.includes(part))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'string') {
      sanitized[key] = cleanString(value, 1000)
    } else if (Array.isArray(value)) {
      sanitized[key] = value.slice(0, 20).map((item) => {
        if (typeof item === 'string') return cleanString(item, 200)
        if (item && typeof item === 'object') {
          return sanitizeMonitoringContext(item as Record<string, unknown>)
        }
        return item
      })
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeMonitoringContext(value as Record<string, unknown>)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

function shouldSendAlert(fingerprint: string): boolean {
  const now = Date.now()
  const previous = alertHistory.get(fingerprint) || 0
  if (now - previous < ALERT_THROTTLE_MS) return false

  alertHistory.set(fingerprint, now)
  if (alertHistory.size > 200) {
    for (const [key, timestamp] of alertHistory) {
      if (now - timestamp > ALERT_THROTTLE_MS) alertHistory.delete(key)
    }
  }
  return true
}

async function postWithTimeout(url: string, init: RequestInit, timeoutMs = 3500): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export async function reportOperationalIssue({
  area,
  message,
  severity = 'error',
  context = {},
}: OperationalIssue): Promise<{ alerted: boolean }> {
  const safeMessage = cleanString(message)
  const safeContext = sanitizeMonitoringContext(context)
  const incidentId = crypto.randomUUID().slice(0, 8)

  logger.error(`[MONITORING:${area.toUpperCase()}] ${safeMessage}`, {
    incidentId,
    severity,
    ...safeContext,
  })

  const canSend =
    process.env.NODE_ENV === 'production' || process.env.MONITORING_FORCE_SEND === 'true'
  const fingerprint = `${area}:${safeMessage}`

  if (!canSend || !shouldSendAlert(fingerprint)) {
    return { alerted: false }
  }

  const payload = {
    incidentId,
    area,
    severity,
    message: safeMessage,
    context: safeContext,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    occurredAt: new Date().toISOString(),
  }

  const deliveries: Promise<boolean>[] = []
  const webhookUrl = process.env.MONITORING_WEBHOOK_URL
  if (webhookUrl) {
    deliveries.push(
      postWithTimeout(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.MONITORING_WEBHOOK_SECRET
            ? { 'X-Monitoring-Secret': process.env.MONITORING_WEBHOOK_SECRET }
            : {}),
        },
        body: JSON.stringify(payload),
      })
    )
  }

  const ntfyTopic = process.env.NTFY_MONITORING_TOPIC || process.env.NTFY_TOPIC
  if (ntfyTopic) {
    deliveries.push(
      postWithTimeout(`https://ntfy.sh/${encodeURIComponent(ntfyTopic)}`, {
        method: 'POST',
        headers: {
          Title: `318 ${area.toUpperCase()} · ${severity}`,
          Priority: severity === 'critical' ? 'urgent' : 'high',
          Tags: area === 'email' ? 'email,warning' : 'warning',
        },
        body: `${safeMessage}\nIncident ${incidentId}`,
      })
    )
  }

  if (deliveries.length === 0) return { alerted: false }
  const results = await Promise.allSettled(deliveries)
  return {
    alerted: results.some((result) => result.status === 'fulfilled' && result.value),
  }
}
