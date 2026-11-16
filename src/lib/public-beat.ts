import { prisma } from '@/lib/prisma'
import { PUBLIC_BEAT_WHERE } from '@/lib/public-catalog'
import { getConfiguredLicensePrices } from '@/lib/beat-pricing'
import { getLegacyBeatFileType } from '@/lib/legacy-beat-files'
import { normalizeBeatSaleMode, type BeatSaleMode } from '@/lib/beat-sale-mode'
import { getStreamUrl, parseSupabaseUrl } from '@/lib/supabase'

/**
 * Données publiques d'un beat pour sa page indexable `/beat/[id]`.
 *
 * Ne contient JAMAIS les URL des fichiers payants (MP3/WAV complets, stems) :
 * seulement l'aperçu public de 60 s et des indicateurs de disponibilité.
 */

export type PublicLicense = 'BASIC' | 'PREMIUM' | 'EXCLUSIVE'

export type PublicBeatOffer = { type: PublicLicense; price: number }

export type PublicBeat = {
  id: string
  title: string
  description: string | null
  genre: string
  mood: string | null
  bpm: number
  key: string | null
  tags: string[]
  duration: number | null
  coverImage: string | null
  previewUrl: string | null
  plays: number
  createdAt: string
  updatedAt: string
  saleMode: BeatSaleMode
  producer: { id: string; name: string; avatar: string | null }
  /** Licences achetables directement (vide si une enchère est en cours ou programmée). */
  offers: PublicBeatOffer[]
  liveAuction: {
    id: string
    currentBid: number
    endTime: string
    buyNowPrice: number | null
  } | null
  upcomingAuction: { id: string; startTime: string; startPrice: number } | null
}

const ENGAGED_AUCTION_STATUSES = ['ACTIVE', 'ENDING_SOON', 'SCHEDULED']

const PUBLIC_BEAT_SELECT = {
  id: true,
  title: true,
  description: true,
  genre: true,
  mood: true,
  bpm: true,
  key: true,
  tags: true,
  duration: true,
  coverImage: true,
  audioUrl: true,
  plays: true,
  createdAt: true,
  updatedAt: true,
  saleMode: true,
  priceMp3: true,
  priceWav: true,
  priceStems: true,
  // Lus uniquement pour savoir quelles licences sont livrables, jamais renvoyés.
  audioOriginal: true,
  audioWav: true,
  stemsUrl: true,
  stemsFiles: true,
  producer: { select: { id: true, name: true, displayName: true, avatar: true } },
  auctions: {
    where: { status: { in: ENGAGED_AUCTION_STATUSES } },
    select: {
      id: true,
      status: true,
      startTime: true,
      endTime: true,
      currentBid: true,
      startPrice: true,
      buyNowPrice: true,
    },
    orderBy: { startTime: 'asc' as const },
  },
}

export type PublicBeatRow = {
  id: string
  title: string
  description: string | null
  genre: string
  mood: string | null
  bpm: number
  key: string | null
  tags: string
  duration: number | null
  coverImage: string | null
  audioUrl: string
  plays: number
  createdAt: Date
  updatedAt: Date
  saleMode: string
  priceMp3: number | null
  priceWav: number | null
  priceStems: number | null
  audioOriginal: string | null
  audioWav: string | null
  stemsUrl: string | null
  stemsFiles: string | null
  producer: { id: string; name: string; displayName: string | null; avatar: string | null }
  auctions: Array<{
    id: string
    status: string
    startTime: Date
    endTime: Date
    currentBid: number
    startPrice: number
    buyNowPrice: number | null
  }>
}

export function parseBeatTags(raw: string | null | undefined): string[] {
  if (!raw || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 15)
    }
  } catch {
    // Anciens beats : tags séparés par des virgules.
  }
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 15)
}

