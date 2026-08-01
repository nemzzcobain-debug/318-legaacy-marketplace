import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  prismaMock,
  bcryptHashMock,
  sendVerificationEmailMock,
  sendAdminNewApplicationEmailMock,
} = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    verificationToken: {
      create: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
  },
  bcryptHashMock: vi.fn(),
  sendVerificationEmailMock: vi.fn(),
  sendAdminNewApplicationEmailMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: bcryptHashMock,
  },
}))

vi.mock('@/lib/emails/resend', () => ({
  sendVerificationEmail: sendVerificationEmailMock,
  sendAdminNewApplicationEmail: sendAdminNewApplicationEmailMock,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

import { POST } from '@/app/api/auth/register/route'

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    bcryptHashMock.mockResolvedValue('hashed-password')
    sendVerificationEmailMock.mockResolvedValue({ success: true })
    sendAdminNewApplicationEmailMock.mockResolvedValue({ success: true })
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.findMany.mockResolvedValue([])
    prismaMock.verificationToken.create.mockResolvedValue({})
    prismaMock.notification.createMany.mockResolvedValue({ count: 0 })
  })

  it('creates an artist account and a verification token', async () => {
    prismaMock.user.create.mockResolvedValue({
      id: 'artist-1',
      name: 'Artiste Test',
      email: 'artiste@example.com',
      role: 'ARTIST',
      createdAt: new Date(),
    })

    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Artiste Test',
          email: 'artiste@example.com',
          password: 'MotDePasse1',
          role: 'ARTIST',
        }),
      })
    )

    expect(response.status).toBe(201)
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'ARTIST',
          producerStatus: null,
          passwordHash: 'hashed-password',
        }),
      })
    )
    expect(prismaMock.verificationToken.create).toHaveBeenCalledOnce()
    expect(sendVerificationEmailMock).toHaveBeenCalledOnce()
  })

  it('rejects an email that already exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'existing-user' })

    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Artiste Test',
          email: 'artiste@example.com',
          password: 'MotDePasse1',
          role: 'ARTIST',
        }),
      })
    )

    expect(response.status).toBe(409)
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('rejects an invalid password before accessing the database', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Artiste Test',
          email: 'artiste@example.com',
          password: 'faible',
          role: 'ARTIST',
        }),
      })
    )

    expect(response.status).toBe(400)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('creates a pending producer and notifies administrators', async () => {
    prismaMock.user.create.mockResolvedValue({
      id: 'producer-1',
      name: 'Beatmaker Test',
      email: 'producer@example.com',
      role: 'PRODUCER',
      createdAt: new Date(),
    })
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'admin-1', email: 'admin@example.com' },
    ])
    prismaMock.notification.createMany.mockResolvedValue({ count: 1 })

    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Beatmaker Test',
          email: 'producer@example.com',
          password: 'MotDePasse1',
          role: 'PRODUCER',
        }),
      })
    )

    expect(response.status).toBe(201)
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'PRODUCER',
          producerStatus: 'PENDING',
        }),
      })
    )
    expect(prismaMock.notification.createMany).toHaveBeenCalledOnce()
    expect(prismaMock.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'admin-1',
          link: '/admin?tab=producers&status=PENDING',
        }),
      ],
    })
    expect(sendAdminNewApplicationEmailMock).toHaveBeenCalledOnce()
  })

  it('returns a safe error when the database is unavailable', async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error('database unavailable'))

    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Artiste Test',
          email: 'artiste@example.com',
          password: 'MotDePasse1',
          role: 'ARTIST',
        }),
      })
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Erreur serveur' })
  })
})
