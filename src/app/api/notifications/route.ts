export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — Recuperer les notifications de l'utilisateur
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 20), 1), 100)
    const unreadOnly = searchParams.get('unread') === 'true'
    const cursor = searchParams.get('cursor')

    const where: any = { userId: session.user.id }
    if (unreadOnly) where.read = false

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })

    // Compter les non lues
    const unreadCount = await prisma.notification.count({
      where: { userId: session.user.id, read: false },
    })

    return NextResponse.json({
      notifications,
      unreadCount,
      hasMore: notifications.length === limit,
    })
  } catch (error: any) {
    console.error('Erreur notifications:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// PATCH — Marquer des notifications comme lues
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const { notificationIds, markAllRead } = await req.json()

    if (markAllRead) {
      // Marquer toutes les notifications comme lues
      await prisma.notification.updateMany({
        where: { userId: session.user.id, read: false },
        data: { read: true },
      })

      return NextResponse.json({ message: 'Toutes les notifications marquees comme lues' })
    }

    if (notificationIds && Array.isArray(notificationIds)) {
      // Marquer des notifications specifiques
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: session.user.id,
        },
        data: { read: true },
      })

      return NextResponse.json({ message: `${notificationIds.length} notification(s) marquee(s) comme lue(s)` })
    }

    return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 })
  } catch (error: any) {
    console.error('Erreur mise a jour notifications:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// DELETE — Supprimer des notifications
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const { notificationIds, deleteAll } = await req.json()

    if (deleteAll) {
      await prisma.notification.deleteMany({
        where: { userId: session.user.id },
      })
      return NextResponse.json({ message: 'Toutes les notifications supprimees' })
    }

    if (notificationIds && Array.isArray(notificationIds)) {
      await prisma.notification.deleteMany({
        where: {
          id: { in: notificationIds },
          userId: session.user.id,
        },
      })
      return NextResponse.json({ message: `${notificationIds.length} notification(s) supprimee(s)` })
    }

    return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 })
  } catch (error: any) {
    console.error('Erreur suppression notifications:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
