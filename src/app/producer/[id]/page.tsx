'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import AudioPlayer from '@/components/audio/AudioPlayer'
import CountdownTimer from '@/components/ui/CountdownTimer'
import Link from 'next/link'
import {
  Shield, Star, Play, Heart, Music, Gavel, TrendingUp,
  Clock, DollarSign, Users, Calendar, Loader2, ExternalLink,
  Disc, Headphones, Award, BarChart3, MessageCircle
} from 'lucide-react'
import LikeButton from '@/components/ui/LikeButton'
import FollowButton from '@/components/ui/FollowButton'
import ReviewSection from '@/components/reviews/ReviewSection'

interface ProducerProfile {
  id: string
  name: string
  displayName: string | null
  avatar: string | null
  bio: string | null
  producerBio: string | null
  producerStatus: string | null
  rating: number
  totalSales: number
  beats: Beat[]
  stats: {
    totalBeats: number
    totalAuctions: number
    completedAuctions: number
    totalPlays: number
    totalLikes: number
    totalFollowers: number
    totalRevenue: number
    memberSince: string
  }
}

interface Beat {
  id: string
  title: string
  genre: string
  mood: string | null
  bpm: number
  key: string | null
  audioUrl: string
  coverImage: string | null
  plays: number
  status: string
  createdAt: string
  _count: { likes: number }
  auctions: {
    id: string
    status: string
    currentBid: number
    startPrice: number
    totalBids: number
    endTime: string
    licenseType: string
  }[]
}

