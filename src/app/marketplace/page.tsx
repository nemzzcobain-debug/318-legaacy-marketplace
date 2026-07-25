'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import CountdownTimer from '@/components/ui/CountdownTimer'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import LikeButton from '@/components/ui/LikeButton'
import { useExclusiveAudioPlayer } from '@/hooks/useExclusiveAudioPlayer'
import {
  Search, X, Gavel, Clock, Play, Pause,
  SlidersHorizontal, ArrowUpDown,
  Loader2, Shield, RotateCcw
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

export default function MarketplaceExplorer() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-red-500" />
      </div>
    }>
      <MarketplaceExplorerContent />
    </Suspense>
  )
}

function MarketplaceExplorerContent() {
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
  const [showFilters, setShowFilters] = useState(false)
  const { playingId, togglePlay } = useExclusiveAudioPlayer()

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08080a] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[560px] bg-[radial-gradient(circle_at_15%_0%,rgba(225,29,72,0.17),transparent_40%),radial-gradient(circle_at_85%_4%,rgba(127,29,29,0.12),transparent_34%)]"
      />
      <Header />

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 sm:pt-8">
        <div className="hidden sm:block">
          <Breadcrumbs items={[{ label: 'Enchères' }]} />
        </div>

        {/* Page introduction */}
        <div className="mb-6 max-w-3xl sm:mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            Enchères en direct
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
            Trouve le beat qui fera la différence.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
            Écoute les instrumentales, compare les licences et place ta mise avant la fin du
            compte à rebours.
          </p>
        </div>

        {/* Search Bar */}
        <form
          onSubmit={handleSearch}
          className="mb-5 rounded-[24px] border border-white/10 bg-[#101014]/90 p-3 shadow-xl shadow-black/20 backdrop-blur-xl sm:p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un beat, genre, producteur..."
                className="w-full rounded-2xl border border-white/10 bg-black/25 py-3.5 pl-11 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-600 focus:border-red-500/60 focus:ring-4 focus:ring-red-500/10"
              />
            </div>
            <button
              type="submit"
              className="rounded-2xl bg-gradient-to-r from-[#f20d46] to-[#c70b35] px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-red-950/30 transition hover:-translate-y-0.5"
            >
              Rechercher
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-bold transition ${
                showFilters
                  ? 'border-red-500/30 bg-red-500/10 text-red-400'
                  : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-white'
              }`}
            >
              <SlidersHorizontal size={16} />
              Filtres avancés
              {activeFilterCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {filters.genres.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
              <button
                type="button"
                onClick={() => setGenre('')}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                  !genre
                    ? 'border-red-500/30 bg-red-500/10 text-red-400'
                    : 'border-white/10 bg-white/[0.03] text-zinc-500 hover:text-white'
                }`}
              >
                Tous
              </button>
              {filters.genres.slice(0, 9).map((genreOption) => (
                <button
                  type="button"
                  key={genreOption.name}
                  onClick={() =>
                    setGenre(genre === genreOption.name ? '' : genreOption.name)
                  }
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                    genre === genreOption.name
                      ? 'border-red-500/30 bg-red-500/10 text-red-400'
                      : 'border-white/10 bg-white/[0.03] text-zinc-500 hover:text-white'
                  }`}
                >
                  {genreOption.name}
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start xl:gap-7">
          {/* Filters Sidebar */}
          {showFilters && (
            <aside className="w-full flex-shrink-0 space-y-3 lg:sticky lg:top-24 lg:w-[270px]">
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
              <div className="rounded-2xl border border-white/10 bg-[#101014]/90 p-4">
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
              <div className="rounded-2xl border border-white/10 bg-[#101014]/90 p-4">
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
                <div className="rounded-2xl border border-white/10 bg-[#101014]/90 p-4">
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
                <div className="rounded-2xl border border-white/10 bg-[#101014]/90 p-4">
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
              <div className="rounded-2xl border border-white/10 bg-[#101014]/90 p-4">
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
              <div className="rounded-2xl border border-white/10 bg-[#101014]/90 p-4">
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
            </aside>
          )}

          {/* Results */}
          <div className="min-w-0 flex-1">
            {/* Results header */}
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
              <div className="text-sm text-zinc-400">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-red-400" /> Recherche...
                  </span>
                ) : (
                  <span>
                    <strong className="font-black text-white">{total}</strong> enchère
                    {total > 1 ? 's' : ''} disponible{total > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2.5">
                <ArrowUpDown size={13} className="text-zinc-500" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label="Trier les enchères"
                  className="cursor-pointer bg-transparent py-2 text-xs font-semibold text-white outline-none"
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
            {loading ? (
              <div
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
                role="status"
                aria-label="Chargement des enchères"
                aria-live="polite"
              >
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse overflow-hidden rounded-[22px] border border-white/10 bg-[#101014]"
                    aria-hidden="true"
                  >
                    <div className="h-44 bg-gradient-to-br from-[#1a1a24] to-[#15151d]" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 w-2/3 rounded bg-white/10" />
                      <div className="h-3 w-1/3 rounded bg-white/[0.07]" />
                      <div className="flex gap-2">
                        <div className="h-5 w-16 rounded-full bg-white/[0.07]" />
                        <div className="h-5 w-20 rounded-full bg-white/[0.07]" />
                      </div>
                      <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                        <div className="h-3 w-14 rounded bg-white/[0.07]" />
                        <div className="h-5 w-12 rounded bg-white/10" />
                      </div>
                    </div>
                  </div>
                ))}
                <span className="sr-only">Chargement des enchères en cours…</span>
              </div>
            ) : auctions.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] py-20 text-center">
                <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
                  <Search size={26} className="text-zinc-600" />
                </span>
                <p className="text-lg font-black text-zinc-300">Aucune enchère trouvée</p>
                <p className="mb-6 mt-1 text-sm text-zinc-600">
                  Essaie d&apos;élargir tes critères de recherche
                </p>
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-red-500 border border-red-500/20 hover:bg-red-500/5 transition"
                >
                  <RotateCcw size={14} /> Effacer tous les filtres
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {auctions.map(auction => {
                  const { beat } = auction
                  const producerName = beat.producer.displayName || beat.producer.name
                  const isPlaying = playingId === auction.id

                  return (
                    <div
                      key={auction.id}
                      className="group overflow-hidden rounded-[22px] border border-white/10 bg-[#101014]/95 shadow-xl shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-red-500/25 hover:shadow-2xl hover:shadow-red-950/10"
                    >
                      {/* Cover */}
                      <div className="relative h-44 overflow-hidden bg-gradient-to-br from-[#1a0a2e] via-[#111111] to-[#0a0a1a]">
                        {beat.coverImage && (
                          <Image
                            src={beat.coverImage}
                            alt={beat.title}
                            fill
                            className="absolute inset-0 object-cover transition duration-500 group-hover:scale-105"
                            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#101014] via-black/10 to-black/20" />

                        {/* License badge */}
                        <div className="absolute right-3 top-3">
                          <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide backdrop-blur-md ${LICENSE_COLORS[auction.licenseType]}`}>
                            {auction.licenseType}
                          </span>
                        </div>

                        {/* Timer */}
                        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[10px] font-bold backdrop-blur-md">
                          <Clock size={10} className="text-red-400" />
                          <CountdownTimer endTime={auction.endTime} size="sm" showIcon={false} />
                        </div>

                        {/* Play button */}
                        <button
                          onClick={() => togglePlay(auction.id, beat.audioUrl)}
                          aria-label={isPlaying ? `Mettre ${beat.title} en pause` : `Écouter ${beat.title}`}
                          className="absolute bottom-3 left-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white text-black shadow-xl transition hover:scale-105"
                        >
                          {isPlaying ? (
                            <Pause size={16} />
                          ) : (
                            <Play size={16} className="ml-0.5" />
                          )}
                        </button>

                        {/* Like button */}
                        <div className="absolute bottom-3 right-3 rounded-full bg-black/40 backdrop-blur-md">
                          <LikeButton beatId={beat.id} initialCount={beat._count.likes} size="sm" showCount={false} />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4">
                        <Link href={`/auction/${auction.id}`}>
                          <h3 className="truncate text-base font-black text-white transition group-hover:text-red-400">
                            {beat.title}
                          </h3>
                        </Link>
                        <Link href={`/producer/${beat.producer.id}`} className="inline-block">
                          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-zinc-500 transition hover:text-zinc-300">
                            {producerName}
                            {beat.producer.producerStatus === 'APPROVED' && <Shield size={10} className="text-red-500" />}
                          </p>
                        </Link>

                        {/* Tags */}
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border border-white/5 bg-white/[0.04] px-2 py-1 text-[9px] font-bold text-zinc-500">{beat.genre}</span>
                          <span className="rounded-full border border-white/5 bg-white/[0.04] px-2 py-1 text-[9px] font-bold text-zinc-500">{beat.bpm} BPM</span>
                          {beat.key && <span className="rounded-full border border-white/5 bg-white/[0.04] px-2 py-1 text-[9px] font-bold text-zinc-500">{beat.key}</span>}
                        </div>

                        {/* Bid info */}
                        <div className="mt-4 flex items-end justify-between border-t border-white/[0.07] pt-4">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">Enchère actuelle</span>
                            <div className="mt-0.5 text-xl font-black text-white">{auction.currentBid} <span className="text-xs text-red-400">EUR</span></div>
                          </div>
                          <Link
                            href={`/auction/${auction.id}`}
                            className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] font-black text-red-400 transition hover:bg-red-500/15"
                          >
                            <Gavel size={12} />
                            Miser
                          </Link>
                        </div>
                        <p className="mt-2 text-[10px] text-zinc-600">
                          {auction._count.bids} enchère{auction._count.bids !== 1 ? 's' : ''} placée
                          {auction._count.bids !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-bold text-zinc-400 transition hover:border-white/20 hover:text-white disabled:opacity-30"
                >
                  Précédent
                </button>
                <span className="text-sm text-zinc-500">
                  Page <strong className="text-white">{page}</strong> / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-bold text-zinc-400 transition hover:border-white/20 hover:text-white disabled:opacity-30"
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
