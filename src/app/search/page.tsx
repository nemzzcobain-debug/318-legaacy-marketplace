'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import CountdownTimer from '@/components/ui/CountdownTimer'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import LikeButton from '@/components/ui/LikeButton'
import {
  Search, Filter, X, Music, Gavel, Clock, Play, Pause,
  SlidersHorizontal, ChevronDown, ChevronUp, ArrowUpDown,
  Loader2, Shield, TrendingUp, Disc, RotateCcw
} from 'lucide-react'

interface SearchAuction {
  id: string
  currentBid: number
  startPrice: number
  totalBids: number
  status: string
  endTime: string
  licenseType: string
  beat: {
    id: string
    title: string
    genre: string
    bpm: number
    key: string | null
    mood: string | null
    audioUrl: string
    coverImage: string | null
    tags: string
    _count: { likes: number }
    producer: {
      id: string
      name: string
      displayName: string | null
      avatar: string | null
      rating: number
      producerStatus: string
    }
  }
  _count: { bids: number }
}

interface Filters {
  genres: { name: string; count: number }[]
  keys: { name: string; count: number }[]
  moods: { name: string; count: number }[]
}

const LICENSE_COLORS: Record<string, string> = {
  BASIC: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  PREMIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  EXCLUSIVE: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

const SORT_OPTIONS = [
  { value: 'ending_soon', label: 'Fin bientôt' },
  { value: 'newest', label: 'Plus récentes' },
  { value: 'most_bids', label: 'Plus enchéris' },
  { value: 'highest_bid', label: 'Prix le plus haut' },
  { value: 'lowest_bid', label: 'Prix le plus bas' },
]

const BPM_PRESETS = [
  { label: 'Slow (60-90)', min: 60, max: 90 },
  { label: 'Medium (90-120)', min: 90, max: 120 },
  { label: 'Fast (120-150)', min: 120, max: 150 },
  { label: 'Very Fast (150+)', min: 150, max: 300 },
]

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-red-500" />
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  )
}

function SearchPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // State from URL params
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [genre, setGenre] = useState(searchParams.get('genre') || '')
  const [bpmMin, setBpmMin] = useState(searchParams.get('bpmMin') || '')
  const [bpmMax, setBpmMax] = useState(searchParams.get('bpmMax') || '')
  const [key, setKey] = useState(searchParams.get('key') || '')
  const [mood, setMood] = useState(searchParams.get('mood') || '')
  const [priceMin, setPriceMin] = useState(searchParams.get('priceMin') || '')
  const [priceMax, setPriceMax] = useState(searchParams.get('priceMax') || '')
  const [licenseType, setLicenseType] = useState(searchParams.get('licenseType') || '')
  const [sort, setSort] = useState(searchParams.get('sort') || 'ending_soon')

  // UI state
  const [auctions, setAuctions] = useState<SearchAuction[]>([])
  const [filters, setFilters] = useState<Filters>({ genres: [], keys: [], moods: [] })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  const doSearch = useCallback(async (resetPage = false) => {
    setLoading(true)
    const p = resetPage ? 1 : page
    if (resetPage) setPage(1)

    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (genre) params.set('genre', genre)
    if (bpmMin) params.set('bpmMin', bpmMin)
    if (bpmMax) params.set('bpmMax', bpmMax)
    if (key) params.set('key', key)
    if (mood) params.set('mood', mood)
    if (priceMin) params.set('priceMin', priceMin)
    if (priceMax) params.set('priceMax', priceMax)
    if (licenseType) params.set('licenseType', licenseType)
    if (sort) params.set('sort', sort)
    params.set('page', String(p))
    params.set('limit', '18')

    try {
      const res = await fetch(`/api/search?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setAuctions(data.auctions)
        setTotal(data.pagination.total)
        setTotalPages(data.pagination.totalPages)
        setFilters(data.filters)
      }
    } catch {} finally {
      setLoading(false)
    }
  }, [query, genre, bpmMin, bpmMax, key, mood, priceMin, priceMax, licenseType, sort, page])

  // Search on mount and when filters change
  useEffect(() => {
    doSearch(true)
  }, [genre, bpmMin, bpmMax, key, mood, priceMin, priceMax, licenseType, sort])

  // Page change
  useEffect(() => {
    if (page > 1) doSearch()
  }, [page])

  // Initial load
  useEffect(() => {
    doSearch()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    doSearch(true)
  }

  const clearFilters = () => {
    setQuery(''); setGenre(''); setBpmMin(''); setBpmMax('')
    setKey(''); setMood(''); setPriceMin(''); setPriceMax('')
    setLicenseType(''); setSort('ending_soon')
  }

  const activeFilterCount = [genre, bpmMin, bpmMax, key, mood, priceMin, priceMax, licenseType]
    .filter(Boolean).length

  const togglePlay = (id: string, url: string) => {
    if (playingId === id) { audio?.pause(); setPlayingId(null); return }
    audio?.pause()
    const a = new Audio(url)
    a.play(); a.onended = () => setPlayingId(null)
    setAudio(a); setPlayingId(id)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Breadcrumbs items={[
          { label: 'Recherche' }
        ]} />

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un beat, genre, producteur..."
                className="w-full bg-[#111111] border border-[#222222] rounded-xl pl-11 pr-4 py-3.5 text-white text-sm font-semibold placeholder-gray-600 focus:border-red-500/50 focus:outline-none transition"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3.5 rounded-xl font-bold text-sm text-black transition hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              Rechercher
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2 border transition ${
                showFilters
                  ? 'border-red-500/30 text-red-500 bg-red-500/5'
                  : 'border-[#222] text-gray-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal size={16} />
              Filtres
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </form>

        <div className="flex gap-6">
          {/* Filters Sidebar */}
          {showFilters && (
            <div className="w-[260px] flex-shrink-0 space-y-4">
              {/* Clear all */}
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-red-400 bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 transition"
                >
                  <RotateCcw size={12} /> Effacer les filtres
                </button>
              )}

              {/* Genre */}
              <div className="bg-[#111111] border border-[#222222] rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Genre</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  <button
                    onClick={() => setGenre('')}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition ${
                      !genre ? 'text-red-500 bg-red-500/10 font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Tous les genres
                  </button>
                  {filters.genres.map(g => (
                    <button
                      key={g.name}
                      onClick={() => setGenre(genre === g.name ? '' : g.name)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition ${
                        genre === g.name ? 'text-red-500 bg-red-500/10 font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span>{g.name}</span>
                      <span className="text-[10px] text-gray-600">{g.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* BPM */}
              <div className="bg-[#111111] border border-[#222222] rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">BPM</h3>
                <div className="flex gap-2 mb-2">
                  <input
                    type="number"
                    value={bpmMin}
                    onChange={(e) => setBpmMin(e.target.value)}
                    placeholder="Min"
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:border-red-500/50 focus:outline-none"
                  />
                  <span className="text-gray-600 self-center">—</span>
                  <input
                    type="number"
                    value={bpmMax}
                    onChange={(e) => setBpmMax(e.target.value)}
                    placeholder="Max"
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:border-red-500/50 focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {BPM_PRESETS.map(p => (
                    <button
                      key={p.label}
                      onClick={() => { setBpmMin(String(p.min)); setBpmMax(String(p.max)) }}
                      className={`text-[10px] px-2 py-1 rounded-md transition ${
                        bpmMin === String(p.min) && bpmMax === String(p.max)
                          ? 'bg-red-500/10 text-red-400 font-bold'
                          : 'bg-white/5 text-gray-500 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Key */}
              {filters.keys.length > 0 && (
                <div className="bg-[#111111] border border-[#222222] rounded-xl p-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tonalité</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {filters.keys.map(k => (
                      <button
                        key={k.name}
                        onClick={() => setKey(key === k.name ? '' : k.name)}
                        className={`text-xs px-2.5 py-1 rounded-lg transition border ${
                          key === k.name
                            ? 'border-red-500/50 text-red-500 bg-red-500/10 font-bold'
                            : 'border-[#222] text-gray-400 hover:text-white hover:border-[#333]'
                        }`}
                      >
                        {k.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mood */}
              {filters.moods.length > 0 && (
                <div className="bg-[#111111] border border-[#222222] rounded-xl p-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Ambiance</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {filters.moods.map(m => (
                      <button
                        key={m.name}
                        onClick={() => setMood(mood === m.name ? '' : m.name)}
                        className={`text-xs px-2.5 py-1 rounded-lg transition border ${
                          mood === m.name
                            ? 'border-red-500/50 text-red-500 bg-red-500/10 font-bold'
                            : 'border-[#222] text-gray-400 hover:text-white hover:border-[#333]'
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Price Range */}
              <div className="bg-[#111111] border border-[#222222] rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Prix (EUR)</h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    placeholder="Min"
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:border-red-500/50 focus:outline-none"
                  />
                  <span className="text-gray-600 self-center">—</span>
                  <input
                    type="number"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    placeholder="Max"
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:border-red-500/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* License Type */}
              <div className="bg-[#111111] border border-[#222222] rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Licence</h3>
                <div className="space-y-1">
                  {['', 'BASIC', 'PREMIUM', 'EXCLUSIVE'].map(lt => (
                    <button
                      key={lt}
                      onClick={() => setLicenseType(lt)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition ${
                        licenseType === lt ? 'text-red-500 bg-red-500/10 font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {lt || 'Toutes'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          <div className="flex-1">
            {/* Results header */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-400">
                {loading ? (
                  <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Recherche...</span>
                ) : (
                  <span><strong className="text-white">{total}</strong> resultat{total > 1 ? 's' : ''}</span>
                )}
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <ArrowUpDown size={14} className="text-gray-500" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="bg-[#111111] border border-[#222222] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/50 cursor-pointer"
                >
                  {SORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active filters pills */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {genre && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                    {genre}
                    <button onClick={() => setGenre('')}><X size={12} /></button>
                  </span>
                )}
                {(bpmMin || bpmMax) && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {bpmMin || '?'}-{bpmMax || '?'} BPM
                    <button onClick={() => { setBpmMin(''); setBpmMax('') }}><X size={12} /></button>
                  </span>
                )}
                {key && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {key}
                    <button onClick={() => setKey('')}><X size={12} /></button>
                  </span>
                )}
                {mood && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                    {mood}
                    <button onClick={() => setMood('')}><X size={12} /></button>
                  </span>
                )}
                {(priceMin || priceMax) && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    {priceMin || '0'}-{priceMax || '∞'} EUR
                    <button onClick={() => { setPriceMin(''); setPriceMax('') }}><X size={12} /></button>
                  </span>
                )}
                {licenseType && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                    {licenseType}
                    <button onClick={() => setLicenseType('')}><X size={12} /></button>
                  </span>
                )}
              </div>
            )}

            {/* Results Grid */}
            {!loading && auctions.length === 0 ? (
              <div className="text-center py-20 bg-[#111111] border border-[#222222] rounded-xl">
                <Search size={48} className="text-gray-700 mx-auto mb-4" />
                <p className="text-gray-400 font-bold text-lg">Aucun résultat</p>
                <p className="text-gray-600 text-sm mt-1 mb-6">Essaie d'élargir tes critères de recherche</p>
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-red-500 border border-red-500/20 hover:bg-red-500/5 transition"
                >
                  <RotateCcw size={14} /> Effacer tous les filtres
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {auctions.map(auction => {
                  const { beat } = auction
                  const producerName = beat.producer.displayName || beat.producer.name
                  const isPlaying = playingId === auction.id

                  return (
                    <div
                      key={auction.id}
                      className="bg-[#111111] border border-[#222222] rounded-xl overflow-hidden hover:border-red-500/20 transition group"
                    >
                      {/* Cover */}
                      <div className="relative h-28 bg-gradient-to-br from-[#1a0a2e] via-[#111111] to-[#0a0a1a]">
                        {beat.coverImage && (
                          <Image src={beat.coverImage} alt={beat.title} fill className="absolute inset-0 object-cover opacity-25" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#111111] to-transparent" />

                        {/* License badge */}
                        <div className="absolute top-2 right-2">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${LICENSE_COLORS[auction.licenseType]}`}>
                            {auction.licenseType}
                          </span>
                        </div>

                        {/* Timer */}
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
                          <Clock size={10} className="text-red-500" />
                          <CountdownTimer endTime={auction.endTime} size="sm" showIcon={false} />
                        </div>

                        {/* Play button */}
                        <button
                          onClick={() => togglePlay(auction.id, beat.audioUrl)}
                          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-11 h-11 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-900/30 hover:scale-110 transition z-10 border-3 border-[#111111]"
                        >
                          {isPlaying ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white ml-0.5" />}
                        </button>

                        {/* Like button */}
                        <div className="absolute bottom-2 right-2">
                          <LikeButton beatId={beat.id} initialCount={beat._count.likes} size="sm" showCount={false} />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="pt-8 px-4 pb-4">
                        <Link href={`/auction/${auction.id}`}>
                          <h3 className="text-sm font-bold text-white truncate group-hover:text-red-500 transition text-center">
                            {beat.title}
                          </h3>
                        </Link>
                        <Link href={`/producer/${beat.producer.id}`} className="block text-center">
                          <p className="text-[11px] text-gray-500 mt-0.5 flex items-center justify-center gap-1">
                            {producerName}
                            {beat.producer.producerStatus === 'APPROVED' && <Shield size={10} className="text-red-500" />}
                          </p>
                        </Link>

                        {/* Tags */}
                        <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
                          <span className="text-[9px] bg-white/5 text-gray-500 px-2 py-0.5 rounded-full">{beat.genre}</span>
                          <span className="text-[9px] bg-white/5 text-gray-500 px-2 py-0.5 rounded-full">{beat.bpm} BPM</span>
                          {beat.key && <span className="text-[9px] bg-white/5 text-gray-500 px-2 py-0.5 rounded-full">{beat.key}</span>}
                        </div>

                        {/* Bid info */}
                        <div className="flex items-end justify-between mt-3 pt-3 border-t border-[#1e1e2e]">
                          <div>
                            <span className="text-[9px] text-gray-600 uppercase tracking-wider font-bold">Enchere</span>
                            <div className="text-lg font-black text-white">{auction.currentBid}&euro;</div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-[10px] text-gray-500">
                              <Gavel size={10} /> {auction._count.bids} enchère{auction._count.bids > 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-gray-400 bg-[#111] border border-[#222] hover:text-white disabled:opacity-30 transition"
                >
                  Précédent
                </button>
                <span className="text-sm text-gray-500">
                  Page <strong className="text-white">{page}</strong> / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-gray-400 bg-[#111] border border-[#222] hover:text-white disabled:opacity-30 transition"
                >
                  Suivant
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
