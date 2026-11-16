import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { beat: { findFirst: vi.fn() } },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/supabase', () => ({
  parseSupabaseUrl: (url: string) => {
    const match = url.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)$/)
    return match ? { bucket: match[1], path: match[2] } : null
  },
  getStreamUrl: (bucket: string, path: string) => `https://cdn.test/${bucket}/${path}`,
}))

import {
  buildBeatSeo,
  getPublicBeat,
  parseBeatTags,
  toIsoDuration,
  toPublicBeat,
  type PublicBeatRow,
} from '@/lib/public-beat'
import { PUBLIC_BEAT_WHERE } from '@/lib/public-catalog'

const NOW = new Date('2026-11-17T12:00:00Z')
const PRIVATE_MP3 = 'https://x.supabase.co/storage/v1/object/beat-files/u/full.mp3'
const PRIVATE_WAV = 'https://x.supabase.co/storage/v1/object/beat-files/u/full.wav'
const PRIVATE_STEMS = 'https://x.supabase.co/storage/v1/object/beat-files/u/stems.zip'

function row(overrides: Partial<PublicBeatRow> = {}): PublicBeatRow {
  return {
    id: 'beat-1',
    title: 'Night Show ',
    description: null,
    genre: 'Trap',
    mood: 'Sombre',
    bpm: 140,
    key: 'F Minor',
    tags: '["dark","808"]',
    duration: 154,
    coverImage: 'https://x.supabase.co/storage/v1/object/public/covers/c.jpg',
    audioUrl: 'https://x.supabase.co/storage/v1/object/public/beat-previews/p.wav',
    plays: 0,
    createdAt: new Date('2026-08-01T10:00:00Z'),
    updatedAt: new Date('2026-08-02T10:00:00Z'),
    saleMode: 'LEASING',
    priceMp3: 29,
    priceWav: 59,
    priceStems: 199,
    audioOriginal: PRIVATE_MP3,
    audioWav: PRIVATE_WAV,
    stemsUrl: PRIVATE_STEMS,
    stemsFiles: null,
    producer: { id: 'prod-1', name: 'brtzl', displayName: 'BRTZL', avatar: null },
    auctions: [],
    ...overrides,
  }
}

describe('toPublicBeat', () => {
  it("n'expose jamais les fichiers payants (MP3/WAV complets, stems)", () => {
    const json = JSON.stringify(
      toPublicBeat(row({ saleMode: 'AUCTION' }), 'https://cdn/p.wav', NOW)
    )
    expect(json).not.toContain(PRIVATE_MP3)
    expect(json).not.toContain(PRIVATE_WAV)
    expect(json).not.toContain(PRIVATE_STEMS)
    expect(json).not.toContain('beat-files')
  })

  it("leasing : seulement Basic et Premium, jamais l'exclusive", () => {
    const beat = toPublicBeat(row(), null, NOW)
    expect(beat.offers).toEqual([
      { type: 'BASIC', price: 29 },
      { type: 'PREMIUM', price: 59 },
    ])
  })

  it("vente exclusive sans enchère : l'exclusive est proposée si les stems existent", () => {
    const beat = toPublicBeat(row({ saleMode: 'AUCTION' }), null, NOW)
    expect(beat.offers.map((o) => o.type)).toEqual(['BASIC', 'PREMIUM', 'EXCLUSIVE'])
  })

  it('ne propose pas une licence sans prix ou sans fichier livrable', () => {
    const beat = toPublicBeat(row({ priceMp3: null, audioWav: null }), null, NOW)
    expect(beat.offers).toEqual([])
  })

  it("une enchère en cours bloque l'achat direct et pointe vers l'enchère", () => {
    const beat = toPublicBeat(
      row({
        auctions: [
          {
            id: 'auc-1',
            status: 'ACTIVE',
            startTime: new Date('2026-11-16T12:00:00Z'),
            endTime: new Date('2026-11-18T12:00:00Z'),
            currentBid: 85,
            startPrice: 50,
            buyNowPrice: 300,
          },
        ],
      }),
      null,
      NOW
    )
    expect(beat.offers).toEqual([])
    expect(beat.liveAuction).toEqual({
      id: 'auc-1',
      currentBid: 85,
      endTime: '2026-11-18T12:00:00.000Z',
      buyNowPrice: 300,
    })
    expect(beat.upcomingAuction).toBeNull()
  })

  it('une enchère programmée est annoncée, sans achat direct', () => {
    const beat = toPublicBeat(
      row({
        auctions: [
          {
            id: 'auc-2',
            status: 'SCHEDULED',
            startTime: new Date('2026-11-20T18:00:00Z'),
            endTime: new Date('2026-11-21T18:00:00Z'),
            currentBid: 0,
            startPrice: 40,
            buyNowPrice: null,
          },
        ],
      }),
      null,
      NOW
    )
    expect(beat.offers).toEqual([])
    expect(beat.liveAuction).toBeNull()
    expect(beat.upcomingAuction?.id).toBe('auc-2')
  })

  it("une enchère expirée pas encore clôturée par le cron n'est ni en cours ni à venir", () => {
    const beat = toPublicBeat(
      row({
        auctions: [
          {
            id: 'auc-3',
            status: 'ACTIVE',
            startTime: new Date('2026-11-10T12:00:00Z'),
            endTime: new Date('2026-11-16T12:00:00Z'),
            currentBid: 70,
            startPrice: 50,
            buyNowPrice: null,
          },
        ],
      }),
      null,
      NOW
    )
    expect(beat.liveAuction).toBeNull()
    expect(beat.upcomingAuction).toBeNull()
    expect(beat.offers).toEqual([])
  })

  it('utilise le nom public du producteur et nettoie le titre', () => {
    const beat = toPublicBeat(row(), null, NOW)
    expect(beat.producer.name).toBe('BRTZL')
    expect(beat.title).toBe('Night Show')
  })
})

