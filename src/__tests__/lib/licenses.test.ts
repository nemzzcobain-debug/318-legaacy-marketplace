import { describe, expect, it } from 'vitest'
import { getLicenseDetails, normalizePublicLicenseType } from '@/lib/licenses'

describe('licences publiques', () => {
  it('présente la licence basique comme un fichier MP3 uniquement', () => {
    const license = getLicenseDetails('BASIC')

    expect(license.label).toBe('Basique')
    expect(license.files).toBe('MP3 uniquement')
  })

  it('présente les fichiers inclus dans les licences supérieures', () => {
    expect(getLicenseDetails('PREMIUM').files).toBe('MP3 + WAV')
    expect(getLicenseDetails('EXCLUSIVE').files).toBe('MP3 + WAV + stems')
  })

  it('normalise une valeur inconnue vers la licence basique', () => {
    expect(normalizePublicLicenseType('inconnue')).toBe('BASIC')
    expect(getLicenseDetails(null).type).toBe('BASIC')
  })
})
