import { describe, expect, it } from 'vitest'
import { getPublicFeaturedBeatWhere, PUBLIC_BEAT_WHERE } from '@/lib/public-catalog'

describe('sélection de la semaine', () => {
  it('conserve les beats sélectionnés même sans enchère active', () => {
    expect(getPublicFeaturedBeatWhere()).toEqual({
      AND: [PUBLIC_BEAT_WHERE, { isFeatured: true }],
    })
  })
})
