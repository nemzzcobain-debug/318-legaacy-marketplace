export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  sendAuctionWonEmail,
  sendProducerAuctionEndedEmail,
} from '@/lib/emails/resend'
import { sendPushToUser } from '@/lib/web-push'
import { suspendExpiredStripeGraceProducers } from '@/lib/producer-stripe-access'

type ProducerAuctionAlert = {
  userId: string
  email: string | null
  producerName: string
  beatTitle: string
  auctionId: string
  outcome: 'WINNING_BID' | 'RESERVE_NOT_MET' | 'NO_BIDS' | 'PAYMENT_EXPIRED'
  finalPrice?: number
  expectedPayout?: number
  highestBid?: number
}

type WinnerAuctionAlert = {
  userId: string
  email: string | null
  winnerName: string
  beatTitle: string
  producerName: string
  finalPrice: number
  license: string
  auctionId: string
}

async function deliverProducerAuctionAlert(alert: ProducerAuctionAlert) {
  const isWinningBid = alert.outcome === 'WINNING_BID'
  const title = isWinningBid
    ? 'Ton enchère a reçu une offre gagnante'
    : alert.outcome === 'RESERVE_NOT_MET'
      ? 'Enchère terminée sans vente'
      : alert.outcome === 'PAYMENT_EXPIRED'
        ? 'Le paiement du gagnant a expiré'
        : 'Enchère terminée sans offre'
  const body = isWinningBid
    ? `« ${alert.beatTitle} » s’est terminé à ${alert.finalPrice} EUR. Paiement du gagnant en attente.`
    : alert.outcome === 'RESERVE_NOT_MET'
      ? `Le prix de réserve de « ${alert.beatTitle} » n’a pas été atteint.`
      : alert.outcome === 'PAYMENT_EXPIRED'
        ? `Le gagnant n’a pas payé « ${alert.beatTitle} ». Le beat est remis en vente.`
        : `Aucune offre n’a été placée sur « ${alert.beatTitle} ».`

  const deliveries: Promise<unknown>[] = [
    sendPushToUser(alert.userId, {
      title,
      body,
      url: `/auction/${alert.auctionId}`,
      tag: `producer-auction-ended-${alert.auctionId}`,
    }),
  ]

  if (alert.email) {
    deliveries.push(
      sendProducerAuctionEndedEmail({
        to: alert.email,
        producerName: alert.producerName,
        beatTitle: alert.beatTitle,
        auctionId: alert.auctionId,
        outcome: alert.outcome,
        finalPrice: alert.finalPrice,
        expectedPayout: alert.expectedPayout,
        highestBid: alert.highestBid,
      })
    )
  }

  const results = await Promise.allSettled(deliveries)
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[FINALIZE] Alerte producteur non envoyée:', String(result.reason))
    }
  }
}

