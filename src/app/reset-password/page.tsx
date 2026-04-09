'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  useEffect(() => {
    if (!token) {
      setError('Lien invalide. Demande une nouvelle réinitialisation.')
    }
  }, [token])

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = []
    if (pwd.length < 8) {
      errors.push('Minimum 8 caractères')
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push('Au moins une majuscule')
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push('Au moins une minuscule')
    }
    if (!/\d/.test(pwd)) {
      errors.push('Au moins un chiffre')
    }
    return errors
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    if (value) {
      setValidationErrors(validatePassword(value))
    } else {
      setValidationErrors([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    // Validate
    if (!token) {
      setError('Lien invalide')
      return
    }

    if (validationErrors.length > 0) {
      setError('Le mot de passe ne respecte pas tous les critères')
      return
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erreur lors de la réinitialisation')
        return
      }

      setSuccess(true)
      setPassword('')
      setConfirmPassword('')

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login?reset=true')
      }, 2000)
    } catch (err) {
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
          <h1 className="text-2xl font-extrabold text-white mb-1">Réinitialise ton mot de passe</h1>
          <p className="text-sm text-gray-400 mb-6">Crée un nouveau mot de passe sécurisé pour ton compte.</p>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-[#ff475715] border border-[#ff475730] text-[#ff4757] text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-[#2ed57315] border border-[#2ed57330] text-[#2ed573] text-sm">
              <CheckCircle size={16} />
              Mot de passe réinitialisé ! Tu peux te connecter maintenant.
            </div>
          )}

          {!success && token ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Nouveau mot de passe</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
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

                {/* Validation checklist */}
                {password && (
                  <div className="mt-3 space-y-1.5 px-3 py-2 rounded-lg bg-[#13131a] border border-[#1e1e2e]">
                    <p className="text-xs text-gray-400 mb-2">Critères :</p>
                    <div className="space-y-1">
                      <div className={`text-xs flex items-center gap-2 ${password.length >= 8 ? 'text-[#2ed573]' : 'text-[#ff4757]'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${password.length >= 8 ? 'bg-[#2ed573]' : 'bg-[#ff4757]'}`} />
                        Minimum 8 caractères
                      </div>
                      <div className={`text-xs flex items-center gap-2 ${/[A-Z]/.test(password) ? 'text-[#2ed573]' : 'text-[#ff4757]'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${/[A-Z]/.test(password) ? 'bg-[#2ed573]' : 'bg-[#ff4757]'}`} />
                        Au moins une majuscule
                      </div>
                      <div className={`text-xs flex items-center gap-2 ${/[a-z]/.test(password) ? 'text-[#2ed573]' : 'text-[#ff4757]'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${/[a-z]/.test(password) ? 'bg-[#2ed573]' : 'bg-[#ff4757]'}`} />
                        Au moins une minuscule
                      </div>
                      <div className={`text-xs flex items-center gap-2 ${/\d/.test(password) ? 'text-[#2ed573]' : 'text-[#ff4757]'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${/\d/.test(password) ? 'bg-[#2ed573]' : 'bg-[#ff4757]'}`} />
                        Au moins un chiffre
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirme le mot de passe</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4850] transition-colors pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-[#ff4757] mt-1.5">Les mots de passe ne correspondent pas</p>
                )}
                {confirmPassword && password === confirmPassword && password && (
                  <p className="text-xs text-[#2ed573] mt-1.5">Les mots de passe correspondent</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || validationErrors.length > 0 || password !== confirmPassword || !password}
                className="w-full py-3.5 rounded-xl font-extrabold text-black text-base flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                {loading ? (
                  <span className="animate-spin w-5 h-5 border-2 border-black/30 border-t-black rounded-full" />
                ) : (
                  <>
                    <Lock size={18} /> Réinitialiser
                  </>
                )}
              </button>
            </form>
          ) : null}

          <p className="text-center mt-5 text-sm text-gray-400">
            <Link
              href="/login"
              className="text-[#e11d48] font-semibold hover:underline flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} /> Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
