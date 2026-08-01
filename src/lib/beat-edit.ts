import { z } from 'zod'

export const AUCTION_DURATION_OPTIONS = [0.25, 0.5, 1, 6, 12, 24, 48, 72, 168] as const
export const AUCTION_EXTENSION_OPTIONS = [1, 3, 6, 12, 24, 48] as const

export const updateBeatSchema = z
  .object({
    title: z.string().trim().min(1, 'Titre requis').max(100, 'Titre trop long'),
    description: z.string().trim().max(500, 'Description trop longue').nullable().optional(),
    genre: z.string().trim().min(1, 'Genre requis').max(50, 'Genre trop long'),
    mood: z.string().trim().max(50, 'Ambiance trop longue').nullable().optional(),
    bpm: z.number().int().min(40, 'BPM minimum : 40').max(300, 'BPM maximum : 300'),
    key: z.string().trim().max(20, 'Tonalité trop longue').nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(10, 'Maximum 10 tags'),
    priceMp3: z.number().positive('Le prix MP3 doit être supérieur à 0').max(100000).nullable(),
    priceWav: z.number().positive('Le prix WAV doit être supérieur à 0').max(100000).nullable(),
    auction: z
      .object({
        startPrice: z.number().positive('Le prix de départ doit être supérieur à 0').max(100000),
        buyNowPrice: z
          .number()
          .positive("Le prix d'achat immédiat doit être supérieur à 0")
          .max(100000)
          .nullable(),
        durationHours: z
          .number()
          .min(0.25, 'Durée minimum : 15 minutes')
          .max(168, 'Durée maximum : 7 jours'),
        startAt: z.string().datetime().nullable(),
      })
      .nullable(),
  })
  .superRefine((data, context) => {
    if (data.auction?.buyNowPrice && data.auction.buyNowPrice <= data.auction.startPrice) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['auction', 'buyNowPrice'],
        message: "Le prix d'achat immédiat doit être supérieur au prix de départ",
      })
    }
  })

interface EditPolicyInput {
  beatStatus: string
  rejectionType?: string | null
  auctionStatus?: string | null
  totalBids?: number
  auctionEndTime?: Date | string | null
  now?: Date
}

export interface BeatEditCapabilities {
  canEditMetadata: boolean
  canEditAuctionSettings: boolean
  canExtendAuction: boolean
  lockedReason: string | null
}

export function getBeatEditCapabilities(input: EditPolicyInput): BeatEditCapabilities {
  const {
    beatStatus,
    rejectionType,
    auctionStatus,
    totalBids = 0,
    auctionEndTime,
    now = new Date(),
  } = input

  if (beatStatus === 'SOLD') {
    return {
      canEditMetadata: false,
      canEditAuctionSettings: false,
      canExtendAuction: false,
      lockedReason: 'Ce beat a été vendu et ne peut plus être modifié.',
    }
  }

  if (beatStatus === 'ARCHIVED') {
    return {
      canEditMetadata: false,
      canEditAuctionSettings: false,
      canExtendAuction: false,
      lockedReason: 'Ce beat est archivé.',
    }
  }

  if (beatStatus === 'REJECTED') {
    return {
      canEditMetadata: false,
      canEditAuctionSettings: false,
      canExtendAuction: false,
      lockedReason:
        rejectionType === 'CHANGES_REQUESTED'
          ? 'Utilise « Corriger et renvoyer » pour soumettre une nouvelle version à validation.'
          : 'Ce beat a été refusé définitivement.',
    }
  }

  const auctionIsLive = ['ACTIVE', 'ENDING_SOON'].includes(auctionStatus || '')
  const auctionStillOpen = !auctionEndTime || new Date(auctionEndTime).getTime() > now.getTime()
  const hasLiveBids = auctionIsLive && totalBids > 0

  return {
    // Après une première mise, les informations publiques restent figées pour
    // ne pas modifier l'objet sur lequel les artistes ont déjà enchéri.
    canEditMetadata: !hasLiveBids,
    canEditAuctionSettings:
      totalBids === 0 && ['PENDING_APPROVAL', 'SCHEDULED'].includes(auctionStatus || ''),
    canExtendAuction: auctionIsLive && auctionStillOpen,
    lockedReason: hasLiveBids
      ? 'Une enchère a déjà été placée : seules les prolongations sont encore possibles.'
      : null,
  }
}
