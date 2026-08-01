'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  FileAudio,
  Gavel,
  Layers,
  Loader2,
  Save,
  ShoppingBag,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import { GENRES, MOODS } from '@/types'

const KEYS = [
  'C Major',
  'C# Major',
  'D Major',
  'D# Major',
  'E Major',
  'F Major',
  'F# Major',
  'G Major',
  'G# Major',
  'A Major',
  'A# Major',
  'B Major',
  'C Minor',
  'C# Minor',
  'D Minor',
  'D# Minor',
  'E Minor',
  'F Minor',
  'F# Minor',
  'G Minor',
  'G# Minor',
  'A Minor',
  'A# Minor',
  'B Minor',
]

const DURATIONS = [
  { value: 0.25, label: '15 minutes' },
  { value: 0.5, label: '30 minutes' },
  ...Array.from({ length: 24 }, (_, index) => ({
    value: index + 1,
    label: `${index + 1} heure${index > 0 ? 's' : ''}`,
  })),
  { value: 48, label: '2 jours' },
  { value: 72, label: '3 jours' },
  { value: 168, label: '7 jours' },
]

const EXTENSIONS = [1, 3, 6, 12, 24, 48]

interface AuctionData {
  id: string
  status: string
  startPrice: number
  currentBid: number
  buyNowPrice: number | null
  startTime: string
  endTime: string
  totalBids: number
  _count: { bids: number }
}

interface BeatData {
  id: string
  title: string
  description: string | null
  genre: string
  mood: string | null
  bpm: number
  key: string | null
  tags: string
  priceMp3: number | null
  priceWav: number | null
  saleMode: 'AUCTION' | 'LEASING'
  status: string
  rejectionType: string | null
  rejectionReason: string | null
  hasMp3: boolean
  hasWav: boolean
  hasStems: boolean
  auction: AuctionData | null
}

interface Capabilities {
  canEditMetadata: boolean
  canEditAuctionSettings: boolean
  canExtendAuction: boolean
  lockedReason: string | null
}

function toLocalInput(dateValue: string) {
  const date = new Date(dateValue)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatDate(dateValue: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateValue))
}

function getDurationHours(auction: AuctionData) {
  const duration =
    (new Date(auction.endTime).getTime() - new Date(auction.startTime).getTime()) / 3_600_000
  return DURATIONS.some((option) => option.value === duration) ? String(duration) : '24'
}

