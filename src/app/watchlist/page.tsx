'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import CountdownTimer from '@/components/ui/CountdownTimer'
import Link from 'next/link'
import {
  Eye, Trash2, Gavel, Clock, Shield, Loader2, Music, Play, Pause
} from 'lucide-react'

interface WatchlistItem {
  id: string
  auctionId: string
  createdAt: string
  auction: {
    id: string
    currentBid: number
    startPrice: number
    status: string
    endTime: string
    licenseType: string
    totalBids: number
    beat: {
      id: string
      title: string
      genre: string
      bpm: number
      key: string | null
      mood: string | null
      audioUrl: string
      coverImage: string | null
      producer: {
        id: string
        name: string
        displayName: string | null
        avatar: string | null
        producerStatus: string | null
      }
    }
    _count: { bids: number }
  }
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'En cours', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  ENDING_SOON: { label: 'Fin bientot', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  ENDED: { label: 'Terminee', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  COMPLETED: { label: 'Vendue', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  SCHEDULED: { label: 'Programmee', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  CANCELLED: { label: 'Annulee', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

const LICENSE_COLORS: Record<string, string> = {
  BASIC: 'bg-gray-500/20 text-gray-400',
  PREMIUM: 'bg-yellow-500/20 text-yellow-400',
  EXCLUSIVE: 'bg-purple-500/20 text-purple-400',
}

export default function WatchlistPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'ended'>('all')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') fetchWatchlist()
  }, [status, router])

  const fetchWatchlist = async () => {
    try {
      const res = await fetch('/api/watchlist')
      if (res.ok) {
        const data = await res.json()
        setItems(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const removeFromWatchlist = async (auctionId: string) => {
    try {
      const res = await fetch('/api/watchlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auctionId }),
      })
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.auctionId !== auctionId))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const togglePlay = (id: string, url: string) => {
    if (playingId === id) { audio?.pause(); setPlayingId(null); return }
    audio?.pause()
    const a = new Audio(url)
    a.play(); a.onended = () => setPlayingId(null)
    setAudio(a); setPlayingId(id)
  }

  const filtered = items.filter((item) => {
    if (filter === 'active') return ['ACTIVE', 'ENDING_SOON', 'SCHEDULED'].includes(item.auction.status)
    if (filter === 'ended') return ['ENDED', 'COMPLETED', 'CANCELLED'].includes(item.auction.status)
    return true
  })

  const activeCount = items.filter((i) => ['ACTIVE', 'ENDING_SOON'].includes(i.auction.status)).length

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <Loader2 className="animate-spin text-red-500" size={32} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Eye size={22} className="text-yellow-400" />
              </div>
              Ma Watchlist
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {items.length} enchere{items.length > 1 ? 's' : ''} suivie{items.length > 1 ? 's' : ''}
              {activeCount > 0 && <span className="text-yellow-400"> · {activeCount} active{activeCount > 1 ? 's' : ''}</span>}
            </p>
          </div>

          {/* Filtres */}
          <div className="flex gap-2">
            {(['all', 'active', 'ended'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${
                  filter === f
                    ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'
                    : 'border-[#222] text-gray-500 hover:text-white'
                }`}
              >
                {f === 'all' ? 'Toutes' : f === 'active' ? 'En cours' : 'Terminees'}
              </button>
            ))}
          </div>
        </div>

        {/* Liste */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-[#111] border border-[#222] rounded-2xl">
            <Eye size={48} className="text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 font-bold text-lg">
              {items.length === 0 ? 'Ta watchlist est vide' : 'Aucune enchere dans ce filtre'}
            </p>
            <p className="text-gray-600 text-sm mt-1 mb-6">
              Ajoute des encheres depuis le marketplace pour les suivre ici
            </p>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-black"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              <Gavel size={16} /> Voir les encheres
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const { auction } = item
              const { beat } = auction
              const producer = beat.producer
              const isActive = ['ACTIVE', 'ENDING_SOON'].includes(auction.status)
              const isPlaying = playingId === auction.id
              const statusInfo = STATUS_LABELS[auction.status] || STATUS_LABELS.ACTIVE

              return (
                <div
                  key={item.id}
                  className={`bg-[#111] border rounded-xl p-4 flex items-center gap-4 transition hover:border-[#333] ${
                    isActive ? 'border-[#222]' : 'border-[#1a1a1a] opacity-70'
                  }`}
                >
                  {/* Cover + Play */}
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-[#1a0a2e] to-[#111] flex-shrink-0">
                    {beat.coverImage && (
                      <Image src={beat.coverImage} alt="" fill className="absolute inset-0 object-cover opacity-40" />
                    )}
                    <button
                      onClick={() => togglePlay(auction.id, beat.audioUrl)}
                      className="absolute inset-0 flex items-center justify-center hover:bg-black/30 transition"
                    >
                      {isPlaying ? (
                        <Pause size={20} className="text-white" />
                      ) : (
                        <Play size={20} className="text-white ml-0.5" />
                      )}
                    </button>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/auction/${auction.id}`} className="text-sm font-bold text-white truncate hover:text-red-500 transition">
                        {beat.title}
                      </Link>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${LICENSE_COLORS[auction.licenseType]}`}>
                        {auction.licenseType}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <Link href={`/producer/${producer.id}`} className="flex items-center gap-1 hover:text-white transition">
                        {producer.displayName || producer.name}
                        {producer.producerStatus === 'APPROVED' && <Shield size={10} className="text-red-500" />}
                      </Link>
                      <span>{beat.genre}</span>
                      <span>{beat.bpm} BPM</span>
                      {beat.key && <span>{beat.key}</span>}
                    </div>
                  </div>

                  {/* Prix + Timer */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-black text-white">{auction.currentBid}&euro;</p>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500 justify-end">
                      <Gavel size={10} /> {auction._count.bids} bid{auction._count.bids > 1 ? 's' : ''}
                    </div>
                    {isActive && (
                      <div className="mt-1">
                        <CountdownTimer endTime={auction.endTime} size="sm" showIcon={false} />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link
                      href={`/auction/${auction.id}`}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition"
                    >
                      Voir
                    </Link>
                    <button
                      onClick={() => removeFromWatchlist(auction.id)}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      title="Retirer de la watchlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
