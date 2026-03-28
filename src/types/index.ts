// ─── 318 LEGAACY Marketplace - Types ───

export type UserRole = 'ARTIST' | 'PRODUCER' | 'ADMIN'
export type ProducerStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
export type BeatStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'SOLD' | 'ARCHIVED'
export type AuctionStatus = 'SCHEDULED' | 'ACTIVE' | 'ENDING_SOON' | 'ENDED' | 'COMPLETED' | 'CANCELLED'
export type LicenseType = 'BASIC' | 'PREMIUM' | 'EXCLUSIVE'
export type NotificationType = 'BID_PLACED' | 'OUTBID' | 'AUCTION_WON' | 'AUCTION_ENDING' | 'AUCTION_ENDED' | 'PAYMENT_RECEIVED' | 'PRODUCER_APPROVED' | 'PRODUCER_REJECTED' | 'NEW_FOLLOWER' | 'SYSTEM'

export interface User {
  id: string
  name: string
  displayName?: string
  email: string
  avatar?: string
  bio?: string
  role: UserRole
  producerStatus?: ProducerStatus
  rating: number
  totalSales: number
}

export interface Beat {
  id: string
  title: string
  description?: string
  audioUrl: string
  coverImage?: string
  genre: string
  mood?: string
  bpm: number
  key?: string
  tags: string[]
  plays: number
  status: BeatStatus
  producer: User
  auctions?: Auction[]
  _count?: { likes: number }
}

export interface Auction {
  id: string
  beatId: string
  beat: Beat
  startPrice: number
  currentBid: number
  reservePrice?: number
  buyNowPrice?: number
  bidIncrement: number
  licenseType: LicenseType
  startTime: string
  endTime: string
  status: AuctionStatus
  totalBids: number
  winnerId?: string
  bids?: Bid[]
}

export interface Bid {
  id: string
  amount: number
  licenseType: LicenseType
  finalAmount: number
  auctionId: string
  userId: string
  user: User
  createdAt: string
}

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  link?: string
  read: boolean
  createdAt: string
}

export interface LicenseInfo {
  id: LicenseType
  name: string
  color: string
  icon: string
  rights: string
  multiplier: number
}

export const LICENSES: LicenseInfo[] = [
  { id: 'BASIC', name: 'Basic', color: '#8a8a9a', icon: '♪', rights: 'MP3 - 5000 streams - Non-commercial', multiplier: 1 },
  { id: 'PREMIUM', name: 'Premium', color: '#e11d48', icon: '♫', rights: 'WAV + MP3 - 50K streams - Commercial', multiplier: 2.5 },
  { id: 'EXCLUSIVE', name: 'Exclusive', color: '#ff4757', icon: '♛', rights: 'WAV + Stems - Illimite - Droits complets', multiplier: 10 },
]

export const GENRES = ['Trap', 'Drill', 'Boom Bap', 'Afrobeat', 'R&B', 'Lo-Fi', 'Pop', 'Dancehall'] as const
export const MOODS = ['Sombre', 'Energique', 'Melancolique', 'Agressif', 'Chill', 'Epique'] as const
