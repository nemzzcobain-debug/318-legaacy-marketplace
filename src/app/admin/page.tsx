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
}: {
  label: string
  value: string | number
  color?: string
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
      className={`bg-gradient-to-br ${colors[color] || colors.purple} rounded-xl p-5 text-white shadow-lg`}
    >
      <p className="text-sm opacity-80 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
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
    }
  }, [activeTab, loading, fetchProducers, fetchAuctions, fetchUsers, fetchReports, fetchPromos])

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
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && stats && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              <StatCard label="Utilisateurs" value={stats.totalUsers} color="blue" />
              <StatCard label="Producteurs" value={stats.totalProducers} color="purple" />
              <StatCard label="En attente" value={stats.pendingProducers} color="yellow" />
              <StatCard label="Encheres actives" value={stats.activeAuctions} color="green" />
              <StatCard label="Total encheres" value={stats.totalAuctions} color="orange" />
              <StatCard label="Beats" value={stats.totalBeats} color="blue" />
              <StatCard label="Total bids" value={stats.totalBids} color="purple" />
              <StatCard
                label="Ventes completees"
                value={stats.completedAuctionsCount}
                color="green"
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
