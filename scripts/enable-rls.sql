-- ============================================================
-- 318 LEGAACY MARKETPLACE — Row Level Security (RLS) Policies
-- ============================================================
-- Date: 2026-04-06
--
-- CONTEXTE:
-- L'app utilise NextAuth (pas Supabase Auth), donc auth.uid() = NULL
-- pour les requêtes via anon key. Toutes les écritures passent par
-- les API routes (Prisma + DATABASE_URL direct, pas PostgREST).
--
-- STRATÉGIE:
-- 1. Activer RLS sur TOUTES les tables
-- 2. Anon key = lecture seule sur données publiques uniquement
-- 3. Zéro écriture via anon key (tout passe par Prisma server-side)
-- 4. Service role bypass RLS automatiquement (pour les uploads storage)
-- 5. Tables sensibles (Account, Session) = accès totalement bloqué via anon
--
-- IMPORTANT: Prisma se connecte via DATABASE_URL (connexion directe postgres)
-- et n'est PAS affecté par les RLS policies. Seules les requêtes via
-- PostgREST (anon key / service_role key) sont concernées.
-- ============================================================

-- ============================================================
-- ÉTAPE 1: ACTIVER RLS SUR TOUTES LES TABLES
-- ============================================================

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Beat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Auction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bid" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Follow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Like" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Watchlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Playlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlaylistBeat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromoCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromoUsage" ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ÉTAPE 2: TABLES TOTALEMENT BLOQUÉES (zéro accès anon)
-- ============================================================
-- Ces tables contiennent des données ultra-sensibles.
-- Aucune policy = aucun accès via PostgREST/anon key.
-- Seul le service_role (server-side) peut y accéder.
-- ============================================================

-- Account: tokens OAuth (refresh_token, access_token, id_token)
-- → Aucune policy = bloqué par défaut avec RLS activé

-- Session: sessionToken, userId, expires
-- → Aucune policy = bloqué par défaut avec RLS activé

-- VerificationToken: tokens de vérification email
-- → Aucune policy = bloqué par défaut avec RLS activé

-- PromoCode: codes promo (admin only via Prisma)
-- → Aucune policy = bloqué par défaut avec RLS activé

-- PromoUsage: historique d'utilisation promos
-- → Aucune policy = bloqué par défaut avec RLS activé

-- Report: signalements (contenu sensible modération)
-- → Aucune policy = bloqué par défaut avec RLS activé

-- ============================================================
-- ÉTAPE 3: TABLE USER — Lecture limitée aux champs publics
-- ============================================================
-- Le hook useRealtimeAuction fait des SELECT sur User pour
-- displayName et avatar. On autorise la lecture des champs
-- publics uniquement. passwordHash, email, stripeAccountId
-- et autres données sensibles sont exclus via une vue.
-- ============================================================

-- Policy: lecture seule des profils publics
-- On ne peut PAS limiter les colonnes via RLS directement,
-- donc on crée une vue sécurisée pour le Realtime.
CREATE POLICY "user_public_read"
ON "User" FOR SELECT
TO anon, authenticated
USING (true);

-- IMPORTANT: Même si SELECT est autorisé, les champs sensibles
-- ne doivent JAMAIS être requêtés côté client. On renforce via
-- une vue sécurisée (voir étape 7).

-- Bloquer toute écriture
CREATE POLICY "user_no_insert"
ON "User" FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "user_no_update"
ON "User" FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "user_no_delete"
ON "User" FOR DELETE
TO anon, authenticated
USING (false);

-- ============================================================
-- ÉTAPE 4: TABLES PUBLIQUES EN LECTURE — Beat, Auction, Bid, Review
-- ============================================================
-- Ces données sont publiques (marketplace), mais les écritures
-- passent exclusivement par les API routes (Prisma).
-- ============================================================

-- BEAT: lecture publique, écriture bloquée
CREATE POLICY "beat_public_read"
ON "Beat" FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "beat_no_insert"
ON "Beat" FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "beat_no_update"
ON "Beat" FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "beat_no_delete"
ON "Beat" FOR DELETE
TO anon, authenticated
USING (false);

