import { describe, expect, it } from 'vitest'
import { getBeatEditCapabilities, updateBeatSchema } from '@/lib/beat-edit'

const validUpdate = {
  title: 'Nouveau titre',
  description: 'Description',
  genre: 'Trap',
  mood: 'Sombre',
  bpm: 140,
  key: 'C Minor',
  tags: ['trap', 'sombre'],
  priceMp3: null,
  priceWav: null,
  auction: {
    startPrice: 25,
    buyNowPrice: 250,
    durationHours: 48,
    startAt: '2026-08-05T18:00:00.000Z',
  },
}

describe('règles de modification des beats', () => {
  it('autorise toute la programmation avant la validation', () => {
    expect(
      getBeatEditCapabilities({
        beatStatus: 'PENDING',
        auctionStatus: 'PENDING_APPROVAL',
        totalBids: 0,
      })
    ).toMatchObject({
      canEditMetadata: true,
      canEditAuctionSettings: true,
      canExtendAuction: false,
    })
  })

  it('autorise la reprogrammation d’une enchère programmée sans mise', () => {
    expect(
      getBeatEditCapabilities({
        beatStatus: 'ACTIVE',
        auctionStatus: 'SCHEDULED',
        totalBids: 0,
      })
    ).toMatchObject({
      canEditMetadata: true,
      canEditAuctionSettings: true,
      canExtendAuction: false,
    })
  })

  it('n’autorise que la prolongation après une première mise', () => {
    expect(
      getBeatEditCapabilities({
        beatStatus: 'ACTIVE',
        auctionStatus: 'ACTIVE',
        totalBids: 2,
        auctionEndTime: '2026-08-02T12:00:00.000Z',
        now: new Date('2026-08-01T12:00:00.000Z'),
      })
    ).toMatchObject({
      canEditMetadata: false,
      canEditAuctionSettings: false,
      canExtendAuction: true,
    })
  })

  it('bloque un beat déjà vendu', () => {
    expect(
      getBeatEditCapabilities({
        beatStatus: 'SOLD',
        auctionStatus: 'COMPLETED',
      })
    ).toMatchObject({
      canEditMetadata: false,
      canEditAuctionSettings: false,
      canExtendAuction: false,
    })
  })
})

describe('validation de la modification', () => {
  it('accepte une durée comprise entre 15 minutes et 7 jours', () => {
    expect(updateBeatSchema.safeParse(validUpdate).success).toBe(true)
    expect(
      updateBeatSchema.safeParse({
        ...validUpdate,
        auction: { ...validUpdate.auction, durationHours: 0.25 },
      }).success
    ).toBe(true)
  })

  it('refuse un achat immédiat inférieur au prix de départ', () => {
    const result = updateBeatSchema.safeParse({
      ...validUpdate,
      auction: { ...validUpdate.auction, startPrice: 100, buyNowPrice: 80 },
    })

    expect(result.success).toBe(false)
  })
})
