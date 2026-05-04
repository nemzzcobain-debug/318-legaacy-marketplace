'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'waiting'>('waiting')
  const [message, setMessage] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Si le token est dans l'URL, rediriger vers l'API qui gère la vérification
  // et redirige ensuite vers /login?verified=true
  useEffect(() => {
    if (token) {
      setStatus('loading')
      // Naviguer directement vers l'API — le serveur vérifié le token
      // et redirige le navigateur vers /login?verified=true ou /login?error=...
      window.location.href = `/api/auth/verify-email?token=${token}`
    }
  }, [token])

  const handleResendEmail = async () => {
    if (!email || resendCooldown > 0) return

    setResendLoading(true)
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Un nouveau lien de confirmation t\'a été envoyé. Vérifie ta boîte mail.')
        setResendCooldown(60)
      } else {
        setMessage(data.error || 'Erreur lors de l\'envoi du lien')
      }
    } catch (error) {
      setMessage('Erreur de connexion au serveur')
    } finally {
      setResendLoading(false)
    }
  }

  // Gerer le cooldown du bouton
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-10">
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
          {status === 'loading' && (
            <>
              <div className="flex justify-center mb-6">
                <Loader2 size={48} className="text-[#e11d48] animate-spin" />
              </div>
              <h1 className="text-2xl font-extrabold text-white mb-2 text-center">Verification en cours...</h1>
              <p className="text-sm text-gray-400 text-center">Nous verifions ton email. Patiente un instant.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center mb-6">
                <CheckCircle size={48} className="text-[#2ed573]" />
              </div>
              <h1 className="text-2xl font-extrabold text-white mb-2 text-center">Email confirmé ! ✅</h1>
              <p className="text-sm text-gray-400 text-center mb-6">Ton adresse email a été confirmée avec succès. Tu peux maintenant te connecter.</p>
              <Link
                href="/login"
                className="w-full py-3.5 rounded-xl font-extrabold text-black text-base flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                Aller a la connexion
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center mb-6">
                <AlertCircle size={48} className="text-[#ff4757]" />
              </div>
              <h1 className="text-2xl font-extrabold text-white mb-2 text-center">Erreur de vérification</h1>
              <p className="text-sm text-gray-400 text-center mb-4">{message}</p>
              <button
                onClick={handleResendEmail}
                disabled={resendLoading || resendCooldown > 0}
                className="w-full py-3.5 rounded-xl font-extrabold text-black text-base flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                {resendLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Envoi en cours...
                  </>
                ) : resendCooldown > 0 ? (
                  <>
                    <Mail size={18} /> Renvoyer ({resendCooldown}s)
                  </>
                ) : (
                  <>
                    <Mail size={18} /> Renvoyer le lien de confirmation
                  </>
                )}
              </button>
            </>
          )}

          {status === 'waiting' && email && (
            <>
              <div className="flex justify-center mb-6">
                <Mail size={48} className="text-[#e11d48]" />
              </div>
              <h1 className="text-2xl font-extrabold text-white mb-2 text-center">Verifie ton email</h1>
              <p className="text-sm text-gray-400 text-center mb-4">
                Un lien de confirmation a été envoyé a <strong className="text-white">{email}</strong>
              </p>
              <p className="text-sm text-gray-500 text-center mb-6">
                Clique sur le lien dans l&apos;email pour confirmer ton adresse et activer ton compte.
              </p>

              {message && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-[#2ed57315] border border-[#2ed57330] text-[#2ed573] text-sm">
                  <CheckCircle size={16} />
                  {message}
                </div>
              )}

              <div className="space-y-3">
                <div className="bg-white/5 border border-[#1e1e2e] rounded-lg p-4 text-xs text-gray-400">
                  <p className="font-semibold text-white mb-2">💡 Conseil :</p>
                  <ul className="space-y-1">
                    <li>✓ Verifie ta boite d&apos;entree (et le dossier Spam)</li>
                    <li>✓ Le lien expire dans 24 heures</li>
                    <li>✓ Tu peux demander un nouveau lien ci-dessous</li>
                  </ul>
                </div>

                <button
                  onClick={handleResendEmail}
                  disabled={resendLoading || resendCooldown > 0}
                  className="w-full py-3 rounded-xl font-semibold text-sm border-2 border-[#e11d48] text-[#e11d48] hover:bg-[#e11d48]/10 transition-all disabled:opacity-50"
                >
                  {resendLoading ? (
                    <>
                      <Loader2 size={16} className="inline animate-spin mr-2" /> Envoi en cours...
                    </>
                  ) : resendCooldown > 0 ? (
                    <>Renvoyer le lien ({resendCooldown}s)</>
                  ) : (
                    <>Renvoyer le lien de confirmation</>
                  )}
                </button>

                <Link
                  href="/login"
                  className="w-full py-3 rounded-xl font-semibold text-sm bg-white/5 border border-[#1e1e2e] text-gray-400 hover:border-[#e11d48] hover:text-white transition-all text-center"
                >
                  Retour a la connexion
                </Link>
              </div>
            </>
          )}

          {status === 'waiting' && !email && (
            <>
              <h1 className="text-2xl font-extrabold text-white mb-2">Verification email</h1>
              <p className="text-sm text-gray-400 mb-6">Vérifiez votre email pour activer votre compte.</p>
              <Link
                href="/register"
                className="w-full py-3.5 rounded-xl font-extrabold text-black text-base flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                Retour a l&apos;inscription
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
