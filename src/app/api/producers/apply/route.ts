export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { producerApplicationSchema } from '@/lib/validations'
import { sendProducerApplicationEmail, sendAdminNewApplicationEmail } from '@/lib/emails/resend'

// POST /api/producers/apply - Postuler comme producteur
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    if (user.role === 'ADMIN') {
      return NextResponse.json({ error: 'Les admins ont deja les droits producteur' }, { status: 400 })
    }

    if (user.role === 'PRODUCER' && user.producerStatus === 'APPROVED') {
      return NextResponse.json({ error: 'Tu es deja producteur approuve' }, { status: 400 })
    }

    if (user.producerStatus === 'PENDING') {
      return NextResponse.json(
        { error: "Ta candidature est deja en cours d'examen" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validated = producerApplicationSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.errors[0].message }, { status: 400 })
    }

    // Mettre a jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: 'PRODUCER',
        producerStatus: 'PENDING',
        producerBio: validated.data.producerBio,
        portfolio: validated.data.portfolio,
        youtube: validated.data.youtube,
      },
      select: {
        id: true,
        name: true,
        role: true,
        producerStatus: true,
      },
    })

    // Notifier les admins (notification in-app + email)
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, email: true },
    })

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: 'SYSTEM' as const,
          title: 'Nouvelle candidature producteur',
          message: `${user.name} souhaite devenir producteur`,
          link: '/admin',
        })),
      })

      // Envoyer email à chaque admin
      for (const admin of admins) {
        if (admin.email) {
          sendAdminNewApplicationEmail({
            adminEmail: admin.email,
            applicantName: user.name || 'Inconnu',
            applicantEmail: user.email || '',
            bio: validated.data.producerBio,
            portfolio: validated.data.portfolio,
          }).catch((err) => console.error('Email admin notification échoué:', err))
        }
      }
    }

    // Envoyer email de confirmation
    if (user.email) {
      sendProducerApplicationEmail({
        to: user.email,
        name: user.name || 'Artiste',
      }).catch((err) => console.error('Email confirmation candidature échoué:', err))
    }

    return NextResponse.json({
      message: 'Candidature soumise ! Notre equipe va examiner ton profil.',
      user: updatedUser,
    })
  } catch (error) {
    console.error('Erreur candidature producteur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
