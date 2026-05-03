-- Migration: Add beat licensing fields (WAV, Stems, Pricing)
-- These fields support the 3-tier license system (MP3/WAV/Stems)

-- Stems files JSON storage (individual stem WAV files metadata)
ALTER TABLE "Beat" ADD COLUMN IF NOT EXISTS "stemsFiles" TEXT;

-- License pricing (EUR)
ALTER TABLE "Beat" ADD COLUMN IF NOT EXISTS "priceMp3" DOUBLE PRECISION;
ALTER TABLE "Beat" ADD COLUMN IF NOT EXISTS "priceWav" DOUBLE PRECISION;
ALTER TABLE "Beat" ADD COLUMN IF NOT EXISTS "priceStems" DOUBLE PRECISION;
