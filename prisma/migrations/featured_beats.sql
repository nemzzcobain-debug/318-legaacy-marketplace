-- Migration: Add featured beats fields to Beat table
-- Run this in Supabase SQL Editor

ALTER TABLE "Beat" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Beat" ADD COLUMN IF NOT EXISTS "featuredOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Beat" ADD COLUMN IF NOT EXISTS "featuredAt" TIMESTAMP(3);
