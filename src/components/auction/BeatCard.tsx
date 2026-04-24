'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Play, Pause, Flame, Shield, Gavel, TrendingUp, Clock, Heart, Music } from 'lucide-react'
import CountdownTimer from '@/components/ui/CountdownTimer'
import AudioPlayer from '@/components/audio/AudioPlayer'
import LikeButton from '@/components/ui/LikeButton'
import type { Auction } from '@/types'

interface Props {
  auction: Auction
  onPlay?: (id: string) => void
  isPlaying?: boolean
}

export default function BeatCard({ auction, onPlay, isPlaying }: Props) {
  const [hovering, setHovering] = useState(false)

  const { beat } = auction
  const producer = beat.producer

  // Couleurs de fond par genre
  const genreGradients: Record<string, string> = {
    Trap: 'from-[#1a0a2e] to-[#16213e]',
    Drill: 'from-[#0d0d0d] to-[#1a0000]',
    'R&B': 'from-[#1a0a2e] to-[#2d1b4e]',
    Afrobeat: 'from-[#1a2e0a] to-[#0a2e1a]',
    'Lo-Fi': 'from-[#0a1a2e] to-[#1a2e3e]',
    Pop: 'from-[#2e0a2e] to-[#1a0a3e]',
    'Boom Bap': 'from-[#1a1a0a] to-[#2e1a0a]',
    Dancehall: 'from-[#0a2e2e] to-[#0a1a2e]',
  }

  const gradient = genreGradients[beat.genre] || 'from-[#0a0a1e] to-[#1a1a2e]'
  const isEndingSoon = auction.status === 'ENDING_SOON'
  const priceIncrease = Math.round(
    ((auction.currentBid - auction.startPrice) / auction.startPrice) * 100
  )

  return (
    <Link href={`/auction/${auction.id}`}>
      <div
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className={`
          bg-brand-card border rounded-2xl overflow-hidden cursor-pointer
          transition-all duration-300
          ${isEndingSoon ? 'border-[#ff4757]' : 'border-brand-border'}
          ${hovering ? 'translate-y-[-4px] shadow-[0_12px_40px_rgba(0,0,0,0.4)] bg-brand-card-hover' : 'shadow-[0_2px_8px_rgba(0,0,0,0.2)]'}
        `}
      >
        {/* Cover Area */}
        <div
          className={`h-44 bg-gradient-to-br ${gradient} flex items-center justify-center relative overflow-hidden`}
        >
          {/* Cover Image */}
          {beat.coverImage ? (
            <Image
              src={beat.coverImage}
              alt={beat.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          ) : (
            <Music size={32} className="text-white/20 absolute" />
          )}

          {/* Hot Badge */}
          {auction.totalBids > 10 && (
            <div
              className="absolute top-2.5 left-2.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-black flex items-center gap-1"
              style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
            >
              <Flame size={10} /> HOT
            </div>
          )}

          {/* Genre Badge */}
          <div className="absolute top-2.5 right-2.5 bg-white/10 backdrop-blur-md rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white">
            {beat.genre}
          </div>

          {/* Play Button */}
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onPlay?.(beat.id)
            }}
            className={`
              w-14 h-14 rounded-full bg-[#e11d48] flex items-center justify-center
              shadow-[0_4px_20px_rgba(225,29,72,0.4)] transition-transform
              ${hovering ? 'scale-110' : 'scale-100'}
            `}
            aria-label={isPlaying ? 'Arrêter la lecture' : 'Lire le beat'}
            aria-pressed={isPlaying}
          >
            {isPlaying ? (
              <Pause size={24} className="text-black" />
            ) : (
              <Play size={24} className="text-black ml-0.5" />
            )}
          </button>

          {/* BPM & Key */}
          <div className="absolute bottom-2.5 left-2.5 flex gap-1.5">
            <span className="bg-black/60 rounded-md px-2 py-0.5 text-[10px] text-gray-300">
              {beat.bpm} BPM
            </span>
            {beat.key && (
              <span className="bg-black/60 rounded-md px-2 py-0.5 text-[10px] text-gray-300">
                {beat.key}
              </span>
            )}
          </div>

          {/* Like Button */}
          <div className="absolute bottom-2.5 right-2.5">
            <LikeButton
              beatId={beat.id}
              initialCount={beat._count?.likes || 0}
              size="sm"
              showCount={false}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-3.5">
          {/* Title & Producer */}
          <div className="mb-2.5">
            <h3 className="text-[15px] font-bold text-white leading-tight truncate">
              {beat.title}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-[9px] font-bold text-white">
                {producer.name[0]}
              </div>
              <span className="text-xs text-gray-400">{producer.displayName || producer.name}</span>
              {producer.producerStatus === 'APPROVED' && (
                <Shield size={11} className="text-[#e11d48]" />
              )}
            </div>
          </div>

          {/* Audio Waveform Player */}
          {beat.audioUrl && (
            <div
              className="mb-2.5"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <AudioPlayer
                src={beat.audioUrl}
                compact
                isPlaying={isPlaying}
                onPlayToggle={() => onPlay?.(beat.id)}
              />
            </div>
          )}

          {/* Countdown */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Clock size={11} /> Fin dans
            </span>
            <CountdownTimer endTime={auction.endTime} size="sm" showIcon={false} />
          </div>

          {/* Bid Info */}
          <div className="bg-[#e11d4808] border border-[#e11d4820] rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-gray-400 mb-0.5">Enchere actuelle</div>
              <div className="text-lg font-extrabold text-[#e11d48]">
                {auction.currentBid}&euro;
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-400 mb-1">{auction.totalBids} encheres</div>
              <span
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-black"
                style={{ background: 'linear-gradient(135deg, #e11d48 0%, #ff0033 100%)' }}
              >
                <Gavel size={12} /> Encherir
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex justify-between mt-2.5 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <Play size={10} /> {beat.plays}
            </span>
            <span className="flex items-center gap-1">
              <Heart size={10} /> {beat._count?.likes || 0}
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp size={10} /> +{priceIncrease}%
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
