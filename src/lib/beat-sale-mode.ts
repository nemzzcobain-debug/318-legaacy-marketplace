export const BEAT_SALE_MODES = ['AUCTION', 'LEASING'] as const

export type BeatSaleMode = (typeof BEAT_SALE_MODES)[number]

export function normalizeBeatSaleMode(value: unknown): BeatSaleMode {
  return value === 'LEASING' ? 'LEASING' : 'AUCTION'
}

export function isAuctionSaleMode(value: unknown): boolean {
  return normalizeBeatSaleMode(value) === 'AUCTION'
}

export function isLeasingLicenseAllowed(licenseType: string): boolean {
  return ['BASIC', 'PREMIUM', 'MP3', 'WAV'].includes(licenseType.toUpperCase())
}
