import { encode } from 'next-auth/jwt'

export const AUTH_SESSION_MAX_AGE = 30 * 24 * 60 * 60

export interface AuthSessionUser {
  id: string
  email: string
  name?: string | null
  role?: string | null
  avatar?: string | null
}

export function getAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET

  if (!secret) {
    throw new Error('NEXTAUTH_SECRET ou AUTH_SECRET doit être configuré')
  }

  return secret
}

export function getAuthSessionExpiry(now = Date.now()): Date {
  return new Date(now + AUTH_SESSION_MAX_AGE * 1000)
}

export function getAuthSessionCookieName(isProduction = process.env.NODE_ENV === 'production') {
  return isProduction ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
}

export function getAuthSessionCookieOptions(
  expires: Date,
  isProduction = process.env.NODE_ENV === 'production'
) {
  return {
    expires,
    maxAge: AUTH_SESSION_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction,
    path: '/',
  }
}

export async function createAuthSessionToken(
  user: AuthSessionUser,
  secret = getAuthSecret()
): Promise<string> {
  return encode({
    secret,
    maxAge: AUTH_SESSION_MAX_AGE,
    token: {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name || user.email,
      role: user.role || 'ARTIST',
      picture: user.avatar || null,
      needsOnboarding: false,
    },
  })
}
