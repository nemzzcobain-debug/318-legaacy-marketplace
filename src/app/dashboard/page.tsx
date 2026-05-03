'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import CreateAuctionForm from '@/components/dashboard/CreateAuctionForm'
import AnalyticsTab from '@/components/dashboard/AnalyticsTab'
import { BadgesFullView } from '@/components/badges/BadgeDisplay'
import CountdownTimer from '@/components/ui/CountdownTimer'
import {
  BarChart3,
  DollarSign,
  Gavel,
  Music,
  TrendingUp,
  Plus,
  Clock,
  Settings,
  ChevronRight,
  ArrowUpRight,
  Play,
  Pause,
  Eye,
  AlertCircle,
  Loader2,
  Package,
  CreditCard,
  ExternalLink,
  CheckCircle,
  Award,
  ShoppingBag,
  Heart,
  Trophy,
  Target,
  Download,
  FileAudio,
  Headphones,
  Trash2,
  X,
  Sparkles,
} from 'lucide-react'

// ─── Types ───

type ProducerTab = 'overview' | 'beats' | 'auctions' | 'analytics' | 'badges' | 'settings'
type ArtistTab = 'overview' | 'my-auctions' | 'purchases' | 'badges' | 'settings'

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

interface ArtistAuctionData {
  active: any[]
  pendingPayment: any[]
  won: any[]
  lost: any[]
  stats: {
    total: number
    active: number
    won: number
    lost: number
    pendingPayment: number
    totalSpent: number
  }
}

interface ArtistPurchaseData {
  purchases: any[]
  pendingPayments: any[]
  stats: {
    totalPurchases: number
    totalSpent: number
    pendingCount: number
  }
}

// ═══════════════════════════════════════════════
// MAIN DASHBOARD — Role Router
// ═══════════════════════════════════════════════

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="text-red-500 animate-spin" />
        </div>
      </div>
    )
  }

  const user = session?.user as any
  const isProducer = user?.role === 'PRODUCER' || user?.role === 'ADMIN'

  if (isProducer) {
    return <ProducerDashboard session={session} />
  }

  return <ArtistDashboard session={session} />
}

// ═══════════════════════════════════════════════
// ARTIST DASHBOARD
// ═══════════════════════════════════════════════

