'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import Header from '@/components/layout/Header'
import {
  Shield,
  Star,
  BarChart3,
  Award,
  Zap,
  Music,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Loader2,
  FileText,
  Globe,
  Youtube,
  FolderOpen,
} from 'lucide-react'
import { GENRES } from '@/types'

interface Producer {
  id: string
  name: string
  displayName?: string
  avatar?: string
  producerBio?: string
  rating: number
  totalSales: number
  _count?: { beats: number }
}

type ApplicationStatus =
  | 'NOT_LOGGED_IN'
  | 'NOT_APPLIED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'NOT_FOUND'

export default function ProducersPage() {
  const { data: session } = useSession()
  const [producers, setProducers] = useState<Producer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Application state
  const [appStatus, setAppStatus] = useState<ApplicationStatus>('NOT_LOGGED_IN')
  const [statusLoading, setStatusLoading] = useState(true)
  const [appliedAt, setAppliedAt] = useState<string | null>(null)

  // Application form state
  const [showForm, setShowForm] = useState(false)
  const [producerBio, setProducerBio] = useState('')
  const [portfolio, setPortfolio] = useState('')
  const [youtube, setYoutube] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    async function fetchProducers() {
      try {
        const res = await fetch('/api/producers')
        const data = await res.json()
        setProducers(data.producers || [])
      } catch (err) {
        console.error('Erreur chargement producteurs:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProducers()
  }, [])

  // Vérifier le statut de candidature
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/producers/status')
        const data = await res.json()
        setAppStatus(data.status)
        if (data.appliedAt) setAppliedAt(data.appliedAt)
      } catch {
        setAppStatus('NOT_LOGGED_IN')
      } finally {
        setStatusLoading(false)
      }
    }
    checkStatus()
  }, [session])

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!producerBio || producerBio.length < 20) {
      setFormError('Ta bio doit faire au moins 20 caractères')
      return
    }
    if (genres.length === 0) {
      setFormError('Sélectionne au moins un genre')
      return
    }

    setSubmitting(true)
    setFormError('')

    try {
      const res = await fetch('/api/producers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producerBio,
          portfolio: portfolio.trim() || undefined,
          youtube: youtube.trim() || undefined,
          genres,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setFormError(data.error || 'Erreur lors de la soumission')
        return
      }

      setAppStatus('PENDING')
      setAppliedAt(new Date().toISOString())
      setShowForm(false)
    } catch {
      setFormError('Erreur réseau, réessaie')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleGenre = (g: string) => {
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
  }

  const filtered = producers.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.displayName?.toLowerCase().includes(q)
  })

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-white mb-2">Producteurs vérifiés</h1>
          <p className="text-gray-400">
            Marketplace ouverte sous validation — seuls les producteurs approuvés peuvent vendre
          </p>
        </div>

        {/* Search */}
        <div className="max-w-md relative mb-8">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un producteur..."
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4850]"
          />
        </div>

        {/* Producers Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-[#13131a] border border-[#1e1e2e] rounded-xl h-56 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((producer) => (
              <Link
                href={`/producer/${producer.id}`}
                key={producer.id}
                className="bg-[#13131a] border border-[#1e1e2e] rounded-xl p-5 text-center hover:border-[#e11d4830] transition-colors cursor-pointer block"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-2xl font-extrabold text-white mx-auto mb-3 border-2 border-[#e11d48]">
                  {producer.avatar || producer.name[0]}
                </div>

                <h3 className="text-base font-bold text-white flex items-center justify-center gap-1.5">
                  {producer.displayName || producer.name}
                  <Shield size={14} className="text-[#e11d48]" />
                </h3>

                {producer.totalSales > 200 ? (
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e11d4815] text-[#e11d48]">
                    Top Seller
                  </span>
                ) : producer.totalSales > 50 ? (
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#667eea15] text-[#667eea]">
                    Certifié
                  </span>
                ) : (
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2ed57315] text-[#2ed573]">
                    Nouveau
                  </span>
                )}

                <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                  {producer.producerBio || producer.name}
                </p>

                <div className="flex justify-center gap-4 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Star size={11} /> {producer.rating.toFixed(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <BarChart3 size={11} /> {producer.totalSales} ventes
                  </span>
                  <span className="flex items-center gap-1">
                    <Music size={11} /> {producer._count?.beats || 0}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Section candidature producteur — dynamique selon le statut */}
        <div className="mt-12 p-8 rounded-2xl bg-[#e11d4808] border border-[#e11d4820]">
          {statusLoading ? (
            <div className="text-center py-4">
              <Loader2 size={24} className="text-gray-500 animate-spin mx-auto" />
            </div>
          ) : appStatus === 'PENDING' ? (
            /* ─── STATUT: EN ATTENTE ─── */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
                <Clock size={32} className="text-yellow-500" />
              </div>
              <h3 className="text-xl font-extrabold text-white mb-2">
                Candidature en cours d&apos;examen
              </h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
                Ta demande a bien été transmise à notre équipe. Nous examinons chaque candidature
                sous 48h. Tu recevras un email dès que nous aurons pris une décision.
              </p>

              {/* Progress tracker */}
              <div className="max-w-sm mx-auto mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                      <CheckCircle2 size={16} className="text-black" />
                    </div>
                    <span className="text-[10px] text-green-400 mt-1">Soumise</span>
                  </div>
                  <div className="flex-1 h-0.5 bg-yellow-500/50 mx-2" />
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-yellow-500/20 border-2 border-yellow-500 flex items-center justify-center animate-pulse">
                      <Clock size={14} className="text-yellow-500" />
                    </div>
                    <span className="text-[10px] text-yellow-400 mt-1">En examen</span>
                  </div>
                  <div className="flex-1 h-0.5 bg-gray-700 mx-2" />
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                      <CheckCircle2 size={14} className="text-gray-600" />
                    </div>
                    <span className="text-[10px] text-gray-600 mt-1">Décision</span>
                  </div>
                </div>
              </div>

              {appliedAt && (
                <p className="text-xs text-gray-600">
                  Soumise le{' '}
                  {new Date(appliedAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          ) : appStatus === 'APPROVED' ? (
            /* ─── STATUT: APPROUVÉ ─── */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-green-500" />
              </div>
              <h3 className="text-xl font-extrabold text-white mb-2">Tu es producteur vérifié !</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto mb-5">
                Ton compte est approuvé. Tu peux uploader tes beats et créer des enchères.
              </p>
              <Link
                href="/producers/upload"
                className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-black"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                <Music size={18} /> Uploader un beat
              </Link>
            </div>
          ) : appStatus === 'REJECTED' ? (
            /* ─── STATUT: REFUSÉ ─── */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <XCircle size={32} className="text-red-400" />
              </div>
              <h3 className="text-xl font-extrabold text-white mb-2">Candidature non retenue</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto mb-5">
                Ta candidature n&apos;a pas été retenue cette fois. Tu peux améliorer ton profil et
                resoumettre une nouvelle demande.
              </p>
              <button
                onClick={() => {
                  setShowForm(true)
                  setAppStatus('NOT_APPLIED')
                }}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-black"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                <Send size={18} /> Resoumettre une candidature
              </button>
            </div>
          ) : appStatus === 'NOT_APPLIED' && session ? (
            /* ─── FORMULAIRE DE CANDIDATURE (connecté, pas encore postulé) ─── */
            !showForm ? (
              <div className="text-center">
                <Award size={40} className="text-[#e11d48] mx-auto mb-3" />
                <h3 className="text-xl font-extrabold text-white mb-2">
                  Deviens producteur sur 318 LEGAACY
                </h3>
                <p className="text-sm text-gray-400 max-w-md mx-auto mb-5">
                  Soumets ta candidature pour vendre tes beats aux enchères. Notre équipe vérifie
                  chaque profil pour garantir la qualité.
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-black"
                  style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                >
                  <Zap size={18} /> Postuler maintenant
                </button>
              </div>
            ) : (
              <form onSubmit={handleApply} className="max-w-lg mx-auto">
                <h3 className="text-xl font-extrabold text-white mb-1 text-center">
                  Candidature producteur
                </h3>
                <p className="text-sm text-gray-500 text-center mb-6">
                  Présente-toi et montre-nous ton travail
                </p>

                {formError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                    <p className="text-sm text-red-400">{formError}</p>
                  </div>
                )}

                {/* Bio */}
                <div className="mb-4">
                  <label className="text-sm font-semibold text-white mb-1.5 flex items-center gap-1.5">
                    <FileText size={14} /> Bio producteur *
                  </label>
                  <textarea
                    value={producerBio}
                    onChange={(e) => setProducerBio(e.target.value)}
                    placeholder="Parle-nous de toi, de ta musique, de ton style..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4850] resize-none"
                    maxLength={1000}
                  />
                  <p className="text-xs text-gray-600 mt-1">{producerBio.length}/1000 (min. 20)</p>
                </div>

                {/* Liens optionnels */}
                <div className="mb-4">
                  <label className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
                    <Globe size={14} /> Liens (optionnels)
                  </label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                        <Youtube size={16} className="text-red-500" />
                      </div>
                      <input
                        value={youtube}
                        onChange={(e) => setYoutube(e.target.value)}
                        placeholder="https://youtube.com/@ta-chaine"
                        className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4850]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <FolderOpen size={16} className="text-blue-400" />
                      </div>
                      <input
                        value={portfolio}
                        onChange={(e) => setPortfolio(e.target.value)}
                        placeholder="https://drive.google.com/drive/folders/..."
                        className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-[#1e1e2e] text-white placeholder-gray-600 text-sm outline-none focus:border-[#e11d4850]"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Tu peux ajouter un ou plusieurs liens, ou passer directement a la suite
                  </p>
                </div>

                {/* Genres */}
                <div className="mb-6">
                  <label className="text-sm font-semibold text-white mb-2 block">
                    Genres principaux *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleGenre(g)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                          genres.includes(g)
                            ? 'border-[#e11d48] text-[#e11d48] bg-[#e11d4815] font-bold'
                            : 'border-[#1e1e2e] text-gray-500 hover:text-white hover:border-[#333]'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-3 rounded-xl border border-[#1e1e2e] text-gray-400 font-semibold text-sm hover:text-white transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 rounded-xl font-bold text-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                  >
                    {submitting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    {submitting ? 'Envoi...' : 'Soumettre ma candidature'}
                  </button>
                </div>
              </form>
            )
          ) : (
            /* ─── NON CONNECTÉ ─── */
            <div className="text-center">
              <Award size={40} className="text-[#e11d48] mx-auto mb-3" />
              <h3 className="text-xl font-extrabold text-white mb-2">
                Deviens producteur sur 318 LEGAACY
              </h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto mb-5">
                Soumets ta candidature pour vendre tes beats aux enchères. Notre équipe vérifie
                chaque profil pour garantir la qualité.
              </p>
              <a
                href="/register"
                className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-black"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                <Zap size={18} /> Créer un compte pour postuler
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
