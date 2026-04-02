'use client'

import { useEffect, useRef } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase-client'

interface UseRealtimeConversationsOptions {
  userId: string
  onConversationUpdate?: () => void
}

/**
 * Hook pour détecter les mises à jour de conversations en temps réel
 * Écoute les UPDATE sur la table Conversation (nouveau lastMessage)
 * et les INSERT sur Message (pour le badge de non-lu)
 */
export function useRealtimeConversations({ userId, onConversationUpdate }: UseRealtimeConversationsOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!userId) return

    const supabase = getSupabaseClient()

    const channel = supabase
      .channel(`conversations:${userId}`)
      // Écouter les mises à jour de Conversation (lastMessage, lastMessageAt)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Conversation',
        },
        (payload) => {
          const conv = payload.new as any
          // Vérifier que l'utilisateur est impliqué dans cette conversation
          if (conv.user1Id === userId || conv.user2Id === userId) {
            onConversationUpdate?.()
          }
        }
      )
      // Écouter les nouveaux messages pour mettre à jour le badge non-lu
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
        },
        (payload) => {
          const msg = payload.new as any
          // Si le message n'est pas de nous, rafraîchir la liste
          if (msg.senderId !== userId) {
            onConversationUpdate?.()
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [userId, onConversationUpdate])
}