describe('parseBeatTags', () => {
  it('lit le format JSON et les anciens tags séparés par des virgules', () => {
    expect(parseBeatTags('["dark"," 808 ",""]')).toEqual(['dark', '808'])
    expect(parseBeatTags('dark, trap ,808')).toEqual(['dark', 'trap', '808'])
    expect(parseBeatTags('')).toEqual([])
  })
})

describe('buildBeatSeo', () => {
  it('compose un titre descriptif et une description avec le prix, sous 160 caractères', () => {
    const seo = buildBeatSeo(toPublicBeat(row(), null, NOW))
    expect(seo.title).toBe('Night Show — Beat Trap 140 BPM par BRTZL')
    expect(seo.description).toContain('Licence dès 29 €.')
    expect(seo.description).toContain('F Minor')
    expect(seo.description.length).toBeLessThanOrEqual(160)
  })

  it('garde le prix même quand la description du producteur est longue', () => {
    const seo = buildBeatSeo(
      toPublicBeat(row({ description: 'Ambiance sombre '.repeat(30) }), null, NOW)
    )
    expect(seo.description.endsWith('Licence dès 29 €.')).toBe(true)
    expect(seo.description.length).toBeLessThanOrEqual(160)
  })
})

describe('toIsoDuration', () => {
  it('convertit les secondes au format schema.org', () => {
    expect(toIsoDuration(154)).toBe('PT2M34S')
    expect(toIsoDuration(120)).toBe('PT2M')
    expect(toIsoDuration(45)).toBe('PT45S')
    expect(toIsoDuration(null)).toBeUndefined()
  })
})

describe('getPublicBeat', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ne lit que les beats publics (validés, producteur approuvé)', async () => {
    prismaMock.beat.findFirst.mockResolvedValue(null)
    expect(await getPublicBeat('beat-1')).toBeNull()
    expect(prismaMock.beat.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: [PUBLIC_BEAT_WHERE, { id: 'beat-1' }] } })
    )
  })

  it("convertit l'aperçu en URL de streaming publique", async () => {
    prismaMock.beat.findFirst.mockResolvedValue(row())
    const beat = await getPublicBeat('beat-1')
    expect(beat?.previewUrl).toBe('https://cdn.test/beat-previews/p.wav')
  })
})
