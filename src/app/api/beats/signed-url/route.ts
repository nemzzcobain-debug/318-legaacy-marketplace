export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

// F10 FIX: Protection path traversal — nettoyer les noms de fichiers
function sanitizeFileName(name: string): string {
  // Extraire uniquement le nom de fichier (pas de chemin)
  const baseName = name.split('/').pop()?.split('\\').pop() || name;
  // Supprimer les caractères dangereux, garder alphanumériques, tirets, underscores, points
  return baseName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '.');
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

    if (user.role === 'PRODUCER' && user.producerStatus !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Votre compte producteur doit être approuvé' },
        { status: 403 }
      );
    }

    const body = await req.json();
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
    const userScopedAudioPath = `${user.id}/${timestamp}_${audioFileName}`;
    const userScopedCoverPath = coverFileName ? `${user.id}/${timestamp}_${coverFileName}` : null;
    const userScopedWavPath = wavFileName ? `${user.id}/${timestamp}_${wavFileName}` : null;

    // Validate MIME type for audio uploads
    const allowedAudioMimes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/mp4', 'audio/x-wav'];
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

    // Générer signed URL pour l'audio (valide 10 minutes) — chemin scopé à l'utilisateur
    const { data: audioSignedUrl, error: audioError } = await supabase.storage
      .from('beats')
      .createSignedUploadUrl(userScopedAudioPath);

    if (audioError) {
      console.error('Signed URL audio error:', audioError);
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
        .from('beats')
        .createSignedUploadUrl(userScopedWavPath);
      if (!wavError && wavData) {
        wavSignedUrl = wavData;
      }
    }

    // Générer signed URLs pour les stems individuels
    let stemsSignedUrls: Array<{ name: string; signedUrl: string; path: string; publicUrl: string }> = [];
    if (stems && Array.isArray(stems) && stems.length > 0) {
      for (const stem of stems) {
        const stemName = sanitizeFileName(stem.name);
        const stemPath = `${user.id}/stems/${timestamp}_${stemName}`;
        const { data: stemData, error: stemError } = await supabase.storage
          .from('beats')
          .createSignedUploadUrl(stemPath);
        if (!stemError && stemData) {
          const { data: stemPublic } = supabase.storage.from('beats').getPublicUrl(stemPath);
          stemsSignedUrls.push({
            name: stem.name,
            signedUrl: stemData.signedUrl,
            path: stemData.path,
            publicUrl: stemPublic.publicUrl,
          });
        }
      }
    }

    // Obtenir les URLs publiques (chemins scopés)
    const { data: audioPublicData } = supabase.storage.from('beats').getPublicUrl(userScopedAudioPath);
    let coverPublicUrl = null;
    if (userScopedCoverPath) {
      const { data: coverPublicData } = supabase.storage.from('covers').getPublicUrl(userScopedCoverPath);
      coverPublicUrl = coverPublicData.publicUrl;
    }
    let wavPublicUrl = null;
    if (userScopedWavPath) {
      const { data: wavPublicData } = supabase.storage.from('beats').getPublicUrl(userScopedWavPath);
      wavPublicUrl = wavPublicData.publicUrl;
    }

    return NextResponse.json({
      audio: {
        signedUrl: audioSignedUrl.signedUrl,
        token: audioSignedUrl.token,
        path: audioSignedUrl.path,
        publicUrl: audioPublicData.publicUrl,
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
        publicUrl: wavPublicUrl,
      } : null,
      stems: stemsSignedUrls.length > 0 ? stemsSignedUrls : null,
    });

  } catch (error) {
    console.error('Erreur signed URL:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
