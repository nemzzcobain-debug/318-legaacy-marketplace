import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware centralisé 318 LEGAACY Marketplace
 * - CORS explicite (bloque les origines non autorisées)
 * - Rate limiting par IP
 * - Protection CSRF
 * - Headers de sécurité
 */

// ─── CORS — Origines autorisées ───
const ALLOWED_ORIGINS = [
  'https://www.318marketplace.com',
  'https://318marketplace.com',
  'https://318-legaacy-marketplace.vercel.app',
]
// En dev, autoriser localhost
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://127.0.0.1:3000')
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && ALLOWED_ORIGINS.includes(origin)
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24h cache preflight
  }
}

// ─── Rate Limiting In-Memory (Edge Runtime compatible) ───
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

// Nettoyage périodique pour éviter les fuites mémoire en Edge
function cleanupRateLimits() {
  const now = Date.now()
  for (const [key, entry] of Array.from(rateLimitMap.entries())) {
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

// ─── Route classification (plus granulaire) ───
type RouteType = 'login' | 'register' | 'bid' | 'upload' | 'webhook' | 'admin' | 'api' | 'public' | 'skip'

function getRouteType(pathname: string, method: string): RouteType {
  if (pathname.startsWith('/api/stripe/webhook') || pathname.startsWith('/api/payments/webhook')) return 'webhook'
  if (pathname === '/api/auth/callback/credentials' && method === 'POST') return 'login'
  if (pathname.startsWith('/api/auth/register') && method === 'POST') return 'register'
  if (pathname.includes('/bid') && method === 'POST') return 'bid'
  if (pathname.includes('/upload') || pathname.includes('/beats/upload')) return 'upload'
  if (pathname.startsWith('/api/admin')) return 'admin'
  if (pathname.startsWith('/api/')) return 'api'
  // Pages statiques, assets — pas de rate limit
  if (pathname.startsWith('/_next') || pathname.startsWith('/icons') || pathname === '/favicon.ico') return 'skip'
  return 'public'
}

// Rate limit configs: { maxRequests, windowMs }
const LIMITS: Record<string, { max: number; window: number }> = {
  login:    { max: 5,   window: 15 * 60 * 1000 },  // 5 tentatives / 15 min (anti brute-force)
  register: { max: 3,   window: 60 * 60 * 1000 },  // 3 inscriptions / heure (anti spam)
  bid:      { max: 20,  window: 60 * 1000 },        // 20 enchères / min (anti bot)
  upload:   { max: 10,  window: 5 * 60 * 1000 },    // 10 uploads / 5 min
  webhook:  { max: 200, window: 60 * 1000 },         // 200 / min (Stripe)
  admin:    { max: 100, window: 60 * 1000 },         // 100 / min
  api:      { max: 60,  window: 60 * 1000 },         // 60 / min
  public:   { max: 120, window: 60 * 1000 },         // 120 / min
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Nettoyage périodique (1 chance sur 100 pour ne pas bloquer)
  if (Math.random() < 0.01) cleanupRateLimits()

  const method = request.method
  const routeType = getRouteType(pathname, method)

  // Skip static assets
  if (routeType === 'skip') {
    return NextResponse.next()
  }

  const origin = request.headers.get('origin')

  // ─── CORS Preflight (OPTIONS) ───
  if (method === 'OPTIONS' && pathname.startsWith('/api/')) {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    })
  }

  // ─── CORS — Bloquer les origines non autorisées sur les API ───
  if (pathname.startsWith('/api/') && origin) {
    const isWebhook = pathname.startsWith('/api/stripe/webhook') || pathname.startsWith('/api/payments/webhook')
    if (!isWebhook && !ALLOWED_ORIGINS.includes(origin)) {
      return NextResponse.json(
        { error: 'Origin not allowed' },
        { status: 403, headers: { 'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] } }
      )
    }
  }

  // ─── CSRF Origin Validation (for state-changing requests) ───
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

  if (isStateChanging) {
    // Allow Stripe webhooks and cron jobs (no origin validation)
    const isWebhook = pathname.startsWith('/api/stripe/webhook') || pathname.startsWith('/api/payments/webhook')
    const isCronJob = pathname.startsWith('/api/auctions/finalize')

    if (!isWebhook && !isCronJob) {
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
    // Clé granulaire: les routes sensibles (login, register, bid) ont leur propre compteur
    // Les routes API génériques partagent un compteur par type
    const isSensitive = ['login', 'register', 'bid', 'upload'].includes(routeType)
    const limitKey = isSensitive ? `${ip}:${routeType}` : `${ip}:${routeType}`
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

    // ─── CORS Headers (sur toutes les réponses API) ───
    if (pathname.startsWith('/api/')) {
      const corsHeaders = getCorsHeaders(origin)
      for (const [key, value] of Object.entries(corsHeaders)) {
        response.headers.set(key, value)
      }
    }

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
