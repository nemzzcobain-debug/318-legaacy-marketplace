'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Gavel, TrendingUp, Users, Music, Clock, ArrowRight, Shield, Zap, Flame, Play, Pause } from 'lucide-react'
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
      name: string
      displayName: string | null
      avatar: string | null
    }
  }
}

export default function Home() {
  const [auctions, setAuctions] = useState<LiveAuction[]>([])
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetch('/api/auctions?status=active&limit=6&sort=most_bids')
      .then(res => res.json())
      .then(data => setAuctions(data.auctions || []))
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

      {/* HERO */}
      <section className="relative overflow-hidden pt-20 pb-24 px-4">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-red-600/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-gradient-radial from-red-900/5 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-5 py-2 text-sm font-bold text-red-500 mb-8">
            <Zap size={14} /> Premiere plateforme d&apos;encheres de beats en France
          </div>

          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-[0.95]">
            <span className="text-white">Encheris.</span>{' '}
            <span className="bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">Remporte.</span><br />
            <span className="text-white">Cree ton hit.</span>
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
        </div>
      </section>

      {/* LIVE AUCTIONS */}
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
                <div key={i} className="bg-[#13131a] rounded-2xl h-64 animate-pulse border border-[#1e1e2e]" />
              ))}
            </div>
          ) : auctions.length === 0 ? (
            <div className="text-center py-16 bg-[#13131a] rounded-2xl border border-[#1e1e2e]">
              <Gavel size={48} className="text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg font-bold">Aucune enchere en cours</p>
              <p className="text-gray-600 text-sm mt-1">Les prochaines encheres arrivent bientot</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {auctions.map(auction => (
                <Link
                  key={auction.id}
                  href={`/auction/${auction.id}`}
                  className="group bg-[#13131a] rounded-2xl border border-[#1e1e2e] hover:border-red-500/30 transition-all overflow-hidden"
                >
                  {/* Top bar with genre + timer */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{auction.beat.genre}</span>
                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      <Clock size={12} className="text-red-500" />
                      <CountdownTimer endTime={auction.endTime} compact />
                    </div>
                  </div>

                  {/* Beat info */}
                  <div className="px-5 pb-3">
                    <div className="flex items-center gap-3 mb-3">
                      {/* Play button */}
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          togglePlay(auction.id, auction.beat.audioUrl)
                        }}
                        className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shrink-0 shadow-lg shadow-red-900/30 hover:scale-110 transition-transform"
                      >
                        {playingId === auction.id ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-white ml-0.5" />}
                      </button>
                      <div className="min-w-0">
                        <h3 className="text-white font-extrabold text-base truncate group-hover:text-red-500 transition-colors">
                          {auction.beat.title}
                        </h3>
                        <p className="text-gray-500 text-xs truncate">
                          {auction.beat.producer.displayName || auction.beat.producer.name} &middot; {auction.beat.bpm} BPM{auction.beat.key ? ` &middot; ${auction.beat.key}` : ''}
                        </p>
                      </div>
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
                        <span className="text-[10px] font-bold text-red-500/70 uppercase">{auction.licenseType}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
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
                icon: <Users size={24} />,
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
              <div key={item.step} className="bg-[#13131a] rounded-2xl border border-[#1e1e2e] p-6 relative group hover:border-red-500/20 transition-all">
                <span className="text-5xl font-black text-red-500/10 absolute top-4 right-5">{item.step}</span>
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
                  {item.icon}
                </div>
                <h3 className="text-lg font-extrabold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY 318 LEGAACY */}
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
              <div key={i} className="flex gap-4 bg-[#13131a] rounded-2xl border border-[#1e1e2e] p-5 hover:border-red-500/20 transition-all">
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

      {/* CTA */}
      <section className="px-4 py-20 border-t border-[#1a1a1a]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            Pret a enchérir ?
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

      {/* FOOTER */}
      <footer className="border-t border-[#1a1a1a] px-4 py-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm text-black"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              3
            </div>
            <div>
              <span className="font-extrabold text-sm text-white">318 LEGAACY</span>
              <span className="block text-[8px] text-red-500 -mt-0.5 tracking-[2px] font-semibold">STUDIO</span>
            </div>
          </div>
          <div className="flex gap-6 text-sm text-gray-600">
            <Link href="/marketplace" className="hover:text-white transition-colors">Marketplace</Link>
            <Link href="/register" className="hover:text-white transition-colors">S&apos;inscrire</Link>
            <Link href="/login" className="hover:text-white transition-colors">Connexion</Link>
          </div>
          <p className="text-xs text-gray-700">&copy; 2026 318 LEGAACY Studio</p>
        </div>
      </footer>
    </div>
  )
}
