export type LicenseType = 'BASIC' | 'PREMIUM' | 'EXCLUSIVE'
export type FileLicenseType = 'MP3' | 'WAV' | 'STEMS'

export interface BeatLicensePricing {
  priceMp3?: number | null
  priceWav?: number | null
  priceStems?: number | null
}

export function normalizeLicenseType(licenseType: string): FileLicenseType | null {
  switch (licenseType.toUpperCase()) {
    case 'BASIC':
    case 'MP3':
      return 'MP3'
    case 'PREMIUM':
    case 'WAV':
      return 'WAV'
    case 'EXCLUSIVE':
    case 'STEMS':
      return 'STEMS'
    default:
      return null
  }
}

export function toPublicLicenseType(licenseType: string): LicenseType | null {
  switch (normalizeLicenseType(licenseType)) {
    case 'MP3':
      return 'BASIC'
    case 'WAV':
      return 'PREMIUM'
    case 'STEMS':
      return 'EXCLUSIVE'
    default:
      return null
  }
}

function validPrice(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

export function getConfiguredLicensePrice(
  beat: BeatLicensePricing,
  licenseType: string
): number | null {
  switch (normalizeLicenseType(licenseType)) {
    case 'MP3':
      return validPrice(beat.priceMp3)
    case 'WAV':
      return validPrice(beat.priceWav)
    case 'STEMS':
      return validPrice(beat.priceStems)
    default:
      return null
  }
}

export function getConfiguredLicensePrices(beat: BeatLicensePricing) {
  return {
    BASIC: validPrice(beat.priceMp3),
    PREMIUM: validPrice(beat.priceWav),
    EXCLUSIVE: validPrice(beat.priceStems),
  }
}

export function getLowestConfiguredPrice(beat: BeatLicensePricing): number | null {
  const prices = Object.values(getConfiguredLicensePrices(beat)).filter(
    (price): price is number => price !== null
  )
  return prices.length > 0 ? Math.min(...prices) : null
}
