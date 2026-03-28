import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/producers - Liste des producteurs approuves
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Number(searchParams.get('page') || 1)
    const limit = Number(searchParams.get('limit') || 20)

    const [producers, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: 'PRODUCER',
          producerStatus: 'APPROVED',
        },
        select: {
          id: true,
          name: true,
          displayName: true,
          avatar: true,
          bio: true,
          producerBio: true,
          rating: true,
          totalSales: true,
          createdAt: true,
          _count: {
            select: {
              beats: { where: { status: 'ACTIVE' } },
            },
          },
        },
        orderBy: { totalSales: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({
        where: {
          role: 'PRODUCER',
          producerStatus: 'APPROVED',
        },
      }),
    ])

    return NextResponse.json({
      producers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Erreur listing producteurs:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
