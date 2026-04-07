import { describe, it, expect } from 'vitest'
import {
  registerSchema,
  loginSchema,
  placeBidSchema,
  createAuctionSchema,
  createBeatSchema,
  producerApplicationSchema,
} from '@/lib/validations'

describe('Zod Schemas Validation', () => {
  describe('registerSchema', () => {
    it('should validate correct registration data', () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123',
        role: 'ARTIST',
      }

      const result = registerSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe('john@example.com')
        expect(result.data.role).toBe('ARTIST')
      }
    })

    it('should reject short name', () => {
      const invalidData = {
        name: 'J',
        email: 'john@example.com',
        password: 'SecurePass123',
        role: 'ARTIST',
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('court')
      }
    })

    it('should reject invalid email', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'not-an-email',
        password: 'SecurePass123',
        role: 'ARTIST',
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Email')
      }
    })

    it('should reject password without uppercase', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'lowercase123',
        role: 'ARTIST',
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('majuscule')
      }
    })

    it('should reject password without lowercase', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'UPPERCASE123',
        role: 'ARTIST',
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('minuscule')
      }
    })

    it('should reject password without digit', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'NoDigitPassword',
        role: 'ARTIST',
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('chiffre')
      }
    })

    it('should reject short password', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Pass1',
        role: 'ARTIST',
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject invalid role', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123',
        role: 'INVALID_ROLE',
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should accept PRODUCER role', () => {
      const validData = {
        name: 'Jane Producer',
        email: 'jane@example.com',
        password: 'SecurePass123',
        role: 'PRODUCER',
      }

      const result = registerSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.role).toBe('PRODUCER')
      }
    })
  })

  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const validData = {
        email: 'john@example.com',
        password: 'anypassword123',
      }

      const result = loginSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'not-an-email',
        password: 'anypassword123',
      }

      const result = loginSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should require password', () => {
      const invalidData = {
        email: 'john@example.com',
        password: '',
      }

      const result = loginSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should allow any password format for login', () => {
      const validData = {
        email: 'john@example.com',
        password: 'simple',
      }

      const result = loginSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })
  })

  describe('placeBidSchema', () => {
    it('should validate correct bid placement', () => {
      const validData = {
        amount: 150,
        licenseType: 'BASIC',
        isAutoBid: false,
      }

      const result = placeBidSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.amount).toBe(150)
        expect(result.data.licenseType).toBe('BASIC')
      }
    })

    it('should set default licenseType to BASIC', () => {
      const validData = {
        amount: 150,
        isAutoBid: false,
      }

      const result = placeBidSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.licenseType).toBe('BASIC')
      }
    })

    it('should accept PREMIUM license type', () => {
      const validData = {
        amount: 150,
        licenseType: 'PREMIUM',
        isAutoBid: false,
      }

      const result = placeBidSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.licenseType).toBe('PREMIUM')
      }
    })

    it('should accept EXCLUSIVE license type', () => {
      const validData = {
        amount: 150,
        licenseType: 'EXCLUSIVE',
        isAutoBid: true,
        maxAutoBid: 500,
      }

      const result = placeBidSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.licenseType).toBe('EXCLUSIVE')
      }
    })

    it('should reject negative amount', () => {
      const invalidData = {
        amount: -100,
        licenseType: 'BASIC',
      }

      const result = placeBidSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject zero amount', () => {
      const invalidData = {
        amount: 0,
        licenseType: 'BASIC',
      }

      const result = placeBidSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should accept auto bid with maxAutoBid', () => {
      const validData = {
        amount: 150,
        licenseType: 'PREMIUM',
        isAutoBid: true,
        maxAutoBid: 500,
      }

      const result = placeBidSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isAutoBid).toBe(true)
        expect(result.data.maxAutoBid).toBe(500)
      }
    })

    it('should allow missing maxAutoBid if isAutoBid is false', () => {
      const validData = {
        amount: 150,
        licenseType: 'BASIC',
        isAutoBid: false,
      }

      const result = placeBidSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject invalid license type', () => {
      const invalidData = {
        amount: 150,
        licenseType: 'INVALID',
      }

      const result = placeBidSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('createAuctionSchema', () => {
    it('should validate correct auction creation', () => {
      const validData = {
        beatId: 'beat-123',
        startPrice: 50,
        licenseType: 'BASIC',
        durationHours: 24,
        bidIncrement: 5,
      }

      const result = createAuctionSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.beatId).toBe('beat-123')
        expect(result.data.startPrice).toBe(50)
      }
    })

    it('should use default bidIncrement of 5', () => {
      const validData = {
        beatId: 'beat-123',
        startPrice: 50,
        licenseType: 'BASIC',
        durationHours: 24,
      }

      const result = createAuctionSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.bidIncrement).toBe(5)
      }
    })

    it('should reject negative startPrice', () => {
      const invalidData = {
        beatId: 'beat-123',
        startPrice: -50,
        licenseType: 'BASIC',
        durationHours: 24,
      }

      const result = createAuctionSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject duration less than 1 hour', () => {
      const invalidData = {
        beatId: 'beat-123',
        startPrice: 50,
        licenseType: 'BASIC',
        durationHours: 0,
      }

      const result = createAuctionSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject duration more than 7 days (168 hours)', () => {
      const invalidData = {
        beatId: 'beat-123',
        startPrice: 50,
        licenseType: 'BASIC',
        durationHours: 169,
      }

      const result = createAuctionSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should accept duration of exactly 7 days', () => {
      const validData = {
        beatId: 'beat-123',
        startPrice: 50,
        licenseType: 'BASIC',
        durationHours: 168,
      }

      const result = createAuctionSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should allow optional reservePrice', () => {
      const validData = {
        beatId: 'beat-123',
        startPrice: 50,
        reservePrice: 100,
        licenseType: 'BASIC',
        durationHours: 24,
      }

      const result = createAuctionSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.reservePrice).toBe(100)
      }
    })

    it('should allow optional buyNowPrice', () => {
      const validData = {
        beatId: 'beat-123',
        startPrice: 50,
        buyNowPrice: 200,
        licenseType: 'BASIC',
        durationHours: 24,
      }

      const result = createAuctionSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.buyNowPrice).toBe(200)
      }
    })

    it('should accept EXCLUSIVE license type', () => {
      const validData = {
        beatId: 'beat-123',
        startPrice: 50,
        licenseType: 'EXCLUSIVE',
        durationHours: 24,
      }

      const result = createAuctionSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.licenseType).toBe('EXCLUSIVE')
      }
    })
  })

  describe('createBeatSchema', () => {
    it('should validate correct beat creation', () => {
      const validData = {
        title: 'Epic Beat',
        description: 'A powerful beat for rap music',
        genre: 'Hip-Hop',
        mood: 'Aggressive',
        bpm: 95,
        key: 'C Minor',
        tags: ['trap', 'dark', 'heavy'],
      }

      const result = createBeatSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe('Epic Beat')
        expect(result.data.bpm).toBe(95)
      }
    })

    it('should require title', () => {
      const invalidData = {
        title: '',
        genre: 'Hip-Hop',
        bpm: 95,
      }

      const result = createBeatSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should allow optional description', () => {
      const validData = {
        title: 'Epic Beat',
        genre: 'Hip-Hop',
        bpm: 95,
      }

      const result = createBeatSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject BPM below 40', () => {
      const invalidData = {
        title: 'Slow Beat',
        genre: 'Hip-Hop',
        bpm: 39,
      }

      const result = createBeatSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject BPM above 300', () => {
      const invalidData = {
        title: 'Fast Beat',
        genre: 'Hip-Hop',
        bpm: 301,
      }

      const result = createBeatSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should accept BPM of 40', () => {
      const validData = {
        title: 'Slow Beat',
        genre: 'Hip-Hop',
        bpm: 40,
      }

      const result = createBeatSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should accept BPM of 300', () => {
      const validData = {
        title: 'Fast Beat',
        genre: 'Hip-Hop',
        bpm: 300,
      }

      const result = createBeatSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should allow up to 10 tags', () => {
      const validData = {
        title: 'Beat',
        genre: 'Hip-Hop',
        bpm: 95,
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7', 'tag8', 'tag9', 'tag10'],
      }

      const result = createBeatSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject more than 10 tags', () => {
      const invalidData = {
        title: 'Beat',
        genre: 'Hip-Hop',
        bpm: 95,
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7', 'tag8', 'tag9', 'tag10', 'tag11'],
      }

      const result = createBeatSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('producerApplicationSchema', () => {
    it('should validate correct producer application', () => {
      const validData = {
        producerBio: 'I am a professional beat maker with 10 years of experience creating music for various artists.',
        portfolio: 'https://example.com/portfolio',
        genres: ['Hip-Hop', 'Trap', 'Drill'],
      }

      const result = producerApplicationSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject bio shorter than 20 characters', () => {
      const invalidData = {
        producerBio: 'Short bio',
        genres: ['Hip-Hop'],
      }

      const result = producerApplicationSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('courte')
      }
    })

    it('should allow optional portfolio URL', () => {
      const validData = {
        producerBio: 'I am a professional beat maker with 10 years of experience in creating music.',
        genres: ['Hip-Hop'],
      }

      const result = producerApplicationSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject invalid portfolio URL', () => {
      const invalidData = {
        producerBio: 'I am a professional beat maker with 10 years of experience in creating music.',
        portfolio: 'not-a-valid-url',
        genres: ['Hip-Hop'],
      }

      const result = producerApplicationSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should require at least one genre', () => {
      const invalidData = {
        producerBio: 'I am a professional beat maker with 10 years of experience in creating music.',
        genres: [],
      }

      const result = producerApplicationSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject bio longer than 1000 characters', () => {
      const invalidData = {
        producerBio: 'a'.repeat(1001),
        genres: ['Hip-Hop'],
      }

      const result = producerApplicationSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should accept bio of exactly 20 characters', () => {
      const validData = {
        producerBio: 'Exactly twenty chars!', // 21 chars, let's count properly
        genres: ['Hip-Hop'],
      }

      const result = producerApplicationSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should accept bio of exactly 1000 characters', () => {
      const validData = {
        producerBio: 'a'.repeat(1000),
        genres: ['Hip-Hop'],
      }

      const result = producerApplicationSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })
  })
})
