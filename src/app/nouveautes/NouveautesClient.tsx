'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Loader2,
  ShoppingCart,
  Check,
  AlertCircle,
  Sparkles,
  Crown,
  Star,
  Volume2,
  Clock,
  SlidersHorizontal,
  X,
  ChevronDown,
  ArrowLeft,
} from 'lucide-react'

interface Beat {
  id: string
  title: string
  genre: string
  bpm: number
  key: string | null
  mood: string | null
  duration: number | null
  coverImage: string | null
  audioUrl: string | null
  plays: number
  producer: {
    id: string
    name: string
    displayName: string | null
    avatar: string | null
  }
  basePrice: number // Prix de base (startPrice de la derniere enchere)
}

const BPM_PRESETS = [
  { label: 'Slow', range: '60-90', min: 60, max: 90 },
  { label: 'Medium', range: '90-120', min: 90, max: 120 },
  { label: 'Fast', range: '120-150', min: 120, max: 150 },
  { label: 'Rapide+', range: '150+', min: 150, max: 999 },
]

const MUSICAL_KEYS = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
  'Cm',
  'C#m',
  'Dm',
  'D#m',
  'Em',
  'Fm',
  'F#m',
  'Gm',
  'G#m',
  'Am',
  'A#m',
  'Bm',
]

const LICENSES = [
  {
    id: 'BASIC',
    name: 'Basic',
    icon: Star,
    color: 'from-gray-500 to-gray-600',
    border: 'border-gray-500',
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    multiplier: 1,
    rights: 'WAV + MP3 - 5000 streams - Non-commercial',
    features: ['Format WAV + MP3', '5 000 streams max', 'Usage non-commercial', 'Credit obligatoire'],
  },
  {
    id: 'PREMIUM',
    name: 'Premium',
    icon: Crown,
    color: 'from-[#e11d48] to-[#ff0033]',
    border: 'border-[#e11d48]',
    bg: 'bg-[#e11d48]/10',
    text: 'text-[#e11d48]',
    multiplier: 2.5,
    rights: 'WAV + MP3 - 50K streams - Commercial',
    features: ['Format WAV + MP3', '50 000 streams max', 'Usage commercial', 'Credit obligatoire'],
  },
  {
    id: 'EXCLUSIVE',
    name: 'Exclusive',
    icon: Sparkles,
    color: 'from-amber-500 to-orange-600',
    border: 'border-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    multiplier: 10,
    rights: 'WAV + Stems - Illimite - Droits complets',
    features: ['WAV + Stems + MP3', 'Streams illimites', 'Droits complets', 'Pas de credit requis'],
  },
]

