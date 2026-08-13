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

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  return session?.user?.role === 'ADMIN' ? session : null
}

function promoteReviewStatus(current: string, probability: number | undefined) {
  if (
    probability === undefined ||
    ['EVIDENCE_REQUESTED', 'HUMAN_CONFIRMED', 'AI_REJECTED'].includes(current)
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
    select: {
      id: true,
      title: true,
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
    },
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

    const jobId = await startIrcamAiMusicScan(analysisUrl)
    const now = new Date()

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
    beat = await prisma.beat.update({
      where: { id: beat.id },
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
              aiReviewStatus: promoteReviewStatus(beat.aiReviewStatus, result.probability),
            }
          : {
              aiAudioScanStatus: 'FAILED',
              aiAudioDetectorVersion: result.detectorVersion,
              aiAudioScanError: result.error || 'Analyse audio impossible',
              aiAudioScannedAt: now,
            },
      select: {
        id: true,
        title: true,
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
      },
    })

    await prisma.adminActionLog.create({
      data: {
        adminId: session.user.id,
        action: result.status === 'COMPLETED' ? 'COMPLETE_IRCAM_AUDIO_SCAN' : 'FAIL_IRCAM_AUDIO_SCAN',
        targetType: 'BEAT',
        targetId: beat.id,
        details: JSON.stringify({
          probability: result.probability,
          suspectedModel: result.suspectedModel,
          suspectedVersion: result.suspectedVersion,
          detectorVersion: result.detectorVersion,
          error: result.error,
        }),
      },
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
