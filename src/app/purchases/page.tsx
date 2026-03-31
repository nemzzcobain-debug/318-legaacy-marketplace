'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import {
  Download, Music, Play, Pause, CreditCard, Clock, Check,
  Loader2, ShoppingBag, AlertCircle, FileAudio, Archive, ExternalLink
} from 'lucide-react'

interface Purchase {
  id: string
  finalPrice: number
  currentBid: number
  winningLicense: string
  licenseType: string
  paidAt: string
  beat: {
    id: string
    title: string
    genre: string
    bpm: number
    key: string | null
    audioUrl: string
    audioWav: string | null
    stemsUrl: string | null
    coverImage: string | null
    producer: {
      id: string
      name: string
      displayName: string | null
      avatar: string | null
    }
  }
}

interface PendingPayment {
  id: string
  finalPrice: number | null
  currentBid: number
  winningLicense: string | null
  beat: {
    id: string
    title: string
    genre: string
    coverImage: string | null
    producer: { name: string; displayName: string | null }
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const LICENSE_LABELS: Record<string, { label: string; color: string }> = {
  BASIC: { label: 'Basic', color: 'bg-gray-500/20 text-gray-400' },
  PREMIUM: { label: 'Premium', color: 'bg-red-500/20 text-red-400' },
  EXCLUSIVE: { label: 'Exclusive', color: 'bg-yellow-500/20 text-yellow-400' },
}

export default function PurchasesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([])
  const [stats, setStats] = useState({ totalPurchases: 0, totalSpent: 0, pendingCount: 0 })
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      fetchPurchases()
    }
  }, [status, router])

  const fetchPurchases = async () => {
    try {
      const res = await fetch('/api/purchases')
      if (res.ok) {
        const data = await res.json()
        setPurchases(data.purchases || [])
        setPendingPayments(data.pendingPayments || [])
        setStats(data.stats || { totalPurchases: 0, totalSpent: 0, pendingCount: 0 })
      }
    } catch {} finally {
      setLoading(false)
    }
  }

  const togglePlay = (id: string, url: string) => {
    if (playingId === id) {
      audio?.pause()
      setPlayingId(null)
      return
    }
    audio?.pause()
    const newAudio = new Audio(url)
    newAudio.play()
    newAudio.onended = () => setPlayingId(null)
    setAudio(newAudio)
    setPlayingId(id)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="text-red-500 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Mes Achats</h1>
            <p className="text-sm text-gray-400 mt-1">
              {stats.totalPurchases} beat{stats.totalPurchases > 1 ? 's' : ''} achete{stats.totalPurchases > 1 ? 's' : ''} · {stats.totalSpent.toLocaleString('fr-FR')}&euro; depense{stats.totalSpent > 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/marketplace"
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-black"
            style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
          >
            <ShoppingBag size={14} /> Explorer
          </Link>
        </div>

        {/* Pending payments alert */}
        {pendingPayments.length > 0 && (
          <div className="bg-[#e11d4808] border border-[#e11d4825] rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={18} className="text-[#e11d48]" />
              <h3 className="text-sm font-bold text-white">
                {pendingPayments.length} enchere{pendingPayments.length > 1 ? 's' : ''} gagnee{pendingPayments.length > 1 ? 's' : ''} en attente de paiement
              </h3>
            </div>
            <div className="space-y-2">
              {pendingPayments.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <div>
                    <span className="text-sm font-semibold text-white">{p.beat.title}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      par {p.beat.producer.displayName || p.beat.producer.name}
                    </span>
                  </div>
                  <Link
                    href={`/checkout/${p.id}`}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xs text-black"
                    style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                  >
                    <CreditCard size={12} /> Payer {p.finalPrice || p.currentBid}&euro;
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Purchases list */}
        {purchases.length > 0 ? (
          <div className="space-y-4">
            {purchases.map(purchase => {
              const { beat } = purchase
              const license = LICENSE_LABELS[purchase.winningLicense || purchase.licenseType] || LICENSE_LABELS.BASIC
              const isPlaying = playingId === beat.id

              return (
                <div
                  key={purchase.id}
                  className="bg-[#111111] border border-[#222222] rounded-xl p-5"
                >
                  <div className="flex items-start gap-4">
                    {/* Play / Cover */}
                    <button
                      onClick={() => togglePlay(beat.id, beat.audioUrl)}
                      className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
                    >
                      {isPlaying
                        ? <Pause size={20} className="text-white" />
                        : <Play size={20} className="text-white ml-0.5" />
                      }
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-white truncate">{beat.title}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${license.color}`}>
                          {license.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <Link
                          href={`/producer/${beat.producer.id}`}
                          className="hover:text-white transition"
                        >
                          par {beat.producer.displayName || beat.producer.name}
                        </Link>
                        <span>{beat.genre} · {beat.bpm} BPM{beat.key ? ` · ${beat.key}` : ''}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Check size={11} className="text-green-400" /> Paye le {formatDate(purchase.paidAt)}
                        </span>
                        <span className="font-semibold text-white">{purchase.finalPrice || purchase.currentBid}&euro;</span>
                      </div>
                    </div>

                    {/* Download buttons */}
                    <div className="flex flex-col gap-2 shrink-0">
                      {/* MP3 — always available */}
                      <a
                        href={beat.audioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-[#222222] text-xs font-semibold text-white hover:bg-white/10 transition"
                      >
                        <FileAudio size={14} className="text-red-500" /> MP3
                      </a>

                      {/* WAV — Premium + Exclusive */}
                      {beat.audioWav && (purchase.winningLicense === 'PREMIUM' || purchase.winningLicense === 'EXCLUSIVE') && (
                        <a
                          href={beat.audioWav}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-[#222222] text-xs font-semibold text-white hover:bg-white/10 transition"
                        >
                          <FileAudio size={14} className="text-blue-400" /> WAV
                        </a>
                      )}

                      {/* Stems — Exclusive only */}
                      {beat.stemsUrl && purchase.winningLicense === 'EXCLUSIVE' && (
                        <a
                          href={beat.stemsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-[#222222] text-xs font-semibold text-white hover:bg-white/10 transition"
                        >
                          <Archive size={14} className="text-yellow-400" /> Stems
                        </a>
                      )}
                    </div>
                  </div>

                  {/* License rights recap */}
                  <div className="mt-4 pt-3 border-t border-[#222222] flex flex-wrap gap-3 text-[10px] text-gray-600">
                    {purchase.winningLicense === 'EXCLUSIVE' ? (
                      <>
                        <span className="flex items-center gap-1"><Check size={10} className="text-green-500" /> Droits exclusifs</span>
                        <span className="flex items-center gap-1"><Check size={10} className="text-green-500" /> Streams illimites</span>
                        <span className="flex items-center gap-1"><Check size={10} className="text-green-500" /> WAV + Stems</span>
                      </>
                    ) : purchase.winningLicense === 'PREMIUM' ? (
                      <>
                        <span className="flex items-center gap-1"><Check size={10} className="text-green-500" /> Usage commercial</span>
                        <span className="flex items-center gap-1"><Check size={10} className="text-green-500" /> 50K streams</span>
                        <span className="flex items-center gap-1"><Check size={10} className="text-green-500" /> WAV + MP3</span>
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1"><Check size={10} className="text-green-500" /> Non-commercial</span>
                        <span className="flex items-center gap-1"><Check size={10} className="text-green-500" /> 5K streams</span>
                        <span className="flex items-center gap-1"><Check size={10} className="text-green-500" /> MP3</span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : pendingPayments.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag size={48} className="text-gray-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-400 mb-2">Aucun achat pour le moment</h3>
            <p className="text-sm text-gray-600 mb-6">
              Gagne des encheres pour acheter des beats et les retrouver ici
            </p>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-black"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              <ShoppingBag size={16} /> Explorer le marketplace
            </Link>
          </div>
        ) : null}
      </main>
    </div>
  )
}
