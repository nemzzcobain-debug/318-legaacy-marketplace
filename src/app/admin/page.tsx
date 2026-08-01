'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Stats {
  totalUsers: number
  totalProducers: number
  pendingProducers: number
  totalBeats: number
  totalAuctions: number
  activeAuctions: number
  totalBids: number
  platformRevenue: number
  totalSalesVolume: number
  completedAuctionsCount: number
}

interface Producer {
  id: string
  name: string
  displayName: string | null
  email: string
  producerStatus: string | null
  producerBio: string | null
  portfolio: string | null
  producerApprovedAt: string | null
  stripeGraceSuspendedAt: string | null
  stripeAccountId: string | null
  totalSales: number
  rating: number
  createdAt: string
  _count: { beats: number }
}

interface AuctionItem {
  id: string
  startPrice: number
  currentBid: number
  licenseType: string
  status: string
  startTime: string
  endTime: string
  totalBids: number
  beat: {
    title: string
    genre: string
    coverImage: string | null
    producer: { name: string; displayName: string | null }
  }
  _count: { bids: number }
}

interface UserItem {
  id: string
  name: string
  displayName: string | null
  email: string
  role: string
  producerStatus: string | null
  totalSales: number
  totalPurchases: number
  createdAt: string
  _count: { beats: number; bids: number }
}

interface ReportItem {
  id: string
  type: string
  reason: string
  description: string | null
  status: string
  targetUserId: string | null
  targetAuctionId: string | null
  targetBeatId: string | null
  adminNote: string | null
  reviewedAt: string | null
  createdAt: string
  reporter: { id: string; name: string; displayName: string | null; avatar: string | null }
}

const VALID_ADMIN_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'ACTIVE',
  'SCHEDULED',
  'ENDING_SOON',
  'ENDED',
  'COMPLETED',
  'CANCELLED',
  'REVIEWED',
  'RESOLVED',
  'DISMISSED',
]

const BEAT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente de validation',
  ACTIVE: 'Approuvé et en ligne',
  REJECTED: 'Refusé',
  SOLD: 'Vendu',
  DRAFT: 'Brouillon',
}

const AUCTION_STATUS_LABELS: Record<string, string> = {
  PENDING_APPROVAL: 'En attente de validation du beat',
  SCHEDULED: 'Programmée',
  ACTIVE: 'En cours',
  ENDING_SOON: 'Se termine bientôt',
  ENDED: 'Terminée',
  COMPLETED: 'Payée',
  CANCELLED: 'Annulée',
}

const LICENSE_LABELS: Record<string, string> = {
  BASIC: 'Basique — MP3',
  PREMIUM: 'Premium — WAV',
  EXCLUSIVE: 'Exclusive — Stems',
}

