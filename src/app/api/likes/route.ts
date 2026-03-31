import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST — Toggle like on a beat
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const { beatId } = await req.json()
    if (!beatId) {
      return NextResponse.json({ error: 'beatId requis' }, { status: 400 })
    }

    const userId = session.user.id

    // Check if already liked
    const existing = await prisma.like.findUnique({
      where: { userId_beatId: { userId, beatId } },
    })

    if (existing) {
      // Unlike
      await prisma.like.delete({
        where: { id: existing.id },
      })

      const count = await prisma.like.count({ where: { beatId } })
      return NextResponse.json({ liked: false, count })
    }

    // Like
    await prisma.like.create({
      data: { userId, beatId },
    })

    const count = await prisma.like.count({ where: { beatId } })
    return NextResponse.json({ liked: true, count })
  } catch (error: any) {
    console.error('Like error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// GET — Check if user liked a beat + count
// ?beatId=xxx or ?beatIds=id1,id2,id3
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id || null
    const { searchParams } = new URL(req.url)

    const beatId = searchParams.get('beatId')
    const beatIds = searchParams.get('beatIds')

    if (beatId) {
      const [count, liked] = await Promise.all([
        prisma.like.count({ where: { beatId } }),
        userId
          ? prisma.like.findUnique({ where: { userId_beatId: { userId, beatId } } })
          : null,
      ])

      return NextResponse.json({ beatId, liked: !!liked, count })
    }

    if (beatIds) {
      const ids = beatIds.split(',').filter(Boolean)

      // Get counts for all beats
      const counts = await prisma.like.groupBy({
        by: ['beatId'],
        where: { beatId: { in: ids } },
        _count: true,
      })

      // Get user's likes
      let userLikes: string[] = []
      if (userId) {
        const likes = await prisma.like.findMany({
          where: { userId, beatId: { in: ids } },
          select: { beatId: true },
        })
        userLikes = likes.map(l => l.beatId)
      }

      const result = ids.reduce((acc, id) => {
        const countEntry = counts.find(c => c.beatId === id)
        acc[id] = {
          liked: userLikes.includes(id),
          count: countEntry?._count || 0,
        }
        return acc
      }, {} as Record<string, { liked: boolean; count: number }>)

      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'beatId ou beatIds requis' }, { status: 400 })
  } catch (error: any) {
    console.error('Like GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
