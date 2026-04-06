-- ============================================================
-- 318 LEGAACY Marketplace — Database Indexes Migration
-- Date: 6 Avril 2026
-- Purpose: Add indexes on all foreign keys and frequently
--          queried columns to prevent full table scans
-- ============================================================

-- ─── USER ───
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User" ("role");
CREATE INDEX IF NOT EXISTS "User_producerStatus_idx" ON "User" ("producerStatus");

-- ─── ACCOUNT ───
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account" ("userId");

-- ─── SESSION ───
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session" ("userId");

-- ─── BEAT ───
CREATE INDEX IF NOT EXISTS "Beat_producerId_idx" ON "Beat" ("producerId");
CREATE INDEX IF NOT EXISTS "Beat_status_idx" ON "Beat" ("status");
CREATE INDEX IF NOT EXISTS "Beat_genre_idx" ON "Beat" ("genre");

-- ─── AUCTION ───
CREATE INDEX IF NOT EXISTS "Auction_beatId_idx" ON "Auction" ("beatId");
CREATE INDEX IF NOT EXISTS "Auction_status_endTime_idx" ON "Auction" ("status", "endTime");
CREATE INDEX IF NOT EXISTS "Auction_winnerId_idx" ON "Auction" ("winnerId");
CREATE INDEX IF NOT EXISTS "Auction_status_idx" ON "Auction" ("status");

-- ─── BID ───
CREATE INDEX IF NOT EXISTS "Bid_auctionId_idx" ON "Bid" ("auctionId");
CREATE INDEX IF NOT EXISTS "Bid_userId_idx" ON "Bid" ("userId");
CREATE INDEX IF NOT EXISTS "Bid_auctionId_createdAt_idx" ON "Bid" ("auctionId", "createdAt");

-- ─── REVIEW ───
CREATE INDEX IF NOT EXISTS "Review_producerId_idx" ON "Review" ("producerId");
CREATE INDEX IF NOT EXISTS "Review_authorId_idx" ON "Review" ("authorId");

-- ─── NOTIFICATION ───
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification" ("userId");
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification" ("userId", "read");

-- ─── CONVERSATION ───
CREATE INDEX IF NOT EXISTS "Conversation_user1Id_idx" ON "Conversation" ("user1Id");
CREATE INDEX IF NOT EXISTS "Conversation_user2Id_idx" ON "Conversation" ("user2Id");
CREATE INDEX IF NOT EXISTS "Conversation_lastMessageAt_idx" ON "Conversation" ("lastMessageAt");

-- ─── MESSAGE ───
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx" ON "Message" ("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON "Message" ("senderId");

-- ─── REPORT ───
CREATE INDEX IF NOT EXISTS "Report_reporterId_idx" ON "Report" ("reporterId");
CREATE INDEX IF NOT EXISTS "Report_status_idx" ON "Report" ("status");

-- ─── PLAYLIST ───
CREATE INDEX IF NOT EXISTS "Playlist_userId_idx" ON "Playlist" ("userId");
CREATE INDEX IF NOT EXISTS "Playlist_visibility_idx" ON "Playlist" ("visibility");

-- ============================================================
-- Total: 25 new indexes
-- ============================================================
