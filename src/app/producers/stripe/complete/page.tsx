'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import { Check, Loader2, ArrowRight } from 'lucide-react'

export default function StripeCompletePage() {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'active' | 'pending'>('checking')

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/stripe/connect')
        const data = await res.json()

        if (data.status === 'active') {
          setStatus('active')
        } else {
          setStatus('pending')
        }
      } catch {
        setStatus('pending')
      }
    }

    checkStatus()
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-lg mx-auto px-4 py-20 text-center">
        {status === 'checking' ? (
          <>
            <Loader2 size={48} className="animate-spin text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Verification en cours...</h1>
            <p className="text-gray-400">Nous verifions votre compte Stripe.</p>
          </>
        ) : status === 'active' ? (
          <>
            <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <Check size={48} className="text-green-400" />
            </div>
            <h1 className="text-3xl font-black text-white mb-3">Compte Stripe actif !</h1>
            <p className="text-gray-400 mb-8">
              Votre compte de paiement est configure. Vous pouvez maintenant recevoir des paiements
              quand vos beats sont vendus aux enchères.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-8 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 mx-auto"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              Aller au dashboard <ArrowRight size={18} />
            </button>
          </>
        ) : (
          <>
            <div className="w-24 h-24 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
              <Loader2 size={48} className="text-yellow-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Configuration en cours</h1>
            <p className="text-gray-400 mb-4">
              Votre compte Stripe est en cours de vérification. Cela peut prendre quelques minutes.
            </p>
            <p className="text-gray-500 text-sm mb-8">
              Vous recevrez une notification quand votre compte sera actif.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-8 py-3 rounded-xl font-bold text-white bg-[#111111] border border-[#222222]"
            >
              Retour au dashboard
            </button>
          </>
        )}
      </main>
    </div>
  )
}
