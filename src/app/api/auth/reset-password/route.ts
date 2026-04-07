export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { resetPasswordSchema } from '@/lib/validations'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validation
    const validated = resetPasswordSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      )
    }

    const { token, password } = validated.data

    // Hash the token to lookup in database
    const hashedToken = createHash('sha256').update(token).digest('hex')

    // Find the reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: hashedToken },
      select: { email: true, expires: true },
    })

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Lien de reinitialisation invalide ou expire' },
        { status: 400 }
      )
    }

    // Check if token has expired
    if (new Date() > resetToken.expires) {
      // Delete the expired token
      await prisma.passwordResetToken.delete({
        where: { token: hashedToken },
      })
      return NextResponse.json(
        { error: 'Lien de reinitialisation expire. Demande une nouvelle reinitialisation.' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: resetToken.email },
      select: { id: true, email: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouve' },
        { status: 400 }
      )
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12)

    // Update user's password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

    // Delete all reset tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { email: resetToken.email },
    })

    return NextResponse.json(
      { message: 'Mot de passe reinitialise avec succes. Tu peux te connecter maintenant.' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Erreur reset-password:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
