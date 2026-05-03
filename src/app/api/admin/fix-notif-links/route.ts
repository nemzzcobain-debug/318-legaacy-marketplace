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

    const results = { producerApproved: 0, auctionEnded: 0, adminNotifs: 0 }

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
    const auctionNotifs = await prisma.notification.findMany({
      where: {
        type: 'AUCTION_ENDED',
        link: '/dashboard',
      },
      select: { id: true, userId: true, createdAt: true, message: true },
    })

    for (const notif of auctionNotifs) {
      const auction = await prisma.auction.findFirst({
        where: {
          beat: { producerId: notif.userId },
          updatedAt: {
            gte: new Date(notif.createdAt.getTime() - 60000),
            lte: new Date(notif.createdAt.getTime() + 60000),
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
        await prisma.notification.update({
          where: { id: notif.id },
          data: { link: `/producer/${notif.userId}` },
        })
      }
      results.auctionEnded++
    }

    // 3. Fix admin SYSTEM notifications: /admin → /producer/{sujet}
    // Ces notifications concernent les candidatures/approbations de producteurs
    const adminNotifs = await prisma.notification.findMany({
      where: {
        link: '/admin',
        type: 'SYSTEM',
        OR: [
          { title: { contains: 'Producteur' } },
          { title: { contains: 'producteur' } },
          { title: { contains: 'candidature' } },
        ],
      },
      select: { id: true, message: true, createdAt: true },
    })

    for (const notif of adminNotifs) {
      // Extraire le nom du producteur du message pour trouver son profil
      // Messages types: "Vous avez approuve le producteur X" ou "X souhaite devenir producteur"
      let producer = null

      // Essayer de matcher "le producteur X" (notification admin après action)
      const matchAdmin = notif.message.match(/le producteur (.+)$/)
      if (matchAdmin) {
        const nameOrEmail = matchAdmin[1]
        producer = await prisma.user.findFirst({
          where: {
            OR: [
              { name: nameOrEmail },
              { email: nameOrEmail },
            ],
          },
          select: { id: true },
        })
      }

      // Essayer de matcher "X souhaite devenir" (notification candidature)
      if (!producer) {
        const matchApply = notif.message.match(/^(.+?) souhaite devenir/)
        if (matchApply) {
          const nameOrEmail = matchApply[1]
          producer = await prisma.user.findFirst({
            where: {
              OR: [
                { name: nameOrEmail },
                { email: nameOrEmail },
              ],
            },
            select: { id: true },
          })
        }
      }

      if (producer) {
        await prisma.notification.update({
          where: { id: notif.id },
          data: { link: `/producer/${producer.id}` },
        })
      }
      results.adminNotifs++
    }

    return NextResponse.json({
      message: `Corrigé: ${results.producerApproved} PRODUCER_APPROVED, ${results.auctionEnded} AUCTION_ENDED, ${results.adminNotifs} admin SYSTEM`,
      results,
    })
  } catch (error) {
    console.error('Erreur fix-notif-links:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
