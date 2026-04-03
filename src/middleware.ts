import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware centralisé 318 LEGAACY Marketplace
 * - Rate limiting par IP
 * - Protection des routes admin
 * - Headers de sécurité
 */

// ─── Rate Limiting In-Memory (Edge Runtime compatible) ───
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

// Nettoyage périodique pour éviter les fuites mémoire en Edge
function cleanupRateLimits() {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}

function checkLimit(ip: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const key = ip
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }

  if (entry.count < maxRequests) {
    entry.count++
    return { allowed: true, remaining: maxRequests - entry.count }
  }

  return { allowed: false, remaining: 0 }
}

// ─── Route classification ───
function getRouteType(pathname: string): 'auth' | 'upload' | 'webhook' | 'admin' | 'api' | 'public' | 'skip' {
  if (pathname.startsWith('/api/stripe/webhook')) return 'webhook'
  if (pathname.startsWith('/api/auth/register') || pathname === '/api/auth/callback/credentials') return 'auth'
  if (pathname.includes('/upload') || pathname.includes('/beats/upload')) return 'upload'
  if (pathname.startsWith('/api/admin')) return 'admin'
  if (pathname.startsWith('/api/')) return 'api'
  // Pages statiques, assets — pas de rate limit
  if (pathname.startsWith('/_next') || pathname.startsWith('/icons') || pathname === '/favicon.ico') return 'skip'
  return 'public'
}

// Rate limit configs: { maxRequests, windowMs }
const LIMITS: Record<string, { max: number; window: number }> = {
  auth:    { max: 10,  window: 15 * 60 * 1000 },  // 10 req / 15 min
  upload:  { max: 10,  window: 5 * 60 * 1000 },   // 10 req / 5 min
  webhook: { max: 200, window: 60 * 1000 },        // 200 / min (Stripe)
  admin:   { max: 100, window: 60 * 1000 },        // 100 / min
  api:     { max: 60,  window: 60 * 1000 },        // 60 / min
  public:  { max: 120, window: 60 * 1000 },        // 120 / min
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Nettoyage périodique (1 chance sur 100 pour ne pas bloquer)
  if (Math.random() < 0.01) cleanupRateLimits()

  const routeType = getRouteType(pathname)

  // Skip static assets
  if (routeType === 'skip') {
    return NextResponse.next()
  }

  // ─── CSRF Origin Validation (for state-changing requests) ───
  const method = request.method
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

  if (isStateChanging) {
    // Allow Stripe webhooks and cron jobs (no origin validation)
    const isWebhook = pathname.startsWith('/api/stripe/webhook') || pathname.startsWith('/api/payments/webhook')
    const isCronJob = pathname.startsWith('/api/auctions/finalize')

    if (!isWebhook && !isCronJob) {
      const origin = request.headers.get('origin')
      const referer = request.headers.get('referer')
      const host = request.headers.get('host')

      // Allow requests with no origin (same-origin, non-browser clients)
      if (origin || referer) {
        const requestOrigin = origin || (referer ? new URL(referer).origin : null)
        const expectedOrigin = `${request.nextUrl.protocol}//${host}`

        if (requestOrigin && !requestOrigin.startsWith(expectedOrigin)) {
          return NextResponse.json(
            { error: 'CSRF validation failed' },
            { status: 403 }
          )
        }
      }
    }
  }

  // ─── Rate Limiting ───
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'

  const limitConfig = LIMITS[routeType]
  if (limitConfig) {
    const limitKey = `${ip}:${routeType}`
    const { allowed, remaining } = checkLimit(limitKey, limitConfig.max, limitConfig.window)

    if (!allowed) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Réessayez dans quelques instants.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(limitConfig.window / 1000)),
            'X-RateLimit-Limit': String(limitConfig.max),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    }

    // Ajouter les headers de rate limit à la réponse
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Limit', String(limitConfig.max))
    response.headers.set('X-RateLimit-Remaining', String(remaining))

    // ─── Security Headers ───
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)')

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Match pages (for security headers) but not static files
    '/((?!_next/static|_next/image|icons|favicon.ico|sw.js|manifest.json).*)',
  ],
}
