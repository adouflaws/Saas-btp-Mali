-- ============================================================
-- DIAGNOSTIC + CORRECTION RLS TABLE ENTREPRISES
-- Exécuter dans Supabase > SQL Editor
-- ============================================================

-- ── ÉTAPE 1 : Diagnostic ─────────────────────────────────
-- Vérifier si RLS est activé sur entreprises
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'entreprises';

-- Vérifier les policies existantes sur entreprises
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'entreprises';

-- Vérifier les colonnes de la table entreprises
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'entreprises'
ORDER BY ordinal_position;

-- ── ÉTAPE 2 : Correction ─────────────────────────────────
-- Activer RLS (sans risque si déjà activé)
ALTER TABLE entreprises ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "entreprises_policy"        ON entreprises;
DROP POLICY IF EXISTS "entreprises_select_policy" ON entreprises;
DROP POLICY IF EXISTS "entreprises_update_policy" ON entreprises;
DROP POLICY IF EXISTS "entreprises_insert_policy" ON entreprises;
DROP POLICY IF EXISTS "entreprises_delete_policy" ON entreprises;

-- SELECT : un utilisateur voit seulement son entreprise
CREATE POLICY "entreprises_select_policy" ON entreprises
FOR SELECT USING (id = get_entreprise_id());

-- UPDATE : un utilisateur peut modifier seulement son entreprise
CREATE POLICY "entreprises_update_policy" ON entreprises
FOR UPDATE USING (id = get_entreprise_id());

-- INSERT : autorisé lors de l'onboarding (pas de contrainte d'ownership)
CREATE POLICY "entreprises_insert_policy" ON entreprises
FOR INSERT WITH CHECK (true);

-- DELETE : protégé
CREATE POLICY "entreprises_delete_policy" ON entreprises
FOR DELETE USING (id = get_entreprise_id());

-- ── ÉTAPE 3 : Vérification après correction ───────────────
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'entreprises';
