import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { createBeatSchema } from '@/lib/validations'

// GET /api/beats - Liste des beats
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const genre = searchParams.get('genre')
    const mood = searchParams.get('mood')
    const search = searchParams.get('search')
    const producerId = searchParams.get('producerId')
    const page = Number(searchParams.get('page') || 1)
    const limit = Number(searchParams.get('limit') || 20)

    const where: any = {
      status: 'ACTIVE',
    }

    if (genre) where.genre = genre
    if (mood) where.mood = mood
    if (producerId) where.producerId = producerId
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { genre: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ]
    }

    const [beats, total] = await Promise.all([
      prisma.beat.findMany({
        where,
        include: {
          producer: {
            select: {
              id: true,
              name: true,
              displayName: true,
              avatar: true,
              rating: true,
              producerStatus: true,
            },
          },
          auctions: {
            where: {
              status: { in: ['ACTIVE', 'ENDING_SOON'] },
            },
            orderBy: { endTime: 'asc' },
            take: 1,
          },
          _count: {
            select: { likes: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.beat.count({ where }),
    ])

    return NextResponse.json({
      beats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Erreur listing beats:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/beats - Creer un beat (producteurs uniquement)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
    })

    if (!user || user.role !== 'PRODUCER' || user.producerStatus !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Seuls les producteurs approuves peuvent ajouter des beats' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validated = createBeatSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      )
    }

    const beat = await prisma.beat.create({
      data: {
        ...validated.data,
        tags: validated.data.tags || [],
        producerId: user.id,
        audioUrl: body.audioUrl || '',
        status: 'PENDING', // Necessite validation admin
      },
    })

    return NextResponse.json({ beat }, { status: 201 })
  } catch (error) {
    console.error('Erreur creation beat:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
