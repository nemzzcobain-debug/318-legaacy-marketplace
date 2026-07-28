import { afterEach, describe, expect, it } from 'vitest'
import { decode } from 'next-auth/jwt'
import {
  AUTH_SESSION_MAX_AGE,
  createAuthSessionToken,
  getAuthSessionCookieName,
  getAuthSessionCookieOptions,
  getAuthSessionExpiry,
} from '@/lib/auth-session'

describe('auth session persistence', () => {
  afterEach(() => {
    delete process.env.NEXTAUTH_SECRET
    delete process.env.AUTH_SECRET
  })

  it('génère un JWT lisible par NextAuth pendant 30 jours', async () => {
    const secret = 'test-secret-that-is-long-enough'
    const token = await createAuthSessionToken(
      {
        id: 'user-318',
        email: 'artist@example.com',
        name: 'Artiste',
        role: 'ARTIST',
      },
      secret
    )

    const payload = await decode({ token, secret })

    expect(payload).toMatchObject({
      sub: 'user-318',
      id: 'user-318',
      email: 'artist@example.com',
      role: 'ARTIST',
    })
    expect((payload?.exp || 0) - (payload?.iat || 0)).toBe(AUTH_SESSION_MAX_AGE)
  })

  it('crée un cookie persistant et sécurisé en production', () => {
    const expires = getAuthSessionExpiry(0)
    const options = getAuthSessionCookieOptions(expires, true)

    expect(getAuthSessionCookieName(true)).toBe('__Secure-next-auth.session-token')
    expect(options).toMatchObject({
      expires,
      maxAge: AUTH_SESSION_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
    })
  })
})
