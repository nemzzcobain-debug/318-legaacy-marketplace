export const AI_DECLARATION_VERSION = '318-AUTHENTICITY-2026-08'

export const AI_USAGE_VALUES = ['NONE', 'ASSISTIVE_ONLY', 'GENERATIVE'] as const
export type AiUsage = (typeof AI_USAGE_VALUES)[number]

export const AI_REVIEW_STATUSES = [
  'NOT_ANALYZED',
  'LOW_RISK',
  'REVIEW_RECOMMENDED',
  'REVIEW_REQUIRED',
  'EVIDENCE_REQUESTED',
  'HUMAN_CONFIRMED',
  'AI_REJECTED',
] as const

export type AiReviewStatus = (typeof AI_REVIEW_STATUSES)[number]

type RiskInput = {
  declarationAcceptedAt: Date | null
  aiUsage: string | null
  hasWav: boolean
  hasStems: boolean
  producerBeatCount: number
  producerMaxUploadsIn24h: number
  duplicateMetadataCount: number
}

export type AuthenticityRisk = {
  score: number
  status: Extract<
    AiReviewStatus,
    'LOW_RISK' | 'REVIEW_RECOMMENDED' | 'REVIEW_REQUIRED'
  >
  reasons: string[]
}

/**
 * Calcule une priorité de contrôle, pas une preuve de génération par IA.
 * Les signaux faibles ne provoquent jamais de suppression automatique.
 */
export function calculateAuthenticityRisk(input: RiskInput): AuthenticityRisk {
  let score = 0
  const reasons: string[] = []

  if (!input.declarationAcceptedAt) {
    score += 25
    reasons.push("Aucune déclaration d'authenticité (beat antérieur au nouveau contrôle)")
  }

  if (input.aiUsage === 'GENERATIVE') {
    score += 75
    reasons.push("Le producteur a déclaré l'usage d'une IA générative pour composer le beat")
  } else if (input.aiUsage === 'ASSISTIVE_ONLY') {
    reasons.push("Outil d'IA d'assistance déclaré — détails à vérifier")
  }

  if (input.producerMaxUploadsIn24h >= 8) {
    score += 35
    reasons.push(`${input.producerMaxUploadsIn24h} beats envoyés sur une période de 24 h`)
  } else if (input.producerMaxUploadsIn24h >= 5) {
    score += 25
    reasons.push(`${input.producerMaxUploadsIn24h} beats envoyés sur une période de 24 h`)
  } else if (input.producerMaxUploadsIn24h >= 3) {
    score += 10
    reasons.push(`${input.producerMaxUploadsIn24h} beats envoyés sur une période de 24 h`)
  }

  if (input.producerBeatCount >= 25) {
    score += 10
    reasons.push(`Catalogue volumineux : ${input.producerBeatCount} beats`)
  }

  if (!input.hasWav) {
    score += 5
    reasons.push('Aucun fichier WAV fourni')
  }
  if (!input.hasStems) {
    score += 5
    reasons.push('Aucun stem ou projet multipiste fourni')
  }

  if (input.duplicateMetadataCount >= 3) {
    score += 15
    reasons.push(
      `${input.duplicateMetadataCount} beats du même producteur ont des métadonnées techniques identiques`
    )
  }

  const normalizedScore = Math.min(100, score)
  const status =
    normalizedScore >= 60
      ? 'REVIEW_REQUIRED'
      : normalizedScore >= 35
        ? 'REVIEW_RECOMMENDED'
        : 'LOW_RISK'

  if (reasons.length === 0) reasons.push('Aucun signal de risque détecté dans les métadonnées')

  return { score: normalizedScore, status, reasons }
}

export function parseRiskReasons(value: unknown): string[] {
  if (typeof value !== 'string' || !value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}
