export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendProducerApprovedEmail, sendProducerRejectedEmail } from '@/lib/emails/resend'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: any = { role: 'PRODUCER' }
    if (status) where.producerStatus = status
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { displayName: { contains: search } },
      ]
    }

    const producers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        displayName: true,
        email: true,
        producerStatus: true,
        producerBio: true,
        portfolio: true,
        totalSales: true,
        rating: true,
        createdAt: true,
        _count: { select: { beats: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(producers)
  } catch (error) {
    console.error('Admin producers error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { producerId, status } = await req.json()
    if (!producerId || !['APPROVED', 'REJECTED', 'SUSPENDED', 'PENDING'].includes(status)) {
      return NextResponse.json({ error: 'Donnees invalides' }, { status: 400 })
    }

    const producer = await prisma.user.update({
      where: { id: producerId },
      data: { producerStatus: status },
      select: { id: true, name: true, email: true, role: true, producerStatus: true },
    })

    const notifMessages: Record<string, { title: string; message: string; type: string; link?: string }> = {
      APPROVED: {
        title: 'Compte approuvé!',
        message:
          'Votre compte producteur a été approuvé. Vous pouvez maintenant mettre vos beats aux enchères!',
        type: 'PRODUCER_APPROVED',
        link: `/producer/${producerId}`,
      },
      REJECTED: {
        title: 'Compte refusé',
        message:
          "Votre demande de compte producteur a été refusée. Contactez-nous pour plus d'informations.",
        type: 'PRODUCER_REJECTED',
      },
      SUSPENDED: {
        title: 'Compte suspendu',
        message: "Votre compte producteur a été suspendu. Contactez-nous pour plus d'informations.",
        type: 'SYSTEM',
      },
    }

    // Notification au producteur
    if (notifMessages[status]) {
      await prisma.notification.create({
        data: {
          userId: producerId,
          ...notifMessages[status],
        },
      })
    }

    // Notification de confirmation a l'admin
    const adminStatusLabels: Record<string, string> = {
      APPROVED: 'approuvé',
      REJECTED: 'refusé',
      SUSPENDED: 'suspendu',
      PENDING: 'remis en attente',
    }
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        type: 'SYSTEM',
        title: `Producteur ${adminStatusLabels[status] || status}`,
        message: `Vous avez ${adminStatusLabels[status]} le producteur ${producer.name || producer.email}`,
        link: `/producer/${producerId}`,
      },
    })

    // Envoyer email de notification au producteur
    if (producer.email) {
      if (status === 'APPROVED') {
        sendProducerApprovedEmail({
          to: producer.email,
          name: producer.name || 'Producteur',
        }).catch((err) => console.error('Email approbation échoué:', err))
      } else if (status === 'REJECTED') {
        sendProducerRejectedEmail({
          to: producer.email,
          name: producer.name || 'Producteur',
        }).catch((err) => console.error('Email refus échoué:', err))
      }
    }

    return NextResponse.json(producer)
  } catch (error) {
    console.error('Admin producer update error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
