-- Code de challenge unique pour les demandes de preuve anti-IA.
-- Migration additive : aucune donnée existante n'est supprimée.

ALTER TABLE "Beat"
  ADD COLUMN IF NOT EXISTS "aiEvidenceCode" TEXT,
  ADD COLUMN IF NOT EXISTS "aiEvidenceExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Beat_aiEvidenceCode_key"
ON "Beat"("aiEvidenceCode");
