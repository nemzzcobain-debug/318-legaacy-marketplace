export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Endpoint d'upload de beats (v2 - metadata only)
 * Les fichiers sont uploadés directement du client vers Supabase Storage
 * Cette API reçoit uniquement les métadonnées et crée l'entrée en base
 */
export async function POST(req: NextRequest) {
  try {
    // Vérification de l'authentification
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non connecte' }, { status: 401 })
    }

    // Récupération et vérification du rôle utilisateur
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email || '' },
    })

    if (!user || (user.role !== 'PRODUCER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Seuls les producteurs peuvent uploader des beats' },
        { status: 403 }
      )
    }

    if (user.role === 'PRODUCER' && user.producerStatus !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Votre compte producteur doit etre approuve' },
        { status: 403 }
      )
    }

    // Extraction des métadonnées JSON
    const body = await req.json()
    const { title, genre, bpm, key, mood, description, tags, audioUrl, coverUrl, audioSize } = body

    // Validations des champs requis
    if (!title || !genre || !bpm || !audioUrl) {
      return NextResponse.json(
        { error: 'Champs requis: titre, genre, BPM, audioUrl' },
        { status: 400 }
      )
    }

    // Validate BPM range (40-300)
    const bpmNum = typeof bpm === 'number' ? bpm : parseInt(String(bpm))
    if (isNaN(bpmNum) || bpmNum < 40 || bpmNum > 300) {
      return NextResponse.json({ error: 'Le BPM doit etre entre 40 et 300' }, { status: 400 })
    }

    // Calcul approximatif de la durée basé sur la taille du fichier
    const estimatedDuration = audioSize ? Math.round(audioSize / 16000) : 0

    // Création de l'entrée beat dans la base de données
    const beat = await prisma.beat.create({
      data: {
        title,
        description: description || null,
        audioUrl,
        genre,
        bpm: typeof bpm === 'number' ? bpm : parseInt(bpm),
        key: key || null,
        mood: mood || null,
        tags: Array.isArray(tags) ? JSON.stringify(tags) : tags || '[]',
        coverImage: coverUrl || null,
        duration: estimatedDuration,
        status: 'ACTIVE',
        producerId: user.id,
      },
      include: {
        producer: {
          select: { name: true, displayName: true },
        },
      },
    })

    // Notifier tous les followers du producteur + les admins
    try {
      const producerName = user.displayName || user.name

      // Notifier les followers
      const followers = await prisma.follow.findMany({
        where: { followingId: user.id },
        select: { followerId: true },
      })

      // Notifier les admins (sauf si c'est un admin qui uploade)
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', id: { not: user.id } },
        select: { id: true },
      })

      const notifications = [
        ...followers.map((f) => ({
          type: 'NEW_BEAT',
          title: `Nouveau beat de ${producerName}`,
          message: `${producerName} a publié "${title}" (${genre}, ${bpm} BPM)`,
          link: `/producer/${user.id}`,
          userId: f.followerId,
        })),
        ...admins.map((a) => ({
          type: 'NEW_BEAT',
          title: `Nouveau beat uploadé`,
          message: `${producerName} a uploadé "${title}" (${genre}, ${bpm} BPM)`,
          link: `/beats/${beat.id}`,
          userId: a.id,
        })),
      ]

      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications })
      }
    } catch {}

    return NextResponse.json(
      {
        success: true,
        beat,
        message: 'Beat uploade avec succes!',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Erreur lors de l'upload:", error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
