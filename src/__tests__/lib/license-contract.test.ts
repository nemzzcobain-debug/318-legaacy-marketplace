import { describe, expect, it } from 'vitest'
import {
  generateLicenseContractPdf,
  getContractFileName,
  getContractReference,
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
    expect(getContractReference(contractData.purchaseId)).toMatch(/^318-[A-F0-9]{12}$/)
    expect(getContractReference(contractData.purchaseId)).toBe(
      getContractReference(contractData.purchaseId)
    )
    expect(getContractFileName(contractData)).toBe(
      'contrat-licence-Energie-Nocturne-test_318.pdf'
    )
  })
})
