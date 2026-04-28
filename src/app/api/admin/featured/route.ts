export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/featured — Liste des beats en vedette
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
    }

    const featuredBeats = await prisma.beat.findMany({
      where: { isFeatured: true },
      orderBy: { featuredOrder: 'asc' },
      select: {
        id: true,
        title: true,
        genre: true,
        bpm: true,
        key: true,
        coverImage: true,
        status: true,
        isFeatured: true,
        featuredOrder: true,
        featuredAt: true,
        producer: {
          select: { id: true, name: true, displayName: true, avatar: true },
        },
        auctions: {
          where: { status: { in: ['ACTIVE', 'ENDING_SOON'] } },
          select: { id: true, currentBid: true, status: true, endTime: true },
          take: 1,
        },
      },
    })

    return NextResponse.json({ featuredBeats })
  } catch (error) {
    console.error('[ADMIN] Erreur featured GET:', String(error))
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH /api/admin/featured — Ajouter/retirer un beat en vedette
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
    }

    const { beatId, action, order } = await req.json()

    if (!beatId || !action) {
      return NextResponse.json({ error: 'beatId et action requis' }, { status: 400 })
    }

    const beat = await prisma.beat.findUnique({ where: { id: beatId } })
    if (!beat) {
      return NextResponse.json({ error: 'Beat introuvable' }, { status: 404 })
    }

    if (action === 'add') {
      // Compter les beats en vedette actuels
      const count = await prisma.beat.count({ where: { isFeatured: true } })
      if (count >= 10) {
        return NextResponse.json(
          { error: 'Maximum 10 beats en vedette' },
          { status: 400 }
        )
      }

      await prisma.beat.update({
        where: { id: beatId },
        data: {
          isFeatured: true,
          featuredOrder: typeof order === 'number' ? order : count + 1,
          featuredAt: new Date(),
        },
      })

      return NextResponse.json({ message: `"${beat.title}" ajouté en vedette` })
    }

    if (action === 'remove') {
      await prisma.beat.update({
        where: { id: beatId },
        data: {
          isFeatured: false,
          featuredOrder: 0,
          featuredAt: null,
        },
      })

      // Recalculer l'ordre des beats restants
      const remaining = await prisma.beat.findMany({
        where: { isFeatured: true },
        orderBy: { featuredOrder: 'asc' },
        select: { id: true },
      })
      for (let i = 0; i < remaining.length; i++) {
        await prisma.beat.update({
          where: { id: remaining[i].id },
          data: { featuredOrder: i + 1 },
        })
      }

      return NextResponse.json({ message: `"${beat.title}" retiré de la vedette` })
    }

    if (action === 'reorder') {
      if (typeof order !== 'number' || order < 1) {
        return NextResponse.json({ error: 'Ordre invalide' }, { status: 400 })
      }
      await prisma.beat.update({
        where: { id: beatId },
        data: { featuredOrder: order },
      })
      return NextResponse.json({ message: `Ordre mis à jour` })
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  } catch (error) {
    console.error('[ADMIN] Erreur featured PATCH:', String(error))
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
