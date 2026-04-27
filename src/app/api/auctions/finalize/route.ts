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

    // F11 FIX: Comparaison timing-safe pour éviter les attaques par timing
    const encoder = new TextEncoder()
    const expected = encoder.encode(`Bearer ${cronSecret}`)
    const received = encoder.encode(authHeader || '')

    // Padding pour que les deux buffers aient la même taille (requis par timingSafeEqual)
    const maxLen = Math.max(expected.length, received.length)
    const paddedExpected = new Uint8Array(maxLen)
    const paddedReceived = new Uint8Array(maxLen)
    paddedExpected.set(expected)
    paddedReceived.set(received)

    const { timingSafeEqual } = await import('crypto')
    const isValidCron =
      expected.length === received.length &&
      timingSafeEqual(Buffer.from(paddedExpected), Buffer.from(paddedReceived))

    if (!isValidCron) {
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
      addedToNouveautes: 0,
      expiredPayments: 0,
      errors: 0,
    }

    // Récupérer ou créer la playlist système "Nouveautés"
    // On utilise le premier admin comme propriétaire
    let nouveautesPlaylist: { id: string } | null = null
    try {
      nouveautesPlaylist = await prisma.playlist.findFirst({
        where: { name: 'Nouveautés', visibility: 'PUBLIC' },
        select: { id: true },
      })

      if (!nouveautesPlaylist) {
        const admin = await prisma.user.findFirst({
          where: { role: 'ADMIN' },
          select: { id: true },
        })
        if (admin) {
          nouveautesPlaylist = await prisma.playlist.create({
            data: {
              name: 'Nouveautés',
              description: 'Les derniers beats disponibles sur la plateforme',
              visibility: 'PUBLIC',
              userId: admin.id,
            },
            select: { id: true },
          })
        }
      }
    } catch (err) {
      console.error('[CRON] Erreur playlist Nouveautés:', err)
    }

    // TASK50: Verifier les encheres ENDED avec paymentDeadline depassee (gagnant n'a pas paye)
    const expiredDeadlines = await prisma.auction.findMany({
      where: {
        status: 'ENDED',
        winnerId: { not: null },
        paidAt: null,
        paymentDeadline: { lte: now },
      },
      include: {
        beat: { select: { id: true, title: true, producerId: true } },
      },
    })

    for (const expired of expiredDeadlines) {
      try {
        await prisma.$transaction(async (tx) => {
          // Annuler le gagnant et remettre en Nouveautes
          await tx.auction.update({
            where: { id: expired.id },
            data: {
              status: 'ENDED',
              winnerId: null,
              winningLicense: null,
              finalPrice: null,
              commissionAmount: null,
              producerPayout: null,
              paymentDeadline: null,
            },
          })

          // Notifier l'ancien gagnant
          if (expired.winnerId) {
            await tx.notification.create({
              data: {
                type: 'SYSTEM',
                title: 'Delai de paiement expire',
                message: `Votre delai de paiement pour "${expired.beat.title}" a expire. L'achat a ete annule.`,
                link: '/dashboard?tab=purchases',
                userId: expired.winnerId,
              },
            })
          }

          // Notifier le producteur
          await tx.notification.create({
            data: {
              type: 'AUCTION_ENDED',
              title: 'Paiement non recu',
              message: `Le gagnant n'a pas paye pour "${expired.beat.title}". Le beat est remis en vente dans Nouveautes.`,
              link: '/dashboard',
              userId: expired.beat.producerId,
            },
          })

          // Ajouter a Nouveautes
          if (nouveautesPlaylist) {
            const alreadyIn = await tx.playlistBeat.findFirst({
              where: { playlistId: nouveautesPlaylist.id, beatId: expired.beat.id },
            })
            if (!alreadyIn) {
              const maxPos = await tx.playlistBeat.aggregate({
                where: { playlistId: nouveautesPlaylist.id },
                _max: { position: true },
              })
              await tx.playlistBeat.create({
                data: {
                  playlistId: nouveautesPlaylist.id,
                  beatId: expired.beat.id,
                  position: (maxPos._max.position ?? -1) + 1,
                },
              })
            }
          }
        })

        results.expiredPayments++
      } catch (err) {
        console.error(`Erreur expiration deadline ${expired.id}:`, String(err))
        results.errors++
      }
    }

    for (const auction of expiredAuctions) {
      try {
        const topBid = auction.bids[0]

        await prisma.$transaction(async (tx) => {
          if (topBid) {
            // Il y a un gagnant
            const reserveMet = !auction.reservePrice || topBid.amount >= auction.reservePrice

            if (reserveMet) {
              // Enchere gagnee — en attente de paiement (48h deadline)
              const PAYMENT_DEADLINE_HOURS = 48
              await tx.auction.update({
                where: { id: auction.id },
                data: {
                  status: 'ENDED',
                  winnerId: topBid.userId,
                  winningLicense: topBid.licenseType,
                  finalPrice: topBid.finalAmount,
                  commissionAmount:
                    Math.round(topBid.finalAmount * (auction.commissionPercent / 100) * 100) / 100,
                  producerPayout:
                    Math.round(topBid.finalAmount * (1 - auction.commissionPercent / 100) * 100) /
                    100,
                  paymentDeadline: new Date(now.getTime() + PAYMENT_DEADLINE_HOURS * 60 * 60 * 1000),
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

              // Ajouter le beat à la playlist "Nouveautés"
              if (nouveautesPlaylist) {
                const alreadyInPlaylist = await tx.playlistBeat.findFirst({
                  where: { playlistId: nouveautesPlaylist.id, beatId: auction.beatId },
                })
                if (!alreadyInPlaylist) {
                  const maxPos = await tx.playlistBeat.aggregate({
                    where: { playlistId: nouveautesPlaylist.id },
                    _max: { position: true },
                  })
                  await tx.playlistBeat.create({
                    data: {
                      playlistId: nouveautesPlaylist.id,
                      beatId: auction.beatId,
                      position: (maxPos._max.position ?? -1) + 1,
                    },
                  })
                  results.addedToNouveautes++
                }
              }

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

            // Ajouter le beat à la playlist "Nouveautés"
            if (nouveautesPlaylist) {
              const alreadyInPlaylist = await tx.playlistBeat.findFirst({
                where: { playlistId: nouveautesPlaylist.id, beatId: auction.beatId },
              })
              if (!alreadyInPlaylist) {
                const maxPos = await tx.playlistBeat.aggregate({
                  where: { playlistId: nouveautesPlaylist.id },
                  _max: { position: true },
                })
                await tx.playlistBeat.create({
                  data: {
                    playlistId: nouveautesPlaylist.id,
                    beatId: auction.beatId,
                    position: (maxPos._max.position ?? -1) + 1,
                  },
                })
                results.addedToNouveautes++
              }
            }

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
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
