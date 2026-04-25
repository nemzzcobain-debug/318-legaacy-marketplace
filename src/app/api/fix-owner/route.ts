import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// TEMPORAIRE — Endpoint pour corriger le role du proprietaire
// A SUPPRIMER apres utilisation
const OWNER_EMAIL = 'nemzzcobain@gmail.com'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non connecte' }, { status: 401 })
    }

    // Seul le proprietaire peut utiliser cet endpoint
    if (session.user.email !== OWNER_EMAIL) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
    }

    const user = await prisma.user.update({
      where: { email: OWNER_EMAIL },
      data: {
        role: 'ADMIN',
        producerStatus: 'APPROVED',
      },
      select: { id: true, email: true, role: true, producerStatus: true },
    })

    return NextResponse.json({
      success: true,
      message: 'Compte mis a jour: ADMIN + APPROVED',
      user,
    })
  } catch (error) {
    console.error('Fix owner error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
