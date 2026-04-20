'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Gavel,
  TrendingUp,
  Users,
  Music,
  Clock,
  ArrowRight,
  Shield,
  Zap,
  Flame,
  Play,
  Pause,
  Disc,
  Headphones,
  Award,
  BarChart3,
  ChevronRight,
  Star,
  UserPlus,
  Sparkles,
  Crown,
  Volume2,
  Timer,
  BadgeCheck,
  CircleDollarSign,
  Smartphone,
  ListMusic,
  Globe,
} from 'lucide-react'
import Image from 'next/image'
import Header from '@/components/layout/Header'
import CountdownTimer from '@/components/ui/CountdownTimer'
import { useTranslation } from '@/i18n/LanguageContext'

interface LiveAuction {
  id: string
  currentBid: number
  startPrice: number
  totalBids: number
  status: string
  endTime: string
  licenseType: string
  beat: {
    title: string
    genre: string
    bpm: number
    key: string | null
    audioUrl: string
    coverImage: string | null
    producer: {
      id: string
      name: string
      displayName: string | null
      avatar: string | null
    }
  }
}

interface HomepageData {
  stats: {
    totalBeats: number
    totalAuctions: number
    totalProducers: number
    totalBids: number
    totalCompleted: number
    totalRevenue: number
  }
  featuredProducers: {
    id: string
    name: string
    avatar: string | null
    bio: string | null
    totalSales: number
    totalBeats: number
    totalFollowers: number
  }[]
  topGenres: { name: string; count: number }[]
}

// ─── Animated Counter ───
function AnimatedCounter({
  target,
  suffix = '',
  prefix = '',
}: {
  target: number
  suffix?: string
  prefix?: string
}) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          const duration = 2000
          const steps = 50
          const increment = target / steps
          let current = 0
          const timer = setInterval(() => {
            current += increment
            if (current >= target) {
              setCount(target)
              clearInterval(timer)
            } else {
              setCount(Math.floor(current))
            }
          }, duration / steps)
        }
      },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  const formatNumber = (n: number) => {
    if (n >= 10000) return (n / 1000).toFixed(0) + 'K'
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K'
    return n.toLocaleString('fr-FR')
  }

  return (
    <div ref={ref} className="text-3xl md:text-4xl font-black text-white">
      {prefix}
      {formatNumber(count)}
      {suffix}
    </div>
  )
}

