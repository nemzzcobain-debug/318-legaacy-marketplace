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

    // TASK48: Utiliser la table Purchase pour TOUS les achats (directs + enchères)
    const allPurchases = await prisma.purchase.findMany({
      where: {
        buyerId: userId,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        beat: {
          select: {
            id: true,
            title: true,
            genre: true,
            bpm: true,
            key: true,
            // TASK49: Ne plus exposer les URLs directes — utiliser /api/beats/[id]/download
            coverImage: true,
            audioWav: true,   // Juste pour savoir si WAV est dispo (bool)
            stemsUrl: true,   // Juste pour savoir si stems sont dispo (bool)
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

    // Encheres gagnees mais pas encore payees (toujours via Auction)
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

    // TASK49: Transformer les URLs en booleen (hasWav, hasStems) + ajouter downloadUrl
    const safePurchases = allPurchases.map((p) => ({
      ...p,
      beat: {
        ...p.beat,
        hasWav: !!p.beat.audioWav,
        hasStems: !!p.beat.stemsUrl,
        audioWav: undefined,
        stemsUrl: undefined,
        downloadUrl: `/api/beats/${p.beat.id}/download`,
      },
    }))

    // Stats
    const totalSpent = allPurchases.reduce((sum, p) => sum + p.amount, 0)

    return NextResponse.json({
      purchases: safePurchases,
      pendingPayments,
      stats: {
        totalPurchases: allPurchases.length,
        totalSpent: Math.round(totalSpent * 100) / 100,
        pendingCount: pendingPayments.length,
      },
    })
  } catch (error: any) {
    console.error('Purchases error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
