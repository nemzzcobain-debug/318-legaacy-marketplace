import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { role, name } = await req.json()

    if (!role || !['ARTIST', 'PRODUCER'].includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { role }

    // If producer, set pending status
    if (role === 'PRODUCER') {
      updateData.producerStatus = 'PENDING'
    }

    // Update name if provided (for Apple Sign In which may hide email/name)
    if (name && name.trim().length >= 2) {
      updateData.name = name.trim()
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    })

    // If producer, notify admins
    if (role === 'PRODUCER') {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      })

      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            type: 'SYSTEM',
            title: 'Nouveau producteur',
            message: `${user.name ?? user.email} souhaite devenir beatmaker (via connexion sociale).`,
            link: '/admin/producers',
            userId: admin.id,
          })),
        })
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        producerStatus: user.producerStatus,
      },
    })
  } catch (error) {
    console.error('Onboarding error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
