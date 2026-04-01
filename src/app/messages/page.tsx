'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import ConversationList from '@/components/chat/ConversationList'
import ChatWindow from '@/components/chat/ChatWindow'
import { MessageCircle, Loader2 } from 'lucide-react'

interface ConversationItem {
  id: string
  otherUser: {
    id: string
    name: string
    displayName: string | null
    avatar: string | null
    role: string
  }
  lastMessage: any
  lastMessageAt: string | null
  unreadCount: number
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-red-500" />
      </div>
    }>
      <MessagesPageContent />
    </Suspense>
  )
}

function MessagesPageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null)
  const [loading, setLoading] = useState(true)

  // Handle ?conv= query param (deep link from notification or producer profile)
  useEffect(() => {
    const convId = searchParams.get('conv')
    const recipientId = searchParams.get('to')

    if (convId && !activeConversation) {
      // Load specific conversation
      fetch(`/api/conversations`)
        .then(r => r.json())
        .then(data => {
          const found = data.conversations?.find((c: any) => c.id === convId)
          if (found) setActiveConversation(found)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    } else if (recipientId && !activeConversation) {
      // Start new conversation with a user
      fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.conversationId) {
            setActiveConversation({
              id: data.conversationId,
              otherUser: data.otherUser,
              lastMessage: null,
              lastMessageAt: null,
              unreadCount: 0,
            })
          }
          setLoading(false)
        })
        .catch(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [searchParams])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading' || (loading && searchParams.get('conv'))) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-red-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <Header />

      <div className="flex-1 flex max-w-7xl mx-auto w-full" style={{ height: 'calc(100vh - 64px)' }}>
        {/* Sidebar — Conversation List */}
        <div
          className={`w-full md:w-[340px] border-r border-[#1e1e2e] bg-[#111111] flex-shrink-0 ${
            activeConversation ? 'hidden md:flex md:flex-col' : 'flex flex-col'
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#1e1e2e]">
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              <MessageCircle size={20} className="text-red-500" />
              Messages
            </h1>
          </div>

          <ConversationList
            activeConversationId={activeConversation?.id || null}
            onSelectConversation={(conv) => setActiveConversation(conv)}
          />
        </div>

        {/* Main — Chat Window */}
        <div
          className={`flex-1 flex flex-col bg-[#0d0d0d] ${
            activeConversation ? 'flex' : 'hidden md:flex'
          }`}
        >
          {activeConversation ? (
            <ChatWindow
              conversationId={activeConversation.id}
              otherUser={activeConversation.otherUser}
              onBack={() => setActiveConversation(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center mb-5">
                <MessageCircle size={36} className="text-red-500" />
              </div>
              <h2 className="text-xl font-black text-white mb-2">Tes messages</h2>
              <p className="text-sm text-gray-500 max-w-sm">
                Selectionne une conversation ou contacte un producteur depuis son profil pour demarrer une discussion.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