export default function EditBeatPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [beat, setBeat] = useState<BeatData | null>(null)
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [extending, setExtending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [extensionHours, setExtensionHours] = useState('24')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [genre, setGenre] = useState('')
  const [mood, setMood] = useState('')
  const [bpm, setBpm] = useState('')
  const [key, setKey] = useState('')
  const [tags, setTags] = useState('')
  const [priceMp3, setPriceMp3] = useState('')
  const [priceWav, setPriceWav] = useState('')
  const [startPrice, setStartPrice] = useState('')
  const [buyNowPrice, setBuyNowPrice] = useState('')
  const [durationHours, setDurationHours] = useState('24')
  const [startAt, setStartAt] = useState('')

  const loadBeat = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/beats/${params.id}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Impossible de charger ce beat.')

      const loadedBeat = data.beat as BeatData
      setBeat(loadedBeat)
      setCapabilities(data.capabilities)
      setTitle(loadedBeat.title || '')
      setDescription(loadedBeat.description || '')
      setGenre(loadedBeat.genre || '')
      setMood(loadedBeat.mood || '')
      setBpm(String(loadedBeat.bpm || ''))
      setKey(loadedBeat.key || '')
      try {
        setTags(JSON.parse(loadedBeat.tags || '[]').join(', '))
      } catch {
        setTags(loadedBeat.tags || '')
      }
      setPriceMp3(loadedBeat.priceMp3 ? String(loadedBeat.priceMp3) : '')
      setPriceWav(loadedBeat.priceWav ? String(loadedBeat.priceWav) : '')
      if (loadedBeat.auction) {
        setStartPrice(String(loadedBeat.auction.startPrice))
        setBuyNowPrice(loadedBeat.auction.buyNowPrice ? String(loadedBeat.auction.buyNowPrice) : '')
        setDurationHours(getDurationHours(loadedBeat.auction))
        setStartAt(
          loadedBeat.auction.status === 'PENDING_APPROVAL' &&
            new Date(loadedBeat.auction.startTime).getTime() <= Date.now()
            ? ''
            : toLocalInput(loadedBeat.auction.startTime)
        )
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Erreur de chargement.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBeat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const auctionBidCount = beat?.auction?._count.bids ?? beat?.auction?.totalBids ?? 0
  const statusLabel = useMemo(() => {
    const labels: Record<string, string> = {
      PENDING_APPROVAL: 'En attente de validation',
      SCHEDULED: 'Programmée',
      ACTIVE: 'En cours',
      ENDING_SOON: 'Fin proche',
    }
    return beat?.auction ? labels[beat.auction.status] || beat.auction.status : ''
  }, [beat])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!beat || !capabilities?.canEditMetadata) return

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(`/api/beats/${beat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          genre,
          mood: mood || null,
          bpm: Number(bpm),
          key: key || null,
          tags: tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          priceMp3: priceMp3 ? Number(priceMp3) : null,
          priceWav: priceWav ? Number(priceWav) : null,
          auction:
            beat.auction && capabilities.canEditAuctionSettings
              ? {
                  startPrice: Number(startPrice),
                  buyNowPrice: buyNowPrice ? Number(buyNowPrice) : null,
                  durationHours: Number(durationHours),
                  startAt: startAt ? new Date(startAt).toISOString() : null,
                }
              : null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Impossible d’enregistrer.')

      setSuccess('Tes modifications ont bien été enregistrées.')
      await loadBeat()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Erreur de sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  const handleExtend = async () => {
    if (!beat?.auction) return
    setExtending(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(`/api/auctions/${beat.auction.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: Number(extensionHours) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Impossible de prolonger.')
      setSuccess(data.message || 'Enchère prolongée.')
      await loadBeat()
    } catch (extendError) {
      setError(extendError instanceof Error ? extendError.message : 'Erreur de prolongation.')
    } finally {
      setExtending(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-[#29293a] bg-[#0d0d12] px-4 py-3 text-sm text-white outline-none transition focus:border-[#e11d48] disabled:cursor-not-allowed disabled:opacity-50'

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090d]">
        <Header />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="animate-spin text-[#e11d48]" size={32} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#09090d]">
      <Header />
      <main className="mx-auto w-full max-w-4xl px-4 pb-20 pt-6 sm:px-6">
        <button
          type="button"
          onClick={() =>
            window.history.length > 1 ? router.back() : router.push('/dashboard?tab=beats')
          }
          className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:border-[#e11d48]/60 hover:bg-[#e11d48]/10"
        >
          <ArrowLeft size={18} />
          Retour à Mes Beats
        </button>

        {!beat || !capabilities ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
            {error || 'Beat introuvable.'}
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#fb7185]">
                Dashboard beatmaker
              </p>
              <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">
                Modifier « {beat.title} »
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Modifie les informations du beat et, avant son démarrage, la programmation de
                l&apos;enchère.
              </p>
            </div>

            {error && (
              <div className="mb-5 flex gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                <AlertCircle className="mt-0.5 shrink-0" size={18} />
                {error}
              </div>
            )}
            {success && (
              <div className="mb-5 flex gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                <CheckCircle className="mt-0.5 shrink-0" size={18} />
                {success}
              </div>
            )}
            {capabilities.lockedReason && (
              <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                {capabilities.lockedReason}
              </div>
            )}

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[#232332] bg-[#13131a] p-4">
                <FileAudio className={beat.hasMp3 ? 'text-blue-400' : 'text-gray-600'} size={20} />
                <p className="mt-2 text-sm font-bold text-white">MP3</p>
                <p className="text-xs text-gray-500">{beat.hasMp3 ? 'Ajouté' : 'Non fourni'}</p>
              </div>
              <div className="rounded-xl border border-[#232332] bg-[#13131a] p-4">
                <FileAudio
                  className={beat.hasWav ? 'text-purple-400' : 'text-gray-600'}
                  size={20}
                />
                <p className="mt-2 text-sm font-bold text-white">WAV</p>
                <p className="text-xs text-gray-500">{beat.hasWav ? 'Ajouté' : 'Non fourni'}</p>
              </div>
              <div className="rounded-xl border border-[#232332] bg-[#13131a] p-4">
                <Layers className={beat.hasStems ? 'text-amber-400' : 'text-gray-600'} size={20} />
                <p className="mt-2 text-sm font-bold text-white">Stems</p>
                <p className="text-xs text-gray-500">{beat.hasStems ? 'Ajoutés' : 'Non fournis'}</p>
              </div>
            </div>

            {beat.status === 'REJECTED' && beat.rejectionType === 'CHANGES_REQUESTED' && (
              <div className="mb-6 rounded-2xl border border-amber-500/25 bg-[#13131a] p-5">
                <h2 className="font-bold text-white">Une nouvelle version est demandée</h2>
                <p className="mt-2 text-sm text-gray-400">{beat.rejectionReason}</p>
                <Link
                  href={`/producers/upload?edit=${beat.id}`}
                  className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-amber-500 px-5 py-2 text-sm font-bold text-black"
                >
                  Corriger les fichiers et renvoyer
                </Link>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <section className="rounded-2xl border border-[#232332] bg-[#13131a] p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  {beat.saleMode === 'LEASING' ? (
                    <ShoppingBag className="text-emerald-400" size={22} />
                  ) : (
                    <Gavel className="text-[#fb7185]" size={22} />
                  )}
                  <div>
                    <h2 className="font-bold text-white">Informations du beat</h2>
                    <p className="text-xs text-gray-500">
                      Vente {beat.saleMode === 'LEASING' ? 'en leasing' : 'exclusive aux enchères'}
                    </p>
                  </div>
                </div>

                <fieldset disabled={!capabilities.canEditMetadata} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white">Titre</label>
                    <input
                      className={inputClass}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Genre</label>
                      <select
                        className={inputClass}
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                      >
                        <option value="">Choisir</option>
                        {GENRES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">BPM</label>
                      <input
                        className={inputClass}
                        type="number"
                        min="40"
                        max="300"
                        value={bpm}
                        onChange={(e) => setBpm(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">
                        Tonalité
                      </label>
                      <select
                        className={inputClass}
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                      >
                        <option value="">Non renseignée</option>
                        {KEYS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">
                        Ambiance
                      </label>
                      <select
                        className={inputClass}
                        value={mood}
                        onChange={(e) => setMood(e.target.value)}
                      >
                        <option value="">Non renseignée</option>
                        {MOODS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Tags</label>
                      <input
                        className={inputClass}
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="trap, sombre, mélodique"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white">
                      Description
                    </label>
                    <textarea
                      className={`${inputClass} min-h-28 resize-y`}
                      maxLength={500}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  {beat.saleMode === 'LEASING' && (
                    <div className="grid grid-cols-1 gap-4 border-t border-[#232332] pt-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white">
                          Prix licence MP3
                        </label>
                        <input
                          className={inputClass}
                          disabled={!beat.hasMp3 || !capabilities.canEditMetadata}
                          type="number"
                          min="1"
                          step="0.01"
                          value={priceMp3}
                          onChange={(e) => setPriceMp3(e.target.value)}
                          placeholder={beat.hasMp3 ? 'Ex : 30' : 'MP3 non fourni'}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white">
                          Prix licence WAV
                        </label>
                        <input
                          className={inputClass}
                          disabled={!beat.hasWav || !capabilities.canEditMetadata}
                          type="number"
                          min="1"
                          step="0.01"
                          value={priceWav}
                          onChange={(e) => setPriceWav(e.target.value)}
                          placeholder={beat.hasWav ? 'Ex : 60' : 'WAV non fourni'}
                        />
                      </div>
                    </div>
                  )}
                </fieldset>
              </section>

              {beat.auction && (
                <section className="rounded-2xl border border-[#e11d48]/25 bg-[#13131a] p-5 sm:p-6">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Clock className="text-[#fb7185]" size={22} />
                      <div>
                        <h2 className="font-bold text-white">Paramètres de l&apos;enchère</h2>
                        <p className="text-xs text-gray-500">
                          {statusLabel} · {auctionBidCount} mise{auctionBidCount > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#e11d48]/15 px-3 py-1 text-[10px] font-bold uppercase text-[#fb7185]">
                      Licence exclusive
                    </span>
                  </div>

                  {capabilities.canEditAuctionSettings ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-white">
                            Prix de départ
                          </label>
                          <input
                            className={inputClass}
                            type="number"
                            min="1"
                            step="0.01"
                            value={startPrice}
                            onChange={(e) => setStartPrice(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-white">
                            Achat immédiat
                          </label>
                          <input
                            className={inputClass}
                            type="number"
                            min="1"
                            step="0.01"
                            value={buyNowPrice}
                            onChange={(e) => setBuyNowPrice(e.target.value)}
                            placeholder="Optionnel"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-white">
                            Durée
                          </label>
                          <select
                            className={inputClass}
                            value={durationHours}
                            onChange={(e) => setDurationHours(e.target.value)}
                          >
                            {DURATIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white">
                          Date et heure de démarrage
                        </label>
                        <input
                          className={inputClass}
                          type="datetime-local"
                          value={startAt}
                          onChange={(e) => setStartAt(e.target.value)}
                        />
                        <p className="mt-2 text-xs text-gray-500">
                          Vide = démarrage dès la validation. Tu peux modifier toute la
                          programmation tant que l&apos;enchère n&apos;a pas commencé.
                        </p>
                      </div>
                    </div>
                  ) : capabilities.canExtendAuction ? (
                    <div className="rounded-xl border border-[#29293a] bg-[#0d0d12] p-4">
                      <p className="text-sm font-bold text-white">
                        Fin actuelle : {formatDate(beat.auction.endTime)}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-400">
                        Une enchère commencée ne peut pas être raccourcie. Tu peux uniquement la
                        prolonger afin de protéger les enchérisseurs.
                      </p>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <select
                          className={inputClass}
                          value={extensionHours}
                          onChange={(e) => setExtensionHours(e.target.value)}
                        >
                          {EXTENSIONS.map((hours) => (
                            <option key={hours} value={hours}>
                              +{hours} heure{hours > 1 ? 's' : ''}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleExtend}
                          disabled={extending}
                          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#e11d48] px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
                        >
                          {extending ? (
                            <Loader2 className="animate-spin" size={16} />
                          ) : (
                            <Clock size={16} />
                          )}
                          Prolonger
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-gray-400">
                      Cette enchère ne peut plus être reprogrammée.
                    </div>
                  )}
                </section>
              )}

              {capabilities.canEditMetadata && (
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Link
                    href="/dashboard?tab=beats"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-6 text-sm font-bold text-white"
                  >
                    Annuler
                  </Link>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e11d48] to-[#ff0033] px-6 text-sm font-black text-white disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
                    Enregistrer les modifications
                  </button>
                </div>
              )}
            </form>
          </>
        )}
      </main>
    </div>
  )
}