function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Non proposé'
  return `${value.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Non renseignée'
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatDuration(duration: number | null | undefined) {
  if (!duration) return 'Non renseignée'
  const minutes = Math.floor(duration / 60)
  const seconds = duration % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatFileSize(size: number | null | undefined) {
  if (!size) return null
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} Ko`
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`
}

function parseBeatTags(tags: unknown): string[] {
  if (!tags || typeof tags !== 'string') return []
  try {
    const parsed = JSON.parse(tags)
    return Array.isArray(parsed) ? parsed.filter((tag) => typeof tag === 'string') : []
  } catch {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  }
}

function StatCard({
  label,
  value,
  color = 'purple',
  onClick,
}: {
  label: string
  value: string | number
  color?: string
  onClick?: () => void
}) {
  const colors: Record<string, string> = {
    purple: 'from-[#e11d48] to-[#9f1239]',
    orange: 'from-[#b91c1c] to-[#7f1d1d]',
    green: 'from-green-600 to-green-800',
    blue: 'from-[#e11d48]/80 to-[#881337]',
    red: 'from-[#e11d48] to-[#be123c]',
    yellow: 'from-[#dc2626] to-[#991b1b]',
  }

  return (
    <div
      onClick={onClick}
      className={`bg-gradient-to-br ${colors[color] || colors.purple} rounded-xl p-5 text-white shadow-lg ${onClick ? 'cursor-pointer hover:scale-105 hover:shadow-xl transition-all duration-200' : ''}`}
    >
      <p className="text-sm opacity-80 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {onClick && (
        <p className="text-[10px] mt-2 opacity-60 uppercase tracking-wider">Cliquer pour voir →</p>
      )}
    </div>
  )
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const validTabs = [
    'dashboard',
    'producers',
    'auctions',
    'users',
    'beats',
    'featured',
    'reports',
    'promos',
  ]
  const initialTab = searchParams.get('tab')
  const initialStatus = searchParams.get('status')
  const [activeTab, setActiveTab] = useState(
    initialTab && validTabs.includes(initialTab) ? initialTab : 'dashboard'
  )
  const [stats, setStats] = useState<Stats | null>(null)
  const [producers, setProducers] = useState<Producer[]>([])
  const [auctions, setAuctions] = useState<AuctionItem[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [reports, setReports] = useState<ReportItem[]>([])
  const [reportsPagination, setReportsPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [promos, setPromos] = useState<any[]>([])
  const [featuredBeats, setFeaturedBeats] = useState<any[]>([])
  const [allBeats, setAllBeats] = useState<any[]>([])
  const [beatsPagination, setBeatsPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [beatsFilter, setBeatsFilter] = useState('')
  const [beatStatusFilter, setBeatStatusFilter] = useState(
    initialTab === 'beats' && initialStatus && VALID_ADMIN_STATUSES.includes(initialStatus)
      ? initialStatus
      : ''
  )
  const [expandedBeatIds, setExpandedBeatIds] = useState<Set<string>>(new Set())
  const [reviewingBeatId, setReviewingBeatId] = useState<string | null>(null)
  const [playingBeatId, setPlayingBeatId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playingBeatIdRef = useRef<string | null>(null)
  const audioRequestTokenRef = useRef(0)
  const [audioError, setAudioError] = useState<{ beatId: string; message: string } | null>(null)
  const [beatSearch, setBeatSearch] = useState('')
  const [beatResults, setBeatResults] = useState<any[]>([])
  const [searchingBeats, setSearchingBeats] = useState(false)
  const [newPromo, setNewPromo] = useState({
    code: '',
    type: 'PERCENTAGE',
    value: '',
    minPrice: '',
    maxUses: '',
    expiresAt: '',
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState(
    initialStatus && VALID_ADMIN_STATUSES.includes(initialStatus) ? initialStatus : ''
  )
  const [previousTab, setPreviousTab] = useState<string | null>(null)

  const releaseAdminAudio = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio) return
    audio.onended = null
    audio.onerror = null
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }, [])

  // Lecture audio des beats
  const togglePlay = async (beatId: string, audioUrl: string) => {
    // Le ref change immédiatement : même plusieurs appuis très rapides ne
    // peuvent plus lancer plusieurs instances du même aperçu.
    if (playingBeatIdRef.current === beatId) {
      audioRequestTokenRef.current += 1
      const currentAudio = audioRef.current
      audioRef.current = null
      playingBeatIdRef.current = null
      releaseAdminAudio(currentAudio)
      setPlayingBeatId(null)
      return
    }

    // Arrêter le beat précédent avant d'en lancer un nouveau.
    const token = audioRequestTokenRef.current + 1
    audioRequestTokenRef.current = token
    releaseAdminAudio(audioRef.current)
    setAudioError(null)

    const audio = new Audio(audioUrl)
    audio.preload = 'metadata'
    audioRef.current = audio
    playingBeatIdRef.current = beatId
    setPlayingBeatId(beatId)

    const clearIfCurrent = () => {
      if (audioRequestTokenRef.current !== token || audioRef.current !== audio) return
      audioRef.current = null
      playingBeatIdRef.current = null
      setPlayingBeatId(null)
    }

    audio.onended = () => {
      clearIfCurrent()
    }
    audio.onerror = () => {
      if (audioRequestTokenRef.current === token && audioRef.current === audio) {
        clearIfCurrent()
        setAudioError({
          beatId,
          message: "Impossible de lire l'aperçu audio. Réessaie dans quelques secondes.",
        })
      }
    }

    try {
      await audio.play()

      // Une pause peut avoir été demandée pendant le chargement de play().
      if (audioRequestTokenRef.current !== token || audioRef.current !== audio) {
        releaseAdminAudio(audio)
      }
    } catch (error) {
      console.error('Erreur lecture aperçu admin:', error)
      if (audioRequestTokenRef.current === token && audioRef.current === audio) {
        releaseAdminAudio(audio)
        clearIfCurrent()
        setAudioError({
          beatId,
          message: "Impossible de lire l'aperçu audio. Réessaie dans quelques secondes.",
        })
      }
    }
  }

  useEffect(() => {
    return () => {
      audioRequestTokenRef.current += 1
      releaseAdminAudio(audioRef.current)
      audioRef.current = null
      playingBeatIdRef.current = null
    }
  }, [releaseAdminAudio])

  // Synchroniser l'URL avec l'onglet actif
  useEffect(() => {
    const params = new URLSearchParams()
    if (activeTab !== 'dashboard') params.set('tab', activeTab)
    const activeStatus = activeTab === 'beats' ? beatStatusFilter : filterStatus
    if (activeStatus) params.set('status', activeStatus)
    const query = params.toString()
    const url = query ? `/admin?${query}` : '/admin'
    window.history.replaceState(null, '', url)
  }, [activeTab, beatStatusFilter, filterStatus])

  // Navigation depuis les cartes stats avec historique
  const navigateToTab = (tab: string, filter?: string) => {
    setPreviousTab(activeTab)
    setActiveTab(tab)
    if (filter) {
      if (tab === 'beats') setBeatStatusFilter(filter)
      else setFilterStatus(filter)
    }
  }

  const goBack = () => {
    if (previousTab) {
      setActiveTab(previousTab)
      setPreviousTab(null)
      setFilterStatus('')
    }
  }

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats')
      if (res.ok) setStats(await res.json())
    } catch (e) {
      console.error(e)
    }
  }, [])

  const fetchProducers = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/producers?${params}`)
      if (res.ok) setProducers(await res.json())
    } catch (e) {
      console.error(e)
    }
  }, [filterStatus, search])

  const fetchAuctions = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      const res = await fetch(`/api/admin/auctions?${params}`)
      if (res.ok) setAuctions(await res.json())
    } catch (e) {
      console.error(e)
    }
  }, [filterStatus])

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/users?${params}`)
      if (res.ok) setUsers(await res.json())
    } catch (e) {
      console.error(e)
    }
  }, [search])

  const fetchReports = useCallback(
    async (page = 1) => {
      try {
        const params = new URLSearchParams()
        if (filterStatus) params.set('status', filterStatus)
        params.set('page', String(page))
        const res = await fetch(`/api/reports?${params}`)
        if (res.ok) {
          const data = await res.json()
          setReports(data.reports)
          setReportsPagination(data.pagination)
        }
      } catch (e) {
        console.error(e)
      }
    },
    [filterStatus]
  )

  const fetchPromos = useCallback(async () => {
    try {
      const res = await fetch('/api/promo')
      if (res.ok) setPromos(await res.json())
    } catch (e) {
      console.error(e)
    }
  }, [])

  const fetchAllBeats = useCallback(
    async (page = 1) => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: '20' })
        if (search) params.set('search', search)
        if (beatsFilter) params.set('genre', beatsFilter)
        if (beatStatusFilter) params.set('status', beatStatusFilter)
        const res = await fetch(`/api/admin/beats?${params}`)
        if (res.ok) {
          const data = await res.json()
          setAllBeats(data.beats || [])
          setBeatsPagination({
            page: data.pagination.page,
            total: data.pagination.total,
            totalPages: data.pagination.totalPages,
          })
        }
      } catch (e) {
        console.error(e)
      }
    },
    [search, beatsFilter, beatStatusFilter]
  )

  const reviewBeat = async (beatId: string, action: 'APPROVE' | 'REJECT') => {
    let reason = ''
    let rejectionType: 'CHANGES_REQUESTED' | 'FINAL' | null = null
    if (action === 'REJECT') {
      rejectionType = window.confirm(
        'Le beatmaker peut-il corriger ce beat ?\n\nOK = Modifications demandées\nAnnuler = Refus définitif'
      )
        ? 'CHANGES_REQUESTED'
        : 'FINAL'
      reason = window.prompt('Indique le motif du refus pour le beatmaker :')?.trim() || ''
      if (!reason) return
    }

    const submitReview = async (overrideStripeGrace = false) => {
      const res = await fetch('/api/admin/beats', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beatId,
          action,
          reason,
          rejectionType,
          overrideStripeGrace,
        }),
      })
      return { res, data: await res.json() }
    }

    setReviewingBeatId(beatId)
    try {
      let { res, data } = await submitReview()

      if (!res.ok && data.code === 'PRODUCER_STRIPE_SUSPENDED' && data.canOverrideStripeGrace) {
        const producerName = data.producerName || 'ce beatmaker'
        const confirmed = window.confirm(
          `${producerName} est bloqué car son délai Stripe Connect est expiré.\n\n` +
            `Veux-tu lui accorder 7 jours supplémentaires et approuver ce beat ?\n\n` +
            `Stripe restera obligatoire à la fin de ce nouveau délai.`
        )
        if (!confirmed) return
        const overrideResult = await submitReview(true)
        res = overrideResult.res
        data = overrideResult.data
      }

      if (!res.ok) {
        window.alert(data.error || 'Impossible de traiter ce beat')
        return
      }
      if (data.stripeGraceExtended) {
        window.alert(
          'Beat approuvé. Le beatmaker dispose maintenant de 7 jours supplémentaires pour terminer Stripe Connect.'
        )
      }
      await fetchAllBeats(beatsPagination.page)
      fetchStats()
    } catch {
      window.alert('Erreur de connexion')
    } finally {
      setReviewingBeatId(null)
    }
  }

  const fetchFeatured = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/featured')
      if (res.ok) {
        const data = await res.json()
        setFeaturedBeats(data.featuredBeats || [])
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const searchBeats = async () => {
    if (!beatSearch.trim()) return
    setSearchingBeats(true)
    try {
      const res = await fetch(`/api/beats?search=${encodeURIComponent(beatSearch)}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        setBeatResults(data.beats || data || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSearchingBeats(false)
    }
  }

  const toggleFeatured = async (beatId: string, isCurrentlyFeatured: boolean) => {
    try {
      const res = await fetch('/api/admin/featured', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beatId,
          action: isCurrentlyFeatured ? 'remove' : 'add',
        }),
      })
      if (res.ok) {
        fetchFeatured()
        // Update search results too
        setBeatResults((prev) =>
          prev.map((b) => (b.id === beatId ? { ...b, isFeatured: !isCurrentlyFeatured } : b))
        )
        // Update beats list too
        setAllBeats((prev) =>
          prev.map((b) => (b.id === beatId ? { ...b, isFeatured: !isCurrentlyFeatured } : b))
        )
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') router.push('/')
      else {
        setLoading(false)
        fetchStats()
      }
    }
  }, [status, session, router, fetchStats])

  useEffect(() => {
    if (!loading) {
      if (activeTab === 'producers') fetchProducers()
      if (activeTab === 'auctions') fetchAuctions()
      if (activeTab === 'users') fetchUsers()
      if (activeTab === 'reports') fetchReports()
      if (activeTab === 'promos') fetchPromos()
      if (activeTab === 'beats') fetchAllBeats()
      if (activeTab === 'featured') fetchFeatured()
    }
  }, [
    activeTab,
    loading,
    fetchProducers,
    fetchAuctions,
    fetchUsers,
    fetchReports,
    fetchPromos,
    fetchAllBeats,
    fetchFeatured,
  ])

  const updateProducerStatus = async (
    producerId: string,
    newStatus: string,
    options?: { isStripeGraceExtension?: boolean; producerName?: string }
  ) => {
    if (options?.isStripeGraceExtension) {
      const confirmed = window.confirm(
        `Accorder 7 jours supplémentaires à ${options.producerName || 'ce beatmaker'} pour terminer Stripe Connect ?`
      )
      if (!confirmed) return
    }

    try {
      const res = await fetch('/api/admin/producers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producerId, status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) {
        window.alert(data.error || 'Impossible de modifier ce producteur')
        return
      }
      if (options?.isStripeGraceExtension) {
        window.alert('Le compte est réactivé pour 7 jours supplémentaires.')
      }
      fetchProducers()
      fetchStats()
    } catch (e) {
      console.error(e)
      window.alert('Erreur de connexion')
    }
  }

  const updateAuctionStatus = async (auctionId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/auctions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auctionId, status: newStatus }),
      })
      if (res.ok) {
        fetchAuctions()
        fetchStats()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const updateReportStatus = async (reportId: string, newStatus: string, adminNote?: string) => {
    try {
      const res = await fetch('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, status: newStatus, adminNote }),
      })
      if (res.ok) fetchReports(reportsPagination.page)
    } catch (e) {
      console.error(e)
    }
  }

  const createPromo = async () => {
    if (!newPromo.code || !newPromo.value) return
    try {
      const res = await fetch('/api/promo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPromo),
      })
      if (res.ok) {
        fetchPromos()
        setNewPromo({
          code: '',
          type: 'PERCENTAGE',
          value: '',
          minPrice: '',
          maxUses: '',
          expiresAt: '',
        })
      }
    } catch (e) {
      console.error(e)
    }
  }

  const updatePromoStatus = async (promoId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/promo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoId, status: newStatus }),
      })
      if (res.ok) fetchPromos()
    } catch (e) {
      console.error(e)
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white text-xl">Chargement...</div>
      </div>
    )
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'producers', label: 'Producteurs' },
    { id: 'auctions', label: 'Encheres' },
    { id: 'users', label: 'Utilisateurs' },
    { id: 'beats', label: 'Beats' },
    { id: 'featured', label: 'En vedette' },
    { id: 'reports', label: 'Signalements' },
    { id: 'promos', label: 'Codes Promo' },
  ]

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-500',
    APPROVED: 'bg-green-500',
    REJECTED: 'bg-red-500',
    SUSPENDED: 'bg-gray-500',
    ACTIVE: 'bg-green-500',
    SCHEDULED: 'bg-blue-500',
    ENDED: 'bg-gray-500',
    COMPLETED: 'bg-purple-500',
    CANCELLED: 'bg-red-500',
    ENDING_SOON: 'bg-orange-500',
    REVIEWED: 'bg-blue-500',
    RESOLVED: 'bg-green-500',
    DISMISSED: 'bg-gray-500',
  }

  const reportReasonLabels: Record<string, string> = {
    SPAM: 'Spam',
    INAPPROPRIATE: 'Contenu inapproprie',
    FRAUD: 'Fraude',
    COPYRIGHT: "Droits d'auteur",
    OTHER: 'Autre',
  }

  const reportTypeLabels: Record<string, string> = {
    BEAT: 'Beat',
    AUCTION: 'Enchere',
    USER: 'Utilisateur',
    MESSAGE: 'Message',
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="bg-[#111] border-b border-[#1e1e2e] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#e11d48] to-[#ff0033] bg-clip-text text-transparent">
              318 LEGAACY Admin
            </h1>
            <p className="text-gray-400 text-sm">Panneau d&apos;administration</p>
          </div>
          <a href="/" className="text-gray-400 hover:text-white transition text-sm">
            ← Retour au site
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-[#0d0d0d] border-b border-[#1e1e2e]">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setSearch('')
                setFilterStatus('')
                setPreviousTab(null)
              }}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-[#e11d48] border-b-2 border-[#e11d48]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
              {tab.id === 'producers' && stats && stats.pendingProducers > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {stats.pendingProducers}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Back button */}
        {previousTab && activeTab !== 'dashboard' && (
          <button
            onClick={goBack}
            className="mb-4 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/10"
          >
            <span>←</span>
            <span>Retour au tableau de bord</span>
          </button>
        )}

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && stats && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              <StatCard
                label="Utilisateurs"
                value={stats.totalUsers}
                color="blue"
                onClick={() => navigateToTab('users')}
              />
              <StatCard
                label="Producteurs"
                value={stats.totalProducers}
                color="purple"
                onClick={() => navigateToTab('producers')}
              />
              <StatCard
                label="En attente"
                value={stats.pendingProducers}
                color="yellow"
                onClick={() => navigateToTab('producers', 'PENDING')}
              />
              <StatCard
                label="Encheres actives"
                value={stats.activeAuctions}
                color="green"
                onClick={() => navigateToTab('auctions', 'ACTIVE')}
              />
              <StatCard
                label="Total enchères"
                value={stats.totalAuctions}
                color="orange"
                onClick={() => navigateToTab('auctions')}
              />
              <StatCard
                label="Beats"
                value={stats.totalBeats}
                color="blue"
                onClick={() => navigateToTab('beats')}
              />
              <StatCard
                label="Total bids"
                value={stats.totalBids}
                color="purple"
                onClick={() => navigateToTab('auctions')}
              />
              <StatCard
                label="Ventes completees"
                value={stats.completedAuctionsCount}
                color="green"
                onClick={() => navigateToTab('auctions', 'COMPLETED')}
              />
              <StatCard
                label="Revenue plateforme"
                value={`${stats.platformRevenue.toFixed(2)} EUR`}
                color="orange"
              />
              <StatCard
                label="Volume total"
                value={`${stats.totalSalesVolume.toFixed(2)} EUR`}
                color="red"
              />
            </div>

            {stats.pendingProducers > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                <p className="text-yellow-400 font-medium">
                  {stats.pendingProducers} producteur(s) en attente de validation
                </p>
                <button
                  onClick={() => {
                    setActiveTab('producers')
                    setFilterStatus('PENDING')
                  }}
                  className="mt-2 text-sm text-yellow-300 hover:text-yellow-100 underline"
                >
                  Voir les demandes →
                </button>
              </div>
            )}
          </div>
        )}

        {/* PRODUCERS TAB */}
        {activeTab === 'producers' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-6">
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-[#e11d48] focus:outline-none"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-4 py-2 text-sm text-white focus:border-[#e11d48] focus:outline-none"
              >
                <option value="">Tous les statuts</option>
                <option value="PENDING">En attente</option>
                <option value="APPROVED">Approuve</option>
                <option value="REJECTED">Refuse</option>
                <option value="SUSPENDED">Suspendu</option>
              </select>
            </div>

            <div className="space-y-3">
              {producers.map((p) => (
                <div key={p.id} className="bg-[#13131a] border border-[#1e1e2e] rounded-lg p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1 min-w-[250px]">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/producer/${p.id}?from=admin`}
                          className="font-bold text-lg text-white underline decoration-transparent underline-offset-4 transition hover:text-[#fb7185] hover:decoration-[#e11d48] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e11d48] focus-visible:ring-offset-2 focus-visible:ring-offset-[#13131a] rounded"
                          aria-label={`Voir le profil de ${p.displayName || p.name}`}
                        >
                          {p.displayName || p.name}
                        </Link>
                        <span
                          className={`${statusColors[p.producerStatus || 'PENDING']} text-white text-xs px-2 py-0.5 rounded-full`}
                        >
                          {p.producerStatus || 'PENDING'}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm">{p.email}</p>
                      {p.producerStatus === 'SUSPENDED' && p.stripeGraceSuspendedAt ? (
                        <p className="mt-1 inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                          Bloqué par Stripe — délai expiré
                        </p>
                      ) : p.stripeAccountId ? (
                        <p className="mt-1 text-[11px] font-semibold text-blue-300">
                          Inscription Stripe Connect commencée
                        </p>
                      ) : p.producerStatus === 'APPROVED' ? (
                        <p className="mt-1 text-[11px] font-semibold text-amber-300">
                          Stripe Connect à terminer
                        </p>
                      ) : null}
                      <p className="text-gray-500 text-xs mt-1">
                        {p._count.beats} beats • Inscrit le{' '}
                        {new Date(p.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {p.producerStatus !== 'APPROVED' && (
                        <button
                          onClick={() =>
                            updateProducerStatus(p.id, 'APPROVED', {
                              isStripeGraceExtension:
                                p.producerStatus === 'SUSPENDED' &&
                                Boolean(p.stripeGraceSuspendedAt),
                              producerName: p.displayName || p.name,
                            })
                          }
                          className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg transition"
                        >
                          {p.producerStatus === 'SUSPENDED' && p.stripeGraceSuspendedAt
                            ? 'Accorder 7 jours'
                            : 'Approuver'}
                        </button>
                      )}
                      {p.producerStatus !== 'REJECTED' && p.producerStatus !== 'SUSPENDED' && (
                        <button
                          onClick={() => updateProducerStatus(p.id, 'REJECTED')}
                          className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition"
                        >
                          Refuser
                        </button>
                      )}
                      {p.producerStatus === 'APPROVED' && (
                        <button
                          onClick={() => updateProducerStatus(p.id, 'SUSPENDED')}
                          className="bg-gray-600 hover:bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg transition"
                        >
                          Suspendre
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Détails candidature */}
                  {(p.producerBio || p.portfolio) && (
                    <div className="mt-3 pt-3 border-t border-[#1e1e2e] space-y-2">
                      {p.producerBio && (
                        <div>
                          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
                            Bio
                          </span>
                          <p className="text-gray-300 text-sm mt-0.5">{p.producerBio}</p>
                        </div>
                      )}
                      {p.portfolio && (
                        <div>
                          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
                            Portfolio
                          </span>
                          <a
                            href={p.portfolio}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[#e11d48] hover:text-[#ff2d5a] text-sm mt-0.5 underline truncate"
                          >
                            {p.portfolio}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {producers.length === 0 && (
                <p className="text-gray-500 text-center py-8">Aucun producteur trouve</p>
              )}
            </div>
          </div>
        )}

        {/* AUCTIONS TAB */}
        {activeTab === 'auctions' && (
          <div>
            <div className="flex gap-3 mb-6">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-4 py-2 text-sm text-white focus:border-[#e11d48] focus:outline-none"
              >
                <option value="">Tous les statuts</option>
                <option value="ACTIVE">Active</option>
                <option value="SCHEDULED">Planifiee</option>
                <option value="ENDED">Terminee</option>
                <option value="COMPLETED">Completee</option>
                <option value="CANCELLED">Annulee</option>
              </select>
            </div>

            <div className="space-y-3">
              {auctions.map((a) => (
                <div
                  key={a.id}
                  className="bg-[#13131a] border border-[#1e1e2e] rounded-lg p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-semibold">{a.beat.title}</p>
                    <p className="text-gray-400 text-sm">
                      Par {a.beat.producer.displayName || a.beat.producer.name} • {a.beat.genre}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {a.licenseType} • {a._count.bids} enchères • {a.currentBid.toFixed(2)} EUR
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`${statusColors[a.status]} text-white text-xs px-2 py-1 rounded-full`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {a.status === 'ACTIVE' && (
                      <button
                        onClick={() => updateAuctionStatus(a.id, 'CANCELLED')}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition"
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {auctions.length === 0 && (
                <p className="text-gray-500 text-center py-8">Aucune enchère trouvee</p>
              )}
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div>
            <div className="flex gap-3 mb-6">
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-[#e11d48] focus:outline-none"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-[#1e1e2e]">
                    <th className="text-left py-3 px-4">Nom</th>
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-left py-3 px-4">Role</th>
                    <th className="text-left py-3 px-4">Beats</th>
                    <th className="text-left py-3 px-4">Bids</th>
                    <th className="text-left py-3 px-4">Inscrit le</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-[#1e1e2e]/50 hover:bg-white/[0.02]">
                      <td className="py-3 px-4">{u.displayName || u.name}</td>
                      <td className="py-3 px-4 text-gray-400">{u.email}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${u.role === 'ADMIN' ? 'bg-red-500/20 text-red-400' : u.role === 'PRODUCER' ? 'bg-[#e11d48]/20 text-[#e11d48]' : 'bg-blue-500/20 text-blue-400'}`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400">{u._count.beats}</td>
                      <td className="py-3 px-4 text-gray-400">{u._count.bids}</td>
                      <td className="py-3 px-4 text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <p className="text-gray-500 text-center py-8">Aucun utilisateur trouve</p>
              )}
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'reports' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-6">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-4 py-2 text-sm text-white focus:border-[#e11d48] focus:outline-none"
              >
                <option value="">Tous les statuts</option>
                <option value="PENDING">En attente</option>
                <option value="REVIEWED">Examine</option>
                <option value="RESOLVED">Resolu</option>
                <option value="DISMISSED">Rejete</option>
              </select>
              <span className="text-gray-400 text-sm self-center">
                {reportsPagination.total} signalement(s)
              </span>
            </div>

            <div className="space-y-3">
              {reports.map((r) => (
                <div key={r.id} className="bg-[#13131a] border border-[#1e1e2e] rounded-lg p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1 min-w-[250px]">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full text-white ${statusColors[r.status] || 'bg-gray-500'}`}
                        >
                          {r.status}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-[#e11d48]/20 text-[#e11d48]">
                          {reportTypeLabels[r.type] || r.type}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-[#e11d48]/20 text-[#e11d48]">
                          {reportReasonLabels[r.reason] || r.reason}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 mb-1">
                        <span className="text-gray-500">Par:</span>{' '}
                        {r.reporter.displayName || r.reporter.name}
                      </p>
                      {r.description && (
                        <p className="text-sm text-gray-400 italic">&quot;{r.description}&quot;</p>
                      )}
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        {r.targetUserId && <span>User: {r.targetUserId.slice(0, 8)}...</span>}
                        {r.targetAuctionId && (
                          <span>Enchere: {r.targetAuctionId.slice(0, 8)}...</span>
                        )}
                        {r.targetBeatId && <span>Beat: {r.targetBeatId.slice(0, 8)}...</span>}
                        <span>{new Date(r.createdAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                      {r.adminNote && (
                        <p className="text-xs text-blue-400 mt-2 bg-blue-500/10 px-2 py-1 rounded">
                          Note admin: {r.adminNote}
                        </p>
                      )}
                    </div>
                    {r.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateReportStatus(r.id, 'REVIEWED')}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition"
                        >
                          Examiner
                        </button>
                        <button
                          onClick={() => updateReportStatus(r.id, 'RESOLVED')}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition"
                        >
                          Resoudre
                        </button>
                        <button
                          onClick={() => updateReportStatus(r.id, 'DISMISSED')}
                          className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded-lg transition"
                        >
                          Rejeter
                        </button>
                      </div>
                    )}
                    {r.status === 'REVIEWED' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateReportStatus(r.id, 'RESOLVED')}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition"
                        >
                          Resoudre
                        </button>
                        <button
                          onClick={() => updateReportStatus(r.id, 'DISMISSED')}
                          className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded-lg transition"
                        >
                          Rejeter
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {reports.length === 0 && (
                <p className="text-gray-500 text-center py-8">Aucun signalement</p>
              )}
            </div>

            {/* Pagination */}
            {reportsPagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                {Array.from({ length: reportsPagination.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => fetchReports(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition ${
                      p === reportsPagination.page
                        ? 'bg-[#e11d48] text-white'
                        : 'bg-[#1a1a2e] text-gray-400 hover:bg-[#25253d]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BEATS TAB */}
        {activeTab === 'beats' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-6">
              <input
                type="text"
                placeholder="Rechercher un beat..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchAllBeats(1)}
                className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-[#e11d48] focus:outline-none"
              />
              <select
                value={beatsFilter}
                onChange={(e) => {
                  setBeatsFilter(e.target.value)
                  fetchAllBeats(1)
                }}
                className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="">Tous les genres</option>
                {[
                  'Hip-Hop',
                  'Trap',
                  'R&B',
                  'Pop',
                  'Drill',
                  'Afrobeat',
                  'Reggaeton',
                  'Cloud Rap',
                  'Boom Bap',
                  'Lo-Fi',
                ].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <select
                value={beatStatusFilter}
                onChange={(e) => setBeatStatusFilter(e.target.value)}
                className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="">Tous les statuts</option>
                <option value="PENDING">À valider</option>
                <option value="ACTIVE">En ligne</option>
                <option value="REJECTED">Refusés</option>
                <option value="SOLD">Vendus</option>
              </select>
              <button
                onClick={() => fetchAllBeats(1)}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-lg transition"
              >
                Filtrer
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">{beatsPagination.total} beat(s) au total</p>

            <div className="space-y-3">
              {allBeats.map((beat: any) => {
                const isPlaying = playingBeatId === beat.id
                const isExpanded = beat.status === 'PENDING' || expandedBeatIds.has(beat.id)
                const tags = parseBeatTags(beat.tags)
                return (
                  <div
                    key={beat.id}
                    className={`p-4 bg-gray-900 border rounded-lg transition ${isPlaying ? 'border-[#e11d48]/50 bg-[#e11d48]/5' : 'border-[#1e1e2e] hover:border-[#e11d48]/30'}`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 items-center gap-4">
                        {/* Cover + bouton play */}
                        <button
                          onClick={() => beat.audioUrl && togglePlay(beat.id, beat.audioUrl)}
                          className="relative w-14 h-14 rounded-lg overflow-hidden group flex-shrink-0"
                          disabled={!beat.audioUrl}
                          aria-label={
                            isPlaying ? `Mettre ${beat.title} en pause` : `Écouter ${beat.title}`
                          }
                        >
                          {beat.coverImage ? (
                            <img
                              src={beat.coverImage}
                              alt={beat.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-400">
                              &#9835;
                            </div>
                          )}
                          {beat.audioUrl && (
                            <div
                              className={`absolute inset-0 flex items-center justify-center bg-black/40 ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                            >
                              <span className="text-white text-xl">{isPlaying ? '⏸' : '▶'}</span>
                            </div>
                          )}
                          {isPlaying && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#e11d48] animate-pulse" />
                          )}
                        </button>

                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white">{beat.title}</p>
                          <p className="text-xs text-gray-400">
                            {beat.producer?.displayName || beat.producer?.name || 'Inconnu'}{' '}
                            &middot; {beat.genre || 'N/A'} &middot; {beat.bpm || '?'} BPM &middot;{' '}
                            {beat.key || '?'}
                          </p>
                          {!beat.audioUrl && (
                            <p className="text-xs text-red-400 mt-0.5">Pas de fichier audio</p>
                          )}
                          {audioError && audioError.beatId === beat.id && (
                            <p className="text-xs text-red-400 mt-1" role="alert">
                              {audioError.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <span
                          className={`rounded px-2 py-1 text-xs font-bold ${
                            beat.saleMode === 'LEASING'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-[#e11d48]/15 text-[#fb7185]'
                          }`}
                        >
                          {beat.saleMode === 'LEASING'
                            ? 'Leasing non exclusif'
                            : 'Enchère exclusive'}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs font-bold rounded ${
                            beat.status === 'ACTIVE'
                              ? 'bg-green-500/20 text-green-400'
                              : beat.status === 'PENDING'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : beat.status === 'SOLD'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {BEAT_STATUS_LABELS[beat.status] || beat.status}
                        </span>
                        {beat.status !== 'PENDING' && (
                          <button
                            onClick={() =>
                              setExpandedBeatIds((current) => {
                                const next = new Set(current)
                                if (next.has(beat.id)) next.delete(beat.id)
                                else next.add(beat.id)
                                return next
                              })
                            }
                            className="rounded-lg border border-[#343447] px-3 py-1.5 text-xs font-bold text-gray-200 hover:border-[#e11d48]/60 hover:text-white"
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? 'Masquer les détails' : 'Voir tous les détails'}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFeatured(beat.id, beat.isFeatured)
                          }}
                          className={`px-3 py-1 text-xs font-bold rounded transition ${
                            beat.isFeatured
                              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40'
                              : 'bg-[#e11d48]/20 text-[#e11d48] hover:bg-[#e11d48]/40'
                          }`}
                        >
                          {beat.isFeatured ? '★ Retirer vedette' : '☆ Mettre en vedette'}
                        </button>
                        <span className="text-xs text-gray-500">{beat._count?.likes || 0} ♥</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-5 space-y-4 border-t border-[#29293a] pt-5">
                        {beat.status === 'PENDING' && (
                          <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/5 px-4 py-3">
                            <p className="text-sm font-bold text-yellow-300">
                              Fiche de contrôle avant publication
                            </p>
                            <p className="mt-1 text-xs text-yellow-100/70">
                              Vérifie les fichiers, les licences, les prix et l’enchère avant
                              d’approuver ce beat.
                            </p>
                          </div>
                        )}

                        <div
                          className={`rounded-xl border px-4 py-3 ${
                            beat.saleMode === 'LEASING'
                              ? 'border-emerald-500/25 bg-emerald-500/5'
                              : 'border-[#e11d48]/25 bg-[#e11d48]/5'
                          }`}
                        >
                          <p className="text-sm font-bold text-white">
                            {beat.saleMode === 'LEASING'
                              ? 'Mode : leasing non exclusif'
                              : 'Mode : enchère exclusive'}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {beat.saleMode === 'LEASING'
                              ? 'Le MP3 et/ou le WAV pourront être vendus plusieurs fois. Aucune enchère ni licence exclusive.'
                              : 'Une seule vente aux enchères. Les stems doivent être fournis au gagnant.'}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                          <section className="rounded-xl border border-[#29293a] bg-[#101018] p-4">
                            <h3 className="mb-3 text-sm font-bold text-white">Fichiers fournis</h3>
                            <div className="space-y-2 text-sm">
                              {[
                                ['Aperçu audio', beat.files?.hasPreview],
                                ['MP3 complet', beat.files?.hasMp3],
                                ['WAV complet', beat.files?.hasWav],
                                [
                                  beat.files?.stemsFormat === 'ZIP'
                                    ? 'Stems — fichier ZIP'
                                    : beat.files?.stemsCount
                                      ? `Stems — ${beat.files.stemsCount} fichier(s)`
                                      : 'Stems',
                                  beat.files?.hasStems,
                                ],
                              ].map(([label, available]) => (
                                <div
                                  key={String(label)}
                                  className="flex items-center justify-between gap-3"
                                >
                                  <span className="text-gray-300">{String(label)}</span>
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                      available
                                        ? 'bg-green-500/15 text-green-400'
                                        : 'bg-gray-500/15 text-gray-500'
                                    }`}
                                  >
                                    {available ? 'Fourni' : 'Non fourni'}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {beat.files?.stems?.length > 0 && (
                              <details className="mt-3 rounded-lg bg-[#181822] p-3">
                                <summary className="cursor-pointer text-xs font-bold text-gray-200">
                                  Voir la liste des stems ({beat.files.stems.length})
                                </summary>
                                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-gray-400">
                                  {beat.files.stems.map(
                                    (
                                      stem: { name: string; size: number | null },
                                      index: number
                                    ) => (
                                      <li
                                        key={`${stem.name}-${index}`}
                                        className="flex justify-between gap-3"
                                      >
                                        <span className="truncate">{stem.name}</span>
                                        {formatFileSize(stem.size) && (
                                          <span className="shrink-0">
                                            {formatFileSize(stem.size)}
                                          </span>
                                        )}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </details>
                            )}

                            <button
                              onClick={() => beat.audioUrl && togglePlay(beat.id, beat.audioUrl)}
                              disabled={!beat.audioUrl}
                              className="mt-4 w-full rounded-lg bg-[#e11d48] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#be123c] disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
                            >
                              {isPlaying ? '⏸ Mettre en pause' : '▶ Écouter l’aperçu'}
                            </button>
                          </section>

                          <section className="rounded-xl border border-[#29293a] bg-[#101018] p-4">
                            <h3 className="mb-3 text-sm font-bold text-white">
                              {beat.saleMode === 'LEASING'
                                ? 'Prix des licences leasing'
                                : 'Prix des licences directes'}
                            </h3>
                            <div className="space-y-3">
                              {[
                                ['Licence MP3', beat.priceMp3, beat.files?.hasMp3],
                                ['Licence WAV', beat.priceWav, beat.files?.hasWav],
                                ...(beat.saleMode === 'LEASING'
                                  ? []
                                  : [['Licence Stems', beat.priceStems, beat.files?.hasStems]]),
                              ].map(([label, price, fileAvailable]) => (
                                <div
                                  key={String(label)}
                                  className="rounded-lg bg-[#181822] px-3 py-2.5"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-xs text-gray-400">{String(label)}</span>
                                    <span
                                      className={`text-sm font-bold ${
                                        price !== null && price !== undefined
                                          ? 'text-white'
                                          : 'text-gray-500'
                                      }`}
                                    >
                                      {formatPrice(price as number | null)}
                                    </span>
                                  </div>
                                  {!fileAvailable && price !== null && price !== undefined && (
                                    <p className="mt-1 text-xs text-red-400">
                                      Attention : prix renseigné sans fichier correspondant.
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </section>

                          <section className="rounded-xl border border-[#29293a] bg-[#101018] p-4">
                            <h3 className="mb-3 text-sm font-bold text-white">
                              Informations du beat
                            </h3>
                            <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                              <div>
                                <dt className="text-xs text-gray-500">Genre</dt>
                                <dd className="text-gray-200">{beat.genre || 'Non renseigné'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-gray-500">Ambiance</dt>
                                <dd className="text-gray-200">{beat.mood || 'Non renseignée'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-gray-500">BPM</dt>
                                <dd className="text-gray-200">{beat.bpm || 'Non renseigné'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-gray-500">Tonalité</dt>
                                <dd className="text-gray-200">{beat.key || 'Non renseignée'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-gray-500">Durée</dt>
                                <dd className="text-gray-200">{formatDuration(beat.duration)}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-gray-500">Envoyé le</dt>
                                <dd className="text-gray-200">{formatDate(beat.createdAt)}</dd>
                              </div>
                            </dl>
                            {beat.description && (
                              <div className="mt-4">
                                <p className="text-xs text-gray-500">Description</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-300">
                                  {beat.description}
                                </p>
                              </div>
                            )}
                            {tags.length > 0 && (
                              <div className="mt-4 flex flex-wrap gap-1.5">
                                {tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded-full bg-[#252536] px-2.5 py-1 text-xs text-gray-300"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {beat.producer?.id && (
                              <Link
                                href={`/producer/${beat.producer.id}`}
                                className="mt-4 inline-flex text-xs font-bold text-[#fb7185] hover:text-[#fda4af]"
                              >
                                Voir le profil du beatmaker →
                              </Link>
                            )}
                          </section>
                        </div>

                        <section className="rounded-xl border border-[#29293a] bg-[#101018] p-4">
                          <h3 className="mb-3 text-sm font-bold text-white">
                            {beat.saleMode === 'LEASING'
                              ? 'Vente en leasing'
                              : 'Mise aux enchères exclusive'}
                          </h3>
                          {beat.saleMode === 'LEASING' ? (
                            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-300">
                              Aucune enchère. Ce beat sera vendu à prix fixe avec des licences non
                              exclusives.
                            </div>
                          ) : beat.auctions?.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                              {beat.auctions.map((auction: any) => (
                                <div
                                  key={auction.id}
                                  className="rounded-lg border border-[#29293a] bg-[#181822] p-3"
                                >
                                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-sm font-bold text-white">
                                      {LICENSE_LABELS[auction.licenseType] || auction.licenseType}
                                    </span>
                                    <span className="rounded-full bg-[#e11d48]/10 px-2.5 py-1 text-xs font-bold text-[#fb7185]">
                                      {AUCTION_STATUS_LABELS[auction.status] || auction.status}
                                    </span>
                                  </div>
                                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                                    <div>
                                      <dt className="text-xs text-gray-500">Prix de départ</dt>
                                      <dd className="font-bold text-white">
                                        {formatPrice(auction.startPrice)}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs text-gray-500">Achat immédiat</dt>
                                      <dd className="text-gray-200">
                                        {formatPrice(auction.buyNowPrice)}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs text-gray-500">Prix de réserve</dt>
                                      <dd className="text-gray-200">
                                        {formatPrice(auction.reservePrice)}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs text-gray-500">Incrément</dt>
                                      <dd className="text-gray-200">
                                        {formatPrice(auction.bidIncrement)}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs text-gray-500">Début</dt>
                                      <dd className="text-gray-200">
                                        {formatDate(auction.startTime)}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs text-gray-500">Fin prévue</dt>
                                      <dd className="text-gray-200">
                                        {formatDate(auction.endTime)}
                                      </dd>
                                    </div>
                                  </dl>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">
                              Ce beat n’a pas été proposé aux enchères.
                            </p>
                          )}
                        </section>

                        {beat.status === 'PENDING' && (
                          <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-xl border border-[#343447] bg-[#111119]/95 p-3 shadow-2xl backdrop-blur sm:flex-row sm:justify-end">
                            <button
                              disabled={reviewingBeatId === beat.id}
                              onClick={() => reviewBeat(beat.id, 'REJECT')}
                              className="rounded-lg bg-red-500/15 px-5 py-3 text-sm font-bold text-red-400 hover:bg-red-500/25 disabled:opacity-50"
                            >
                              Refuser / demander des modifications
                            </button>
                            <button
                              disabled={reviewingBeatId === beat.id}
                              onClick={() => reviewBeat(beat.id, 'APPROVE')}
                              className="rounded-lg bg-green-500 px-6 py-3 text-sm font-bold text-black hover:bg-green-400 disabled:opacity-50"
                            >
                              {reviewingBeatId === beat.id ? 'Traitement…' : 'Approuver et publier'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {beatsPagination.totalPages > 1 && (
              <div className="flex gap-2 mt-6 justify-center">
                {Array.from({ length: beatsPagination.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => fetchAllBeats(p)}
                    className={`px-3 py-1 rounded text-sm ${
                      p === beatsPagination.page
                        ? 'bg-orange-600 text-white'
                        : 'bg-[#1a1a2e] text-gray-400 hover:bg-[#25253d]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FEATURED TAB */}
        {activeTab === 'featured' && (
          <div>
            {/* Recherche de beats */}
            <div className="bg-[#13131a] border border-[#1e1e2e] rounded-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">Ajouter un beat en vedette</h3>
              <div className="flex gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Rechercher par titre, genre ou producteur..."
                  value={beatSearch}
                  onChange={(e) => setBeatSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchBeats()}
                  className="flex-1 bg-[#13131a] border border-[#1e1e2e] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:outline-none"
                />
                <button
                  onClick={searchBeats}
                  disabled={searchingBeats || !beatSearch.trim()}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition disabled:opacity-40"
                >
                  {searchingBeats ? 'Recherche...' : 'Rechercher'}
                </button>
              </div>

              {/* Resultats de recherche */}
              {beatResults.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {beatResults.map((beat: any) => {
                    const isAlreadyFeatured =
                      featuredBeats.some((fb) => fb.id === beat.id) || beat.isFeatured
                    return (
                      <div
                        key={beat.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isAlreadyFeatured
                            ? 'bg-red-900/20 border-red-800/40'
                            : 'bg-[#13131a] border-[#1e1e2e]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {beat.coverImage ? (
                            <img
                              src={beat.coverImage}
                              alt={beat.title}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-gray-400 text-xs">
                              &#9835;
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-bold text-white">{beat.title}</p>
                            <p className="text-xs text-gray-400">
                              {beat.producer?.displayName || beat.producer?.name || 'Inconnu'}{' '}
                              &middot; {beat.genre} &middot; {beat.bpm} BPM
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleFeatured(beat.id, isAlreadyFeatured)}
                          className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
                            isAlreadyFeatured
                              ? 'bg-gray-600 hover:bg-gray-500 text-white'
                              : 'bg-red-600 hover:bg-red-700 text-white'
                          }`}
                        >
                          {isAlreadyFeatured ? 'Retirer' : 'Mettre en vedette'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Liste des beats en vedette actuels */}
            <div className="bg-[#13131a] border border-[#1e1e2e] rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">
                  Beats en vedette ({featuredBeats.length}/10)
                </h3>
                <span className="text-xs text-gray-500">
                  Affiches sur la page d&apos;accueil dans cet ordre
                </span>
              </div>

              {featuredBeats.length > 0 ? (
                <div className="space-y-2">
                  {featuredBeats.map((beat: any, index: number) => (
                    <div
                      key={beat.id}
                      className="flex items-center justify-between p-4 bg-[#13131a] border border-[#1e1e2e] rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-black text-red-500 w-8 text-center">
                          {index + 1}
                        </span>
                        {beat.coverImage ? (
                          <img
                            src={beat.coverImage}
                            alt={beat.title}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center text-gray-400">
                            &#9835;
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-white">{beat.title}</p>
                          <p className="text-xs text-gray-400">
                            {beat.producer?.displayName || beat.producer?.name} &middot;{' '}
                            {beat.genre} &middot; {beat.bpm} BPM
                          </p>
                          {beat.auctions?.[0] && (
                            <p className="text-xs text-green-400 mt-0.5">
                              Enchere active &middot; {beat.auctions[0].currentBid} EUR
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {beat.featuredAt
                            ? new Date(beat.featuredAt).toLocaleDateString('fr-FR')
                            : ''}
                        </span>
                        <button
                          onClick={() => toggleFeatured(beat.id, true)}
                          className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs font-bold rounded-lg transition border border-red-600/30"
                        >
                          Retirer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  Aucun beat en vedette. Recherche un beat ci-dessus pour l&apos;ajouter.
                </p>
              )}
            </div>
          </div>
        )}

        {/* PROMOS TAB */}
        {activeTab === 'promos' && (
          <div>
            {/* Créer un code promo */}
            <div className="bg-[#13131a] border border-[#1e1e2e] rounded-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">Creer un code promo</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Code (ex: LEGAACY20)"
                  value={newPromo.code}
                  onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                  className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-[#e11d48] focus:outline-none uppercase"
                />
                <select
                  value={newPromo.type}
                  onChange={(e) => setNewPromo({ ...newPromo, type: e.target.value })}
                  className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-4 py-2 text-sm text-white focus:border-[#e11d48] focus:outline-none"
                >
                  <option value="PERCENTAGE">Pourcentage (%)</option>
                  <option value="FIXED">Montant fixe (EUR)</option>
                </select>
                <input
                  type="number"
                  placeholder={
                    newPromo.type === 'PERCENTAGE' ? 'Valeur (ex: 15)' : 'Montant (ex: 10)'
                  }
                  value={newPromo.value}
                  onChange={(e) => setNewPromo({ ...newPromo, value: e.target.value })}
                  className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-[#e11d48] focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Prix min (optionnel)"
                  value={newPromo.minPrice}
                  onChange={(e) => setNewPromo({ ...newPromo, minPrice: e.target.value })}
                  className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-[#e11d48] focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Max utilisations (optionnel)"
                  value={newPromo.maxUses}
                  onChange={(e) => setNewPromo({ ...newPromo, maxUses: e.target.value })}
                  className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-[#e11d48] focus:outline-none"
                />
                <input
                  type="date"
                  placeholder="Expiration"
                  value={newPromo.expiresAt}
                  onChange={(e) => setNewPromo({ ...newPromo, expiresAt: e.target.value })}
                  className="bg-[#13131a] border border-[#1e1e2e] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-[#e11d48] focus:outline-none"
                />
              </div>
              <button
                onClick={createPromo}
                disabled={!newPromo.code || !newPromo.value}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-lg transition disabled:opacity-40"
              >
                Creer le code
              </button>
            </div>

            {/* Liste des codes */}
            <div className="space-y-3">
              {promos.map((p: any) => (
                <div
                  key={p.id}
                  className="bg-[#13131a] border border-[#1e1e2e] rounded-lg p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-black text-white tracking-wider">{p.code}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          p.status === 'ACTIVE'
                            ? 'bg-green-500/20 text-green-400'
                            : p.status === 'EXPIRED'
                              ? 'bg-gray-500/20 text-gray-400'
                              : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                      <span>{p.type === 'PERCENTAGE' ? `${p.value}%` : `${p.value} EUR`}</span>
                      {p.minPrice && <span>Min: {p.minPrice} EUR</span>}
                      <span>
                        {p.currentUses}/{p.maxUses || '∞'} utilisations
                      </span>
                      {p.expiresAt && (
                        <span>Expire: {new Date(p.expiresAt).toLocaleDateString('fr-FR')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {p.status === 'ACTIVE' ? (
                      <button
                        onClick={() => updatePromoStatus(p.id, 'DISABLED')}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg transition"
                      >
                        Desactiver
                      </button>
                    ) : (
                      <button
                        onClick={() => updatePromoStatus(p.id, 'ACTIVE')}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition"
                      >
                        Activer
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {promos.length === 0 && (
                <p className="text-gray-500 text-center py-8">Aucun code promo</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
