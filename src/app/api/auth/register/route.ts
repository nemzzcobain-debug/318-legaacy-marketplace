import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { registerSchema } from '@/lib/validations'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validation
    const validated = registerSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, email, password, role } = validated.data

    // Verifier si l'email existe deja
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })
    if (existingUser) {
      return NextResponse.json(
        { error: 'Un compte existe deja avec cet email' },
        { status: 409 }
      )
    }

    // Hash du mot de passe
    const passwordHash = await bcrypt.hash(password, 12)

    // Creer l'utilisateur
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        producerStatus: role === 'PRODUCER' ? 'PENDING' : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    })

    // Si producteur, creer une notification pour les admins
    if (role === 'PRODUCER') {
      // Notifier les admins
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      })

      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: 'SYSTEM',
          title: 'Nouvelle candidature producteur',
          message: `${name} souhaite devenir producteur sur la plateforme`,
          link: `/admin/producers`,
        })),
      })
    }

    return NextResponse.json(
      { message: 'Compte cree avec succes', user },
      { status: 201 }
    )
  } catch (error) {
    console.error('Erreur inscription:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
