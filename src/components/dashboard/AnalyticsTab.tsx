'use client'

// ─── 318 LEGAACY - Dashboard Analytics Tab ───
// Revenue charts, bid activity, follower growth, top beats, genre distribution

import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell
} from 'recharts'
import {
  TrendingUp, DollarSign, Gavel, Users, Headphones, Star, Disc,
  BarChart3, Loader2, Calendar, Music
} from 'lucide-react'

interface AnalyticsData {
  summary: {
    totalRevenue: number
    totalPayout: number
    totalSales: number
    totalAuctions: number
    conversionRate: number
    avgSalePrice: number
    totalPlays: number
    totalBeats: number
    totalFollowers: number
    totalBidsReceived: number
    avgRating: number
    totalReviews: number
  }
  charts: {
    revenue: { date: string; revenue: number; payout: number; sales: number }[]
    bids: { date: string; bids: number }[]
    followers: { date: string; total: number; new: number }[]
  }
  topBeats: { id: string; title: string; genre: string; plays: number; likes: number; auctions: number }[]
  genreDistribution: { name: string; count: number }[]
  licenseDistribution: { name: string; count: number }[]
}

const PERIOD_OPTIONS = [
  { value: '7', label: '7 jours' },
  { value: '30', label: '30 jours' },
  { value: '90', label: '3 mois' },
  { value: '365', label: '1 an' },
]

const PIE_COLORS = ['#e11d48', '#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#6366f1', '#14b8a6']
const LICENSE_COLORS: Record<string, string> = { BASIC: '#8a8a9a', PREMIUM: '#f59e0b', EXCLUSIVE: '#8b5cf6' }

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null
  return (
    <div className="bg-[#1a1a2e] border border-[#333] rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{formatDate(label)}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-bold" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.name.includes('EUR') ? `${p.value} EUR` : p.value}
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/dashboard/analytics?period=${period}`)
        if (res.ok) setData(await res.json())
      } catch {} finally {
        setLoading(false)
      }
    }
    load()
  }, [period])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-red-500" />
      </div>
    )
  }

  if (!data) return <p className="text-gray-500 text-center py-10">Erreur de chargement</p>

  const { summary, charts, topBeats, genreDistribution, licenseDistribution } = data

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-white flex items-center gap-2">
          <BarChart3 size={20} className="text-red-500" /> Analytics
        </h2>
        <div className="flex items-center gap-1 bg-[#111111] border border-[#222222] rounded-xl p-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                period === opt.value
                  ? 'bg-red-500/10 text-red-500'
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Revenus totaux', value: `${summary.totalPayout} EUR`, icon: DollarSign, color: 'text-green-400 bg-green-500/10' },
          { label: 'Ventes', value: summary.totalSales, icon: TrendingUp, color: 'text-red-500 bg-red-500/10' },
          { label: 'Taux conversion', value: `${summary.conversionRate}%`, icon: Gavel, color: 'text-blue-400 bg-blue-500/10' },
          { label: 'Prix moyen', value: `${summary.avgSalePrice} EUR`, icon: DollarSign, color: 'text-yellow-400 bg-yellow-500/10' },
          { label: 'Ecoutes totales', value: summary.totalPlays.toLocaleString(), icon: Headphones, color: 'text-purple-400 bg-purple-500/10' },
          { label: 'Followers', value: summary.totalFollowers, icon: Users, color: 'text-pink-400 bg-pink-500/10' },
          { label: 'Encheres recues', value: summary.totalBidsReceived, icon: Gavel, color: 'text-orange-400 bg-orange-500/10' },
          { label: 'Note moyenne', value: summary.avgRating > 0 ? `${summary.avgRating}/5` : '—', icon: Star, color: 'text-yellow-400 bg-yellow-500/10' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#111111] border border-[#222222] rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color}`}>
              <Icon size={16} />
            </div>
            <div className="text-lg font-extrabold text-white">{value}</div>
            <div className="text-[10px] text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <DollarSign size={16} className="text-green-400" /> Revenus
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={charts.revenue}>
            <defs>
              <linearGradient id="colorPayout" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="payout" name="Payout EUR" stroke="#10b981" fill="url(#colorPayout)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bids + Followers side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bid Activity */}
        <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Gavel size={16} className="text-red-500" /> Activite encheres
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={charts.bids}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="bids" name="Encheres" fill="#e11d48" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Follower Growth */}
        <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Users size={16} className="text-purple-400" /> Croissance followers
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={charts.followers}>
              <defs>
                <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="total" name="Total" stroke="#8b5cf6" fill="url(#colorFollowers)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Genre + License Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Genre Pie */}
        {genreDistribution.length > 0 && (
          <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Disc size={16} className="text-red-500" /> Repartition par genre
            </h3>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie
                    data={genreDistribution}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={40}
                    paddingAngle={2}
                  >
                    {genreDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {genreDistribution.slice(0, 6).map((g, i) => (
                  <div key={g.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-gray-400 flex-1">{g.name}</span>
                    <span className="text-white font-bold">{g.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* License Distribution */}
        {licenseDistribution.length > 0 && (
          <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Music size={16} className="text-yellow-400" /> Licences vendues
            </h3>
            <div className="space-y-3 mt-6">
              {licenseDistribution.map(l => {
                const total = licenseDistribution.reduce((s, x) => s + x.count, 0)
                const pct = total > 0 ? Math.round((l.count / total) * 100) : 0
                return (
                  <div key={l.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold" style={{ color: LICENSE_COLORS[l.name] || '#fff' }}>{l.name}</span>
                      <span className="text-xs text-gray-400">{l.count} ({pct}%)</span>
                    </div>
                    <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: LICENSE_COLORS[l.name] || '#e11d48' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Top Beats */}
      {topBeats.length > 0 && (
        <div className="bg-[#111111] border border-[#222222] rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Headphones size={16} className="text-blue-400" /> Top beats par ecoutes
          </h3>
          <div className="space-y-2">
            {topBeats.map((beat, i) => (
              <div key={beat.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition">
                <span className="text-xs font-black text-gray-600 w-6 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-white truncate block">{beat.title}</span>
                  <span className="text-[10px] text-gray-500">{beat.genre}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Headphones size={11} /> {beat.plays.toLocaleString()}</span>
                  <span className="flex items-center gap-1 text-pink-400">♥ {beat.likes}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
