export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomUUID, createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { registerSchema } from '@/lib/validations'
import { sendVerificationEmail } from '@/lib/emails/resend'
import { logger } from '@/lib/logger'

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

    // Generer le token de verification
    const verificationToken = randomUUID()
    const hashedToken = createHash('sha256').update(verificationToken).digest('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h from now

    // Sauvegarder le token
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: hashedToken,
        expires: expiresAt,
      },
    })

    // Envoyer l'email de verification (non-bloquant)
    sendVerificationEmail({ to: email, name, token: verificationToken }).catch(() => {})

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
    logger.error('Erreur inscription:', { error: String(error) })
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
