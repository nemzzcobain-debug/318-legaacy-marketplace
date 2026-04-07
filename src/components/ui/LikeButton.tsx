'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'

interface Props {
  beatId: string
  initialLiked?: boolean
  initialCount?: number
  size?: 'sm' | 'md'
  showCount?: boolean
}

export default function LikeButton({
  beatId,
  initialLiked = false,
  initialCount = 0,
  size = 'md',
  showCount = true,
}: Props) {
  const { data: session } = useSession()
  const router = useRouter()
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [animating, setAnimating] = useState(false)

  // Fetch real like status on mount
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`/api/likes?beatId=${beatId}`)
        if (res.ok) {
          const data = await res.json()
          setLiked(data.liked)
          setCount(data.count)
        }
      } catch {}
    }
    check()
  }, [beatId])

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!session?.user) {
      router.push('/login')
      return
    }

    // Optimistic update
    setLiked(!liked)
    setCount(prev => liked ? prev - 1 : prev + 1)
    setAnimating(true)
    setTimeout(() => setAnimating(false), 300)

    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beatId }),
      })

      if (res.ok) {
        const data = await res.json()
        setLiked(data.liked)
        setCount(data.count)
      }
    } catch {
      // Revert on error
      setLiked(liked)
      setCount(count)
    }
  }

  const sizeClasses = size === 'sm'
    ? 'w-8 h-8 text-xs'
    : 'w-10 h-10 text-sm'

  const iconSize = size === 'sm' ? 14 : 18

  return (
    <button
      onClick={toggle}
      className={`
        flex items-center gap-1.5 transition-all
        ${showCount ? 'pr-2' : ''}
      `}
      aria-label={liked ? 'Retirer le like' : 'Ajouter aux favoris'}
      aria-pressed={liked}
    >
      <div
        className={`
          ${sizeClasses} rounded-lg flex items-center justify-center transition-all
          ${liked
            ? 'bg-pink-500/20 text-pink-500'
            : 'bg-white/5 text-gray-400 hover:text-pink-400 hover:bg-pink-500/10'
          }
          ${animating ? 'scale-125' : 'scale-100'}
        `}
      >
        <Heart
          size={iconSize}
          fill={liked ? 'currentColor' : 'none'}
          className="transition-all"
        />
      </div>
      {showCount && (
        <span className={`font-semibold ${liked ? 'text-pink-400' : 'text-gray-400'} ${size === 'sm' ? 'text-[11px]' : 'text-xs'}`}>
          {count}
        </span>
      )}
    </button>
  )
}
