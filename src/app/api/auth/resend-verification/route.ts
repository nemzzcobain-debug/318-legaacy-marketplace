export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { randomUUID, createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendVerificationEmail } from '@/lib/emails/resend'

const RESEND_RATE_LIMIT = 3 // max 3 per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour

// Simple in-memory rate limiting (considere Redis pour la production)
const resendAttempts = new Map<string, number[]>()

function checkRateLimit(email: string): boolean {
  const now = Date.now()
  const attempts = resendAttempts.get(email) || []

  // Nettoyer les anciennes tentatives
  const recentAttempts = attempts.filter((time) => now - time < RATE_LIMIT_WINDOW)

  if (recentAttempts.length >= RESEND_RATE_LIMIT) {
    return false
  }

  recentAttempts.push(now)
  resendAttempts.set(email, recentAttempts)
  return true
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    // Verifier le rate limit
    if (!checkRateLimit(email)) {
      return NextResponse.json(
        { error: 'Trop de demandes. Essaie dans une heure.' },
        { status: 429 }
      )
    }

    // Verifier que l'utilisateur existe et n'a pas encore verifier son email
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json({ error: 'Aucun compte avec cet email' }, { status: 404 })
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: 'Cet email est deja verifie' }, { status: 400 })
    }

    // Supprimer les anciens tokens pour cet email
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    })

    // Generer un nouveau token
    const verificationToken = randomUUID()
    const hashedToken = createHash('sha256').update(verificationToken).digest('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h from now

    // Sauvegarder le token
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: hashedToken,
        expires: expiresAt,
      },
    })

    // Envoyer l'email (non-bloquant)
    sendVerificationEmail({
      to: email,
      name: user.name,
      token: verificationToken,
    }).catch(() => {})

    return NextResponse.json(
      { message: 'Un nouveau lien de confirmation a ete envoye' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Erreur resend verification:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
