import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, txMock, getServerSessionMock, sendNewMessageEmailMock, sendPushToUserMock } =
  vi.hoisted(() => {
    const tx = {
      message: {
        count: vi.fn(),
        create: vi.fn(),
      },
      conversation: {
        update: vi.fn(),
      },
      notification: {
        create: vi.fn(),
      },
    }

    return {
      txMock: tx,
      prismaMock: {
        conversation: {
          findUnique: vi.fn(),
        },
        $transaction: vi.fn(),
      },
      getServerSessionMock: vi.fn(),
      sendNewMessageEmailMock: vi.fn(),
      sendPushToUserMock: vi.fn(),
    }
  })

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('next-auth', () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/emails/resend', () => ({
  sendNewMessageEmail: sendNewMessageEmailMock,
}))

vi.mock('@/lib/web-push', () => ({
  sendPushToUser: sendPushToUserMock,
}))

import { POST } from '@/app/api/conversations/[id]/messages/route'

const conversation = {
  user1Id: 'sender-1',
  user2Id: 'recipient-1',
  user1: {
    id: 'sender-1',
    email: 'sender@example.com',
    name: 'Sender',
    displayName: 'Artiste',
  },
  user2: {
    id: 'recipient-1',
    email: 'recipient@example.com',
    name: 'Recipient',
    displayName: 'Beatmaker',
  },
}

const createdMessage = {
  id: 'message-1',
  content: 'Salut, je souhaite travailler avec toi.',
  read: false,
  senderId: 'sender-1',
  createdAt: new Date('2026-08-01T12:00:00.000Z'),
  sender: {
    id: 'sender-1',
    name: 'Sender',
    displayName: 'Artiste',
    avatar: null,
  },
}

describe('POST /api/conversations/[id]/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({
      user: { id: 'sender-1', name: 'Sender' },
    })
    prismaMock.conversation.findUnique.mockResolvedValue(conversation)
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock)
    )
    txMock.message.create.mockResolvedValue(createdMessage)
    txMock.conversation.update.mockResolvedValue({})
    txMock.notification.create.mockResolvedValue({})
    sendNewMessageEmailMock.mockResolvedValue({ success: true })
    sendPushToUserMock.mockResolvedValue({ sent: 1, failed: 0, removed: 0 })
  })

  it('notifie sur la marketplace, par push et par email au premier message non lu', async () => {
    txMock.message.count.mockResolvedValue(0)

    const response = await POST(
      new Request('http://localhost/api/conversations/conversation-1/messages', {
        method: 'POST',
        body: JSON.stringify({ content: 'Salut, je souhaite travailler avec toi.' }),
      }) as any,
      { params: Promise.resolve({ id: 'conversation-1' }) }
    )

    expect(response.status).toBe(200)
    expect(txMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'NEW_MESSAGE',
        userId: 'recipient-1',
        link: '/messages?conv=conversation-1',
        title: 'Nouveau message de Artiste',
      }),
    })
    expect(sendPushToUserMock).toHaveBeenCalledWith(
      'recipient-1',
      expect.objectContaining({
        url: '/messages?conv=conversation-1',
        tag: 'message-conversation-1',
      })
    )
    expect(sendNewMessageEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recipient@example.com',
        recipientName: 'Beatmaker',
        senderName: 'Artiste',
        conversationId: 'conversation-1',
      })
    )
  })

  it('évite les emails répétés tant que les messages précédents ne sont pas lus', async () => {
    txMock.message.count.mockResolvedValue(2)

    const response = await POST(
      new Request('http://localhost/api/conversations/conversation-1/messages', {
        method: 'POST',
        body: JSON.stringify({ content: 'Deuxième message' }),
      }) as any,
      { params: Promise.resolve({ id: 'conversation-1' }) }
    )

    expect(response.status).toBe(200)
    expect(sendPushToUserMock).toHaveBeenCalledTimes(1)
    expect(sendNewMessageEmailMock).not.toHaveBeenCalled()
  })
})
