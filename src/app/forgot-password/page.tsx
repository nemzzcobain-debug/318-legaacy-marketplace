'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erreur lors de la demande')
        return
      }

      setSuccess(true)
      setEmail('')
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
          <h1 className="text-2xl font-extrabold text-white mb-1">Mot de passe oublie ?</h1>
          <p className="text-sm text-gray-400 mb-6">
            Entre ton adresse email pour recevoir un lien de réinitialisation.
          </p>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-[#ff475715] border border-[#ff475730] text-[#ff4757] text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-[#2ed57315] border border-[#2ed57330] text-[#2ed573] text-sm">
              <CheckCircle size={16} />
              Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.
            </div>
          )}

          {!success ? (
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
                    <Mail size={18} /> Envoyer le lien
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-400 text-sm mb-4">
                Verifie ton adresse email pour le lien de réinitialisation.
              </p>
              <p className="text-gray-500 text-xs mb-6">
                Le lien expire dans 1 heure.
              </p>
            </div>
          )}

          <p className="text-center mt-5 text-sm text-gray-400">
            <Link
              href="/login"
              className="text-[#e11d48] font-semibold hover:underline flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} /> Retour a la connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