/** Transformation pure (testable) d'une ligne de base en données publiques. */
export function toPublicBeat(
  row: PublicBeatRow,
  previewUrl: string | null,
  now: Date = new Date()
): PublicBeat {
  const saleMode = normalizeBeatSaleMode(row.saleMode)

  const liveAuction =
    row.auctions.find(
      (a) =>
        (a.status === 'ACTIVE' || a.status === 'ENDING_SOON') &&
        a.startTime <= now &&
        a.endTime > now
    ) || null
  const upcomingAuction = liveAuction
    ? null
    : row.auctions.find((a) => a.status === 'SCHEDULED' || a.startTime > now) || null

  // Même règle que l'API d'achat : une enchère engagée bloque l'achat direct.
  let offers: PublicBeatOffer[] = []
  if (row.auctions.length === 0) {
    const legacyFileType = getLegacyBeatFileType(row.audioUrl)
    const prices = getConfiguredLicensePrices(row)
    const available: Record<PublicLicense, boolean> = {
      BASIC: Boolean(row.audioOriginal || legacyFileType === 'mp3'),
      PREMIUM: Boolean(row.audioWav || legacyFileType === 'wav'),
      EXCLUSIVE: saleMode !== 'LEASING' && Boolean(row.stemsUrl || row.stemsFiles),
    }
    offers = (['BASIC', 'PREMIUM', 'EXCLUSIVE'] as const).flatMap((type) => {
      const price = prices[type]
      return price !== null && available[type] ? [{ type, price }] : []
    })
  }

  return {
    id: row.id,
    title: row.title.trim(),
    description: row.description?.trim() || null,
    genre: row.genre,
    mood: row.mood,
    bpm: row.bpm,
    key: row.key,
    tags: parseBeatTags(row.tags),
    duration: row.duration,
    coverImage: row.coverImage,
    previewUrl,
    plays: row.plays,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    saleMode,
    producer: {
      id: row.producer.id,
      name: row.producer.displayName || row.producer.name,
      avatar: row.producer.avatar,
    },
    offers,
    liveAuction: liveAuction
      ? {
          id: liveAuction.id,
          currentBid: liveAuction.currentBid,
          endTime: liveAuction.endTime.toISOString(),
          buyNowPrice: liveAuction.buyNowPrice,
        }
      : null,
    upcomingAuction: upcomingAuction
      ? {
          id: upcomingAuction.id,
          startTime: upcomingAuction.startTime.toISOString(),
          startPrice: upcomingAuction.startPrice,
        }
      : null,
  }
}

function resolvePreviewUrl(audioUrl: string | null): string | null {
  if (!audioUrl) return null
  const parsed = parseSupabaseUrl(audioUrl)
  return parsed ? getStreamUrl(parsed.bucket, parsed.path) : audioUrl
}

/** Beat public (validé, producteur approuvé) ou null. */
export async function getPublicBeat(id: string): Promise<PublicBeat | null> {
  const row = await prisma.beat.findFirst({
    where: { AND: [PUBLIC_BEAT_WHERE, { id }] },
    select: PUBLIC_BEAT_SELECT,
  })
  if (!row) return null
  return toPublicBeat(row as PublicBeatRow, resolvePreviewUrl(row.audioUrl))
}

function formatEuro(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(2)} €`
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/** Titre et description pour Google (le suffixe « | 318 LEGAACY » est ajouté par le layout). */
export function buildBeatSeo(beat: PublicBeat): { title: string; description: string } {
  const descriptor = [`Beat ${beat.genre}`, beat.bpm ? `${beat.bpm} BPM` : null]
    .filter(Boolean)
    .join(' ')
  const title = `${beat.title} — ${descriptor} par ${beat.producer.name}`

  const lowestPrice = beat.offers.length > 0 ? Math.min(...beat.offers.map((o) => o.price)) : null
  const priceText =
    lowestPrice !== null
      ? ` Licence dès ${formatEuro(lowestPrice)}.`
      : beat.liveAuction
        ? ` En enchère, offre actuelle ${formatEuro(beat.liveAuction.currentBid)}.`
        : ''

  const base =
    beat.description ||
    `Écoute « ${beat.title} », instrumentale ${beat.genre} à ${beat.bpm} BPM${
      beat.key ? ` en ${beat.key}` : ''
    } produite par ${beat.producer.name} sur 318 LEGAACY Marketplace.`

  // Le prix passe en priorité : on raccourcit la description, pas l'information d'achat.
  const description = priceText
    ? `${truncate(base, 160 - priceText.length)}${priceText}`
    : truncate(base, 160)

  return { title, description }
}

/** Durée ISO 8601 (schema.org), ex. 154 s → PT2M34S. */
export function toIsoDuration(seconds: number | null | undefined): string | undefined {
  if (!seconds || seconds <= 0) return undefined
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `PT${m > 0 ? `${m}M` : ''}${s > 0 || m === 0 ? `${s}S` : ''}`
}