async function deliverWinnerAuctionAlert(alert: WinnerAuctionAlert) {
  const deliveries: Promise<unknown>[] = [
    sendPushToUser(alert.userId, {
      title: 'Tu as gagné une enchère !',
      body: `Tu as remporté « ${alert.beatTitle} » pour ${alert.finalPrice} EUR. Finalise le paiement sous 48 heures.`,
      url: `/checkout/${alert.auctionId}`,
      tag: `auction-won-${alert.auctionId}`,
    }),
  ]

  if (alert.email) {
    deliveries.push(
      sendAuctionWonEmail({
        to: alert.email,
        winnerName: alert.winnerName,
        beatTitle: alert.beatTitle,
        producerName: alert.producerName,
        finalPrice: alert.finalPrice,
        license: alert.license,
        auctionId: alert.auctionId,
      })
    )
  }

  const results = await Promise.allSettled(deliveries)
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[FINALIZE] Alerte gagnant non envoyée:', String(result.reason))
    }
  }
}

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
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      }
    }

    const now = new Date()
    let stripeGraceEnforcement = { checked: 0, suspended: 0 }
    try {
      stripeGraceEnforcement = await suspendExpiredStripeGraceProducers(now)
    } catch (error) {
      // La finalisation des enchères ne doit jamais être interrompue par Stripe.
      console.error('[CRON] Contrôle du délai Stripe impossible:', error)
    }
    let repairedPrematureFinalizations = 0

    // Réparer une éventuelle course entre une mise anti-snipe et le cron :
    // l'ancienne version pouvait finaliser une enchère, puis conserver sa
    // nouvelle endTime située dans le futur.
    const prematurelyEnded = await prisma.auction.findMany({
      where: {
        status: 'ENDED',
        endTime: { gt: now },
        winnerId: { not: null },
        paidAt: null,
        paymentDeadline: { not: null },
      },
      select: {
        id: true,
        endTime: true,
        winnerId: true,
        beat: { select: { producerId: true } },
      },
    })

    for (const auction of prematurelyEnded) {
      let didRepair = false
      await prisma.$transaction(async (tx) => {
        const updateResult = await tx.auction.updateMany({
          where: {
            id: auction.id,
            status: 'ENDED',
            endTime: { gt: now },
            winnerId: auction.winnerId,
            paidAt: null,
            paymentDeadline: { not: null },
          },
          data: {
            status:
              auction.endTime.getTime() - now.getTime() <= 10 * 60 * 1000
                ? 'ENDING_SOON'
                : 'ACTIVE',
            winnerId: null,
            winningLicense: null,
            finalPrice: null,
            commissionAmount: null,
            producerPayout: null,
            paymentDeadline: null,
          },
        })
        if (updateResult.count === 0) return

        didRepair = true
        await tx.notification.deleteMany({
          where: {
            OR: [
              {
                userId: auction.winnerId!,
                type: 'AUCTION_WON',
                link: `/checkout/${auction.id}`,
              },
              {
                userId: auction.beat.producerId,
                type: 'AUCTION_ENDED',
                link: `/auction/${auction.id}`,
                title: 'Enchere terminée !',
              },
            ],
          },
        })
      })

      if (didRepair) repairedPrematureFinalizations++
    }

    // Activer les encheres programmees dont l'heure de demarrage est arrivee
    let activated = 0
    try {
      const toActivate = await prisma.auction.findMany({
        where: { status: 'SCHEDULED', startTime: { lte: now } },
        include: { beat: { include: { producer: true } } },
      })

      for (const a of toActivate) {
        await prisma.auction.update({
          where: { id: a.id },
          data: { status: 'ACTIVE' },
        })
        activated++

        try {
          const producerName = a.beat.producer.displayName || a.beat.producer.name
          const followers = await prisma.follow.findMany({
            where: { followingId: a.beat.producerId },
            select: { followerId: true },
          })
          if (followers.length > 0) {
            await prisma.notification.createMany({
              data: followers.map((f) => ({
                type: 'NEW_AUCTION',
                title: 'Enchere ouverte : ' + a.beat.title,
                message:
                  "L'enchere de " + producerName + ' sur ' + a.beat.title + ' vient de demarrer',
                link: '/auction/' + a.id,
                userId: f.followerId,
              })),
            })
          }
        } catch (notifErr) {
          console.warn('[FINALIZE] Notif demarrage echouee:', String(notifErr))
        }
      }
    } catch (activateErr) {
      console.error('[FINALIZE] Activation encheres programmees echouee:', String(activateErr))
    }

    // Trouver toutes les enchères expirées mais pas encore finalisées
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

    // TASK50: Vérifier les enchères ENDED avec paymentDeadline dépassée (gagnant n'a pas payé)
    const expiredDeadlines = await prisma.auction.findMany({
      where: {
        status: 'ENDED',
        winnerId: { not: null },
        paidAt: null,
        paymentDeadline: { lte: now },
      },
      include: {
        beat: {
          select: {
            id: true,
            title: true,
            producerId: true,
            producer: {
              select: { email: true, name: true, displayName: true },
            },
          },
        },
      },
    })

    for (const expired of expiredDeadlines) {
      try {
        let didExpirePayment = false
        await prisma.$transaction(async (tx) => {
          // La condition est répétée au moment de l'écriture pour ne jamais
          // annuler un achat payé pendant que le cron était en cours.
          const updateResult = await tx.auction.updateMany({
            where: {
              id: expired.id,
              status: 'ENDED',
              winnerId: expired.winnerId,
              paidAt: null,
              paymentDeadline: { lte: now },
            },
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
          if (updateResult.count === 0) return
          didExpirePayment = true

          // Notifier l'ancien gagnant
          if (expired.winnerId) {
            await tx.notification.create({
              data: {
                type: 'SYSTEM',
                title: 'Délai de paiement expiré',
                message: `Votre délai de paiement pour "${expired.beat.title}" a expiré. L'achat a été annulé.`,
                link: '/dashboard?tab=purchases',
                userId: expired.winnerId,
              },
            })
          }

          // Notifier le producteur
          await tx.notification.create({
            data: {
              type: 'AUCTION_ENDED',
              title: 'Paiement non reçu',
              message: `Le gagnant n'a pas payé pour "${expired.beat.title}". Le beat est remis en vente dans Nouveautes.`,
              link: `/nouveautes?beat=${expired.beat.id}`,
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

        if (didExpirePayment) {
          results.expiredPayments++
          await deliverProducerAuctionAlert({
            userId: expired.beat.producerId,
            email: expired.beat.producer.email,
            producerName:
              expired.beat.producer.displayName || expired.beat.producer.name,
            beatTitle: expired.beat.title,
            auctionId: expired.id,
            outcome: 'PAYMENT_EXPIRED',
          })
        }
      } catch (err) {
        console.error(`Erreur expiration deadline ${expired.id}:`, String(err))
        results.errors++
      }
    }

    for (const auction of expiredAuctions) {
      try {
        const topBid = auction.bids[0]
        let didFinalize = false
        let producerAlert: ProducerAuctionAlert | null = null
        let winnerAlert: WinnerAuctionAlert | null = null

        await prisma.$transaction(async (tx) => {
          if (topBid) {
            // Il y a un gagnant
            const reserveMet = !auction.reservePrice || topBid.amount >= auction.reservePrice

            if (reserveMet) {
              // Enchere gagnée — en attente de paiement (48h deadline)
              const PAYMENT_DEADLINE_HOURS = 48
              const updateResult = await tx.auction.updateMany({
                where: {
                  id: auction.id,
                  status: { in: ['ACTIVE', 'ENDING_SOON'] },
                  endTime: { lte: now },
                  currentBid: auction.currentBid,
                },
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
                  paymentDeadline: new Date(
                    now.getTime() + PAYMENT_DEADLINE_HOURS * 60 * 60 * 1000
                  ),
                },
              })
              if (updateResult.count === 0) return
              didFinalize = true

              // Notifier le gagnant
              await tx.notification.create({
                data: {
                  type: 'AUCTION_WON',
                  title: 'Félicitations ! Vous avez gagné !',
                  message: `Vous avez remporté "${auction.beat.title}" pour ${topBid.finalAmount}\u20AC. Procedez au paiement pour obtenir votre beat.`,
                  link: `/checkout/${auction.id}`,
                  userId: topBid.userId,
                },
              })

              // Notifier le producteur
              await tx.notification.create({
                data: {
                  type: 'AUCTION_ENDED',
                  title: 'Enchere terminée !',
                  message: `Votre beat "${auction.beat.title}" a été vendu pour ${topBid.finalAmount}\u20AC. Paiement en attente.`,
                  link: `/auction/${auction.id}`,
                  userId: auction.beat.producerId,
                },
              })

              producerAlert = {
                userId: auction.beat.producerId,
                email: auction.beat.producer.email,
                producerName:
                  auction.beat.producer.displayName || auction.beat.producer.name,
                beatTitle: auction.beat.title,
                auctionId: auction.id,
                outcome: 'WINNING_BID',
                finalPrice: topBid.finalAmount,
                expectedPayout:
                  Math.round(
                    topBid.finalAmount *
                      (1 - auction.commissionPercent / 100) *
                      100
                  ) / 100,
              }
              winnerAlert = {
                userId: topBid.userId,
                email: topBid.user.email,
                winnerName: topBid.user.displayName || topBid.user.name,
                beatTitle: auction.beat.title,
                producerName:
                  auction.beat.producer.displayName || auction.beat.producer.name,
                finalPrice: topBid.finalAmount,
                license: topBid.licenseType,
                auctionId: auction.id,
              }

              results.withWinner++
            } else {
              // Reserve non atteinte
              const updateResult = await tx.auction.updateMany({
                where: {
                  id: auction.id,
                  status: { in: ['ACTIVE', 'ENDING_SOON'] },
                  endTime: { lte: now },
                  currentBid: auction.currentBid,
                },
                data: { status: 'ENDED' },
              })
              if (updateResult.count === 0) return
              didFinalize = true

              // Notifier le producteur
              await tx.notification.create({
                data: {
                  type: 'AUCTION_ENDED',
                  title: 'Enchere terminée sans vente',
                  message: `Le prix de réserve n'a pas été atteint pour "${auction.beat.title}". Enchère max: ${topBid.finalAmount}\u20AC.`,
                  link: `/auction/${auction.id}`,
                  userId: auction.beat.producerId,
                },
              })

              producerAlert = {
                userId: auction.beat.producerId,
                email: auction.beat.producer.email,
                producerName:
                  auction.beat.producer.displayName || auction.beat.producer.name,
                beatTitle: auction.beat.title,
                auctionId: auction.id,
                outcome: 'RESERVE_NOT_MET',
                highestBid: topBid.finalAmount,
              }

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
            // Aucune enchère
            const updateResult = await tx.auction.updateMany({
              where: {
                id: auction.id,
                status: { in: ['ACTIVE', 'ENDING_SOON'] },
                endTime: { lte: now },
                currentBid: auction.currentBid,
              },
              data: { status: 'ENDED' },
            })
            if (updateResult.count === 0) return
            didFinalize = true

            await tx.notification.create({
              data: {
                type: 'AUCTION_ENDED',
                title: 'Enchère terminée sans enchère',
                message: `Aucune enchère placée sur "${auction.beat.title}".`,
                link: `/auction/${auction.id}`,
                userId: auction.beat.producerId,
              },
            })

            producerAlert = {
              userId: auction.beat.producerId,
              email: auction.beat.producer.email,
              producerName:
                auction.beat.producer.displayName || auction.beat.producer.name,
              beatTitle: auction.beat.title,
              auctionId: auction.id,
              outcome: 'NO_BIDS',
            }

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

        if (didFinalize) {
          results.processed++
          const deliveries: Promise<unknown>[] = []
          if (producerAlert) {
            deliveries.push(deliverProducerAuctionAlert(producerAlert))
          }
          if (winnerAlert) {
            deliveries.push(deliverWinnerAuctionAlert(winnerAlert))
          }
          await Promise.allSettled(deliveries)
        }
      } catch (err) {
        console.error(`Erreur finalisation enchère ${auction.id}:`, err)
        results.errors++
      }
    }

    return NextResponse.json({
      message: `${results.processed} enchères finalisées`,
      ...results,
      activated,
      repairedPrematureFinalizations,
      stripeGraceEnforcement,
      timestamp: now.toISOString(),
    })
  } catch (error: any) {
    console.error('Erreur finalisation:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
