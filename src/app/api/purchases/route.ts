export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — Récupérer les achats de l'utilisateur connecté
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
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
            coverImage: true,
            audioUrl: true, // Aperçu public uniquement
            audioOriginal: true,
            audioWav: true,
            stemsUrl: true,
            stemsFiles: true,
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

    // Encheres gagnées mais pas encore payees (toujours via Auction)
    const pendingPayments = await prisma.auction.findMany({
      where: {
        winnerId: userId,
        status: { in: ['ENDED', 'COMPLETED'] },
        endTime: { lte: new Date() },
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

    // Ne jamais exposer les emplacements privés. Les téléchargements passent
    // exclusivement par l'endpoint qui vérifie l'achat et la licence.
    const safePurchases = allPurchases.map((p) => ({
      ...p,
      finalPrice: p.amount,
      currentBid: p.amount,
      winningLicense: p.licenseType,
      paidAt: p.updatedAt,
      beat: {
        ...p.beat,
        hasMp3: !!(p.beat.audioOriginal || p.beat.audioUrl),
        hasWav: !!p.beat.audioWav,
        hasStems: !!(p.beat.stemsUrl || p.beat.stemsFiles),
        audioOriginal: undefined,
        audioWav: undefined,
        stemsUrl: undefined,
        stemsFiles: undefined,
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
