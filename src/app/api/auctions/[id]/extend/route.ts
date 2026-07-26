export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enforceProducerStripeAccess } from '@/lib/producer-stripe-access'

const ALLOWED_EXTENSION_HOURS = [1, 3, 6, 12, 24, 48]

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const role = (session.user as any).role
    const body = await req.json()
    const hours = Number(body.hours)

    if (!ALLOWED_EXTENSION_HOURS.includes(hours)) {
      return NextResponse.json(
        { error: 'Durée de prolongation invalide' },
        { status: 400 }
      )
    }

    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        endTime: true,
        status: true,
        beat: { select: { producerId: true } },
      },
    })

    if (!auction) {
      return NextResponse.json({ error: 'Enchère introuvable' }, { status: 404 })
    }

    if (auction.beat.producerId !== userId && role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Seul le propriétaire du beat peut prolonger cette enchère' },
        { status: 403 }
      )
    }

    if (role !== 'ADMIN') {
      const producer = await prisma.user.findUnique({ where: { id: userId } })
      if (!producer) {
        return NextResponse.json({ error: 'Beatmaker introuvable' }, { status: 404 })
      }
      const producerAccess = await enforceProducerStripeAccess(producer)
      if (!producerAccess.allowed) {
        return NextResponse.json(
          {
            error: producerAccess.message,
            code: producerAccess.status,
            actionUrl: '/dashboard?tab=settings',
          },
          { status: 403 }
        )
      }
    }

    const now = new Date()
    if (
      !['ACTIVE', 'ENDING_SOON'].includes(auction.status) ||
      auction.endTime <= now
    ) {
      return NextResponse.json(
        { error: 'Cette enchère est déjà terminée ou ne peut plus être prolongée' },
        { status: 409 }
      )
    }

    const newEndTime = new Date(auction.endTime.getTime() + hours * 60 * 60 * 1000)
    // La condition est répétée dans l'UPDATE pour éviter qu'une enchère
    // arrivée à expiration entre la lecture et l'écriture soit prolongée.
    const updateResult = await prisma.auction.updateMany({
      where: {
        id: auction.id,
        status: { in: ['ACTIVE', 'ENDING_SOON'] },
        endTime: { gt: now },
      },
      data: {
        endTime: newEndTime,
        status: 'ACTIVE',
      },
    })

    if (updateResult.count === 0) {
      return NextResponse.json(
        { error: 'Cette enchère vient de se terminer et ne peut plus être prolongée' },
        { status: 409 }
      )
    }

    const updatedAuction = await prisma.auction.findUnique({
      where: { id: auction.id },
      select: { id: true, endTime: true, status: true },
    })

    return NextResponse.json({
      success: true,
      auction: updatedAuction,
      message: `Enchère prolongée de ${hours} heure${hours > 1 ? 's' : ''}`,
    })
  } catch (error) {
    console.error('Erreur prolongation enchère:', error)
    return NextResponse.json(
      { error: 'Impossible de prolonger cette enchère' },
      { status: 500 }
    )
  }
}
