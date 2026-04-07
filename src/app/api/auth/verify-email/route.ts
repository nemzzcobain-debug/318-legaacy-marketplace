export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(new URL('/login?error=invalid-token', request.url))
    }

    // Hash le token fourni
    const hashedToken = createHash('sha256').update(token).digest('hex')

    // Chercher le token dans la base
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token: hashedToken },
    })

    if (!verificationToken) {
      return NextResponse.redirect(new URL('/login?error=invalid-token', request.url))
    }

    // Verifier que le token n'a pas expire
    if (new Date() > verificationToken.expires) {
      // Supprimer le token expire
      await prisma.verificationToken.delete({
        where: { token: hashedToken },
      })
      return NextResponse.redirect(new URL('/login?error=token-expired', request.url))
    }

    // Marquer l'email comme verifie
    const user = await prisma.user.update({
      where: { email: verificationToken.identifier },
      data: { emailVerified: new Date() },
    })

    // Supprimer le token (une seule utilisation)
    await prisma.verificationToken.delete({
      where: { token: hashedToken },
    })

    return NextResponse.redirect(new URL('/login?verified=true', request.url))
  } catch (error) {
    console.error('Erreur verification email:', error)
    return NextResponse.redirect(new URL('/login?error=server-error', request.url))
  }
}
