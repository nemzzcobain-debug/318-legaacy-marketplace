'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Clock,
  Gavel,
  Loader2,
  Music,
  Pause,
  Play,
  Sparkles,
  Timer,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import CountdownTimer from '@/components/ui/CountdownTimer'
import { useExclusiveAudioPlayer } from '@/hooks/useExclusiveAudioPlayer'

interface WeeklyBeat {
  id: string
  title: string
  genre: string
  bpm: number
  key: string | null
  coverImage: string | null
  audioUrl: string
  directPrice: number | null
  producer: {
    id: string
    name: string
    avatar: string | null
  }
  auction: {
    id: string
    currentBid: number
    startPrice: number
    buyNowPrice: number | null
    endTime: string
    totalBids: number
    licenseType: string
  } | null
}

const licenseColors: Record<string, string> = {
  BASIC: 'border-gray-500/30 bg-gray-500/10 text-gray-300',
  PREMIUM: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  EXCLUSIVE: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
}

export default function WeeklySelectionPage() {
  const [beats, setBeats] = useState<WeeklyBeat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { playingId, togglePlay } = useExclusiveAudioPlayer()

  useEffect(() => {
    async function loadBeats() {
      try {
        const response = await fetch('/api/featured-beats', { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Impossible de charger la sélection')
        }
        setBeats(data.beats || [])
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Impossible de charger la sélection'
        )
      } finally {
        setLoading(false)
      }
    }

    loadBeats()
  }, [])

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm font-semibold text-gray-300 transition hover:border-red-500/30 hover:bg-red-500/[0.07] hover:text-white"
        >
          <ArrowLeft size={15} />
          Retour à l’accueil
        </Link>
        <Breadcrumbs items={[{ label: 'Beats de la semaine' }]} />

        <div className="relative mb-8 overflow-hidden rounded-3xl border border-red-500/15 bg-gradient-to-br from-red-950/25 via-[#111116] to-[#0b0b0e] p-6 md:p-9">
          <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-red-500/10 blur-3xl" />
          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-red-300">
              <Sparkles size={13} />
              Sélection 318 LEGAACY
            </div>
            <h1 className="text-3xl font-black md:text-5xl">Tous les beats de la semaine</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400 md:text-base">
              Retrouve toute la sélection choisie par l’équipe, écoute chaque instrumentale et
              accède directement à son enchère ou à son achat.
            </p>
            {!loading && !error && (
              <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-300">
                <Music size={14} className="text-red-400" />
                {beats.length} beat{beats.length !== 1 ? 's' : ''} sélectionné
                {beats.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="h-36 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025] md:h-28"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-8 text-center">
            <p className="font-bold text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-bold text-white"
            >
              <Loader2 size={15} /> Réessayer
            </button>
          </div>
        ) : beats.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.08] bg-[#111116] px-6 py-16 text-center">
            <Clock size={36} className="mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-black">La prochaine sélection arrive bientôt</h2>
            <p className="mt-2 text-sm text-gray-500">
              En attendant, découvre toutes les enchères actuellement disponibles.
            </p>
            <Link
              href="/marketplace"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-bold text-white"
            >
              Explorer les enchères <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0d0d10] shadow-2xl shadow-black/30">
            <div className="hidden grid-cols-[76px_minmax(190px,1fr)_110px_95px_140px_170px] items-center gap-4 border-b border-white/[0.08] bg-white/[0.025] px-4 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-gray-600 lg:grid">
              <span>Sélection</span>
              <span>Instrumentale</span>
              <span>Prix</span>
              <span>Offres</span>
              <span>Disponibilité</span>
              <span>Action</span>
            </div>

            {beats.map((beat, index) => {
              const actionHref = beat.auction
                ? `/auction/${beat.auction.id}`
                : beat.directPrice
                  ? `/nouveautes?beat=${beat.id}`
                  : `/producer/${beat.producer.id}`

              return (
                <article
                  key={beat.id}
                  className="group border-b border-white/[0.07] p-4 transition last:border-b-0 hover:bg-white/[0.025] lg:grid lg:grid-cols-[76px_minmax(190px,1fr)_110px_95px_140px_170px] lg:items-center lg:gap-4"
                >
                  <div className="flex gap-3 lg:contents">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a0a2e] via-[#111] to-[#0a0a1a] lg:h-[76px] lg:w-[76px]">
                      <Link
                        href={actionHref}
                        aria-label={`Voir les détails de ${beat.title}`}
                        className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400"
                      >
                        {beat.coverImage ? (
                          <Image
                            src={beat.coverImage}
                            alt={beat.title}
                            fill
                            className="object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Music size={22} className="text-gray-600" />
                          </div>
                        )}
                        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[8px] font-black text-gray-300">
                          #{String(index + 1).padStart(2, '0')}
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => togglePlay(beat.id, beat.audioUrl)}
                        aria-label={
                          playingId === beat.id
                            ? `Mettre ${beat.title} en pause`
                            : `Écouter ${beat.title}`
                        }
                        className="absolute bottom-2 right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white text-black shadow-xl transition hover:scale-105"
                      >
                        {playingId === beat.id ? (
                          <Pause size={14} fill="currentColor" />
                        ) : (
                          <Play size={14} className="ml-0.5" fill="currentColor" />
                        )}
                      </button>
                    </div>

                    <div className="min-w-0 self-center">
                      <Link
                        href={actionHref}
                        className="block truncate text-base font-black transition hover:text-red-400 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      >
                        {beat.title}
                      </Link>
                      <Link
                        href={`/producer/${beat.producer.id}`}
                        className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate rounded text-xs font-semibold text-gray-400 underline decoration-transparent underline-offset-4 transition hover:text-white hover:decoration-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        aria-label={`Voir le profil de ${beat.producer.name}`}
                      >
                        {beat.producer.name}
                        <BadgeCheck size={12} className="shrink-0 text-red-400" />
                      </Link>
                      <Link
                        href={actionHref}
                        className="mt-2 flex flex-wrap gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        aria-label={`Voir les informations de ${beat.title}`}
                      >
                        {[beat.genre, `${beat.bpm} BPM`, beat.key].filter(Boolean).map((label) => (
                          <span
                            key={label}
                            className="rounded-full border border-white/[0.06] bg-white/[0.04] px-2 py-1 text-[9px] font-bold text-gray-500"
                          >
                            {label}
                          </span>
                        ))}
                        {beat.auction && (
                          <span
                            className={`rounded-full border px-2 py-1 text-[9px] font-black ${licenseColors[beat.auction.licenseType] || licenseColors.BASIC}`}
                          >
                            {beat.auction.licenseType}
                          </span>
                        )}
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 rounded-2xl border border-white/[0.06] bg-black/20 p-3 lg:contents">
                    <div>
                      <span className="text-[8px] font-black uppercase text-gray-600 lg:hidden">
                        Prix
                      </span>
                      <div className="mt-0.5 text-xl font-black">
                        {beat.auction
                          ? `${beat.auction.currentBid}€`
                          : beat.directPrice
                            ? `${beat.directPrice}€`
                            : '—'}
                      </div>
                      <span className="text-[9px] text-gray-600">
                        {beat.auction ? `Départ ${beat.auction.startPrice}€` : 'Achat direct'}
                      </span>
                    </div>

                    <div className="border-l border-white/[0.06] pl-3 lg:border-0 lg:pl-0">
                      <span className="text-[8px] font-black uppercase text-gray-600 lg:hidden">
                        Offres
                      </span>
                      <div className="mt-1 flex items-center gap-1 text-sm font-black text-gray-300 lg:mt-0">
                        {beat.auction ? (
                          <>
                            <Gavel size={13} className="text-red-400" />
                            {beat.auction.totalBids}
                          </>
                        ) : (
                          <>
                            <Music size={13} className="text-red-400" />
                            Direct
                          </>
                        )}
                      </div>
                    </div>

                    <div className="border-l border-white/[0.06] pl-3 lg:border-0 lg:pl-0">
                      <span className="text-[8px] font-black uppercase text-gray-600 lg:hidden">
                        Disponibilité
                      </span>
                      {beat.auction ? (
                        <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-red-500/15 bg-red-500/[0.07] px-2 py-1 text-[10px] font-black text-red-300 lg:mt-0">
                          <Timer size={11} />
                          <CountdownTimer
                            endTime={beat.auction.endTime}
                            size="sm"
                            showIcon={false}
                          />
                        </div>
                      ) : (
                        <span className="mt-1 inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-300 lg:mt-0">
                          Disponible
                        </span>
                      )}
                    </div>
                  </div>

                  <Link
                    href={actionHref}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f43f5e] to-[#dc2626] px-4 py-3 text-xs font-extrabold text-white shadow-lg shadow-red-950/20 transition hover:brightness-110 lg:mt-0"
                  >
                    {beat.auction
                      ? 'Voir l’enchère'
                      : beat.directPrice
                        ? 'Acheter ce beat'
                        : 'Voir le beatmaker'}
                    <ArrowRight size={15} />
                  </Link>
                </article>
              )
            })}
          </div>
        )}

        <Link
          href="/"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-gray-200 transition hover:border-red-500/30 hover:bg-red-500/[0.08] sm:hidden"
        >
          <ArrowLeft size={16} />
          Retour à l’accueil
        </Link>
      </main>
    </div>
  )
}
