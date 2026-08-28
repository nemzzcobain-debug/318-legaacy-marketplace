import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, configuredMock, getScanMock, reportIssueMock } = vi.hoisted(() => ({
  prismaMock: {
    beat: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    auction: { updateMany: vi.fn() },
    notification: { create: vi.fn() },
    adminActionLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  configuredMock: vi.fn(),
  getScanMock: vi.fn(),
  reportIssueMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/ircam-ai-music', () => ({
  isIrcamAiMusicConfigured: configuredMock,
  getIrcamAiMusicScan: getScanMock,
}))
vi.mock('@/lib/monitoring', () => ({ reportOperationalIssue: reportIssueMock }))

import { processPendingIrcamScans } from '@/lib/ircam-scan-processing'

const processingBeat = {
  id: 'beat-1',
  title: 'Beat en analyse',
  status: 'ACTIVE',
  producerId: 'producer-1',
  audioUrl: 'https://cdn.example.com/beat.wav',
  audioOriginal: null,
  audioWav: null,
  aiReviewStatus: 'HUMAN_CONFIRMED',
  aiAudioProbability: null,
  aiAudioDetectorProvider: 'IRCAM_AMPLIFY_AIMD',
  aiAudioDetectorVersion: null,
  aiAudioSuspectedModel: null,
  aiAudioSuspectedVersion: null,
  aiAudioScanStatus: 'PROCESSING',
  aiAudioScanJobId: 'job-318',
  aiAudioScanError: null,
  aiAudioScannedAt: new Date(),
}

describe('traitement automatique des analyses IRCAM', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    configuredMock.mockReturnValue(true)
    prismaMock.beat.findMany.mockResolvedValue([processingBeat])
    prismaMock.beat.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.auction.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.notification.create.mockResolvedValue({})
    prismaMock.adminActionLog.create.mockResolvedValue({})
    prismaMock.$transaction.mockImplementation((callback: (tx: typeof prismaMock) => unknown) =>
      callback(prismaMock)
    )
  })

  it('ne contacte pas IRCAM si le service n’est pas configuré', async () => {
    configuredMock.mockReturnValue(false)

    const summary = await processPendingIrcamScans()

    expect(summary.configured).toBe(false)
    expect(prismaMock.beat.findMany).not.toHaveBeenCalled()
    expect(getScanMock).not.toHaveBeenCalled()
  })

  it('récupère le résultat en arrière-plan et applique automatiquement le conflit', async () => {
    getScanMock.mockResolvedValue({
      status: 'COMPLETED',
      probability: 96,
      detectorVersion: '1.0',
      suspectedModel: 'Suno',
      suspectedVersion: 'v4',
    })
    prismaMock.beat.findUnique.mockResolvedValue({
      ...processingBeat,
      status: 'PENDING',
      aiReviewStatus: 'CONFLICT_REVIEW_REQUIRED',
      aiAudioScanStatus: 'COMPLETED',
      aiAudioProbability: 96,
    })

    const summary = await processPendingIrcamScans()

    expect(getScanMock).toHaveBeenCalledWith('job-318')
    expect(summary).toMatchObject({ checked: 1, completed: 1, failed: 0 })
    expect(prismaMock.beat.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'beat-1',
          aiAudioScanStatus: 'PROCESSING',
        }),
        data: expect.objectContaining({
          aiReviewStatus: 'CONFLICT_REVIEW_REQUIRED',
          status: 'PENDING',
          isFeatured: false,
        }),
      })
    )
    expect(prismaMock.auction.updateMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.adminActionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ adminId: 'SYSTEM_IRCAM_CRON' }),
    })
  })

  it('n’envoie pas deux notifications si le cron et l’admin terminent le même scan', async () => {
    getScanMock.mockResolvedValue({ status: 'COMPLETED', probability: 92 })
    prismaMock.beat.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.beat.findUnique.mockResolvedValue({
      ...processingBeat,
      aiAudioScanStatus: 'COMPLETED',
      aiReviewStatus: 'CONFLICT_REVIEW_REQUIRED',
    })

    const summary = await processPendingIrcamScans()

    expect(summary.completed).toBe(0)
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
    expect(prismaMock.adminActionLog.create).not.toHaveBeenCalled()
  })
})
