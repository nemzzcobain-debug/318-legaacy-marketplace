import { Prisma } from '@prisma/client'

/**
 * Règles uniques de visibilité du catalogue public.
 *
 * Un beat public doit avoir été validé par l'administration et appartenir à
 * un producteur lui-même approuvé.
 */
export const PUBLIC_BEAT_WHERE: Prisma.BeatWhereInput = {
  status: 'ACTIVE',
  producer: {
    producerStatus: 'APPROVED',
  },
}

/**
 * Conditions communes à toutes les enchères visibles publiquement.
 */
export const PUBLIC_AUCTION_VISIBILITY_WHERE: Prisma.AuctionWhereInput = {
  beat: PUBLIC_BEAT_WHERE,
}

/**
 * Une enchère "live" a démarré, n'est pas expirée et possède un statut actif.
 */
export function getPublicLiveAuctionWhere(now = new Date()): Prisma.AuctionWhereInput {
  return {
    AND: [
      PUBLIC_AUCTION_VISIBILITY_WHERE,
      {
        status: { in: ['ACTIVE', 'ENDING_SOON'] },
        startTime: { lte: now },
        endTime: { gt: now },
      },
    ],
  }
}

/**
 * Un beat choisi par l'administration reste dans la sélection de la semaine
 * tant qu'il est public, même entre deux enchères ou avant sa mise en achat
 * direct.
 */
export function getPublicFeaturedBeatWhere(): Prisma.BeatWhereInput {
  return {
    AND: [PUBLIC_BEAT_WHERE, { isFeatured: true }],
  }
}

/**
 * Combine les règles publiques avec des filtres spécifiques à un écran sans
 * risquer d'écraser la condition imbriquée `beat`.
 */
export function combinePublicAuctionWhere(
  ...filters: Prisma.AuctionWhereInput[]
): Prisma.AuctionWhereInput {
  return {
    AND: [PUBLIC_AUCTION_VISIBILITY_WHERE, ...filters],
  }
}
