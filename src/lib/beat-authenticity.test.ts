import { describe, expect, it } from 'vitest'
import { calculateAuthenticityRisk } from './beat-authenticity'

describe('calculateAuthenticityRisk', () => {
  it('classe bas un beat déclaré avec ses fichiers de création', () => {
    const result = calculateAuthenticityRisk({
      declarationAcceptedAt: new Date(),
      aiUsage: 'NONE',
      hasWav: true,
      hasStems: true,
      producerBeatCount: 2,
      producerMaxUploadsIn24h: 1,
      duplicateMetadataCount: 1,
    })

    expect(result.score).toBe(0)
    expect(result.status).toBe('LOW_RISK')
  })

  it('priorise un lot historique envoyé en masse sans preuves de création', () => {
    const result = calculateAuthenticityRisk({
      declarationAcceptedAt: null,
      aiUsage: null,
      hasWav: false,
      hasStems: false,
      producerBeatCount: 30,
      producerMaxUploadsIn24h: 9,
      duplicateMetadataCount: 4,
    })

    expect(result.score).toBe(95)
    expect(result.status).toBe('REVIEW_REQUIRED')
  })

  it("ne présente jamais un score supérieur à 100", () => {
    const result = calculateAuthenticityRisk({
      declarationAcceptedAt: null,
      aiUsage: 'GENERATIVE',
      hasWav: false,
      hasStems: false,
      producerBeatCount: 100,
      producerMaxUploadsIn24h: 50,
      duplicateMetadataCount: 50,
    })

    expect(result.score).toBe(100)
  })
})
