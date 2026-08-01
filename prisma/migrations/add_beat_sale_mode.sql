-- Sépare définitivement les ventes exclusives aux enchères des ventes en leasing.
-- Migration additive : aucun beat ni aucune vente existante n'est supprimé.

ALTER TABLE "Beat"
ADD COLUMN IF NOT EXISTS "saleMode" TEXT NOT NULL DEFAULT 'AUCTION';

CREATE INDEX IF NOT EXISTS "Beat_saleMode_status_idx"
ON "Beat"("saleMode", "status");
