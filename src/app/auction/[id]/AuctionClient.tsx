'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import Image from 'next/image'
import Header from '@/components/layout/Header'
import AudioPlayer from '@/components/audio/AudioPlayer'
import CountdownTimer from '@/components/ui/CountdownTimer'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import { useRealtimeAuction, useRealtimeBids } from '@/hooks/useRealtimeAuction'
import { formatTimeLeft, isEndingCritical } from '@/lib/realtime-utils'
import {
  Gavel,
  Shield,
  TrendingUp,
  Clock,
  AlertTriangle,
  Zap,
  Music,
  ArrowLeft,
  Wifi,
  CreditCard,
  Trophy,
  CheckCircle,
  XCircle,
  Download,
  FileText,
  ShoppingBag,
  Loader2,
  Lock,
} from 'lucide-react'
import Link from 'next/link'
import ShareButton from '@/components/ui/ShareButton'
import ReportButton from '@/components/ui/ReportButton'
import WatchlistButton from '@/components/ui/WatchlistButton'
import AddToPlaylistButton from '@/components/playlist/AddToPlaylistButton'
import SimilarBeats from '@/components/auction/SimilarBeats'

interface BidItem {
  id: string
  amount: number
  finalAmount?: number
  licenseType?: string
  createdAt: string
  user?: {
    id?: string
    name?: string
    displayName?: string | null
    avatar?: string | null
  } | null
}

const getBidderName = (bid: BidItem) =>
  bid.user?.displayName?.trim() || bid.user?.name?.trim() || 'Enchérisseur'

const getBidderInitial = (bid: BidItem) => getBidderName(bid).charAt(0).toUpperCase()

interface AuctionDetail {
  id: string
  startPrice: number
  currentBid: number
  bidIncrement: number
  buyNowPrice: number | null
  licenseType: string
  status: string
  startTime: string
  endTime: string
  totalBids: number
  antiSnipeMinutes: number
  winnerId: string | null
  winningLicense: string | null
  finalPrice: number | null
  paidAt: string | null
  commissionAmount: number | null
  producerPayout: number | null
  winner: { name: string; displayName: string | null } | null
  beat: {
    id: string
    title: string
    description: string | null
    audioUrl: string
    coverImage: string | null
    genre: string
    mood: string | null
    bpm: number
    key: string | null
    tags: string
    plays: number
    producer: {
      id: string
      name: string
      displayName: string | null
      avatar: string | null
      producerStatus: string
      rating: number
      totalSales: number
    }
  }
  bids: BidItem[]
}

const LICENSE_INFO: Record<
  string,
  { name: string; color: string; multiplier: number; rights: string }
