'use client'

import { useState } from 'react'
import { Tag, Check, X, Loader2 } from 'lucide-react'

interface PromoResult {
  valid: boolean
  promoId: string
  code: string
  type: string
  value: number
  discount: number
  originalPrice: number
  finalPrice: number
}

interface PromoCodeInputProps {
  auctionId: string
  price: number
  onPromoApplied: (result: PromoResult | null) => void
}

export default function PromoCodeInput({ auctionId, price, onPromoApplied }: PromoCodeInputProps) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [applied, setApplied] = useState<PromoResult | null>(null)

  const validateCode = async () => {
    if (!code.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          auctionId,
          price,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Code invalide')
        setApplied(null)
        onPromoApplied(null)
        return
      }

      setApplied(data)
      onPromoApplied(data)
    } catch {
      setError('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  const removePromo = () => {
    setApplied(null)
    setCode('')
    setError('')
    onPromoApplied(null)
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <Check size={16} className="text-green-400" />
          <span className="text-sm font-bold text-green-400">{applied.code}</span>
          <span className="text-xs text-green-400/70">
            -{applied.type === 'PERCENTAGE' ? `${applied.value}%` : `${applied.value}€`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-green-400">-{applied.discount.toFixed(2)}€</span>
          <button
            onClick={removePromo}
            className="p-1 hover:bg-green-500/20 rounded-lg transition"
          >
            <X size={14} className="text-green-400" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && validateCode()}
            placeholder="Code promo"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-red-500/50 focus:outline-none uppercase tracking-wider font-bold"
            maxLength={20}
          />
        </div>
        <button
          onClick={validateCode}
          disabled={!code.trim() || loading}
          className="px-5 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-40"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Appliquer'}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-400 mt-1.5 pl-1">{error}</p>
      )}
    </div>
  )
}
