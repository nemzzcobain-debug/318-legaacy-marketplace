export type PublicLicenseType = 'BASIC' | 'PREMIUM' | 'EXCLUSIVE'

export const PUBLISHING_PARTICIPATION_PERCENT = 5
export const PUBLISHING_PARTICIPATION_EFFECTIVE_AT = new Date('2026-08-03T00:00:00+02:00')

export interface LicenseDetails {
  type: PublicLicenseType
  label: string
  files: string
  usage: string
  shortDescription: string
}

export const LICENSE_DETAILS: Record<PublicLicenseType, LicenseDetails> = {
  BASIC: {
    type: 'BASIC',
    label: 'Basique',
    files: 'MP3 uniquement',
    usage: "Jusqu'à 5 000 écoutes",
    shortDescription: "MP3 uniquement · jusqu'à 5 000 écoutes",
  },
  PREMIUM: {
    type: 'PREMIUM',
    label: 'Premium',
    files: 'MP3 + WAV',
    usage: "Jusqu'à 100 000 écoutes",
    shortDescription: "MP3 + WAV · jusqu'à 100 000 écoutes",
  },
  EXCLUSIVE: {
    type: 'EXCLUSIVE',
    label: 'Exclusive',
    files: 'MP3 + WAV + stems',
    usage: 'Droits exclusifs',
    shortDescription: 'MP3 + WAV + stems · droits exclusifs',
  },
}

export function normalizePublicLicenseType(value?: string | null): PublicLicenseType {
  const normalized = value?.toUpperCase()
  if (normalized === 'PREMIUM' || normalized === 'EXCLUSIVE') {
    return normalized
  }
  return 'BASIC'
}

export function getLicenseDetails(value?: string | null): LicenseDetails {
  return LICENSE_DETAILS[normalizePublicLicenseType(value)]
}