> = {
  BASIC: { name: 'Basic', color: '#8a8a9a', multiplier: 1, rights: 'MP3 - 5000 streams' },
  PREMIUM: {
    name: 'Premium',
    color: '#e11d48',
    multiplier: 2.5,
    rights: 'WAV + MP3 - 50K streams',
  },
  EXCLUSIVE: {
    name: 'Exclusive',
    color: '#ff0033',
    multiplier: 10,
    rights: 'WAV + Stems - Illimité',
  },
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// Mini formulaire de paiement Stripe pour l'achat immédiat
function BuyNowPaymentForm({
  amount,
  auctionId,
  onSuccess,
  onError,
}: {
  amount: number
  auctionId: string
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setPaying(true)
    onError('')

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    })

    if (error) {
      onError(error.message || 'Erreur lors du paiement')
      setPaying(false)
    } else {
      // Paiement réussi → finaliser l'enchère
      try {
        await fetch(`/api/auctions/${auctionId}/buy-now/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      } catch {}
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <PaymentElement
        options={{
          layout: 'tabs',
          defaultValues: { billingDetails: { address: { country: 'FR' } } },
        }}
      />
      <button
        type="submit"
        disabled={!stripe || paying}
        className="w-full mt-4 py-3.5 rounded-xl font-bold text-black text-base flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:scale-[1.02] bg-gradient-to-r from-amber-400 to-amber-500"
      >
        {paying ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Traitement en cours...
          </>
        ) : (
          <>
            <Lock size={16} /> Payer {amount} EUR
          </>
        )}
      </button>
    </form>
  )
}

export default function AuctionClient() {
  const { id } = useParams()
  const { data: session } = useSession()
  const router = useRouter()

  const [auction, setAuction] = useState<AuctionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [bidAmount, setBidAmount] = useState('')
  const selectedLicense = auction?.licenseType || 'BASIC'
  const [bidding, setBidding] = useState(false)
  const [bidError, setBidError] = useState('')
  const [bidNotice, setBidNotice] = useState('')
  const [bidSuccess, setBidSuccess] = useState('')
  const bidSubmissionRef = useRef(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [buyingNow, setBuyingNow] = useState(false)
  const [buyNowClientSecret, setBuyNowClientSecret] = useState<string | null>(null)

  // Guest bid state
  const [guestEmail, setGuestEmail] = useState('')
  const [showGuestBidForm, setShowGuestBidForm] = useState(false)

  // Realtime hooks
  const realtimeState = useRealtimeAuction(id as string)
  const realtimeBids = useRealtimeBids(id as string, (newBid) => {
    // Flash animation on new bid
    setBidSuccess(
      `Nouvelle enchère : ${newBid.amount} EUR par ${newBid.user?.displayName || 'Anonyme'}`
    )
    setTimeout(() => setBidSuccess(''), 4000)
  })

  // Sync realtime state into auction object
  useEffect(() => {
    if (auction && realtimeState.currentBid > 0) {
      setAuction((prev) =>
        prev
          ? {
              ...prev,
              currentBid: realtimeState.currentBid,
              totalBids: realtimeState.bidCount,
              status: realtimeState.status,
            }
          : prev
      )
    }
  }, [realtimeState.currentBid, realtimeState.bidCount, realtimeState.status])

  // Si une nouvelle mise augmente le minimum, ne pas laisser un ancien
  // montant devenu invalide dans le champ.
  useEffect(() => {
    if (realtimeState.currentBid <= 0 || !auction?.bidIncrement) return

    const nextMinimum = realtimeState.currentBid + auction.bidIncrement
    setBidAmount((currentAmount) => {
      const parsedCurrent = Number.parseFloat(currentAmount)
      return !Number.isFinite(parsedCurrent) || parsedCurrent < nextMinimum
        ? String(nextMinimum)
        : currentAmount
    })
  }, [realtimeState.currentBid, auction?.bidIncrement])

  // Fetch auction data
  const fetchAuction = useCallback(async () => {
    try {
      const res = await fetch(`/api/auctions/${id}`)
      if (res.ok) {
        const data = await res.json()
        setAuction(data)
        setBidAmount(
          (currentAmount) => currentAmount || String(data.currentBid + data.bidIncrement)
        )
        return data as AuctionDetail
      } else if (res.status === 404) {
        setAuction(null)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
    return null
  }, [id])

  // Auto-finalize when timer reaches 0 (client-side trigger since Hobby cron is daily)
  const [finalizeCalled, setFinalizeCalled] = useState(false)
  useEffect(() => {
    if (realtimeState.timeLeft <= 0 && auction?.status === 'ACTIVE' && !finalizeCalled) {
      setFinalizeCalled(true)
      fetch('/api/auctions/finalize', { method: 'POST' })
        .then(() => fetchAuction())
        .catch(console.error)
    }
  }, [realtimeState.timeLeft, auction?.status, finalizeCalled, fetchAuction])

  // Initial load only - realtime handles updates
  useEffect(() => {
    fetchAuction()
  }, [fetchAuction])

  const placeBid = async () => {
    if (!session) {
      // Mode invité : afficher le formulaire email
      if (!showGuestBidForm) {
        setShowGuestBidForm(true)
        return
      }
      if (!guestEmail || !guestEmail.includes('@')) {
        setBidError('Entre un email valide pour enchérir')
        return
      }
    }

    setBidError('')
    setBidNotice('')
    setBidSuccess('')

    const parsedBidAmount = Number.parseFloat(bidAmount)
    const minimumBid = auction ? auction.currentBid + auction.bidIncrement : 0

    if (!Number.isFinite(parsedBidAmount)) {
      setBidError('Entre un montant valide')
      return
    }

    if (parsedBidAmount < minimumBid) {
      setBidNotice(`La mise minimale est de ${minimumBid} EUR. Ta mise n'a pas été envoyée.`)
      return
    }

    // Verrou immédiat contre les doubles clics/taps, avant même que React
    // ait le temps de désactiver visuellement le bouton.
    if (bidSubmissionRef.current) return
    bidSubmissionRef.current = true
    setBidding(true)

    try {
      const bidBody: any = {
        amount: parsedBidAmount,
      }
      if (!session && guestEmail) {
        bidBody.guestEmail = guestEmail
      }

      // BUG FIX 6: Utiliser la route transactionnelle au lieu de la legacy
      const res = await fetch(`/api/auctions/bid?auctionId=${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bidBody),
      })

      // Une mise peut être enregistrée alors que la lecture de la réponse
      // échoue côté navigateur. Le statut HTTP reste la source de vérité.
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        if (data?.code === 'BID_TOO_LOW' && Number.isFinite(Number(data.minimumBid))) {
          const newMinimum = Number(data.minimumBid)
          setBidAmount(String(newMinimum))
          setBidNotice(
            `Une autre mise est passée avant la tienne. Le nouveau minimum est de ${newMinimum} EUR. Ta mise n'a pas été enregistrée.`
          )
          void fetchAuction()
          return
        }

        setBidError(data?.error || "Impossible de placer l'enchère")
        return
      }

      const confirmedAmount = Number(data?.auction?.currentBid ?? parsedBidAmount)
      const confirmedBidCount = Number(data?.auction?.totalBids ?? (auction?.totalBids || 0) + 1)
      const increment = auction?.bidIncrement || 5

      // Afficher immédiatement le succès : les notifications et le
      // rafraîchissement de l'historique ne doivent jamais transformer une
      // mise déjà enregistrée en faux message d'erreur.
      setAuction((currentAuction) =>
        currentAuction
          ? {
              ...currentAuction,
              currentBid: confirmedAmount,
              totalBids: confirmedBidCount,
              endTime: data?.auction?.endTime || currentAuction.endTime,
            }
          : currentAuction
      )
      setBidAmount(String(confirmedAmount + increment))
      setBidSuccess(`Enchère de ${parsedBidAmount} EUR bien prise en compte !`)

      if (data?.auction?.antiSnipeTriggered) {
        setBidSuccess((prev) => prev + ' Anti-snipe actif : temps prolongé !')
      }

      // Le rafraîchissement est secondaire et ne peut plus modifier le
      // résultat affiché à l'utilisateur.
      void fetchAuction()
      setTimeout(() => setBidSuccess(''), 5000)
    } catch (e) {
      // Si la connexion s'est coupée après l'enregistrement, vérifier l'état
      // réel avant d'afficher une erreur et risquer une double mise.
      const refreshedAuction = await fetchAuction()
      const currentUserId = (session?.user as any)?.id
      const matchingBid = refreshedAuction?.bids?.some(
        (bid) =>
          bid.amount === parsedBidAmount && (!currentUserId || bid.user?.id === currentUserId)
      )

      if (refreshedAuction && matchingBid) {
        setBidAmount(String(refreshedAuction.currentBid + refreshedAuction.bidIncrement))
        setBidSuccess(`Enchère de ${parsedBidAmount} EUR bien prise en compte !`)
        setTimeout(() => setBidSuccess(''), 5000)
      } else {
        setBidError(
          "La réponse n'a pas pu être confirmée. Actualise la page avant de réessayer pour éviter une double mise."
        )
      }
    } finally {
      bidSubmissionRef.current = false
      setBidding(false)
    }
  }

  const buyNow = async () => {
    if (!session) {
      router.push('/login')
      return
    }

    setBuyingNow(true)
    setBidError('')

    try {
      const res = await fetch(`/api/auctions/${id}/buy-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (!res.ok) {
        setBidError(data.error)
        return
      }

      // Afficher le formulaire de paiement Stripe
      setBuyNowClientSecret(data.clientSecret)
    } catch (e) {
      setBidError('Erreur de connexion')
    } finally {
      setBuyingNow(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </div>
    )
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Enchere introuvable</div>
        </div>
      </div>
    )
  }

  const { beat } = auction
  const producer = beat.producer
  const license = LICENSE_INFO[selectedLicense]
  const finalPrice = parseFloat(bidAmount || '0') * license.multiplier
  const isActive = auction.status === 'ACTIVE' || auction.status === 'ENDING_SOON'
  const isEndingSoon = auction.status === 'ENDING_SOON'
  let parsedTags: string[] = []
  try {
    parsedTags = JSON.parse(beat.tags || '[]')
  } catch {}

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08080a] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_18%_0%,rgba(225,29,72,0.16),transparent_42%),radial-gradient(circle_at_82%_8%,rgba(127,29,29,0.12),transparent_36%)]"
      />
      <Header />

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 sm:pt-8">
        <div className="hidden sm:block">
          <Breadcrumbs
            items={[{ label: 'Enchères', href: '/marketplace' }, { label: beat.title }]}
          />
        </div>

        {/* Back link */}
        <Link
          href="/marketplace"
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white sm:mb-6"
        >
          <ArrowLeft size={14} /> Retour aux enchères
        </Link>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_390px] xl:gap-8">
          {/* Left: Beat Info */}
          <div className="min-w-0 space-y-5">
            {/* Beat Header */}
            <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#101014]/95 shadow-2xl shadow-black/30 backdrop-blur-xl">
              {/* Cover */}
              <div className="relative flex h-56 items-center justify-center overflow-hidden bg-gradient-to-br from-[#1a0000] to-[#330011] sm:h-72">
                {/* Cover Image */}
                {beat.coverImage ? (
                  <Image
                    src={beat.coverImage}
                    alt={beat.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 60vw"
                    priority
                  />
                ) : (
                  <Music size={48} className="text-red-500/20 absolute" />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-[#101014] via-black/10 to-black/20" />

                <div className="absolute left-4 top-4 z-10 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md">
                  {beat.genre}
                </div>
                {isEndingSoon && (
                  <div className="absolute right-4 top-4 z-10 flex animate-pulse items-center gap-1.5 rounded-full border border-red-400/30 bg-red-600/90 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white shadow-lg shadow-red-950/40 backdrop-blur-md">
                    <AlertTriangle size={12} /> Fin imminente
                  </div>
                )}
                <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-2">
                  <span className="rounded-lg border border-white/10 bg-black/55 px-2.5 py-1 text-xs font-semibold text-zinc-200 backdrop-blur-md">
                    {beat.bpm} BPM
                  </span>
                  {beat.key && (
                    <span className="rounded-lg border border-white/10 bg-black/55 px-2.5 py-1 text-xs font-semibold text-zinc-200 backdrop-blur-md">
                      {beat.key}
                    </span>
                  )}
                  {beat.mood && (
                    <span className="rounded-lg border border-white/10 bg-black/55 px-2.5 py-1 text-xs font-semibold text-zinc-200 backdrop-blur-md">
                      {beat.mood}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-5 sm:p-7">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
                      Beat aux enchères
                    </p>
                    <h1 className="truncate text-2xl font-black tracking-tight text-white sm:text-3xl">
                      {beat.title}
                    </h1>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                    <AddToPlaylistButton beatId={beat.id} />
                    <WatchlistButton auctionId={auction.id} />
                    <ShareButton
                      url={`/auction/${auction.id}`}
                      title={`${beat.title} - Enchere sur 318 LEGAACY`}
                      description={`Encheris sur "${beat.title}" par ${producer.displayName || producer.name} sur 318 LEGAACY Marketplace`}
                    />
                    <ReportButton type="AUCTION" targetAuctionId={auction.id} />
                  </div>
                </div>
                <Link
                  href={`/producer/${producer.id}`}
                  className="group mb-5 flex w-fit items-center gap-3 rounded-xl border border-transparent py-1 pr-3 transition hover:border-white/10 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  aria-label={`Voir le profil de ${producer.displayName || producer.name}`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-900 text-xs font-black text-white shadow-lg shadow-red-950/40 transition-transform group-hover:scale-105">
                    {producer.name[0]}
                  </div>
                  <div>
                    <span className="flex items-center gap-1.5 text-sm font-bold text-zinc-200 transition-colors group-hover:text-white">
                      {producer.displayName || producer.name}
                      {producer.producerStatus === 'APPROVED' && (
                        <Shield size={13} className="text-red-500" />
                      )}
                    </span>
                    <span className="block text-[11px] text-zinc-600">
                      Beatmaker • {producer.totalSales} ventes
                    </span>
                  </div>
                </Link>

                {beat.description && (
                  <p className="mb-5 max-w-2xl text-sm leading-6 text-zinc-400">
                    {beat.description}
                  </p>
                )}

                {/* Tags */}
                {parsedTags.length > 0 && (
                  <div className="mb-5 flex flex-wrap gap-1.5">
                    {parsedTags.map((tag: string) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-400"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Audio Player */}
                <div className="rounded-2xl border border-white/10 bg-black/20 p-2 sm:p-3">
                  <AudioPlayer
                    src={beat.audioUrl}
                    title={beat.title}
                    producer={producer.displayName || producer.name}
                    isPlaying={isPlaying}
                    onPlayToggle={() => setIsPlaying(!isPlaying)}
                    accentColor="#e11d48"
                  />
                </div>
              </div>
            </section>

            {/* Bid History */}
            <section className="rounded-[24px] border border-white/10 bg-[#101014]/90 p-4 shadow-xl shadow-black/20 backdrop-blur-xl sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-black text-white sm:text-lg">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                    <TrendingUp size={16} />
                  </span>
                  Historique des enchères
                </h2>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-zinc-400">
                  {auction.totalBids} mise{auction.totalBids !== 1 ? 's' : ''}
                </span>
              </div>
              {auction.bids.length > 0 ? (
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {auction.bids.map((bid, i) => (
                    <div
                      key={bid.id}
                      className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition ${
                        i === 0
                          ? 'border-red-500/25 bg-gradient-to-r from-red-500/10 to-transparent'
                          : 'border-transparent bg-white/[0.025] hover:border-white/10 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white ${
                            i === 0
                              ? 'bg-gradient-to-br from-red-500 to-red-900 shadow-lg shadow-red-950/30'
                              : 'bg-gradient-to-br from-zinc-700 to-zinc-900'
                          }`}
                        >
                          {getBidderInitial(bid)}
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-bold text-white">
                            {getBidderName(bid)}
                          </span>
                          {i === 0 && (
                            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-red-400">
                              En tête
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-sm font-black text-white">{bid.amount} EUR</span>
                        <span className="block text-[10px] text-zinc-600">
                          {bid.licenseType || auction.licenseType} •{' '}
                          {new Date(bid.createdAt).toLocaleTimeString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-white/10 py-8 text-center text-sm text-zinc-500">
                  Aucune enchère pour le moment. Sois le premier !
                </p>
              )}
            </section>
          </div>

          {/* Right: Bid Panel */}
          <aside className="space-y-4 lg:sticky lg:top-24">
            {/* Auction Status Card */}
            <div className="overflow-hidden rounded-[28px] border border-red-500/20 bg-gradient-to-b from-[#171116] to-[#0e0e12] p-4 shadow-2xl shadow-red-950/15 sm:p-5">
              {/* Realtime indicator */}
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                  Vente aux enchères
                </span>
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  <Wifi size={10} className="text-emerald-400" />
                  <span className="text-[9px] font-black uppercase tracking-wide text-emerald-400">
                    En direct
                  </span>
                </div>
              </div>

              {/* Timer */}
              <div
                className={`mb-3 flex items-center justify-between rounded-2xl border p-3.5 ${
                  isEndingCritical(realtimeState.timeLeft)
                    ? 'animate-pulse border-red-500/40 bg-red-600/10'
                    : 'border-white/10 bg-black/20'
                }`}
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05]">
                    <Clock size={14} />
                  </span>
                  {isActive ? 'Temps restant' : 'Terminée'}
                </span>
                {isActive && (
                  <span
                    className={`font-mono text-lg font-black tracking-tight ${
                      isEndingCritical(realtimeState.timeLeft) ? 'text-red-400' : 'text-white'
                    }`}
                  >
                    {formatTimeLeft(realtimeState.timeLeft)}
                  </span>
                )}
              </div>

              {/* Current Bid */}
              <div className="mb-4 rounded-2xl border border-red-500/15 bg-[radial-gradient(circle_at_50%_0%,rgba(225,29,72,0.16),transparent_70%)] px-4 py-5 text-center">
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                  Enchère actuelle
                </p>
                <p className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                  {auction.currentBid}
                  <span className="ml-1.5 text-base font-bold text-red-400">EUR</span>
                </p>
                <p className="mt-2 text-[11px] text-zinc-500">
                  {auction.totalBids} enchère{auction.totalBids !== 1 ? 's' : ''} • Prix de départ{' '}
                  {auction.startPrice} EUR
                </p>
              </div>

              {/* License Info + Bid Amount */}
              {isActive && (
                <>
                  {/* Licence définie par le beatmaker */}
                  <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                      <Shield size={17} />
                    </span>
                    <div>
                      <p className="text-xs font-black text-white">Licence {license.name}</p>
                      <p className="mt-0.5 text-[10px] leading-4 text-zinc-500">{license.rights}</p>
                    </div>
                  </div>

                  {/* Bid Amount */}
                  <div className="mb-4">
                    <div className="mb-2 flex items-end justify-between gap-3">
                      <label htmlFor="bid-amount" className="text-xs font-bold text-zinc-300">
                        Ton enchère
                      </label>
                      <span className="text-[10px] text-zinc-600">
                        Minimum {auction.currentBid + auction.bidIncrement} EUR
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        id="bid-amount"
                        type="number"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        min={auction.currentBid + auction.bidIncrement}
                        step="0.01"
                        aria-label="Montant de ton enchère"
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 pr-14 text-xl font-black text-white outline-none transition placeholder:text-zinc-700 focus:border-red-500/70 focus:ring-4 focus:ring-red-500/10"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
                        EUR
                      </span>
                    </div>
                  </div>

                  {/* Anti-snipe info */}
                  <div className="mb-4 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <p className="flex items-start gap-2 text-[10px] leading-4 text-zinc-500">
                      <Zap size={12} className="mt-0.5 shrink-0 text-red-500" />
                      <span>
                        Protection anti-snipe : une mise dans les {auction.antiSnipeMinutes}{' '}
                        dernières minutes prolonge automatiquement l&apos;enchère.
                      </span>
                    </p>
                  </div>

                  {/* Error / Success */}
                  {bidNotice && (
                    <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                      {bidNotice}
                    </div>
                  )}
                  {bidError && (
                    <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                      {bidError}
                    </div>
                  )}
                  {bidSuccess && (
                    <div className="mb-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
                      {bidSuccess}
                    </div>
                  )}

                  {/* Guest email form for bidding */}
                  {!session && showGuestBidForm && (
                    <div className="mb-3 p-3 rounded-xl bg-[#1a1a2e] border border-[#2e2e4e]">
                      <p className="text-xs text-gray-400 mb-2">
                        Entre ton email pour enchérir en tant qu&apos;invité :
                      </p>
                      <input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="ton@email.com"
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0a0f] border border-[#2e2e4e] text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#e11d48]"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">
                        Un compte sera créé automatiquement avec cet email.
                      </p>
                    </div>
                  )}

                  {/* Bid Button */}
                  <button
                    onClick={placeBid}
                    disabled={bidding}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#f20d46] to-[#c70b35] py-4 text-base font-black text-white shadow-lg shadow-red-950/35 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red-950/50 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Gavel size={20} />
                    {bidding
                      ? 'Enchère en cours...'
                      : !session && !showGuestBidForm
                        ? `Enchérir en tant qu'invité`
                        : `Enchérir à ${bidAmount} EUR`}
                  </button>

                  {/* Buy Now Button */}
                  {auction.buyNowPrice && (
                    <div className="mt-3">
                      <div className="relative flex items-center my-3">
                        <div className="flex-1 border-t border-[#222]" />
                        <span className="px-3 text-[10px] text-gray-500 uppercase tracking-wider">
                          ou
                        </span>
                        <div className="flex-1 border-t border-[#222]" />
                      </div>

                      {!buyNowClientSecret ? (
                        <>
                          <button
                            onClick={buyNow}
                            disabled={buyingNow}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/10 py-3.5 text-sm font-black text-amber-300 transition hover:bg-amber-400/15 disabled:opacity-50"
                          >
                            {buyingNow ? (
                              <>
                                <Loader2 size={18} className="animate-spin" /> Chargement...
                              </>
                            ) : (
                              <>
                                <ShoppingBag size={20} />
                                {`Achat immédiat — ${auction.buyNowPrice} EUR`}
                              </>
                            )}
                          </button>
                          <p className="text-[10px] text-gray-500 text-center mt-2">
                            Achetez ce beat maintenant sans attendre la fin de l&apos;enchère
                          </p>
                        </>
                      ) : (
                        <div className="bg-[#0a0a0a] border border-amber-500/20 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <ShoppingBag size={16} className="text-amber-400" />
                            <span className="text-sm font-bold text-amber-400">
                              Achat immédiat — {auction.buyNowPrice} EUR
                            </span>
                          </div>
                          <Elements
                            stripe={stripePromise}
                            options={{
                              clientSecret: buyNowClientSecret,
                              appearance: {
                                theme: 'night',
                                variables: {
                                  colorPrimary: '#f59e0b',
                                  colorBackground: '#111',
                                  colorText: '#fff',
                                  borderRadius: '12px',
                                },
                              },
                            }}
                          >
                            <BuyNowPaymentForm
                              amount={auction.buyNowPrice}
                              auctionId={auction.id}
                              onSuccess={() => {
                                setBuyNowClientSecret(null)
                                fetchAuction()
                                setBidSuccess('Paiement confirmé ! Le beat est a vous.')
                              }}
                              onError={(msg) => setBidError(msg)}
                            />
                          </Elements>
                          <button
                            onClick={() => setBuyNowClientSecret(null)}
                            className="w-full mt-3 text-xs text-gray-500 hover:text-white transition"
                          >
                            Annuler
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {!isActive &&
                (() => {
                  const userId = session?.user?.id ?? null
                  const isWinner = userId && auction.winnerId === userId
                  const isParticipant = userId && auction.bids.some((b) => b.user?.id === userId)
                  const isPaid = !!auction.paidAt
                  const winnerName = auction.winner
                    ? auction.winner.displayName || auction.winner.name
                    : auction.bids[0]
                      ? getBidderName(auction.bids[0])
                      : null
                  const winLicense = auction.winningLicense
                    ? LICENSE_INFO[auction.winningLicense]
                    : null

                  return (
                    <div className="py-4 space-y-4">
                      {/* Status banner */}
                      <div
                        className={`rounded-xl p-4 text-center ${
                          isWinner
                            ? isPaid
                              ? 'bg-green-500/10 border border-green-500/30'
                              : 'bg-yellow-500/10 border border-yellow-500/30 animate-pulse'
                            : 'bg-white/5 border border-[#222]'
                        }`}
                      >
                        <div
                          className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${
                            isWinner
                              ? isPaid
                                ? 'bg-green-500/20'
                                : 'bg-yellow-500/20'
                              : 'bg-white/5'
                          }`}
                        >
                          {isWinner ? (
                            isPaid ? (
                              <CheckCircle size={28} className="text-green-400" />
                            ) : (
                              <Trophy size={28} className="text-yellow-400" />
                            )
                          ) : (
                            <Gavel size={24} className="text-gray-500" />
                          )}
                        </div>

                        {isWinner && !isPaid && (
                          <>
                            <p className="text-lg font-black text-yellow-400 mb-1">
                              Tu as gagné cette enchère !
                            </p>
                            <p className="text-sm text-gray-400">
                              Finalise ton achat pour recevoir le beat
                            </p>
                          </>
                        )}
                        {isWinner && isPaid && (
                          <>
                            <p className="text-lg font-black text-green-400 mb-1">
                              Achat confirmé !
                            </p>
                            <p className="text-sm text-gray-400">
                              Tu peux télécharger ton beat depuis "Mes Achats"
                            </p>
                          </>
                        )}
                        {!isWinner && winnerName && (
                          <>
                            <p className="text-lg font-bold text-white mb-1">Enchere terminée</p>
                            <p className="text-sm text-gray-400">
                              Remportee par{' '}
                              <span className="text-white font-semibold">{winnerName}</span>
                            </p>
                          </>
                        )}
                        {!winnerName && auction.bids.length === 0 && (
                          <>
                            <p className="text-lg font-bold text-white mb-1">Enchere terminée</p>
                            <p className="text-sm text-gray-500">Aucune enchère placée</p>
                          </>
                        )}
                      </div>

                      {/* Price recap */}
                      {auction.bids.length > 0 && (
                        <div className="bg-[#0a0a0a] rounded-xl border border-[#222] p-4 space-y-2.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Prix final</span>
                            <span className="text-white font-bold text-lg">
                              {auction.finalPrice || auction.currentBid} EUR
                            </span>
                          </div>
                          {winLicense && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-500">Licence</span>
                              <span className="font-bold" style={{ color: winLicense.color }}>
                                {winLicense.name} — {winLicense.rights}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Nombre d&apos;enchères</span>
                            <span className="text-white">{auction.totalBids}</span>
                          </div>
                          {isPaid && (
                            <div className="flex items-center justify-between text-sm pt-2 border-t border-[#222]">
                              <span className="text-gray-500">Statut</span>
                              <span className="text-green-400 font-bold flex items-center gap-1">
                                <CheckCircle size={13} /> Paye
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Winner CTA: Pay button */}
                      {isWinner && !isPaid && (
                        <button
                          onClick={() => router.push(`/checkout/${auction.id}`)}
                          className="w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-green-900/30"
                          style={{
                            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                          }}
                        >
                          <CreditCard size={20} /> Payer {auction.finalPrice || auction.currentBid}{' '}
                          EUR
                        </button>
                      )}

                      {/* Winner CTA: Go to purchases */}
                      {isWinner && isPaid && (
                        <Link
                          href="/purchases"
                          className="w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 transition-all hover:scale-[1.02] bg-gradient-to-r from-blue-600 to-blue-800"
                        >
                          <Download size={20} /> Télécharger mon beat
                        </Link>
                      )}

                      {/* Participant but lost */}
                      {!isWinner && isParticipant && (
                        <div className="bg-white/[0.02] rounded-xl border border-[#222] p-4 text-center">
                          <XCircle size={20} className="text-gray-500 mx-auto mb-2" />
                          <p className="text-sm text-gray-400 mb-3">
                            Tu n&apos;as pas remporté cette enchère
                          </p>
                          <Link
                            href="/marketplace"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-red-500 border border-red-500/20 hover:bg-red-500/5 transition"
                          >
                            <Music size={14} /> Voir d&apos;autres enchères
                          </Link>
                        </div>
                      )}
                    </div>
                  )
                })()}
            </div>
          </aside>
        </div>

        <div className="mt-10">
          <SimilarBeats auctionId={auction.id} />
        </div>
      </main>
    </div>
  )
}
