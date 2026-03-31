'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Gavel, TrendingUp, Users, Music, Clock, ArrowRight, Shield, Zap, Flame,
  Play, Pause, Disc, Headphones, Award, BarChart3, ChevronRight, Star,
  UserPlus
} from 'lucide-react'
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
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          const duration = 1500
          const steps = 40
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
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K'
    return n.toLocaleString('fr-FR')
  }

  return (
    <div ref={ref} className="text-3xl md:text-4xl font-black text-white">
      {formatNumber(count)}{suffix}
    </div>
  )
}

export default function Home() {
  const [auctions, setAuctions] = useState<LiveAuction[]>([])
  const [homepage, setHomepage] = useState<HomepageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/auctions?status=active&limit=6&sort=most_bids').then(r => r.json()),
      fetch('/api/homepage').then(r => r.json()),
    ])
      .then(([auctionsData, homepageData]) => {
        setAuctions(auctionsData.auctions || [])
        setHomepage(homepageData)
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

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative overflow-hidden pt-20 pb-28 px-4">
        {/* Animated background glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-gradient-radial from-red-600/8 via-transparent to-transparent rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-40 -right-20 w-[500px] h-[500px] bg-gradient-radial from-purple-900/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] bg-gradient-radial from-red-900/5 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* Floating music notes decoration */}
        <div className="absolute top-32 left-[10%] text-red-500/10 animate-bounce" style={{ animationDuration: '3s' }}>
          <Music size={40} />
        </div>
        <div className="absolute top-48 right-[15%] text-purple-500/10 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>
          <Headphones size={36} />
        </div>
        <div className="absolute bottom-20 left-[20%] text-red-500/5 animate-bounce" style={{ animationDuration: '5s', animationDelay: '0.5s' }}>
          <Disc size={32} />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-5 py-2 text-sm font-bold text-red-500 mb-8 backdrop-blur-sm">
            <Zap size={14} className="animate-pulse" /> Premiere plateforme d&apos;encheres de beats en France
          </div>

          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-[0.95]">
            <span className="text-white">Encheris.</span>{' '}
            <span className="bg-gradient-to-r from-red-500 via-red-600 to-red-700 bg-clip-text text-transparent">Remporte.</span><br />
            <span className="text-white">Cree ton </span>
            <span className="bg-gradient-to-r from-red-500 to-purple-600 bg-clip-text text-transparent">hit.</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Des instrumentales exclusives mises aux encheres par des beatmakers verifies.
            Place ton enchere, decroche le beat, et lance ton prochain son.
          </p>

          <div className="flex gap-4 flex-wrap justify-center">
            <Link
              href="/marketplace"
              className="group px-8 py-4 rounded-xl font-extrabold text-black text-lg flex items-center gap-2 transition-all hover:scale-105 shadow-lg shadow-red-900/30"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              Explorer les encheres <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/register"
              className="px-8 py-4 rounded-xl font-extrabold text-white text-lg border-2 border-[#333] hover:border-red-500/50 transition-all hover:bg-white/[0.02]"
            >
              Creer un compte
            </Link>
          </div>

          {/* Mini stats under hero */}
          {homepage && (
            <div className="flex items-center justify-center gap-8 mt-14 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span><strong className="text-white">{homepage.stats.totalAuctions}</strong> encheres en cours</span>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <Shield size={14} className="text-red-500" />
                <span><strong className="text-white">{homepage.stats.totalProducers}</strong> producteurs verifies</span>
              </div>
              <div className="hidden md:flex items-center gap-2">
                <Gavel size={14} className="text-red-500" />
                <span><strong className="text-white">{homepage.stats.totalBids}</strong> encheres placees</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════ GENRES RAPIDES ═══════════ */}
      {homepage && homepage.topGenres.length > 0 && (
        <section className="px-4 pb-12">
          <div className="max-w-6xl mx-auto">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {homepage.topGenres.map(genre => (
                <Link
                  key={genre.name}
                  href={`/marketplace?genre=${encodeURIComponent(genre.name)}`}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#111111] border border-[#222222] text-sm font-bold text-gray-300 whitespace-nowrap hover:border-red-500/30 hover:text-white transition-all shrink-0"
                >
                  <Music size={13} className="text-red-500" />
                  {genre.name}
                  <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded-full">{genre.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ LIVE AUCTIONS ═══════════ */}
      <section className="px-4 pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-bold text-red-500 uppercase tracking-wider">En direct</span>
              </div>
              <h2 className="text-3xl font-black text-white">Encheres en cours</h2>
            </div>
            <Link
              href="/marketplace"
              className="text-sm font-bold text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
            >
              Voir tout <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-[#111111] rounded-2xl h-64 animate-pulse border border-[#222222]" />
              ))}
            </div>
          ) : auctions.length === 0 ? (
            <div className="text-center py-16 bg-[#111111] rounded-2xl border border-[#222222]">
              <Gavel size={48} className="text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg font-bold">Aucune enchere en cours</p>
              <p className="text-gray-600 text-sm mt-1">Les prochaines encheres arrivent bientot</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {auctions.map((auction, index) => (
                <Link
                  key={auction.id}
                  href={`/auction/${auction.id}`}
                  className={`group bg-[#111111] rounded-2xl border border-[#222222] hover:border-red-500/30 transition-all overflow-hidden ${
                    index === 0 ? 'md:col-span-2 lg:col-span-1' : ''
                  }`}
                >
                  {/* Cover / gradient header */}
                  <div className="relative h-24 bg-gradient-to-br from-[#1a0a2e] via-[#111111] to-[#0a0a1a] overflow-hidden">
                    {auction.beat.coverImage && (
                      <img
                        src={auction.beat.coverImage}
                        alt={auction.beat.title}
                        className="absolute inset-0 w-full h-full object-cover opacity-30"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111111] to-transparent" />

                    {/* License badge */}
                    <div className="absolute top-3 right-3">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        auction.licenseType === 'EXCLUSIVE'
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : auction.licenseType === 'PREMIUM'
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {auction.licenseType}
                      </span>
                    </div>

                    {/* Timer */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
                      <Clock size={11} className="text-red-500" />
                      <CountdownTimer endTime={auction.endTime} size="sm" showIcon={false} />
                    </div>

                    {/* Play button centered */}
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        togglePlay(auction.id, auction.beat.audioUrl)
                      }}
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-14 h-14 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-900/40 hover:scale-110 transition-transform z-10 border-4 border-[#111111]"
                    >
                      {playingId === auction.id
                        ? <Pause size={20} className="text-white" />
                        : <Play size={20} className="text-white ml-0.5" />
                      }
                    </button>
                  </div>

                  {/* Beat info */}
                  <div className="px-5 pt-10 pb-5">
                    <h3 className="text-white font-extrabold text-base truncate group-hover:text-red-500 transition-colors text-center mb-1">
                      {auction.beat.title}
                    </h3>
                    <p className="text-gray-500 text-xs text-center mb-4">
                      {auction.beat.producer.displayName || auction.beat.producer.name} · {auction.beat.bpm} BPM{auction.beat.key ? ` · ${auction.beat.key}` : ''}
                    </p>

                    {/* Genre + mood tags */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <span className="text-[10px] font-bold text-gray-500 bg-white/5 rounded-full px-3 py-1">{auction.beat.genre}</span>
                    </div>

                    {/* Bid info */}
                    <div className="flex items-end justify-between pt-3 border-t border-[#1e1e2e]">
                      <div>
                        <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">Enchere actuelle</span>
                        <div className="text-2xl font-black text-white">{auction.currentBid}&euro;</div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Gavel size={11} /> {auction.totalBids} enchere{auction.totalBids > 1 ? 's' : ''}
                        </div>
                        <div className="text-[10px] text-gray-600 mt-0.5">
                          Depart: {auction.startPrice}&euro;
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* View all CTA */}
          {auctions.length > 0 && (
            <div className="text-center mt-8">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-red-500 border border-red-500/20 hover:bg-red-500/5 transition-all"
              >
                Voir toutes les encheres <ChevronRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════ FEATURED PRODUCERS ═══════════ */}
      {homepage && homepage.featuredProducers.length > 0 && (
        <section className="px-4 py-20 border-t border-[#1a1a1a]">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Star size={14} className="text-yellow-400" />
                  <span className="text-sm font-bold text-yellow-400/80 uppercase tracking-wider">Beatmakers</span>
                </div>
                <h2 className="text-3xl font-black text-white">Producteurs vedettes</h2>
              </div>
              <Link
                href="/producers"
                className="text-sm font-bold text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
              >
                Voir tous <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {homepage.featuredProducers.map(producer => (
                <Link
                  key={producer.id}
                  href={`/producer/${producer.id}`}
                  className="group bg-[#111111] border border-[#222222] rounded-2xl p-5 text-center hover:border-red-500/30 transition-all hover:-translate-y-1"
                >
                  {/* Avatar */}
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-2xl font-black text-white mb-3 group-hover:scale-110 transition-transform shadow-lg">
                    {producer.avatar ? (
                      <img src={producer.avatar} alt={producer.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      producer.name[0].toUpperCase()
                    )}
                  </div>

                  <h3 className="text-sm font-extrabold text-white truncate group-hover:text-red-500 transition-colors">
                    {producer.name}
                  </h3>

                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Shield size={10} className="text-red-500" />
                    <span className="text-[10px] text-gray-500">Verifie</span>
                  </div>

                  {/* Mini stats */}
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
        <section className="px-4 py-20 border-t border-[#1a1a1a] relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-red-900/5 via-transparent to-transparent pointer-events-none" />

          <div className="max-w-5xl mx-auto relative z-10">
            <h2 className="text-3xl font-black text-white text-center mb-3">318 LEGAACY en chiffres</h2>
            <p className="text-gray-500 text-center mb-12 max-w-lg mx-auto">
              La marketplace de beats qui fait bouger la scene francaise
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {[
                {
                  label: 'Beats disponibles',
                  value: homepage.stats.totalBeats,
                  icon: Disc,
                  color: 'from-red-500/20 to-red-900/10 border-red-500/20',
                  iconColor: 'text-red-500',
                },
                {
                  label: 'Producteurs verifies',
                  value: homepage.stats.totalProducers,
                  icon: Shield,
                  color: 'from-purple-500/20 to-purple-900/10 border-purple-500/20',
                  iconColor: 'text-purple-400',
                },
                {
                  label: 'Encheres placees',
                  value: homepage.stats.totalBids,
                  icon: Gavel,
                  color: 'from-blue-500/20 to-blue-900/10 border-blue-500/20',
                  iconColor: 'text-blue-400',
                },
                {
                  label: 'Ventes realisees',
                  value: homepage.stats.totalCompleted,
                  icon: TrendingUp,
                  color: 'from-green-500/20 to-green-900/10 border-green-500/20',
                  iconColor: 'text-green-400',
                },
              ].map(({ label, value, icon: Icon, color, iconColor }) => (
                <div
                  key={label}
                  className={`bg-gradient-to-br ${color} rounded-2xl border p-6 text-center`}
                >
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
      <section className="px-4 py-20 border-t border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-white text-center mb-4">Comment ca marche</h2>
          <p className="text-gray-500 text-center mb-12 max-w-lg mx-auto">
            En 3 etapes simples, tu peux remporter le beat de tes reves
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                icon: <UserPlus size={24} />,
                title: 'Cree ton compte',
                desc: 'Inscris-toi gratuitement en 30 secondes et accede a toutes les encheres.',
              },
              {
                step: '02',
                icon: <Gavel size={24} />,
                title: 'Place ton enchere',
                desc: 'Ecoute les beats, choisis ta licence et encheris en temps reel.',
              },
              {
                step: '03',
                icon: <Music size={24} />,
                title: 'Telecharge ton beat',
                desc: 'Tu as gagne ? Paye en ligne et recois ton fichier instantanement.',
              },
            ].map((item) => (
              <div key={item.step} className="bg-[#111111] rounded-2xl border border-[#222222] p-6 relative group hover:border-red-500/20 transition-all hover:-translate-y-1">
                <span className="text-5xl font-black text-red-500/10 absolute top-4 right-5">{item.step}</span>
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
                  {item.icon}
                </div>
                <h3 className="text-lg font-extrabold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Connecting dots */}
          <div className="hidden md:flex justify-center mt-6 gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500/30" />
            <div className="w-8 h-0.5 bg-red-500/20 mt-0.5" />
            <div className="w-2 h-2 rounded-full bg-red-500/30" />
            <div className="w-8 h-0.5 bg-red-500/20 mt-0.5" />
            <div className="w-2 h-2 rounded-full bg-red-500/30" />
          </div>
        </div>
      </section>

      {/* ═══════════ WHY 318 LEGAACY ═══════════ */}
      <section className="px-4 py-20 border-t border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-white text-center mb-12">Pourquoi 318 LEGAACY</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                icon: <Shield size={22} />,
                title: 'Producteurs verifies',
                desc: 'Chaque beatmaker est valide par notre equipe avant de pouvoir vendre.',
              },
              {
                icon: <Flame size={22} />,
                title: 'Anti-snipe integre',
                desc: 'Le timer est prolonge de 2 minutes si une enchere tombe dans les derniers instants.',
              },
              {
                icon: <TrendingUp size={22} />,
                title: 'Encheres en temps reel',
                desc: 'Les encheres se mettent a jour instantanement grace au temps reel.',
              },
              {
                icon: <Zap size={22} />,
                title: 'Paiement securise',
                desc: 'Stripe gere tous les paiements. Le producteur recoit 85%, la plateforme 15%.',
              },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 bg-[#111111] rounded-2xl border border-[#222222] p-5 hover:border-red-500/20 transition-all">
                <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
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

      {/* ═══════════ CTA ═══════════ */}
      <section className="px-4 py-20 border-t border-[#1a1a1a] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-red-900/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            Pret a encherir ?
          </h2>
          <p className="text-gray-400 mb-8 text-lg">
            Rejoins la communaute 318 LEGAACY et decroche des beats exclusifs
          </p>
          <div className="flex gap-4 flex-wrap justify-center">
            <Link
              href="/register"
              className="px-8 py-4 rounded-xl font-extrabold text-black text-lg transition-all hover:scale-105 shadow-lg shadow-red-900/30"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              Creer mon compte gratuit
            </Link>
            <Link
              href="/marketplace"
              className="px-8 py-4 rounded-xl font-extrabold text-white text-lg border-2 border-[#333] hover:border-red-500/50 transition-all"
            >
              Voir les encheres
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="border-t border-[#1a1a1a] px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-8">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-base text-black"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                3
              </div>
              <div>
                <span className="font-extrabold text-base text-white">318 LEGAACY</span>
                <span className="block text-[9px] text-red-500 -mt-0.5 tracking-[3px] font-semibold">MARKETPLACE</span>
              </div>
            </div>

            {/* Links */}
            <div className="flex gap-8 text-sm">
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Plateforme</h4>
                <Link href="/marketplace" className="block text-gray-400 hover:text-white transition-colors">Marketplace</Link>
                <Link href="/producers" className="block text-gray-400 hover:text-white transition-colors">Producteurs</Link>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Compte</h4>
                <Link href="/register" className="block text-gray-400 hover:text-white transition-colors">S&apos;inscrire</Link>
                <Link href="/login" className="block text-gray-400 hover:text-white transition-colors">Connexion</Link>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Aide</h4>
                <Link href="/faq" className="block text-gray-400 hover:text-white transition-colors">Comment ca marche</Link>
                <Link href="/faq" className="block text-gray-400 hover:text-white transition-colors">FAQ</Link>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#1a1a1a] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-700">&copy; 2026 318 LEGAACY Studio — Tous droits reserves</p>
            <p className="text-xs text-gray-700">Premiere plateforme d&apos;encheres de beats en France</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
