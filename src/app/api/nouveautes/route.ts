export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseSupabaseUrl, getSignedUrl } from '@/lib/supabase'

/**
 * Lazy finalization: auto-finalize expired auctions that the daily cron
 * hasn't processed yet. This ensures beats appear in Nouveautés immediately
 * after their auction ends, without waiting for the midnight cron.
 */
async function lazyFinalizeExpiredAuctions(playlistId: string) {
  const now = new Date()

  // Find auctions that have expired but haven't been finalized yet
  const expiredAuctions = await prisma.auction.findMany({
    where: {
      endTime: { lte: now },
      status: { in: ['ACTIVE', 'ENDING_SOON'] },
    },
    include: {
      beat: { select: { id: true, title: true, producerId: true } },
      bids: {
        orderBy: { amount: 'desc' },
        take: 1,
        select: { userId: true, amount: true, finalAmount: true, licenseType: true },
      },
    },
  })

  let finalized = 0

  for (const auction of expiredAuctions) {
    try {
      const topBid = auction.bids[0]

      await prisma.$transaction(async (tx) => {
        if (topBid) {
          const reserveMet = !auction.reservePrice || topBid.amount >= auction.reservePrice

          if (reserveMet) {
            // Winner exists and reserve met — set payment deadline (48h)
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
                  Math.round(topBid.finalAmount * (1 - auction.commissionPercent / 100) * 100) / 100,
                paymentDeadline: new Date(now.getTime() + PAYMENT_DEADLINE_HOURS * 60 * 60 * 1000),
              },
            })

            // Notify winner
            await tx.notification.create({
              data: {
                type: 'AUCTION_WON',
                title: 'Felicitations ! Vous avez gagne !',
                message: `Vous avez remporte "${auction.beat.title}" pour ${topBid.finalAmount}€. Procedez au paiement.`,
                link: `/checkout/${auction.id}`,
                userId: topBid.userId,
              },
            })

            // Notify producer
            await tx.notification.create({
              data: {
                type: 'AUCTION_ENDED',
                title: 'Enchere terminee !',
                message: `Votre beat "${auction.beat.title}" a ete vendu pour ${topBid.finalAmount}€. Paiement en attente.`,
                link: '/dashboard',
                userId: auction.beat.producerId,
              },
            })
          } else {
            // Reserve not met — end auction and add to Nouveautés
            await tx.auction.update({
              where: { id: auction.id },
              data: { status: 'ENDED' },
            })

            await tx.notification.create({
              data: {
                type: 'AUCTION_ENDED',
                title: 'Enchere terminee sans vente',
                message: `Le prix de reserve n'a pas ete atteint pour "${auction.beat.title}".`,
                link: '/dashboard',
                userId: auction.beat.producerId,
              },
            })

            // Add to Nouveautés playlist
            const alreadyIn = await tx.playlistBeat.findFirst({
              where: { playlistId, beatId: auction.beatId },
            })
            if (!alreadyIn) {
              const maxPos = await tx.playlistBeat.aggregate({
                where: { playlistId },
                _max: { position: true },
              })
              await tx.playlistBeat.create({
                data: {
                  playlistId,
                  beatId: auction.beatId,
                  position: (maxPos._max.position ?? -1) + 1,
                },
              })
            }
          }
        } else {
          // No bids at all — end auction and add to Nouveautés
          await tx.auction.update({
            where: { id: auction.id },
            data: { status: 'ENDED' },
          })

          await tx.notification.create({
            data: {
              type: 'AUCTION_ENDED',
              title: 'Enchere terminee sans enchere',
              message: `Aucune enchere placee sur "${auction.beat.title}".`,
              link: '/dashboard',
              userId: auction.beat.producerId,
            },
          })

          // Add to Nouveautés playlist
          const alreadyIn = await tx.playlistBeat.findFirst({
            where: { playlistId, beatId: auction.beatId },
          })
          if (!alreadyIn) {
            const maxPos = await tx.playlistBeat.aggregate({
              where: { playlistId },
              _max: { position: true },
            })
            await tx.playlistBeat.create({
              data: {
                playlistId,
                beatId: auction.beatId,
                position: (maxPos._max.position ?? -1) + 1,
              },
            })
          }
        }
      })

      finalized++
    } catch (err) {
      console.error(`[LazyFinalize] Error finalizing auction ${auction.id}:`, err)
    }
  }

  // Also check for expired payment deadlines
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
        await tx.auction.update({
          where: { id: expired.id },
          data: {
            winnerId: null,
            winningLicense: null,
            finalPrice: null,
            commissionAmount: null,
            producerPayout: null,
            paymentDeadline: null,
          },
        })

        if (expired.winnerId) {
          await tx.notification.create({
            data: {
              type: 'SYSTEM',
              title: 'Delai de paiement expire',
              message: `Votre delai de paiement pour "${expired.beat.title}" a expire.`,
              link: '/dashboard?tab=purchases',
              userId: expired.winnerId,
            },
          })
        }

        await tx.notification.create({
          data: {
            type: 'AUCTION_ENDED',
            title: 'Paiement non recu',
            message: `Le gagnant n'a pas paye pour "${expired.beat.title}". Le beat est remis en vente.`,
            link: '/dashboard',
            userId: expired.beat.producerId,
          },
        })

        const alreadyIn = await tx.playlistBeat.findFirst({
          where: { playlistId, beatId: expired.beat.id },
        })
        if (!alreadyIn) {
          const maxPos = await tx.playlistBeat.aggregate({
            where: { playlistId },
            _max: { position: true },
          })
          await tx.playlistBeat.create({
            data: {
              playlistId,
              beatId: expired.beat.id,
              position: (maxPos._max.position ?? -1) + 1,
            },
          })
        }
      })
      finalized++
    } catch (err) {
      console.error(`[LazyFinalize] Error processing expired deadline ${expired.id}:`, err)
    }
  }

  return finalized
}

