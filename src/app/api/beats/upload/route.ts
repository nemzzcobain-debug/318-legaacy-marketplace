import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const ALLOWED_AUDIO = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav', 'audio/wave'];
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non connecte' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user?.email || '' }
    });

    if (!user || (user.role !== 'PRODUCER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Seuls les producteurs peuvent uploader des beats' }, { status: 403 });
    }

    if (user.role === 'PRODUCER' && user.producerStatus !== 'APPROVED') {
      return NextResponse.json({ error: 'Votre compte producteur doit etre approuve' }, { status: 403 });
    }

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

    // Validations
    if (!audioFile || !title || !genre || !bpm) {
      return NextResponse.json({ error: 'Champs requis: audio, titre, genre, BPM' }, { status: 400 });
    }

    if (!ALLOWED_AUDIO.includes(audioFile.type)) {
      return NextResponse.json({ error: 'Format audio non supporte. Utilise MP3 ou WAV.' }, { status: 400 });
    }

    if (audioFile.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Le fichier ne doit pas depasser 50 MB' }, { status: 400 });
    }

    // Create uploads directory
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'beats');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Save audio file
    const timestamp = Date.now();
    const audioExt = audioFile.name.split('.').pop() || 'mp3';
    const audioFileName = `${timestamp}-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.${audioExt}`;
    const audioPath = path.join(uploadsDir, audioFileName);
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    await writeFile(audioPath, audioBuffer);
    const audioUrl = `/uploads/beats/${audioFileName}`;

    // Save cover image if provided
    let coverUrl: string | null = null;
    if (coverFile && coverFile.size > 0) {
      const coversDir = path.join(process.cwd(), 'public', 'uploads', 'covers');
      if (!existsSync(coversDir)) {
        await mkdir(coversDir, { recursive: true });
      }
      const coverExt = coverFile.name.split('.').pop() || 'jpg';
      const coverFileName = `${timestamp}-cover.${coverExt}`;
      const coverPath = path.join(coversDir, coverFileName);
      const coverBuffer = Buffer.from(await coverFile.arrayBuffer());
      await writeFile(coverPath, coverBuffer);
      coverUrl = `/uploads/covers/${coverFileName}`;
    }

    // Calculate approximate duration from file size (rough estimate for MP3)
    const estimatedDuration = Math.round(audioFile.size / 16000); // ~128kbps

    // Create beat in database
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
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Erreur lors de l\'upload' }, { status: 500 });
  }
}
