export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — Recuperer les achats de l'utilisateur connecte
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const userId = session.user.id

    // Encheres gagnees et payees
    const purchases = await prisma.auction.findMany({
      where: {
        winnerId: userId,
        status: 'COMPLETED',
        paidAt: { not: null },
      },
      orderBy: { paidAt: 'desc' },
      include: {
        beat: {
          select: {
            id: true,
            title: true,
            genre: true,
            bpm: true,
            key: true,
            audioUrl: true,
            audioWav: true,
            stemsUrl: true,
            coverImage: true,
            producer: {
              select: {
                id: true,
                name: true,
                displayName: true,
                avatar: true,
              },
            },
          },
        },
      },
    })

    // Encheres gagnees mais pas encore payees
    const pendingPayments = await prisma.auction.findMany({
      where: {
        winnerId: userId,
        status: { in: ['ENDED', 'COMPLETED'] },
        paidAt: null,
      },
      orderBy: { endTime: 'desc' },
      include: {
        beat: {
          select: {
            id: true,
            title: true,
            genre: true,
            coverImage: true,
            producer: {
              select: {
                name: true,
                displayName: true,
              },
            },
          },
        },
      },
    })

    // Stats
    const totalSpent = purchases.reduce((sum, p) => sum + (p.finalPrice || p.currentBid), 0)

    return NextResponse.json({
      purchases,
      pendingPayments,
      stats: {
        totalPurchases: purchases.length,
        totalSpent: Math.round(totalSpent * 100) / 100,
        pendingCount: pendingPayments.length,
      },
    })
  } catch (error: any) {
    console.error('Purchases error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
