'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { Music, Mic2, ArrowRight, AlertCircle, Sparkles } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session, update } = useSession()
  const [role, setRole] = useState<'ARTIST' | 'PRODUCER' | null>(null)
  const [name, setName] = useState(session?.user?.name ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!role) return
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, name: name.trim() || undefined }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur lors de la configuration')
        return
      }

      // Update the session with new role
      await update({ role: data.user.role, needsOnboarding: false })

      // Redirect to marketplace
      router.push('/marketplace')
      router.refresh()
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <Link href="/" className="flex flex-col items-center gap-3 mb-8">
          <Image
            src="/logo-318-marketplace.png"
            alt="318 LEGAACY Marketplace"
            width={100}
            height={100}
            className="drop-shadow-[0_0_20px_rgba(225,29,72,0.3)]"
          />
          <div className="text-center">
            <span className="font-extrabold text-lg">318 LEGAACY</span>
            <span className="block text-[10px] text-[#e11d48] -mt-0.5 tracking-[3px] font-semibold">
              MARKETPLACE
            </span>
          </div>
        </Link>

        {/* Card */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-8">
          {/* Welcome badge */}
          <div className="flex items-center justify-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#e11d48]/10 border border-[#e11d48]/30 text-[#e11d48] text-xs font-semibold">
              <Sparkles size={14} /> Bienvenue sur 318 LEGAACY
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-white text-center mb-2">
            Dernière étape !
          </h1>
          <p className="text-sm text-gray-400 text-center mb-8">
            Dis-nous qui tu es pour personnalisér ton expérience
          </p>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-6 rounded-lg bg-[#ff475715] border border-[#ff475730] text-[#ff4757] text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Name field (for users who signed in with Apple where name might be hidden) */}
          {(!session?.user?.name || session.user.name.length < 2) && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-400 mb-1.5">
                Ton nom d&apos;artiste
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ton pseudo"
                required
                minLength={2}
                maxLength={50}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4850] transition-colors"
              />
            </div>
          )}

          {/* Role Selection - Big Cards */}
          <div className="space-y-3 mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Je suis...
            </label>

            {/* Artist Card */}
            <button
              type="button"
              onClick={() => setRole('ARTIST')}
              className={`w-full flex items-start gap-4 p-4 rounded-xl text-left transition-all duration-200 ${
                role === 'ARTIST'
                  ? 'bg-[#e11d48]/10 border-2 border-[#e11d48] shadow-[0_0_20px_rgba(225,29,72,0.15)]'
                  : 'bg-white/[0.03] border-2 border-transparent hover:border-[#333] hover:bg-white/[0.05]'
              }`}
            >
              <div
                className={`p-3 rounded-xl ${
                  role === 'ARTIST' ? 'bg-[#e11d48]/20 text-[#e11d48]' : 'bg-white/5 text-gray-400'
                }`}
              >
                <Music size={24} />
              </div>
              <div className="flex-1">
                <h3 className={`font-bold text-base ${role === 'ARTIST' ? 'text-white' : 'text-gray-300'}`}>
                  Artiste / Acheteur
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Tu cherches des instrumentales exclusives. Participe aux enchères et décroche le beat parfait.
                </p>
              </div>
              {role === 'ARTIST' && (
                <div className="w-5 h-5 rounded-full bg-[#e11d48] flex items-center justify-center shrink-0 mt-1">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>

            {/* Producer Card */}
            <button
              type="button"
              onClick={() => setRole('PRODUCER')}
              className={`w-full flex items-start gap-4 p-4 rounded-xl text-left transition-all duration-200 ${
                role === 'PRODUCER'
                  ? 'bg-[#e11d48]/10 border-2 border-[#e11d48] shadow-[0_0_20px_rgba(225,29,72,0.15)]'
                  : 'bg-white/[0.03] border-2 border-transparent hover:border-[#333] hover:bg-white/[0.05]'
              }`}
            >
              <div
                className={`p-3 rounded-xl ${
                  role === 'PRODUCER' ? 'bg-[#e11d48]/20 text-[#e11d48]' : 'bg-white/5 text-gray-400'
                }`}
              >
                <Mic2 size={24} />
              </div>
              <div className="flex-1">
                <h3 className={`font-bold text-base ${role === 'PRODUCER' ? 'text-white' : 'text-gray-300'}`}>
                  Beatmaker / Producteur
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Tu crées des instrumentales. Mets tes beats aux enchères et vends à la communauté.
                </p>
              </div>
              {role === 'PRODUCER' && (
                <div className="w-5 h-5 rounded-full bg-[#e11d48] flex items-center justify-center shrink-0 mt-1">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          </div>

          {role === 'PRODUCER' && (
            <p className="text-xs text-gray-500 bg-white/5 p-3 rounded-lg mb-6">
              En tant que beatmaker, ton compte sera en attente de validation par l&apos;équipe 318 LEGAACY avant de pouvoir mettre des beats en vente.
            </p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!role || loading}
            className="w-full py-3.5 rounded-xl font-extrabold text-black text-base flex items-center justify-center gap-2 disabled:opacity-40 transition-all hover:scale-[1.02]"
            style={{ background: role ? 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' : '#333' }}
          >
            {loading ? (
              <span className="animate-spin w-5 h-5 border-2 border-black/30 border-t-black rounded-full" />
            ) : (
              <>
                C&apos;est parti <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
