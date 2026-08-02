import { createHash } from 'crypto'
import {
  getLicenseDetails,
  normalizePublicLicenseType,
  PUBLISHING_PARTICIPATION_EFFECTIVE_AT,
  PUBLISHING_PARTICIPATION_PERCENT,
} from '@/lib/licenses'

const PREVIOUS_LICENSE_CONTRACT_VERSION = '318-LICENCE-2026-07'
export const LICENSE_CONTRACT_VERSION = '318-LICENCE-2026-08'

export interface LicenseContractData {
  purchaseId: string
  purchaseType: string
  transactionId?: string | null
  purchasedAt: Date
  amount: number
  licenseType: string
  buyer: {
    name: string
    email: string
  }
  producer: {
    name: string
    email: string
  }
  beat: {
    id: string
    title: string
    genre: string
    bpm: number
    key?: string | null
  }
}

type FontName = 'regular' | 'bold'
type ColorName = 'black' | 'muted' | 'red' | 'green' | 'white'

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 54
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const COLORS: Record<ColorName, string> = {
  black: '0.06 0.06 0.08',
  muted: '0.35 0.35 0.4',
  red: '0.88 0.11 0.28',
  green: '0.08 0.55 0.32',
  white: '1 1 1',
}

const LICENSE_CLAUSES = {
  BASIC: {
    nature: 'Licence non exclusive, personnelle, non cessible et non transférable.',
    files: 'Fichier MP3 uniquement.',
    rights: [
      "Droit d'intégrer le beat dans une seule oeuvre musicale originale.",
      'Diffusion autorisée dans la limite cumulée de 5 000 écoutes ou vues.',
      'Usage promotionnel et non commercial uniquement.',
      "Aucune revente, sous-licence ou distribution du beat seul n'est autorisée.",
    ],
  },
  PREMIUM: {
    nature: 'Licence non exclusive, commerciale, personnelle et non transférable.',
    files: 'Fichiers MP3 et WAV.',
    rights: [
      "Droit de reproduction, de représentation et d'adaptation dans une seule oeuvre musicale originale.",
      "Exploitation commerciale autorisée jusqu'à 100 000 écoutes ou vues cumulées.",
      "Territoire : monde entier. Durée : dix ans à compter de la date d'achat.",
      "Aucune revente, sous-licence ou distribution du beat seul n'est autorisée.",
    ],
  },
  EXCLUSIVE: {
    nature: "Licence exclusive d'exploitation au bénéfice de l'acheteur.",
    files: 'Fichiers MP3, WAV et stems disponibles.',
    rights: [
      "Droit exclusif de reproduction, de représentation et d'adaptation du beat dans une oeuvre musicale originale.",
      "Exploitation commerciale sans plafond d'écoutes ou de vues.",
      'Territoire : monde entier. Durée : toute la durée légale de protection des droits patrimoniaux.',
      'Le beat est retiré des nouvelles ventes exclusives. Les licences non exclusives antérieures restent valables.',
      "Les droits moraux du producteur et sa qualité d'auteur demeurent réservés.",
    ],
  },
} as const

function cleanPdfText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[–—]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
}

