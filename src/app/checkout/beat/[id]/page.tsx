'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import {
  CreditCard,
  Shield,
  Lock,
  Check,
  AlertCircle,
  Loader2,
  Music,
  ArrowLeft,
  Star,
  Crown,
  Sparkles,
} from 'lucide-react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const LICENSE_META: Record<string, { name: string; icon: any; color: string; rights: string }> = {
  BASIC: {
    name: 'Basic',
    icon: Star,
    color: 'text-gray-400',
    rights: 'MP3 - 5000 streams - Non-commercial',
  },
  PREMIUM: {
    name: 'Premium',
    icon: Crown,
    color: 'text-[#e11d48]',
    rights: 'WAV + MP3 - 50K streams - Commercial',
  },
  EXCLUSIVE: {
    name: 'Exclusive',
    icon: Sparkles,
    color: 'text-amber-400',
    rights: 'WAV + Stems - Illimite',
  },
}

// Payment Form Component
function PaymentForm({
  amount,
  onSuccess,
  onError,
}: {
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
          <>
            <Loader2 size={20} className="animate-spin" /> Traitement en cours...
          </>
        ) : (
          <>
            <Lock size={18} /> Payer {amount}&euro;
          </>
        )}
      </button>
    </form>
  )
}

export default function BeatCheckoutPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()

  const beatId = params.id as string
  const clientSecretParam = searchParams.get('cs')
  const licenseType = searchParams.get('license') || 'BASIC'
  const price = parseFloat(searchParams.get('price') || '0')
  const beatTitle = decodeURIComponent(searchParams.get('title') || '')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const licenseMeta = LICENSE_META[licenseType] || LICENSE_META.BASIC
  const LicenseIcon = licenseMeta.icon

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-red-500" size={40} />
      </div>
    )
  }

  if (!clientSecretParam || !price) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
          <h2 className="text-lg font-bold text-white mb-2">Session de paiement invalide</h2>
          <p className="text-sm text-gray-400 mb-4">
            Retourne a la page Nouveautes pour recommencer
          </p>
          <button
            onClick={() => router.push('/nouveautes')}
            className="px-6 py-3 rounded-xl font-bold text-sm text-black"
            style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
          >
            Retour aux Nouveautes
          </button>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <Check size={40} className="text-green-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-3">Achat confirme !</h2>
          <p className="text-gray-400 mb-2">
            Tu as achete <span className="text-white font-bold">{beatTitle}</span> avec la licence{' '}
            <span className={`font-bold ${licenseMeta.color}`}>{licenseMeta.name}</span>.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Tu recevras un email avec les fichiers et ta licence. Merci pour ton achat !
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/nouveautes')}
              className="px-6 py-3 rounded-xl font-bold text-sm text-gray-400 border border-[#1e1e2e] hover:text-white transition"
            >
              Continuer les achats
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 rounded-xl font-bold text-sm text-black"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              Mon Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Back */}
        <button
          onClick={() => router.push('/nouveautes')}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 transition"
        >
          <ArrowLeft size={16} /> Retour
        </button>

        {/* Order Summary */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Resume de la commande</h2>

          <div className="flex items-center gap-4 mb-4 pb-4 border-b border-[#1e1e2e]">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#1a1a2e] to-[#0a0a0f] flex items-center justify-center">
              <Music size={20} className="text-gray-500" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white">{beatTitle}</div>
              <div className="flex items-center gap-2 mt-1">
                <LicenseIcon size={12} className={licenseMeta.color} />
                <span className={`text-xs font-bold ${licenseMeta.color}`}>
                  Licence {licenseMeta.name}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">{licenseMeta.rights}</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-white">{price} EUR</span>
            </div>
          </div>

          {/* Security badges */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Shield size={12} className="text-green-500" />
              <span>Paiement securise</span>
            </div>
            <div className="flex items-center gap-1">
              <CreditCard size={12} />
              <span>Stripe</span>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <CreditCard size={16} className="text-[#e11d48]" />
            Informations de paiement
          </h3>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 mb-4">
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: clientSecretParam,
              appearance: {
                theme: 'night',
                variables: {
                  colorPrimary: '#e11d48',
                  colorBackground: '#0a0a0a',
                  colorText: '#ffffff',
                  colorDanger: '#ef4444',
                  borderRadius: '12px',
                },
              },
            }}
          >
            <PaymentForm amount={price} onSuccess={() => setSuccess(true)} onError={setError} />
          </Elements>
        </div>

        {/* Trust footer */}
        <p className="text-center text-[10px] text-gray-600 mt-6">
          En payant, tu acceptes les conditions generales de 318 LEGAACY Marketplace. Les fichiers
          seront disponibles immediatement apres confirmation du paiement.
        </p>
      </div>
    </div>
  )
}
