-- Délai de grâce Stripe Connect pour les beatmakers approuvés.
-- À exécuter une seule fois dans Supabase SQL Editor avant le déploiement du code.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "producerApprovedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "stripeGraceSuspendedAt" TIMESTAMP(3);

-- Les beatmakers déjà approuvés disposent eux aussi de 7 jours à partir
-- de l'installation de cette règle pour finaliser Stripe Connect.
UPDATE "User"
SET "producerApprovedAt" = CURRENT_TIMESTAMP
WHERE "role" = 'PRODUCER'
  AND "producerStatus" = 'APPROVED'
  AND "producerApprovedAt" IS NULL;
