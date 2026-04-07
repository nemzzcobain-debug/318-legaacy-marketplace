import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/auth/register/route'
import { prismaMock } from '@/__mocks__/prisma'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/emails/resend', () => ({
  sendWelcomeEmail: vi.fn(),
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async (password: string) => `hashed_${password}`),
  },
}))

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should register a new user successfully and return 201', async () => {
    const validUser = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'SecurePass123',
      role: 'ARTIST',
    }

    // Mock prisma responses
    prismaMock.user.findUnique.mockResolvedValueOnce(null) // No existing user
    prismaMock.user.create.mockResolvedValueOnce({
      id: 'user-123',
      name: validUser.name,
      email: validUser.email,
      role: validUser.role,
      createdAt: new Date(),
    })
    prismaMock.user.findMany.mockResolvedValueOnce([]) // No admins

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(validUser),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.message).toBe('Compte cree avec succes')
    expect(data.user).toHaveProperty('id')
    expect(data.user.email).toBe(validUser.email)
    expect(prismaMock.user.findUnique).toHaveBeenCalled()
    expect(prismaMock.user.create).toHaveBeenCalled()
  })

  it('should reject duplicate email and return 409', async () => {
    const newUser = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'SecurePass123',
      role: 'ARTIST',
    }

    // Mock existing user
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'existing-user-123',
      email: newUser.email,
      name: 'Existing User',
    })

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(newUser),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toBe('Un compte existe deja avec cet email')
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('should reject weak password and return 400', async () => {
    const weakPasswordUser = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'weak', // Too short and missing requirements
      role: 'ARTIST',
    }

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(weakPasswordUser),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('should reject password without uppercase letter', async () => {
    const noUppercaseUser = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'lowercase123', // Missing uppercase
      role: 'ARTIST',
    }

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(noUppercaseUser),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('majuscule')
  })

  it('should reject password without digit', async () => {
    const noDigitUser = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'NoDigitPassword', // Missing digit
      role: 'ARTIST',
    }

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(noDigitUser),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('chiffre')
  })

  it('should reject invalid email and return 400', async () => {
    const invalidEmailUser = {
      name: 'Test User',
      email: 'not-an-email',
      password: 'ValidPass123',
      role: 'ARTIST',
    }

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(invalidEmailUser),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Email')
  })

  it('should reject missing name field', async () => {
    const missingNameUser = {
      email: 'test@example.com',
      password: 'ValidPass123',
      role: 'ARTIST',
    }

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(missingNameUser),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('should reject missing email field', async () => {
    const missingEmailUser = {
      name: 'Test User',
      password: 'ValidPass123',
      role: 'ARTIST',
    }

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(missingEmailUser),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('should reject missing password field', async () => {
    const missingPasswordUser = {
      name: 'Test User',
      email: 'test@example.com',
      role: 'ARTIST',
    }

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(missingPasswordUser),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('should set PRODUCER status to PENDING for producer role', async () => {
    const producerUser = {
      name: 'Producer User',
      email: 'producer@example.com',
      password: 'SecurePass123',
      role: 'PRODUCER',
    }

    prismaMock.user.findUnique.mockResolvedValueOnce(null)
    prismaMock.user.create.mockResolvedValueOnce({
      id: 'producer-123',
      name: producerUser.name,
      email: producerUser.email,
      role: producerUser.role,
      createdAt: new Date(),
    })
    prismaMock.user.findMany.mockResolvedValueOnce([
      { id: 'admin-1' },
      { id: 'admin-2' },
    ])
    prismaMock.notification.createMany.mockResolvedValueOnce({ count: 2 })

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(producerUser),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'PRODUCER',
          producerStatus: 'PENDING',
        }),
      })
    )
    expect(prismaMock.notification.createMany).toHaveBeenCalled()
  })

  it('should handle server errors gracefully', async () => {
    const validUser = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'ValidPass123',
      role: 'ARTIST',
    }

    prismaMock.user.findUnique.mockRejectedValueOnce(
      new Error('Database error')
    )

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(validUser),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Erreur serveur')
  })
})