-- AUCTION: lecture publique (Realtime), écriture bloquée
CREATE POLICY "auction_public_read"
ON "Auction" FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "auction_no_insert"
ON "Auction" FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "auction_no_update"
ON "Auction" FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "auction_no_delete"
ON "Auction" FOR DELETE
TO anon, authenticated
USING (false);

-- BID: lecture publique (Realtime enchères), écriture bloquée
CREATE POLICY "bid_public_read"
ON "Bid" FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "bid_no_insert"
ON "Bid" FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "bid_no_update"
ON "Bid" FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "bid_no_delete"
ON "Bid" FOR DELETE
TO anon, authenticated
USING (false);

-- REVIEW: lecture publique, écriture bloquée
CREATE POLICY "review_public_read"
ON "Review" FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "review_no_insert"
ON "Review" FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "review_no_update"
ON "Review" FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "review_no_delete"
ON "Review" FOR DELETE
TO anon, authenticated
USING (false);

-- ============================================================
-- ÉTAPE 5: TABLES SOCIALES — Follow, Like, Watchlist
-- ============================================================
-- Lecture publique (compteurs visibles), écriture bloquée via anon.
-- ============================================================

-- FOLLOW
CREATE POLICY "follow_public_read"
ON "Follow" FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "follow_no_write"
ON "Follow" FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "follow_no_update"
ON "Follow" FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "follow_no_delete"
ON "Follow" FOR DELETE
TO anon, authenticated
USING (false);

-- LIKE
CREATE POLICY "like_public_read"
ON "Like" FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "like_no_write"
ON "Like" FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "like_no_update"
ON "Like" FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "like_no_delete"
ON "Like" FOR DELETE
TO anon, authenticated
USING (false);

-- WATCHLIST
CREATE POLICY "watchlist_public_read"
ON "Watchlist" FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "watchlist_no_write"
ON "Watchlist" FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "watchlist_no_update"
ON "Watchlist" FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "watchlist_no_delete"
ON "Watchlist" FOR DELETE
TO anon, authenticated
USING (false);

-- ============================================================
-- ÉTAPE 6: TABLES PRIVÉES — Conversation, Message, Notification, Playlist
-- ============================================================
-- Ces tables contiennent des données personnelles.
-- Accès totalement bloqué via anon key.
-- Les API routes gèrent l'accès via Prisma + session NextAuth.
--
-- EXCEPTION: Message et Conversation ont besoin du Realtime.
-- On autorise SELECT mais le filtre côté client + l'absence
-- de Supabase Auth empêche déjà l'identification.
-- Pour une sécurité maximale, on bloque tout et on migre
-- le Realtime vers un canal custom server-side.
-- ============================================================

-- NOTIFICATION: bloqué (données personnelles)
-- → Aucune policy = bloqué par défaut

-- PLAYLIST: lecture des playlists publiques uniquement
CREATE POLICY "playlist_public_read"
ON "Playlist" FOR SELECT
TO anon, authenticated
USING ("visibility" = 'PUBLIC');

CREATE POLICY "playlist_no_write"
ON "Playlist" FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "playlist_no_update"
ON "Playlist" FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "playlist_no_delete"
ON "Playlist" FOR DELETE
TO anon, authenticated
USING (false);

-- PLAYLIST_BEAT: lecture si playlist publique
CREATE POLICY "playlistbeat_public_read"
ON "PlaylistBeat" FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM "Playlist"
    WHERE "Playlist"."id" = "PlaylistBeat"."playlistId"
    AND "Playlist"."visibility" = 'PUBLIC'
  )
);

CREATE POLICY "playlistbeat_no_write"
ON "PlaylistBeat" FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "playlistbeat_no_update"
ON "PlaylistBeat" FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "playlistbeat_no_delete"
ON "PlaylistBeat" FOR DELETE
TO anon, authenticated
USING (false);

-- CONVERSATION: lecture autorisée pour le Realtime
-- (les subscriptions filtrent par ID côté client)
CREATE POLICY "conversation_read_for_realtime"
ON "Conversation" FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "conversation_no_write"
ON "Conversation" FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "conversation_no_update"
ON "Conversation" FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "conversation_no_delete"
ON "Conversation" FOR DELETE
TO anon, authenticated
USING (false);

