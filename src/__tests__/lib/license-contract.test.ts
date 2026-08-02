import { describe, expect, it } from 'vitest'
import {
  generateLicenseContractPdf,
  getContractFileName,
  getContractReference,
  getLicenseContractVersion,
  LICENSE_CONTRACT_VERSION,
  type LicenseContractData,
} from '@/lib/license-contract'

const contractData: LicenseContractData = {
  purchaseId: 'purchase_test_318',
  purchaseType: 'AUCTION',
  transactionId: 'pi_test_123',
  purchasedAt: new Date('2026-07-27T10:30:00.000Z'),
  amount: 125,
  licenseType: 'PREMIUM',
  buyer: {
    name: 'Artiste Test',
    email: 'artiste@example.com',
  },
  producer: {
    name: 'Beatmaker Test',
    email: 'beatmaker@example.com',
  },
  beat: {
    id: 'beat_test_318',
    title: 'Énergie Nocturne',
    genre: 'Trap',
    bpm: 142,
    key: 'C#m',
  },
}

describe('contrat de licence PDF', () => {
  it('génère un PDF valide contenant les informations contractuelles', () => {
    const pdf = generateLicenseContractPdf(contractData)
    const content = pdf.toString('latin1')

    expect(pdf.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4')
    expect(content).toContain('Contrat de licence musicale')
    expect(content).toContain('Artiste Test')
    expect(content).toContain('Beatmaker Test')
    expect(content).toContain('LICENCE PREMIUM')
    expect(content).toContain('startxref')
    expect(content.endsWith('%%EOF\n')).toBe(true)
  })

  it('produit une référence stable et un nom de fichier sûr', () => {
    expect(getContractReference(contractData.purchaseId, contractData.purchasedAt)).toMatch(
      /^318-[A-F0-9]{12}$/
    )
    expect(getContractReference(contractData.purchaseId, contractData.purchasedAt)).toBe(
      getContractReference(contractData.purchaseId, contractData.purchasedAt)
    )
    expect(getContractFileName(contractData)).toBe('contrat-licence-Energie-Nocturne-test_318.pdf')
  })

  it('ajoute les 5 % sur les éditions uniquement aux nouveaux contrats', () => {
    const previousPdf = generateLicenseContractPdf(contractData).toString('latin1')
    const newContractData = {
      ...contractData,
      purchaseId: 'purchase_after_publishing_clause',
      purchasedAt: new Date('2026-08-03T00:01:00+02:00'),
    }
    const newPdf = generateLicenseContractPdf(newContractData).toString('latin1')

    expect(previousPdf).not.toContain('PARTICIPATION DE 5 % SUR LES ÉDITIONS')
    expect(previousPdf).toContain('version 318-LICENCE-2026-07')
    expect(newPdf).toContain('PARTICIPATION DE 5 % SUR LES ÉDITIONS')
    expect(newPdf).toContain("revenant au producteur/compositeur du beat")
    expect(newPdf).toContain("il conserve 95 EUR")
    expect(newPdf).toContain("Les parts de l'artiste et des autres auteurs")
    expect(newPdf).toContain(`version ${LICENSE_CONTRACT_VERSION}`)
    expect(getLicenseContractVersion(newContractData.purchasedAt)).toBe(LICENSE_CONTRACT_VERSION)
  })
})
