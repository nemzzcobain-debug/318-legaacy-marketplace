export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Endpoint temporaire pour corriger les liens des notifications
 * qui pointent vers /dashboard au lieu de pages specifiques.
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

    const results = { producerApproved: 0, auctionEnded: 0 }

    // 1. Fix PRODUCER_APPROVED notifications: /dashboard → /producer/{userId}
    const approvedNotifs = await prisma.notification.findMany({
      where: {
        type: 'PRODUCER_APPROVED',
        link: '/dashboard',
      },
      select: { id: true, userId: true },
    })

    for (const notif of approvedNotifs) {
      await prisma.notification.update({
        where: { id: notif.id },
        data: { link: `/producer/${notif.userId}` },
      })
      results.producerApproved++
    }

    // 2. Fix AUCTION_ENDED notifications: /dashboard → /auction/{auctionId}
    // On cherche les enchères du producteur pour matcher
    const auctionNotifs = await prisma.notification.findMany({
      where: {
        type: 'AUCTION_ENDED',
        link: '/dashboard',
      },
      select: { id: true, userId: true, createdAt: true, message: true },
    })

    for (const notif of auctionNotifs) {
      // Trouver l'enchère la plus récente du producteur avant la date de notification
      const auction = await prisma.auction.findFirst({
        where: {
          beat: { producerId: notif.userId },
          updatedAt: {
            gte: new Date(notif.createdAt.getTime() - 60000), // 1 min avant
            lte: new Date(notif.createdAt.getTime() + 60000), // 1 min après
          },
        },
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
      })

      if (auction) {
        await prisma.notification.update({
          where: { id: notif.id },
          data: { link: `/auction/${auction.id}` },
        })
      } else {
        // Pas d'enchère matchée, on redirige vers le profil producteur
        await prisma.notification.update({
          where: { id: notif.id },
          data: { link: `/producer/${notif.userId}` },
        })
      }
      results.auctionEnded++
    }

    return NextResponse.json({
      message: `Corrigé: ${results.producerApproved} PRODUCER_APPROVED, ${results.auctionEnded} AUCTION_ENDED`,
      results,
    })
  } catch (error) {
    console.error('Erreur fix-notif-links:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
