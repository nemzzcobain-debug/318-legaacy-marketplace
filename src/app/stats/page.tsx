'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import {
  Users, Music, Gavel, TrendingUp, DollarSign, BarChart3,
  Trophy, Loader2, Shield, Disc, Zap, Target, Crown, Star
} from 'lucide-react'

interface PublicStats {
  overview: {
    totalUsers: number
    totalProducers: number
    totalBeats: number
    totalAuctions: number
    activeAuctions: number
    completedAuctions: number
    totalBids: number
    totalVolume: number
    avgPrice: number
    maxPrice: number
  }
  topGenres: { name: string; count: number }[]
  recentSales: {
    id: string
    finalPrice: number | null
    licenseType: string
    paidAt: string
    beat: {
      title: string
      genre: string
      coverImage: string | null
      producer: { name: string; displayName: string | null; avatar: string | null }
    }
  }[]
  topProducers: {
    id: string
    name: string
    displayName: string | null
    avatar: string | null
    totalSales: number
    rating: number
    _count: { beats: number }
  }[]
}

function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const duration = 1500
    const start = Date.now()
    const step = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      setDisplay(Math.floor(eased * value))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value])

  return <>{display.toLocaleString('fr-FR')}{suffix}</>
}

function StatCard({ icon: Icon, label, value, suffix, color }: {
  icon: any; label: string; value: number; suffix?: string; color: string
}) {
  const colors: Record<string, string> = {
    red: 'from-red-600/20 to-red-900/10 border-red-500/20',
    purple: 'from-purple-600/20 to-purple-900/10 border-purple-500/20',
    blue: 'from-blue-600/20 to-blue-900/10 border-blue-500/20',
    green: 'from-green-600/20 to-green-900/10 border-green-500/20',
    yellow: 'from-yellow-600/20 to-yellow-900/10 border-yellow-500/20',
    orange: 'from-orange-600/20 to-orange-900/10 border-orange-500/20',
  }
  const iconColors: Record<string, string> = {
    red: 'text-red-500', purple: 'text-purple-500', blue: 'text-blue-500',
    green: 'text-green-500', yellow: 'text-yellow-500', orange: 'text-orange-500',
  }

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-6 text-center`}>
      <Icon size={28} className={`mx-auto mb-3 ${iconColors[color]}`} />
      <p className="text-3xl font-black text-white mb-1">
        <AnimatedCounter value={value} suffix={suffix} />
      </p>
      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{label}</p>
    </div>
  )
}

export default function StatsPage() {
  const [stats, setStats] = useState<PublicStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stats/public')
      .then((r) => r.json())
      .then((data) => {
        if (data.overview) setStats(data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <Loader2 className="animate-spin text-red-500" size={32} />
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Header />
        <div className="text-center py-20 text-gray-500">Impossible de charger les statistiques</div>
      </div>
    )
  }

  const { overview } = stats
  const maxGenreCount = stats.topGenres[0]?.count || 1

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold mb-4">
            <BarChart3 size={14} /> STATISTIQUES EN TEMPS REEL
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
            318 LEGAACY
            <span className="block text-red-500">en chiffres</span>
          </h1>
          <p className="text-gray-500 max-w-lg mx-auto">
            La premiere plateforme d&apos;encheres de beats en France. Decouvre nos statistiques en direct.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
          <StatCard icon={Users} label="Utilisateurs" value={overview.totalUsers} color="blue" />
          <StatCard icon={Shield} label="Producteurs" value={overview.totalProducers} color="purple" />
          <StatCard icon={Music} label="Beats actifs" value={overview.totalBeats} color="red" />
          <StatCard icon={Gavel} label="Encheres totales" value={overview.totalAuctions} color="orange" />
          <StatCard icon={Zap} label="Encheres en cours" value={overview.activeAuctions} color="green" />
          <StatCard icon={Trophy} label="Ventes completees" value={overview.completedAuctions} color="yellow" />
          <StatCard icon={Target} label="Total des bids" value={overview.totalBids} color="blue" />
          <StatCard icon={DollarSign} label="Volume total" value={Math.round(overview.totalVolume)} suffix=" EUR" color="green" />
        </div>

        {/* Prix moyens */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-green-500" />
              Prix moyens
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-black text-white">{overview.avgPrice.toFixed(0)}&euro;</p>
                <p className="text-xs text-gray-500">Prix moyen</p>
              </div>
              <div>
                <p className="text-2xl font-black text-white">{overview.maxPrice.toFixed(0)}&euro;</p>
                <p className="text-xs text-gray-500">Vente record</p>
              </div>
            </div>
          </div>

          {/* Top Genres */}
          <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Disc size={16} className="text-purple-500" />
              Genres populaires
            </h3>
            <div className="space-y-2">
              {stats.topGenres.map((g, i) => (
                <div key={g.name} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-white">{g.name}</span>
                      <span className="text-xs text-gray-500">{g.count} beats</span>
                    </div>
                    <div className="h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-1000"
                        style={{ width: `${(g.count / maxGenreCount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {stats.topGenres.length === 0 && (
                <p className="text-gray-600 text-sm">Aucun genre disponible</p>
              )}
            </div>
          </div>
        </div>

        {/* Top Producteurs */}
        {stats.topProducers.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-black text-white mb-6 flex items-center gap-3">
              <Crown size={24} className="text-yellow-500" />
              Top Producteurs
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {stats.topProducers.map((p, i) => (
                <Link
                  key={p.id}
                  href={`/producer/${p.id}`}
                  className="bg-[#111] border border-[#222] rounded-2xl p-4 text-center hover:border-red-500/30 transition group"
                >
                  <div className="relative inline-block mb-3">
                    {p.avatar ? (
                      <Image src={p.avatar} alt="" width={56} height={56} className="w-14 h-14 rounded-full object-cover mx-auto" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-lg font-bold text-white mx-auto">
                        {(p.displayName || p.name)[0]?.toUpperCase()}
                      </div>
                    )}
                    {i < 3 && (
                      <span className={`absolute -top-1 -right-1 w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${
                        i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-gray-400 text-black' : 'bg-orange-600 text-white'
                      }`}>
                        {i + 1}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-white truncate group-hover:text-red-500 transition">
                    {p.displayName || p.name}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{p.totalSales} vente{p.totalSales > 1 ? 's' : ''}</p>
                  <p className="text-[10px] text-gray-600">{p._count.beats} beat{p._count.beats > 1 ? 's' : ''}</p>
                  {p.rating > 0 && (
                    <div className="flex items-center justify-center gap-0.5 mt-1">
                      <Star size={10} className="text-yellow-500 fill-yellow-500" />
                      <span className="text-[10px] text-yellow-500 font-bold">{p.rating.toFixed(1)}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Dernières ventes */}
        {stats.recentSales.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-black text-white mb-6 flex items-center gap-3">
              <Trophy size={24} className="text-green-500" />
              Dernieres ventes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.recentSales.map((sale) => (
                <Link
                  key={sale.id}
                  href={`/auction/${sale.id}`}
                  className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden hover:border-green-500/30 transition group"
                >
                  <div className="relative h-20 bg-gradient-to-br from-[#1a0a2e] to-[#111]">
                    {sale.beat.coverImage && (
                      <Image src={sale.beat.coverImage} alt="" fill className="absolute inset-0 object-cover opacity-20" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111] to-transparent" />
                    <div className="absolute bottom-2 right-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        sale.licenseType === 'EXCLUSIVE' ? 'bg-purple-500/20 text-purple-400' :
                        sale.licenseType === 'PREMIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {sale.licenseType}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-bold text-white truncate group-hover:text-green-400 transition">
                      {sale.beat.title}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {sale.beat.producer.displayName || sale.beat.producer.name}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1e1e2e]">
                      <span className="text-lg font-black text-green-400">{sale.finalPrice}&euro;</span>
                      <span className="text-[10px] text-gray-600">
                        {sale.paidAt && new Date(sale.paidAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="text-center bg-gradient-to-br from-red-600/10 to-red-900/5 border border-red-500/20 rounded-2xl p-10">
          <h2 className="text-2xl font-black text-white mb-2">Rejoins la communaute</h2>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Que tu sois beatmaker ou artiste, 318 LEGAACY est la plateforme qu&apos;il te faut.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/marketplace"
              className="px-6 py-3 rounded-xl font-bold text-sm text-black"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              Voir les encheres
            </Link>
            <Link
              href="/register"
              className="px-6 py-3 rounded-xl font-bold text-sm text-white border border-[#333] hover:border-red-500/50 transition"
            >
              Creer un compte
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
