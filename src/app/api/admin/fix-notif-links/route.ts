export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Endpoint temporaire pour corriger les liens des notifications PRODUCER_APPROVED
 * qui pointent vers /dashboard au lieu de /producer/{userId}
 * À SUPPRIMER après utilisation
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email || '' },
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin requis' }, { status: 403 })
    }

    // Trouver toutes les notifications PRODUCER_APPROVED avec lien /dashboard
    const notifs = await prisma.notification.findMany({
      where: {
        type: 'PRODUCER_APPROVED',
        link: '/dashboard',
      },
      select: { id: true, userId: true },
    })

    let updated = 0
    for (const notif of notifs) {
      await prisma.notification.update({
        where: { id: notif.id },
        data: { link: `/producer/${notif.userId}` },
      })
      updated++
    }

    return NextResponse.json({
      message: `${updated} notification(s) PRODUCER_APPROVED corrigée(s)`,
      updated,
    })
  } catch (error) {
    console.error('Erreur fix-notif-links:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
