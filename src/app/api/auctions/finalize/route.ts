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
    // Verification par secret API (pour cron jobs Vercel)
    // POST requests from client-side are allowed (safe: only finalizes expired auctions)
    // GET requests require cron secret or admin session
    if (req.method === 'GET') {
      const authHeader = req.headers.get('authorization')
      const cronSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET

      if (authHeader !== `Bearer ${cronSecret}`) {
        const { getServerSession } = await import('next-auth')
        const { authOptions } = await import('@/lib/auth')
        const session = await getServerSession(authOptions)

        if (!session?.user || (session.user as any).role !== 'ADMIN') {
          return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
        }
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

        if (topBid) {
          // Il y a un gagnant
          const reserveMet = !auction.reservePrice || topBid.amount >= auction.reservePrice

          if (reserveMet) {
            // Enchere gagnee — en attente de paiement
            await prisma.auction.update({
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
            await prisma.notification.create({
              data: {
                type: 'AUCTION_WON',
                title: 'Felicitations ! Vous avez gagne !',
                message: `Vous avez remporte "${auction.beat.title}" pour ${topBid.finalAmount}\u20AC. Procedez au paiement pour obtenir votre beat.`,
                link: `/checkout/${auction.id}`,
                userId: topBid.userId,
              },
            })

            // Notifier le producteur
            await prisma.notification.create({
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
            await prisma.auction.update({
              where: { id: auction.id },
              data: { status: 'ENDED' },
            })

            // Notifier le producteur
            await prisma.notification.create({
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
          await prisma.auction.update({
            where: { id: auction.id },
            data: { status: 'ENDED' },
          })

          await prisma.notification.create({
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
      { error: error.message || 'Erreur lors de la finalisation' },
      { status: 500 }
    )
  }
}
