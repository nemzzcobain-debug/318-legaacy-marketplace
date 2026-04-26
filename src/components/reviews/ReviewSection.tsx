'use client'

// ─── 318 LEGAACY - Review Section ───
// Shows reviews list + review form for eligible buyers
// Props: producerId

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Star, Send, Loader2, MessageSquare, Music, CheckCircle } from 'lucide-react'

interface Review {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  author: {
    id: string
    name: string
    displayName: string | null
    avatar: string | null
  }
  auction: {
    id: string
    beat: { title: string; genre: string }
  }
}

interface EligibleAuction {
  id: string
  finalPrice: number
  winningLicense: string
  paidAt: string
  beat: { title: string; genre: string; coverImage: string | null }
}

interface Props {
  producerId: string
  producerName: string
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StarRating({ rating, size = 16, interactive = false, onChange }: {
  rating: number
  size?: number
  interactive?: boolean
  onChange?: (r: number) => void
}) {
  const [hover, setHover] = useState(0)

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(i)}
          onMouseEnter={() => interactive && setHover(i)}
          onMouseLeave={() => interactive && setHover(0)}
          className={interactive ? 'cursor-pointer transition-transform hover:scale-110' : 'cursor-default'}
        >
          <Star
            size={size}
            className={
              (hover || rating) >= i
                ? 'text-yellow-400'
                : 'text-gray-700'
            }
            fill={(hover || rating) >= i ? '#facc15' : 'none'}
          />
        </button>
      ))}
    </div>
  )
}

