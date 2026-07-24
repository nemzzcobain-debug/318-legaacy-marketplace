-- Protection des fichiers audio complets
-- À exécuter dans Supabase SQL Editor avant le déploiement du nouveau flux.

ALTER TABLE "Beat"
ADD COLUMN IF NOT EXISTS "audioOriginal" TEXT;

-- Extraits publics de 60 secondes maximum.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'beat-previews',
  'beat-previews',
  true,
  52428800,
  ARRAY['audio/wav', 'audio/mpeg']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Originaux MP3, WAV et stems. Aucun accès public direct.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'beat-files',
  'beat-files',
  false,
  5368709120,
  ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/flac',
    'audio/aac',
    'audio/mp4',
    'application/octet-stream',
    'application/zip'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
