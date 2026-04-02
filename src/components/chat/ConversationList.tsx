'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Search, MessageCircle, Loader2 } from 'lucide-react'
import { useRealtimeConversations } from '@/hooks/useRealtimeConversations'

interface ConversationItem {
  id: string
  otherUser: {
    id: string
    name: string
    displayName: string | null
    avatar: string | null
    role: string
  }
  lastMessage: {
    id: string
    content: string
    senderId: string
    read: boolean
    createdAt: string
  } | null
  lastMessageAt: string | null
  unreadCount: number
}

interface Props {
  activeConversationId: string | null
  onSelectConversation: (conv: ConversationItem) => void
  isOnline?: (userId: string) => boolean
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) return 'maintenant'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function ConversationList({ activeConversationId, onSelectConversation, isOnline }: Props) {
  const { data: session } = useSession()
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const userId = session?.user?.id || ''

  const fetchConversations = useCallback(async () => {
    if (!session?.user) return
    try {
      const res = await fetch('/api/conversations')
      const data = await res.json()
      if (res.ok) {
        setConversations(data.conversations || [])
      }
    } catch {} finally {
      setLoading(false)
    }
  }, [session])

  // Realtime — re-fetch quand une conversation est mise à jour
  useRealtimeConversations({
    userId,
    onConversationUpdate: fetchConversations,
  })

  // Initial load
  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Fallback polling (60s au lieu de 5s) — sécurité si le Realtime est hors ligne
  useEffect(() => {
    const interval = setInterval(fetchConversations, 60000)
    return () => clearInterval(interval)
  }, [fetchConversations])

  const filtered = conversations.filter((c) => {
    if (!search) return true
    const name = (c.otherUser.displayName || c.otherUser.name).toLowerCase()
    return name.includes(search.toLowerCase())
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-gray-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-[#1e1e2e]">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:border-red-500/50 focus:outline-none transition"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length > 0 ? (
          filtered.map((conv) => {
            const isActive = activeConversationId === conv.id
            const userName = conv.otherUser.displayName || conv.otherUser.name
            const isProducer = conv.otherUser.role === 'PRODUCER' || conv.otherUser.role === 'ADMIN'
            const online = isOnline?.(conv.otherUser.id) ?? false

            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#1e1e2e]/50 ${
                  isActive
                    ? 'bg-red-500/10 border-l-2 border-l-red-500'
                    : 'hover:bg-white/[0.03]'
                }`}
              >
                {/* Avatar avec indicateur en ligne */}
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-sm font-bold text-white">
                    {userName[0]?.toUpperCase() || 'U'}
                  </div>
                  {online && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#111111] rounded-full" />
                  )}
                  {conv.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center px-1">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`text-sm font-semibold truncate ${conv.unreadCount > 0 ? 'text-white' : 'text-gray-300'}`}>
                        {userName}
                      </span>
                      {isProducer && (
                        <span className="text-[9px] font-bold bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          PROD
                        </span>
                      )}
                    </div>
                    {conv.lastMessageAt && (
                      <span className="text-[10px] text-gray-600 flex-shrink-0">
                        {timeAgo(conv.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  {conv.lastMessage && (
                    <p className={`text-xs mt-0.5 truncate ${conv.unreadCount > 0 ? 'text-gray-300' : 'text-gray-500'}`}>
                      {conv.lastMessage.senderId === session?.user?.id ? 'Toi: ' : ''}
                      {conv.lastMessage.content}
                    </p>
                  )}
                </div>
              </button>
            )
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <MessageCircle size={40} className="text-gray-700 mb-3" />
            <p className="text-sm text-gray-500 font-semibold">
              {search ? 'Aucun resultat' : 'Aucune conversation'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {search ? 'Essaie un autre nom' : 'Contacte un producteur depuis son profil'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
