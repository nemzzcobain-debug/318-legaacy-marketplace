-- Détection audio IA IRCAM Amplify.
-- Ces champs restent indépendants du score comportemental/métadonnées.
ALTER TABLE "Beat"
  ADD COLUMN IF NOT EXISTS "aiAudioProbability" INTEGER,
  ADD COLUMN IF NOT EXISTS "aiAudioDetectorProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "aiAudioDetectorVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "aiAudioSuspectedModel" TEXT,
  ADD COLUMN IF NOT EXISTS "aiAudioSuspectedVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "aiAudioScanStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN IF NOT EXISTS "aiAudioScanJobId" TEXT,
  ADD COLUMN IF NOT EXISTS "aiAudioScanError" TEXT,
  ADD COLUMN IF NOT EXISTS "aiAudioScannedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Beat_aiAudioScanStatus_idx"
  ON "Beat"("aiAudioScanStatus");
