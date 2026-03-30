'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import Header from '@/components/layout/Header'
import {
  CreditCard, Shield, Lock, Check, AlertCircle, Loader2,
  Music, Award, ArrowRight, ChevronDown, ChevronUp
} from 'lucide-react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

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

// Composant de formulaire de paiement Stripe
function PaymentForm({ amount, onSuccess, onError }: {
  amount: number
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
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        options={{
          layout: 'tabs',
          defaultValues: { billingDetails: { address: { country: 'FR' } } },
        }}
      />

      <button
        type="submit"
        disabled={!stripe || paying}
        className="w-full mt-6 py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:scale-[1.02]"
        style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
      >
        {paying ? (
          <><Loader2 size={20} className="animate-spin" /> Traitement en cours...</>
        ) : (
          <><Lock size={18} /> Payer {amount}&euro;</>
        )}
      </button>
    </form>
  )
}

export default function CheckoutPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const auctionId = params.id as string

  const [auction, setAuction] = useState<AuctionInfo | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  // Charger l'enchere
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

  // Initialiser le PaymentIntent quand l'enchere est chargee
  useEffect(() => {
    if (!auction || success || clientSecret) return

    async function initPayment() {
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auctionId }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Erreur lors de l\'initialisation du paiement')
          return
        }

        setClientSecret(data.clientSecret)
      } catch {
        setError('Erreur de connexion au service de paiement')
      }
    }

    initPayment()
  }, [auction, success, clientSecret, auctionId])

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
                  <span className="bg-white/5 rounded-md px-2 py-1 text-[10px] text-gray-400">{auction.beat.genre}</span>
                  <span className="bg-white/5 rounded-md px-2 py-1 text-[10px] text-gray-400">{auction.beat.bpm} BPM</span>
                  {auction.beat.key && (
                    <span className="bg-white/5 rounded-md px-2 py-1 text-[10px] text-gray-400">{auction.beat.key}</span>
                  )}
                </div>

                <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">Licence</span>
                    <span className="text-xs font-bold text-red-500">{auction.winningLicense || 'BASIC'}</span>
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

          {/* Zone de paiement Stripe Elements */}
          <div className="md:col-span-3">
            <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <CreditCard size={20} className="text-red-500" /> Methode de paiement
              </h2>

              {/* Erreur */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              {/* Stripe Elements */}
              {clientSecret ? (
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: 'night',
                      variables: {
                        colorPrimary: '#e11d48',
                        colorBackground: '#0a0a0a',
                        colorText: '#ffffff',
                        colorDanger: '#ff4444',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        borderRadius: '12px',
                        spacingUnit: '4px',
                      },
                      rules: {
                        '.Input': {
                          border: '1px solid #333',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          padding: '12px 16px',
                        },
                        '.Input:focus': {
                          border: '1px solid #e11d48',
                          boxShadow: '0 0 0 1px #e11d48',
                        },
                        '.Label': {
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#9ca3af',
                        },
                      },
                    },
                  }}
                >
                  <PaymentForm
                    amount={amount}
                    onSuccess={() => setSuccess(true)}
                    onError={setError}
                  />
                </Elements>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-red-500 mr-2" />
                  <span className="text-gray-400 text-sm">Chargement du formulaire de paiement...</span>
                </div>
              )}

              {/* Securite */}
              <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-gray-600">
                <span className="flex items-center gap-1"><Shield size={10} /> Paiement securise</span>
                <span className="flex items-center gap-1"><Lock size={10} /> Chiffrement SSL</span>
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
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Droits d&apos;edition et de performance</div>
                  </>
                ) : auction.winningLicense === 'PREMIUM' ? (
                  <>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Fichiers WAV + MP3</div>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Jusqu&apos;a 50 000 streams</div>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Usage commercial autorise</div>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Distribution sur toutes les plateformes</div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Fichier MP3</div>
                    <div className="flex items-center gap-2 text-xs text-gray-300"><Check size={14} className="text-green-400" /> Jusqu&apos;a 5 000 streams</div>
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
