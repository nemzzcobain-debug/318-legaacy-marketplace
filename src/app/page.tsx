'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Gavel, TrendingUp, Users, Music, Clock, ArrowRight, Shield, Zap, Flame,
  Play, Pause, Disc, Headphones, Award, BarChart3, ChevronRight, Star,
  UserPlus, Sparkles, Volume2, Timer, BadgeCheck, CircleDollarSign,
  Smartphone, ListMusic, Globe
} from 'lucide-react'
import Image from 'next/image'
import Header from '@/components/layout/Header'
import CountdownTimer from '@/components/ui/CountdownTimer'

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
function AnimatedCounter({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
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
      {prefix}{formatNumber(count)}{suffix}
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
  const [auctions, setAuctions] = useState<LiveAuction[]>([])
  const [homepage, setHomepage] = useState<HomepageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)
  const [heroVisible, setHeroVisible] = useState(false)

  useEffect(() => {
    setHeroVisible(true)
    Promise.all([
      fetch('/api/auctions?status=active&limit=6&sort=most_bids').then(r => r.json()),
      fetch('/api/homepage').then(r => r.json()),
    ])
      .then(([auctionsData, homepageData]) => {
        setAuctions(auctionsData.auctions || [])
        if (homepageData && homepageData.stats) {
          setHomepage(homepageData)
        } else {
          setHomepage({
            stats: { totalBeats: 0, totalAuctions: 0, totalProducers: 0, totalBids: 0, totalCompleted: 0, totalRevenue: 0 },
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
    audio?.pause()
    const newAudio = new Audio(audioUrl)
    newAudio.play()
    newAudio.onended = () => setPlayingId(null)
    setAudio(newAudio)
    setPlayingId(auctionId)
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
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[800px] bg-gradient-radial from-red-600/10 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute top-20 -right-40 w-[600px] h-[600px] bg-gradient-radial from-purple-900/15 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-gradient-radial from-red-900/8 via-transparent to-transparent rounded-full blur-3xl" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        <div className={`max-w-5xl mx-auto text-center relative z-10 transition-all duration-1000 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Logo */}
          <div className="mb-8">
            <Image
              src="/logo-318-marketplace.png"
              alt="318 LEGAACY Marketplace"
              width={180}
              height={180}
              className="mx-auto drop-shadow-[0_0_50px_rgba(225,29,72,0.5)]"
            />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-5 py-2.5 text-sm font-bold text-red-400 mb-8 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            Premiere plateforme d&apos;encheres de beats en France
          </div>

          {/* Main title with staggered animation */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-[0.9] tracking-tight">
            <span className={`inline-block text-white transition-all duration-700 delay-100 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              Encheris.
            </span>{' '}
            <span className={`inline-block bg-gradient-to-r from-red-500 via-red-400 to-red-600 bg-clip-text text-transparent transition-all duration-700 delay-300 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              Remporte.
            </span>
            <br />
            <span className={`inline-block text-white transition-all duration-700 delay-500 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              Cree ton{' '}
            </span>
            <span className={`inline-block relative transition-all duration-700 delay-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <span className="bg-gradient-to-r from-red-500 via-purple-500 to-red-500 bg-clip-text text-transparent bg-[length:200%] animate-gradient-x">
                hit.
              </span>
              <Sparkles className="absolute -top-2 -right-6 text-yellow-400/60 animate-pulse" size={20} />
            </span>
          </h1>

          <p className={`text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed transition-all duration-700 delay-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            Des instrumentales exclusives mises aux encheres par des beatmakers verifies.
            Place ton enchere, decroche le beat, et lance ton prochain son.
          </p>

          {/* CTA Buttons */}
          <div className={`flex gap-4 flex-wrap justify-center transition-all duration-700 delay-[900ms] ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <Link
              href="/marketplace"
              className="group relative px-8 py-4 rounded-2xl font-extrabold text-white text-lg flex items-center gap-2 transition-all hover:scale-105 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 rounded-2xl" />
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-[1px] rounded-2xl" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }} />
              <span className="relative z-10 flex items-center gap-2">
                Explorer les encheres <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
            <Link
              href="/register"
              className="px-8 py-4 rounded-2xl font-extrabold text-white text-lg border-2 border-[#2a2a2a] hover:border-red-500/40 transition-all hover:bg-white/[0.02] backdrop-blur-sm"
            >
              Creer un compte
            </Link>
          </div>

          {/* Mini live stats */}
          {homepage && (
            <div className={`flex items-center justify-center gap-6 md:gap-10 mt-16 transition-all duration-700 delay-[1100ms] ${heroVisible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="flex items-center gap-2 text-sm">
                <div className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </div>
                <span className="text-gray-500"><strong className="text-white">{homepage.stats.totalAuctions}</strong> encheres live</span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <BadgeCheck size={16} className="text-red-500" />
                <span className="text-gray-500"><strong className="text-white">{homepage.stats.totalProducers}</strong> producteurs</span>
              </div>
              <div className="hidden md:flex items-center gap-2 text-sm">
                <Gavel size={14} className="text-red-500" />
                <span className="text-gray-500"><strong className="text-white">{homepage.stats.totalBids}</strong> encheres placees</span>
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
                  <span className="text-[10px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">{genre.count}</span>
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
                <span className="text-sm font-bold text-red-500 uppercase tracking-wider">En direct</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white">Encheres en cours</h2>
            </div>
            <Link href="/marketplace" className="text-sm font-bold text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors">
              Voir tout <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-[#111] rounded-2xl h-72 animate-pulse border border-[#222]" />
              ))}
            </div>
          ) : auctions.length === 0 ? (
            <div className="text-center py-20 bg-[#111] rounded-2xl border border-[#222]">
              <Gavel size={48} className="text-gray-700 mx-auto mb-4" />
              <p className="text-gray-400 text-lg font-bold">Aucune enchere en cours</p>
              <p className="text-gray-600 text-sm mt-1">Les prochaines encheres arrivent bientot</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {auctions.map((auction) => (
                <Link
                  key={auction.id}
                  href={`/auction/${auction.id}`}
                  className="group bg-[#111] rounded-2xl border border-[#1e1e2e] hover:border-red-500/30 transition-all overflow-hidden hover:-translate-y-1 duration-300"
                >
                  {/* Cover */}
                  <div className="relative h-28 bg-gradient-to-br from-[#1a0a2e] via-[#111] to-[#0a0a1a] overflow-hidden">
                    {auction.beat.coverImage && (
                      <img src={auction.beat.coverImage} alt={auction.beat.title} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 group-hover:scale-105 transition-all duration-500" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/50 to-transparent" />

                    <div className="absolute top-3 right-3">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${licenseColors[auction.licenseType] || licenseColors.BASIC}`}>
                        {auction.licenseType}
                      </span>
                    </div>

                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1">
                      <Timer size={11} className="text-red-500" />
                      <CountdownTimer endTime={auction.endTime} size="sm" showIcon={false} />
                    </div>

                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePlay(auction.id, auction.beat.audioUrl) }}
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-red-900/40 hover:scale-110 transition-transform z-10 border-4 border-[#111]"
                      style={{ background: 'linear-gradient(135deg, #e11d48 0%, #9f1239 100%)' }}
                    >
                      {playingId === auction.id
                        ? <Pause size={18} className="text-white" fill="white" />
                        : <Play size={18} className="text-white ml-0.5" fill="white" />
                      }
                    </button>
                  </div>

                  <div className="px-5 pt-10 pb-5">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <h3 className="text-white font-extrabold text-base truncate group-hover:text-red-400 transition-colors">
                        {auction.beat.title}
                      </h3>
                      <WaveformVisual active={playingId === auction.id} />
                    </div>
                    <p className="text-gray-500 text-xs text-center mb-4">
                      {auction.beat.producer.displayName || auction.beat.producer.name} · {auction.beat.bpm} BPM{auction.beat.key ? ` · ${auction.beat.key}` : ''}
                    </p>

                    <div className="flex items-center justify-center gap-2 mb-4">
                      <span className="text-[10px] font-bold text-gray-500 bg-white/5 rounded-full px-3 py-1">{auction.beat.genre}</span>
                    </div>

                    <div className="flex items-end justify-between pt-3 border-t border-[#1e1e2e]">
                      <div>
                        <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">Enchere actuelle</span>
                        <div className="text-2xl font-black text-white">{auction.currentBid}&euro;</div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Gavel size={11} /> {auction.totalBids} enchere{auction.totalBids > 1 ? 's' : ''}
                        </div>
                        <div className="text-[10px] text-gray-600 mt-0.5">Depart: {auction.startPrice}&euro;</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {auctions.length > 0 && (
            <div className="text-center mt-10">
              <Link href="/marketplace" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-red-400 border border-red-500/20 hover:bg-red-500/5 transition-all hover:border-red-500/40">
                Voir toutes les encheres <ChevronRight size={16} />
              </Link>
            </div>
          )}
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
                  <span className="text-sm font-bold text-yellow-400/80 uppercase tracking-wider">Beatmakers</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white">Producteurs vedettes</h2>
              </div>
              <Link href="/producers" className="text-sm font-bold text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                Voir tous <ArrowRight size={14} />
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
                        <img src={producer.avatar} alt={producer.name} className="w-full h-full object-cover" />
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

                  <h3 className="text-sm font-extrabold text-white truncate group-hover:text-red-400 transition-colors">{producer.name}</h3>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <BadgeCheck size={12} className="text-red-500" />
                    <span className="text-[10px] text-gray-500">Verifie</span>
                  </div>
                  <div className="flex items-center justify-center gap-3 mt-3 text-[10px] text-gray-500">
                    <span className="flex items-center gap-0.5"><Disc size={9} /> {producer.totalBeats}</span>
                    <span className="flex items-center gap-0.5"><Users size={9} /> {producer.totalFollowers}</span>
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
                <BarChart3 size={14} /> Les chiffres
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-3">318 LEGAACY en chiffres</h2>
              <p className="text-gray-500 max-w-lg mx-auto">La marketplace de beats qui fait bouger la scene francaise</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {[
                { label: 'Beats disponibles', value: homepage.stats.totalBeats, icon: Disc, gradient: 'from-red-500/20 to-red-900/5', border: 'border-red-500/15', iconColor: 'text-red-500' },
                { label: 'Producteurs verifies', value: homepage.stats.totalProducers, icon: BadgeCheck, gradient: 'from-purple-500/20 to-purple-900/5', border: 'border-purple-500/15', iconColor: 'text-purple-400' },
                { label: 'Encheres placees', value: homepage.stats.totalBids, icon: Gavel, gradient: 'from-blue-500/20 to-blue-900/5', border: 'border-blue-500/15', iconColor: 'text-blue-400' },
                { label: 'Ventes realisees', value: homepage.stats.totalCompleted, icon: TrendingUp, gradient: 'from-green-500/20 to-green-900/5', border: 'border-green-500/15', iconColor: 'text-green-400' },
              ].map(({ label, value, icon: Icon, gradient, border, iconColor }) => (
                <div key={label} className={`bg-gradient-to-br ${gradient} rounded-2xl border ${border} p-6 text-center hover:scale-105 transition-transform duration-300`}>
                  <div className={`w-12 h-12 rounded-xl bg-black/30 flex items-center justify-center ${iconColor} mx-auto mb-3`}>
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
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Comment ca marche</h2>
            <p className="text-gray-500 max-w-lg mx-auto">En 3 etapes simples, tu peux remporter le beat de tes reves</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '01', icon: <UserPlus size={24} />, title: 'Cree ton compte', desc: 'Inscris-toi gratuitement en 30 secondes et accede a toutes les encheres de la plateforme.' },
              { step: '02', icon: <Gavel size={24} />, title: 'Place ton enchere', desc: 'Ecoute les beats, choisis ta licence (Basic, Premium, Exclusive) et encheris en temps reel.' },
              { step: '03', icon: <Music size={24} />, title: 'Telecharge ton beat', desc: 'Tu as gagne ? Paye en ligne et recois tes fichiers audio instantanement.' },
            ].map((item) => (
              <div key={item.step} className="relative group bg-[#111] rounded-2xl border border-[#222] p-7 hover:border-red-500/20 transition-all hover:-translate-y-1 duration-300">
                <span className="text-6xl font-black text-red-500/[0.07] absolute top-4 right-5 select-none">{item.step}</span>
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
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500/30 border border-red-500/20" />
                {i < 2 && <div className="w-16 h-[2px] bg-gradient-to-r from-red-500/20 to-red-500/5" />}
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
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Pourquoi 318 LEGAACY</h2>
            <p className="text-gray-500 max-w-lg mx-auto">Une plateforme concue pour les artistes et les beatmakers</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { icon: <BadgeCheck size={22} />, title: 'Producteurs verifies', desc: 'Chaque beatmaker est valide par notre equipe avant de pouvoir vendre sur la plateforme.', color: 'bg-blue-500/10 text-blue-400' },
              { icon: <Timer size={22} />, title: 'Anti-snipe integre', desc: 'Le timer est prolonge de 2 minutes si une enchere tombe dans les derniers instants.', color: 'bg-orange-500/10 text-orange-400' },
              { icon: <Zap size={22} />, title: 'Encheres temps reel', desc: 'Les encheres se mettent a jour instantanement grace a la technologie Supabase Realtime.', color: 'bg-purple-500/10 text-purple-400' },
              { icon: <CircleDollarSign size={22} />, title: 'Paiement securise', desc: 'Stripe gere tous les paiements. Le producteur recoit 85%, la plateforme prend 15%.', color: 'bg-green-500/10 text-green-400' },
              { icon: <Smartphone size={22} />, title: 'Application mobile PWA', desc: 'Installe la marketplace sur ton telephone et accede a tes encheres partout.', color: 'bg-cyan-500/10 text-cyan-400' },
              { icon: <ListMusic size={22} />, title: 'Playlists & Collections', desc: 'Organise tes beats favoris en playlists et ecoute-les avec le lecteur integre.', color: 'bg-pink-500/10 text-pink-400' },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 bg-[#111] rounded-2xl border border-[#222] p-5 hover:border-red-500/20 transition-all hover:-translate-y-0.5 duration-300">
                <div className={`w-11 h-11 rounded-xl ${item.color} flex items-center justify-center shrink-0`}>
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
            <Flame size={12} /> Rejoins la communaute
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white mb-5">
            Pret a encherir ?
          </h2>
          <p className="text-gray-400 mb-10 text-lg max-w-xl mx-auto">
            Rejoins la communaute 318 LEGAACY et decroche des beats exclusifs directement aupres des meilleurs producteurs
          </p>
          <div className="flex gap-4 flex-wrap justify-center">
            <Link
              href="/register"
              className="group relative px-8 py-4 rounded-2xl font-extrabold text-white text-lg transition-all hover:scale-105 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 rounded-2xl" />
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative z-10">Creer mon compte gratuit</span>
            </Link>
            <Link
              href="/marketplace"
              className="px-8 py-4 rounded-2xl font-extrabold text-white text-lg border-2 border-[#2a2a2a] hover:border-red-500/40 transition-all backdrop-blur-sm"
            >
              Voir les encheres
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
              />
              <div>
                <span className="font-extrabold text-base text-white">318 LEGAACY</span>
                <span className="block text-[9px] text-red-500 -mt-0.5 tracking-[3px] font-semibold">MARKETPLACE</span>
              </div>
            </div>

            <div className="flex gap-8 text-sm">
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Plateforme</h4>
                <Link href="/marketplace" className="block text-gray-400 hover:text-white transition-colors">Marketplace</Link>
                <Link href="/producers" className="block text-gray-400 hover:text-white transition-colors">Producteurs</Link>
                <Link href="/playlists" className="block text-gray-400 hover:text-white transition-colors">Playlists</Link>
              </div>
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Compte</h4>
                <Link href="/register" className="block text-gray-400 hover:text-white transition-colors">S&apos;inscrire</Link>
                <Link href="/login" className="block text-gray-400 hover:text-white transition-colors">Connexion</Link>
                <Link href="/profile/edit" className="block text-gray-400 hover:text-white transition-colors">Mon Profil</Link>
              </div>
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Aide</h4>
                <Link href="/faq" className="block text-gray-400 hover:text-white transition-colors">Comment ca marche</Link>
                <Link href="/stats" className="block text-gray-400 hover:text-white transition-colors">Statistiques</Link>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#1a1a1a]">
            <div className="flex flex-wrap items-center justify-center gap-4 mb-4 text-xs">
              <Link href="/mentions-legales" className="text-gray-500 hover:text-gray-300 transition-colors">Mentions legales</Link>
              <span className="text-gray-700">|</span>
              <Link href="/cgv" className="text-gray-500 hover:text-gray-300 transition-colors">CGV</Link>
              <span className="text-gray-700">|</span>
              <Link href="/confidentialite" className="text-gray-500 hover:text-gray-300 transition-colors">Confidentialite</Link>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-gray-600">&copy; 2026 318 LEGAACY Studio — Tous droits reserves</p>
              <p className="text-xs text-gray-600 flex items-center gap-1">
                <Globe size={10} /> Premiere plateforme d&apos;encheres de beats en France
              </p>
            </div>
          </div>
        </div>
      </footer>
      </main>

      {/* ═══════════ CSS ANIMATIONS ═══════════ */}
      <style jsx global>{`
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.2; }
          25% { transform: translateY(-30px) translateX(10px); opacity: 0.5; }
          50% { transform: translateY(-60px) translateX(-10px); opacity: 0.3; }
          75% { transform: translateY(-30px) translateX(15px); opacity: 0.4; }
        }
        @keyframes waveform {
          0%, 100% { height: 4px; }
          50% { height: 14px; }
        }
        @keyframes gradient-x {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-x {
          animation: gradient-x 3s ease infinite;
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
