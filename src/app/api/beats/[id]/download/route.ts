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
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = session.user.id
    const beatId = params.id
    const fileType = req.nextUrl.searchParams.get('type') || 'mp3'

    if (!['mp3', 'wav', 'stems'].includes(fileType)) {
      return NextResponse.json({ error: 'Type de fichier invalide' }, { status: 400 })
    }

    // Vérifier que l'utilisateur a un achat COMPLETED pour ce beat
    const purchase = await prisma.purchase.findFirst({
      where: {
        buyerId: userId,
        beatId,
        status: 'COMPLETED',
      },
      select: { licenseType: true },
    })

    // Fallback: vérifiér aussi les anciennes enchères (avant migration Purchase)
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

    // Vérifier les droits selon la licence achetée
    // Hiérarchie: STEMS > WAV/PREMIUM > MP3/BASIC
    // EXCLUSIVE et STEMS donnent accès à tout
    const hasWavAccess = ['WAV', 'STEMS', 'PREMIUM', 'EXCLUSIVE'].includes(licenseType)
    const hasStemsAccess = ['STEMS', 'EXCLUSIVE'].includes(licenseType)

    if (fileType === 'wav' && !hasWavAccess) {
      return NextResponse.json(
        { error: 'Votre licence ne donne pas accès au fichier WAV. Passez à la licence WAV ou Stems.' },
        { status: 403 }
      )
    }
    if (fileType === 'stems' && !hasStemsAccess) {
      return NextResponse.json(
        { error: 'Votre licence ne donne pas accès aux stems. Passez à la licence Stems.' },
        { status: 403 }
      )
    }

    // Récupérer le beat et l'URL du fichier demandé
    const beat = await prisma.beat.findUnique({
      where: { id: beatId },
      select: { audioUrl: true, audioWav: true, stemsUrl: true, stemsFiles: true, title: true },
    })

    if (!beat) {
      return NextResponse.json({ error: 'Beat introuvable' }, { status: 404 })
    }

    let fileUrl: string | null = null
    if (fileType === 'mp3') fileUrl = beat.audioUrl
    else if (fileType === 'wav') fileUrl = beat.audioWav || null
    else if (fileType === 'stems') fileUrl = beat.stemsUrl || null

    // Pour les stems: si pas de ZIP mais des fichiers individuels, générer les signed URLs
    if (fileType === 'stems' && !fileUrl && beat.stemsFiles) {
      try {
        const stems = JSON.parse(beat.stemsFiles) as Array<{name: string; url: string; size: number}>
        if (stems.length > 0) {
          const signedStems = await Promise.all(
            stems.map(async (stem) => {
              const parsed = parseSupabaseUrl(stem.url)
              if (!parsed) return { name: stem.name, url: stem.url, size: stem.size }
              const signed = await getSignedUrl(parsed.bucket, parsed.path, 3600)
              return { name: stem.name, url: signed || stem.url, size: stem.size }
            })
          )
          return NextResponse.json({
            stems: signedStems,
            expiresIn: 3600,
            fileName: `${beat.title}_stems`,
          })
        }
      } catch {
        // stemsFiles JSON parse error — fallback
      }
    }

    if (!fileUrl) {
      return NextResponse.json(
        { error: `Fichier ${fileType.toUpperCase()} non disponible pour ce beat` },
        { status: 404 }
      )
    }

    // Parser l'URL Supabase et générer une signed URL (1h)
    const parsed = parseSupabaseUrl(fileUrl)
    if (!parsed) {
      return NextResponse.json({ url: fileUrl, expiresIn: null })
    }

    const signedUrl = await getSignedUrl(parsed.bucket, parsed.path, 3600)
    if (!signedUrl) {
      return NextResponse.json({ error: 'Impossible de générer le lien de téléchargement' }, { status: 500 })
    }

    return NextResponse.json({
      url: signedUrl,
      expiresIn: 3600,
      fileName: `${beat.title}.${fileType === 'stems' ? 'zip' : fileType}`,
    })
  } catch (error) {
    console.error('Erreur download beat:', String(error))
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
