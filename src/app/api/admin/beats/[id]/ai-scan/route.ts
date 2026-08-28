export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSignedUrl, parseSupabaseUrl } from '@/lib/supabase'
import {
  getIrcamAiMusicScan,
  isIrcamAiMusicConfigured,
  startIrcamAiMusicScan,
} from '@/lib/ircam-ai-music'

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED']
const SCAN_COOLDOWN_MS = 15 * 60 * 1000

const BEAT_SCAN_SELECT = {
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

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  return session?.user?.role === 'ADMIN' ? session : null
}

function promoteReviewStatus(current: string, probability: number | undefined) {
  if (probability === undefined) {
    return current
  }

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

async function getBeat(id: string) {
  return prisma.beat.findUnique({
    where: { id },
    select: BEAT_SCAN_SELECT,
  })
}

function publicScanState(beat: Awaited<ReturnType<typeof getBeat>>) {
  if (!beat) return null
  return {
    status: beat.aiAudioScanStatus,
    probability: beat.aiAudioProbability,
    provider: beat.aiAudioDetectorProvider,
    detectorVersion: beat.aiAudioDetectorVersion,
    suspectedModel: beat.aiAudioSuspectedModel,
    suspectedVersion: beat.aiAudioSuspectedVersion,
    error: beat.aiAudioScanError,
    scannedAt: beat.aiAudioScannedAt,
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let lockedBeatId: string | null = null
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    if (!isIrcamAiMusicConfigured()) {
      return NextResponse.json(
        {
          error: "Le détecteur IRCAM n'est pas encore activé.",
          code: 'IRCAM_NOT_CONFIGURED',
        },
        { status: 503 }
      )
    }

    const { id } = await params
    const beat = await getBeat(id)
    if (!beat) return NextResponse.json({ error: 'Beat introuvable' }, { status: 404 })

    if (beat.aiAudioScanStatus === 'PROCESSING') {
      return NextResponse.json(
        {
          error: 'Une analyse IRCAM est déjà en cours pour ce beat.',
          code: 'IRCAM_SCAN_IN_PROGRESS',
          scan: publicScanState(beat),
        },
        { status: 409 }
      )
    }

    const now = new Date()
    const elapsedSinceLastScan = beat.aiAudioScannedAt
      ? now.getTime() - beat.aiAudioScannedAt.getTime()
      : SCAN_COOLDOWN_MS
    if (elapsedSinceLastScan < SCAN_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((SCAN_COOLDOWN_MS - elapsedSinceLastScan) / 1000)
      return NextResponse.json(
        {
          error: 'Une analyse vient déjà d’être lancée. Réessaie dans quelques minutes.',
          code: 'IRCAM_SCAN_COOLDOWN',
          retryAfterSeconds,
          scan: publicScanState(beat),
        },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      )
    }

    const sourceUrl = beat.audioWav || beat.audioOriginal || beat.audioUrl
    if (!sourceUrl) {
      return NextResponse.json({ error: 'Aucun fichier audio à analyser' }, { status: 422 })
    }

    const parsed = parseSupabaseUrl(sourceUrl)
    const analysisUrl = parsed
      ? await getSignedUrl(parsed.bucket, parsed.path, 60 * 60)
      : sourceUrl
    if (!analysisUrl) {
      return NextResponse.json(
        { error: "Impossible de préparer le fichier pour l'analyse" },
        { status: 502 }
      )
    }

    // Verrou atomique : deux clics/requêtes simultanés ne peuvent pas consommer deux analyses.
    const lock = await prisma.beat.updateMany({
      where: {
        id: beat.id,
        aiAudioScanStatus: { not: 'PROCESSING' },
        OR: [
          { aiAudioScannedAt: null },
          { aiAudioScannedAt: { lte: new Date(now.getTime() - SCAN_COOLDOWN_MS) } },
        ],
      },
      data: {
        aiAudioScanStatus: 'PROCESSING',
        aiAudioScanError: null,
        aiAudioScannedAt: now,
      },
    })
    if (lock.count !== 1) {
      return NextResponse.json(
        {
          error: 'Une analyse IRCAM est déjà en cours ou vient d’être lancée.',
          code: 'IRCAM_SCAN_LOCKED',
        },
        { status: 409 }
      )
    }
    lockedBeatId = beat.id

    const jobId = await startIrcamAiMusicScan(analysisUrl)

    await prisma.$transaction([
      prisma.beat.update({
        where: { id: beat.id },
        data: {
          aiAudioScanStatus: 'PROCESSING',
          aiAudioScanJobId: jobId,
          aiAudioScanError: null,
          aiAudioDetectorProvider: 'IRCAM_AMPLIFY_AIMD',
          aiAudioScannedAt: now,
        },
      }),
      prisma.adminActionLog.create({
        data: {
          adminId: session.user.id,
          action: 'START_IRCAM_AUDIO_SCAN',
          targetType: 'BEAT',
          targetId: beat.id,
          details: JSON.stringify({ jobId, provider: 'IRCAM_AMPLIFY_AIMD' }),
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: 'Analyse audio IRCAM démarrée.',
      scan: {
        status: 'PROCESSING',
        probability: null,
        provider: 'IRCAM_AMPLIFY_AIMD',
        detectorVersion: null,
        suspectedModel: null,
        suspectedVersion: null,
        error: null,
        scannedAt: now,
      },
    })
  } catch (error) {
    console.error('Start IRCAM audio scan error:', error)
    if (lockedBeatId) {
      await prisma.beat
        .update({
          where: { id: lockedBeatId },
          data: {
            aiAudioScanStatus: 'FAILED',
            aiAudioScanError: "Impossible de démarrer l'analyse IRCAM",
            aiAudioScannedAt: new Date(),
          },
        })
        .catch((updateError) => console.error('Release IRCAM scan lock error:', updateError))
    }
    return NextResponse.json(
      { error: "Impossible de démarrer l'analyse audio IRCAM" },
      { status: 502 }
    )
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    const { id } = await params
    let beat = await getBeat(id)
    if (!beat) return NextResponse.json({ error: 'Beat introuvable' }, { status: 404 })

    if (!beat.aiAudioScanJobId || TERMINAL_STATUSES.includes(beat.aiAudioScanStatus)) {
      return NextResponse.json({ success: true, scan: publicScanState(beat) })
    }
    if (!isIrcamAiMusicConfigured()) {
      return NextResponse.json(
        { error: "Le détecteur IRCAM n'est pas configuré", code: 'IRCAM_NOT_CONFIGURED' },
        { status: 503 }
      )
    }

    const result = await getIrcamAiMusicScan(beat.aiAudioScanJobId)
    if (result.status === 'PROCESSING') {
      return NextResponse.json({
        success: true,
        scan: { ...publicScanState(beat), status: 'PROCESSING' },
      })
    }

    const now = new Date()
    const previousReviewStatus = beat.aiReviewStatus
    const nextReviewStatus =
      result.status === 'COMPLETED'
        ? promoteReviewStatus(previousReviewStatus, result.probability)
        : previousReviewStatus
    const conflictCreated =
      nextReviewStatus === 'CONFLICT_REVIEW_REQUIRED' &&
      previousReviewStatus !== 'CONFLICT_REVIEW_REQUIRED'

    beat = await prisma.$transaction(async (tx) => {
      if (conflictCreated) {
        await tx.auction.updateMany({
          where: {
            beatId: beat!.id,
            status: { in: ['SCHEDULED', 'ACTIVE', 'ENDING_SOON'] },
          },
          data: { status: 'PENDING_APPROVAL' },
        })
      }

      const updatedBeat = await tx.beat.update({
        where: { id: beat!.id },
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
        select: BEAT_SCAN_SELECT,
      })

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
          adminId: session.user.id,
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
          }),
        },
      })

      return updatedBeat
    })

    return NextResponse.json({ success: true, scan: publicScanState(beat) })
  } catch (error) {
    console.error('Poll IRCAM audio scan error:', error)
    return NextResponse.json(
      { error: "Impossible de récupérer le résultat de l'analyse IRCAM" },
      { status: 502 }
    )
  }
}