export default function ReviewSection({ producerId, producerName }: Props) {
  const { data: session } = useSession()
  const [reviews, setReviews] = useState<Review[]>([])
  const [avgRating, setAvgRating] = useState(0)
  const [totalReviews, setTotalReviews] = useState(0)
  const [ratingDistribution, setRatingDistribution] = useState<Record<number, number>>({1:0,2:0,3:0,4:0,5:0})
  const [eligibleAuctions, setEligibleAuctions] = useState<EligibleAuction[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [selectedAuction, setSelectedAuction] = useState<string>('')
  const [formRating, setFormRating] = useState(0)
  const [formComment, setFormComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [reviewsRes, eligibleRes] = await Promise.all([
          fetch(`/api/reviews?producerId=${producerId}`),
          session?.user?.id
            ? fetch(`/api/reviews?eligible=${producerId}`)
            : Promise.resolve(null),
        ])

        if (reviewsRes.ok) {
          const data = await reviewsRes.json()
          setReviews(data.reviews)
          setAvgRating(data.avgRating)
          setTotalReviews(data.totalReviews)
          setRatingDistribution(data.ratingDistribution)
        }

        if (eligibleRes && eligibleRes.ok) {
          const data = await eligibleRes.json()
          setEligibleAuctions(data.eligibleAuctions || [])
        }
      } catch {} finally {
        setLoading(false)
      }
    }
    load()
  }, [producerId, session])

  const handleSubmit = async () => {
    if (!formRating || !selectedAuction) return

    setSubmitting(true)
    setSubmitError('')

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producerId,
          auctionId: selectedAuction,
          rating: formRating,
          comment: formComment.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error)
        return
      }

      // Add new review to list
      setReviews(prev => [data.review, ...prev])
      setAvgRating(data.newAvgRating)
      setTotalReviews(data.totalReviews)

      // Remove this auction from eligible
      setEligibleAuctions(prev => prev.filter(a => a.id !== selectedAuction))

      // Reset form
      setFormRating(0)
      setFormComment('')
      setSelectedAuction('')
      setShowForm(false)
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 4000)
    } catch {
      setSubmitError('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-500" />
      </div>
    )
  }

  const maxDistribution = Math.max(...Object.values(ratingDistribution), 1)

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <div className="bg-[#111111] border border-[#222222] rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Big rating */}
          <div className="text-center sm:border-r sm:border-[#222] sm:pr-6">
            <div className="text-5xl font-black text-white">
              {avgRating > 0 ? avgRating.toFixed(1) : '—'}
            </div>
            <StarRating rating={Math.round(avgRating)} size={18} />
            <div className="text-xs text-gray-500 mt-1">
              {totalReviews} avis
            </div>
          </div>

          {/* Distribution bars */}
          <div className="flex-1 space-y-1.5 w-full">
            {[5, 4, 3, 2, 1].map(star => (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-3 text-right">{star}</span>
                <Star size={12} className="text-yellow-400" fill="#facc15" />
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                    style={{ width: `${(ratingDistribution[star] / maxDistribution) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-600 w-6 text-right">{ratingDistribution[star]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Submit Success */}
      {submitSuccess && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-400" />
          <p className="text-sm font-bold text-green-400">Ton avis a ete publie ! Merci.</p>
        </div>
      )}

      {/* Write Review CTA */}
      {eligibleAuctions.length > 0 && !showForm && (
        <button
          onClick={() => {
            setShowForm(true)
            if (eligibleAuctions.length === 1) setSelectedAuction(eligibleAuctions[0].id)
          }}
          className="w-full py-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 border border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 transition"
        >
          <Star size={16} className="text-yellow-400" /> Laisser un avis pour {producerName}
        </button>
      )}

      {/* Review Form */}
      {showForm && (
        <div className="bg-[#111111] border border-yellow-500/30 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Star size={16} className="text-yellow-400" /> Laisser un avis
          </h3>

          {/* Select auction */}
          {eligibleAuctions.length > 1 && (
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Pour quel achat ?</label>
              <div className="space-y-2">
                {eligibleAuctions.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAuction(a.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition border ${
                      selectedAuction === a.id
                        ? 'border-yellow-500/50 bg-yellow-500/5'
                        : 'border-[#222] hover:border-[#333]'
                    }`}
                  >
                    <Music size={16} className="text-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-white truncate block">{a.beat.title}</span>
                      <span className="text-[10px] text-gray-500">{a.beat.genre} · {a.finalPrice} EUR · {a.winningLicense}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {eligibleAuctions.length === 1 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-[#222]">
              <Music size={16} className="text-red-500" />
              <div>
                <span className="text-sm font-semibold text-white">{eligibleAuctions[0].beat.title}</span>
                <span className="text-[10px] text-gray-500 block">{eligibleAuctions[0].beat.genre} · {eligibleAuctions[0].finalPrice} EUR</span>
              </div>
            </div>
          )}

          {/* Stars */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Note</label>
            <StarRating rating={formRating} size={28} interactive onChange={setFormRating} />
            {formRating > 0 && (
              <span className="text-xs text-gray-500 mt-1 block">
                {formRating === 1 ? 'Decevant' : formRating === 2 ? 'Moyen' : formRating === 3 ? 'Bien' : formRating === 4 ? 'Tres bien' : 'Excellent'}
              </span>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Commentaire (optionnel)</label>
            <textarea
              value={formComment}
              onChange={(e) => setFormComment(e.target.value)}
              placeholder="Partage ton experience avec ce producteur..."
              maxLength={500}
              rows={3}
              className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 resize-none focus:border-yellow-500/50 focus:outline-none transition"
            />
            <div className="text-[10px] text-gray-600 text-right mt-0.5">{formComment.length}/500</div>
          </div>

          {/* Error */}
          {submitError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {submitError}
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={!formRating || !selectedAuction || submitting}
              className="flex-1 py-3 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)' }}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {submitting ? 'Envoi...' : 'Publier mon avis'}
            </button>
            <button
              onClick={() => { setShowForm(false); setSubmitError('') }}
              className="px-4 py-3 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Reviews List */}
      {reviews.length > 0 ? (
        <div className="space-y-3">
          {reviews.map(review => {
            // BUG FIX 2: Null guard — l'auteur peut etre supprime (SetNull)
            const authorName = review.author
              ? (review.author.displayName || review.author.name || 'Utilisateur')
              : 'Utilisateur supprime'
            return (
              <div key={review.id} className="bg-[#111111] border border-[#222222] rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-xs font-bold text-white">
                      {authorName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white">{authorName}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StarRating rating={review.rating} size={12} />
                        <span className="text-[10px] text-gray-600">{timeAgo(review.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Music size={9} /> {review.auction.beat.title}
                  </span>
                </div>

                {review.comment && (
                  <p className="text-sm text-gray-300 leading-relaxed mt-2 pl-12">
                    {review.comment}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-[#111111] border border-[#222222] rounded-xl">
          <MessageSquare size={40} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-bold">Aucun avis pour le moment</p>
          <p className="text-gray-600 text-sm mt-1">Sois le premier a laisser un avis</p>
        </div>
      )}
    </div>
  )
}
