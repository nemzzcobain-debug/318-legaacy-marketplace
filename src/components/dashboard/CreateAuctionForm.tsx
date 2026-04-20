'use client'

import { useState, useEffect } from 'react'
import { Gavel, Music, Loader2, Check, Plus } from 'lucide-react'

interface Beat {
  id: string
  title: string
  genre: string
  bpm: number
  coverImage: string | null
}

const DURATIONS = [
  { value: 1, label: '1 heure' },
  { value: 6, label: '6 heures' },
  { value: 12, label: '12 heures' },
  { value: 24, label: '24 heures' },
  { value: 48, label: '2 jours' },
  { value: 72, label: '3 jours' },
  { value: 168, label: '7 jours' },
]

export default function CreateAuctionForm({ onCreated }: { onCreated?: () => void }) {
  const [beats, setBeats] = useState<Beat[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  // Form fields
  const [beatId, setBeatId] = useState('')
  const [startPrice, setStartPrice] = useState('10')
  const [reservePrice, setReservePrice] = useState('')
  const [buyNowPrice, setBuyNowPrice] = useState('')
  const licenseType = 'EXCLUSIVE' // Encheres = licence exclusive uniquement
  const [durationHours, setDurationHours] = useState('24')
  const [bidIncrement, setBidIncrement] = useState('5')

  useEffect(() => {
    fetchBeats()
  }, [])

  const fetchBeats = async () => {
    try {
      const res = await fetch('/api/beats?mine=true')
      if (res.ok) {
        const data = await res.json()
        setBeats(data.beats || [])
      }
    } catch (err) {
      console.error('Error fetching beats:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!beatId) {
      setError('Selectionne un beat')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/auctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beatId,
          startPrice: parseFloat(startPrice),
          reservePrice: reservePrice ? parseFloat(reservePrice) : undefined,
          buyNowPrice: buyNowPrice ? parseFloat(buyNowPrice) : undefined,
          licenseType,
          durationHours: parseInt(durationHours),
          bidIncrement: parseFloat(bidIncrement),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur lors de la creation')
        return
      }

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setShowForm(false)
        onCreated?.()
      }, 2000)
    } catch (err) {
      setError('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Enchere creee !</h3>
          <p className="text-sm text-gray-400">Ton enchere est maintenant active</p>
        </div>
      </div>
    )
  }

  if (!showForm) {
    return (
      <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
        <div className="text-center py-12">
          <Gavel size={48} className="mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-bold text-white mb-2">Cree ta premiere enchere</h3>
          <p className="text-sm text-gray-400 mb-5">
            Mets un de tes beats aux encheres et commence a vendre
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-black"
            style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
          >
            <Plus size={16} /> Nouvelle enchere
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-6">
      <h2 className="text-lg font-bold text-white mb-6">Nouvelle enchere</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Beat selection */}
        <div>
          <label className="text-sm font-semibold text-white mb-2 block">
            Selectionner un beat <span className="text-red-400">*</span>
          </label>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 size={16} className="animate-spin" /> Chargement des beats...
            </div>
          ) : beats.length === 0 ? (
            <p className="text-sm text-gray-400">
              Aucun beat disponible. Uploade un beat d&apos;abord.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {beats.map((beat) => (
                <button
                  key={beat.id}
                  type="button"
                  onClick={() => setBeatId(beat.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                    beatId === beat.id
                      ? 'border-[#e11d48] bg-[#e11d4810]'
                      : 'border-[#1e1e2e] hover:border-[#e11d4840]'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center flex-shrink-0">
                    <Music size={16} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{beat.title}</div>
                    <div className="text-xs text-gray-500">
                      {beat.genre} - {beat.bpm} BPM
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Price row */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="startPrice" className="text-sm font-semibold text-white mb-2 block">
              Prix de depart <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                id="startPrice"
                type="number"
                value={startPrice}
                onChange={(e) => setStartPrice(e.target.value)}
                min="1"
                step="0.01"
                className="w-full bg-[#0a0a0a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e11d4840] pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                &euro;
              </span>
            </div>
          </div>
          <div>
            <label htmlFor="reservePrice" className="text-sm font-semibold text-white mb-2 block">
              Prix reserve
            </label>
            <div className="relative">
              <input
                id="reservePrice"
                type="number"
                value={reservePrice}
                onChange={(e) => setReservePrice(e.target.value)}
                min="0"
                step="0.01"
                placeholder="Optionnel"
                className="w-full bg-[#0a0a0a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4840] pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                &euro;
              </span>
            </div>
          </div>
          <div>
            <label htmlFor="buyNowPrice" className="text-sm font-semibold text-white mb-2 block">
              Achat immediat
            </label>
            <div className="relative">
              <input
                id="buyNowPrice"
                type="number"
                value={buyNowPrice}
                onChange={(e) => setBuyNowPrice(e.target.value)}
                min="0"
                step="0.01"
                placeholder="Optionnel"
                className="w-full bg-[#0a0a0a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4840] pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                &euro;
              </span>
            </div>
          </div>
        </div>

        {/* License info (exclusive only for auctions) */}
        <div className="bg-[#0a0a0a] border border-[#1e1e2e] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#e11d48] to-[#ff0033] flex items-center justify-center flex-shrink-0">
              <Gavel size={16} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Licence Exclusive</div>
              <div className="text-xs text-gray-500">
                Les encheres sont exclusivement pour les droits exclusifs (WAV + Stems - Illimite)
              </div>
            </div>
          </div>
        </div>

        {/* Duration + Increment */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-white mb-2 block">Duree</label>
            <select
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e11d4840]"
            >
              {DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-white mb-2 block">Increment minimum</label>
            <div className="relative">
              <input
                type="number"
                value={bidIncrement}
                onChange={(e) => setBidIncrement(e.target.value)}
                min="1"
                step="0.01"
                className="w-full bg-[#0a0a0a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e11d4840] pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                &euro;
              </span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="px-6 py-3 rounded-xl font-bold text-sm text-gray-400 border border-[#1e1e2e] hover:text-white transition"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting || !beatId}
            className="flex-1 py-3 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 transition disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Creation...
              </>
            ) : (
              <>
                <Gavel size={16} /> Lancer l&apos;enchere
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
