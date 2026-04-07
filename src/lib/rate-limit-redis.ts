// Distributed rate limiting with Upstash Redis
// To enable: npm install @upstash/ratelimit @upstash/redis
// Then set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env

export type RateLimitType = 'login' | 'register' | 'bid' | 'api' | 'upload'

const RATE_LIMITS: Record<RateLimitType, { requests: number; window: string }> = {
  login: { requests: 5, window: '15m' },
  register: { requests: 3, window: '1h' },
  bid: { requests: 20, window: '1m' },
  api: { requests: 100, window: '1m' },
  upload: { requests: 10, window: '1h' },
}

/**
 * Check distributed rate limit using Upstash Redis
 * Returns success: true if Upstash is not configured (graceful fallback)
 * Install @upstash/ratelimit and @upstash/redis to enable
 */
export async function checkDistributedRateLimit(
  identifier: string,
  type: RateLimitType = 'api'
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  // Upstash not configured - fall back to allowing the request
  // In-memory rate limiting in middleware.ts handles the actual limiting
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }

  try {
    // Dynamic import to avoid build errors when packages aren't installed
    // @ts-ignore - @upstash/redis is optional
    const { Redis } = await import('@upstash/redis')
    // @ts-ignore - @upstash/ratelimit is optional
    const { Ratelimit } = await import('@upstash/ratelimit')

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })

    const config = RATE_LIMITS[type]
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.requests, config.window as any),
      prefix: `rl:${type}`,
    })

    const result = await limiter.limit(identifier)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (error) {
    console.error('Upstash rate limit error:', error)
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }
}
