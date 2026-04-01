/**
 * Rate Limiter in-memory pour 318 LEGAACY Marketplace
 * Compatible serverless (Vercel) — basé sur un Map en mémoire
 * Pour la prod à grande échelle, migrer vers @upstash/ratelimit + Redis
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Nettoyage périodique des entrées expirées (évite fuite mémoire)
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Nettoyage toutes les 60s

interface RateLimitConfig {
  /** Nombre max de requêtes dans la fenêtre */
  maxRequests: number
  /** Durée de la fenêtre en secondes */
  windowSeconds: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetIn: number // secondes avant reset
}

/**
 * Vérifie si une requête est autorisée par le rate limiter
 * @param identifier - Clé unique (IP, userId, etc.)
 * @param config - Configuration du rate limit
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const key = identifier
  const entry = rateLimitStore.get(key)

  // Première requête ou fenêtre expirée
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowSeconds * 1000,
    })
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowSeconds,
    }
  }

  // Fenêtre active
  if (entry.count < config.maxRequests) {
    entry.count++
    return {
      success: true,
      remaining: config.maxRequests - entry.count,
      resetIn: Math.ceil((entry.resetTime - now) / 1000),
    }
  }

  // Rate limit atteint
  return {
    success: false,
    remaining: 0,
    resetIn: Math.ceil((entry.resetTime - now) / 1000),
  }
}

// ─── Configurations prédéfinies par type de route ───

export const RATE_LIMITS = {
  /** Auth: login/register — 10 requêtes / 15 min */
  auth: { maxRequests: 10, windowSeconds: 900 },

  /** API standard (bids, messages, follows) — 60 requêtes / min */
  api: { maxRequests: 60, windowSeconds: 60 },

  /** Upload de fichiers — 10 / 5 min */
  upload: { maxRequests: 10, windowSeconds: 300 },

  /** Routes publiques (search, listings) — 120 / min */
  public: { maxRequests: 120, windowSeconds: 60 },

  /** Admin — 100 / min */
  admin: { maxRequests: 100, windowSeconds: 60 },

  /** Webhooks Stripe — 200 / min (Stripe peut envoyer beaucoup) */
  webhook: { maxRequests: 200, windowSeconds: 60 },
} as const

/**
 * Extrait l'IP du client depuis les headers
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  )
}
