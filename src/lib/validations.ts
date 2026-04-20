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

// ─── Auction (F14 FIX: validation complète avec contraintes croisées) ───
export const createAuctionSchema = z.object({
  beatId: z.string().min(1, 'Beat requis'),
  startPrice: z.number().positive('Prix doit etre positif').max(100000, 'Prix max 100 000€'),
  reservePrice: z.number().positive().max(100000).optional(),
  buyNowPrice: z.number().positive().max(100000).optional(),
  licenseType: z.enum(['BASIC', 'PREMIUM', 'EXCLUSIVE']),
  durationHours: z.number().int().min(1).max(168), // 1h a 7 jours
  bidIncrement: z.number().positive().min(1).max(1000).default(5),
}).refine(
  (data) => !data.reservePrice || data.reservePrice >= data.startPrice,
  { message: 'Le prix de réserve doit être >= au prix de départ', path: ['reservePrice'] }
).refine(
  (data) => !data.buyNowPrice || data.buyNowPrice > data.startPrice,
  { message: 'Le prix achat immédiat doit être > au prix de départ', path: ['buyNowPrice'] }
).refine(
  (data) => !data.buyNowPrice || !data.reservePrice || data.buyNowPrice >= data.reservePrice,
  { message: 'Le prix achat immédiat doit être >= au prix de réserve', path: ['buyNowPrice'] }
)

// ─── Bid ───
export const placeBidSchema = z.object({
  amount: z.number().positive('Montant doit etre positif'),
  licenseType: z.enum(['BASIC', 'PREMIUM', 'EXCLUSIVE']).default('BASIC'),
  isAutoBid: z.boolean().default(false),
  maxAutoBid: z.number().positive().optional(),
})

// ─── Playlist (F6 FIX) ───
export const updatePlaylistSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100, 'Nom trop long').optional(),
  description: z.string().max(500, 'Description trop longue').nullable().optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  coverImage: z.string().url('URL invalide').nullable().optional(),
})

// ─── Profile Update (F6 FIX) ───
export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Nom trop court').max(50, 'Nom trop long').optional(),
  displayName: z.string().max(50).nullable().optional(),
  bio: z.string().max(500, 'Bio trop longue').nullable().optional(),
  avatar: z.string().url().nullable().optional(),
  website: z.string().max(200).nullable().optional(),
  instagram: z.string().max(200).nullable().optional(),
  twitter: z.string().max(200).nullable().optional(),
  youtube: z.string().max(200).nullable().optional(),
  soundcloud: z.string().max(200).nullable().optional(),
  spotify: z.string().max(200).nullable().optional(),
  notifEmail: z.boolean().optional(),
  notifBid: z.boolean().optional(),
  notifMessage: z.boolean().optional(),
  producerBio: z.string().max(1000, 'Bio producteur trop longue').nullable().optional(),
  portfolio: z.string().max(200).nullable().optional(),
})

// ─── Producer Application ───
export const producerApplicationSchema = z.object({
  producerBio: z.string().min(20, 'Bio trop courte, minimum 20 caracteres').max(1000),
  portfolio: z
    .string()
    .transform((val) => {
      const trimmed = val.trim()
      if (trimmed === '') return undefined
      if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return `https://${trimmed}`
      }
      return trimmed
    })
    .pipe(z.string().url('URL invalide').optional()),
  genres: z.array(z.string()).min(1, 'Selectionne au moins un genre'),
})
