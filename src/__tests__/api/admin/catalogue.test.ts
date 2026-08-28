import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, getServerSessionMock, sendEvidenceEmailMock } = vi.hoisted(() => ({
  prismaMock: {
    beat: { findUnique: vi.fn(), update: vi.fn() },
    auction: { updateMany: vi.fn() },
    notification: { create: vi.fn() },
    adminActionLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  getServerSessionMock: vi.fn(),
  sendEvidenceEmailMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/supabase', () => ({ deleteFile: vi.fn(), parseSupabaseUrl: vi.fn() }))
vi.mock('@/lib/emails/resend', () => ({
  sendAuthenticityEvidenceRequestEmail: sendEvidenceEmailMock,
}))

import { PATCH } from '@/app/api/admin/catalogue/route'

describe('PATCH /api/admin/catalogue — challenge de preuve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
    prismaMock.beat.findUnique.mockResolvedValue({
      id: 'beat-1',
      title: 'Beat contrôlé',
      status: 'PENDING',
      aiReviewStatus: 'REVIEW_IN_PROGRESS',
      producer: {
        id: 'producer-1',
        email: 'producer@example.com',
        name: 'Beatmaker',
        displayName: 'Beatmaker 318',
      },
      auctions: [],
      _count: { purchases: 0 },
    })
    prismaMock.beat.update.mockResolvedValue({})
    prismaMock.auction.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.notification.create.mockResolvedValue({})
    prismaMock.adminActionLog.create.mockResolvedValue({})
    prismaMock.$transaction.mockResolvedValue([])
    sendEvidenceEmailMock.mockResolvedValue({ success: true })
  })

  it('génère, conserve et envoie un code unique valable sept jours', async () => {
    const response = await PATCH(
      new Request('http://localhost/api/admin/catalogue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beatId: 'beat-1',
          action: 'REQUEST_EVIDENCE',
          note: 'Montre la timeline et les pistes séparées.',
        }),
      }) as never
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.evidenceCode).toMatch(/^318-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/)

    const updateData = prismaMock.beat.update.mock.calls[0][0].data
    expect(updateData).toMatchObject({
      aiReviewStatus: 'EVIDENCE_REQUESTED',
      aiEvidenceCode: body.evidenceCode,
      aiAdminNote: 'Montre la timeline et les pistes séparées.',
    })
    expect(updateData.aiEvidenceExpiresAt).toBeInstanceOf(Date)
    expect(updateData.aiEvidenceExpiresAt.getTime() - updateData.aiEvidenceRequestedAt.getTime()).toBe(
      7 * 24 * 60 * 60 * 1000
    )

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'producer-1',
        message: expect.stringContaining(body.evidenceCode),
      }),
    })
    expect(sendEvidenceEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'producer@example.com',
        evidenceCode: body.evidenceCode,
        evidenceExpiresAt: updateData.aiEvidenceExpiresAt,
      })
    )
  })

  it('marque les preuves comme reçues avec une trace obligatoire', async () => {
    prismaMock.beat.findUnique.mockResolvedValue({
      id: 'beat-1',
      title: 'Beat contrôlé',
      status: 'PENDING',
      aiReviewStatus: 'EVIDENCE_REQUESTED',
      aiEvidenceCode: '318-AAAA-BBBB-CCCC',
      producer: {
        id: 'producer-1',
        email: 'producer@example.com',
        name: 'Beatmaker',
        displayName: 'Beatmaker 318',
      },
      auctions: [],
      _count: { purchases: 0 },
    })

    const response = await PATCH(
      new Request('http://localhost/api/admin/catalogue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beatId: 'beat-1',
          action: 'MARK_EVIDENCE_RECEIVED',
          note: 'Vidéo et projet DAW conservés dans le dossier de contrôle.',
        }),
      }) as never
    )

    expect(response.status).toBe(200)
    expect(prismaMock.beat.update).toHaveBeenCalledWith({
      where: { id: 'beat-1' },
      data: expect.objectContaining({
        aiReviewStatus: 'EVIDENCE_RECEIVED',
        aiAdminNote: 'Vidéo et projet DAW conservés dans le dossier de contrôle.',
      }),
    })
  })

  it('met en quarantaine sans effacer les enchères déjà placées', async () => {
    prismaMock.beat.findUnique.mockResolvedValue({
      id: 'beat-1',
      title: 'Beat contrôlé',
      status: 'ACTIVE',
      aiReviewStatus: 'REVIEW_REQUIRED',
      producer: {
        id: 'producer-1',
        email: 'producer@example.com',
        name: 'Beatmaker',
        displayName: 'Beatmaker 318',
      },
      auctions: [
        { id: 'auction-1', status: 'ACTIVE', totalBids: 2, _count: { bids: 2 } },
      ],
      _count: { purchases: 0 },
    })

    const response = await PATCH(
      new Request('http://localhost/api/admin/catalogue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beatId: 'beat-1',
          action: 'QUARANTINE',
          note: 'Authenticité à vérifier avant toute nouvelle enchère.',
        }),
      }) as never
    )

    expect(response.status).toBe(200)
    expect(prismaMock.auction.updateMany).toHaveBeenCalledWith({
      where: {
        beatId: 'beat-1',
        status: { in: ['ACTIVE', 'ENDING_SOON', 'SCHEDULED'] },
      },
      data: { status: 'PENDING_APPROVAL' },
    })
    expect(prismaMock.beat.update).toHaveBeenCalledWith({
      where: { id: 'beat-1' },
      data: expect.objectContaining({
        status: 'PENDING',
        aiReviewStatus: 'QUARANTINED',
      }),
    })
  })
})
