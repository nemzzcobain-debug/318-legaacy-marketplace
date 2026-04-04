export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET — Appele par Vercel Cron toutes les minutes
export async function GET(req: NextRequest) {
  return handleFinalize(req)
}

// POST — Appele manuellement par un admin
export async function POST(req: NextRequest) {
  return handleFinalize(req)
}

async function handleFinalize(req: NextRequest) {
  try {
    // SÉCURITÉ: Vérification auth pour GET et POST
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('[CRON] CRON_SECRET non configuré')
      return NextResponse.json({ error: 'Configuration manquante' }, { status: 500 })
    }

    // Vérifier d'abord le cron secret (pour Vercel Cron ou appels serveur)
    if (authHeader !== `Bearer ${cronSecret}`) {
      // Sinon vérifier la session admin
      const { getServerSession } = await import('next-auth')
      const { authOptions } = await import('@/lib/auth')
      const session = await getServerSession(authOptions)

      if (!session?.user || (session.user as any).role !== 'ADMIN') {
        return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
      }
    }

    const now = new Date()

    // Trouver toutes les encheres expirees mais pas encore finalisees
    const expiredAuctions = await prisma.auction.findMany({
      where: {
        endTime: { lte: now },
        status: { in: ['ACTIVE', 'ENDING_SOON'] },
      },
      include: {
        beat: { include: { producer: true } },
        bids: {
          orderBy: { amount: 'desc' },
          take: 1,
          include: { user: true },
        },
      },
    })

    const results = {
      processed: 0,
      withWinner: 0,
      noWinner: 0,
      errors: 0,
    }

    for (const auction of expiredAuctions) {
      try {
        const topBid = auction.bids[0]

        await prisma.$transaction(async (tx) => {
          if (topBid) {
            // Il y a un gagnant
            const reserveMet = !auction.reservePrice || topBid.amount >= auction.reservePrice

            if (reserveMet) {
              // Enchere gagnee — en attente de paiement
              await tx.auction.update({
                where: { id: auction.id },
                data: {
                  status: 'ENDED',
                  winnerId: topBid.userId,
                  winningLicense: topBid.licenseType,
                  finalPrice: topBid.finalAmount,
                  commissionAmount: Math.round(topBid.finalAmount * (auction.commissionPercent / 100) * 100) / 100,
                  producerPayout: Math.round(topBid.finalAmount * (1 - auction.commissionPercent / 100) * 100) / 100,
                },
              })

              // Notifier le gagnant
              await tx.notification.create({
                data: {
                  type: 'AUCTION_WON',
                  title: 'Felicitations ! Vous avez gagne !',
                  message: `Vous avez remporte "${auction.beat.title}" pour ${topBid.finalAmount}\u20AC. Procedez au paiement pour obtenir votre beat.`,
                  link: `/checkout/${auction.id}`,
                  userId: topBid.userId,
                },
              })

              // Notifier le producteur
              await tx.notification.create({
                data: {
                  type: 'AUCTION_ENDED',
                  title: 'Enchere terminee !',
                  message: `Votre beat "${auction.beat.title}" a ete vendu pour ${topBid.finalAmount}\u20AC. Paiement en attente.`,
                  link: `/dashboard`,
                  userId: auction.beat.producerId,
                },
              })

              results.withWinner++
            } else {
              // Reserve non atteinte
              await tx.auction.update({
                where: { id: auction.id },
                data: { status: 'ENDED' },
              })

              // Notifier le producteur
              await tx.notification.create({
                data: {
                  type: 'AUCTION_ENDED',
                  title: 'Enchere terminee sans vente',
                  message: `Le prix de reserve n'a pas ete atteint pour "${auction.beat.title}". Enchere max: ${topBid.finalAmount}\u20AC.`,
                  link: `/dashboard`,
                  userId: auction.beat.producerId,
                },
              })

              results.noWinner++
            }
          } else {
            // Aucune enchere
            await tx.auction.update({
              where: { id: auction.id },
              data: { status: 'ENDED' },
            })

            await tx.notification.create({
              data: {
                type: 'AUCTION_ENDED',
                title: 'Enchere terminee sans enchere',
                message: `Aucune enchere placee sur "${auction.beat.title}".`,
                link: `/dashboard`,
                userId: auction.beat.producerId,
              },
            })

            results.noWinner++
          }
        })

        results.processed++
      } catch (err) {
        console.error(`Erreur finalisation enchere ${auction.id}:`, err)
        results.errors++
      }
    }

    return NextResponse.json({
      message: `${results.processed} encheres finalisees`,
      ...results,
      timestamp: now.toISOString(),
    })
  } catch (error: any) {
    console.error('Erreur finalisation:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
