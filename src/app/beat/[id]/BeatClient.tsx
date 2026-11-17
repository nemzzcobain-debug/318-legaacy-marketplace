'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Check, Clock, Gavel, Headphones, Loader2, Music, ShoppingCart, Tag } from 'lucide-react'
import Header from '@/components/layout/Header'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import AudioPlayer from '@/components/audio/AudioPlayer'
import { LICENSE_DETAILS } from '@/lib/licenses'
import type { PublicBeat, PublicLicense } from '@/lib/public-beat'

// En dessous de ce seuil, on n'affiche pas le compteur (pas de « 3 écoutes » qui dessert).
const MIN_VISIBLE_PLAYS = 20

function formatEuro(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(2)} €`
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function PurchasePanel({ beat }: { beat: PublicBeat }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [selected, setSelected] = useState<PublicLicense | null>(beat.offers[0]?.type ?? null)
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [guestEmail, setGuestEmail] = useState('')
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (beat.liveAuction) {
    return (
      <div className="rounded-2xl border border-[#e11d48]/30 bg-[#e11d48]/[0.06] p-5">
        <p className="flex items-center gap-2 text-sm font-bold text-[#fb7185]">
          <Gavel size={16} /> Enchère exclusive en cours
        </p>
        <p className="mt-3 text-3xl font-black text-white">
          {formatEuro(beat.liveAuction.currentBid)}
        </p>
        <p className="text-xs text-gray-400">Offre actuelle</p>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
          <Clock size={13} /> Se termine le {formatDateTime(beat.liveAuction.endTime)}
        </p>
        {beat.liveAuction.buyNowPrice ? (
          <p className="mt-1 text-xs text-gray-400">
            Achat immédiat possible à {formatEuro(beat.liveAuction.buyNowPrice)}
          </p>
        ) : null}
        <Link
          href={`/auction/${beat.liveAuction.id}`}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#e11d48] py-3 text-sm font-bold text-white transition hover:bg-[#be123c]"
        >
          <Gavel size={16} /> Enchérir sur ce beat
        </Link>
        <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
          Le gagnant obtient les droits exclusifs, le WAV et les stems.
        </p>
      </div>
    )
  }

  if (beat.upcomingAuction) {
    return (
      <div className="rounded-2xl border border-[#222222] bg-[#111111] p-5">
        <p className="flex items-center gap-2 text-sm font-bold text-white">
          <Clock size={16} className="text-[#fb7185]" /> Enchère programmée
        </p>
        <p className="mt-3 text-sm text-gray-300">
          Début le {formatDateTime(beat.upcomingAuction.startTime)}, mise de départ{' '}
          {formatEuro(beat.upcomingAuction.startPrice)}.
        </p>
        <Link
          href={`/auction/${beat.upcomingAuction.id}`}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[#e11d48]/50 py-3 text-sm font-bold text-white transition hover:bg-[#e11d48]/10"
        >
          Voir l&apos;enchère
        </Link>
      </div>
    )
  }

  if (beat.offers.length === 0) {
    return (
      <div className="rounded-2xl border border-[#222222] bg-[#111111] p-5">
        <p className="text-sm text-gray-300">
          Ce beat n&apos;est pas disponible à l&apos;achat pour le moment.
        </p>
        <Link
          href={`/producer/${beat.producer.id}`}
          className="mt-4 inline-block text-sm font-semibold text-[#fb7185] hover:underline"
        >
          Voir les autres beats de {beat.producer.name}
        </Link>
      </div>
    )
  }

  const selectedOffer = beat.offers.find((offer) => offer.type === selected) || beat.offers[0]

  async function handlePurchase() {
    setError(null)

    if (!session?.user) {
      if (!showGuestForm) {
        setShowGuestForm(true)
        return
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
        setError('Entre un email valide pour continuer')
        return
      }
    }

    setPurchasing(true)
    try {
      const payload: Record<string, string> = { licenseType: selectedOffer.type }
      if (!session?.user) payload.guestEmail = guestEmail.trim()

      const res = await fetch(`/api/beats/${beat.id}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erreur lors de l'achat")
        return
      }

      // Le secret de paiement ne passe jamais dans l'URL.
      sessionStorage.setItem(`checkout_cs_${beat.id}`, data.clientSecret)
      router.push(
        `/checkout/beat/${beat.id}?pi=${data.paymentIntentId}&license=${selectedOffer.type}&price=${data.finalPrice}&title=${encodeURIComponent(data.beatTitle)}`
      )
    } catch {
      setError('Erreur de connexion')
    } finally {
      setPurchasing(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#222222] bg-[#111111] p-5">
      <p className="text-sm font-bold text-white">Choisis ta licence</p>
      <div className="mt-3 space-y-2" role="radiogroup" aria-label="Licence">
        {beat.offers.map((offer) => {
          const details = LICENSE_DETAILS[offer.type]
          const active = offer.type === selectedOffer.type
          return (
            <button
              key={offer.type}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(offer.type)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                active
                  ? 'border-[#e11d48] bg-[#e11d48]/10'
                  : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
              }`}
            >
              <span>
                <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                  {active && <Check size={14} className="text-[#fb7185]" />}
                  {details.label}
                </span>
                <span className="block text-[11px] text-gray-400">{details.shortDescription}</span>
              </span>
              <span className="text-base font-black text-white">{formatEuro(offer.price)}</span>
            </button>
          )
        })}
      </div>

      {showGuestForm && !session?.user && (
        <div className="mt-4">
          <label htmlFor="guest-email" className="text-xs text-gray-400">
            Ton email (pour recevoir les fichiers et la licence)
          </label>
          <input
            id="guest-email"
            type="email"
            autoComplete="email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handlePurchase()
            }}
            placeholder="toi@exemple.com"
            className="mt-1 w-full rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2.5 text-sm text-white outline-none focus:border-[#e11d48]"
          />
          <p className="mt-1.5 text-[11px] text-gray-500">
            Déjà un compte ?{' '}
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(`/beat/${beat.id}`)}`}
              className="text-[#fb7185] hover:underline"
            >
              Connecte-toi
            </Link>
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handlePurchase}
        disabled={purchasing}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#e11d48] py-3 text-sm font-bold text-white transition hover:bg-[#be123c] disabled:opacity-60"
      >
        {purchasing ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
        Acheter · {formatEuro(selectedOffer.price)}
      </button>
      <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
        Paiement sécurisé par Stripe. Fichiers et contrat de licence envoyés par email.
      </p>
    </div>
  )
}

export default function BeatClient({ beat }: { beat: PublicBeat }) {
  const details = [beat.genre, beat.bpm ? `${beat.bpm} BPM` : null, beat.key, beat.mood].filter(
    (item): item is string => Boolean(item)
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Breadcrumbs
          items={[
            { label: 'Producteurs', href: '/producers' },
            { label: beat.producer.name, href: `/producer/${beat.producer.id}` },
            { label: beat.title },
          ]}
        />

        <div className="grid gap-8 md:grid-cols-[1fr_340px]">
          <article className="min-w-0">
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="relative aspect-square w-full max-w-[220px] shrink-0 overflow-hidden rounded-2xl bg-[#111111]">
                {beat.coverImage ? (
                  <Image
                    src={beat.coverImage}
                    alt={`Pochette de ${beat.title}`}
                    fill
                    priority
                    className="object-cover"
                    sizes="220px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Music size={48} className="text-gray-700" />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <h1 className="text-3xl font-black leading-tight text-white md:text-4xl">
                  {beat.title}
                </h1>
                <p className="mt-2 text-sm text-gray-400">
                  Instrumentale produite par{' '}
                  <Link
                    href={`/producer/${beat.producer.id}`}
                    className="font-semibold text-white hover:text-[#fb7185]"
                  >
                    {beat.producer.name}
                  </Link>
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {details.map((item) => (
                    <li
                      key={item}
                      className="rounded-full border border-[#2a2a2a] px-2.5 py-1 text-xs text-gray-300"
                    >
                      {item}
                    </li>
                  ))}
                  <li className="rounded-full border border-emerald-500/30 px-2.5 py-1 text-xs text-emerald-400">
                    {beat.saleMode === 'LEASING' ? 'Leasing non exclusif' : 'Vente exclusive'}
                  </li>
                </ul>
                {beat.plays >= MIN_VISIBLE_PLAYS && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                    <Headphones size={13} /> {beat.plays.toLocaleString('fr-FR')} écoutes
                  </p>
                )}
              </div>
            </div>

            {beat.previewUrl && (
              <section className="mt-6" aria-label="Écouter l'extrait">
                <AudioPlayer
                  src={beat.previewUrl}
                  title={beat.title}
                  producer={beat.producer.name}
                  coverImage={beat.coverImage || undefined}
                />
                {beat.previewIsExcerpt && (
                  <p className="mt-2 text-[11px] text-gray-500">
                    Extrait de 60 secondes. Le fichier complet est livré après l&apos;achat.
                  </p>
                )}
              </section>
            )}

            {beat.description && (
              <section className="reveal mt-8">
                <h2 className="text-lg font-bold text-white">À propos de ce beat</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-300">
                  {beat.description}
                </p>
              </section>
            )}

            <section className="reveal mt-8">
              <h2 className="text-lg font-bold text-white">Licences disponibles</h2>
              <ul className="mt-3 space-y-2">
                {(['BASIC', 'PREMIUM', 'EXCLUSIVE'] as const)
                  .filter((type) => beat.saleMode !== 'LEASING' || type !== 'EXCLUSIVE')
                  .map((type) => {
                    const license = LICENSE_DETAILS[type]
                    return (
                      <li
                        key={type}
                        className="rounded-xl border border-[#222222] bg-[#111111] p-3 text-sm"
                      >
                        <span className="font-bold text-white">{license.label}</span>
                        <span className="text-gray-400">
                          {' '}
                          · {license.files} · {license.usage}
                        </span>
                      </li>
                    )
                  })}
              </ul>
            </section>

            {beat.tags.length > 0 && (
              <section className="reveal mt-8">
                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                  <Tag size={16} /> Tags
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {beat.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-gray-300"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>

          <aside className="md:sticky md:top-24 md:self-start">
            <PurchasePanel beat={beat} />
          </aside>
        </div>
      </main>
    </div>
  )
}