function memberSince(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export default function ProducerProfilePage() {
  const params = useParams()
  const producerId = params.id as string

  const [producer, setProducer] = useState<ProducerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'beats' | 'auctions' | 'reviews' | 'about'>('beats')
  const [playingId, setPlayingId] = useState<string | null>(null)

  useEffect(() => {
    async function loadProducer() {
      try {
        const res = await fetch(`/api/producers/${producerId}`)
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Producteur non trouve')
          return
        }

        setProducer(data)
      } catch {
        setError('Erreur de connexion')
      } finally {
        setLoading(false)
      }
    }

    loadProducer()
  }, [producerId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-red-500" />
      </div>
    )
  }

  if (error || !producer) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Header />
        <main className="max-w-lg mx-auto px-4 py-20 text-center">
          <Music size={48} className="text-gray-700 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Producteur non trouve</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link href="/producers" className="px-6 py-3 rounded-xl bg-[#111111] border border-[#222222] text-white font-semibold">
            Voir tous les producteurs
          </Link>
        </main>
      </div>
    )
  }

  const displayName = producer.displayName || producer.name
  const beatsWithAuctions = producer.beats.filter(b => b.auctions.length > 0)
  const allBeats = producer.beats

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={14}
        className={i < Math.round(rating) ? 'text-yellow-400' : 'text-gray-700'}
        fill={i < Math.round(rating) ? '#facc15' : 'none'}
      />
    ))
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden mb-6">
          {/* Banner */}
          <div className="h-32 bg-gradient-to-r from-red-900/40 via-[#111111] to-purple-900/30" />

          <div className="px-6 pb-6 -mt-12">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-3xl font-black text-white border-4 border-[#111111] shadow-xl">
                {producer.avatar ? (
                  <img src={producer.avatar} alt={displayName} className="w-full h-full rounded-2xl object-cover" />
                ) : (
                  displayName[0].toUpperCase()
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-black text-white">{displayName}</h1>
                  {producer.producerStatus === 'APPROVED' && (
                    <Shield size={18} className="text-red-500" />
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1">
                    {renderStars(producer.rating)}
                    <span className="text-xs text-gray-400 ml-1">
                      {producer.rating > 0 ? producer.rating.toFixed(1) : 'Nouveau'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-600">|</span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Calendar size={11} /> Membre depuis {memberSince(producer.stats.memberSince)}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <Link
                  href={`/messages?to=${producer.id}`}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm text-black flex items-center gap-2 transition-transform hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                >
                  <MessageCircle size={16} /> Contacter
                </Link>
                <FollowButton producerId={producer.id} size="md" />
              </div>
            </div>

            {/* Bio */}
            {(producer.producerBio || producer.bio) && (
              <p className="text-sm text-gray-400 mt-4 max-w-2xl leading-relaxed">
                {producer.producerBio || producer.bio}
              </p>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Beats', value: producer.stats.totalBeats, icon: Disc, color: 'text-red-500 bg-red-500/10' },
            { label: 'Ventes', value: producer.stats.completedAuctions, icon: DollarSign, color: 'text-green-400 bg-green-500/10' },
            { label: 'Ecoutes', value: producer.stats.totalPlays.toLocaleString(), icon: Headphones, color: 'text-blue-400 bg-blue-500/10' },
            { label: 'Followers', value: producer.stats.totalFollowers, icon: Users, color: 'text-purple-400 bg-purple-500/10' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#111111] border border-[#222222] rounded-xl p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${color}`}>
                <Icon size={18} />
              </div>
              <div className="text-xl font-extrabold text-white">{value}</div>
              <div className="text-[11px] text-gray-500">{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[#222222] pb-2">
          {[
            { id: 'beats' as const, label: 'Beats', icon: Music, count: allBeats.length },
            { id: 'auctions' as const, label: 'Encheres actives', icon: Gavel, count: beatsWithAuctions.length },
            { id: 'reviews' as const, label: 'Avis', icon: Star },
            { id: 'about' as const, label: 'A propos', icon: Users },
          ].map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-semibold transition ${
                activeTab === id
                  ? 'text-red-500 bg-red-500/10 border-b-2 border-red-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon size={14} /> {label}
              {count !== undefined && (
                <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded-full">{count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'beats' && (
          <div className="space-y-3">
            {allBeats.length > 0 ? (
              allBeats.map((beat) => {
                const auction = beat.auctions[0]
                const isPlaying = playingId === beat.id

                return (
                  <div
                    key={beat.id}
                    className="bg-[#111111] border border-[#222222] rounded-xl p-4 hover:bg-white/[0.02] transition"
                  >
                    <div className="flex items-center gap-4">
                      {/* Play button */}
                      <button
                        onClick={() => setPlayingId(isPlaying ? null : beat.id)}
                        className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 hover:bg-red-500/20 transition"
                      >
                        {isPlaying ? (
                          <div className="w-4 h-4 border-2 border-red-500 rounded-sm" />
                        ) : (
                          <Play size={20} className="text-red-500 ml-0.5" />
                        )}
                      </button>

                      {/* Beat info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-white truncate">{beat.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-gray-500 bg-white/5 rounded px-1.5 py-0.5">{beat.genre}</span>
                          <span className="text-[10px] text-gray-500">{beat.bpm} BPM</span>
                          {beat.key && <span className="text-[10px] text-gray-500">{beat.key}</span>}
                          {beat.mood && <span className="text-[10px] text-gray-500">{beat.mood}</span>}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Play size={11} /> {beat.plays}</span>
                        <LikeButton beatId={beat.id} initialCount={beat._count.likes} size="sm" />
                      </div>

                      {/* Auction CTA */}
                      {auction ? (
                        <Link
                          href={`/auction/${auction.id}`}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white"
                          style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
                        >
                          <Gavel size={12} /> {auction.currentBid}&euro;
                        </Link>
                      ) : (
                        <span className="text-[10px] text-gray-600 px-3 py-1.5 rounded-lg bg-white/5">
                          Pas d'enchere
                        </span>
                      )}
                    </div>

                    {/* Audio Player */}
                    {isPlaying && (
                      <div className="mt-3 pt-3 border-t border-[#222222]">
                        <AudioPlayer
                          src={beat.audioUrl}
                          isPlaying={true}
                          onPlayToggle={() => setPlayingId(null)}
                        />
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="text-center py-16">
                <Music size={40} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400">Aucun beat pour le moment</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'auctions' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {beatsWithAuctions.length > 0 ? (
              beatsWithAuctions.map((beat) => {
                const auction = beat.auctions[0]
                return (
                  <Link
                    key={auction.id}
                    href={`/auction/${auction.id}`}
                    className="bg-[#111111] border border-[#222222] rounded-xl p-5 hover:border-red-500/30 transition group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1a0a2e] to-[#16213e] flex items-center justify-center flex-shrink-0">
                        <Music size={20} className="text-white/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-white truncate group-hover:text-red-500 transition">{beat.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-500">{beat.genre}</span>
                          <span className="text-[10px] text-gray-500">{beat.bpm} BPM</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-gray-500 mb-0.5">Enchere actuelle</div>
                        <div className="text-lg font-extrabold text-red-500">{auction.currentBid}&euro;</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-gray-500 mb-0.5">{auction.totalBids} encheres</div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock size={11} />
                          <CountdownTimer endTime={auction.endTime} size="sm" showIcon={false} />
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })
            ) : (
              <div className="col-span-2 text-center py-16">
                <Gavel size={40} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400">Aucune enchere active</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <ReviewSection producerId={producer.id} producerName={displayName} />
        )}

        {activeTab === 'about' && (
          <div className="bg-[#111111] border border-[#222222] rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">A propos de {displayName}</h3>

            {(producer.producerBio || producer.bio) ? (
              <p className="text-sm text-gray-400 leading-relaxed mb-6">
                {producer.producerBio || producer.bio}
              </p>
            ) : (
              <p className="text-sm text-gray-500 italic mb-6">
                Ce producteur n'a pas encore ajoute de bio.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/[0.02] rounded-xl p-4">
                <BarChart3 size={18} className="text-red-500 mb-2" />
                <div className="text-sm font-bold text-white mb-0.5">Statistiques</div>
                <div className="space-y-1.5 text-xs text-gray-400">
                  <div className="flex justify-between"><span>Beats crees</span><span className="text-white">{producer.stats.totalBeats}</span></div>
                  <div className="flex justify-between"><span>Encheres lancees</span><span className="text-white">{producer.stats.totalAuctions}</span></div>
                  <div className="flex justify-between"><span>Ventes completees</span><span className="text-white">{producer.stats.completedAuctions}</span></div>
                  <div className="flex justify-between"><span>Total ecoutes</span><span className="text-white">{producer.stats.totalPlays.toLocaleString()}</span></div>
                </div>
              </div>

              <div className="bg-white/[0.02] rounded-xl p-4">
                <Award size={18} className="text-yellow-400 mb-2" />
                <div className="text-sm font-bold text-white mb-0.5">Reputation</div>
                <div className="space-y-1.5 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>Note</span>
                    <div className="flex items-center gap-1">
                      {renderStars(producer.rating)}
                    </div>
                  </div>
                  <div className="flex justify-between"><span>Followers</span><span className="text-white">{producer.stats.totalFollowers}</span></div>
                  <div className="flex justify-between"><span>Total likes</span><span className="text-white">{producer.stats.totalLikes}</span></div>
                  <div className="flex justify-between"><span>Ventes totales</span><span className="text-white">{producer.totalSales}</span></div>
                  <div className="flex justify-between">
                    <span>Statut</span>
                    <span className={producer.producerStatus === 'APPROVED' ? 'text-green-400' : 'text-yellow-400'}>
                      {producer.producerStatus === 'APPROVED' ? 'Verifie' : 'En attente'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