export default function NouveautesClient() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedBeatId = searchParams.get('beat')
  const audioRef = useRef<HTMLAudioElement>(null)
  const beatRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [beats, setBeats] = useState<Beat[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTrack, setCurrentTrack] = useState<number>(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  // Purchase state
  const [selectedBeat, setSelectedBeat] = useState<string | null>(null)
  const [selectedLicense, setSelectedLicense] = useState<string>('BASIC')
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)

  // Filters
  const [bpmPreset, setBpmPreset] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Filtered beats
  const filteredBeats = beats.filter((beat) => {
    // BPM filter
    if (bpmPreset) {
      const preset = BPM_PRESETS.find((p) => p.label === bpmPreset)
      if (preset && (beat.bpm < preset.min || beat.bpm > preset.max)) return false
    }
    // Key filter
    if (selectedKey && beat.key !== selectedKey) return false
    return true
  })

  // Available keys from current beats (for dynamic filter)
  const availableKeys = [...new Set(beats.map((b) => b.key).filter(Boolean))] as string[]

  const activeFilterCount = (bpmPreset ? 1 : 0) + (selectedKey ? 1 : 0)

  function clearFilters() {
    setBpmPreset(null)
    setSelectedKey(null)
  }

  useEffect(() => {
    fetchNouveautes()
  }, [])

  // Pre-select beat from URL param ?beat=ID
  useEffect(() => {
    if (preselectedBeatId && beats.length > 0) {
      const exists = beats.find((b) => b.id === preselectedBeatId)
      if (exists) {
        setSelectedBeat(preselectedBeatId)
        // Scroll to the beat after a short delay for DOM render
        setTimeout(() => {
          const el = beatRefs.current[preselectedBeatId]
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 300)
      }
    }
  }, [preselectedBeatId, beats])

  async function fetchNouveautes() {
    try {
      const res = await fetch('/api/nouveautes')
      if (res.ok) {
        const data = await res.json()
        setBeats(data.beats || [])
      }
    } catch (err) {
      console.error('Erreur chargement nouveautes:', err)
    } finally {
      setLoading(false)
    }
  }

  // Audio player functions — uses index in the beats[] array
  function playTrack(beatIndex: number) {
    if (!audioRef.current) return
    const beat = beats[beatIndex]
    if (!beat) return
    if (!beat.audioUrl) {
      console.warn('Pas d\'audio disponible pour ce beat:', beat.title)
      return
    }

    if (currentTrack === beatIndex && isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }

    // Stop current playback first
    audioRef.current.pause()
    audioRef.current.currentTime = 0

    audioRef.current.src = beat.audioUrl
    audioRef.current.load()

    const playPromise = audioRef.current.play()
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.error('Erreur lecture audio:', err.message, 'URL:', beat.audioUrl?.substring(0, 100))
        setIsPlaying(false)
      })
    }
    setCurrentTrack(beatIndex)
    setIsPlaying(true)
  }

  function nextTrack() {
    const next = currentTrack + 1 < beats.length ? currentTrack + 1 : 0
    playTrack(next)
  }

  function prevTrack() {
    const prev = currentTrack - 1 >= 0 ? currentTrack - 1 : beats.length - 1
    playTrack(prev)
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateProgress = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100)
    }
    const handleEnded = () => nextTrack()

    audio.addEventListener('timeupdate', updateProgress)
    audio.addEventListener('ended', handleEnded)
    return () => {
      audio.removeEventListener('timeupdate', updateProgress)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [currentTrack, beats])

  // Purchase
  async function handlePurchase(beatId: string) {
    if (!session?.user) {
      router.push('/auth/signin')
      return
    }

    setPurchasing(true)
    setPurchaseError(null)

    try {
      const res = await fetch(`/api/beats/${beatId}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseType: selectedLicense }),
      })

      const data = await res.json()

      if (!res.ok) {
        setPurchaseError(data.error || "Erreur lors de l'achat")
        return
      }

      // SECURITY FIX: Stocker le clientSecret en sessionStorage (pas dans l'URL)
      sessionStorage.setItem(`checkout_cs_${beatId}`, data.clientSecret)
      router.push(
        `/checkout/beat/${beatId}?pi=${data.paymentIntentId}&license=${selectedLicense}&price=${data.finalPrice}&title=${encodeURIComponent(data.beatTitle)}`
      )
    } catch {
      setPurchaseError('Erreur de connexion')
    } finally {
      setPurchasing(false)
    }
  }

  function formatDuration(seconds: number | null) {
    if (!seconds) return '--:--'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const currentBeat = currentTrack >= 0 ? beats[currentTrack] : null
  const currentLicenseInfo = LICENSES.find((l) => l.id === selectedLicense)!

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-red-500" size={40} />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-32">
      <audio ref={audioRef} preload="none" />

      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/30 via-[#0a0a0f]/80 to-[#0a0a0f]" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        <div className="relative max-w-6xl mx-auto px-4 pt-12 pb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6 group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Retour a l&apos;accueil
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#e11d48] to-[#ff0033] flex items-center justify-center">
              <Sparkles size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white">Nouveautes</h1>
              <p className="text-sm text-gray-400">Beats disponibles a l&apos;achat direct</p>
            </div>
          </div>
          <p className="text-gray-500 text-sm max-w-2xl">
            Ces beats n&apos;ont pas trouve preneur aux encheres et sont maintenant disponibles a
            l&apos;achat direct avec le choix de ta licence : Basic, Premium ou Exclusive.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="max-w-6xl mx-auto px-4 mt-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle filters button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              activeFilterCount > 0
                ? 'border-[#e11d48] text-[#e11d48] bg-[#e11d48]/10'
                : 'border-[#1e1e2e] text-gray-400 hover:text-white hover:border-[#333]'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filtres
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#e11d48] text-white text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Active filter pills */}
          {bpmPreset && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1e2e] text-xs font-semibold text-white">
              {bpmPreset} ({BPM_PRESETS.find((p) => p.label === bpmPreset)?.range})
              <button onClick={() => setBpmPreset(null)} className="hover:text-red-400 transition">
                <X size={12} />
              </button>
            </span>
          )}
          {selectedKey && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1e2e] text-xs font-semibold text-white">
              Tonalite: {selectedKey}
              <button
                onClick={() => setSelectedKey(null)}
                className="hover:text-red-400 transition"
              >
                <X size={12} />
              </button>
            </span>
          )}
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-red-400 underline underline-offset-2 transition"
            >
              Effacer tout
            </button>
          )}
        </div>

        {/* Expanded Filters Panel */}
        {showFilters && (
          <div className="mt-3 p-4 rounded-2xl bg-[#13131a] border border-[#1e1e2e] space-y-4">
            {/* BPM */}
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">BPM</h4>
              <div className="flex flex-wrap gap-2">
                {BPM_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setBpmPreset(bpmPreset === preset.label ? null : preset.label)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      bpmPreset === preset.label
                        ? 'border-[#e11d48] text-[#e11d48] bg-[#e11d48]/10'
                        : 'border-[#1e1e2e] text-gray-500 hover:text-white hover:border-[#333]'
                    }`}
                  >
                    {preset.label} <span className="text-gray-600 ml-1">{preset.range}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tonalite / Key */}
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Tonalite
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {(availableKeys.length > 0 ? availableKeys.sort() : MUSICAL_KEYS).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSelectedKey(selectedKey === k ? null : k)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      selectedKey === k
                        ? 'border-[#e11d48] text-[#e11d48] bg-[#e11d48]/10'
                        : 'border-[#1e1e2e] text-gray-500 hover:text-white hover:border-[#333]'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4">
        {filteredBeats.length === 0 && beats.length > 0 ? (
          <div className="text-center py-20">
            <SlidersHorizontal size={48} className="mx-auto mb-4 text-gray-700" />
            <h3 className="text-lg font-bold text-white mb-2">
              Aucun beat ne correspond a tes filtres
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Essaie d&apos;ajuster le BPM ou la tonalite
            </p>
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-black"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              Effacer les filtres
            </button>
          </div>
        ) : beats.length === 0 ? (
          <div className="text-center py-20">
            <Music size={48} className="mx-auto mb-4 text-gray-700" />
            <h3 className="text-lg font-bold text-white mb-2">
              Aucun beat disponible pour le moment
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Les beats invendus aux encheres apparaitront ici automatiquement
            </p>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-black"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              Voir les encheres
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* Beat List - Left Side */}
            <div className="lg:col-span-2 space-y-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                  {filteredBeats.length} beat{filteredBeats.length > 1 ? 's' : ''} disponible
                  {filteredBeats.length > 1 ? 's' : ''}
                  {activeFilterCount > 0 && beats.length !== filteredBeats.length && (
                    <span className="text-gray-600 font-normal ml-1">(sur {beats.length})</span>
                  )}
                </h2>
              </div>

              {filteredBeats.map((beat) => {
                const index = beats.findIndex((b) => b.id === beat.id)
                return (
                  <div
                    key={beat.id}
                    ref={(el) => { beatRefs.current[beat.id] = el }}
                    className={`group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedBeat === beat.id
                        ? 'border-[#e11d48] bg-[#e11d48]/5'
                        : currentTrack === index
                          ? 'border-[#1e1e2e] bg-white/[0.02]'
                          : 'border-transparent hover:border-[#1e1e2e] hover:bg-white/[0.01]'
                    }`}
                    onClick={() => setSelectedBeat(selectedBeat === beat.id ? null : beat.id)}
                  >
                    {/* Play Button / Cover */}
                    <div
                      className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        playTrack(index)
                      }}
                    >
                      {beat.coverImage ? (
                        <Image
                          src={beat.coverImage}
                          alt={beat.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#0a0a0f] flex items-center justify-center">
                          <Music size={16} className="text-gray-600" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {currentTrack === index && isPlaying ? (
                          <Pause size={16} className="text-white" />
                        ) : (
                          <Play size={16} className="text-white ml-0.5" />
                        )}
                      </div>
                      {/* Playing indicator */}
                      {currentTrack === index && isPlaying && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#e11d48]">
                          <div className="h-full bg-white/50" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                    </div>

                    {/* Beat Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate">{beat.title}</span>
                        {currentTrack === index && isPlaying && (
                          <Volume2 size={12} className="text-[#e11d48] shrink-0 animate-pulse" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Link
                          href={`/producer/${beat.producer.id}`}
                          className="hover:text-white transition"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {beat.producer.displayName || beat.producer.name}
                        </Link>
                        <span>&bull;</span>
                        <span>{beat.genre}</span>
                        <span>&bull;</span>
                        <span>{beat.bpm} BPM</span>
                        {beat.key && (
                          <>
                            <span>&bull;</span>
                            <span>{beat.key}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="hidden sm:flex items-center gap-1 text-xs text-gray-600">
                      <Clock size={12} />
                      {formatDuration(beat.duration)}
                    </div>

                    {/* Price */}
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-white">{beat.basePrice} EUR</div>
                      <div className="text-[10px] text-gray-600">prix de base</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* License Selector - Right Side */}
            <div className="lg:col-span-1">
              <div className="sticky top-4 space-y-4">
                {/* License Cards */}
                <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-white mb-4">Choisis ta licence</h3>

                  <div className="space-y-3">
                    {LICENSES.map((license) => {
                      const Icon = license.icon
                      const isSelected = selectedLicense === license.id
                      const selectedBeatData = beats.find((b) => b.id === selectedBeat)
                      const price = selectedBeatData
                        ? Math.round(selectedBeatData.basePrice * license.multiplier * 100) / 100
                        : null

                      return (
                        <button
                          key={license.id}
                          onClick={() => setSelectedLicense(license.id)}
                          className={`w-full p-4 rounded-xl border text-left transition-all ${
                            isSelected
                              ? `${license.border} ${license.bg}`
                              : 'border-[#1e1e2e] hover:border-[#2e2e3e]'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div
                              className={`w-8 h-8 rounded-lg bg-gradient-to-br ${license.color} flex items-center justify-center`}
                            >
                              <Icon size={14} className="text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span
                                  className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-300'}`}
                                >
                                  {license.name}
                                </span>
                                {price !== null && (
                                  <span className={`text-sm font-bold ${license.text}`}>
                                    {price} EUR
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-500">
                                x{license.multiplier}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-1 ml-11">
                            {license.features.map((feat, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-1.5 text-[11px] text-gray-500"
                              >
                                <Check
                                  size={10}
                                  className={isSelected ? license.text : 'text-gray-600'}
                                />
                                {feat}
                              </div>
                            ))}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Buy Button */}
                {selectedBeat && (
                  <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-5">
                    {(() => {
                      const beatData = beats.find((b) => b.id === selectedBeat)
                      if (!beatData) return null
                      const finalPrice =
                        Math.round(beatData.basePrice * currentLicenseInfo.multiplier * 100) / 100

                      return (
                        <>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                              {beatData.coverImage ? (
                                <Image
                                  src={beatData.coverImage}
                                  alt=""
                                  width={40}
                                  height={40}
                                  className="object-cover w-full h-full"
                                />
                              ) : (
                                <div className="w-full h-full bg-[#1a1a2e] flex items-center justify-center">
                                  <Music size={14} className="text-gray-600" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-white truncate">
                                {beatData.title}
                              </div>
                              <div className="text-xs text-gray-500">
                                {beatData.producer.displayName || beatData.producer.name}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mb-1 text-xs text-gray-400">
                            <span>Prix de base</span>
                            <span>{beatData.basePrice} EUR</span>
                          </div>
                          <div className="flex items-center justify-between mb-1 text-xs text-gray-400">
                            <span>
                              Licence {currentLicenseInfo.name} (x{currentLicenseInfo.multiplier})
                            </span>
                          </div>
                          <div className="border-t border-[#1e1e2e] my-3" />
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-bold text-white">Total</span>
                            <span className="text-lg font-black text-white">{finalPrice} EUR</span>
                          </div>

                          {purchaseError && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 mb-3">
                              <AlertCircle size={14} className="text-red-400 shrink-0" />
                              <span className="text-xs text-red-400">{purchaseError}</span>
                            </div>
                          )}

                          {purchaseSuccess === selectedBeat ? (
                            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/30">
                              <Check size={16} className="text-green-400" />
                              <span className="text-sm font-bold text-green-400">
                                Redirection vers le paiement...
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handlePurchase(selectedBeat)}
                              disabled={purchasing}
                              className="w-full py-3 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 transition disabled:opacity-50"
                              style={{
                                background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)',
                              }}
                            >
                              {purchasing ? (
                                <>
                                  <Loader2 size={16} className="animate-spin" /> Traitement...
                                </>
                              ) : (
                                <>
                                  <ShoppingCart size={16} /> Acheter - {finalPrice} EUR
                                </>
                              )}
                            </button>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}

                {!selectedBeat && (
                  <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-5 text-center">
                    <Music size={24} className="mx-auto mb-2 text-gray-600" />
                    <p className="text-xs text-gray-500">
                      Selectionne un beat pour voir le prix et acheter
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Audio Player */}
      {currentBeat && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-[#1e1e2e] z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
            {/* Track Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                {currentBeat.coverImage ? (
                  <Image
                    src={currentBeat.coverImage}
                    alt=""
                    width={40}
                    height={40}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full bg-[#1a1a2e] flex items-center justify-center">
                    <Music size={14} className="text-gray-600" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">{currentBeat.title}</div>
                <div className="text-xs text-gray-500">
                  {currentBeat.producer.displayName || currentBeat.producer.name}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button onClick={prevTrack} className="text-gray-400 hover:text-white transition">
                <SkipBack size={18} />
              </button>
              <button
                onClick={() => playTrack(currentTrack)}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center"
              >
                {isPlaying ? (
                  <Pause size={18} className="text-black" />
                ) : (
                  <Play size={18} className="text-black ml-0.5" />
                )}
              </button>
              <button onClick={nextTrack} className="text-gray-400 hover:text-white transition">
                <SkipForward size={18} />
              </button>
            </div>

            {/* Progress */}
            <div className="hidden sm:block flex-1 max-w-xs">
              <div className="w-full h-1 bg-[#1e1e2e] rounded-full">
                <div
                  className="h-full bg-[#e11d48] rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