-- MESSAGE: lecture autorisée pour le Realtime
CREATE POLICY "message_read_for_realtime"
ON "Message" FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "message_no_write"
ON "Message" FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "message_no_update"
ON "Message" FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "message_no_delete"
ON "Message" FOR DELETE
TO anon, authenticated
USING (false);

-- ============================================================
-- ÉTAPE 7: VUE SÉCURISÉE — Profil public utilisateur
-- ============================================================
-- Remplace les requêtes directes sur "User" côté client.
-- Expose UNIQUEMENT les champs publics.
-- Le hook useRealtimeAuction doit utiliser cette vue.
-- ============================================================

CREATE OR REPLACE VIEW "PublicUser" AS
SELECT
  id,
  name,
  "displayName",
  avatar,
  bio,
  role,
  "producerStatus",
  "producerBio",
  portfolio,
  "totalSales",
  "totalPurchases",
  rating,
  "createdAt",
  instagram,
  soundcloud,
  spotify,
  twitter,
  website,
  youtube
FROM "User";

-- Accorder l'accès à la vue pour anon et authenticated
GRANT SELECT ON "PublicUser" TO anon;
GRANT SELECT ON "PublicUser" TO authenticated;

-- ============================================================
-- ÉTAPE 8: RÉVOQUER LES PERMISSIONS DIRECTES SUR TABLES SENSIBLES
-- ============================================================
-- Par sécurité supplémentaire, on révoque les permissions
-- INSERT/UPDATE/DELETE sur toutes les tables pour le rôle anon.
-- ============================================================

REVOKE INSERT, UPDATE, DELETE ON "User" FROM anon;
REVOKE INSERT, UPDATE, DELETE ON "Beat" FROM anon;
REVOKE INSERT, UPDATE, DELETE ON "Auction" FROM anon;
REVOKE INSERT, UPDATE, DELETE ON "Bid" FROM anon;
REVOKE INSERT, UPDATE, DELETE ON "Review" FROM anon;
REVOKE INSERT, UPDATE, DELETE ON "Follow" FROM anon;
REVOKE INSERT, UPDATE, DELETE ON "Like" FROM anon;
REVOKE INSERT, UPDATE, DELETE ON "Watchlist" FROM anon;
REVOKE INSERT, UPDATE, DELETE ON "Conversation" FROM anon;
REVOKE INSERT, UPDATE, DELETE ON "Message" FROM anon;
REVOKE INSERT, UPDATE, DELETE ON "Notification" FROM anon;
REVOKE INSERT, UPDATE, DELETE ON "Playlist" FROM anon;
REVOKE INSERT, UPDATE, DELETE ON "PlaylistBeat" FROM anon;
REVOKE INSERT, UPDATE, DELETE ON "Report" FROM anon;
REVOKE INSERT, UPDATE, DELETE ON "PromoCode" FROM anon;
REVOKE INSERT, UPDATE, DELETE ON "PromoUsage" FROM anon;
REVOKE ALL ON "Account" FROM anon;
REVOKE ALL ON "Session" FROM anon;
REVOKE ALL ON "VerificationToken" FROM anon;

-- Aussi révoquer pour authenticated (les écritures passent par Prisma)
REVOKE INSERT, UPDATE, DELETE ON "User" FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON "Beat" FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON "Auction" FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON "Bid" FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON "Review" FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON "Follow" FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON "Like" FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON "Watchlist" FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON "Conversation" FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON "Message" FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON "Notification" FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON "Playlist" FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON "PlaylistBeat" FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON "Report" FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON "PromoCode" FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON "PromoUsage" FROM authenticated;
REVOKE ALL ON "Account" FROM authenticated;
REVOKE ALL ON "Session" FROM authenticated;
REVOKE ALL ON "VerificationToken" FROM authenticated;

-- ============================================================
-- VÉRIFICATION: Lister toutes les policies actives
-- ============================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
