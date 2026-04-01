export const dynamic = 'force-dynamic'

// ─── 318 LEGAACY Marketplace - Reporting/Signalement API ───
// POST: créer un signalement
// GET: lister les signalements (admin only)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_TYPES = ['BEAT', 'AUCTION', 'USER', 'MESSAGE']
const VALID_REASONS = ['SPAM', 'INAPPROPRIATE', 'FRAUD', 'COPYRIGHT', 'OTHER']

// ─── POST: Créer un signalement ───
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await req.json()
    const { type, reason, description, targetUserId, targetAuctionId, targetBeatId } = body

    // Validations
    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
    }
    if (!reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: 'Raison invalide' }, { status: 400 })
    }

    // Au moins une cible
    if (!targetUserId && !targetAuctionId && !targetBeatId) {
      return NextResponse.json({ error: 'Cible du signalement requise' }, { status: 400 })
    }

    // Pas de self-report
    if (targetUserId === session.user.id) {
      return NextResponse.json({ error: 'Impossible de se signaler soi-même' }, { status: 400 })
    }

    // Vérifier doublon (même reporter + même cible)
    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId: session.user.id,
        ...(targetUserId && { targetUserId }),
        ...(targetAuctionId && { targetAuctionId }),
        ...(targetBeatId && { targetBeatId }),
        status: { in: ['PENDING', 'REVIEWED'] },
      },
    })

    if (existingReport) {
      return NextResponse.json(
        { error: 'Vous avez déjà signalé cet élément' },
        { status: 409 }
      )
    }

    const report = await prisma.report.create({
      data: {
        type,
        reason,
        description: description || null,
        reporterId: session.user.id,
        targetUserId: targetUserId || null,
        targetAuctionId: targetAuctionId || null,
        targetBeatId: targetBeatId || null,
      },
    })

    return NextResponse.json({ message: 'Signalement envoyé', report }, { status: 201 })
  } catch (error) {
    console.error('Report error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ─── GET: Lister les signalements (admin) ───
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Vérifier admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') // PENDING, REVIEWED, RESOLVED, DISMISSED
    const type = searchParams.get('type') // BEAT, AUCTION, USER, MESSAGE
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20')))

    const where: any = {}
    if (status) where.status = status
    if (type) where.type = type

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          reporter: {
            select: { id: true, name: true, displayName: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.report.count({ where }),
    ])

    return NextResponse.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Report GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ─── PATCH: Mettre à jour un signalement (admin) ───
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await req.json()
    const { reportId, status, adminNote } = body

    if (!reportId) {
      return NextResponse.json({ error: 'reportId requis' }, { status: 400 })
    }

    const validStatuses = ['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    const report = await prisma.report.update({
      where: { id: reportId },
      data: {
        ...(status && { status }),
        ...(adminNote !== undefined && { adminNote }),
        reviewedAt: new Date(),
      },
    })

    return NextResponse.json({ message: 'Signalement mis à jour', report })
  } catch (error) {
    console.error('Report PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
