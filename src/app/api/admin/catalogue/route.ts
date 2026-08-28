export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomBytes } from 'node:crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteFile, parseSupabaseUrl } from '@/lib/supabase'
import { sendAuthenticityEvidenceRequestEmail } from '@/lib/emails/resend'

const ACTIONS = [
  'SET_PENDING',
  'START_REVIEW',
  'REQUEST_EVIDENCE',
  'MARK_EVIDENCE_RECEIVED',
  'MARK_CONFLICT',
  'QUARANTINE',
  'MARK_HUMAN',
  'MARK_AI_REJECTED',
  'ARCHIVE',
  'DELETE',
] as const

const EVIDENCE_VALIDITY_DAYS = 7

function createEvidenceCode() {
  const value = randomBytes(6).toString('hex').toUpperCase()
  return `318-${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}`
}

const ACTION_ALLOWED_STATUSES: Partial<Record<(typeof ACTIONS)[number], string[]>> = {
  START_REVIEW: [
    'NOT_ANALYZED',
    'LOW_RISK',
    'REVIEW_RECOMMENDED',
    'REVIEW_REQUIRED',
    'EVIDENCE_EXPIRED',
  ],
  REQUEST_EVIDENCE: [
    'REVIEW_RECOMMENDED',
    'REVIEW_REQUIRED',
    'REVIEW_IN_PROGRESS',
    'EVIDENCE_REQUESTED',
    'EVIDENCE_RECEIVED',
    'EVIDENCE_EXPIRED',
    'CONFLICT_REVIEW_REQUIRED',
  ],
  MARK_EVIDENCE_RECEIVED: ['EVIDENCE_REQUESTED', 'EVIDENCE_EXPIRED'],
  MARK_CONFLICT: [
    'NOT_ANALYZED',
    'LOW_RISK',
    'REVIEW_RECOMMENDED',
    'REVIEW_REQUIRED',
    'REVIEW_IN_PROGRESS',
    'EVIDENCE_REQUESTED',
    'EVIDENCE_RECEIVED',
    'EVIDENCE_EXPIRED',
    'QUARANTINED',
    'HUMAN_CONFIRMED',
  ],
  QUARANTINE: [
    'NOT_ANALYZED',
    'LOW_RISK',
    'REVIEW_RECOMMENDED',
    'REVIEW_REQUIRED',
    'REVIEW_IN_PROGRESS',
    'EVIDENCE_REQUESTED',
    'EVIDENCE_RECEIVED',
    'EVIDENCE_EXPIRED',
    'CONFLICT_REVIEW_REQUIRED',
    'HUMAN_CONFIRMED',
  ],
  MARK_HUMAN: [
    'REVIEW_IN_PROGRESS',
    'EVIDENCE_RECEIVED',
    'CONFLICT_REVIEW_REQUIRED',
    'QUARANTINED',
  ],
  MARK_AI_REJECTED: [
    'REVIEW_IN_PROGRESS',
    'EVIDENCE_RECEIVED',
    'EVIDENCE_EXPIRED',
    'CONFLICT_REVIEW_REQUIRED',
    'QUARANTINED',
  ],
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { beatId, action, note } = await req.json()
    if (!beatId || !ACTIONS.includes(action)) {
      return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
    }

    const beat = await prisma.beat.findUnique({
      where: { id: beatId },
      include: {
        producer: {
          select: { id: true, email: true, name: true, displayName: true },
        },
        auctions: {
          select: { id: true, status: true, totalBids: true, _count: { select: { bids: true } } },
        },
        _count: { select: { purchases: true } },
      },
    })

    if (!beat) return NextResponse.json({ error: 'Beat introuvable' }, { status: 404 })

    const allowedStatuses = ACTION_ALLOWED_STATUSES[action as (typeof ACTIONS)[number]]
    if (allowedStatuses && !allowedStatuses.includes(beat.aiReviewStatus)) {
      return NextResponse.json(
        {
          error: `Cette action n'est pas autorisée depuis le statut « ${beat.aiReviewStatus} ».`,
          code: 'INVALID_ADMIN_STATUS_TRANSITION',
        },
        { status: 409 }
      )
    }

    const bidsCount = beat.auctions.reduce(
      (sum, auction) => sum + Math.max(auction.totalBids, auction._count.bids),
      0
    )
    const hasFinancialHistory = beat._count.purchases > 0 || bidsCount > 0 || beat.status === 'SOLD'
    const cleanNote = typeof note === 'string' ? note.trim().slice(0, 1500) : ''
    const now = new Date()

    if (['SET_PENDING', 'MARK_AI_REJECTED', 'ARCHIVE', 'DELETE'].includes(action) && bidsCount > 0) {
      return NextResponse.json(
        {
          error:
            "Action bloquée : ce beat possède déjà des enchères. Il faut traiter les enchérisseurs avant de le retirer.",
        },
        { status: 409 }
      )
    }

    if (action === 'DELETE' && hasFinancialHistory) {
      return NextResponse.json(
        {
          error:
            "Suppression définitive impossible : ce beat possède un historique financier. Utilise l'archivage lorsque cela est autorisé.",
        },
        { status: 409 }
      )
    }

    if (action === 'START_REVIEW') {
      await prisma.$transaction([
        prisma.beat.update({
          where: { id: beat.id },
          data: {
            aiReviewStatus: 'REVIEW_IN_PROGRESS',
            aiAdminNote: cleanNote || 'Contrôle administratif en cours.',
            aiAnalyzedAt: now,
          },
        }),
        prisma.adminActionLog.create({
          data: {
            adminId: session.user.id,
            action,
            targetType: 'BEAT',
            targetId: beat.id,
            details: JSON.stringify({ note: cleanNote || null }),
          },
        }),
      ])
      return NextResponse.json({ success: true, message: 'Contrôle administratif commencé.' })
    }

    if (action === 'REQUEST_EVIDENCE') {
      const requestMessage =
        cleanNote ||
        'Merci de fournir le projet DAW, des captures datées ou des exports intermédiaires permettant de confirmer la création du beat.'
      const evidenceCode = createEvidenceCode()
      const evidenceExpiresAt = new Date(
        now.getTime() + EVIDENCE_VALIDITY_DAYS * 24 * 60 * 60 * 1000
      )

      await prisma.$transaction([
        prisma.beat.update({
          where: { id: beat.id },
          data: {
            aiReviewStatus: 'EVIDENCE_REQUESTED',
            aiEvidenceRequestedAt: now,
            aiEvidenceCode: evidenceCode,
            aiEvidenceExpiresAt: evidenceExpiresAt,
            aiAdminNote: requestMessage,
          },
        }),
        prisma.notification.create({
          data: {
            userId: beat.producer.id,
            type: 'SYSTEM',
            title: "Preuves de création demandées",
            message: `318 LEGAACY demande des éléments de création pour « ${beat.title} ». Code unique à afficher dans ton projet : ${evidenceCode}. À envoyer sous 7 jours. ${requestMessage}`,
            link: '/messages',
          },
        }),
        prisma.adminActionLog.create({
          data: {
            adminId: session.user.id,
            action,
            targetType: 'BEAT',
            targetId: beat.id,
            details: JSON.stringify({
              note: requestMessage,
              producerId: beat.producer.id,
              evidenceCode,
              evidenceExpiresAt: evidenceExpiresAt.toISOString(),
            }),
          },
        }),
      ])

      if (beat.producer.email) {
        await sendAuthenticityEvidenceRequestEmail({
          to: beat.producer.email,
          producerName: beat.producer.displayName || beat.producer.name || 'Producteur',
          beatTitle: beat.title,
          message: requestMessage,
          evidenceCode,
          evidenceExpiresAt,
        })
      }

      return NextResponse.json({
        success: true,
        message: `Demande envoyée avec le code ${evidenceCode}.`,
        evidenceCode,
        evidenceExpiresAt,
      })
    }

    if (action === 'MARK_EVIDENCE_RECEIVED') {
      if (!['EVIDENCE_REQUESTED', 'EVIDENCE_EXPIRED'].includes(beat.aiReviewStatus)) {
        return NextResponse.json(
          { error: "Aucune demande de preuve active n'est associée à ce beat." },
          { status: 409 }
        )
      }
      if (!cleanNote) {
        return NextResponse.json(
          { error: 'Indique les preuves reçues et leur emplacement de conservation.' },
          { status: 400 }
        )
      }

      await prisma.$transaction([
        prisma.beat.update({
          where: { id: beat.id },
          data: {
            aiReviewStatus: 'EVIDENCE_RECEIVED',
            aiAdminNote: cleanNote,
            aiAnalyzedAt: now,
          },
        }),
        prisma.notification.create({
          data: {
            userId: beat.producer.id,
            type: 'SYSTEM',
            title: 'Preuves de création reçues',
            message: `Les preuves concernant « ${beat.title} » ont bien été reçues et sont en cours d’examen.`,
            link: '/dashboard?tab=beats',
          },
        }),
        prisma.adminActionLog.create({
          data: {
            adminId: session.user.id,
            action,
            targetType: 'BEAT',
            targetId: beat.id,
            details: JSON.stringify({ note: cleanNote, evidenceCode: beat.aiEvidenceCode }),
          },
        }),
      ])
      return NextResponse.json({ success: true, message: 'Preuves marquées comme reçues.' })
    }

    if (action === 'MARK_CONFLICT') {
      if (!cleanNote) {
        return NextResponse.json({ error: 'Le motif du conflit est obligatoire.' }, { status: 400 })
      }

      await prisma.$transaction([
        prisma.auction.updateMany({
          where: {
            beatId: beat.id,
            status: { in: ['ACTIVE', 'ENDING_SOON', 'SCHEDULED'] },
          },
          data: { status: 'PENDING_APPROVAL' },
        }),
        prisma.beat.update({
          where: { id: beat.id },
          data: {
            status: 'PENDING',
            isFeatured: false,
            aiReviewStatus: 'CONFLICT_REVIEW_REQUIRED',
            aiAdminNote: cleanNote,
          },
        }),
        prisma.notification.create({
          data: {
            userId: beat.producer.id,
            type: 'SYSTEM',
            title: 'Contrôle complémentaire requis',
            message: `« ${beat.title} » est temporairement masqué pendant l’examen d’informations contradictoires.`,
            link: '/dashboard?tab=beats',
          },
        }),
        prisma.adminActionLog.create({
          data: {
            adminId: session.user.id,
            action,
            targetType: 'BEAT',
            targetId: beat.id,
            details: JSON.stringify({ note: cleanNote, bidsPreserved: bidsCount }),
          },
        }),
      ])
      return NextResponse.json({ success: true, message: 'Conflit signalé, beat masqué.' })
    }

    if (action === 'QUARANTINE') {
      if (beat.status === 'SOLD' || beat._count.purchases > 0) {
        return NextResponse.json(
          { error: 'Un beat déjà vendu ne peut pas être placé en quarantaine.' },
          { status: 409 }
        )
      }
      if (!cleanNote) {
        return NextResponse.json(
          { error: 'Le motif de la mise en quarantaine est obligatoire.' },
          { status: 400 }
        )
      }

      await prisma.$transaction([
        prisma.auction.updateMany({
          where: {
            beatId: beat.id,
            status: { in: ['ACTIVE', 'ENDING_SOON', 'SCHEDULED'] },
          },
          data: { status: 'PENDING_APPROVAL' },
        }),
        prisma.beat.update({
          where: { id: beat.id },
          data: {
            status: 'PENDING',
            isFeatured: false,
            aiReviewStatus: 'QUARANTINED',
            aiAdminNote: cleanNote,
          },
        }),
        prisma.notification.create({
          data: {
            userId: beat.producer.id,
            type: 'SYSTEM',
            title: 'Beat placé en quarantaine',
            message: `« ${beat.title} » est temporairement masqué. Motif : ${cleanNote}`,
            link: '/dashboard?tab=beats',
          },
        }),
        prisma.adminActionLog.create({
          data: {
            adminId: session.user.id,
            action,
            targetType: 'BEAT',
            targetId: beat.id,
            details: JSON.stringify({ note: cleanNote, bidsPreserved: bidsCount }),
          },
        }),
      ])
      return NextResponse.json({
        success: true,
        message: 'Beat placé en quarantaine. Les enchères existantes sont conservées.',
      })
    }

    if (action === 'MARK_HUMAN') {
      await prisma.$transaction([
        prisma.beat.update({
          where: { id: beat.id },
          data: {
            aiReviewStatus: 'HUMAN_CONFIRMED',
            aiAdminNote: cleanNote || 'Création humaine confirmée par contrôle administrateur.',
            aiAnalyzedAt: now,
          },
        }),
        prisma.adminActionLog.create({
          data: {
            adminId: session.user.id,
            action,
            targetType: 'BEAT',
            targetId: beat.id,
            details: JSON.stringify({ note: cleanNote || null }),
          },
        }),
      ])
      return NextResponse.json({ success: true, message: 'Création humaine confirmée.' })
    }

    if (action === 'SET_PENDING') {
      await prisma.$transaction([
        prisma.auction.updateMany({
          where: { beatId: beat.id },
          data: { status: 'PENDING_APPROVAL' },
        }),
        prisma.beat.update({
          where: { id: beat.id },
          data: {
            status: 'PENDING',
            isFeatured: false,
            aiReviewStatus: 'REVIEW_REQUIRED',
            aiAdminNote: cleanNote || "Remis en attente par l'administration.",
          },
        }),
        prisma.notification.create({
          data: {
            userId: beat.producer.id,
            type: 'SYSTEM',
            title: 'Beat remis en vérification',
            message: `« ${beat.title} » est temporairement masqué pendant une vérification 318 LEGAACY.`,
            link: '/dashboard?tab=beats',
          },
        }),
        prisma.adminActionLog.create({
          data: {
            adminId: session.user.id,
            action,
            targetType: 'BEAT',
            targetId: beat.id,
            details: JSON.stringify({ note: cleanNote || null }),
          },
        }),
      ])
      return NextResponse.json({ success: true, message: 'Beat masqué et remis en attente.' })
    }

    if (action === 'MARK_AI_REJECTED') {
      const rejectionReason =
        cleanNote || 'Instrumentale refusée après contrôle de son authenticité.'
      await prisma.$transaction([
        prisma.auction.updateMany({ where: { beatId: beat.id }, data: { status: 'CANCELLED' } }),
        prisma.beat.update({
          where: { id: beat.id },
          data: {
            status: 'REJECTED',
            isFeatured: false,
            aiReviewStatus: 'AI_REJECTED',
            aiAdminNote: rejectionReason,
            rejectionType: 'FINAL',
            rejectionReason,
            rejectedAt: now,
          },
        }),
        prisma.notification.create({
          data: {
            userId: beat.producer.id,
            type: 'SYSTEM',
            title: 'Beat refusé après vérification',
            message: `« ${beat.title} » a été retiré. Motif : ${rejectionReason}`,
            link: '/dashboard?tab=beats',
          },
        }),
        prisma.adminActionLog.create({
          data: {
            adminId: session.user.id,
            action,
            targetType: 'BEAT',
            targetId: beat.id,
            details: JSON.stringify({ note: rejectionReason }),
          },
        }),
      ])
      return NextResponse.json({ success: true, message: 'Beat refusé et retiré du catalogue.' })
    }

    if (action === 'ARCHIVE') {
      if (beat.status === 'SOLD' || beat._count.purchases > 0) {
        return NextResponse.json(
          { error: "Ce beat vendu doit rester archivé dans l'historique des transactions." },
          { status: 409 }
        )
      }
      await prisma.$transaction([
        prisma.auction.updateMany({ where: { beatId: beat.id }, data: { status: 'CANCELLED' } }),
        prisma.beat.update({
          where: { id: beat.id },
          data: { status: 'ARCHIVED', isFeatured: false, aiAdminNote: cleanNote || null },
        }),
        prisma.adminActionLog.create({
          data: {
            adminId: session.user.id,
            action,
            targetType: 'BEAT',
            targetId: beat.id,
            details: JSON.stringify({ note: cleanNote || null }),
          },
        }),
      ])
      return NextResponse.json({ success: true, message: 'Beat archivé et retiré du catalogue.' })
    }

    const storageUrls = new Set(
      [beat.audioUrl, beat.audioOriginal, beat.audioWav, beat.stemsUrl, beat.coverImage].filter(
        (value): value is string => Boolean(value)
      )
    )
    if (beat.stemsFiles) {
      try {
        const stems = JSON.parse(beat.stemsFiles) as Array<{ url?: string }>
        stems.forEach((stem) => stem.url && storageUrls.add(stem.url))
      } catch {
        // Un ancien JSON invalide ne doit pas empêcher le retrait demandé par l'admin.
      }
    }

    await prisma.$transaction([
      prisma.like.deleteMany({ where: { beatId: beat.id } }),
      prisma.playlistBeat.deleteMany({ where: { beatId: beat.id } }),
      prisma.review.deleteMany({ where: { auction: { beatId: beat.id } } }),
      prisma.bid.deleteMany({ where: { auction: { beatId: beat.id } } }),
      prisma.watchlist.deleteMany({ where: { auction: { beatId: beat.id } } }),
      prisma.auction.deleteMany({ where: { beatId: beat.id } }),
      prisma.adminActionLog.create({
        data: {
          adminId: session.user.id,
          action,
          targetType: 'BEAT',
          targetId: beat.id,
          details: JSON.stringify({ title: beat.title, producerId: beat.producer.id }),
        },
      }),
      prisma.beat.delete({ where: { id: beat.id } }),
    ])

    await Promise.allSettled(
      [...storageUrls].map(async (url) => {
        const parsed = parseSupabaseUrl(url)
        if (parsed) await deleteFile(parsed.bucket, parsed.path)
      })
    )

    return NextResponse.json({ success: true, message: 'Beat supprimé définitivement.' })
  } catch (error) {
    console.error('Admin catalogue action error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
