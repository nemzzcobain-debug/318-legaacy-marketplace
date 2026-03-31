'use client'

// ─── 318 LEGAACY Marketplace - Follow Button Component ───
// Reusable follow/unfollow button with real-time count
// Props: producerId, initialFollowing?, initialCount?, size?, showCount?

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { UserPlus, UserCheck, Loader2 } from 'lucide-react'

interface FollowButtonProps {
  producerId: string
  initialFollowing?: boolean
  initialCount?: number
  size?: 'sm' | 'md' | 'lg'
  showCount?: boolean
  variant?: 'default' | 'outline'
}

export default function FollowButton({
  producerId,
  initialFollowing = false,
  initialCount = 0,
  size = 'md',
  showCount = true,
  variant = 'default'
}: FollowButtonProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  // Fetch real status on mount
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch(`/api/follows?producerId=${producerId}`)
        if (res.ok) {
          const data = await res.json()
          setIsFollowing(data.isFollowing)
          setCount(data.count)
        }
      } catch {
        // Keep initial values
      } finally {
        setFetched(true)
      }
    }
    fetchStatus()
  }, [producerId])

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!session?.user) {
      router.push('/login')
      return
    }

    // Don't follow yourself
    if (session.user.id === producerId) return

    setLoading(true)

    // Optimistic update
    const wasFollowing = isFollowing
    setIsFollowing(!wasFollowing)
    setCount(prev => wasFollowing ? Math.max(0, prev - 1) : prev + 1)

    try {
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producerId })
      })

      if (res.ok) {
        const data = await res.json()
        setIsFollowing(data.followed)
        setCount(data.count)
      } else {
        // Revert
        setIsFollowing(wasFollowing)
        setCount(prev => wasFollowing ? prev + 1 : Math.max(0, prev - 1))
      }
    } catch {
      // Revert
      setIsFollowing(wasFollowing)
      setCount(prev => wasFollowing ? prev + 1 : Math.max(0, prev - 1))
    } finally {
      setLoading(false)
    }
  }, [session, producerId, isFollowing, router])

  // Don't show follow button for your own profile
  if (session?.user?.id === producerId) return null

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-5 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2'
  }

  const iconSizes = { sm: 13, md: 16, lg: 18 }

  if (isFollowing) {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className={`
          ${sizeClasses[size]}
          rounded-xl font-bold flex items-center transition-all duration-200
          bg-red-500/10 text-red-500 border border-red-500/30
          hover:bg-red-500/5 hover:border-red-500/20
          group
        `}
      >
        {loading ? (
          <Loader2 size={iconSizes[size]} className="animate-spin" />
        ) : (
          <UserCheck size={iconSizes[size]} className="group-hover:hidden" />
        )}
        {!loading && (
          <UserPlus size={iconSizes[size]} className="hidden group-hover:block" />
        )}
        <span className="group-hover:hidden">Suivi</span>
        <span className="hidden group-hover:inline">Ne plus suivre</span>
        {showCount && count > 0 && (
          <span className="text-red-400/60 ml-1">{count}</span>
        )}
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`
        ${sizeClasses[size]}
        rounded-xl font-bold flex items-center transition-all duration-200
        ${variant === 'default'
          ? 'text-white border border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50'
          : 'text-white border border-[#333333] hover:border-red-500/30 hover:bg-red-500/5'
        }
      `}
    >
      {loading ? (
        <Loader2 size={iconSizes[size]} className="animate-spin" />
      ) : (
        <UserPlus size={iconSizes[size]} />
      )}
      Suivre
      {showCount && count > 0 && (
        <span className="text-gray-500 ml-1">{count}</span>
      )}
    </button>
  )
}
