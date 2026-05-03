'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import BeatCard from '@/components/auction/BeatCard'
import { Search, Flame, Gavel, TrendingUp, DollarSign, Users, Music } from 'lucide-react'
import { GENRES } from '@/types'
import type { Auction } from '@/types'

const FILTERS = [
  { id: 'all', label: 'Tout' },
  { id: 'hot', label: 'Tendances', icon: Flame },
  ...GENRES.map((g) => ({ id: g, label: g })),
]

export default function MarketplacePage() {
  const searchParams = useSearchParams()
  const genreFromUrl = searchParams.get('genre')
  const initialFilter = genreFromUrl && GENRES.includes(genreFromUrl) ? genreFromUrl : 'all'

  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState(initialFilter)
  const [searchQuery, setSearchQuery] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)

  // Sync filter when URL params change (e.g. navigating from homepage genre links)
  useEffect(() => {
    const genre = searchParams.get('genre')
    if (genre && GENRES.includes(genre)) {
      setActiveFilter(genre)
    }
  }, [searchParams])

  // Fetch auctions
  useEffect(() => {
    async function fetchAuctions() {
      try {
        const params = new URLSearchParams({ status: 'active', limit: '20' })
        if (activeFilter !== 'all' && activeFilter !== 'hot') {
          params.set('genre', activeFilter)
        }
        if (activeFilter === 'hot') {
          params.set('sort', 'most_bids')
        }

        const res = await fetch(`/api/auctions?${params}`)
        const data = await res.json()
        setAuctions(data.auctions || [])
      } catch (err) {
        console.error('Erreur chargement enchères:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAuctions()
  }, [activeFilter])

  // Filter by search
  const filtered = auctions.filter((a) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      a.beat.title.toLowerCase().includes(q) ||
      a.beat.producer.name.toLowerCase().includes(q) ||
      a.beat.genre.toLowerCase().includes(q)
    )
  })

  const handlePlay = (id: string) => {
    setPlayingId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Hero Section */}
        <section className="pt-12 pb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-[#e11d4810] border border-[#e11d4825] rounded-full px-3.5 py-1 text-xs font-semibold text-[#e11d48] mb-5">
            Première plateforme d'enchères de beats en France
          </div>

          <h1 className="text-4xl md:text-5xl font-black mb-3 gradient-text leading-tight">
            Enchéris sur les meilleures
            <br />
            instrumentales
          </h1>

          <p className="text-base text-gray-400 max-w-lg mx-auto mb-7 leading-relaxed">
            Découvre des beats uniques de producteurs vérifiés. Place ton enchère, remporte
            l'instrumentale et crée ton prochain hit.
          </p>

          {/* Stats */}
          <div className="flex justify-center gap-8 mb-8 flex-wrap">
            {[
              { label: 'Enchères actives', value: auctions.length, icon: Gavel },
              {
                label: 'Enchères totales',
                value: auctions.reduce((s, a) => s + a.totalBids, 0),
                icon: TrendingUp,
              },
              {
                label: 'Valeur totale',
                value: `${auctions.reduce((s, a) => s + a.currentBid, 0)}\u20AC`,
                icon: DollarSign,
              },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-[#e11d4810] flex items-center justify-center">
                  <Icon size={16} className="text-[#e11d48]" />
                </div>
                <div className="text-left">
                  <div className="text-lg font-extrabold text-white">{value}</div>
                  <div className="text-[10px] text-gray-500">{label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="max-w-lg mx-auto relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un beat, un producteur..."
              className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-[#1e1e2e] text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4840] transition-colors"
            />
          </div>
        </section>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap justify-center">
          {FILTERS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveFilter(id)}
              className={`
                px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1 transition-all border
                ${
                  activeFilter === id
                    ? 'text-[#e11d48] bg-[#e11d4815] border-[#e11d4830]'
                    : 'text-gray-400 bg-white/[0.02] border-[#1e1e2e] hover:text-white'
                }
              `}
            >
              {Icon && <Icon size={12} />} {label}
            </button>
          ))}
        </div>

        {/* Auction Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-10">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl h-80 animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-10">
            {filtered.map((auction) => (
              <BeatCard
                key={auction.id}
                auction={auction}
                onPlay={handlePlay}
                isPlaying={playingId === auction.beat.id}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Music size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">Aucun beat trouvé</p>
            <p className="text-sm">Essaie un autre filtre ou recherche</p>
          </div>
        )}
      </main>
    </div>
  )
}
