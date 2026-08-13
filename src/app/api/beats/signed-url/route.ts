export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { enforceProducerStripeAccess } from '@/lib/producer-stripe-access';
import { createClient } from '@supabase/supabase-js';

const PRIVATE_BEAT_BUCKET = 'beat-files';
const PUBLIC_PREVIEW_BUCKET = 'beat-previews';

// F10 FIX: Protection path traversal — nettoyer les noms de fichiers
function sanitizeFileName(name: string): string {
  // Extraire uniquement le nom de fichier (pas de chemin)
  const baseName = name.split('/').pop()?.split('\\').pop() || name;
  // Supprimer les caractères dangereux, garder alphanumériques, tirets, underscores, points
  return baseName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '.');
}

function buildPrivateObjectUrl(supabaseUrl: string, bucket: string, path: string): string {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`;
}

/**
 * Génère des signed URLs pour uploader directement vers Supabase Storage
 * Permet de contourner la limite de 4.5MB de Vercel
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: session.user?.id ? { id: session.user.id } : { email: session.user?.email || '' }
    });

    if (!user || (user.role !== 'PRODUCER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Seuls les producteurs peuvent uploader' },
        { status: 403 }
      );
    }

    const producerAccess = await enforceProducerStripeAccess(user);
    if (!producerAccess.allowed) {
      return NextResponse.json(
        {
          error: producerAccess.message,
          code: producerAccess.status,
          actionUrl:
            producerAccess.status === 'stripe_suspended'
              ? '/dashboard?tab=settings'
              : undefined,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const pendingCount =
      user.role === 'ADMIN'
        ? 0
        : await prisma.beat.count({
            where: {
              producerId: user.id,
              status: 'PENDING',
              ...(body.editBeatId ? { id: { not: body.editBeatId } } : {}),
            },
          });
    if (pendingCount >= 3) {
      return NextResponse.json(
        {
          error:
            'Tu as déjà 3 beats en attente de validation. Attends une décision avant un nouvel envoi.',
          code: 'PENDING_BEAT_LIMIT',
        },
        { status: 409 }
      );
    }

    const { audioContentType, coverContentType, wavContentType, stems } = body;
    let { audioFileName, coverFileName, wavFileName } = body;

    if (!audioFileName || !audioContentType) {
      return NextResponse.json(
        { error: 'audioFileName et audioContentType requis' },
        { status: 400 }
      );
    }

    audioFileName = sanitizeFileName(audioFileName);
    if (coverFileName) coverFileName = sanitizeFileName(coverFileName);
    if (wavFileName) wavFileName = sanitizeFileName(wavFileName);

    // F4 FIX: Scoper les chemins au répertoire de l'utilisateur authentifié
    const timestamp = Date.now();
    const previewBaseName = audioFileName.replace(/\.[^/.]+$/, '');
    const previewPath = `${user.id}/previews/${timestamp}_${previewBaseName}_preview_60s.wav`;
    const audioOriginalPath = `${user.id}/originals/${timestamp}_${audioFileName}`;
    const userScopedCoverPath = coverFileName ? `${user.id}/${timestamp}_${coverFileName}` : null;
    const userScopedWavPath = wavFileName ? `${user.id}/wav/${timestamp}_${wavFileName}` : null;

    // Validate MIME type for audio uploads
    const allowedAudioMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/mp4', 'audio/x-wav', 'application/octet-stream'];
    if (!allowedAudioMimes.includes(audioContentType)) {
      return NextResponse.json(
        { error: 'Type MIME audio invalide. Types acceptes: ' + allowedAudioMimes.join(', ') },
        { status: 400 }
      );
    }

    // F4 FIX: Validate cover MIME type if provided
    if (coverContentType) {
      const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedImageMimes.includes(coverContentType)) {
        return NextResponse.json(
          { error: 'Type MIME image invalide. Types acceptes: ' + allowedImageMimes.join(', ') },
          { status: 400 }
        );
      }
    }

    // Créer un client Supabase avec la service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // L'aperçu de 60 secondes est public. Le MP3 complet reste privé.
    const { data: previewSignedUrl, error: previewError } = await supabase.storage
      .from(PUBLIC_PREVIEW_BUCKET)
      .createSignedUploadUrl(previewPath);

    if (previewError) {
      console.error('Signed URL preview error:', previewError);
      return NextResponse.json(
        { error: 'Erreur serveur' },
        { status: 500 }
      );
    }

    const { data: originalSignedUrl, error: originalError } = await supabase.storage
      .from(PRIVATE_BEAT_BUCKET)
      .createSignedUploadUrl(audioOriginalPath);

    if (originalError) {
      console.error('Signed URL original error:', originalError);
      return NextResponse.json(
        { error: 'Erreur serveur' },
        { status: 500 }
      );
    }

    // Générer signed URL pour la cover si demandée — chemin scopé à l'utilisateur
    let coverSignedUrl = null;
    if (userScopedCoverPath && coverContentType) {
      const { data: coverData, error: coverError } = await supabase.storage
        .from('covers')
        .createSignedUploadUrl(userScopedCoverPath);

      if (!coverError && coverData) {
        coverSignedUrl = coverData;
      }
    }

    // Générer signed URL pour le WAV si fourni
    let wavSignedUrl = null;
    if (userScopedWavPath && wavContentType) {
      const allowedWavMimes = ['audio/wav', 'audio/x-wav', 'audio/wave'];
      if (!allowedWavMimes.includes(wavContentType)) {
        return NextResponse.json(
          { error: 'Le fichier WAV doit être au format WAV' },
          { status: 400 }
        );
      }
      const { data: wavData, error: wavError } = await supabase.storage
        .from(PRIVATE_BEAT_BUCKET)
        .createSignedUploadUrl(userScopedWavPath);
      if (!wavError && wavData) {
        wavSignedUrl = wavData;
      }
    }

    // Générer signed URLs pour les stems individuels
    const stemsSignedUrls: Array<{ name: string; signedUrl: string; path: string; privateUrl: string }> = [];
    if (stems && Array.isArray(stems) && stems.length > 0) {
      const allowedStemMimes = ['audio/wav', 'audio/x-wav', 'audio/wave', 'application/zip'];
      const zipCount = stems.filter((stem) => stem.contentType === 'application/zip').length;

      if (stems.length > 30) {
        return NextResponse.json(
          { error: 'Maximum 30 fichiers WAV ou un fichier ZIP pour les stems' },
          { status: 400 }
        );
      }
      if (zipCount > 0 && stems.length > 1) {
        return NextResponse.json(
          { error: 'Choisissez soit un seul fichier ZIP, soit des fichiers WAV individuels' },
          { status: 400 }
        );
      }

      for (const stem of stems) {
        if (!stem.name || !allowedStemMimes.includes(stem.contentType)) {
          return NextResponse.json(
            { error: 'Les stems doivent être des fichiers WAV ou un fichier ZIP' },
            { status: 400 }
          );
        }
        const stemName = sanitizeFileName(stem.name);
        const stemPath = `${user.id}/stems/${timestamp}_${stemName}`;
        const { data: stemData, error: stemError } = await supabase.storage
          .from(PRIVATE_BEAT_BUCKET)
          .createSignedUploadUrl(stemPath);
        if (!stemError && stemData) {
          stemsSignedUrls.push({
            name: stem.name,
            signedUrl: stemData.signedUrl,
            path: stemData.path,
            privateUrl: buildPrivateObjectUrl(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              PRIVATE_BEAT_BUCKET,
              stemPath
            ),
          });
        }
      }
    }

    // Seul l'aperçu et la cover possèdent une URL publique.
    const { data: previewPublicData } = supabase.storage
      .from(PUBLIC_PREVIEW_BUCKET)
      .getPublicUrl(previewPath);
    let coverPublicUrl = null;
    if (userScopedCoverPath) {
      const { data: coverPublicData } = supabase.storage.from('covers').getPublicUrl(userScopedCoverPath);
      coverPublicUrl = coverPublicData.publicUrl;
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    return NextResponse.json({
      preview: {
        signedUrl: previewSignedUrl.signedUrl,
        token: previewSignedUrl.token,
        path: previewSignedUrl.path,
        publicUrl: previewPublicData.publicUrl,
      },
      audioOriginal: {
        signedUrl: originalSignedUrl.signedUrl,
        token: originalSignedUrl.token,
        path: originalSignedUrl.path,
        privateUrl: buildPrivateObjectUrl(supabaseUrl, PRIVATE_BEAT_BUCKET, audioOriginalPath),
      },
      cover: coverSignedUrl ? {
        signedUrl: coverSignedUrl.signedUrl,
        token: coverSignedUrl.token,
        path: coverSignedUrl.path,
        publicUrl: coverPublicUrl,
      } : null,
      wav: wavSignedUrl ? {
        signedUrl: wavSignedUrl.signedUrl,
        token: wavSignedUrl.token,
        path: wavSignedUrl.path,
        privateUrl: buildPrivateObjectUrl(supabaseUrl, PRIVATE_BEAT_BUCKET, userScopedWavPath!),
      } : null,
      stems: stemsSignedUrls.length > 0 ? stemsSignedUrls : null,
    });

  } catch (error) {
    console.error('Erreur signed URL:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
