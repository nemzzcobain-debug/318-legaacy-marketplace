import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadFile, getPublicUrl } from '@/lib/supabase';

const ALLOWED_AUDIO = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav', 'audio/wave'];
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * Endpoint d'upload de beats
 * Uploads les fichiers audio et cover vers Supabase Storage
 * Crée une entrée beat dans la base de données
 */
export async function POST(req: NextRequest) {
  try {
    // Vérification de l'authentification
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Non connecte' },
        { status: 401 }
      );
    }

    // Récupération et vérification du rôle utilisateur
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email || '' }
    });

    if (!user || (user.role !== 'PRODUCER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Seuls les producteurs peuvent uploader des beats' },
        { status: 403 }
      );
    }

    if (user.role === 'PRODUCER' && user.producerStatus !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Votre compte producteur doit etre approuve' },
        { status: 403 }
      );
    }

    // Extraction des données du formulaire
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const title = formData.get('title') as string;
    const genre = formData.get('genre') as string;
    const bpm = parseInt(formData.get('bpm') as string);
    const key = formData.get('key') as string || null;
    const mood = formData.get('mood') as string || null;
    const description = formData.get('description') as string || null;
    const tags = formData.get('tags') as string || '[]';
    const coverFile = formData.get('cover') as File | null;

    // Validations des champs requis
    if (!audioFile || !title || !genre || !bpm) {
      return NextResponse.json(
        { error: 'Champs requis: audio, titre, genre, BPM' },
        { status: 400 }
      );
    }

    // Validation du format audio
    if (!ALLOWED_AUDIO.includes(audioFile.type)) {
      return NextResponse.json(
        { error: 'Format audio non supporte. Utilise MP3 ou WAV.' },
        { status: 400 }
      );
    }

    // Validation de la taille du fichier
    if (audioFile.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Le fichier ne doit pas depasser 50 MB' },
        { status: 400 }
      );
    }

    // Génération de noms de fichier uniques avec timestamp
    const timestamp = Date.now();
    const audioExt = audioFile.name.split('.').pop() || 'mp3';
    const audioFileName = `${timestamp}-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.${audioExt}`;

    // Upload du fichier audio vers Supabase
    try {
      const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
      await uploadFile('beats', audioFileName, audioBuffer, audioFile.type);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error('Erreur upload audio:', message);
      return NextResponse.json(
        { error: `Impossible d'uploader le fichier audio: ${message}` },
        { status: 500 }
      );
    }

    // Obtenir l'URL publique du fichier audio
    const audioUrl = getPublicUrl('beats', audioFileName);

    // Upload de la cover image si fournie
    let coverUrl: string | null = null;
    if (coverFile && coverFile.size > 0) {
      try {
        const coverExt = coverFile.name.split('.').pop() || 'jpg';
        const coverFileName = `${timestamp}-cover.${coverExt}`;
        const coverBuffer = Buffer.from(await coverFile.arrayBuffer());

        await uploadFile('covers', coverFileName, coverBuffer, coverFile.type);
        coverUrl = getPublicUrl('covers', coverFileName);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur inconnue';
        console.error('Erreur upload cover:', message);
        // On continue même si la cover échoue, ce n'est pas critique
      }
    }

    // Calcul approximatif de la durée basé sur la taille du fichier
    // Estimation: ~128kbps pour MP3
    const estimatedDuration = Math.round(audioFile.size / 16000);

    // Création de l'entrée beat dans la base de données
    const beat = await prisma.beat.create({
      data: {
        title,
        description,
        audioUrl,
        genre,
        bpm,
        key,
        mood,
        tags,
        coverImage: coverUrl,
        duration: estimatedDuration,
        status: 'ACTIVE',
        producerId: user.id,
      },
      include: {
        producer: {
          select: { name: true, displayName: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      beat,
      message: 'Beat uploade avec succes!'
    }, { status: 201 });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('Erreur lors de l\'upload:', message);
    return NextResponse.json(
      { error: 'Erreur lors de l\'upload' },
      { status: 500 }
    );
  }
}
