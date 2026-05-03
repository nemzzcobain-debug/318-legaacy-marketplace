-- Ajout des champs pour soft delete et unsubscribe
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "unsubscribeToken" TEXT;

-- Index unique sur unsubscribeToken
CREATE UNIQUE INDEX "User_unsubscribeToken_key" ON "User"("unsubscribeToken");
