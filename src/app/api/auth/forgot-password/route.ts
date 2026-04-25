export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { forgotPasswordSchema } from '@/lib/validations'
import { sendPasswordResetEmail } from '@/lib/emails/resend'

// SECURITY FIX H2: Rate limiting en memoire pour forgot-password
// Max 3 demandes par IP par fenetre de 15 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 min

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// Nettoyage periodique (eviter fuite memoire)
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key)
  }
}, 60_000)

export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX H2: Verifier le rate limit par IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Trop de demandes. Reessayez dans 15 minutes.' },
        { status: 429 }
      )
    }

    const body = await request.json()

    // Validation
    const validated = forgotPasswordSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      )
    }

    const { email } = validated.data

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    })

    // Always return 200 to prevent email enumeration
    if (!user) {
      return NextResponse.json(
        { message: 'Si un compte existe avec cet email, un lien de reinitialisation a ete envoye.' },
        { status: 200 }
      )
    }

    // Delete old tokens for this email (cleanup)
    // @ts-ignore - passwordResetToken model exists in schema but not generated yet
    await prisma.passwordResetToken.deleteMany({
      where: { email },
    })

    // Generate token
    const plainToken = randomUUID()
    const hashedToken = createHash('sha256').update(plainToken).digest('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Save token
    // @ts-ignore - passwordResetToken model exists in schema but not generated yet
    await prisma.passwordResetToken.create({
      data: {
        email,
        token: hashedToken,
        expires: expiresAt,
      },
    })

    // Send email (non-blocking)
    sendPasswordResetEmail({
      to: email,
      name: user.name,
      token: plainToken,
    }).catch((error) => {
      console.error('Failed to send password reset email:', error)
    })

    return NextResponse.json(
      { message: 'Si un compte existe avec cet email, un lien de reinitialisation a ete envoye.' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Erreur forgot-password:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
