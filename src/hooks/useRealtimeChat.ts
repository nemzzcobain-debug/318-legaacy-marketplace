'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase-client'

interface MessageItem {
  id: string
  content: string
  read: boolean
  senderId: string
  createdAt: string
  sender: {
    id: string
    name: string
    displayName: string | null
    avatar: string | null
  }
}

interface UseRealtimeChatOptions {
  conversationId: string
  userId: string
  onNewMessage?: (message: MessageItem) => void
}

/**
 * Hook pour recevoir les messages en temps réel via Supabase Realtime
 * Utilise postgres_changes (INSERT sur Message) + Broadcast pour typing
 */
export function useRealtimeChat({ conversationId, userId, onNewMessage }: UseRealtimeChatOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [isOtherTyping, setIsOtherTyping] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Écouter les nouveaux messages via postgres_changes
  useEffect(() => {
    if (!conversationId || !userId) return

    const supabase = getSupabaseClient()

    const channel = supabase
      .channel(`chat:${conversationId}`)
      // Écouter les INSERT sur la table Message filtrés par conversation
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
          filter: `conversationId=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as any

          // Ignorer les messages envoyés par nous (déjà ajoutés en optimistic)
          if (newMsg.senderId === userId) return

          // Construire l'objet message pour le composant
          const message: MessageItem = {
            id: newMsg.id,
            content: newMsg.content,
            read: newMsg.read,
            senderId: newMsg.senderId,
            createdAt: newMsg.createdAt,
            sender: {
              id: newMsg.senderId,
              name: '',
              displayName: null,
              avatar: null,
            },
          }

          onNewMessage?.(message)

          // L'autre ne tape plus s'il vient d'envoyer
          setIsOtherTyping(false)
        }
      )
      // Écouter les broadcasts pour le typing indicator
      .on('broadcast', { event: 'typing' }, (payload) => {
        const data = payload.payload as { userId: string; isTyping: boolean }
        if (data.userId !== userId) {
          setIsOtherTyping(data.isTyping)

          // Auto-clear après 3s si pas de nouveau signal
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
          if (data.isTyping) {
            typingTimeoutRef.current = setTimeout(() => {
              setIsOtherTyping(false)
            }, 3000)
          }
        }
      })
      // Écouter les broadcasts pour mark as read
      .on('broadcast', { event: 'read' }, (payload) => {
        // L'autre a lu nos messages — on pourra mettre à jour les ✓✓
        const data = payload.payload as { userId: string }
        if (data.userId !== userId) {
          // Déclencher un re-fetch ou mettre à jour localement
        }
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [conversationId, userId, onNewMessage])

  // Envoyer un signal "typing"
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!channelRef.current) return
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId, isTyping },
      })
    },
    [userId]
  )

  // Envoyer un signal "read" (l'autre voit les ✓✓)
  const sendRead = useCallback(() => {
    if (!channelRef.current) return
    channelRef.current.send({
      type: 'broadcast',
      event: 'read',
      payload: { userId },
    })
  }, [userId])

  return { isOtherTyping, sendTyping, sendRead }
}