// GET /api/nouveautes — Recuperer les beats de la playlist "Nouveautes"
export async function GET() {
  try {
    // Trouver ou créer la playlist "Nouveautes" publique
    let playlist = await prisma.playlist.findFirst({
      where: {
        name: 'Nouveautés',
        visibility: 'PUBLIC',
      },
      select: { id: true },
    })

    if (!playlist) {
      const admin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true },
      })
      if (admin) {
        playlist = await prisma.playlist.create({
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

    if (!playlist) {
      return NextResponse.json({ beats: [] })
    }

    // Lazy finalize any expired auctions before returning results
    await lazyFinalizeExpiredAuctions(playlist.id)

    // Now fetch the full playlist with beats
    const fullPlaylist = await prisma.playlist.findUnique({
      where: { id: playlist.id },
      include: {
        beats: {
          orderBy: { addedAt: 'desc' },
          include: {
            beat: {
              include: {
                producer: {
                  select: {
                    id: true,
                    name: true,
                    displayName: true,
                    avatar: true,
                  },
                },
                auctions: {
                  where: {
                    status: { in: ['ACTIVE', 'ENDING_SOON', 'SCHEDULED'] },
                  },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    })

    if (!fullPlaylist) {
      return NextResponse.json({ beats: [] })
    }

    // Filtrer: exclure les beats en encheres actives ou deja vendus
    const availableBeats = fullPlaylist.beats
      .filter((pb) => pb.beat.auctions.length === 0 && pb.beat.status !== 'SOLD')

    // Recuperer les prix de base pour chaque beat (startPrice de la derniere enchere)
    const beatsWithPrices = await Promise.all(
      availableBeats.map(async (pb) => {
        const lastAuction = await prisma.auction.findFirst({
          where: {
            beatId: pb.beat.id,
            status: { in: ['ENDED', 'COMPLETED', 'CANCELLED'] },
          },
          orderBy: { endTime: 'desc' },
          select: { startPrice: true, buyNowPrice: true },
        })

        // Generate signed URL for audio streaming if stored in Supabase
        let streamUrl = pb.beat.audioUrl
        if (streamUrl) {
          const parsed = parseSupabaseUrl(streamUrl)
          if (parsed) {
            const signed = await getSignedUrl(parsed.bucket, parsed.path, 3600)
            if (signed) streamUrl = signed
          }
        }

        return {
          id: pb.beat.id,
          title: pb.beat.title,
          genre: (pb.beat as any).genre || 'Trap',
          bpm: (pb.beat as any).bpm || 140,
          key: (pb.beat as any).key || null,
          mood: (pb.beat as any).mood || null,
          duration: (pb.beat as any).duration || null,
          coverImage: (pb.beat as any).coverImage || null,
          audioUrl: streamUrl,
          plays: (pb.beat as any).plays || 0,
          producer: pb.beat.producer,
          basePrice: lastAuction?.buyNowPrice || lastAuction?.startPrice || 20,
          addedAt: pb.addedAt,
        }
      })
    )

    return NextResponse.json({
      beats: beatsWithPrices,
      playlistId: fullPlaylist.id,
      total: beatsWithPrices.length,
    })
  } catch (error) {
    console.error('Erreur API nouveautes:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
