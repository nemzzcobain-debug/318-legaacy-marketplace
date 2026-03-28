'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Eye, EyeOff, AlertCircle, Music, Mic } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'ARTIST' as 'ARTIST' | 'PRODUCER',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'inscription')
        return
      }

      // Rediriger vers login
      router.push('/login?registered=true')
    } catch {
      setError('Erreur serveur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-10">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl text-black"
            style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
          >
            3
          </div>
          <div>
            <span className="font-extrabold text-lg">318 LEGAACY</span>
            <span className="block text-[10px] text-[#e11d48] -mt-0.5 tracking-[3px] font-semibold">
              MARKETPLACE
            </span>
          </div>
        </Link>

        {/* Card */}
        <div className="bg-[#13131a] border border-[#1e1e2e] rounded-2xl p-8">
          <h1 className="text-2xl font-extrabold text-white mb-1">Creer un compte</h1>
          <p className="text-sm text-gray-400 mb-6">Rejoins la marketplace</p>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-[#ff475715] border border-[#ff475730] text-[#ff4757] text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Je suis</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'ARTIST', label: 'Artiste / Rappeur', icon: Mic, desc: 'J\'achete des beats' },
                  { value: 'PRODUCER', label: 'Producteur', icon: Music, desc: 'Je vends mes beats' },
                ].map(({ value, label, icon: Icon, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm({ ...form, role: value as any })}
                    className={`p-3.5 rounded-xl text-left transition-all border ${
                      form.role === value
                        ? 'bg-[#e11d4810] border-[#e11d4840] text-[#e11d48]'
                        : 'bg-white/[0.02] border-[#1e1e2e] text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <Icon size={20} className="mb-1.5" />
                    <div className="text-sm font-bold">{label}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Nom / Pseudo</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ton nom d'artiste"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4850] transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="ton@email.com"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4850] transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Minimum 8 caracteres"
                  required
                  minLength={8}
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

            {form.role === 'PRODUCER' && (
              <div className="p-3 rounded-lg bg-[#e11d4808] border border-[#e11d4815] text-xs text-gray-400">
                En tant que producteur, ton compte devra etre approuve par notre equipe
                avant de pouvoir mettre des beats en vente. Tu seras notifie par email.
              </div>
            )}

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
                  <UserPlus size={18} /> Creer mon compte
                </>
              )}
            </button>
          </form>

          <p className="text-center mt-5 text-sm text-gray-400">
            Deja un compte ?{' '}
            <Link href="/login" className="text-[#e11d48] font-semibold hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
