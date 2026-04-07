import { z } from 'zod'

// ─── Auth ───
export const registerSchema = z.object({
  name: z.string().min(2, 'Nom trop court').max(50, 'Nom trop long'),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caracteres').regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Le mot de passe doit contenir une majuscule, une minuscule et un chiffre'
  ),
  role: z.enum(['ARTIST', 'PRODUCER']),
})

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token invalide'),
  password: z.string().min(8, 'Minimum 8 caracteres').regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Le mot de passe doit contenir une majuscule, une minuscule et un chiffre'
  ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
})

// ─── Beat ───
export const createBeatSchema = z.object({
  title: z.string().min(1, 'Titre requis').max(100),
  description: z.string().max(500).optional(),
  genre: z.string().min(1, 'Genre requis'),
  mood: z.string().optional(),
  bpm: z.number().int().min(40).max(300),
  key: z.string().optional(),
  tags: z.array(z.string()).max(10).optional(),
})

// ─── Auction ───
export const createAuctionSchema = z.object({
  beatId: z.string().min(1, 'Beat requis'),
  startPrice: z.number().positive('Prix doit etre positif'),
  reservePrice: z.number().positive().optional(),
  buyNowPrice: z.number().positive().optional(),
  licenseType: z.enum(['BASIC', 'PREMIUM', 'EXCLUSIVE']),
  durationHours: z.number().int().min(1).max(168), // 1h a 7 jours
  bidIncrement: z.number().positive().default(5),
})

// ─── Bid ───
export const placeBidSchema = z.object({
  amount: z.number().positive('Montant doit etre positif'),
  licenseType: z.enum(['BASIC', 'PREMIUM', 'EXCLUSIVE']).default('BASIC'),
  isAutoBid: z.boolean().default(false),
  maxAutoBid: z.number().positive().optional(),
})

// ─── Producer Application ───
export const producerApplicationSchema = z.object({
  producerBio: z.string().min(20, 'Bio trop courte, minimum 20 caracteres').max(1000),
  portfolio: z.string().url('URL invalide').optional(),
  genres: z.array(z.string()).min(1, 'Selectionne au moins un genre'),
})
