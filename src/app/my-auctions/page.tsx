'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import CountdownTimer from '@/components/ui/CountdownTimer'
import {
  Gavel, Clock, Trophy, XCircle, CreditCard, TrendingUp, Music,
  Play, Pause, AlertTriangle, CheckCircle, ArrowRight, Loader2,
  DollarSign, BarChart3, Shield
} from 'lucide-react'

interface AuctionItem {
  id: string
  beat: {
    id: string
    title: string
    genre: string
    bpm: number
    key: string | null
    coverImage: string | null
    audioUrl: string
    producer: {
      id: string
      name: string
      displayName: string | null
      avatar: string | null
    }
  }
  currentBid: number
  startPrice: number
  finalPrice: number | null
  totalBids: number
  myLastBid: number
  myLicense: string
  myLastBidAt: string
  licenseType: string
  winningLicense: string | null
  status: string
  endTime: string
  startTime: string
  paidAt: string | null
  isLeader: boolean
}

interface Stats {
  total: number
  active: number
  won: number
  lost: number
  pendingPayment: number
  totalSpent: number
}

type TabId = 'active' | 'pendingPayment' | 'won' | 'lost'

const LICENSE_COLORS: Record<string, string> = {
  BASIC: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  PREMIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  EXCLUSIVE: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

export default function MyAuctionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<{
    active: AuctionItem[]
    won: AuctionItem[]
    lost: AuctionItem[]
    pendingPayment: AuctionItem[]
    stats: Stats
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('active')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/my-auctions')
        if (res.ok) {
          const json = await res.json()
          setData(json)
          // Auto-select first tab with content
          if (json.pendingPayment.length > 0) setActiveTab('pendingPayment')
          else if (json.active.length > 0) setActiveTab('active')
          else if (json.won.length > 0) setActiveTab('won')
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    if (status === 'authenticated') fetchData()
  }, [status])

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

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-red-500" />
      </div>
    )
  }

  const tabs: { id: TabId; label: string; icon: any; count: number; color: string }[] = [
    { id: 'active', label: 'En cours', icon: Clock, count: data?.stats.active || 0, color: 'text-blue-400' },
    { id: 'pendingPayment', label: 'A payer', icon: CreditCard, count: data?.stats.pendingPayment || 0, color: 'text-yellow-400' },
    { id: 'won', label: 'Gagnees', icon: Trophy, count: data?.stats.won || 0, color: 'text-green-400' },
    { id: 'lost', label: 'Perdues', icon: XCircle, count: data?.stats.lost || 0, color: 'text-gray-400' },
  ]

  const currentList: AuctionItem[] = data ? data[activeTab] : []

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <Gavel size={24} className="text-red-500" /> Mes Encheres
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Toutes les enchères auxquelles tu as participé
            </p>
          </div>
          <Link
            href="/marketplace"
            className="px-4 py-2 rounded-xl text-sm font-bold text-red-500 border border-red-500/20 hover:bg-red-500/5 transition flex items-center gap-2"
          >
            <Music size={14} /> Marketplace
          </Link>
        </div>

        {/* Stats Cards */}
        {data && data.stats.total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-[#111111] border border-[#222222] rounded-xl p-4">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center mb-2">
                <BarChart3 size={18} className="text-blue-400" />
              </div>
              <div className="text-xl font-extrabold text-white">{data.stats.total}</div>
              <div className="text-[11px] text-gray-500">Participations</div>
            </div>
            <div className="bg-[#111111] border border-[#222222] rounded-xl p-4">
              <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center mb-2">
                <Trophy size={18} className="text-green-400" />
              </div>
              <div className="text-xl font-extrabold text-white">{data.stats.won}</div>
              <div className="text-[11px] text-gray-500">Gagnees</div>
            </div>
            <div className="bg-[#111111] border border-[#222222] rounded-xl p-4">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center mb-2">
                <TrendingUp size={18} className="text-red-400" />
              </div>
              <div className="text-xl font-extrabold text-white">
                {data.stats.total > 0 ? Math.round((data.stats.won / data.stats.total) * 100) : 0}%
              </div>
              <div className="text-[11px] text-gray-500">Taux de victoire</div>
            </div>
            <div className="bg-[#111111] border border-[#222222] rounded-xl p-4">
              <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center mb-2">
                <DollarSign size={18} className="text-yellow-400" />
              </div>
              <div className="text-xl font-extrabold text-white">{data.stats.totalSpent} EUR</div>
              <div className="text-[11px] text-gray-500">Total dépensé</div>
            </div>
          </div>
        )}

        {/* Pending Payment Alert */}
        {data && data.pendingPayment.length > 0 && activeTab !== 'pendingPayment' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertTriangle size={20} className="text-yellow-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-yellow-400">
                {data.pendingPayment.length} enchère{data.pendingPayment.length > 1 ? 's' : ''} en attente de paiement
              </p>
              <p className="text-xs text-yellow-400/60">Finalise tes achats pour recevoir les beats</p>
            </div>
            <button
              onClick={() => setActiveTab('pendingPayment')}
              className="px-4 py-2 rounded-lg text-xs font-bold text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 transition"
            >
              Voir
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[#222222] pb-2 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon, count, color }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-semibold transition whitespace-nowrap ${
                activeTab === id
                  ? 'text-red-500 bg-red-500/10 border-b-2 border-red-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon size={14} className={activeTab === id ? 'text-red-500' : color} />
              {label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTab === id ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-gray-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Auction List */}
        {currentList.length > 0 ? (
          <div className="space-y-3">
            {currentList.map(auction => {
              const producerName = auction.beat.producer.displayName || auction.beat.producer.name
              const isPlaying = playingId === auction.id

              return (
                <div
                  key={auction.id}
                  className={`bg-[#111111] border rounded-xl p-4 transition hover:bg-white/[0.02] ${
                    activeTab === 'pendingPayment'
                      ? 'border-yellow-500/30'
                      : activeTab === 'won'
                      ? 'border-green-500/20'
                      : 'border-[#222222]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Play button */}
                    <button
                      onClick={() => togglePlay(auction.id, auction.beat.audioUrl)}
                      className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 hover:bg-red-500/20 transition"
                    >
                      {isPlaying ? (
                        <Pause size={18} className="text-red-500" />
                      ) : (
                        <Play size={18} className="text-red-500 ml-0.5" />
                      )}
                    </button>

                    {/* Beat info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Link
                          href={`/auction/${auction.id}`}
                          className="text-sm font-bold text-white truncate hover:text-red-500 transition"
                        >
                          {auction.beat.title}
                        </Link>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          LICENSE_COLORS[auction.myLicense] || LICENSE_COLORS.BASIC
                        }`}>
                          {auction.myLicense}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Link href={`/producer/${auction.beat.producer.id}`} className="hover:text-white transition">
                          {producerName}
                        </Link>
                        <span>·</span>
                        <span>{auction.beat.genre}</span>
                        <span>·</span>
                        <span>{auction.beat.bpm} BPM</span>
                      </div>
                    </div>

                    {/* Status + bid info */}
                    <div className="text-right flex-shrink-0">
                      {/* Active: show timer + leader status */}
                      {activeTab === 'active' && (
                        <>
                          <div className="flex items-center gap-1 justify-end mb-1">
                            {auction.isLeader ? (
                              <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <TrendingUp size={10} /> Leader
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <AlertTriangle size={10} /> Depasse
                              </span>
                            )}
                          </div>
                          <div className="text-lg font-black text-white">{auction.currentBid} EUR</div>
                          <div className="flex items-center gap-1 text-[10px] text-gray-500 justify-end mt-0.5">
                            <Clock size={10} />
                            <CountdownTimer endTime={auction.endTime} size="sm" showIcon={false} />
                          </div>
                          <div className="text-[10px] text-gray-600 mt-0.5">
                            Mon enchère: {auction.myLastBid} EUR
                          </div>
                        </>
                      )}

                      {/* Pending payment: show pay button */}
                      {activeTab === 'pendingPayment' && (
                        <>
                          <div className="text-lg font-black text-yellow-400 mb-1">
                            {auction.finalPrice || auction.currentBid} EUR
                          </div>
                          <button
                            onClick={() => router.push(`/checkout/${auction.id}`)}
                            className="px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition hover:scale-105"
                            style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' }}
                          >
                            <CreditCard size={13} /> Payer
                          </button>
                        </>
                      )}

                      {/* Won: show paid status */}
                      {activeTab === 'won' && (
                        <>
                          <div className="text-lg font-black text-green-400 mb-1">
                            {auction.finalPrice || auction.currentBid} EUR
                          </div>
                          <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 justify-center">
                            <CheckCircle size={10} /> Paye
                          </span>
                          {auction.winningLicense && (
                            <div className="text-[10px] text-gray-500 mt-1">
                              Licence {auction.winningLicense}
                            </div>
                          )}
                        </>
                      )}

                      {/* Lost */}
                      {activeTab === 'lost' && (
                        <>
                          <div className="text-lg font-black text-gray-400 mb-1">
                            {auction.finalPrice || auction.currentBid} EUR
                          </div>
                          <div className="text-[10px] text-gray-600">
                            Mon max: {auction.myLastBid} EUR
                          </div>
                          <span className="text-[10px] text-gray-600 mt-0.5 block">
                            {auction.totalBids} enchères
                          </span>
                        </>
                      )}
                    </div>

                    {/* Arrow to detail */}
                    <Link
                      href={`/auction/${auction.id}`}
                      className="p-2 rounded-lg hover:bg-white/5 transition flex-shrink-0"
                    >
                      <ArrowRight size={16} className="text-gray-600" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-[#111111] border border-[#222222] rounded-xl">
            {activeTab === 'active' && (
              <>
                <Clock size={48} className="text-gray-700 mx-auto mb-4" />
                <p className="text-gray-400 font-bold text-lg">Aucune enchère en cours</p>
                <p className="text-gray-600 text-sm mt-1 mb-6">Tu n&apos;as pas d&apos;enchères actives en ce moment</p>
                <Link
                  href="/marketplace"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-black"
                  style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                >
                  <Gavel size={16} /> Explorer le marketplace
                </Link>
              </>
            )}
            {activeTab === 'pendingPayment' && (
              <>
                <CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
                <p className="text-gray-400 font-bold text-lg">Rien a payer</p>
                <p className="text-gray-600 text-sm mt-1">Tous tes paiements sont a jour</p>
              </>
            )}
            {activeTab === 'won' && (
              <>
                <Trophy size={48} className="text-gray-700 mx-auto mb-4" />
                <p className="text-gray-400 font-bold text-lg">Aucune enchère gagnée</p>
                <p className="text-gray-600 text-sm mt-1 mb-6">Continue a encherir pour remportér des beats</p>
                <Link
                  href="/marketplace"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-black"
                  style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                >
                  <Gavel size={16} /> Voir les enchères
                </Link>
              </>
            )}
            {activeTab === 'lost' && (
              <>
                <XCircle size={48} className="text-gray-700 mx-auto mb-4" />
                <p className="text-gray-400 font-bold text-lg">Aucune enchère perdue</p>
                <p className="text-gray-600 text-sm mt-1">Bonne nouvelle !</p>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
