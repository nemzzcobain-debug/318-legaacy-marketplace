export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createConnectAccount, createOnboardingLink, isConnectAccountReady, createDashboardLink } from '@/lib/stripe'

// POST — Creer un compte Stripe Connect et générer le lien d'onboarding
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user || (user.role !== 'PRODUCER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Accès réservé aux producteurs' }, { status: 403 })
    }

    // Si le producteur a déjà un compte Stripe, on essaye de réutiliser
    if (user.stripeAccountId) {
      try {
        const isReady = await isConnectAccountReady(user.stripeAccountId)
        if (isReady) {
          return NextResponse.json({
            status: 'active',
            message: 'Votre compte Stripe est déjà actif',
          })
        }
        // Sinon regénérer un lien d'onboarding
        const accountLink = await createOnboardingLink(user.stripeAccountId)
        return NextResponse.json({
          status: 'pending',
          onboardingUrl: accountLink.url,
        })
      } catch (err: any) {
        // Le compte Stripe sauvegardé n'existe plus / a été supprimé / appartient
        // a un autre environnement (test vs live). On nettoie et on recrée.
        const msg = err?.message || ''
        const code = err?.code || err?.raw?.code || ''
        const isNotFound =
          code === 'resource_missing' ||
          msg.includes('No such account') ||
          msg.includes('does not have access')
        if (isNotFound) {
          console.warn(
            'Compte Stripe sauvegardé invalide (' + msg + '), recréation pour user',
            user.id
          )
          await prisma.user.update({
            where: { id: user.id },
            data: { stripeAccountId: null },
          })
          // Continue vers la création d'un nouveau compte ci-dessous
        } else {
          // Erreur Stripe differente : propager
          throw err
        }
      }
    }

    // Creer un nouveau compte Connect
    const account = await createConnectAccount(user.email, user.name)

    // Sauvegarder l'ID du compte Stripe
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeAccountId: account.id },
    })

    // Générer le lien d'onboarding
    const accountLink = await createOnboardingLink(account.id)

    return NextResponse.json({
      status: 'created',
      onboardingUrl: accountLink.url,
      accountId: account.id,
    })
  } catch (error: any) {
    console.error('Erreur Stripe Connect:', error)
    // Renvoyer plus de details pour aider au debug (sans fuiter de secrets)
    const stripeMsg = error?.raw?.message || error?.message || 'inconnue'
    const stripeCode = error?.raw?.code || error?.code || null
    const stripeType = error?.raw?.type || error?.type || null
    return NextResponse.json(
      {
        error: 'Erreur Stripe Connect',
        details: stripeMsg,
        code: stripeCode,
        type: stripeType,
      },
      { status: 500 }
    )
  }
}

// GET — Vérifier le status du compte Stripe Connect
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 })
    }

    if (!user.stripeAccountId) {
      return NextResponse.json({
        status: 'not_connected',
        message: 'Aucun compte Stripe connecté',
      })
    }

    const isReady = await isConnectAccountReady(user.stripeAccountId)

    if (isReady) {
      // Générer un lien vers le dashboard Stripe Express
      try {
        const dashboardLink = await createDashboardLink(user.stripeAccountId)
        return NextResponse.json({
          status: 'active',
          dashboardUrl: dashboardLink.url,
        })
      } catch {
        return NextResponse.json({
          status: 'active',
          dashboardUrl: null,
        })
      }
    }

    return NextResponse.json({
      status: 'pending',
      message: 'Onboarding Stripe en cours. Completez votre inscription.',
    })
  } catch (error: any) {
    console.error('Erreur vérification Stripe:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
