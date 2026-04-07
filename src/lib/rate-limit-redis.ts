import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Fallback to in-memory if Upstash is not configured
const isUpstashConfigured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

let redis: Redis | null = null

if (isUpstashConfigured) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

// Rate limit configurations
export const rateLimiters = {
  login: isUpstashConfigured && redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '15 m'), prefix: 'rl:login' })
    : null,
  register: isUpstashConfigured && redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h'), prefix: 'rl:register' })
    : null,
  bid: isUpstashConfigured && redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 m'), prefix: 'rl:bid' })
    : null,
  api: isUpstashConfigured && redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1 m'), prefix: 'rl:api' })
    : null,
  upload: isUpstashConfigured && redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 h'), prefix: 'rl:upload' })
    : null,
}

export type RateLimitType = keyof typeof rateLimiters

/**
 * Check rate limit using Upstash Redis (distributed)
 * Falls back to allowing the request if Upstash is not configured
 */
export async function checkDistributedRateLimit(
  identifier: string,
  type: RateLimitType = 'api'
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const limiter = rateLimiters[type]

  if (!limiter) {
    // Upstash not configured, allow request (fallback to in-memory rate limiting in middleware)
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }

  try {
    const result = await limiter.limit(identifier)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (error) {
    // If Redis fails, allow the request (fail open)
    console.error('Upstash rate limit error:', error)
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }
}
