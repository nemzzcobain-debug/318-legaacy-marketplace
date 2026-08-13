export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateAuthenticityRisk } from '@/lib/beat-authenticity'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  return session?.user?.role === 'ADMIN' ? session : null
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const grouped = await prisma.beat.groupBy({
    by: ['aiReviewStatus'],
    _count: { _all: true },
  })
  const counts = Object.fromEntries(grouped.map((row) => [row.aiReviewStatus, row._count._all]))

  return NextResponse.json({
    total: grouped.reduce((sum, row) => sum + row._count._all, 0),
    notAnalyzed: counts.NOT_ANALYZED || 0,
    lowRisk: counts.LOW_RISK || 0,
    reviewRecommended: counts.REVIEW_RECOMMENDED || 0,
    reviewRequired: counts.REVIEW_REQUIRED || 0,
    evidenceRequested: counts.EVIDENCE_REQUESTED || 0,
    humanConfirmed: counts.HUMAN_CONFIRMED || 0,
    aiRejected: counts.AI_REJECTED || 0,
    method: 'METADATA_AND_BEHAVIOUR',
    detectorConfigured: false,
  })
}

export async function POST() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const beats = await prisma.beat.findMany({
    select: {
      id: true,
      producerId: true,
      bpm: true,
      key: true,
      duration: true,
      audioWav: true,
      stemsUrl: true,
      stemsFiles: true,
      aiDeclarationAcceptedAt: true,
      aiUsage: true,
      aiReviewStatus: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const byProducer = new Map<string, typeof beats>()
  for (const beat of beats) {
    const list = byProducer.get(beat.producerId) || []
    list.push(beat)
    byProducer.set(beat.producerId, list)
  }

  const producerSignals = new Map<
    string,
    { beatCount: number; maxUploadsIn24h: number; signatureCounts: Map<string, number> }
  >()

  for (const [producerId, producerBeats] of byProducer) {
    let maxUploadsIn24h = 0
    let left = 0
    for (let right = 0; right < producerBeats.length; right += 1) {
      while (
        producerBeats[right].createdAt.getTime() - producerBeats[left].createdAt.getTime() >
        24 * 60 * 60 * 1000
      ) {
        left += 1
      }
      maxUploadsIn24h = Math.max(maxUploadsIn24h, right - left + 1)
    }

    const signatureCounts = new Map<string, number>()
    for (const beat of producerBeats) {
      const signature = `${beat.bpm}|${beat.key || ''}|${beat.duration || 0}`
      signatureCounts.set(signature, (signatureCounts.get(signature) || 0) + 1)
    }

    producerSignals.set(producerId, {
      beatCount: producerBeats.length,
      maxUploadsIn24h,
      signatureCounts,
    })
  }

  let updated = 0
  let preserved = 0
  const updates = []

  for (const beat of beats) {
    if (['HUMAN_CONFIRMED', 'AI_REJECTED'].includes(beat.aiReviewStatus)) {
      preserved += 1
      continue
    }

    const signals = producerSignals.get(beat.producerId)!
    const signature = `${beat.bpm}|${beat.key || ''}|${beat.duration || 0}`
    const risk = calculateAuthenticityRisk({
      declarationAcceptedAt: beat.aiDeclarationAcceptedAt,
      aiUsage: beat.aiUsage,
      hasWav: Boolean(beat.audioWav),
      hasStems: Boolean(beat.stemsUrl || beat.stemsFiles),
      producerBeatCount: signals.beatCount,
      producerMaxUploadsIn24h: signals.maxUploadsIn24h,
      duplicateMetadataCount: signals.signatureCounts.get(signature) || 1,
    })

    updates.push(
      prisma.beat.update({
        where: { id: beat.id },
        data: {
          aiRiskScore: risk.score,
          aiRiskReasons: JSON.stringify(risk.reasons),
          aiReviewStatus:
            beat.aiReviewStatus === 'EVIDENCE_REQUESTED' ? 'EVIDENCE_REQUESTED' : risk.status,
          aiDetectorProvider: '318_METADATA_AUDIT',
          aiDetectorVersion: '1.0',
          aiAnalyzedAt: new Date(),
        },
      })
    )
    updated += 1
  }

  for (let index = 0; index < updates.length; index += 50) {
    await prisma.$transaction(updates.slice(index, index + 50))
  }

  await prisma.adminActionLog.create({
    data: {
      adminId: session.user.id,
      action: 'RUN_AUTHENTICITY_AUDIT',
      targetType: 'BEAT_CATALOGUE',
      targetId: 'ALL',
      details: JSON.stringify({ updated, preserved, total: beats.length }),
    },
  })

  return NextResponse.json({
    success: true,
    total: beats.length,
    updated,
    preserved,
    message:
      "Audit terminé. Les scores servent à prioriser la vérification humaine et ne prouvent pas à eux seuls l'usage d'une IA.",
  })
}
