export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSignedUrl, parseSupabaseUrl } from '@/lib/supabase'

// GET /api/beats/[id]/download?type=mp3|wav|stems
// Retourne une signed URL temporaire (1h) si l'utilisateur a achete le beat
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const userId = session.user.id
    const beatId = params.id
    const fileType = req.nextUrl.searchParams.get('type') || 'mp3'

    if (!['mp3', 'wav', 'stems'].includes(fileType)) {
      return NextResponse.json({ error: 'Type de fichier invalide' }, { status: 400 })
    }

    // Verifier que l'utilisateur a un achat COMPLETED pour ce beat
    const purchase = await prisma.purchase.findFirst({
      where: {
        buyerId: userId,
        beatId,
        status: 'COMPLETED',
      },
      select: { licenseType: true },
    })

    // Fallback: verifier aussi les anciennes encheres (avant migration Purchase)
    let licenseType = purchase?.licenseType
    if (!licenseType) {
      const wonAuction = await prisma.auction.findFirst({
        where: {
          winnerId: userId,
          beatId,
          status: 'COMPLETED',
          paidAt: { not: null },
        },
        select: { winningLicense: true, licenseType: true },
      })
      licenseType = wonAuction?.winningLicense || wonAuction?.licenseType || null
    }

    if (!licenseType) {
      return NextResponse.json(
        { error: "Vous n'avez pas achete ce beat" },
        { status: 403 }
      )
    }

    // Verifier les droits selon la licence
    if (fileType === 'wav' && licenseType === 'BASIC') {
      return NextResponse.json(
        { error: 'La licence BASIC ne donne pas acces au fichier WAV' },
        { status: 403 }
      )
    }
    if (fileType === 'stems' && licenseType !== 'EXCLUSIVE') {
      return NextResponse.json(
        { error: 'Seule la licence EXCLUSIVE donne acces aux stems' },
        { status: 403 }
      )
    }

    // Recuperer le beat et l'URL du fichier demande
    const beat = await prisma.beat.findUnique({
      where: { id: beatId },
      select: { audioUrl: true, audioWav: true, stemsUrl: true, title: true },
    })

    if (!beat) {
      return NextResponse.json({ error: 'Beat introuvable' }, { status: 404 })
    }

    let fileUrl: string | null = null
    if (fileType === 'mp3') fileUrl = beat.audioUrl
    else if (fileType === 'wav') fileUrl = beat.audioWav || null
    else if (fileType === 'stems') fileUrl = beat.stemsUrl || null

    if (!fileUrl) {
      return NextResponse.json(
        { error: `Fichier ${fileType.toUpperCase()} non disponible pour ce beat` },
        { status: 404 }
      )
    }

    // Parser l'URL Supabase et generer une signed URL (1h)
    const parsed = parseSupabaseUrl(fileUrl)
    if (!parsed) {
      // Si l'URL n'est pas une URL Supabase standard, renvoyer telle quelle
      // (cas de migration ou URL externe)
      return NextResponse.json({ url: fileUrl, expiresIn: null })
    }

    const signedUrl = await getSignedUrl(parsed.bucket, parsed.path, 3600)
    if (!signedUrl) {
      return NextResponse.json({ error: 'Impossible de generer le lien de telechargement' }, { status: 500 })
    }

    return NextResponse.json({
      url: signedUrl,
      expiresIn: 3600,
      fileName: `${beat.title}.${fileType}`,
    })
  } catch (error) {
    console.error('Erreur download beat:', String(error))
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
