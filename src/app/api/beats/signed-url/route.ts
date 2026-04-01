export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

/**
 * Génère des signed URLs pour uploader directement vers Supabase Storage
 * Permet de contourner la limite de 4.5MB de Vercel
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non connecte' }, { status: 401 });
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
        { error: 'Votre compte producteur doit etre approuve' },
        { status: 403 }
      );
    }

    const { audioFileName, audioContentType, coverFileName, coverContentType } = await req.json();

    if (!audioFileName || !audioContentType) {
      return NextResponse.json(
        { error: 'audioFileName et audioContentType requis' },
        { status: 400 }
      );
    }

    // Validate MIME type for audio uploads
    const allowedAudioMimes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/mp4', 'audio/x-wav'];
    if (!allowedAudioMimes.includes(audioContentType)) {
      return NextResponse.json(
        { error: 'Type MIME audio invalide. Types acceptes: ' + allowedAudioMimes.join(', ') },
        { status: 400 }
      );
    }

    // Créer un client Supabase avec la service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Générer signed URL pour l'audio (valide 10 minutes)
    const { data: audioSignedUrl, error: audioError } = await supabase.storage
      .from('beats')
      .createSignedUploadUrl(audioFileName);

    if (audioError) {
      console.error('Signed URL audio error:', audioError);
      return NextResponse.json(
        { error: 'Erreur serveur' },
        { status: 500 }
      );
    }

    // Générer signed URL pour la cover si demandée
    let coverSignedUrl = null;
    if (coverFileName && coverContentType) {
      const { data: coverData, error: coverError } = await supabase.storage
        .from('covers')
        .createSignedUploadUrl(coverFileName);

      if (!coverError && coverData) {
        coverSignedUrl = coverData;
      }
    }

    // Obtenir les URLs publiques
    const { data: audioPublicData } = supabase.storage.from('beats').getPublicUrl(audioFileName);
    let coverPublicUrl = null;
    if (coverFileName) {
      const { data: coverPublicData } = supabase.storage.from('covers').getPublicUrl(coverFileName);
      coverPublicUrl = coverPublicData.publicUrl;
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
    });

  } catch (error) {
    console.error('Erreur signed URL:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