// ─── Floating Particle ───
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-red-500/20"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float-particle ${8 + Math.random() * 12}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Waveform Visual ───
function WaveformVisual({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full transition-all ${active ? 'bg-red-500' : 'bg-gray-700'}`}
          style={{
            height: active ? `${8 + Math.random() * 12}px` : '4px',
            animation: active ? `waveform 0.8s ease-in-out infinite ${i * 0.1}s` : 'none',
          }}
        />
      ))}
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const [auctions, setAuctions] = useState<LiveAuction[]>([])
  const [homepage, setHomepage] = useState<HomepageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)
  const [heroVisible, setHeroVisible] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    setHeroVisible(true)
    Promise.all([
      fetch('/api/auctions?status=active&limit=6&sort=most_bids').then((r) => r.json()),
      fetch('/api/homepage').then((r) => r.json()),
    ])
      .then(([auctionsData, homepageData]) => {
        setAuctions(auctionsData.auctions || [])
        if (homepageData && homepageData.stats) {
          setHomepage(homepageData)
        } else {
          setHomepage({
            stats: {
              totalBeats: 0,
              totalAuctions: 0,
              totalProducers: 0,
              totalBids: 0,
              totalCompleted: 0,
              totalRevenue: 0,
            },
            featuredProducers: [],
            topGenres: [],
          })
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const togglePlay = (auctionId: string, audioUrl: string) => {
    if (playingId === auctionId) {
      audio?.pause()
      setPlayingId(null)
      return
    }
    if (audio) {
      audio.pause()
      audio.src = ''
    }
    const newAudio = new Audio(audioUrl)
    newAudio.crossOrigin = 'anonymous'
    newAudio.onended = () => setPlayingId(null)
    newAudio.onerror = () => {
      console.error('Erreur audio:', audioUrl)
      setPlayingId(null)
    }
    setAudio(newAudio)
    setPlayingId(auctionId)
    newAudio.play().catch((err) => {
      console.error('Play bloque:', err)
      setPlayingId(null)
    })
  }

  const licenseColors: Record<string, string> = {
    EXCLUSIVE: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    PREMIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    BASIC: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main id="main-content">
        {/* ═══════════ HERO ═══════════ */}
        <section className="relative overflow-hidden pt-24 pb-32 px-4">
          <FloatingParticles />

          {/* Animated background */}
          <div className="absolute inset-0">
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[800px] bg-gradient-radial from-red-600/10 via-transparent to-transparent rounded-full blur-3xl animate-pulse"
              style={{ animationDuration: '4s' }}
            />
            <div
              className="absolute top-20 -right-40 w-[600px] h-[600px] bg-gradient-radial from-purple-900/15 via-transparent to-transparent rounded-full blur-3xl animate-pulse"
              style={{ animationDuration: '6s' }}
            />
            <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-gradient-radial from-red-900/8 via-transparent to-transparent rounded-full blur-3xl" />
            {/* Grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
              }}
            />
          </div>

          <div
            className={`max-w-5xl mx-auto text-center relative z-10 transition-all duration-1000 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {/* Logo */}
            <div className="mb-8">
              <Image
                src="/logo-318-marketplace.png"
                alt="318 LEGAACY Marketplace"
                width={180}
                height={180}
                className="mx-auto drop-shadow-[0_0_50px_rgba(225,29,72,0.5)]"
                style={{
                  maskImage: 'radial-gradient(circle, white 40%, transparent 75%)',
                  WebkitMaskImage: 'radial-gradient(circle, white 40%, transparent 75%)',
                }}
              />
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-5 py-2.5 text-sm font-bold text-red-400 mb-8 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              {t('hero.badge')}
            </div>

            {/* Main title with staggered animation */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-[0.9] tracking-tight">
              <span
                className={`inline-block text-white transition-all duration-700 delay-100 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              >
                {t('hero.title1')}
              </span>{' '}
              <span
                className={`inline-block bg-gradient-to-r from-red-500 via-red-400 to-red-600 bg-clip-text text-transparent transition-all duration-700 delay-300 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              >
                {t('hero.title2')}
              </span>
              <br />
              <span
                className={`inline-block text-white transition-all duration-700 delay-500 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              >
                {t('hero.title3')}
              </span>{' '}
              <span
                className={`inline-block relative transition-all duration-700 delay-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              >
                <span className="bg-gradient-to-r from-red-500 via-purple-500 to-red-500 bg-clip-text text-transparent bg-[length:200%] animate-gradient-x">
                  {t('hero.title4')}
                </span>
                <Sparkles
                  className="absolute -top-2 -right-6 text-yellow-400/60 animate-pulse"
                  size={20}
                />
              </span>
            </h1>

            <p
              className={`text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed transition-all duration-700 delay-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              {t('hero.subtitle')}
            </p>

            {/* CTA Buttons */}
            <div
              className={`flex gap-4 flex-wrap justify-center transition-all duration-700 delay-[900ms] ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              <Link
                href="/marketplace"
                className="group relative px-8 py-4 rounded-2xl font-extrabold text-white text-lg flex items-center gap-2 transition-all hover:scale-105 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 rounded-2xl" />
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div
                  className="absolute inset-[1px] rounded-2xl"
                  style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}
                />
                <span className="relative z-10 flex items-center gap-2">
                  {t('hero.cta')}{' '}
                  <ArrowRight
                    size={20}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </span>
              </Link>
              <Link
                href="/register"
                className="px-8 py-4 rounded-2xl font-extrabold text-white text-lg border-2 border-[#2a2a2a] hover:border-red-500/40 transition-all hover:bg-white/[0.02] backdrop-blur-sm"
              >
                {t('hero.ctaSecondary')}
              </Link>
            </div>

            {/* Mini live stats */}
            {homepage && (
              <div
                className={`flex items-center justify-center gap-6 md:gap-10 mt-16 transition-all duration-700 delay-[1100ms] ${heroVisible ? 'opacity-100' : 'opacity-0'}`}
              >
                <div className="flex items-center gap-2 text-sm">
                  <div className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </div>
                  <span className="text-gray-500">
                    <strong className="text-white">{homepage.stats.totalAuctions}</strong>{' '}
                    {t('hero.liveAuctions')}
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-sm">
                  <BadgeCheck size={16} className="text-red-500" />
                  <span className="text-gray-500">
                    <strong className="text-white">{homepage.stats.totalProducers}</strong>{' '}
                    {t('hero.producers')}
                  </span>
                </div>
                <div className="hidden md:flex items-center gap-2 text-sm">
                  <Gavel size={14} className="text-red-500" />
                  <span className="text-gray-500">
                    <strong className="text-white">{homepage.stats.totalBids}</strong>{' '}
                    {t('hero.bidsPlaced')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ═══════════ GENRES SCROLL ═══════════ */}
        {homepage && homepage.topGenres.length > 0 && (
          <section className="px-4 pb-16 -mt-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {homepage.topGenres.map((genre, i) => (
                  <Link
                    key={genre.name}
                    href={`/marketplace?genre=${encodeURIComponent(genre.name)}`}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#111] border border-[#222] text-sm font-bold text-gray-300 whitespace-nowrap hover:border-red-500/30 hover:text-white hover:bg-red-500/5 transition-all shrink-0"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <Music size={13} className="text-red-500" />
                    {genre.name}
                    <span className="text-[10px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">
                      {genre.count}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ═══════════ LIVE AUCTIONS ═══════════ */}
        <section className="px-4 pb-24">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                  <span className="text-sm font-bold text-red-500 uppercase tracking-wider">
                    {t('liveAuctions.live')}
                  </span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white">
                  {t('liveAuctions.title')}
                </h2>
              </div>
              <Link
                href="/marketplace"
                className="text-sm font-bold text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
              >
                {t('liveAuctions.viewAll')} <ArrowRight size={14} />
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-[#111] rounded-2xl h-72 animate-pulse border border-[#222]"
                  />
                ))}
              </div>
            ) : auctions.length === 0 ? (
              <div className="text-center py-20 bg-[#111] rounded-2xl border border-[#222]">
                <Gavel size={48} className="text-gray-700 mx-auto mb-4" />
                <p className="text-gray-400 text-lg font-bold">{t('liveAuctions.noAuctions')}</p>
                <p className="text-gray-600 text-sm mt-1">{t('liveAuctions.comingSoon')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {auctions.map((auction) => (
                  <div
                    key={auction.id}
                    onClick={() => router.push(`/auction/${auction.id}`)}
                    className="group relative bg-[#111] rounded-2xl border border-[#1e1e2e] hover:border-red-500/30 transition-all hover:-translate-y-1 duration-300 cursor-pointer"
                  >
                    {/* Cover + Play button wrapper */}
                    <div className="relative">
                      <div className="relative h-28 bg-gradient-to-br from-[#1a0a2e] via-[#111] to-[#0a0a1a] overflow-hidden rounded-t-2xl">
                        {auction.beat.coverImage && (
                          <Image
                            src={auction.beat.coverImage}
                            alt={auction.beat.title}
                            fill
                            className="absolute inset-0 object-cover opacity-40 group-hover:opacity-50 group-hover:scale-105 transition-all duration-500"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/50 to-transparent" />

                        <div className="absolute top-3 right-3">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${licenseColors[auction.licenseType] || licenseColors.BASIC}`}
                          >
                            {auction.licenseType}
                          </span>
                        </div>

                        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1">
                          <Timer size={11} className="text-red-500" />
                          <CountdownTimer endTime={auction.endTime} size="sm" showIcon={false} />
                        </div>
                      </div>

                      {/* Play button - outside overflow-hidden */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          e.nativeEvent.stopImmediatePropagation()
                          togglePlay(auction.id, auction.beat.audioUrl)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            e.stopPropagation()
                            togglePlay(auction.id, auction.beat.audioUrl)
                          }
                        }}
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-red-900/40 hover:scale-110 transition-transform z-20 border-4 border-[#111] cursor-pointer"
                        style={{ background: 'linear-gradient(135deg, #e11d48 0%, #9f1239 100%)' }}
                      >
                        {playingId === auction.id ? (
                          <Pause size={18} className="text-white" fill="white" />
                        ) : (
                          <Play size={18} className="text-white ml-0.5" fill="white" />
                        )}
                      </div>
                    </div>

                    <div className="px-5 pt-10 pb-5">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <h3 className="text-white font-extrabold text-base truncate group-hover:text-red-400 transition-colors">
                          {auction.beat.title}
                        </h3>
                        <WaveformVisual active={playingId === auction.id} />
                      </div>
                      <p className="text-gray-500 text-xs text-center mb-4">
                        {auction.beat.producer.displayName || auction.beat.producer.name} ·{' '}
                        {auction.beat.bpm} BPM{auction.beat.key ? ` · ${auction.beat.key}` : ''}
                      </p>

                      <div className="flex items-center justify-center gap-2 mb-4">
                        <span className="text-[10px] font-bold text-gray-500 bg-white/5 rounded-full px-3 py-1">
                          {auction.beat.genre}
                        </span>
                      </div>

                      <div className="flex items-end justify-between pt-3 border-t border-[#1e1e2e]">
                        <div>
                          <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">
                            {t('liveAuctions.currentBid')}
                          </span>
                          <div className="text-2xl font-black text-white">
                            {auction.currentBid}&euro;
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Gavel size={11} /> {auction.totalBids}{' '}
                            {auction.totalBids > 1 ? t('liveAuctions.bids') : t('liveAuctions.bid')}
                          </div>
                          <div className="text-[10px] text-gray-600 mt-0.5">
                            {t('liveAuctions.startPrice')} : {auction.startPrice}&euro;
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {auctions.length > 0 && (
              <div className="text-center mt-10">
                <Link
                  href="/marketplace"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-red-400 border border-red-500/20 hover:bg-red-500/5 transition-all hover:border-red-500/40"
                >
                  {t('liveAuctions.viewAllBtn')} <ChevronRight size={16} />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ═══════════ SELECTION DE LA SEMAINE ═══════════ */}
        <section className="px-4 py-24 border-t border-[#1a1a1a] relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-radial from-[#E50914]/15 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-radial from-[#E50914]/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-5xl mx-auto relative z-10">
            {/* Header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-[#E50914]/10 border border-[#E50914]/20 rounded-full px-4 py-1.5 text-xs font-bold text-[#E50914] mb-4">
                <Flame size={12} className="animate-pulse" /> {t('weeklySelection.badge')}
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-2">
                {t('weeklySelection.title')}
              </h2>
              <p className="text-gray-500 max-w-md mx-auto text-sm">
                {t('weeklySelection.subtitle')}
              </p>
            </div>

            {/* Weekly Beat Card */}
            {(() => {
              // Find the weekly auction (longest running, or first active)
              const weeklyAuction = auctions.length > 0 ? auctions[0] : null

              if (!weeklyAuction) {
                return (
                  <div className="relative bg-gradient-to-br from-[#1a0808] via-[#111] to-[#0a0a1a] rounded-3xl border border-[#E50914]/20 overflow-hidden">
                    <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5" />
                    <div className="relative z-10 py-20 text-center">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#E50914]/20 to-[#B20710]/20 flex items-center justify-center mx-auto mb-5 border border-[#E50914]/20">
                        <Clock size={32} className="text-[#E50914]" />
                      </div>
                      <h3 className="text-xl font-extrabold text-white mb-2">
                        {t('weeklySelection.comingSoon')}
                      </h3>
                      <p className="text-gray-500 text-sm max-w-sm mx-auto">
                        {t('weeklySelection.comingSoonDesc')}
                      </p>
                      <Link
                        href="/register"
                        className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl font-bold text-sm text-[#E50914] border border-[#E50914]/20 hover:bg-[#E50914]/5 transition-all hover:border-[#E50914]/40"
                      >
                        {t('weeklySelection.enableNotifs')} <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                )
              }

              return (
                <div className="relative bg-gradient-to-br from-[#1a0808] via-[#111] to-[#0a0a1a] rounded-3xl border border-[#E50914]/20 overflow-hidden group">
                  {/* Animated border glow */}
                  <div className="absolute -inset-[1px] bg-gradient-to-r from-[#E50914]/30 via-[#B20710]/30 to-[#E50914]/30 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-sm" />

                  <div className="relative z-10 bg-gradient-to-br from-[#1a0808] via-[#111] to-[#0a0a1a] rounded-3xl">
                    <div className="grid md:grid-cols-2 gap-0">
                      {/* Left: Cover & Audio */}
                      <div className="relative min-h-[320px] md:min-h-[400px] overflow-hidden rounded-t-3xl md:rounded-l-3xl md:rounded-tr-none">
                        {weeklyAuction.beat.coverImage ? (
                          <Image
                            src={weeklyAuction.beat.coverImage}
                            alt={weeklyAuction.beat.title}
                            fill
                            className="object-cover opacity-40 group-hover:opacity-50 group-hover:scale-105 transition-all duration-700"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-[#E50914]/40 via-[#B20710]/20 to-[#111]" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#111] hidden md:block" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent md:hidden" />

                        {/* Badge "Selection" */}
                        <div className="absolute top-5 left-5 flex items-center gap-2">
                          <span className="bg-gradient-to-r from-[#E50914] to-[#B20710] text-white text-[10px] font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg shadow-[#E50914]/40">
                            {t('weeklySelection.badge')}
                          </span>
                        </div>

                        {/* License badge */}
                        <div className="absolute top-5 right-5">
                          <span
                            className={`text-[11px] font-bold px-3 py-1.5 rounded-full border backdrop-blur-sm ${licenseColors[weeklyAuction.licenseType] || licenseColors.BASIC}`}
                          >
                            {weeklyAuction.licenseType}
                          </span>
                        </div>

                        {/* Play button center */}
                        <button
                          onClick={() => togglePlay(weeklyAuction.id, weeklyAuction.beat.audioUrl)}
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full flex items-center justify-center shadow-2xl shadow-[#E50914]/50 hover:scale-110 transition-transform z-10 border-2 border-white/10 backdrop-blur-sm"
                          style={{
                            background: 'linear-gradient(135deg, #E50914 0%, #B20710 100%)',
                          }}
                        >
                          {playingId === weeklyAuction.id ? (
                            <Pause size={28} className="text-white" fill="white" />
                          ) : (
                            <Play size={28} className="text-white ml-1" fill="white" />
                          )}
                        </button>

                        {/* Waveform bottom */}
                        <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3">
                          <WaveformVisual active={playingId === weeklyAuction.id} />
                          <div className="h-[2px] flex-1 bg-gradient-to-r from-[#E50914]/40 via-[#E50914]/20 to-transparent rounded-full" />
                        </div>
                      </div>

                      {/* Right: Info */}
                      <div className="p-8 md:p-10 flex flex-col justify-center">
                        {/* Genre tags */}
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-[10px] font-bold text-[#E50914] bg-[#E50914]/10 rounded-full px-3 py-1 border border-[#E50914]/20">
                            {weeklyAuction.beat.genre}
                          </span>
                          <span className="text-[10px] font-bold text-gray-500 bg-white/5 rounded-full px-3 py-1">
                            {weeklyAuction.beat.bpm} BPM
                          </span>
                          {weeklyAuction.beat.key && (
                            <span className="text-[10px] font-bold text-gray-500 bg-white/5 rounded-full px-3 py-1">
                              {weeklyAuction.beat.key}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="text-2xl md:text-3xl font-black text-white mb-2 group-hover:text-[#ff4d4d] transition-colors">
                          {weeklyAuction.beat.title}
                        </h3>

                        {/* Producer */}
                        <div className="flex items-center gap-2 mb-6">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#E50914] to-[#B20710] flex items-center justify-center text-[10px] font-bold text-white overflow-hidden">
                            {weeklyAuction.beat.producer.avatar ? (
                              <Image
                                src={weeklyAuction.beat.producer.avatar}
                                alt={weeklyAuction.beat.producer.name}
                                width={24}
                                height={24}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              weeklyAuction.beat.producer.name[0].toUpperCase()
                            )}
                          </div>
                          <span className="text-sm text-gray-400 font-semibold">
                            {weeklyAuction.beat.producer.displayName ||
                              weeklyAuction.beat.producer.name}
                          </span>
                          <BadgeCheck size={14} className="text-[#E50914]" />
                        </div>

                        {/* Timer */}
                        <div className="bg-black/40 rounded-2xl border border-[#E50914]/10 p-5 mb-6">
                          <div className="flex items-center gap-2 mb-3">
                            <Timer size={14} className="text-[#E50914]" />
                            <span className="text-xs font-bold text-[#E50914] uppercase tracking-wider">
                              {t('weeklySelection.timeRemaining')}
                            </span>
                          </div>
                          <div className="text-2xl font-black text-white">
                            <CountdownTimer
                              endTime={weeklyAuction.endTime}
                              size="lg"
                              showIcon={false}
                            />
                          </div>
                        </div>

                        {/* Price & Bids */}
                        <div className="flex items-end justify-between mb-6 pb-5 border-b border-[#222]">
                          <div>
                            <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold block mb-1">
                              {t('weeklySelection.currentBid')}
                            </span>
                            <div className="text-3xl md:text-4xl font-black text-white">
                              {weeklyAuction.currentBid}&euro;
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-1">
                              <Gavel size={14} /> {weeklyAuction.totalBids}{' '}
                              {weeklyAuction.totalBids > 1
                                ? t('liveAuctions.bids')
                                : t('liveAuctions.bid')}
                            </div>
                            <div className="text-xs text-gray-600">
                              {t('weeklySelection.startPrice')} : {weeklyAuction.startPrice}&euro;
                            </div>
                          </div>
                        </div>

                        {/* CTA */}
                        <Link
                          href={`/auction/${weeklyAuction.id}`}
                          className="group/btn relative w-full py-4 rounded-2xl font-extrabold text-white text-center text-lg transition-all hover:scale-[1.02] overflow-hidden block"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-[#E50914] to-[#B20710] rounded-2xl" />
                          <div className="absolute inset-0 bg-gradient-to-r from-[#E50914] to-[#B20710] rounded-2xl opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            {t('weeklySelection.placeBid')} <ArrowRight size={18} />
                          </span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </section>

        {/* ═══════════ NOUVEAUTES SECTION ═══════════ */}
        <section className="px-4 py-20 border-t border-[#1a1a1a] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-[500px] h-[400px] bg-gradient-radial from-[#e11d48]/8 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-6xl mx-auto relative z-10">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Left: Text content */}
              <div>
                <div className="inline-flex items-center gap-2 bg-[#e11d48]/10 border border-[#e11d48]/20 rounded-full px-4 py-1.5 text-xs font-bold text-[#e11d48] mb-5">
                  <Sparkles size={12} /> Nouveautes
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                  Beats en achat
                  <br />
                  <span className="text-[#e11d48]">direct</span>
                </h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-md">
                  Des beats qui n&apos;ont pas trouve preneur aux encheres sont maintenant
                  disponibles a l&apos;achat immediat. Choisis ta licence et telecharge ton beat en
                  quelques clics.
                </p>
                <div className="flex flex-wrap gap-3 mb-8">
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/5 rounded-lg px-3 py-2">
                    <Star size={12} className="text-gray-400" /> Licence Basic
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/5 rounded-lg px-3 py-2">
                    <Crown size={12} className="text-[#e11d48]" /> Licence Premium
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/5 rounded-lg px-3 py-2">
                    <Sparkles size={12} className="text-amber-400" /> Licence Exclusive
                  </div>
                </div>
                <Link
                  href="/nouveautes"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-black transition-transform hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                >
                  Decouvrir les nouveautes <ArrowRight size={16} />
                </Link>
              </div>

              {/* Right: Visual card stack */}
              <div className="relative hidden md:block">
                <div className="absolute -top-10 -right-10 w-64 h-64 bg-gradient-radial from-[#e11d48]/10 via-transparent to-transparent rounded-full blur-2xl" />

                {/* Stacked cards effect */}
                <div className="relative">
                  {/* Background card 3 */}
                  <div className="absolute top-8 left-8 right-0 h-48 bg-[#13131a] rounded-2xl border border-[#1e1e2e] transform rotate-3 opacity-30" />
                  {/* Background card 2 */}
                  <div className="absolute top-4 left-4 right-2 h-48 bg-[#15151f] rounded-2xl border border-[#1e1e2e] transform rotate-1.5 opacity-50" />
                  {/* Main card */}
                  <div className="relative bg-gradient-to-br from-[#13131a] to-[#0d0d14] rounded-2xl border border-[#1e1e2e] p-6 hover:border-[#e11d48]/30 transition-colors">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#e11d48] to-[#ff0033] flex items-center justify-center">
                        <Music size={24} className="text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Achat immediat</div>
                        <div className="text-xs text-gray-500">Prix fixes &middot; 3 licences</div>
                      </div>
                    </div>

                    {/* Fake beat rows */}
                    <div className="space-y-2.5">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02]"
                        >
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1a1a2e] to-[#0a0a0f] flex items-center justify-center shrink-0">
                            <Play size={10} className="text-white ml-0.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div
                              className={`h-2.5 rounded-full bg-white/10 ${i === 1 ? 'w-3/4' : i === 2 ? 'w-1/2' : 'w-2/3'}`}
                            />
                            <div className="h-2 rounded-full bg-white/5 w-1/3 mt-1.5" />
                          </div>
                          <div className="text-xs font-bold text-[#e11d48]">
                            {i === 1 ? '25€' : i === 2 ? '40€' : '30€'}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-[#1e1e2e] flex items-center justify-between">
                      <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">
                        Beats disponibles
                      </span>
                      <span className="text-xs font-bold text-[#e11d48]">Voir tout →</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ DEVENIR BEATMAKER SECTION ═══════════ */}
        <section className="px-4 py-20 border-t border-[#1a1a1a] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[400px] bg-gradient-radial from-[#e11d48]/8 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-6xl mx-auto relative z-10">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Left: Visual card stack */}
              <div className="relative hidden md:block">
                <div className="absolute -top-10 -left-10 w-64 h-64 bg-gradient-radial from-[#e11d48]/10 via-transparent to-transparent rounded-full blur-2xl" />

                {/* Stacked cards effect */}
                <div className="relative">
                  {/* Background card 3 */}
                  <div className="absolute top-8 left-0 right-8 h-48 bg-[#13131a] rounded-2xl border border-[#1e1e2e] transform -rotate-3 opacity-30" />
                  {/* Background card 2 */}
                  <div className="absolute top-4 left-2 right-4 h-48 bg-[#15151f] rounded-2xl border border-[#1e1e2e] transform -rotate-1.5 opacity-50" />
                  {/* Main card */}
                  <div className="relative bg-gradient-to-br from-[#13131a] to-[#0d0d14] rounded-2xl border border-[#1e1e2e] p-6 hover:border-[#e11d48]/30 transition-colors">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#e11d48] to-[#ff0033] flex items-center justify-center">
                        <Headphones size={24} className="text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Dashboard Producteur</div>
                        <div className="text-xs text-gray-500">
                          Upload &middot; Encheres &middot; Revenus
                        </div>
                      </div>
                    </div>

                    {/* Fake stats */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      {[
                        { label: 'Beats', value: '12' },
                        { label: 'Ventes', value: '8' },
                        { label: 'Revenus', value: '2.4k€' },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="bg-white/[0.03] rounded-xl p-3 text-center"
                        >
                          <div className="text-sm font-extrabold text-white">{stat.value}</div>
                          <div className="text-[10px] text-gray-600 mt-0.5">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Upload CTA */}
                    <Link
                      href="/producers"
                      className="block border-2 border-dashed border-[#1e1e2e] rounded-xl p-4 text-center hover:border-[#e11d48]/30 hover:bg-[#e11d48]/5 transition-all"
                    >
                      <Music size={20} className="mx-auto mb-2 text-gray-600" />
                      <div className="text-xs text-gray-500 font-semibold">Drop ton beat ici</div>
                      <div className="text-[10px] text-gray-700 mt-1">
                        WAV, MP3 &middot; Max 50MB
                      </div>
                    </Link>

                    <div className="mt-4 pt-4 border-t border-[#1e1e2e] flex items-center justify-between">
                      <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">
                        Stripe Connect
                      </span>
                      <span className="text-[10px] font-bold text-[#2ed573]">● Actif</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Text content */}
              <div>
                <div className="inline-flex items-center gap-2 bg-[#e11d48]/10 border border-[#e11d48]/20 rounded-full px-4 py-1.5 text-xs font-bold text-[#e11d48] mb-5">
                  <Music size={12} /> Beatmaker
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                  Vends tes beats
                  <br />
                  <span className="text-[#e11d48]">aux encheres</span>
                </h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-md">
                  Rejoins la communaute 318 LEGAACY en tant que producteur. Upload tes beats, lance
                  des encheres et recois 85% de chaque vente directement sur ton compte via Stripe.
                </p>
                <div className="flex flex-wrap gap-3 mb-8">
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/5 rounded-lg px-3 py-2">
                    <TrendingUp size={12} className="text-[#2ed573]" /> 85% des revenus
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/5 rounded-lg px-3 py-2">
                    <Gavel size={12} className="text-[#e11d48]" /> Systeme d&apos;encheres
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/5 rounded-lg px-3 py-2">
                    <Zap size={12} className="text-amber-400" /> Paiements auto
                  </div>
                </div>
                <Link
                  href="/producers"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-black transition-transform hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                >
                  Devenir producteur <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ FEATURED PRODUCERS ═══════════ */}
        {homepage && homepage.featuredProducers.length > 0 && (
          <section className="px-4 py-24 border-t border-[#1a1a1a] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-radial from-purple-900/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Star size={14} className="text-yellow-400" />
                    <span className="text-sm font-bold text-yellow-400/80 uppercase tracking-wider">
                      {t('featuredProducers.badge')}
                    </span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black text-white">
                    {t('featuredProducers.title')}
                  </h2>
                </div>
                <Link
                  href="/producers"
                  className="text-sm font-bold text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                >
                  {t('featuredProducers.viewAll')} <ArrowRight size={14} />
                </Link>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {homepage.featuredProducers.map((producer, i) => (
                  <Link
                    key={producer.id}
                    href={`/producer/${producer.id}`}
                    className="group bg-[#111] border border-[#222] rounded-2xl p-5 text-center hover:border-red-500/30 transition-all hover:-translate-y-2 duration-300"
                  >
                    <div className="relative w-16 h-16 mx-auto mb-3">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-2xl font-black text-white group-hover:scale-110 transition-transform duration-300 shadow-lg overflow-hidden">
                        {producer.avatar ? (
                          <Image
                            src={producer.avatar}
                            alt={producer.name}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          producer.name[0].toUpperCase()
                        )}
                      </div>
                      {i < 3 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                          <Award size={10} className="text-black" />
                        </div>
                      )}
                    </div>

                    <h3 className="text-sm font-extrabold text-white truncate group-hover:text-red-400 transition-colors">
                      {producer.name}
                    </h3>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <BadgeCheck size={12} className="text-red-500" />
                      <span className="text-[10px] text-gray-500">
                        {t('featuredProducers.verified')}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-3 mt-3 text-[10px] text-gray-500">
                      <span className="flex items-center gap-0.5">
                        <Disc size={9} /> {producer.totalBeats}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Users size={9} /> {producer.totalFollowers}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ═══════════ PLATFORM STATS ═══════════ */}
        {homepage && (
          <section className="px-4 py-24 border-t border-[#1a1a1a] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-red-900/5 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-red-900/8 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-5xl mx-auto relative z-10">
              <div className="text-center mb-14">
                <div className="inline-flex items-center gap-2 text-sm font-bold text-red-400 mb-3">
                  <BarChart3 size={14} /> {t('stats.badge')}
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
                  {t('stats.title')}
                </h2>
                <p className="text-gray-500 max-w-lg mx-auto">{t('stats.subtitle')}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {[
                  {
                    label: t('stats.availableBeats'),
                    value: homepage.stats.totalBeats,
                    icon: Disc,
                    gradient: 'from-red-500/20 to-red-900/5',
                    border: 'border-red-500/15',
                    iconColor: 'text-red-500',
                  },
                  {
                    label: t('stats.verifiedProducers'),
                    value: homepage.stats.totalProducers,
                    icon: BadgeCheck,
                    gradient: 'from-purple-500/20 to-purple-900/5',
                    border: 'border-purple-500/15',
                    iconColor: 'text-purple-400',
                  },
                  {
                    label: t('stats.bidsPlaced'),
                    value: homepage.stats.totalBids,
                    icon: Gavel,
                    gradient: 'from-blue-500/20 to-blue-900/5',
                    border: 'border-blue-500/15',
                    iconColor: 'text-blue-400',
                  },
                  {
                    label: t('stats.salesCompleted'),
                    value: homepage.stats.totalCompleted,
                    icon: TrendingUp,
                    gradient: 'from-green-500/20 to-green-900/5',
                    border: 'border-green-500/15',
                    iconColor: 'text-green-400',
                  },
                ].map(({ label, value, icon: Icon, gradient, border, iconColor }) => (
                  <div
                    key={label}
                    className={`bg-gradient-to-br ${gradient} rounded-2xl border ${border} p-6 text-center hover:scale-105 transition-transform duration-300`}
                  >
                    <div
                      className={`w-12 h-12 rounded-xl bg-black/30 flex items-center justify-center ${iconColor} mx-auto mb-3`}
                    >
                      <Icon size={24} />
                    </div>
                    <AnimatedCounter target={value} />
                    <div className="text-xs text-gray-400 mt-1 font-semibold">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ═══════════ HOW IT WORKS ═══════════ */}
        <section className="px-4 py-24 border-t border-[#1a1a1a]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
                {t('howItWorks.title')}
              </h2>
              <p className="text-gray-500 max-w-lg mx-auto">{t('howItWorks.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  step: '01',
                  icon: <UserPlus size={24} />,
                  title: t('howItWorks.step1Title'),
                  desc: t('howItWorks.step1Desc'),
                },
                {
                  step: '02',
                  icon: <Gavel size={24} />,
                  title: t('howItWorks.step2Title'),
                  desc: t('howItWorks.step2Desc'),
                },
                {
                  step: '03',
                  icon: <Music size={24} />,
                  title: t('howItWorks.step3Title'),
                  desc: t('howItWorks.step3Desc'),
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="relative group bg-[#111] rounded-2xl border border-[#222] p-7 hover:border-red-500/20 transition-all hover:-translate-y-1 duration-300"
                >
                  <span className="text-6xl font-black text-red-500/[0.07] absolute top-4 right-5 select-none">
                    {item.step}
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 mb-5 group-hover:scale-110 transition-transform">
                    {item.icon}
                  </div>
                  <h3 className="text-lg font-extrabold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Step connectors */}
            <div className="hidden md:flex justify-center mt-8 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500/30 border border-red-500/20" />
                  {i < 2 && (
                    <div className="w-16 h-[2px] bg-gradient-to-r from-red-500/20 to-red-500/5" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ WHY 318 LEGAACY ═══════════ */}
        <section className="px-4 py-24 border-t border-[#1a1a1a] relative overflow-hidden">
          <div className="absolute top-20 left-0 w-[300px] h-[300px] bg-gradient-radial from-red-900/5 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-5xl mx-auto relative z-10">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
                {t('why318.title')}
              </h2>
              <p className="text-gray-500 max-w-lg mx-auto">{t('why318.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                {
                  icon: <BadgeCheck size={22} />,
                  title: t('why318.verifiedProducers'),
                  desc: t('why318.verifiedProducersDesc'),
                  color: 'bg-blue-500/10 text-blue-400',
                },
                {
                  icon: <Timer size={22} />,
                  title: t('why318.antiSnipe'),
                  desc: t('why318.antiSnipeDesc'),
                  color: 'bg-orange-500/10 text-orange-400',
                },
                {
                  icon: <Zap size={22} />,
                  title: t('why318.realtime'),
                  desc: t('why318.realtimeDesc'),
                  color: 'bg-purple-500/10 text-purple-400',
                },
                {
                  icon: <CircleDollarSign size={22} />,
                  title: t('why318.securePayment'),
                  desc: t('why318.securePaymentDesc'),
                  color: 'bg-green-500/10 text-green-400',
                },
                {
                  icon: <Smartphone size={22} />,
                  title: t('why318.mobileApp'),
                  desc: t('why318.mobileAppDesc'),
                  color: 'bg-cyan-500/10 text-cyan-400',
                },
                {
                  icon: <ListMusic size={22} />,
                  title: t('why318.playlists'),
                  desc: t('why318.playlistsDesc'),
                  color: 'bg-pink-500/10 text-pink-400',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex gap-4 bg-[#111] rounded-2xl border border-[#222] p-5 hover:border-red-500/20 transition-all hover:-translate-y-0.5 duration-300"
                >
                  <div
                    className={`w-11 h-11 rounded-xl ${item.color} flex items-center justify-center shrink-0`}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ CTA FINAL ═══════════ */}
        <section className="px-4 py-24 border-t border-[#1a1a1a] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-red-900/8 via-transparent to-transparent pointer-events-none" />
          <FloatingParticles />

          <div className="max-w-3xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-1.5 text-xs font-bold text-red-400 mb-6">
              <Flame size={12} /> {t('ctaFinal.badge')}
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-5">
              {t('ctaFinal.title')}
            </h2>
            <p className="text-gray-400 mb-10 text-lg max-w-xl mx-auto">{t('ctaFinal.subtitle')}</p>
            <div className="flex gap-4 flex-wrap justify-center">
              <Link
                href="/register"
                className="group relative px-8 py-4 rounded-2xl font-extrabold text-white text-lg transition-all hover:scale-105 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 rounded-2xl" />
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative z-10">{t('ctaFinal.cta')}</span>
              </Link>
              <Link
                href="/marketplace"
                className="px-8 py-4 rounded-2xl font-extrabold text-white text-lg border-2 border-[#2a2a2a] hover:border-red-500/40 transition-all backdrop-blur-sm"
              >
                {t('ctaFinal.ctaSecondary')}
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════ FOOTER ═══════════ */}
        <footer className="border-t border-[#1a1a1a] px-4 py-14">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-10">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/logo-318-marketplace.png"
                  alt="318 LEGAACY Marketplace"
                  width={72}
                  height={72}
                  className="rounded-lg"
                  style={{
                    maskImage: 'radial-gradient(circle, white 40%, transparent 75%)',
                    WebkitMaskImage: 'radial-gradient(circle, white 40%, transparent 75%)',
                  }}
                />
                <div>
                  <span className="font-extrabold text-base text-white">318 LEGAACY</span>
                  <span className="block text-[9px] text-red-500 -mt-0.5 tracking-[3px] font-semibold">
                    MARKETPLACE
                  </span>
                </div>
              </div>

              <div className="flex gap-8 text-sm">
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {t('footer.platform')}
                  </h4>
                  <Link
                    href="/marketplace"
                    className="block text-gray-400 hover:text-white transition-colors"
                  >
                    {t('footer.marketplace')}
                  </Link>
                  <Link
                    href="/producers"
                    className="block text-gray-400 hover:text-white transition-colors"
                  >
                    {t('footer.producers')}
                  </Link>
                  <Link
                    href="/playlists"
                    className="block text-gray-400 hover:text-white transition-colors"
                  >
                    {t('footer.playlists')}
                  </Link>
                </div>
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {t('footer.account')}
                  </h4>
                  <Link
                    href="/register"
                    className="block text-gray-400 hover:text-white transition-colors"
                  >
                    {t('footer.register')}
                  </Link>
                  <Link
                    href="/login"
                    className="block text-gray-400 hover:text-white transition-colors"
                  >
                    {t('footer.login')}
                  </Link>
                  <Link
                    href="/profile/edit"
                    className="block text-gray-400 hover:text-white transition-colors"
                  >
                    {t('footer.profile')}
                  </Link>
                </div>
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {t('footer.help')}
                  </h4>
                  <Link
                    href="/faq"
                    className="block text-gray-400 hover:text-white transition-colors"
                  >
                    {t('footer.howItWorks')}
                  </Link>
                  <Link
                    href="/stats"
                    className="block text-gray-400 hover:text-white transition-colors"
                  >
                    {t('footer.statistics')}
                  </Link>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-[#1a1a1a]">
              <div className="flex flex-wrap items-center justify-center gap-4 mb-4 text-xs">
                <Link
                  href="/mentions-legales"
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {t('footer.legalNotice')}
                </Link>
                <span className="text-gray-700">|</span>
                <Link href="/cgv" className="text-gray-500 hover:text-gray-300 transition-colors">
                  {t('footer.terms')}
                </Link>
                <span className="text-gray-700">|</span>
                <Link
                  href="/confidentialite"
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {t('footer.privacy')}
                </Link>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-gray-600">{t('footer.copyright')}</p>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <Globe size={10} /> {t('footer.tagline')}
                </p>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* ═══════════ CSS ANIMATIONS ═══════════ */}
      <style jsx global>{`
        @keyframes float-particle {
          0%,
          100% {
            transform: translateY(0) translateX(0);
            opacity: 0.2;
          }
          25% {
            transform: translateY(-30px) translateX(10px);
            opacity: 0.5;
          }
          50% {
            transform: translateY(-60px) translateX(-10px);
            opacity: 0.3;
          }
          75% {
            transform: translateY(-30px) translateX(15px);
            opacity: 0.4;
          }
        }
        @keyframes waveform {
          0%,
          100% {
            height: 4px;
          }
          50% {
            height: 14px;
          }
        }
        @keyframes gradient-x {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        .animate-gradient-x {
          animation: gradient-x 3s ease infinite;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
