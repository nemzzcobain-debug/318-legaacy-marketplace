-- ============================================
-- Activer Supabase Realtime sur les tables Chat
-- ============================================
-- Exécuter ce script dans Supabase SQL Editor
-- (Dashboard > SQL Editor > New Query)

-- Ajouter les tables Message et Conversation à la publication Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE "Message";
ALTER PUBLICATION supabase_realtime ADD TABLE "Conversation";

-- Vérifier que les tables sont bien dans la publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
