import { describe, expect, it } from 'vitest'
import {
  isAuctionSaleMode,
  isLeasingLicenseAllowed,
  normalizeBeatSaleMode,
} from '@/lib/beat-sale-mode'

describe('beat sale mode', () => {
  it('normalise les anciennes données vers le mode enchère', () => {
    expect(normalizeBeatSaleMode(undefined)).toBe('AUCTION')
    expect(normalizeBeatSaleMode('invalid')).toBe('AUCTION')
  })

  it('conserve explicitement le mode leasing', () => {
    expect(normalizeBeatSaleMode('LEASING')).toBe('LEASING')
    expect(isAuctionSaleMode('LEASING')).toBe(false)
    expect(isAuctionSaleMode('AUCTION')).toBe(true)
  })

  it('interdit les licences exclusives en leasing', () => {
    expect(isLeasingLicenseAllowed('BASIC')).toBe(true)
    expect(isLeasingLicenseAllowed('WAV')).toBe(true)
    expect(isLeasingLicenseAllowed('EXCLUSIVE')).toBe(false)
    expect(isLeasingLicenseAllowed('STEMS')).toBe(false)
  })
})
