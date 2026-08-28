import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  prismaMock,
  getServerSessionMock,
  isConfiguredMock,
  startScanMock,
  getScanMock,
} = vi.hoisted(() => ({
  prismaMock: {
    beat: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    auction: { updateMany: vi.fn() },
    notification: { create: vi.fn() },
    adminActionLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  getServerSessionMock: vi.fn(),
  isConfiguredMock: vi.fn(),
  startScanMock: vi.fn(),
  getScanMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/supabase', () => ({
  parseSupabaseUrl: vi.fn(() => null),
  getSignedUrl: vi.fn(),
}))
vi.mock('@/lib/ircam-ai-music', () => ({
  isIrcamAiMusicConfigured: isConfiguredMock,
  startIrcamAiMusicScan: startScanMock,
  getIrcamAiMusicScan: getScanMock,
}))

import { GET, POST } from '@/app/api/admin/beats/[id]/ai-scan/route'

const baseBeat = {
  id: 'beat-1',
  title: 'Beat contrôlé',
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
  aiAudioScanStatus: 'NOT_REQUESTED',
  aiAudioScanJobId: null,
  aiAudioScanError: null,
  aiAudioScannedAt: null,
}

const routeContext = { params: Promise.resolve({ id: 'beat-1' }) }

describe('API admin — analyses audio IRCAM', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
    isConfiguredMock.mockReturnValue(true)
    prismaMock.beat.findUnique.mockResolvedValue({ ...baseBeat })
    prismaMock.beat.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.auction.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.notification.create.mockResolvedValue({})
    prismaMock.adminActionLog.create.mockResolvedValue({})
    prismaMock.$transaction.mockImplementation(async (operation: unknown) => {
      if (typeof operation === 'function') {
        return operation(prismaMock)
      }
      return Promise.all(operation as Promise<unknown>[])
    })
  })

  it('refuse une deuxième analyse pendant qu’une analyse est en cours', async () => {
    const processingBeat = {
      ...baseBeat,
      aiAudioScanStatus: 'PROCESSING',
      aiAudioScanJobId: 'job-1',
      aiAudioScannedAt: new Date(),
    }
    const conflictedBeat = {
      ...baseBeat,
      status: 'PENDING',
      aiReviewStatus: 'CONFLICT_REVIEW_REQUIRED',
      aiAudioScanStatus: 'COMPLETED',
      aiAudioProbability: 98,
      aiAudioScanJobId: 'job-1',
      aiAudioScannedAt: new Date(),
    }
    prismaMock.beat.findUnique
      .mockResolvedValueOnce(processingBeat)
      .mockResolvedValueOnce(conflictedBeat)

    const response = await POST(new Request('http://localhost') as never, routeContext)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('IRCAM_SCAN_IN_PROGRESS')
    expect(startScanMock).not.toHaveBeenCalled()
    expect(prismaMock.beat.updateMany).not.toHaveBeenCalled()
  })

  it('impose quinze minutes avant une nouvelle analyse', async () => {
    prismaMock.beat.findUnique.mockResolvedValue({
      ...baseBeat,
      aiAudioScanStatus: 'COMPLETED',
      aiAudioScannedAt: new Date(Date.now() - 60_000),
    })

    const response = await POST(new Request('http://localhost') as never, routeContext)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.code).toBe('IRCAM_SCAN_COOLDOWN')
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(startScanMock).not.toHaveBeenCalled()
  })

  it('verrouille atomiquement le beat avant d’appeler IRCAM', async () => {
    startScanMock.mockResolvedValue('job-318')
    prismaMock.beat.update.mockResolvedValue({})

    const response = await POST(new Request('http://localhost') as never, routeContext)

    expect(response.status).toBe(200)
    expect(prismaMock.beat.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'beat-1',
          aiAudioScanStatus: { not: 'PROCESSING' },
        }),
        data: expect.objectContaining({ aiAudioScanStatus: 'PROCESSING' }),
      })
    )
    expect(startScanMock).toHaveBeenCalledTimes(1)
  })

  it('crée un conflit, masque le beat et suspend ses enchères si IRCAM contredit la validation', async () => {
    prismaMock.beat.findUnique.mockResolvedValue({
      ...baseBeat,
      aiAudioScanStatus: 'PROCESSING',
      aiAudioScanJobId: 'job-1',
      aiAudioScannedAt: new Date(),
    })
    getScanMock.mockResolvedValue({
      status: 'COMPLETED',
      probability: 98,
      detectorVersion: '1.0',
      suspectedModel: 'Suno',
      suspectedVersion: 'v4',
    })
    const response = await GET(new Request('http://localhost') as never, routeContext)

    expect(response.status).toBe(200)
    expect(prismaMock.auction.updateMany).toHaveBeenCalledWith({
      where: {
        beatId: 'beat-1',
        status: { in: ['SCHEDULED', 'ACTIVE', 'ENDING_SOON'] },
      },
      data: { status: 'PENDING_APPROVAL' },
    })
    expect(prismaMock.beat.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'beat-1',
          aiAudioScanStatus: 'PROCESSING',
          aiAudioScanJobId: 'job-1',
        }),
        data: expect.objectContaining({
          status: 'PENDING',
          isFeatured: false,
          aiReviewStatus: 'CONFLICT_REVIEW_REQUIRED',
          aiAudioProbability: 98,
        }),
      })
    )
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'producer-1',
        type: 'SYSTEM',
      }),
    })
  })
})
