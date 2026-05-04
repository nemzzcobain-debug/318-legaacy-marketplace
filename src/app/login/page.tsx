'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import Image from 'next/image'
import { LogIn, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import SocialLoginButtons from '@/components/ui/SocialLoginButtons'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const verified = searchParams.get('verified')
    const resetSuccess = searchParams.get('reset')
    const errorParam = searchParams.get('error')

    if (verified === 'true') {
      setSuccess('Email confirmé ! Tu peux te connecter.')
    } else if (resetSuccess === 'true') {
      setSuccess('Mot de passe réinitialisé ! Tu peux te connecter.')
    } else if (errorParam) {
      // Gérer toutes les erreurs NextAuth OAuth + verification
      const errorMessages: Record<string, string> = {
        'invalid-token': 'Le lien de confirmation est invalide ou a expiré.',
        'token-expired': 'Le lien de confirmation a expiré. Tu peux demander un nouveau lien.',
        'server-error': 'Une erreur est survenue. Veuillez réessayer plus tard.',
        'OAuthSignin': 'Erreur lors de la connexion Google. Verifie que ton compte Google est valide.',
        'OAuthCallback': 'Erreur de retour Google. Reessaie la connexion.',
        'OAuthCreateAccount': 'Impossible de créer ton compte via Google. Essaie de t\'inscrire par email.',
        'OAuthAccountNotLinked': 'Cet email est déjà utilisé avec un autre mode de connexion. Connecte-toi avec ton mot de passe.',
        'Callback': 'Erreur lors de la connexion. Reessaie.',
        'AccessDenied': 'Accès refusé. Vérifie tes permissions.',
        'Configuration': 'Erreur de configuration du serveur. Contacte l\'administrateur.',
      }
      setError(errorMessages[errorParam] || `Erreur de connexion (${errorParam}). Reessaie ou utilise un autre mode de connexion.`)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        // Message d'erreur personnalisé pour email non vérifié
        if (result.error === 'EMAIL_NOT_VERIFIED') {
          setError('Vérifie ton email avant de te connecter. Un lien de confirmation t\'a été envoyé.')
        } else {
          setError(result.error)
        }
      } else {
        router.push('/marketplace')
        router.refresh()
      }
    } catch {
      setError('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex flex-col items-center gap-3 mb-10">
          <Image
            src="/logo-318-marketplace.png"
            alt="318 LEGAACY Marketplace"
            width={120}
            height={120}
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
          <h1 className="text-2xl font-extrabold text-white mb-1">Connexion</h1>
          <p className="text-sm text-gray-400 mb-6">Accède à tes enchères</p>

          {success && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-[#2ed57315] border border-[#2ed57330] text-[#2ed573] text-sm">
              <CheckCircle size={16} />
              {success}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-[#ff475715] border border-[#ff475730] text-[#ff4757] text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Social Login */}
          <SocialLoginButtons callbackUrl="/marketplace" label="login" />

          {/* Separator */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#1e1e2e]" />
            <span className="text-xs text-gray-500 font-medium uppercase">ou par email</span>
            <div className="flex-1 h-px bg-[#1e1e2e]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.com"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4850] transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-400">Mot de passe</label>
                <Link href="/forgot-password" className="text-xs text-[#e11d48] hover:underline font-medium">
                  Oublie ?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4850] transition-colors pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-extrabold text-black text-base flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              {loading ? (
                <span className="animate-spin w-5 h-5 border-2 border-black/30 border-t-black rounded-full" />
              ) : (
                <>
                  <LogIn size={18} /> Se connecter
                </>
              )}
            </button>
          </form>

          <p className="text-center mt-5 text-sm text-gray-400">
            Pas encore de compte ?{' '}
            <Link href="/register" className="text-[#e11d48] font-semibold hover:underline">
              S&apos;inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
