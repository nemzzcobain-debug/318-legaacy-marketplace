'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Music, TrendingUp } from 'lucide-react'

interface SimilarAuction {
  id: string
  currentBid: number
  endTime: string
  beat: {
    id: string
    title: string
    coverImage: string | null
    genre: string | null
    bpm: number | null
  }
  _count: {
    bids: number
  }
}

interface SimilarBeatsProps {
  auctionId: string
}

export default function SimilarBeats({ auctionId }: SimilarBeatsProps) {
  const [beats, setBeats] = useState<SimilarAuction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSimilar() {
      try {
        const res = await fetch(`/api/auctions/${auctionId}/similar`)
        const data = await res.json()
        setBeats(data.beats || [])
      } catch {
        setBeats([])
      } finally {
        setLoading(false)
      }
    }
    fetchSimilar()
  }, [auctionId])

  if (loading) {
    return (
      <section className="mt-12">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Music className="w-5 h-5 text-red-500" />
          Beats similaires
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-800/50 rounded-xl animate-pulse aspect-square" />
          ))}
        </div>
      </section>
    )
  }

  if (beats.length === 0) return null

  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Music className="w-5 h-5 text-red-500" />
        Beats similaires
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {beats.map((auction) => (
          <Link
            key={auction.id}
            href={`/auction/${auction.id}`}
            className="group bg-gray-800/50 rounded-xl overflow-hidden hover:bg-gray-700/50 transition-all duration-300 hover:scale-[1.02]"
          >
            <div className="relative aspect-square">
              {auction.beat.coverImage ? (
                <Image
                  src={auction.beat.coverImage}
                  alt={auction.beat.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 16vw"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-red-900/30 to-gray-900 flex items-center justify-center">
                  <Music className="w-8 h-8 text-gray-600" />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <p className="text-xs font-bold text-red-400">{auction.currentBid.toFixed(0)} €</p>
              </div>
            </div>
            <div className="p-3">
              <h3 className="text-sm font-semibold text-white truncate">{auction.beat.title}</h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                {auction.beat.genre && <span>{auction.beat.genre}</span>}
                {auction.beat.bpm && <span>• {auction.beat.bpm} BPM</span>}
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                <TrendingUp className="w-3 h-3" />
                <span>{auction._count.bids} enchère{auction._count.bids !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
