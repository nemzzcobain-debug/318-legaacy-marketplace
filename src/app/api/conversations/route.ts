import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — Liste des conversations de l'utilisateur connecte
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const userId = session.user.id

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId },
        ],
      },
      include: {
        user1: {
          select: { id: true, name: true, displayName: true, avatar: true, role: true },
        },
        user2: {
          select: { id: true, name: true, displayName: true, avatar: true, role: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            senderId: true,
            read: true,
            createdAt: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    })

    // Compter les messages non lus par conversation
    const withUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            read: false,
          },
        })

        // Determiner l'autre participant
        const otherUser = conv.user1Id === userId ? conv.user2 : conv.user1

        return {
          id: conv.id,
          otherUser,
          lastMessage: conv.messages[0] || null,
          lastMessageAt: conv.lastMessageAt,
          unreadCount,
          createdAt: conv.createdAt,
        }
      })
    )

    // Total non lus
    const totalUnread = withUnread.reduce((sum, c) => sum + c.unreadCount, 0)

    return NextResponse.json({ conversations: withUnread, totalUnread })
  } catch (error: any) {
    console.error('Erreur liste conversations:', error)
    return NextResponse.json({ error: error.message || 'Erreur' }, { status: 500 })
  }
}

// POST — Creer ou recuperer une conversation avec un utilisateur
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const { recipientId } = await req.json()
    const userId = session.user.id

    if (!recipientId) {
      return NextResponse.json({ error: 'recipientId requis' }, { status: 400 })
    }

    if (recipientId === userId) {
      return NextResponse.json({ error: 'Impossible de discuter avec soi-meme' }, { status: 400 })
    }

    // Verifier que le destinataire existe
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, name: true, displayName: true, avatar: true, role: true },
    })

    if (!recipient) {
      return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 })
    }

    // Chercher conversation existante (dans les deux sens)
    const [id1, id2] = [userId, recipientId].sort()

    let conversation = await prisma.conversation.findUnique({
      where: {
        user1Id_user2Id: { user1Id: id1, user2Id: id2 },
      },
    })

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          user1Id: id1,
          user2Id: id2,
        },
      })
    }

    return NextResponse.json({ conversationId: conversation.id, otherUser: recipient })
  } catch (error: any) {
    console.error('Erreur creation conversation:', error)
    return NextResponse.json({ error: error.message || 'Erreur' }, { status: 500 })
  }
}
