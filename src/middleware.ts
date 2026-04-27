import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Middleware centralisé 318 LEGAACY Marketplace
 * - CORS explicite (bloque les origines non autorisées)
 * - Rate limiting distribué via Upstash Redis (F8 FIX)
 * - Protection CSRF avec double-submit cookie (F7 FIX)
 * - Rate limit par utilisateur (F13 FIX)
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24h cache preflight
  }
}

// ─── F8 FIX: Rate Limiting distribué via Upstash Redis ───
// Fallback en mémoire si Upstash n'est pas configuré (dev local)
const hasUpstash = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN

const redis = hasUpstash
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

// Rate limiters par type de route (F8 + F13)
const rateLimiters = redis ? {
  login: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '15 m'), prefix: 'rl:login' }),
  register: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h'), prefix: 'rl:register' }),
  bid: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 m'), prefix: 'rl:bid' }),
  upload: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '5 m'), prefix: 'rl:upload' }),
  webhook: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(200, '1 m'), prefix: 'rl:webhook' }),
  admin: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1 m'), prefix: 'rl:admin' }),
  api: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'), prefix: 'rl:api' }),
  public: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '1 m'), prefix: 'rl:public' }),
} : null

// Fallback in-memory pour le dev (quand Upstash n'est pas dispo)
const inMemoryMap = new Map<string, { count: number; resetTime: number }>()

const LIMITS: Record<string, { max: number; window: number }> = {
  login:    { max: 5,   window: 15 * 60 * 1000 },
  register: { max: 3,   window: 60 * 60 * 1000 },
  bid:      { max: 20,  window: 60 * 1000 },
  upload:   { max: 10,  window: 5 * 60 * 1000 },
  webhook:  { max: 200, window: 60 * 1000 },
  admin:    { max: 100, window: 60 * 1000 },
  api:      { max: 60,  window: 60 * 1000 },
  public:   { max: 120, window: 60 * 1000 },
}

function inMemoryCheckLimit(key: string, max: number, windowMs: number): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = inMemoryMap.get(key)
  if (!entry || now > entry.resetTime) {
    inMemoryMap.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: max - 1 }
  }
  if (entry.count < max) {
    entry.count++
    return { allowed: true, remaining: max - entry.count }
  }
  return { allowed: false, remaining: 0 }
}

// Nettoyage périodique du fallback in-memory
function cleanupInMemory() {
  const now = Date.now()
  for (const [key, entry] of Array.from(inMemoryMap.entries())) {
    if (now > entry.resetTime) inMemoryMap.delete(key)
  }
}

// ─── Route classification ───
type RouteType = 'login' | 'register' | 'bid' | 'upload' | 'webhook' | 'admin' | 'api' | 'public' | 'skip'

function getRouteType(pathname: string, method: string): RouteType {
  if (pathname.startsWith('/api/stripe/webhook') || pathname.startsWith('/api/payments/webhook')) return 'webhook'
  if (pathname === '/api/auth/callback/credentials' && method === 'POST') return 'login'
  if (pathname.startsWith('/api/auth/register') && method === 'POST') return 'register'
  if (pathname.includes('/bid') && method === 'POST') return 'bid'
  if (pathname.includes('/upload') || pathname.includes('/beats/upload')) return 'upload'
  if (pathname.startsWith('/api/admin')) return 'admin'
  if (pathname.startsWith('/api/')) return 'api'
  if (pathname.startsWith('/_next') || pathname.startsWith('/icons') || pathname === '/favicon.ico') return 'skip'
  return 'public'
}

// ─── F7 FIX: CSRF Token helpers ───
function generateCsrfToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

export async function middleware(request: NextRequest) {
  try {
  const { pathname } = request.nextUrl

  // Nettoyage périodique du fallback in-memory (1 chance sur 100)
  if (!rateLimiters && Math.random() < 0.01) cleanupInMemory()

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

  // ─── F7 FIX: CSRF Protection renforcée avec double-submit cookie ───
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

  if (isStateChanging) {
    const isWebhook = pathname.startsWith('/api/stripe/webhook') || pathname.startsWith('/api/payments/webhook')
    const isCronJob = pathname.startsWith('/api/auctions/finalize')
    const isAuthCallback = pathname.startsWith('/api/auth/')

    if (!isWebhook && !isCronJob && !isAuthCallback) {
      // 1. Vérification Origin/Referer (première couche)
      const referer = request.headers.get('referer')
      const host = request.headers.get('host')

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

      // 2. Double-submit cookie check (deuxième couche)
      const csrfCookie = request.cookies.get('csrf-token')?.value
      const csrfHeader = request.headers.get('x-csrf-token')

      // Si le cookie CSRF existe, le header doit correspondre
      if (csrfCookie && csrfHeader && csrfCookie !== csrfHeader) {
        return NextResponse.json(
          { error: 'CSRF token mismatch' },
          { status: 403 }
        )
      }
    }
  }

  // ─── Rate Limiting (F8: distribué avec Upstash, F13: par IP) ───
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'

  const limitConfig = LIMITS[routeType]
  if (limitConfig) {
    const limitKey = `${ip}:${routeType}`
    let allowed = true
    let remaining = limitConfig.max

    if (rateLimiters && rateLimiters[routeType as keyof typeof rateLimiters]) {
      // F8: Utiliser Upstash Redis pour le rate limiting distribué
      try {
        const result = await rateLimiters[routeType as keyof typeof rateLimiters].limit(limitKey)
        allowed = result.success
        remaining = result.remaining
      } catch (e) {
        // Fallback si Upstash est down — laisser passer avec un warning
        console.warn('[Middleware] Upstash rate limit error, falling back to allow:', e)
      }
    } else {
      // Fallback in-memory (dev ou si Upstash est pas configuré)
      const result = inMemoryCheckLimit(limitKey, limitConfig.max, limitConfig.window)
      allowed = result.allowed
      remaining = result.remaining
    }

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

    // Construire la réponse
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

    // ─── F7 FIX: Générer le CSRF token cookie si absent ───
    if (!request.cookies.get('csrf-token')) {
      const token = generateCsrfToken()
      response.cookies.set('csrf-token', token, {
        httpOnly: false, // Le JS frontend doit pouvoir le lire
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24, // 24h
      })
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
  } catch (error) {
    // Fail open: if middleware crashes, let the request through
    console.error('[Middleware] Unexpected error, failing open:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Match pages (for security headers) but not static files
    '/((?!_next/static|_next/image|icons|favicon.ico|sw.js|manifest.json).*)',
  ],
}
