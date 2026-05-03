export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendBeatUploadConfirmationEmail } from '@/lib/emails/resend'

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
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
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
        { error: 'Votre compte producteur doit être approuvé' },
        { status: 403 }
      )
    }

    // Extraction des métadonnées JSON
    const body = await req.json()
    const {
      title,
      genre,
      bpm,
      key,
      mood,
      description,
      tags,
      audioUrl,
      coverUrl,
      audioSize,
      // Auction fields
      enableAuction,
      startPrice,
      premiumPrice,
      exclusivePrice,
      buyNowPrice,
      auctionDuration,
      licenseType,
      bidIncrement,
    } = body

    // Validations des champs requis
    if (!title || !genre || !bpm || !audioUrl) {
      return NextResponse.json(
        { error: 'Champs requis: titre, genre, BPM, audioUrl' },
        { status: 400 }
      )
    }

    // SECURITY FIX M2: Valider que audioUrl est un URL Supabase valide
    const SUPABASE_DOMAIN = process.env.NEXT_PUBLIC_SUPABASE_URL || 'onfwowxfflnijuvpspkq.supabase.co'
    if (typeof audioUrl !== 'string' || !audioUrl.includes('supabase.co/storage/')) {
      return NextResponse.json(
        { error: 'audioUrl doit etre un lien Supabase Storage valide' },
        { status: 400 }
      )
    }

    // SECURITY FIX M2: Valider la taille du fichier audio (max 50 MB)
    if (audioSize && (typeof audioSize !== 'number' || audioSize > 50 * 1024 * 1024)) {
      return NextResponse.json(
        { error: 'Fichier audio trop volumineux (max 50 MB)' },
        { status: 400 }
      )
    }

    // Validate BPM range (40-300)
    const bpmNum = typeof bpm === 'number' ? bpm : parseInt(String(bpm))
    if (isNaN(bpmNum) || bpmNum < 40 || bpmNum > 300) {
      return NextResponse.json({ error: 'Le BPM doit être entre 40 et 300' }, { status: 400 })
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

    // ─── Création de l'enchère si demandée ───
    let auction = null
    if (enableAuction && startPrice) {
      // SECURITY FIX M6: Valider que les prix sont positifs
      if (typeof startPrice !== 'number' || startPrice < 1) {
        return NextResponse.json({ error: 'Le prix de départ doit être >= 1€' }, { status: 400 })
      }
      if (buyNowPrice && (typeof buyNowPrice !== 'number' || buyNowPrice <= startPrice)) {
        return NextResponse.json({ error: 'Le prix buy-now doit être supérieur au prix de départ' }, { status: 400 })
      }
      const now = new Date()
      const durationHours = auctionDuration || 24
      const endTime = new Date(now.getTime() + durationHours * 60 * 60 * 1000)

      // Calculer les multiplicateurs a partir des prix definis
      const basePrice = startPrice || 10
      const premMult =
        premiumPrice && basePrice > 0 ? Math.round((premiumPrice / basePrice) * 100) / 100 : 2.5
      const exclMult =
        exclusivePrice && basePrice > 0 ? Math.round((exclusivePrice / basePrice) * 100) / 100 : 10

      auction = await prisma.auction.create({
        data: {
          beatId: beat.id,
          startPrice: startPrice,
          currentBid: startPrice,
          buyNowPrice: buyNowPrice || null,
          bidIncrement: bidIncrement || 5,
          licenseType: licenseType || 'BASIC',
          premiumMultiplier: premMult,
          exclusiveMultiplier: exclMult,
          startTime: now,
          endTime: endTime,
          status: 'ACTIVE',
          commissionPercent: 15,
        },
      })
    }

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
          link: `/beats/${beat.id}`,
          userId: f.followerId,
        })),
        ...admins.map((a) => ({
          type: 'NEW_BEAT',
          title: `Nouveau beat uploadé`,
          message: `${producerName} a uploadé "${title}" (${genre}, ${bpm} BPM)`,
          link: `/admin?tab=beats`,
          userId: a.id,
        })),
      ]

      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications })
      }
    } catch (notifErr) {
      // SECURITY FIX M1: Logger les erreurs de notification au lieu de les ignorer
      console.warn('[UPLOAD] Erreur notification fan-out:', String(notifErr))
    }

    // Envoyer email de confirmation d'upload au producteur
    if (user.email) {
      sendBeatUploadConfirmationEmail({
        to: user.email,
        producerName: user.displayName || user.name || 'Producteur',
        beatTitle: title,
        genre,
        bpm: bpmNum,
        hasAuction: !!auction,
        auctionStartPrice: startPrice,
        auctionDuration: auctionDuration,
      }).catch((err) => console.warn('[UPLOAD] Email confirmation echoue:', String(err)))
    }

    return NextResponse.json(
      {
        success: true,
        beat,
        auction,
        message: enableAuction ? 'Beat uploadé et enchère lancée !' : 'Beat uploadé avec succès!',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Erreur lors de l'upload:", error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
