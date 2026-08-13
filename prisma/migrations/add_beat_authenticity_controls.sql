-- Contrôle d'authenticité des instrumentales et journal d'administration.
-- Migration additive : aucune donnée existante n'est supprimée.

ALTER TABLE "Beat"
  ADD COLUMN IF NOT EXISTS "aiDeclarationVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "aiDeclarationAcceptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "aiUsage" TEXT,
  ADD COLUMN IF NOT EXISTS "aiUsageDetails" TEXT,
  ADD COLUMN IF NOT EXISTS "creationSoftware" TEXT,
  ADD COLUMN IF NOT EXISTS "aiReviewStatus" TEXT NOT NULL DEFAULT 'NOT_ANALYZED',
  ADD COLUMN IF NOT EXISTS "aiRiskScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "aiRiskReasons" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "aiDetectorProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "aiDetectorVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "aiSuspectedModel" TEXT,
  ADD COLUMN IF NOT EXISTS "aiAnalyzedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "aiAdminNote" TEXT,
  ADD COLUMN IF NOT EXISTS "aiEvidenceRequestedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Beat_aiReviewStatus_idx"
ON "Beat"("aiReviewStatus");

CREATE TABLE IF NOT EXISTS "AdminActionLog" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "details" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AdminActionLog" ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS "AdminActionLog_adminId_createdAt_idx"
ON "AdminActionLog"("adminId", "createdAt");

CREATE INDEX IF NOT EXISTS "AdminActionLog_targetType_targetId_idx"
ON "AdminActionLog"("targetType", "targetId");
