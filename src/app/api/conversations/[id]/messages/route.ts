export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — Messages d'une conversation
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const userId = session.user.id
    const conversationId = params.id

    // Verifier que l'utilisateur fait partie de la conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { user1Id: true, user2Id: true },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation non trouvee' }, { status: 404 })
    }

    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      return NextResponse.json({ error: 'Acces interdit' }, { status: 403 })
    }

    // Pagination par cursor
    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        content: true,
        read: true,
        senderId: true,
        createdAt: true,
        sender: {
          select: { id: true, name: true, displayName: true, avatar: true },
        },
      },
    })

    const hasMore = messages.length > limit
    if (hasMore) messages.pop()

    // Marquer les messages recus comme lus
    await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        read: false,
      },
      data: { read: true },
    })

    return NextResponse.json({
      messages: messages.reverse(),
      hasMore,
      nextCursor: hasMore ? messages[0]?.id : null,
    })
  } catch (error: any) {
    console.error('Erreur messages:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — Envoyer un message
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const userId = session.user.id
    const conversationId = params.id
    const { content } = await req.json()

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message vide' }, { status: 400 })
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: 'Message trop long (max 2000 caracteres)' }, { status: 400 })
    }

    // Verifier que l'utilisateur fait partie de la conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { user1Id: true, user2Id: true },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation non trouvee' }, { status: 404 })
    }

    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      return NextResponse.json({ error: 'Acces interdit' }, { status: 403 })
    }

    // Creer le message
    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        senderId: userId,
        conversationId,
      },
      select: {
        id: true,
        content: true,
        read: true,
        senderId: true,
        createdAt: true,
        sender: {
          select: { id: true, name: true, displayName: true, avatar: true },
        },
      },
    })

    // Mettre a jour la conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: content.trim().substring(0, 100),
        lastMessageAt: new Date(),
      },
    })

    // Creer une notification pour le destinataire
    const recipientId = conversation.user1Id === userId
      ? conversation.user2Id
      : conversation.user1Id

    const senderName = session.user.name || 'Quelqu\'un'

    await prisma.notification.create({
      data: {
        type: 'SYSTEM',
        title: `Nouveau message de ${senderName}`,
        message: content.trim().substring(0, 100),
        link: `/messages?conv=${conversationId}`,
        userId: recipientId,
      },
    })

    return NextResponse.json({ message })
  } catch (error: any) {
    console.error('Erreur envoi message:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
