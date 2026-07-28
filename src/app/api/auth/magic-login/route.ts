export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  createAuthSessionToken,
  getAuthSessionCookieName,
  getAuthSessionCookieOptions,
  getAuthSessionExpiry,
} from '@/lib/auth-session'

function getSafeRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard'
  return value
}

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
        role: true,
        avatar: true,
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

    // L'application utilise des sessions JWT. Un token opaque stocké dans la
    // table Session fonctionne jusqu'au premier rechargement, puis NextAuth ne
    // peut plus le décoder. Générer ici le même JWT que la connexion normale.
    const sessionToken = await createAuthSessionToken(user)
    const expires = getAuthSessionExpiry()

    // Récupérer l'URL de redirection depuis le query param
    const { searchParams } = new URL(req.url)
    const redirect = getSafeRedirect(searchParams.get('redirect'))

    const response = NextResponse.json({
      success: true,
      expires: expires.toISOString(),
      redirect,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    })

    response.cookies.set(
      getAuthSessionCookieName(),
      sessionToken,
      getAuthSessionCookieOptions(expires)
    )

    return response
  } catch (error: any) {
    console.error('Erreur magic login:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// GET /api/auth/magic-login?token=xxx&redirect=yyy — Raccourci pour clic depuis email
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const redirect = getSafeRedirect(searchParams.get('redirect'))

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
      name: true,
      role: true,
      avatar: true,
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

  const sessionToken = await createAuthSessionToken(user)
  const expires = getAuthSessionExpiry()

  // Rediriger avec le cookie de session
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const response = NextResponse.redirect(new URL(redirect, baseUrl))

  // Définir le cookie de session NextAuth
  response.cookies.set(
    getAuthSessionCookieName(),
    sessionToken,
    getAuthSessionCookieOptions(expires)
  )

  return response
}
