'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import {
  CreditCard, Shield, Lock, Check, AlertCircle, Loader2,
  Music, Award, ArrowRight, ChevronDown, ChevronUp
} from 'lucide-react'

interface CheckoutData {
  clientSecret: string
  paymentIntentId: string
  amount: number
  commission: number
  producerPayout: number
  beatTitle: string
  licenseType: string
}

interface AuctionInfo {
  id: string
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
    }
  }
  finalPrice: number
  winningLicense: string
  currentBid: number
  totalBids: number
  paidAt: string | null
}

export default function CheckoutPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const auctionId = params.id as string

  const [auction, setAuction] = useState<AuctionInfo | null>(null)
  const [checkout, setCheckout] = useState<CheckoutData | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  // Charger les infos de l'enchere
  useEffect(() => {
    if (!auctionId || status === 'loading') return

    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    async function loadAuction() {
      try {
        const res = await fetch(`/api/auctions/${auctionId}`)
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Enchere non trouvee')
          return
        }

        if (data.paidAt) {
          setSuccess(true)
        }

        setAuction(data)
      } catch {
        setError('Erreur de connexion')
      } finally {
        setLoading(false)
      }
    }

    loadAuction()
  }, [auctionId, status, router])

  // Initialiser le paiement
  const initPayment = async () => {
    setPaying(true)
    setError('')

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auctionId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'initialisation du paiement')
        setPaying(false)
        return
      }

      setCheckout(data)
      // En mode test, on simule le succes
      // En production, on utiliserait Stripe Elements ici
      setSuccess(true)

    } catch {
      setError('Erreur de connexion au service de paiement')
    } finally {
      setPaying(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-red-500" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Header />
        <main className="max-w-lg mx-auto px-4 py-20 text-center">
          <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <Check size={48} className="text-green-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-3">Paiement confirme !</h1>
          <p className="text-gray-400 mb-2">
            Votre achat de <span className="text-white font-semibold">{auction?.beat.title}</span> est confirme.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Licence {auction?.winningLicense} - {auction?.finalPrice || auction?.currentBid}&euro;
          </p>

          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 mb-8">
            <Award size={32} className="text-red-500 mx-auto mb-3" />
            <h3 className="text-white font-bold mb-2">Votre beat est pret !</h3>
            <p className="text-gray-400 text-sm mb-4">
              Vous pouvez maintenant telecharger vos fichiers depuis votre espace achats.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              Voir mes achats <ArrowRight size={18} />
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (error && !auction) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Header />
        <main className="max-w-lg mx-auto px-4 py-20 text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Erreur</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/marketplace')}
            className="px-6 py-3 rounded-xl bg-[#111111] border border-[#222222] text-white font-semibold"
          >
            Retour au marketplace
          </button>
        </main>
      </div>
    )
  }

  if (!auction) return null

  const amount = auction.finalPrice || auction.currentBid
  const commission = Math.round(amount * 0.15 * 100) / 100
  const producerPayout = Math.round((amount - commission) * 100) / 100

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-10">
        {/* Titre */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-full px-4 py-1.5 text-xs font-semibold text-red-500 mb-4">
            <Lock size={12} /> Paiement securise
          </div>
          <h1 className="text-3xl font-black text-white">Finaliser votre achat</h1>
        </div>

        <div className="grid md:grid-cols-5 gap-6">
          {/* Resume de l'achat */}
          <div className="md:col-span-2">
            <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden sticky top-6">
              {/* Beat info */}
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#1a0a2e] to-[#16213e] flex items-center justify-center">
                    <Music size={24} className="text-white/60" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm">{auction.beat.title}</h3>
                    <p className="text-gray-400 text-xs">
                      par {auction.beat.producer.displayName || auction.beat.producer.name}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="bg-white/5 rounded-md px-2 py-1 text-[10px] text-gray-400">
                    {auction.beat.genre}
                  </span>
                  <span className="bg-white/5 rounded-md px-2 py-1 text-[10px] text-gray-400">
                    {auction.beat.bpm} BPM
                  </span>
                  {auction.beat.key && (
                    <span className="bg-white/5 rounded-md px-2 py-1 text-[10px] text-gray-400">
                      {auction.beat.key}
                    </span>
                  )}
                </div>

                <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">Licence</span>
                    <span className="text-xs font-bold text-red-500">
                      {auction.winningLicense || 'BASIC'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Encheres</span>
                    <span className="text-xs text-gray-300">{auction.totalBids}</span>
                  </div>
                </div>
              </div>

              {/* Prix */}
              <div className="border-t border-[#222222] p-5">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center justify-between w-full text-xs text-gray-400 mb-3"
                >
                  <span>Details du prix</span>
                  {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showDetails && (
                  <div className="space-y-2 mb-3 pb-3 border-b border-[#222222]">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Enchere gagnante</span>
                      <span className="text-gray-300">{amount}&euro;</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Commission plateforme (15%)</span>
                      <span className="text-gray-300">{commission}&euro;</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Part producteur (85%)</span>
                      <span className="text-green-400">{producerPayout}&euro;</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300 font-semibold">Total</span>
                  <span className="text-2xl font-black text-white">{amount}&euro;</span>
                </div>
              </div>
            </div>
          </div>

          {/* Zone de paiement */}
          <div className="md:col-span-3">
            <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <CreditCard size={20} className="text-red-500" /> Methode de paiement
              </h2>

              {/* Stripe Elements placeholder */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Numero de carte</label>
                  <div className="bg-white/5 border border-[#333] rounded-xl px-4 py-3 text-sm text-gray-500">
                    4242 4242 4242 4242
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1">Mode test — Utilisez 4242 4242 4242 4242</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 mb-1.5 block">Expiration</label>
                    <div className="bg-white/5 border border-[#333] rounded-xl px-4 py-3 text-sm text-gray-500">
                      12/28
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 mb-1.5 block">CVC</label>
                    <div className="bg-white/5 border border-[#333] rounded-xl px-4 py-3 text-sm text-gray-500">
                      123
                    </div>
                  </div>
                </div>
              </div>

              {/* Erreur */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              {/* Bouton payer */}
              <button
                onClick={initPayment}
                disabled={paying}
                className="w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                {paying ? (
                  <>
                    <Loader2 size={20} className="animate-spin" /> Traitement en cours...
                  </>
                ) : (
                  <>
                    <Lock size={18} /> Payer {amount}&euro;
                  </>
                )}
              </button>

              {/* Securite */}
              <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-gray-600">
                <span className="flex items-center gap-1">
                  <Shield size={10} /> Paiement securise
                </span>
                <span className="flex items-center gap-1">
                  <Lock size={10} /> Chiffrement SSL
                </span>
                <span>Powered by Stripe</span>
              </div>
            </div>

            {/* Licence info */}
            <div className="bg-[#111111] border border-[#222222] rounded-2xl p-5 mt-4">
              <h3 className="text-sm font-bold text-white mb-3">Ce que vous obtenez :</h3>
              <div className="space-y-2">
                {auction.winningLicense === 'EXCLUSIVE' ? (
                  <>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Fichiers WAV + MP3 + Stems</div>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Droits exclusifs - vous etes le seul proprietaire</div>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Streams illimites + Distribution mondiale</div>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Droits d'edition et de performance</div>
                  </>
                ) : auction.winningLicense === 'PREMIUM' ? (
                  <>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Fichiers WAV + MP3</div>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Jusqu'a 50 000 streams</div>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Usage commercial autorise</div>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Distribution sur toutes les plateformes</div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Fichier MP3</div>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Jusqu'a 5 000 streams</div>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Usage non-commercial</div>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Credit producteur obligatoire</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
