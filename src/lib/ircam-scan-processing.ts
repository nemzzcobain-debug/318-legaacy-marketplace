import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  getIrcamAiMusicScan,
  isIrcamAiMusicConfigured,
  type IrcamScanResult,
} from '@/lib/ircam-ai-music'
import { reportOperationalIssue } from '@/lib/monitoring'

export const IRCAM_SCAN_BEAT_SELECT = {
  id: true,
  title: true,
  status: true,
  producerId: true,
  audioUrl: true,
  audioOriginal: true,
  audioWav: true,
  aiReviewStatus: true,
  aiAudioProbability: true,
  aiAudioDetectorProvider: true,
  aiAudioDetectorVersion: true,
  aiAudioSuspectedModel: true,
  aiAudioSuspectedVersion: true,
  aiAudioScanStatus: true,
  aiAudioScanJobId: true,
  aiAudioScanError: true,
  aiAudioScannedAt: true,
} as const

export type IrcamScanBeat = Prisma.BeatGetPayload<{
  select: typeof IRCAM_SCAN_BEAT_SELECT
}>

export function promoteIrcamReviewStatus(current: string, probability: number | undefined) {
  if (probability === undefined) return current

  if (
    probability >= 70 &&
    ['HUMAN_CONFIRMED', 'EVIDENCE_RECEIVED', 'REVIEW_IN_PROGRESS'].includes(current)
  ) {
    return 'CONFLICT_REVIEW_REQUIRED'
  }

  if (
    [
      'EVIDENCE_REQUESTED',
      'EVIDENCE_EXPIRED',
      'CONFLICT_REVIEW_REQUIRED',
      'QUARANTINED',
      'AI_REJECTED',
    ].includes(current)
  ) {
    return current
  }

  if (probability >= 70) return 'REVIEW_REQUIRED'
  if (probability >= 40 && ['NOT_ANALYZED', 'LOW_RISK'].includes(current)) {
    return 'REVIEW_RECOMMENDED'
  }
  return current
}

export async function finalizeIrcamScan({
  beat,
  result,
  actorId,
}: {
  beat: IrcamScanBeat
  result: Exclude<IrcamScanResult, { status: 'PROCESSING' }>
  actorId: string
}): Promise<{ beat: IrcamScanBeat; finalized: boolean; conflictCreated: boolean }> {
  const now = new Date()
  const previousReviewStatus = beat.aiReviewStatus
  const nextReviewStatus =
    result.status === 'COMPLETED'
      ? promoteIrcamReviewStatus(previousReviewStatus, result.probability)
      : previousReviewStatus
  const conflictCreated =
    nextReviewStatus === 'CONFLICT_REVIEW_REQUIRED' &&
    previousReviewStatus !== 'CONFLICT_REVIEW_REQUIRED'

  return prisma.$transaction(async (tx) => {
    // Une actualisation admin et le cron peuvent recevoir le résultat au même moment.
    // Seul le premier traitement terminal est autorisé à produire les effets annexes.
    const claim = await tx.beat.updateMany({
      where: {
        id: beat.id,
        aiAudioScanStatus: 'PROCESSING',
        aiAudioScanJobId: beat.aiAudioScanJobId,
      },
      data:
        result.status === 'COMPLETED'
          ? {
              aiAudioScanStatus: 'COMPLETED',
              aiAudioProbability: result.probability,
              aiAudioDetectorVersion: result.detectorVersion,
              aiAudioSuspectedModel: result.suspectedModel,
              aiAudioSuspectedVersion: result.suspectedVersion,
              aiAudioScanError: null,
              aiAudioScannedAt: now,
              aiReviewStatus: nextReviewStatus,
              ...(conflictCreated ? { status: 'PENDING', isFeatured: false } : {}),
            }
          : {
              aiAudioScanStatus: 'FAILED',
              aiAudioDetectorVersion: result.detectorVersion,
              aiAudioScanError: result.error || 'Analyse audio impossible',
              aiAudioScannedAt: now,
            },
    })

    if (claim.count !== 1) {
      const currentBeat = await tx.beat.findUnique({
        where: { id: beat.id },
        select: IRCAM_SCAN_BEAT_SELECT,
      })
      if (!currentBeat) throw new Error('IRCAM_BEAT_NOT_FOUND_AFTER_SCAN')
      return { beat: currentBeat, finalized: false, conflictCreated: false }
    }

    if (conflictCreated) {
      await tx.auction.updateMany({
        where: {
          beatId: beat.id,
          status: { in: ['SCHEDULED', 'ACTIVE', 'ENDING_SOON'] },
        },
        data: { status: 'PENDING_APPROVAL' },
      })
    }

    const updatedBeat = await tx.beat.findUnique({
      where: { id: beat.id },
      select: IRCAM_SCAN_BEAT_SELECT,
    })
    if (!updatedBeat) throw new Error('IRCAM_BEAT_NOT_FOUND_AFTER_SCAN')

    if (conflictCreated) {
      await tx.notification.create({
        data: {
          userId: updatedBeat.producerId,
          type: 'SYSTEM',
          title: 'Contrôle anti-IA complémentaire',
          message: `« ${updatedBeat.title} » est temporairement masqué pendant un nouvel examen administratif.`,
          link: '/dashboard?tab=beats',
        },
      })
    }

    await tx.adminActionLog.create({
      data: {
        adminId: actorId,
        action:
          result.status === 'COMPLETED'
            ? 'COMPLETE_IRCAM_AUDIO_SCAN'
            : 'FAIL_IRCAM_AUDIO_SCAN',
        targetType: 'BEAT',
        targetId: updatedBeat.id,
        details: JSON.stringify({
          probability: result.probability,
          suspectedModel: result.suspectedModel,
          suspectedVersion: result.suspectedVersion,
          detectorVersion: result.detectorVersion,
          error: result.error,
          previousReviewStatus,
          nextReviewStatus,
          conflictCreated,
          automatic: actorId === 'SYSTEM_IRCAM_CRON',
        }),
      },
    })

    return { beat: updatedBeat, finalized: true, conflictCreated }
  })
}

export async function processPendingIrcamScans(limit = 10) {
  if (!isIrcamAiMusicConfigured()) {
    return { configured: false, checked: 0, processing: 0, completed: 0, failed: 0 }
  }

  const beats = await prisma.beat.findMany({
    where: {
      aiAudioScanStatus: 'PROCESSING',
      aiAudioScanJobId: { not: null },
    },
    orderBy: { aiAudioScannedAt: 'asc' },
    take: Math.max(1, Math.min(limit, 25)),
    select: IRCAM_SCAN_BEAT_SELECT,
  })

  const summary = {
    configured: true,
    checked: beats.length,
    processing: 0,
    completed: 0,
    failed: 0,
  }

  for (const beat of beats) {
    try {
      const result = await getIrcamAiMusicScan(beat.aiAudioScanJobId!)
      if (result.status === 'PROCESSING') {
        summary.processing += 1
        continue
      }

      const finalized = await finalizeIrcamScan({
        beat,
        result,
        actorId: 'SYSTEM_IRCAM_CRON',
      })
      if (finalized.finalized) {
        if (result.status === 'COMPLETED') summary.completed += 1
        else summary.failed += 1
      }
    } catch (error) {
      summary.failed += 1
      await reportOperationalIssue({
        area: 'health',
        severity: 'warning',
        message: 'Récupération automatique d’une analyse IRCAM impossible',
        context: { beatId: beat.id, error: String(error) },
      })
    }
  }

  return summary
}
