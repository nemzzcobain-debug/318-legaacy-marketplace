import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/profile - Get current user profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const userId = (session.user as any).id

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
        _count: {
          select: {
            followers: true,
            following: true,
            beats: true,
            bids: true,
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Profile GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/profile - Update current user profile
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()

    // Allowed fields to update
    const allowedFields = [
      'name', 'displayName', 'bio', 'avatar',
      'website', 'instagram', 'twitter', 'youtube', 'soundcloud', 'spotify',
      'notifEmail', 'notifBid', 'notifMessage',
      'producerBio', 'portfolio'
    ]

    const updateData: Record<string, any> = {}

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Validate name (required, min 2 chars)
    if (updateData.name !== undefined && updateData.name.trim().length < 2) {
      return NextResponse.json({ error: 'Le nom doit contenir au moins 2 caractères' }, { status: 400 })
    }

    // Validate URLs
    const urlFields = ['website', 'instagram', 'twitter', 'youtube', 'soundcloud', 'spotify', 'portfolio']
    for (const field of urlFields) {
      if (updateData[field] && updateData[field].trim() !== '') {
        // Auto-add https:// if missing
        let url = updateData[field].trim()
        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url
        }

        // Validate URL using URL constructor
        try {
          const parsedUrl = new URL(url)
          // Only allow http:// and https:// protocols
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return NextResponse.json(
              { error: `Protocole invalide pour le champ ${field}. Seuls http:// et https:// sont autorisés.` },
              { status: 400 }
            )
          }
          updateData[field] = url
        } catch {
          // Invalid URL
          return NextResponse.json(
            { error: `URL invalide pour le champ ${field}` },
            { status: 400 }
          )
        }
      } else if (updateData[field] === '') {
        updateData[field] = null
      }
    }

    // Validate bio length
    if (updateData.bio && updateData.bio.length > 500) {
      return NextResponse.json({ error: 'La bio ne peut pas dépasser 500 caractères' }, { status: 400 })
    }

    if (updateData.producerBio && updateData.producerBio.length > 1000) {
      return NextResponse.json({ error: 'La bio producteur ne peut pas dépasser 1000 caractères' }, { status: 400 })
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
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Profile PUT error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
