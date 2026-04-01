import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createConnectAccount, createOnboardingLink, isConnectAccountReady, createDashboardLink } from '@/lib/stripe'

// POST — Creer un compte Stripe Connect et generer le lien d'onboarding
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user || (user.role !== 'PRODUCER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Acces reserve aux producteurs' }, { status: 403 })
    }

    // Si le producteur a deja un compte Stripe, on cree juste un nouveau lien
    if (user.stripeAccountId) {
      // Verifier si le compte est deja actif
      const isReady = await isConnectAccountReady(user.stripeAccountId)
      if (isReady) {
        return NextResponse.json({
          status: 'active',
          message: 'Votre compte Stripe est deja actif',
        })
      }

      // Sinon regenerer un lien d'onboarding
      const accountLink = await createOnboardingLink(user.stripeAccountId)
      return NextResponse.json({
        status: 'pending',
        onboardingUrl: accountLink.url,
      })
    }

    // Creer un nouveau compte Connect
    const account = await createConnectAccount(user.email, user.name)

    // Sauvegarder l'ID du compte Stripe
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeAccountId: account.id },
    })

    // Generer le lien d'onboarding
    const accountLink = await createOnboardingLink(account.id)

    return NextResponse.json({
      status: 'created',
      onboardingUrl: accountLink.url,
      accountId: account.id,
    })
  } catch (error: any) {
    console.error('Erreur Stripe Connect:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// GET — Verifier le status du compte Stripe Connect
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
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
        message: 'Aucun compte Stripe connecte',
      })
    }

    const isReady = await isConnectAccountReady(user.stripeAccountId)

    if (isReady) {
      // Generer un lien vers le dashboard Stripe Express
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
    console.error('Erreur verification Stripe:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