function escapePdfText(value: string): string {
  return cleanPdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function wrapText(value: string, size: number, maxWidth = CONTENT_WIDTH): string[] {
  const words = cleanPdfText(value).split(/\s+/).filter(Boolean)
  const maxCharacters = Math.max(12, Math.floor(maxWidth / (size * 0.52)))
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxCharacters) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

class ContractLayout {
  pages: string[][] = []
  private y = 0
  private reference: string

  constructor(reference: string) {
    this.reference = reference
    this.addPage()
  }

  private addPage() {
    this.pages.push([])
    this.y = PAGE_HEIGHT - 58
    const page = this.currentPage
    page.push(`${COLORS.black} rg 0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`)
    page.push(`${COLORS.red} rg 0 ${PAGE_HEIGHT - 9} ${PAGE_WIDTH} 9 re f`)
    this.text(MARGIN, this.y, 17, 'bold', '318 LEGAACY', 'white')
    this.text(MARGIN, this.y - 18, 8, 'regular', 'MARKETPLACE - CONTRAT DE LICENCE', 'red')
    this.text(PAGE_WIDTH - MARGIN, this.y - 2, 8, 'regular', this.reference, 'muted', 'right')
    this.y -= 48
  }

  private get currentPage(): string[] {
    return this.pages[this.pages.length - 1]
  }

  private ensureHeight(height: number) {
    if (this.y - height < 72) this.addPage()
  }

  text(
    x: number,
    y: number,
    size: number,
    font: FontName,
    value: string,
    color: ColorName = 'white',
    align: 'left' | 'right' = 'left'
  ) {
    const safeValue = escapePdfText(value)
    const adjustedX = align === 'right' ? x - cleanPdfText(value).length * size * 0.5 : x
    this.currentPage.push(
      `BT ${COLORS[color]} rg /${font === 'bold' ? 'F2' : 'F1'} ${size} Tf ${adjustedX.toFixed(
        2
      )} ${y.toFixed(2)} Td (${safeValue}) Tj ET`
    )
  }

  title(value: string) {
    this.ensureHeight(58)
    this.text(MARGIN, this.y, 23, 'bold', value, 'white')
    this.y -= 17
    this.currentPage.push(
      `${COLORS.red} RG 1.8 w ${MARGIN} ${this.y} m ${MARGIN + 116} ${this.y} l S`
    )
    this.y -= 25
  }

  section(value: string) {
    // Garde le titre avec au moins le premier paragraphe ou la première puce.
    this.ensureHeight(72)
    this.currentPage.push(`${COLORS.red} rg ${MARGIN} ${this.y - 5} 4 18 re f`)
    this.text(MARGIN + 13, this.y, 12, 'bold', value.toUpperCase(), 'white')
    this.y -= 27
  }

  paragraph(value: string, options?: { color?: ColorName; size?: number; indent?: number }) {
    const size = options?.size ?? 9.5
    const indent = options?.indent ?? 0
    const lines = wrapText(value, size, CONTENT_WIDTH - indent)
    this.ensureHeight(lines.length * 14 + 8)
    for (const line of lines) {
      this.text(MARGIN + indent, this.y, size, 'regular', line, options?.color ?? 'white')
      this.y -= 14
    }
    this.y -= 5
  }

  bullet(value: string) {
    this.ensureHeight(30)
    this.text(MARGIN + 2, this.y, 10, 'bold', '-', 'red')
    this.paragraph(value, { size: 9.2, indent: 14 })
  }

  detail(label: string, value: string) {
    const valueLines = wrapText(value, 9.2, CONTENT_WIDTH - 154)
    this.ensureHeight(Math.max(25, valueLines.length * 13 + 7))
    this.currentPage.push(
      `0.10 0.10 0.13 rg ${MARGIN} ${this.y - valueLines.length * 13 - 4} ${CONTENT_WIDTH} ${
        valueLines.length * 13 + 11
      } re f`
    )
    this.text(MARGIN + 10, this.y, 8.6, 'bold', label, 'muted')
    valueLines.forEach((line, index) => {
      this.text(MARGIN + 154, this.y - index * 13, 9.2, 'regular', line, 'white')
    })
    this.y -= valueLines.length * 13 + 15
  }

  signatureBlock(producerName: string, buyerName: string, acceptedAt: string) {
    this.ensureHeight(112)
    const gap = 14
    const width = (CONTENT_WIDTH - gap) / 2
    const bottom = this.y - 86
    this.currentPage.push(`0.10 0.10 0.13 rg ${MARGIN} ${bottom} ${width} 88 re f`)
    this.currentPage.push(`0.10 0.10 0.13 rg ${MARGIN + width + gap} ${bottom} ${width} 88 re f`)
    this.text(MARGIN + 12, this.y - 17, 8, 'bold', 'LE PRODUCTEUR', 'red')
    this.text(MARGIN + 12, this.y - 36, 9.5, 'bold', producerName, 'white')
    this.text(
      MARGIN + 12,
      this.y - 57,
      7.8,
      'regular',
      'Licence proposée via son compte vérifié',
      'muted'
    )
    this.text(MARGIN + width + gap + 12, this.y - 17, 8, 'bold', "L'ACHETEUR", 'red')
    this.text(MARGIN + width + gap + 12, this.y - 36, 9.5, 'bold', buyerName, 'white')
    this.text(
      MARGIN + width + gap + 12,
      this.y - 57,
      7.8,
      'regular',
      `Accepté électroniquement le ${acceptedAt}`,
      'muted'
    )
    this.y -= 104
  }

  finalize(): string[] {
    const total = this.pages.length
    this.pages.forEach((page, index) => {
      page.push(`${COLORS.muted} RG 0.5 w ${MARGIN} 49 m ${PAGE_WIDTH - MARGIN} 49 l S`)
      const footer =
        'Document généré automatiquement et conservé avec la preuve de paiement Stripe.'
      page.push(`BT ${COLORS.muted} rg /F1 7 Tf ${MARGIN} 31 Td (${escapePdfText(footer)}) Tj ET`)
      page.push(
        `BT ${COLORS.muted} rg /F1 7 Tf ${PAGE_WIDTH - MARGIN - 36} 31 Td (Page ${
          index + 1
        }/${total}) Tj ET`
      )
    })
    return this.pages.map((page) => page.join('\n'))
  }
}

function createPdfDocument(pageStreams: string[]): Buffer {
  const pageCount = pageStreams.length
  const firstPageObjectId = 5
  const pageObjectIds = Array.from(
    { length: pageCount },
    (_, index) => firstPageObjectId + index * 2
  )
  const objects: Array<{ id: number; body: Buffer }> = [
    { id: 1, body: Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'latin1') },
    {
      id: 2,
      body: Buffer.from(
        `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`,
        'latin1'
      ),
    },
    {
      id: 3,
      body: Buffer.from(
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        'latin1'
      ),
    },
    {
      id: 4,
      body: Buffer.from(
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
        'latin1'
      ),
    },
  ]

  pageStreams.forEach((stream, index) => {
    const pageId = firstPageObjectId + index * 2
    const contentId = pageId + 1
    const content = Buffer.from(stream, 'latin1')
    objects.push({
      id: pageId,
      body: Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
        'latin1'
      ),
    })
    objects.push({
      id: contentId,
      body: Buffer.concat([
        Buffer.from(`<< /Length ${content.length} >>\nstream\n`, 'latin1'),
        content,
        Buffer.from('\nendstream', 'latin1'),
      ]),
    })
  })

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')]
  const offsets = new Map<number, number>()
  let offset = chunks[0].length

  for (const object of objects.sort((a, b) => a.id - b.id)) {
    offsets.set(object.id, offset)
    const chunk = Buffer.concat([
      Buffer.from(`${object.id} 0 obj\n`, 'latin1'),
      object.body,
      Buffer.from('\nendobj\n', 'latin1'),
    ])
    chunks.push(chunk)
    offset += chunk.length
  }

  const xrefOffset = offset
  const maxObjectId = Math.max(...objects.map((object) => object.id))
  const xrefLines = [`xref`, `0 ${maxObjectId + 1}`, '0000000000 65535 f ']
  for (let id = 1; id <= maxObjectId; id += 1) {
    xrefLines.push(`${String(offsets.get(id) ?? 0).padStart(10, '0')} 00000 n `)
  }
  const trailer = `${xrefLines.join('\n')}\ntrailer\n<< /Size ${
    maxObjectId + 1
  } /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  chunks.push(Buffer.from(trailer, 'latin1'))
  return Buffer.concat(chunks)
}

export function getLicenseContractVersion(purchasedAt: Date): string {
  return purchasedAt >= PUBLISHING_PARTICIPATION_EFFECTIVE_AT
    ? LICENSE_CONTRACT_VERSION
    : PREVIOUS_LICENSE_CONTRACT_VERSION
}

export function getContractReference(purchaseId: string, purchasedAt?: Date): string {
  const version = purchasedAt ? getLicenseContractVersion(purchasedAt) : LICENSE_CONTRACT_VERSION
  const digest = createHash('sha256').update(`${version}:${purchaseId}`).digest('hex')
  return `318-${digest.slice(0, 12).toUpperCase()}`
}

export function getContractFileName(
  data: Pick<LicenseContractData, 'purchaseId' | 'beat'>
): string {
  const title = data.beat.title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `contrat-licence-${title || 'beat'}-${data.purchaseId.slice(-8)}.pdf`
}

export function generateLicenseContractPdf(data: LicenseContractData): Buffer {
  const licenseType = normalizePublicLicenseType(data.licenseType)
  const license = getLicenseDetails(licenseType)
  const clauses = LICENSE_CLAUSES[licenseType]
  const contractVersion = getLicenseContractVersion(data.purchasedAt)
  const reference = getContractReference(data.purchaseId, data.purchasedAt)
  const publishingParticipationApplies = data.purchasedAt >= PUBLISHING_PARTICIPATION_EFFECTIVE_AT
  const purchasedAt = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(data.purchasedAt)
  const amount = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  })
    .format(data.amount)
    .replace('€', 'EUR')

  const layout = new ContractLayout(reference)
  layout.title('Contrat de licence musicale')
  layout.paragraph(
    "Ce document matérialise la licence conclue entre le producteur et l'acheteur par l'intermédiaire de 318 LEGAACY Marketplace. Le paiement vaut acceptation des conditions particulières ci-dessous et des CGV de la plateforme.",
    { color: 'muted' }
  )

  layout.section('Parties')
  layout.detail('Producteur / concédant', `${data.producer.name} - ${data.producer.email}`)
  layout.detail('Acheteur / licencié', `${data.buyer.name} - ${data.buyer.email}`)
  layout.detail('Intermédiaire technique', '318 LEGAACY Marketplace - 318marketplace.com')

  layout.section('Beat et transaction')
  layout.detail(
    'Beat',
    `${data.beat.title} (${data.beat.genre}, ${data.beat.bpm} BPM${data.beat.key ? `, ${data.beat.key}` : ''})`
  )
  layout.detail('Identifiant du beat', data.beat.id)
  layout.detail('Référence du contrat', `${reference} - version ${contractVersion}`)
  layout.detail('Date de conclusion', purchasedAt)
  layout.detail('Type de vente', data.purchaseType === 'AUCTION' ? 'Enchère' : 'Achat direct')
  layout.detail('Prix payé', amount)
  if (data.transactionId) layout.detail('Preuve de paiement Stripe', data.transactionId)

  layout.section(`Licence ${license.label}`)
  layout.paragraph(clauses.nature)
  layout.bullet(clauses.files)
  clauses.rights.forEach((right) => layout.bullet(right))

  layout.section('Droits concédés et limites')
  layout.bullet(
    "La licence porte uniquement sur l'utilisation du beat dans l'oeuvre musicale créée par l'acheteur. Le fichier instrumental seul ne peut pas être revendu, partagé, donné ou publié comme produit autonome."
  )
  layout.bullet(
    "Sauf mention contraire, le producteur reste titulaire de ses droits d'auteur et de ses droits moraux. Le crédit « Prod. by " +
      data.producer.name +
      ' » doit apparaître lorsque le format de diffusion le permet.'
  )
  layout.bullet(
    "Le producteur garantit disposer des droits nécessaires sur le beat et déclare qu'il ne contient pas de sample non autorisé. Tout sample ou élément tiers déclaré séparément reste soumis à ses propres autorisations."
  )
  layout.bullet(
    'Toute utilisation illicite, diffamatoire ou portant atteinte aux droits de tiers est interdite. Les obligations de déclaration auprès des sociétés de gestion collective restent à la charge des parties.'
  )

  if (publishingParticipationApplies) {
    layout.section(`Participation de ${PUBLISHING_PARTICIPATION_PERCENT} % sur les éditions`)
    layout.paragraph(
      `En contrepartie des services de mise en relation, de sélection, de contractualisation et de suivi fournis par 318 LEGAACY Marketplace, 318 LEGAACY perçoit une participation contractuelle égale à ${PUBLISHING_PARTICIPATION_PERCENT} % des revenus nets d'édition effectivement encaissés au titre de l'oeuvre musicale incorporant le beat.`
    )
    layout.bullet(
      "Les revenus d'édition concernés sont les sommes liées à l'exploitation de la composition musicale, notamment au titre de la reproduction mécanique, de la représentation publique et de la synchronisation. Sont exclus le prix de vente de la licence, les revenus du master et les droits voisins."
    )
    layout.bullet(
      "Cette participation financière ne constitue ni une cession de droits d'auteur, ni une attribution de qualité d'auteur, de compositeur, d'éditeur ou de copropriétaire à 318 LEGAACY. Les droits moraux et les quotes-parts d'auteur et de compositeur restent inchangés."
    )
    layout.bullet(
      "Elle s'applique pendant la durée et sur le territoire d'exploitation autorisés par la licence. La partie qui encaisse ces revenus transmet à 318 LEGAACY une reddition de comptes annuelle et règle la somme due dans les trente jours suivant la demande de paiement correspondante."
    )
  }

  layout.section('Acceptation, preuve et droit applicable')
  layout.paragraph(
    "L'acheteur a accepté cette licence lors du paiement. La date, les identifiants de compte, la référence d'achat et la transaction Stripe constituent la piste d'audit électronique. Le téléchargement du contenu numérique déclenche l'exécution immédiate du contrat conformément aux CGV."
  )
  layout.paragraph(
    "Le présent contrat est soumis au droit français. Les parties recherchent d'abord une solution amiable via la messagerie ou le support 318 LEGAACY avant toute action. En cas de contradiction, les conditions particulières de ce document prévalent pour le beat et la licence identifiés."
  )
  layout.signatureBlock(data.producer.name, data.buyer.name, purchasedAt)

  return createPdfDocument(layout.finalize())
}
