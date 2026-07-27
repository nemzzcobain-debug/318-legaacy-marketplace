'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import { RefreshCw, Loader2, ArrowLeft } from 'lucide-react'

export default function StripeRefreshPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const retryOnboarding = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      const data = await res.json()

      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl
      } else if (data.status === 'active') {
        router.push('/producers/stripe/complete')
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-lg mx-auto px-4 py-20 text-center">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="mb-8 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft size={17} />
          Retour au tableau de bord
        </button>
        <RefreshCw size={48} className="text-yellow-400 mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-white mb-3">Session expirée</h1>
        <p className="text-gray-400 mb-8">
          Votre session d'onboarding Stripe a expiré. Cliquez ci-dessous pour reprendre la configuration.
        </p>
        <button
          onClick={retryOnboarding}
          disabled={loading}
          className="px-8 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Chargement...</>
          ) : (
            <><RefreshCw size={18} /> Reprendre la configuration</>
          )}
        </button>
      </main>
    </div>
  )
}
