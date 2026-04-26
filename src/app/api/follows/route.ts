export const dynamic = 'force-dynamic'

// ─── 318 LEGAACY Marketplace - Follow System API ───
// POST: follow/unfollow toggle
// GET: check follow status + counts, supports batch

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendNewFollowerEmail } from '@/lib/emails/resend'

// ─── POST: Toggle follow/unfollow ───
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { producerId } = await req.json()
    if (!producerId) {
      return NextResponse.json({ error: 'producerId requis' }, { status: 400 })
    }

    // Can't follow yourself
    if (producerId === session.user.id) {
      return NextResponse.json({ error: 'Impossible de se suivre soi-même' }, { status: 400 })
    }

    // Check if producer exists
    const producer = await prisma.user.findUnique({
      where: { id: producerId },
      select: { id: true, role: true, producerStatus: true }
    })

    if (!producer) {
      return NextResponse.json({ error: 'Producteur non trouvé' }, { status: 404 })
    }

    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: session.user.id,
          followingId: producerId
        }
      }
    })

    if (existingFollow) {
      // Unfollow
      await prisma.follow.delete({
        where: { id: existingFollow.id }
      })

      const count = await prisma.follow.count({
        where: { followingId: producerId }
      })

      return NextResponse.json({ followed: false, count })
    } else {
      // Follow + create notification (with dedup check)
      // SECURITY FIX M4: Eviter le spam de notifications follow/unfollow
      const recentNotif = await prisma.notification.findFirst({
        where: {
          userId: producerId,
          type: 'NEW_FOLLOWER',
          link: `/producer/${session.user.id}`,
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // 1h
        },
      })

      const txOps = [
        prisma.follow.create({
          data: {
            followerId: session.user.id,
            followingId: producerId
          }
        }),
      ]

      // Ne creer la notification que si pas de doublon recent
      if (!recentNotif) {
        txOps.push(
          prisma.notification.create({
            data: {
              type: 'NEW_FOLLOWER',
              title: 'Nouveau follower',
              message: `${session.user.name || 'Utilisateur'} vous suit maintenant !`,
              link: `/producer/${session.user.id}`,
              userId: producerId
            }
          })
        )
      }

      await prisma.$transaction(txOps)

      const count = await prisma.follow.count({
        where: { followingId: producerId }
      })

      // Send email notification (non-blocking)
      const producerData = await prisma.user.findUnique({
        where: { id: producerId },
        select: { email: true, displayName: true, name: true }
      })
      if (producerData?.email) {
        sendNewFollowerEmail({
          to: producerData.email,
          producerName: producerData.displayName || producerData.name,
          followerName: session.user.name || 'Un utilisateur',
          totalFollowers: count,
        }).catch((err) => console.warn('[FOLLOW] Erreur envoi email:', String(err)))
      }

      return NextResponse.json({ followed: true, count })
    }
  } catch (error) {
    console.error('Follow error:', String(error))
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ─── GET: Check follow status + counts ───
// ?producerId=xxx — single producer
// ?producerIds=id1,id2,id3 — batch check
// ?followers=producerId — list followers of a producer
// ?following=userId — list who a user follows
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(req.url)

    const producerId = searchParams.get('producerId')
    const producerIds = searchParams.get('producerIds')
    const followersOf = searchParams.get('followers')
    const followingOf = searchParams.get('following')

    // ─── Single producer check ───
    if (producerId) {
      const count = await prisma.follow.count({
        where: { followingId: producerId }
      })

      let isFollowing = false
      if (session?.user?.id) {
        const follow = await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: session.user.id,
              followingId: producerId
            }
          }
        })
        isFollowing = !!follow
      }

      return NextResponse.json({ isFollowing, count })
    }

    // ─── Batch check ───
    if (producerIds) {
      const ids = producerIds.split(',').filter(Boolean)

      const counts = await prisma.follow.groupBy({
        by: ['followingId'],
        where: { followingId: { in: ids } },
        _count: true
      })

      let userFollows: string[] = []
      if (session?.user?.id) {
        const follows = await prisma.follow.findMany({
          where: {
            followerId: session.user.id,
            followingId: { in: ids }
          },
          select: { followingId: true }
        })
        userFollows = follows.map(f => f.followingId)
      }

      const result = ids.reduce((acc, id) => {
        const countEntry = counts.find(c => c.followingId === id)
        acc[id] = {
          count: countEntry?._count || 0,
          isFollowing: userFollows.includes(id)
        }
        return acc
      }, {} as Record<string, { count: number; isFollowing: boolean }>)

      return NextResponse.json(result)
    }

    // ─── List followers of a producer ───
    if (followersOf) {
      const followers = await prisma.follow.findMany({
        where: { followingId: followersOf },
        include: {
          follower: {
            select: {
              id: true,
              name: true,
              displayName: true,
              avatar: true,
              role: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      })

      const count = await prisma.follow.count({
        where: { followingId: followersOf }
      })

      return NextResponse.json({
        followers: followers.map(f => f.follower),
        count
      })
    }

    // ─── List who a user follows ───
    if (followingOf) {
      const following = await prisma.follow.findMany({
        where: { followerId: followingOf },
        include: {
          following: {
            select: {
              id: true,
              name: true,
              displayName: true,
              avatar: true,
              role: true,
              producerStatus: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      })

      const count = await prisma.follow.count({
        where: { followerId: followingOf }
      })

      return NextResponse.json({
        following: following.map(f => f.following),
        count
      })
    }

    return NextResponse.json({ error: 'Paramètre requis: producerId, producerIds, followers ou following' }, { status: 400 })
  } catch (error) {
    console.error('Follow GET error:', String(error))
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
