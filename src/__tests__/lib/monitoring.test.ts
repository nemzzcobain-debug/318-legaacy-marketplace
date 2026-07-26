import { describe, expect, it } from 'vitest'
import { sanitizeMonitoringContext } from '@/lib/monitoring'

describe('surveillance opérationnelle', () => {
  it('masque les secrets avant journalisation ou alerte', () => {
    const result = sanitizeMonitoringContext({
      email: 'client@example.com',
      authorization: 'Bearer secret',
      nested: { stripeSecret: 'sk_test_123', status: 500 },
    })

    expect(result.email).toBe('client@example.com')
    expect(result.authorization).toBe('[REDACTED]')
    expect(result.nested).toEqual({
      stripeSecret: '[REDACTED]',
      status: 500,
    })
  })

  it('supprime les retours à la ligne injectables dans les alertes', () => {
    const result = sanitizeMonitoringContext({ error: 'ligne 1\nligne 2' })
    expect(result.error).toBe('ligne 1 ligne 2')
  })
})
