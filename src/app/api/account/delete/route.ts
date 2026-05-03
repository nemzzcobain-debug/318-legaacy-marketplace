export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createHash } from 'crypto'

/**
 * POST /api/account/delete — Soft delete + anonymisation du compte
 * Le compte est désactivé et les données personnelles anonymisées.
 * Les enchères et transactions restent pour l'historique.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await req.json()

    // Confirmation requise — le user doit envoyer { confirm: "SUPPRIMER" }
    if (body.confirm !== 'SUPPRIMER') {
      return NextResponse.json(
        { error: 'Confirmation requise. Envoyez { confirm: "SUPPRIMER" }' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, deletedAt: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    if (user.deletedAt) {
      return NextResponse.json({ error: 'Ce compte est déjà supprimé' }, { status: 400 })
    }

    // Un admin ne peut pas supprimer son propre compte
    if (user.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Un administrateur ne peut pas supprimer son propre compte' },
        { status: 403 }
      )
    }

    // Anonymiser le compte
    const anonymizedEmail = `deleted_${createHash('sha256').update(user.email).digest('hex').slice(0, 12)}@deleted.local`
    const anonymizedName = 'Utilisateur supprimé'

    await prisma.$transaction(async (tx) => {
      // 1. Anonymiser les données utilisateur
      await tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          name: anonymizedName,
          displayName: null,
          email: anonymizedEmail,
          passwordHash: null,
          avatar: null,
          image: null,
          bio: null,
          website: null,
          instagram: null,
          twitter: null,
          youtube: null,
          soundcloud: null,
          spotify: null,
          producerBio: null,
          portfolio: null,
          notifEmail: false,
          notifBid: false,
          notifMessage: false,
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      })

      // 2. Supprimer les sessions actives (déconnexion forcée)
      await tx.session.deleteMany({ where: { userId } })

      // 3. Supprimer les comptes OAuth liés
      await tx.account.deleteMany({ where: { userId } })

      // 4. Supprimer les notifications
      await tx.notification.deleteMany({ where: { userId } })

      // 5. Supprimer les follows
      await tx.follow.deleteMany({
        where: { OR: [{ followerId: userId }, { followingId: userId }] },
      })

      // 6. Supprimer les likes
      await tx.like.deleteMany({ where: { userId } })

      // 7. Supprimer la watchlist
      await tx.watchlist.deleteMany({ where: { userId } })

      // 8. Supprimer les playlists
      await tx.playlist.deleteMany({
        where: { userId },
      })

      // Note: Les beats, bids, reviews, messages et transactions restent
      // pour préserver l'historique des enchères et l'intégrité des données.
    })

    return NextResponse.json({
      message: 'Votre compte a été supprimé et vos données anonymisées.',
    })
  } catch (error) {
    console.error('Erreur suppression compte:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
