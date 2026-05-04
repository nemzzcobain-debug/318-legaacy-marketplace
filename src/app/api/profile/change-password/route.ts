import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
    try {
          const session = await getServerSession(authOptions)
          if (!session?.user?.id) {
                  return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
                }

          const body = await request.json()
          const { currentPassword, newPassword } = body

          if (!newPassword || newPassword.length < 8) {
                  return NextResponse.json(
                            { error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' },
                            { status: 400 }
                          )
                }

          // SECURITY FIX L7: Limiter la longueur du mot de passe (DoS via bcrypt)
          if (newPassword.length > 128) {
                  return NextResponse.json(
                            { error: 'Le mot de passe ne doit pas dépasser 128 caractères' },
                            { status: 400 }
                          )
                }

          // Validate password strength
          if (!/[A-Z]/.test(newPassword)) {
                  return NextResponse.json(
                            { error: 'Le mot de passe doit contenir au moins une majuscule' },
                            { status: 400 }
                          )
                }
          if (!/[a-z]/.test(newPassword)) {
                  return NextResponse.json(
                            { error: 'Le mot de passe doit contenir au moins une minuscule' },
                            { status: 400 }
                          )
                }
          if (!/[0-9]/.test(newPassword)) {
                  return NextResponse.json(
                            { error: 'Le mot de passe doit contenir au moins un chiffre' },
                            { status: 400 }
                          )
                }

          const user = await prisma.user.findUnique({
                  where: { id: session.user.id },
                  select: { passwordHash: true },
                })

          if (!user) {
                  return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
                }

          // If user has a password (credentials account), verify current password
          if (user.passwordHash) {
                  if (!currentPassword) {
                            return NextResponse.json({ error: 'Le mot de passe actuel est requis' }, { status: 400 })
                          }
                  const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
                  if (!isValid) {
                            return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 400 })
                          }
                }
          // If user has no password (OAuth account), they can set one without current password

          const hashedPassword = await bcrypt.hash(newPassword, 12)

          await prisma.user.update({
                  where: { id: session.user.id },
                  data: { passwordHash: hashedPassword },
                })

          return NextResponse.json({ success: true, message: 'Mot de passe mis à jour' })
        } catch (error) {
          // SECURITY FIX L2: Ne pas logger l'objet erreur complet
          console.error('Erreur changement mot de passe:', String(error))
          return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
        }
  }
