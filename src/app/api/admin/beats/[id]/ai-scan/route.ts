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
import {
  finalizeIrcamScan,
  IRCAM_SCAN_BEAT_SELECT,
} from '@/lib/ircam-scan-processing'

const TERMINAL_STATUSES = ['COMPLETED', 'FAILED']
const SCAN_COOLDOWN_MS = 15 * 60 * 1000

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  return session?.user?.role === 'ADMIN' ? session : null
}

async function getBeat(id: string) {
  return prisma.beat.findUnique({
    where: { id },
    select: IRCAM_SCAN_BEAT_SELECT,
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

    const finalized = await finalizeIrcamScan({
      beat,
      result,
      actorId: session.user.id,
    })
    beat = finalized.beat

    return NextResponse.json({ success: true, scan: publicScanState(beat) })
  } catch (error) {
    console.error('Poll IRCAM audio scan error:', error)
    return NextResponse.json(
      { error: "Impossible de récupérer le résultat de l'analyse IRCAM" },
      { status: 502 }
    )
  }
}
