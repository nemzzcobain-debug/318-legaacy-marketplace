export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enforceProducerStripeAccess } from '@/lib/producer-stripe-access'
import {
  sendAdminNewBeatEmail,
  sendBeatUploadConfirmationEmail,
  sendNtfy,
} from '@/lib/emails/resend'
import { normalizeBeatSaleMode } from '@/lib/beat-sale-mode'
import {
  AI_DECLARATION_VERSION,
  AI_USAGE_VALUES,
  calculateAuthenticityRisk,
} from '@/lib/beat-authenticity'

const MAX_PUBLIC_PREVIEW_SECONDS = 60.5

function isExpectedStorageUrl(
  value: unknown,
  bucket: 'beat-previews' | 'beat-files',
  userId: string,
  isPublic: boolean
): value is string {
  if (typeof value !== 'string') return false

  try {
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)
    const candidate = new URL(value)
    const visibilityPath = isPublic ? 'public/' : ''
    const expectedPrefix = `/storage/v1/object/${visibilityPath}${bucket}/${userId}/`

    return candidate.origin === supabaseUrl.origin && candidate.pathname.startsWith(expectedPrefix)
  } catch {
    return false
  }
}

async function validatePublicWavPreview(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: { Range: 'bytes=0-43' },
      cache: 'no-store',
    })
    if (!response.ok) return false

    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength < 44) return false

    const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))
    if (ascii(0, 4) !== 'RIFF' || ascii(8, 12) !== 'WAVE' || ascii(36, 40) !== 'data') {
      return false
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const byteRate = view.getUint32(28, true)
    const dataSize = view.getUint32(40, true)
    if (byteRate <= 0 || dataSize <= 0 || dataSize / byteRate > MAX_PUBLIC_PREVIEW_SECONDS) {
      return false
    }

    // Empêche d'ajouter un morceau complet après un faux en-tête de 60 secondes.
    const contentRange = response.headers.get('content-range')
    const totalSize = contentRange?.match(/\/(\d+)$/)?.[1] || response.headers.get('content-length')
    return Boolean(totalSize) && Number(totalSize) === 44 + dataSize
  } catch {
    return false
  }
}

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

    const producerAccess = await enforceProducerStripeAccess(user)
    if (!producerAccess.allowed) {
      return NextResponse.json(
        {
          error: producerAccess.message,
          code: producerAccess.status,
          actionUrl:
            producerAccess.status === 'stripe_suspended' ? '/dashboard?tab=settings' : undefined,
        },
        { status: 403 }
      )
    }

    // Extraction des métadonnées JSON
    const body = await req.json()
    const {
      editBeatId,
      title,
      genre,
      bpm,
      key,
      mood,
      description,
      tags,
      audioUrl,
      audioOriginalUrl,
      coverUrl,
      audioSize,
      audioDuration,
      // Fichiers haute qualité
      wavUrl,
      stemsFiles, // [{name, url, size}]
      // Prix licences
      priceMp3,
      priceWav,
      saleMode,
      // Auction fields
      enableAuction,
      startPrice,
      premiumPrice,
      exclusivePrice,
      buyNowPrice,
      auctionDuration,
      auctionStartAt,
      bidIncrement,
      // Déclaration d'authenticité
      aiDeclarationAccepted,
      aiUsage,
      aiUsageDetails,
      creationSoftware,
    } = body

    if (aiDeclarationAccepted !== true) {
      return NextResponse.json(
        { error: "La déclaration d'authenticité est obligatoire pour envoyer un beat." },
        { status: 400 }
      )
    }
    if (!AI_USAGE_VALUES.includes(aiUsage)) {
      return NextResponse.json({ error: "Indique clairement l'usage éventuel de l'IA." }, { status: 400 })
    }
    if (aiUsage === 'GENERATIVE') {
      return NextResponse.json(
        {
          error:
            "318 LEGAACY n'accepte pas les instrumentales composées intégralement ou substantiellement par une IA générative.",
          code: 'GENERATIVE_AI_NOT_ALLOWED',
        },
        { status: 400 }
      )
    }
    if (aiUsage === 'ASSISTIVE_ONLY' && !String(aiUsageDetails || '').trim()) {
      return NextResponse.json(
        { error: "Précise l'outil d'assistance IA utilisé et son rôle." },
        { status: 400 }
      )
    }
    if (!String(creationSoftware || '').trim()) {
      return NextResponse.json(
        { error: 'Indique le logiciel ou le matériel utilisé pour composer ce beat.' },
        { status: 400 }
      )
    }

    // Validations des champs requis
    if (!title || !genre || !bpm || !audioUrl || (!audioOriginalUrl && !wavUrl)) {
      return NextResponse.json(
        { error: 'Champs requis: titre, genre, BPM, aperçu audio et fichier MP3 ou WAV' },
        { status: 400 }
      )
    }

    if (!isExpectedStorageUrl(audioUrl, 'beat-previews', user.id, true)) {
      return NextResponse.json(
        { error: "L'aperçu doit provenir du stockage public sécurisé" },
        { status: 400 }
      )
    }

    if (!(await validatePublicWavPreview(audioUrl))) {
      return NextResponse.json(
        { error: "L'aperçu public doit être un WAV réel limité à 60 secondes" },
        { status: 400 }
      )
    }

    if (audioOriginalUrl && !isExpectedStorageUrl(audioOriginalUrl, 'beat-files', user.id, false)) {
      return NextResponse.json(
        { error: 'Le MP3 complet doit provenir du stockage privé sécurisé' },
        { status: 400 }
      )
    }

    // Cohérent avec la limite affichée dans le formulaire.
    if (audioSize && (typeof audioSize !== 'number' || audioSize > 200 * 1024 * 1024)) {
      return NextResponse.json(
        { error: 'Fichier audio trop volumineux (max 200 MB)' },
        { status: 400 }
      )
    }

    // Validate BPM range (40-300)
    const bpmNum = typeof bpm === 'number' ? bpm : parseInt(String(bpm))
    if (isNaN(bpmNum) || bpmNum < 40 || bpmNum > 300) {
      return NextResponse.json({ error: 'Le BPM doit être entre 40 et 300' }, { status: 400 })
    }

    const parsedAudioDuration = Number(audioDuration)
    const duration =
      Number.isFinite(parsedAudioDuration) &&
      parsedAudioDuration > 0 &&
      parsedAudioDuration <= 60 * 60
        ? Math.round(parsedAudioDuration)
        : audioSize
          ? Math.round(audioSize / 16000)
          : 0

    // Validation des stems (si fournis)
    let parsedStems: Array<{ name: string; url: string; size: number }> | null = null
    if (stemsFiles && Array.isArray(stemsFiles) && stemsFiles.length > 0) {
      // Valider que chaque stem a un URL Supabase valide
      for (const stem of stemsFiles) {
        if (!isExpectedStorageUrl(stem.url, 'beat-files', user.id, false)) {
          return NextResponse.json(
            { error: `URL stem invalide pour "${stem.name}"` },
            { status: 400 }
          )
        }
      }
      parsedStems = stemsFiles
    }

    // Validation WAV URL si fourni
    if (wavUrl && !isExpectedStorageUrl(wavUrl, 'beat-files', user.id, false)) {
      return NextResponse.json(
        { error: 'Le WAV doit provenir du stockage privé sécurisé' },
        { status: 400 }
      )
    }

    // Compatibilité avec les anciens formulaires : enableAuction=false devient LEASING.
    const normalizedSaleMode = normalizeBeatSaleMode(
      saleMode ?? (enableAuction === false ? 'LEASING' : 'AUCTION')
    )
    const isAuction = normalizedSaleMode === 'AUCTION'
    const mp3Price = audioOriginalUrl && priceMp3 ? Number(priceMp3) : null
    const wavPrice = wavUrl && priceWav ? Number(priceWav) : null

    if (isAuction) {
      if (!parsedStems || parsedStems.length === 0) {
        return NextResponse.json(
          { error: 'Une enchère est une vente exclusive : ajoute obligatoirement les stems.' },
          { status: 400 }
        )
      }
      if (typeof startPrice !== 'number' || !Number.isFinite(startPrice) || startPrice < 1) {
        return NextResponse.json(
          { error: 'Le prix de départ doit être supérieur à 0 €.' },
          { status: 400 }
        )
      }
      if (
        buyNowPrice &&
        (typeof buyNowPrice !== 'number' ||
          !Number.isFinite(buyNowPrice) ||
          buyNowPrice <= startPrice)
      ) {
        return NextResponse.json(
          { error: 'Le prix d’achat immédiat doit être supérieur au prix de départ.' },
          { status: 400 }
        )
      }
    } else {
      const validMp3Offer = Boolean(audioOriginalUrl && mp3Price && mp3Price > 0)
      const validWavOffer = Boolean(wavUrl && wavPrice && wavPrice > 0)
      if (!validMp3Offer && !validWavOffer) {
        return NextResponse.json(
          {
            error:
              'Pour vendre en leasing, renseigne au moins un prix valide pour le fichier MP3 ou WAV fourni.',
          },
          { status: 400 }
        )
      }
    }

    let rejectedBeat = null
    if (editBeatId) {
      rejectedBeat = await prisma.beat.findUnique({ where: { id: editBeatId } })
      if (
        !rejectedBeat ||
        rejectedBeat.producerId !== user.id ||
        rejectedBeat.status !== 'REJECTED' ||
        rejectedBeat.rejectionType !== 'CHANGES_REQUESTED'
      ) {
        return NextResponse.json(
          { error: 'Ce beat ne peut pas être corrigé ou renvoyé' },
          { status: 403 }
        )
      }
    }

    if (user.role !== 'ADMIN') {
      const pendingCount = await prisma.beat.count({
        where: {
          producerId: user.id,
          status: 'PENDING',
          ...(editBeatId ? { id: { not: editBeatId } } : {}),
        },
      })
      if (pendingCount >= 3) {
        return NextResponse.json(
          {
            error:
              'Tu as déjà 3 beats en attente de validation. Attends une décision avant un nouvel envoi.',
            code: 'PENDING_BEAT_LIMIT',
          },
          { status: 409 }
        )
      }
    }

    const [producerBeatCount, uploadsIn24h, duplicateMetadataCount] = await Promise.all([
      prisma.beat.count({ where: { producerId: user.id } }),
      prisma.beat.count({
        where: {
          producerId: user.id,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.beat.count({
        where: {
          producerId: user.id,
          bpm: bpmNum,
          key: key || null,
          duration,
        },
      }),
    ])
    const initialAuthenticityRisk = calculateAuthenticityRisk({
      declarationAcceptedAt: new Date(),
      aiUsage,
      hasWav: Boolean(wavUrl),
      hasStems: Boolean(parsedStems?.length),
      producerBeatCount: producerBeatCount + (rejectedBeat ? 0 : 1),
      producerMaxUploadsIn24h: uploadsIn24h + (rejectedBeat ? 0 : 1),
      duplicateMetadataCount: duplicateMetadataCount + (rejectedBeat ? 0 : 1),
    })

    const beatData = {
      title,
      description: description || null,
      audioUrl,
      audioOriginal: audioOriginalUrl || null,
      audioWav: wavUrl || null,
      stemsFiles: parsedStems ? JSON.stringify(parsedStems) : null,
      genre,
      bpm: typeof bpm === 'number' ? bpm : parseInt(bpm),
      key: key || null,
      mood: mood || null,
      tags: Array.isArray(tags) ? JSON.stringify(tags) : tags || '[]',
      coverImage: coverUrl || null,
      duration,
      saleMode: normalizedSaleMode,
      priceMp3: normalizedSaleMode === 'LEASING' && mp3Price && mp3Price > 0 ? mp3Price : null,
      priceWav: normalizedSaleMode === 'LEASING' && wavPrice && wavPrice > 0 ? wavPrice : null,
      // Le leasing n'accorde jamais de droits exclusifs et une enchère utilise son prix final.
      priceStems: null,
      status: 'PENDING',
      producerId: user.id,
      rejectionType: null,
      rejectionReason: null,
      rejectedAt: null,
      aiDeclarationVersion: AI_DECLARATION_VERSION,
      aiDeclarationAcceptedAt: new Date(),
      aiUsage,
      aiUsageDetails: aiUsage === 'ASSISTIVE_ONLY' ? String(aiUsageDetails).trim() : null,
      creationSoftware: String(creationSoftware).trim(),
      aiReviewStatus: initialAuthenticityRisk.status,
      aiRiskScore: initialAuthenticityRisk.score,
      aiRiskReasons: JSON.stringify(initialAuthenticityRisk.reasons),
      aiDetectorProvider: '318_METADATA_AUDIT',
      aiDetectorVersion: '1.0',
      aiSuspectedModel: null,
      aiAnalyzedAt: new Date(),
      aiAdminNote: null,
      aiEvidenceRequestedAt: null,
      aiEvidenceCode: null,
      aiEvidenceExpiresAt: null,
    }

    // Un renvoi remplace le beat refusé afin de conserver son historique.
    // Les anciennes enchères annulées sont recréées avec les nouveaux paramètres.
    if (rejectedBeat) {
      await prisma.auction.deleteMany({ where: { beatId: rejectedBeat.id } })
    }

    const beat = rejectedBeat
      ? await prisma.beat.update({
          where: { id: rejectedBeat.id },
          data: beatData,
          include: {
            producer: {
              select: { name: true, displayName: true },
            },
          },
        })
      : await prisma.beat.create({
          data: beatData,
          include: {
            producer: {
              select: { name: true, displayName: true },
            },
          },
        })

    // ─── Création de l'enchère si demandée ───
    let auction = null
    if (isAuction) {
      const now = new Date()
      const durationHours = auctionDuration || 24
      // Enchere programmee : demarrage differe si une date future est fournie
      const requestedStart = auctionStartAt ? new Date(auctionStartAt) : null
      const startTime =
        requestedStart &&
        !isNaN(requestedStart.getTime()) &&
        requestedStart.getTime() > now.getTime()
          ? requestedStart
          : now
      const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000)

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
          // Toutes les enchères 318 LEGAACY sont des ventes exclusives.
          licenseType: 'EXCLUSIVE',
          premiumMultiplier: premMult,
          exclusiveMultiplier: exclMult,
          startTime: startTime,
          endTime: endTime,
          // L'enchère ne devient visible et ne démarre qu'après validation du beat.
          status: 'PENDING_APPROVAL',
          commissionPercent: 15,
        },
      })
    }

    // Tant que le beat n'est pas validé, seuls les admins sont notifiés.
    try {
      const producerName = user.displayName || user.name

      // Notifier les admins (sauf si c'est un admin qui uploade)
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', id: { not: user.id } },
        select: { id: true, email: true },
      })

      const notifications = [
        ...admins.map((a) => ({
          type: 'NEW_BEAT',
          title: `Beat à valider`,
          message: `${producerName} demande la validation de "${title}" (${genre}, ${bpm} BPM)`,
          link: `/admin?tab=beats&status=PENDING`,
          userId: a.id,
        })),
      ]

      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications })
      }

      if (admins.length === 0) {
        console.error(`[UPLOAD] Aucun compte ADMIN trouvé pour alerter sur le beat ${beat.id}`)
      }

      // Sur Vercel, les tâches lancées sans await peuvent être interrompues dès
      // que la réponse HTTP est renvoyée. On attend donc réellement l'email et
      // la notification téléphone avant de terminer la requête.
      const adminEmailResults = await Promise.all(
        admins
          .filter((admin) => Boolean(admin.email))
          .map((admin) =>
            sendAdminNewBeatEmail({
              adminEmail: admin.email,
              producerName: producerName || 'Producteur',
              beatTitle: title,
              genre,
              bpm,
            })
          )
      )
      const failedAdminEmails = adminEmailResults.filter((result) => !result.success)
      if (failedAdminEmails.length > 0) {
        console.error(
          `[UPLOAD] ${failedAdminEmails.length}/${adminEmailResults.length} email(s) admin non livré(s) pour le beat ${beat.id}`
        )
      }

      await sendNtfy('Beat à valider', `${producerName || 'Un producteur'} a envoyé « ${title} »`)
    } catch (notifErr) {
      console.error('[UPLOAD] Erreur notification admin:', String(notifErr))
    }

    // Envoyer email de confirmation d'upload au producteur
    if (user.email) {
      const confirmationResult = await sendBeatUploadConfirmationEmail({
        to: user.email,
        producerName: user.displayName || user.name || 'Producteur',
        beatTitle: title,
        genre,
        bpm: bpmNum,
        hasAuction: !!auction,
        auctionStartPrice: startPrice,
        auctionDuration: auctionDuration,
      })
      if (!confirmationResult.success) {
        console.warn(`[UPLOAD] Email de confirmation non livré pour le beat ${beat.id}`)
      }
    }

    return NextResponse.json(
      {
        success: true,
        beat,
        auction,
        message: 'Beat envoyé avec succès. Il sera mis en ligne après validation par 318 LEGAACY.',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Erreur lors de l'upload:", error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
