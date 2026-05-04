'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import { RefreshCw, Loader2 } from 'lucide-react'

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
