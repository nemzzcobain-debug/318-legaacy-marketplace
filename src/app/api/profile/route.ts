export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth-helpers'
import { updateProfileSchema } from '@/lib/validations'

// GET /api/profile - Get current user profile
export async function GET() {
    try {
          const authUser = await getAuthenticatedUser()
          if (!authUser) {
                  return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
          }
          const userId = authUser.id

      const user = await prisma.user.findUnique({
              where: { id: userId },
              select: {
                        id: true,
                        email: true,
                        name: true,
                        displayName: true,
                        avatar: true,
                        bio: true,
                        role: true,
                        website: true,
                        instagram: true,
                        twitter: true,
                        youtube: true,
                        soundcloud: true,
                        spotify: true,
                        notifEmail: true,
                        notifBid: true,
                        notifMessage: true,
                        producerStatus: true,
                        producerBio: true,
                        portfolio: true,
                        totalSales: true,
                        totalPurchases: true,
                        rating: true,
                        createdAt: true,
                        passwordHash: true,
                        _count: {
                                    select: {
                                                  beats: true,
                                                  bids: true,
                                    },
                        },
              },
      })

      if (!user) {
              return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
      }

      // Add follower/following counts safely (table may not exist yet)
      let followCounts = { followers: 0, following: 0 }
          try {
                  const [frs, fng] = await Promise.all([
                            prisma.follow.count({ where: { followingId: userId } }),
                            prisma.follow.count({ where: { followerId: userId } }),
                          ])
                  followCounts = { followers: frs, following: fng }
          } catch {}

      // Don't send the actual hash to the client, just whether they have one
      const { passwordHash, ...userData } = user
          return NextResponse.json({
                  ...userData,
                  hasPassword: !!passwordHash,
                  _count: { ...userData._count, ...followCounts },
          })
    } catch (error) {
          console.error('Profile GET error:', error)
          return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}

// PUT /api/profile - Update current user profile
export async function PUT(request: Request) {
    try {
          const authUser = await getAuthenticatedUser()
          if (!authUser) {
                  return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
          }
          const userId = authUser.id

      const contentLength = parseInt(request.headers.get('content-length') || '0')
          if (contentLength > 50_000) {
                  return NextResponse.json({ error: 'Payload trop volumineux' }, { status: 413 })
          }

      const body = await request.json()

      const parsed = updateProfileSchema.safeParse(body)
          if (!parsed.success) {
                  return NextResponse.json(
                    { error: parsed.error.errors[0]?.message || 'Données invalides' },
                    { status: 400 }
                          )
          }

      const updateData: Record<string, unknown> = {}
            for (const [key, value] of Object.entries(parsed.data)) {
                    if (value !== undefined) {
                              updateData[key] = value
                    }
            }

      // Validate URLs
      const urlFields = ['website', 'instagram', 'twitter', 'youtube', 'soundcloud', 'spotify', 'portfolio']
          for (const field of urlFields) {
                  if (updateData[field] && typeof updateData[field] === 'string' && (updateData[field] as string).trim() !== '') {
                            let url = (updateData[field] as string).trim()
                            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                                        url = 'https://' + url
                            }
                            try {
                                        const parsedUrl = new URL(url)
                                        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                                                      return NextResponse.json({ error: `Protocole invalide pour ${field}` }, { status: 400 })
                                        }
                                        updateData[field] = url
                            } catch {
                                        return NextResponse.json({ error: `URL invalide pour ${field}` }, { status: 400 })
                            }
                  } else if (updateData[field] === '') {
                            updateData[field] = null
                  }
          }

      const updatedUser = await prisma.user.update({
              where: { id: userId },
              data: updateData,
              select: {
                        id: true,
                        name: true,
                        displayName: true,
                        avatar: true,
                        bio: true,
                        website: true,
                        instagram: true,
                        twitter: true,
                        youtube: true,
                        soundcloud: true,
                        spotify: true,
                        notifEmail: true,
                        notifBid: true,
                        notifMessage: true,
                        producerBio: true,
                        portfolio: true,
              },
      })

      return NextResponse.json(updatedUser)
    } catch (error) {
          console.error('Profile PUT error:', error)
          return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
