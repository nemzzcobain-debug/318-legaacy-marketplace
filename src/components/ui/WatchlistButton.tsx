'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface WatchlistButtonProps {
  auctionId: string
  size?: 'sm' | 'md'
  showLabel?: boolean
}

export default function WatchlistButton({ auctionId, size = 'sm', showLabel = false }: WatchlistButtonProps) {
  const { data: session } = useSession()
  const [isWatching, setIsWatching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)

  // Vérifier si dans la watchlist au montage
  useEffect(() => {
    if (!session?.user) return

    fetch('/api/watchlist')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const found = data.some((w: any) => w.auctionId === auctionId)
          setIsWatching(found)
        }
        setChecked(true)
      })
      .catch(() => setChecked(true))
  }, [session, auctionId])

  const toggle = async () => {
    if (!session?.user || loading) return

    setLoading(true)
    try {
      if (isWatching) {
        const res = await fetch('/api/watchlist', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auctionId }),
        })
        if (res.ok) setIsWatching(false)
      } else {
        const res = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auctionId }),
        })
        if (res.ok) setIsWatching(true)
      }
    } catch {
      console.error('Watchlist toggle error')
    } finally {
      setLoading(false)
    }
  }

  if (!session?.user) return null
  if (!checked) return null

  const iconSize = size === 'sm' ? 16 : 20

  if (showLabel) {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition border ${
          isWatching
            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20'
            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600'
        } disabled:opacity-50`}
        aria-label={isWatching ? 'Retirer de la watchlist' : 'Ajouter à la watchlist'}
        aria-pressed={isWatching}
      >
        {loading ? (
          <Loader2 size={iconSize} className="animate-spin" />
        ) : isWatching ? (
          <Eye size={iconSize} />
        ) : (
          <EyeOff size={iconSize} />
        )}
        {isWatching ? 'Suivi' : 'Suivre'}
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={isWatching ? 'Retirer de la watchlist' : 'Ajouter à la watchlist'}
      aria-pressed={isWatching}
      className={`p-2 rounded-lg transition ${
        isWatching
          ? 'text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20'
          : 'text-zinc-500 hover:text-yellow-400 hover:bg-yellow-500/10'
      } disabled:opacity-50`}
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : isWatching ? (
        <Eye size={iconSize} />
      ) : (
        <EyeOff size={iconSize} />
      )}
    </button>
  )
}
