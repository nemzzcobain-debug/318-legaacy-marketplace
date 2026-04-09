'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import CreateAuctionForm from '@/components/dashboard/CreateAuctionForm'
import AnalyticsTab from '@/components/dashboard/AnalyticsTab'
import { BadgesFullView } from '@/components/badges/BadgeDisplay'
import CountdownTimer from '@/components/ui/CountdownTimer'
import {
  BarChart3, DollarSign, Gavel, Music, TrendingUp, Plus, Clock,
  Settings, ChevronRight, ArrowUpRight, Play, Pause, Eye,
  AlertCircle, Loader2, Package, CreditCard, ExternalLink, CheckCircle, Award
} from 'lucide-react'

type Tab = 'overview' | 'beats' | 'auctions' | 'earnings' | 'analytics' | 'badges' | 'settings'

interface DashboardData {
  stats: {
    totalBeats: number
    activeAuctionsCount: number
    totalBidsReceived: number
    totalSales: number
    totalRevenue: number
    pendingRevenue: number
    paidRevenue: number
    totalSalesAmount: number
    totalCommission: number
  }
  beats: any[]
  activeAuctions: any[]
  completedAuctions: any[]
  endedNoSale: any[]
  recentBids: any[]
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats')
      if (!res.ok) throw new Error('Erreur chargement')
      const json = await res.json()
      setData(json)
    } catch {
      setError('Impossible de charger les donnees')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status, router, fetchData])

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

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
    { id: 'beats', label: 'Mes Beats', icon: Music },
    { id: 'auctions', label: 'Mes Enchères', icon: Gavel },
    { id: 'earnings', label: 'Revenus', icon: DollarSign },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'badges', label: 'Badges', icon: Award },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ]

  const userName = session?.user?.name || 'Producteur'

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

  const stats = data?.stats
  const statCards = [
    {
      label: 'Revenus total',
      value: `${stats?.totalRevenue?.toLocaleString('fr-FR') || 0}\u20AC`,
      sub: `${stats?.totalSales || 0} vente${(stats?.totalSales || 0) > 1 ? 's' : ''}`,
      icon: DollarSign,
      color: '#e11d48',
    },
    {
      label: 'Beats uploadés',
      value: String(stats?.totalBeats || 0),
      sub: 'sur la plateforme',
      icon: Music,
      color: '#667eea',
    },
    {
      label: 'Enchères actives',
      value: String(stats?.activeAuctionsCount || 0),
      sub: 'en cours',
      icon: Gavel,
      color: '#ff0033',
    },
    {
      label: 'Total enchères reçues',
      value: String(stats?.totalBidsReceived || 0),
      sub: 'sur tes beats',
      icon: TrendingUp,
      color: '#2ed573',
    },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Welcome */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">Bienvenue, {userName}</p>
          </div>
          <Link
            href="/producers/upload"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-black"
            style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
          >
            <Plus size={16} /> Nouveau Beat
          </Link>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-6 rounded-lg bg-[#ff475715] border border-[#ff475730] text-[#ff4757] text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-8 overflow-x-auto pb-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all
                ${activeTab === id
                  ? 'bg-[#e11d4815] text-[#e11d48] border border-[#e11d4830]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }
              `}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === 'overview' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {statCards.map(({ label, value, sub, icon: Icon, color }) => (
                <div key={label} className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: `${color}15` }}
                    >
                      <Icon size={18} style={{ color }} />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-white">{value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
                </div>
              ))}
            </div>

            {/* Active Auctions */}
            <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <h2 className="text-lg font-bold text-white">Enchères en cours</h2>
                </div>
                <button
                  onClick={() => setActiveTab('auctions')}
                  className="text-xs text-[#e11d48] font-semibold flex items-center gap-1 hover:underline"
                >
                  Voir tout <ChevronRight size={14} />
                </button>
              </div>

              {(data?.activeAuctions?.length || 0) === 0 ? (
                <div className="text-center py-8">
                  <Gavel size={36} className="mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-400 text-sm font-bold">Aucune enchère active</p>
                  <p className="text-gray-600 text-xs mt-1">Crée une enchère depuis l&apos;onglet Mes Enchères</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data!.activeAuctions.map((auction: any) => (
                    <Link
                      key={auction.id}
                      href={`/auction/${auction.id}`}
                      className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                          <Music size={16} className="text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{auction.beat.title}</div>
                          <div className="text-xs text-gray-500">
                            {auction._count.bids} enchere{auction._count.bids > 1 ? 's' : ''} · {auction.beat.genre}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-[#e11d48]">{auction.currentBid}&euro;</div>
                        <div className="text-xs text-[#2ed573] flex items-center gap-1">
                          <Clock size={10} /> <CountdownTimer endTime={auction.endTime} size="sm" showIcon={false} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activity */}
            {(data?.recentBids?.length || 0) > 0 && (
              <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
                <h2 className="text-lg font-bold text-white mb-5">Activité récente</h2>
                <div className="space-y-3">
                  {data!.recentBids.map((bid: any) => (
                    <div
                      key={bid.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#667eea20] flex items-center justify-center text-[#667eea] text-xs font-bold">
                          {(bid.user.displayName || bid.user.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm text-white font-semibold">
                            {bid.user.displayName || bid.user.name}
                          </span>
                          <span className="text-sm text-gray-500"> a encherit sur </span>
                          <Link
                            href={`/auction/${bid.auction.id}`}
                            className="text-sm text-[#e11d48] font-semibold hover:underline"
                          >
                            {bid.auction.beat.title}
                          </Link>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-white">{bid.amount}&euro;</div>
                        <div className="text-[10px] text-gray-600">
                          {new Date(bid.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ BEATS TAB ═══ */}
        {activeTab === 'beats' && (
          <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
            {(data?.beats?.length || 0) === 0 ? (
              <div className="text-center py-12">
                <Music size={48} className="mx-auto mb-4 text-gray-600" />
                <h3 className="text-lg font-bold text-white mb-2">Tes beats apparaîtront ici</h3>
                <p className="text-sm text-gray-400 mb-5">
                  Upload ton premier beat pour commencer à le vendre aux enchères
                </p>
                <Link
                  href="/producers/upload"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-black"
                  style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                >
                  <Plus size={16} /> Ajouter un beat
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-white">
                    Mes Beats ({data!.beats.length})
                  </h2>
                  <Link
                    href="/producers/upload"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs text-black"
                    style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                  >
                    <Plus size={14} /> Ajouter
                  </Link>
                </div>

                <div className="space-y-3">
                  {data!.beats.map((beat: any) => (
                    <div
                      key={beat.id}
                      className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => togglePlay(beat.id, beat.audioUrl)}
                          className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
                        >
                          {playingId === beat.id
                            ? <Pause size={14} className="text-white" />
                            : <Play size={14} className="text-white ml-0.5" />
                          }
                        </button>
                        <div>
                          <div className="text-sm font-bold text-white">{beat.title}</div>
                          <div className="text-xs text-gray-500">
                            {beat.genre} · {beat.bpm} BPM{beat.key ? ` · ${beat.key}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><Eye size={11} /> {beat.plays}</span>
                            <span className="flex items-center gap-1"><Gavel size={11} /> {beat._count.auctions}</span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          beat.status === 'ACTIVE' ? 'bg-[#2ed57320] text-[#2ed573]' :
                          beat.status === 'SOLD' ? 'bg-[#e11d4820] text-[#e11d48]' :
                          'bg-[#ffffff10] text-gray-500'
                        }`}>
                          {beat.status === 'ACTIVE' ? 'Actif' : beat.status === 'SOLD' ? 'Vendu' : beat.status === 'DRAFT' ? 'Brouillon' : beat.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ AUCTIONS TAB ═══ */}
        {activeTab === 'auctions' && (
          <div className="space-y-6">
            <CreateAuctionForm onCreated={() => fetchData()} />

            {/* Active auctions list */}
            {(data?.activeAuctions?.length || 0) > 0 && (
              <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
                <h2 className="text-lg font-bold text-white mb-5">
                  Enchères actives ({data!.activeAuctions.length})
                </h2>
                <div className="space-y-3">
                  {data!.activeAuctions.map((auction: any) => (
                    <Link
                      key={auction.id}
                      href={`/auction/${auction.id}`}
                      className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <div>
                        <div className="text-sm font-bold text-white">{auction.beat.title}</div>
                        <div className="text-xs text-gray-500">
                          {auction._count.bids} enchere{auction._count.bids > 1 ? 's' : ''} · Depart: {auction.startPrice}&euro; · {auction.licenseType}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-[#e11d48]">{auction.currentBid}&euro;</div>
                        <div className="text-xs text-[#2ed573] flex items-center gap-1 justify-end">
                          <Clock size={10} /> <CountdownTimer endTime={auction.endTime} size="sm" showIcon={false} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Completed sales */}
            {(data?.completedAuctions?.length || 0) > 0 && (
              <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
                <h2 className="text-lg font-bold text-white mb-5">
                  Ventes terminées ({data!.completedAuctions.length})
                </h2>
                <div className="space-y-3">
                  {data!.completedAuctions.map((auction: any) => (
                    <div
                      key={auction.id}
                      className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.02]"
                    >
                      <div>
                        <div className="text-sm font-bold text-white">{auction.beat.title}</div>
                        <div className="text-xs text-gray-500">
                          Acheteur : {auction.winner?.displayName || auction.winner?.name || 'Inconnu'} · {auction.winningLicense}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-[#2ed573]">{auction.finalPrice}&euro;</div>
                        <div className="text-[10px] text-gray-600">
                          Payout : {auction.producerPayout}&euro;
                          {auction.paidAt ? ' · Payé' : ' · En attente'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ended with no sale */}
            {(data?.endedNoSale?.length || 0) > 0 && (
              <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
                <h2 className="text-lg font-bold text-white mb-5">
                  Sans vente ({data!.endedNoSale.length})
                </h2>
                <div className="space-y-3">
                  {data!.endedNoSale.map((auction: any) => (
                    <div
                      key={auction.id}
                      className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.02]"
                    >
                      <div>
                        <div className="text-sm font-bold text-white">{auction.beat.title}</div>
                        <div className="text-xs text-gray-500">
                          Départ : {auction.startPrice}&euro; · 0 enchère
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#ffffff10] text-gray-500">
                        Expire
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ EARNINGS TAB ═══ */}
        {activeTab === 'earnings' && (
          <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Revenus</h2>
              <span className="text-xs text-gray-500">Commission plateforme : 15%</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-[#1e1e2e]">
                <div className="text-xs text-gray-500 mb-1">Disponible (en attente)</div>
                <div className="text-2xl font-extrabold text-[#e11d48]">
                  {(stats?.pendingRevenue || 0).toLocaleString('fr-FR')}&euro;
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-[#1e1e2e]">
                <div className="text-xs text-gray-500 mb-1">Total verse</div>
                <div className="text-2xl font-extrabold text-[#2ed573]">
                  {(stats?.paidRevenue || 0).toLocaleString('fr-FR')}&euro;
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-[#1e1e2e]">
                <div className="text-xs text-gray-500 mb-1">Revenus total (85 %)</div>
                <div className="text-2xl font-extrabold text-white">
                  {(stats?.totalRevenue || 0).toLocaleString('fr-FR')}&euro;
                </div>
              </div>
            </div>

            {/* Sales breakdown */}
            {(data?.completedAuctions?.length || 0) > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-400 mb-3">Détail des ventes</h3>
                <div className="space-y-2">
                  {data!.completedAuctions.map((sale: any) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]"
                    >
                      <div>
                        <span className="text-sm font-semibold text-white">{sale.beat.title}</span>
                        <span className="text-xs text-gray-500 ml-2">{sale.winningLicense}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-gray-500">Vente : {sale.finalPrice}&euro;</span>
                        <span className="text-gray-500">Com : {sale.commissionAmount}&euro;</span>
                        <span className="font-bold text-[#2ed573]">{sale.producerPayout}&euro;</span>
                        <span className={`font-bold ${sale.paidAt ? 'text-[#2ed573]' : 'text-[#e11d48]'}`}>
                          {sale.paidAt ? 'Payé' : 'En attente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500">
              Les paiements sont traites via Stripe Connect. Tu recois 85% du montant final de chaque vente.
              Les virements sont effectues automatiquement chaque semaine.
            </p>
          </div>
        )}

        {/* ═══ ANALYTICS TAB ═══ */}
        {activeTab === 'analytics' && <AnalyticsTab />}

        {/* ═══ BADGES TAB ═══ */}
        {activeTab === 'badges' && session?.user?.id && (
          <BadgesFullView userId={session.user.id} />
        )}

        {/* ═══ SETTINGS TAB ═══ */}
        {activeTab === 'settings' && <SettingsTab userName={userName} />}
      </main>
    </div>
  )
}

// ─── SETTINGS TAB COMPONENT ───
function SettingsTab({ userName }: { userName: string }) {
  const [stripeStatus, setStripeStatus] = useState<'loading' | 'not_connected' | 'pending' | 'active'>('loading')
  const [stripeDashboard, setStripeDashboard] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    async function checkStripe() {
      try {
        const res = await fetch('/api/stripe/connect')
        const data = await res.json()
        setStripeStatus(data.status || 'not_connected')
        if (data.dashboardUrl) setStripeDashboard(data.dashboardUrl)
      } catch {
        setStripeStatus('not_connected')
      }
    }
    checkStripe()
  }, [])

  const connectStripe = async () => {
    setConnecting(true)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      const data = await res.json()
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl
      } else if (data.status === 'active') {
        setStripeStatus('active')
      }
    } catch {
      setConnecting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stripe Connect */}
      <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-[#635BFF15] flex items-center justify-center">
            <CreditCard size={20} className="text-[#635BFF]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Paiements Stripe</h2>
            <p className="text-xs text-gray-500">Recois 85% de chaque vente directement sur ton compte</p>
          </div>
        </div>

        {stripeStatus === 'loading' ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Verification...
          </div>
        ) : stripeStatus === 'active' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-[#2ed573]" />
              <span className="text-sm font-semibold text-[#2ed573]">Compte Stripe actif</span>
            </div>
            <p className="text-xs text-gray-500">
              Ton compte est configure. Les paiements sont transferes automatiquement chaque semaine.
            </p>
            {stripeDashboard && (
              <a
                href={stripeDashboard}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#635BFF15] text-[#635BFF] text-xs font-semibold hover:bg-[#635BFF25] transition"
              >
                <ExternalLink size={14} /> Accéder au dashboard Stripe
              </a>
            )}
          </div>
        ) : stripeStatus === 'pending' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-yellow-400" />
              <span className="text-sm font-semibold text-yellow-400">Configuration en cours</span>
            </div>
            <p className="text-xs text-gray-500">
              Tu dois compléter ton inscription Stripe pour recevoir des paiements.
            </p>
            <button
              onClick={connectStripe}
              disabled={connecting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-black disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              {connecting
                ? <><Loader2 size={14} className="animate-spin" /> Redirection...</>
                : <><CreditCard size={14} /> Compléter l&apos;inscription Stripe</>
              }
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Connecte ton compte Stripe pour commencer a recevoir tes paiements quand tes beats sont vendus.
            </p>
            <button
              onClick={connectStripe}
              disabled={connecting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-black disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              {connecting
                ? <><Loader2 size={14} className="animate-spin" /> Redirection...</>
                : <><CreditCard size={14} /> Connecter Stripe</>
              }
            </button>
            <p className="text-[11px] text-gray-600">
              Stripe est notre partenaire de paiement sécurisé. Tu seras redirigé vers Stripe pour configurer ton compte.
            </p>
          </div>
        )}
      </div>

      {/* Profile settings */}
      <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-6">Profil</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Nom d&apos;affichage</label>
            <input
              type="text"
              defaultValue={userName}
              className="w-full max-w-md px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] text-white text-sm outline-none focus:border-[#e11d4850]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Bio</label>
            <textarea
              rows={3}
              defaultValue=""
              className="w-full max-w-md px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] text-white text-sm outline-none focus:border-[#e11d4850] resize-none"
            />
          </div>
          <button
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-black"
            style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
          >
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  )
}