function ArtistDashboard({ session }: { session: any }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ArtistTab>('overview')
  const [auctionData, setAuctionData] = useState<ArtistAuctionData | null>(null)
  const [purchaseData, setPurchaseData] = useState<ArtistPurchaseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  const userName = session?.user?.name || 'Artiste'

  const fetchData = useCallback(async () => {
    try {
      const [auctRes, purchRes] = await Promise.all([
        fetch('/api/my-auctions'),
        fetch('/api/purchases'),
      ])
      if (auctRes.ok) setAuctionData(await auctRes.json())
      if (purchRes.ok) setPurchaseData(await purchRes.json())
    } catch (err) {
      console.error('Erreur chargement dashboard artiste:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

  const tabs: { id: ArtistTab; label: string; icon: any }[] = [
    { id: 'overview', label: "Vue d'ensemble", icon: BarChart3 },
    { id: 'my-auctions', label: 'Mes Enchères', icon: Gavel },
    { id: 'purchases', label: 'Mes Achats', icon: ShoppingBag },
    { id: 'badges', label: 'Badges', icon: Award },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ]

  const aStats = auctionData?.stats
  const pStats = purchaseData?.stats

  const statCards = [
    {
      label: 'Enchères participées',
      value: String(aStats?.total || 0),
      sub: `${aStats?.active || 0} en cours`,
      icon: Gavel,
      color: '#e11d48',
      tab: 'my-auctions' as ArtistTab,
    },
    {
      label: 'Enchères gagnées',
      value: String(aStats?.won || 0),
      sub: aStats?.total
        ? `${Math.round(((aStats?.won || 0) / aStats.total) * 100)}% de réussite`
        : '0%',
      icon: Trophy,
      color: '#2ed573',
      tab: 'my-auctions' as ArtistTab,
    },
    {
      label: 'Beats achetés',
      value: String(pStats?.totalPurchases || 0),
      sub: `${pStats?.pendingCount || 0} en attente`,
      icon: ShoppingBag,
      color: '#667eea',
      tab: 'purchases' as ArtistTab,
    },
    {
      label: 'Total dépensé',
      value: `${(pStats?.totalSpent || 0).toLocaleString('fr-FR')}\u20AC`,
      sub: 'sur la plateforme',
      icon: DollarSign,
      color: '#ff0033',
      tab: 'purchases' as ArtistTab,
    },
  ]

  if (loading) {
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
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Welcome */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Mon Espace</h1>
            <p className="text-sm text-gray-400 mt-1">Bienvenue, {userName}</p>
          </div>
          <Link
            href="/marketplace"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-black"
            style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
          >
            <Gavel size={16} /> Explorer les enchères
          </Link>
        </div>

        {/* Pending Payments Alert */}
        {(aStats?.pendingPayment || 0) > 0 && (
          <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertCircle size={20} className="text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-400">
                {aStats!.pendingPayment} paiement{aStats!.pendingPayment > 1 ? 's' : ''} en attente
              </p>
              <p className="text-xs text-amber-400/70">
                Tu as gagné des enchères ! Finalise le paiement pour recevoir tes beats.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('my-auctions')}
              className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/30 transition"
            >
              Voir
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-8 overflow-x-auto pb-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === id
                  ? 'bg-[#e11d4815] text-[#e11d48] border border-[#e11d4830]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* ═══ OVERVIEW ═══ */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {statCards.map(({ label, value, sub, icon: Icon, color, tab }) => (
                <button
                  key={label}
                  onClick={() => tab && setActiveTab(tab)}
                  className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5 text-left hover:border-[#e11d4850] hover:bg-white/[0.02] transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: `${color}15` }}
                    >
                      <Icon size={18} style={{ color }} />
                    </div>
                    <ChevronRight size={14} className="text-gray-700 group-hover:text-[#e11d48] transition-colors" />
                  </div>
                  <div className="text-2xl font-extrabold text-white">{value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
                </button>
              ))}
            </div>

            {/* Active Auctions */}
            <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <h2 className="text-lg font-bold text-white">Mes enchères en cours</h2>
                </div>
                <button
                  onClick={() => setActiveTab('my-auctions')}
                  className="text-xs text-[#e11d48] font-semibold flex items-center gap-1 hover:underline"
                >
                  Voir tout <ChevronRight size={14} />
                </button>
              </div>

              {(auctionData?.active?.length || 0) === 0 ? (
                <div className="text-center py-8">
                  <Gavel size={36} className="mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-400 text-sm font-bold">Aucune enchère active</p>
                  <p className="text-gray-600 text-xs mt-1">
                    Découvre les beats disponibles sur le marketplace
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {auctionData!.active.slice(0, 5).map((auction: any) => (
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
                          <div className="text-sm font-bold text-white">{auction.beat?.title}</div>
                          <div className="text-xs text-gray-500">
                            {auction.beat?.producer?.displayName || auction.beat?.producer?.name}{' '}
                            &middot; {auction.beat?.genre}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-white">
                          {auction.currentBid}&euro;
                        </div>
                        <div className="flex items-center gap-2">
                          {auction.isLeader ? (
                            <span className="text-[10px] font-bold text-[#2ed573]">Leader</span>
                          ) : (
                            <span className="text-[10px] font-bold text-[#e11d48]">Dépassé</span>
                          )}
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock size={10} />{' '}
                            <CountdownTimer endTime={auction.endTime} size="sm" showIcon={false} />
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Purchases */}
            {(purchaseData?.purchases?.length || 0) > 0 && (
              <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-white">Derniers achats</h2>
                  <button
                    onClick={() => setActiveTab('purchases')}
                    className="text-xs text-[#e11d48] font-semibold flex items-center gap-1 hover:underline"
                  >
                    Voir tout <ChevronRight size={14} />
                  </button>
                </div>
                <div className="space-y-3">
                  {purchaseData!.purchases.slice(0, 4).map((p: any) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#2ed57320] flex items-center justify-center">
                          <CheckCircle size={14} className="text-[#2ed573]" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-white">{p.beat?.title}</span>
                          <div className="text-xs text-gray-500">
                            {p.beat?.producer?.displayName || p.beat?.producer?.name} &middot;{' '}
                            {p.winningLicense}
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-white">{p.finalPrice}&euro;</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA if no activity */}
            {(aStats?.total || 0) === 0 && (pStats?.totalPurchases || 0) === 0 && (
              <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-8 text-center">
                <Headphones size={48} className="mx-auto mb-4 text-gray-600" />
                <h3 className="text-lg font-bold text-white mb-2">Bienvenue sur 318 LEGAACY !</h3>
                <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
                  Découvre les meilleurs beats de nos producteurs. Enchéris sur tes favoris ou
                  achète directement dans les Nouveautés.
                </p>
                <div className="flex gap-3 justify-center">
                  <Link
                    href="/marketplace"
                    className="px-6 py-3 rounded-xl font-bold text-sm text-black"
                    style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                  >
                    <span className="flex items-center gap-2">
                      <Gavel size={16} /> Marketplace
                    </span>
                  </Link>
                  <Link
                    href="/nouveautes"
                    className="px-6 py-3 rounded-xl font-bold text-sm text-gray-300 border border-[#1e1e2e] hover:border-[#e11d48] transition"
                  >
                    <span className="flex items-center gap-2">
                      <ShoppingBag size={16} /> Nouveautés
                    </span>
                  </Link>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ MY AUCTIONS ═══ */}
        {activeTab === 'my-auctions' && (
          <ArtistAuctionsTab data={auctionData} togglePlay={togglePlay} playingId={playingId} />
        )}

        {/* ═══ PURCHASES ═══ */}
        {activeTab === 'purchases' && (
          <ArtistPurchasesTab data={purchaseData} togglePlay={togglePlay} playingId={playingId} />
        )}

        {/* ═══ BADGES ═══ */}
        {activeTab === 'badges' && session?.user?.id && <BadgesFullView userId={session.user.id} />}

        {/* ═══ SETTINGS ═══ */}
        {activeTab === 'settings' && <ArtistSettingsTab userName={userName} />}
      </main>
    </div>
  )
}

// ─── Artist Auctions Tab ───
function ArtistAuctionsTab({
  data,
  togglePlay,
  playingId,
}: {
  data: ArtistAuctionData | null
  togglePlay: (id: string, url: string) => void
  playingId: string | null
}) {
  const [subTab, setSubTab] = useState<'active' | 'pending' | 'won' | 'lost'>('active')

  const subTabs = [
    {
      id: 'active' as const,
      label: 'En cours',
      count: data?.active?.length || 0,
      color: 'text-[#e11d48]',
    },
    {
      id: 'pending' as const,
      label: 'A payer',
      count: data?.pendingPayment?.length || 0,
      color: 'text-amber-400',
    },
    {
      id: 'won' as const,
      label: 'Gagnées',
      count: data?.won?.length || 0,
      color: 'text-[#2ed573]',
    },
    {
      id: 'lost' as const,
      label: 'Perdues',
      count: data?.lost?.length || 0,
      color: 'text-gray-500',
    },
  ]

  const items =
    subTab === 'active'
      ? data?.active
      : subTab === 'pending'
        ? data?.pendingPayment
        : subTab === 'won'
          ? data?.won
          : data?.lost

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {subTabs.map(({ id, label, count, color }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              subTab === id
                ? 'bg-[#e11d4815] text-[#e11d48] border-[#e11d4830]'
                : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
            }`}
          >
            {label}{' '}
            <span className={`ml-1 ${subTab === id ? color : 'text-gray-600'}`}>({count})</span>
          </button>
        ))}
      </div>

      <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
        {(items?.length || 0) === 0 ? (
          <div className="text-center py-10">
            <Gavel size={40} className="mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400 text-sm font-bold">Aucune enchère dans cette catégorie</p>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl font-bold text-sm text-black"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              Voir le marketplace
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items!.map((auction: any) => (
              <Link
                key={auction.id}
                href={`/auction/${auction.id}`}
                className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (auction.beat?.audioUrl) togglePlay(auction.id, auction.beat.audioUrl)
                    }}
                    className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1a1a2e] to-[#0a0a0f] flex items-center justify-center shrink-0 hover:scale-105 transition"
                  >
                    {playingId === auction.id ? (
                      <Pause size={14} className="text-white" />
                    ) : (
                      <Play size={14} className="text-white ml-0.5" />
                    )}
                  </button>
                  <div>
                    <div className="text-sm font-bold text-white">{auction.beat?.title}</div>
                    <div className="text-xs text-gray-500">
                      {auction.beat?.producer?.displayName || auction.beat?.producer?.name} &middot;{' '}
                      {auction.beat?.genre}
                      {auction.beat?.bpm ? ` &middot; ${auction.beat.bpm} BPM` : ''}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-white">
                    {auction.currentBid || auction.finalPrice}&euro;
                  </div>
                  {subTab === 'active' && (
                    <div className="flex items-center gap-2 justify-end">
                      {auction.isLeader ? (
                        <span className="text-[10px] font-bold text-[#2ed573]">Leader</span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#e11d48]">Dépassé</span>
                      )}
                    </div>
                  )}
                  {subTab === 'pending' && (
                    <span className="text-[10px] font-bold text-amber-400">Paiement requis</span>
                  )}
                  {subTab === 'won' && (
                    <span className="text-[10px] font-bold text-[#2ed573]">Gagné</span>
                  )}
                  {subTab === 'lost' && (
                    <span className="text-[10px] font-bold text-gray-500">
                      Mon max: {auction.userLastBid}&euro;
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Artist Purchases Tab ───
function ArtistPurchasesTab({
  data,
  togglePlay,
  playingId,
}: {
  data: ArtistPurchaseData | null
  togglePlay: (id: string, url: string) => void
  playingId: string | null
}) {
  const LICENSE_RIGHTS: Record<string, string> = {
    BASIC: 'MP3 - 5000 streams - Non-commercial',
    PREMIUM: 'WAV + MP3 - 50K streams - Commercial',
    EXCLUSIVE: 'WAV + Stems - Illimité - Droits complets',
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-1">Total achats</div>
          <div className="text-2xl font-extrabold text-white">
            {data?.stats?.totalPurchases || 0}
          </div>
        </div>
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-1">Total dépensé</div>
          <div className="text-2xl font-extrabold text-[#e11d48]">
            {(data?.stats?.totalSpent || 0).toLocaleString('fr-FR')}&euro;
          </div>
        </div>
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-1">En attente</div>
          <div className="text-2xl font-extrabold text-amber-400">
            {data?.stats?.pendingCount || 0}
          </div>
        </div>
      </div>

      {/* Pending */}
      {(data?.pendingPayments?.length || 0) > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-bold text-amber-400 mb-3">Paiements en attente</h3>
          <div className="space-y-2">
            {data!.pendingPayments.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-lg bg-black/20"
              >
                <span className="text-sm font-semibold text-white">{p.beat?.title}</span>
                <Link
                  href={`/checkout/${p.id}`}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition"
                >
                  Payer {p.finalPrice}&euro;
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Purchases */}
      <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-5">Mes beats achetés</h2>
        {(data?.purchases?.length || 0) === 0 ? (
          <div className="text-center py-10">
            <ShoppingBag size={40} className="mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400 text-sm font-bold">Aucun achat pour le moment</p>
            <div className="flex gap-3 justify-center mt-4">
              <Link
                href="/marketplace"
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-black"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                Marketplace
              </Link>
              <Link
                href="/nouveautes"
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-400 border border-[#1e1e2e] hover:text-white transition"
              >
                Nouveautés
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {data!.purchases.map((purchase: any) => (
              <div
                key={purchase.id}
                className="p-4 rounded-lg bg-white/[0.02] border border-[#1e1e2e]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (purchase.beat?.audioUrl) togglePlay(purchase.id, purchase.beat.audioUrl)
                      }}
                      className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1a1a2e] to-[#0a0a0f] flex items-center justify-center shrink-0 hover:scale-105 transition"
                    >
                      {playingId === purchase.id ? (
                        <Pause size={14} className="text-white" />
                      ) : (
                        <Play size={14} className="text-white ml-0.5" />
                      )}
                    </button>
                    <div>
                      <div className="text-sm font-bold text-white">{purchase.beat?.title}</div>
                      <div className="text-xs text-gray-500">
                        {purchase.beat?.producer?.displayName || purchase.beat?.producer?.name}
                        {purchase.beat?.genre ? ` &middot; ${purchase.beat.genre}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#2ed573]">
                      {purchase.finalPrice}&euro;
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        purchase.winningLicense === 'EXCLUSIVE'
                          ? 'bg-amber-500/20 text-amber-400'
                          : purchase.winningLicense === 'PREMIUM'
                            ? 'bg-[#e11d48]/20 text-[#e11d48]'
                            : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {purchase.winningLicense}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1e1e2e]">
                  <span className="text-[10px] text-gray-500">
                    {LICENSE_RIGHTS[purchase.winningLicense] || ''}
                  </span>
                  <div className="flex items-center gap-2">
                    {purchase.beat?.audioUrl && (
                      <span className="flex items-center gap-1 text-[10px] text-gray-500 px-2 py-1 rounded bg-white/5">
                        <FileAudio size={10} /> MP3
                      </span>
                    )}
                    {(purchase.winningLicense === 'PREMIUM' ||
                      purchase.winningLicense === 'EXCLUSIVE') &&
                      purchase.beat?.audioWav && (
                        <span className="flex items-center gap-1 text-[10px] text-[#e11d48] px-2 py-1 rounded bg-[#e11d48]/10">
                          <FileAudio size={10} /> WAV
                        </span>
                      )}
                    {purchase.winningLicense === 'EXCLUSIVE' && purchase.beat?.stemsUrl && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400 px-2 py-1 rounded bg-amber-500/10">
                        <Package size={10} /> Stems
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Artist Settings Tab ───
function ArtistSettingsTab({ userName }: { userName: string }) {
  return (
    <div className="space-y-6">
      <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-6">Profil</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Nom d&apos;affichage
            </label>
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

      {/* Become Producer CTA */}
      <div className="bg-gradient-to-r from-[#e11d48]/10 to-[#ff0033]/5 border border-[#e11d48]/30 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#e11d48]/20 flex items-center justify-center shrink-0">
            <Music size={24} className="text-[#e11d48]" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-white mb-1">Tu fais de la musique ?</h3>
            <p className="text-xs text-gray-400">
              Deviens producteur sur 318 LEGAACY et vends tes beats aux enchères ou en direct.
            </p>
          </div>
          <Link
            href="/producers"
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-black shrink-0"
            style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
          >
            Postuler
          </Link>
        </div>
      </div>

      {/* Delete Account */}
      <DeleteAccountSection />
    </div>
  )
}

// ═══════════════════════════════════════════════
// PRODUCER DASHBOARD (original — unchanged)
// ═══════════════════════════════════════════════

function ProducerDashboard({ session }: { session: any }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as ProducerTab | null
  const highlightBeatId = searchParams.get('highlight')
  const [activeTab, setActiveTab] = useState<ProducerTab>(tabFromUrl || 'overview')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  // Sync tab when URL params change (e.g. from notification click)
  useEffect(() => {
    const tab = searchParams.get('tab') as ProducerTab | null
    if (tab && ['overview', 'beats', 'auctions', 'analytics', 'badges', 'settings'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats')
      if (!res.ok) throw new Error('Erreur chargement')
      const json = await res.json()
      setData(json)
    } catch {
      setError('Impossible de charger les données')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

  const tabs: { id: ProducerTab; label: string; icon: any }[] = [
    { id: 'overview', label: "Vue d'ensemble", icon: BarChart3 },
    { id: 'beats', label: 'Mes Beats', icon: Music },
    { id: 'auctions', label: 'Mes Ventes', icon: DollarSign },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'badges', label: 'Badges', icon: Award },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ]

  const userName = session?.user?.name || 'Producteur'

  if (loading) {
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
      tab: 'analytics' as ProducerTab,
    },
    {
      label: 'Beats uploadés',
      value: String(stats?.totalBeats || 0),
      sub: 'sur la plateforme',
      icon: Music,
      color: '#667eea',
      tab: 'beats' as ProducerTab,
    },
    {
      label: 'Enchères actives',
      value: String(stats?.activeAuctionsCount || 0),
      sub: 'en cours',
      icon: Gavel,
      color: '#ff0033',
      tab: 'auctions' as ProducerTab,
    },
    {
      label: 'Total enchères reçues',
      value: String(stats?.totalBidsReceived || 0),
      sub: 'sur tes beats',
      icon: TrendingUp,
      color: '#2ed573',
      tab: 'auctions' as ProducerTab,
    },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Welcome */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Dashboard Producteur</h1>
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${activeTab === id ? 'bg-[#e11d4815] text-[#e11d48] border border-[#e11d4830]' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {statCards.map(({ label, value, sub, icon: Icon, color, tab }) => (
                <button
                  key={label}
                  onClick={() => tab && setActiveTab(tab)}
                  className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5 text-left hover:border-[#e11d4850] hover:bg-white/[0.02] transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: `${color}15` }}
                    >
                      <Icon size={18} style={{ color }} />
                    </div>
                    <ChevronRight size={14} className="text-gray-700 group-hover:text-[#e11d48] transition-colors" />
                  </div>
                  <div className="text-2xl font-extrabold text-white">{value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
                </button>
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
                  <p className="text-gray-600 text-xs mt-1">
                    Crée une enchère depuis l&apos;onglet Mes Enchères
                  </p>
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
                            {auction._count.bids} enchère{auction._count.bids > 1 ? 's' : ''}{' '}
                            &middot; {auction.beat.genre}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-[#e11d48]">
                          {auction.currentBid}&euro;
                        </div>
                        <div className="text-xs text-[#2ed573] flex items-center gap-1">
                          <Clock size={10} />{' '}
                          <CountdownTimer endTime={auction.endTime} size="sm" showIcon={false} />
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
                          <span className="text-sm text-gray-500"> a enchéri sur</span>
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
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
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
          <ProducerBeatsTab
            beats={data?.beats || []}
            togglePlay={togglePlay}
            playingId={playingId}
            onBeatDeleted={fetchData}
            highlightBeatId={highlightBeatId}
          />
        )}

        {/* ═══ VENTES TAB ═══ */}
        {activeTab === 'auctions' && (
          <div className="space-y-6">
            {/* Revenue Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5">
                <div className="text-xs text-gray-500 mb-1">Disponible (en attente)</div>
                <div className="text-2xl font-extrabold text-[#e11d48]">
                  {(stats?.pendingRevenue || 0).toLocaleString('fr-FR')}&euro;
                </div>
              </div>
              <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5">
                <div className="text-xs text-gray-500 mb-1">Total versé</div>
                <div className="text-2xl font-extrabold text-[#2ed573]">
                  {(stats?.paidRevenue || 0).toLocaleString('fr-FR')}&euro;
                </div>
              </div>
              <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5">
                <div className="text-xs text-gray-500 mb-1">Revenus total (85%)</div>
                <div className="text-2xl font-extrabold text-white">
                  {(stats?.totalRevenue || 0).toLocaleString('fr-FR')}&euro;
                </div>
              </div>
            </div>

            <CreateAuctionForm onCreated={() => fetchData()} />
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
                          {auction._count.bids} enchère{auction._count.bids > 1 ? 's' : ''} &middot;
                          Départ: {auction.startPrice}&euro; &middot; {auction.licenseType}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-[#e11d48]">
                          {auction.currentBid}&euro;
                        </div>
                        <div className="text-xs text-[#2ed573] flex items-center gap-1 justify-end">
                          <Clock size={10} />{' '}
                          <CountdownTimer endTime={auction.endTime} size="sm" showIcon={false} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
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
                          Acheteur :{' '}
                          {auction.winner?.displayName || auction.winner?.name || 'Inconnu'}{' '}
                          &middot; {auction.winningLicense}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-[#2ed573]">
                          {auction.finalPrice}&euro;
                        </div>
                        <div className="text-[10px] text-gray-600">
                          Payout : {auction.producerPayout}&euro;
                          {auction.paidAt ? ' &middot; Payé' : ' &middot; En attente'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                          Départ : {auction.startPrice}&euro; &middot; 0 enchère
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#ffffff10] text-gray-500">
                        Expiré
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ ANALYTICS TAB ═══ */}
        {activeTab === 'analytics' && <AnalyticsTab />}

        {/* ═══ BADGES TAB ═══ */}
        {activeTab === 'badges' && session?.user?.id && <BadgesFullView userId={session.user.id} />}

        {/* ═══ SETTINGS TAB ═══ */}
        {activeTab === 'settings' && <ProducerSettingsTab userName={userName} />}
      </main>
    </div>
  )
}

// ─── Producer Beats Tab with Delete ───
function ProducerBeatsTab({
  beats,
  togglePlay,
  playingId,
  onBeatDeleted,
  highlightBeatId,
}: {
  beats: any[]
  togglePlay: (id: string, url: string) => void
  playingId: string | null
  onBeatDeleted: () => void
  highlightBeatId?: string | null
}) {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Helper: check if a beat was created less than 48h ago
  const isNewBeat = (createdAt: string) => {
    const created = new Date(createdAt).getTime()
    const now = Date.now()
    return now - created < 48 * 60 * 60 * 1000
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')

    try {
      const res = await fetch(`/api/beats/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        setDeleteError(data.error || 'Erreur lors de la suppression')
        setDeleting(false)
        return
      }

      setDeleteTarget(null)
      onBeatDeleted()
    } catch {
      setDeleteError('Erreur de connexion')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
        {beats.length === 0 ? (
          <div className="text-center py-12">
            <Music size={48} className="mx-auto mb-4 text-gray-600" />
            <h3 className="text-lg font-bold text-white mb-2">Tes beats apparaitront ici</h3>
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
              <h2 className="text-lg font-bold text-white">Mes Beats ({beats.length})</h2>
              <Link
                href="/producers/upload"
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs text-black"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                <Plus size={14} /> Ajouter
              </Link>
            </div>
            <div className="space-y-3">
              {beats.map((beat: any) => {
                const isHighlighted = highlightBeatId === beat.id
                const isNew = beat.createdAt && isNewBeat(beat.createdAt)
                const showNewBadge = isHighlighted || isNew

                return (
                <div
                  key={beat.id}
                  className={`flex items-center justify-between p-3.5 rounded-lg transition-colors ${isHighlighted ? 'bg-[#e11d48]/10 border border-[#e11d48]/30 ring-1 ring-[#e11d48]/20' : 'bg-white/[0.02] hover:bg-white/[0.04]'}`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => togglePlay(beat.id, beat.audioUrl)}
                      className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
                    >
                      {playingId === beat.id ? (
                        <Pause size={14} className="text-white" />
                      ) : (
                        <Play size={14} className="text-white ml-0.5" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{beat.title}</span>
                        {showNewBadge && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#e11d48]/15 text-[#e11d48] text-[10px] font-bold uppercase animate-pulse">
                            <Sparkles size={10} /> Nouveau
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {beat.genre} &middot; {beat.bpm} BPM
                        {beat.key ? ` \u00B7 ${beat.key}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Eye size={11} /> {beat.plays}
                        </span>
                        <span className="flex items-center gap-1">
                          <Gavel size={11} /> {beat._count.auctions}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${beat.status === 'ACTIVE' ? 'bg-[#2ed57320] text-[#2ed573]' : beat.status === 'SOLD' ? 'bg-[#e11d4820] text-[#e11d48]' : 'bg-[#ffffff10] text-gray-500'}`}
                    >
                      {beat.status === 'ACTIVE'
                        ? 'Actif'
                        : beat.status === 'SOLD'
                          ? 'Vendu'
                          : beat.status === 'DRAFT'
                            ? 'Brouillon'
                            : beat.status}
                    </span>
                    {beat.status !== 'SOLD' && (
                      <button
                        onClick={() => setDeleteTarget({ id: beat.id, title: beat.title })}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-all"
                        title="Supprimer ce beat"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal de confirmation de suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div className="relative bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <button
              onClick={() => !deleting && setDeleteTarget(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition"
              disabled={deleting}
            >
              <X size={18} />
            </button>

            <div className="w-12 h-12 rounded-xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500" />
            </div>

            <h3 className="text-lg font-bold text-white text-center mb-2">Supprimer ce beat ?</h3>
            <p className="text-sm text-gray-400 text-center mb-1">
              Tu es sur le point de supprimer :
            </p>
            <p className="text-sm font-bold text-white text-center mb-4">
              &laquo; {deleteTarget.title} &raquo;
            </p>
            <p className="text-xs text-gray-500 text-center mb-6">
              Cette action est irréversible. Le beat, sa cover et tous les fichiers audio seront
              définitivement supprimés.
            </p>

            {deleteError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-red-400 text-xs text-center">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-gray-300 bg-white/5 border border-[#1e1e2e] hover:bg-white/10 transition disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-red-600 hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Supprimer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Producer Settings Tab ───
function ProducerSettingsTab({ userName }: { userName: string }) {
  const [stripeStatus, setStripeStatus] = useState<
    'loading' | 'not_connected' | 'pending' | 'active'
  >('loading')
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
            <p className="text-xs text-gray-500">
              Reçois 85% de chaque vente directement sur ton compte
            </p>
          </div>
        </div>

        {stripeStatus === 'loading' ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Vérification...
          </div>
        ) : stripeStatus === 'active' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-[#2ed573]" />
              <span className="text-sm font-semibold text-[#2ed573]">Compte Stripe actif</span>
            </div>
            <p className="text-xs text-gray-500">
              Ton compte est configuré. Les paiements sont transférés automatiquement chaque
              semaine.
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
              {connecting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Redirection...
                </>
              ) : (
                <>
                  <CreditCard size={14} /> Compléter l&apos;inscription Stripe
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Connecte ton compte Stripe pour commencer à recevoir tes paiements quand tes beats
              sont vendus.
            </p>
            <button
              onClick={connectStripe}
              disabled={connecting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-black disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              {connecting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Redirection...
                </>
              ) : (
                <>
                  <CreditCard size={14} /> Connecter Stripe
                </>
              )}
            </button>
            <p className="text-[11px] text-gray-600">
              Stripe est notre partenaire de paiement sécurisé. Tu seras redirigé vers Stripe pour
              configurer ton compte.
            </p>
          </div>
        )}
      </div>

      {/* Profile settings */}
      <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-6">Profil</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Nom d&apos;affichage
            </label>
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

      {/* Delete Account */}
      <DeleteAccountSection />
    </div>
  )
}

// ─── Delete Account Section (shared) ───
function DeleteAccountSection() {
  const [showModal, setShowModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    if (confirmText !== 'SUPPRIMER') return
    setDeleting(true)
    setError('')
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'SUPPRIMER' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la suppression')
        setDeleting(false)
        return
      }
      await signOut({ callbackUrl: '/' })
    } catch {
      setError('Erreur serveur, réessayez plus tard')
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="bg-[#13131a] border border-red-500/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
            <Trash2 size={20} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Supprimer mon compte</h2>
            <p className="text-xs text-gray-500">Cette action est irréversible</p>
          </div>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Votre compte sera désactivé et vos données personnelles anonymisées. Vos enchères et transactions seront conservées pour l&apos;historique.
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-xl font-bold text-sm text-red-400 border border-red-500/30 hover:bg-red-500/10 transition"
        >
          Supprimer mon compte
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle size={24} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Confirmer la suppression</h3>
                <p className="text-xs text-gray-400">Cette action ne peut pas être annulée</p>
              </div>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-4">
              <p className="text-sm text-gray-300 mb-2">En supprimant votre compte :</p>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Vos données personnelles seront anonymisées</li>
                <li>• Vos sessions et connexions OAuth seront supprimées</li>
                <li>• Vos likes, follows et playlists seront supprimés</li>
                <li>• Vos beats et transactions resteront pour l&apos;historique</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                Tapez <strong className="text-red-400">SUPPRIMER</strong> pour confirmer
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="SUPPRIMER"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] text-white text-sm outline-none focus:border-red-500/50"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 mb-3">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowModal(false); setConfirmText(''); setError('') }}
                className="flex-1 px-4 py-3 rounded-xl font-semibold text-sm text-gray-300 bg-white/5 hover:bg-white/10 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmText !== 'SUPPRIMER' || deleting}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
