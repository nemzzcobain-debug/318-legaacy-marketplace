'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase-client'

interface PresenceState {
  [userId: string]: {
    online: boolean
    lastSeen: string
  }
}

/**
 * Hook pour la présence en ligne via Supabase Presence
 * Track les utilisateurs connectés à la page messages
 */
export function usePresence(userId: string) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!userId) return

    const supabase = getSupabaseClient()

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const online = new Set<string>()

        Object.keys(state).forEach((key) => {
          online.add(key)
        })

        setOnlineUsers(online)
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev)
          next.add(key)
          return next
        })
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online: true,
            lastSeen: new Date().toISOString(),
          })
        }
      })

    channelRef.current = channel

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [userId])

  const isOnline = useCallback(
    (uid: string) => onlineUsers.has(uid),
    [onlineUsers]
  )

  return { onlineUsers, isOnline }
}
