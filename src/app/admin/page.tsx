'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

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
    purple: 'from-purple-600 to-purple-800',
    orange: 'from-orange-500 to-orange-700',
    green: 'from-green-500 to-green-700',
    blue: 'from-blue-500 to-blue-700',
    red: 'from-red-500 to-red-700',
    yellow: 'from-yellow-500 to-yellow-700',
  }

  return (
    <div
      onClick={onClick}
      className={`bg-gradient-to-br ${colors[color] || colors.purple} rounded-xl p-5 text-white shadow-lg ${onClick ? 'cursor-pointer hover:scale-105 hover:shadow-xl transition-all duration-200' : ''}`}
    >
      <p className="text-sm opacity-80 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {onClick && <p className="text-[10px] mt-2 opacity-60 uppercase tracking-wider">Cliquer pour voir →</p>}
    </div>
  )
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('dashboard')
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
  const [playingBeatId, setPlayingBeatId] = useState<string | null>(null)
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)
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
  const [filterStatus, setFilterStatus] = useState('')
  const [previousTab, setPreviousTab] = useState<string | null>(null)

  // Lecture audio des beats
  const togglePlay = (beatId: string, audioUrl: string) => {
    if (playingBeatId === beatId) {
      // Pause
      audioRef?.pause()
      setPlayingBeatId(null)
    } else {
      // Play new beat
      if (audioRef) {
        audioRef.pause()
      }
      const audio = new Audio(audioUrl)
      audio.onended = () => setPlayingBeatId(null)
      audio.play()
      setAudioRef(audio)
      setPlayingBeatId(beatId)
    }
  }

  // Navigation depuis les cartes stats avec historique
  const navigateToTab = (tab: string, filter?: string) => {
    setPreviousTab(activeTab)
    setActiveTab(tab)
    if (filter) setFilterStatus(filter)
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

  const fetchAllBeats = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (beatsFilter) params.set('genre', beatsFilter)
      const res = await fetch(`/api/admin/beats?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAllBeats(data.beats || [])
        setBeatsPagination({ page: data.pagination.page, total: data.pagination.total, totalPages: data.pagination.totalPages })
      }
    } catch (e) {
      console.error(e)
    }
  }, [search, beatsFilter])

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
          prev.map((b) =>
            b.id === beatId ? { ...b, isFeatured: !isCurrentlyFeatured } : b
          )
        )
        // Update beats list too
        setAllBeats((prev) =>
          prev.map((b) =>
            b.id === beatId ? { ...b, isFeatured: !isCurrentlyFeatured } : b
          )
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
  }, [activeTab, loading, fetchProducers, fetchAuctions, fetchUsers, fetchReports, fetchPromos, fetchAllBeats, fetchFeatured])

  const updateProducerStatus = async (producerId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/producers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producerId, status: newStatus }),
      })
      if (res.ok) {
        fetchProducers()
        fetchStats()
      }
    } catch (e) {
      console.error(e)
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-purple-500 bg-clip-text text-transparent">
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
      <div className="bg-gray-900/50 border-b border-gray-800">
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
                  ? 'text-orange-400 border-b-2 border-orange-400'
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
              <StatCard label="Utilisateurs" value={stats.totalUsers} color="blue" onClick={() => navigateToTab('users')} />
              <StatCard label="Producteurs" value={stats.totalProducers} color="purple" onClick={() => navigateToTab('producers')} />
              <StatCard label="En attente" value={stats.pendingProducers} color="yellow" onClick={() => navigateToTab('producers', 'PENDING')} />
              <StatCard label="Encheres actives" value={stats.activeAuctions} color="green" onClick={() => navigateToTab('auctions', 'ACTIVE')} />
              <StatCard label="Total encheres" value={stats.totalAuctions} color="orange" onClick={() => navigateToTab('auctions')} />
              <StatCard label="Beats" value={stats.totalBeats} color="blue" onClick={() => navigateToTab('beats')} />
              <StatCard label="Total bids" value={stats.totalBids} color="purple" onClick={() => navigateToTab('auctions')} />
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
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
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
                <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1 min-w-[250px]">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-lg">{p.displayName || p.name}</p>
                        <span
                          className={`${statusColors[p.producerStatus || 'PENDING']} text-white text-xs px-2 py-0.5 rounded-full`}
                        >
                          {p.producerStatus || 'PENDING'}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm">{p.email}</p>
                      <p className="text-gray-500 text-xs mt-1">
                        {p._count.beats} beats • Inscrit le{' '}
                        {new Date(p.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {p.producerStatus !== 'APPROVED' && (
                        <button
                          onClick={() => updateProducerStatus(p.id, 'APPROVED')}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg transition"
                        >
                          Approuver
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
                    <div className="mt-3 pt-3 border-t border-gray-800 space-y-2">
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
                            className="block text-purple-400 hover:text-purple-300 text-sm mt-0.5 underline truncate"
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
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
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
                  className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-semibold">{a.beat.title}</p>
                    <p className="text-gray-400 text-sm">
                      Par {a.beat.producer.displayName || a.beat.producer.name} • {a.beat.genre}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {a.licenseType} • {a._count.bids} encheres • {a.currentBid.toFixed(2)} EUR
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
                <p className="text-gray-500 text-center py-8">Aucune enchere trouvee</p>
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
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800">
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
                    <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                      <td className="py-3 px-4">{u.displayName || u.name}</td>
                      <td className="py-3 px-4 text-gray-400">{u.email}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${u.role === 'ADMIN' ? 'bg-red-500/20 text-red-400' : u.role === 'PRODUCER' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}
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
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
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
                <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1 min-w-[250px]">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full text-white ${statusColors[r.status] || 'bg-gray-500'}`}
                        >
                          {r.status}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">
                          {reportTypeLabels[r.type] || r.type}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400">
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
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
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
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
              />
              <select
                value={beatsFilter}
                onChange={(e) => { setBeatsFilter(e.target.value); fetchAllBeats(1) }}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="">Tous les genres</option>
                {['Hip-Hop', 'Trap', 'R&B', 'Pop', 'Drill', 'Afrobeat', 'Reggaeton', 'Cloud Rap', 'Boom Bap', 'Lo-Fi'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
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
                return (
                  <div
                    key={beat.id}
                    className={`p-4 bg-gray-900 border rounded-lg transition ${isPlaying ? 'border-orange-500/50 bg-orange-950/10' : 'border-gray-800 hover:border-gray-700'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Cover + bouton play */}
                        <button
                          onClick={() => beat.audioUrl && togglePlay(beat.id, beat.audioUrl)}
                          className="relative w-14 h-14 rounded-lg overflow-hidden group flex-shrink-0"
                          disabled={!beat.audioUrl}
                        >
                          {beat.coverImage ? (
                            <img src={beat.coverImage} alt={beat.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-400">&#9835;</div>
                          )}
                          {beat.audioUrl && (
                            <div className={`absolute inset-0 flex items-center justify-center bg-black/40 ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                              <span className="text-white text-xl">{isPlaying ? '⏸' : '▶'}</span>
                            </div>
                          )}
                          {isPlaying && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-500 animate-pulse" />
                          )}
                        </button>

                        <div>
                          <p className="text-sm font-bold text-white">{beat.title}</p>
                          <p className="text-xs text-gray-400">
                            {beat.producer?.displayName || beat.producer?.name || 'Inconnu'} &middot; {beat.genre || 'N/A'} &middot; {beat.bpm || '?'} BPM &middot; {beat.key || '?'}
                          </p>
                          {!beat.audioUrl && (
                            <p className="text-xs text-red-400 mt-0.5">Pas de fichier audio</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 text-xs font-bold rounded ${
                          beat.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                          beat.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                          beat.status === 'SOLD' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {beat.status}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFeatured(beat.id, beat.isFeatured) }}
                          className={`px-3 py-1 text-xs font-bold rounded transition ${
                            beat.isFeatured
                              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40'
                              : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/40'
                          }`}
                        >
                          {beat.isFeatured ? '★ Retirer vedette' : '☆ Mettre en vedette'}
                        </button>
                        <span className="text-xs text-gray-500">
                          {beat._count?.likes || 0} ♥
                        </span>
                        <span className="text-xs text-gray-500">
                          {beat.price ? `${beat.price} EUR` : 'Gratuit'}
                        </span>
                      </div>
                    </div>
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
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
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
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">Ajouter un beat en vedette</h3>
              <div className="flex gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Rechercher par titre, genre ou producteur..."
                  value={beatSearch}
                  onChange={(e) => setBeatSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchBeats()}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-red-500 focus:outline-none"
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
                    const isAlreadyFeatured = featuredBeats.some((fb) => fb.id === beat.id) || beat.isFeatured
                    return (
                      <div
                        key={beat.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isAlreadyFeatured
                            ? 'bg-red-900/20 border-red-800/40'
                            : 'bg-gray-800 border-gray-700'
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
                              {beat.producer?.displayName || beat.producer?.name || 'Inconnu'} &middot; {beat.genre} &middot; {beat.bpm} BPM
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
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
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
                      className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-lg"
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
                            {beat.producer?.displayName || beat.producer?.name} &middot; {beat.genre} &middot; {beat.bpm} BPM
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
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">Creer un code promo</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Code (ex: LEGAACY20)"
                  value={newPromo.code}
                  onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none uppercase"
                />
                <select
                  value={newPromo.type}
                  onChange={(e) => setNewPromo({ ...newPromo, type: e.target.value })}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
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
                  className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Prix min (optionnel)"
                  value={newPromo.minPrice}
                  onChange={(e) => setNewPromo({ ...newPromo, minPrice: e.target.value })}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Max utilisations (optionnel)"
                  value={newPromo.maxUses}
                  onChange={(e) => setNewPromo({ ...newPromo, maxUses: e.target.value })}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                />
                <input
                  type="date"
                  placeholder="Expiration"
                  value={newPromo.expiresAt}
                  onChange={(e) => setNewPromo({ ...newPromo, expiresAt: e.target.value })}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
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
                  className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4"
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
