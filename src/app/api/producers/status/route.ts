export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

// GET /api/producers/status - Vérifier le statut de candidature producteur
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ status: 'NOT_LOGGED_IN' })
    }

    const userId = (session.user as any).id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        producerStatus: true,
        producerBio: true,
        portfolio: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ status: 'NOT_FOUND' })
    }

    // Si l'utilisateur est un producteur (a déjà postulé)
    if (user.role === 'PRODUCER') {
      return NextResponse.json({
        status: user.producerStatus || 'PENDING',
        bio: user.producerBio,
        portfolio: user.portfolio,
        appliedAt: user.updatedAt,
      })
    }

    // Utilisateur normal qui n'a pas encore postulé
    return NextResponse.json({ status: 'NOT_APPLIED' })
  } catch (error) {
    console.error('Erreur vérification statut producteur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
