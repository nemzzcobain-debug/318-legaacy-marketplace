export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/auth/magic-login — Vérifie un magic token et connecte l'utilisateur
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token manquant' }, { status: 400 })
    }

    // Chercher le user avec ce magic token
    const user = await (prisma.user as any).findFirst({
      where: {
        magicToken: token,
        magicTokenExpiry: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Lien expiré ou invalide. Demande un nouveau lien.' },
        { status: 401 }
      )
    }

    // Marquer l'email comme vérifié si pas encore fait
    const updateData: any = {
      magicToken: null,
      magicTokenExpiry: null,
    }
    if (!user.emailVerified) {
      updateData.emailVerified = new Date()
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    })

    // Créer une session NextAuth manuellement via un session token
    const { randomBytes } = await import('crypto')
    const sessionToken = randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours

    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires,
      },
    })

    // Récupérer l'URL de redirection depuis le query param
    const { searchParams } = new URL(req.url)
    const redirect = searchParams.get('redirect') || '/dashboard'

    // Retourner le session token — le frontend devra le stocker en cookie
    return NextResponse.json({
      success: true,
      sessionToken,
      expires: expires.toISOString(),
      redirect,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    })
  } catch (error: any) {
    console.error('Erreur magic login:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// GET /api/auth/magic-login?token=xxx&redirect=yyy — Raccourci pour clic depuis email
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const redirect = searchParams.get('redirect') || '/dashboard'

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=missing_token', req.url))
  }

  // Vérifier le token
  const user = await (prisma.user as any).findFirst({
    where: {
      magicToken: token,
      magicTokenExpiry: { gt: new Date() },
    },
    select: {
      id: true,
      email: true,
      emailVerified: true,
    },
  })

  if (!user) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', req.url))
  }

  // Invalider le token et vérifier l'email
  const updateData: any = {
    magicToken: null,
    magicTokenExpiry: null,
  }
  if (!user.emailVerified) {
    updateData.emailVerified = new Date()
  }

  await prisma.user.update({
    where: { id: user.id },
    data: updateData,
  })

  // Créer une session
  const { randomBytes } = await import('crypto')
  const sessionToken = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires,
    },
  })

  // Rediriger avec le cookie de session
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const response = NextResponse.redirect(new URL(redirect, baseUrl))

  // Définir le cookie de session NextAuth
  const cookieName = process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'

  response.cookies.set(cookieName, sessionToken, {
    expires,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })

  return response
}
