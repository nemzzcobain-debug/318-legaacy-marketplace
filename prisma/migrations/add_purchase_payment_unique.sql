-- Un même paiement Stripe ne peut être rattaché qu'à un seul achat.
-- Filet de sécurité base, indépendant de l'idempotence applicative du webhook.
-- (Plusieurs lignes NULL restent autorisées par PostgreSQL.)
CREATE UNIQUE INDEX IF NOT EXISTS "Purchase_stripePaymentId_key" ON "Purchase"("stripePaymentId");
DROP INDEX IF EXISTS "Purchase_stripePaymentId_idx";
