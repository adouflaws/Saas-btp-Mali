-- Correctif : la migration précédente (migration_stock_mouvements.sql) n'a été appliquée
-- que partiellement. Constat en base (vérifié via service role) :
--   - materiaux_stock : chantier_id supprimé, MAIS entreprise_id jamais ajouté
--     → l'ancienne policy "materiaux_policy" référence encore chantier_id (colonne inexistante)
--       => toute requête sur materiaux_stock échoue avec "column materiaux_stock.chantier_id does not exist"
--   - mouvements_stock : table créée, mais la colonne "fournisseur" manque
-- Les 2 lignes orphelines de test (Ciment Portland, Fer à béton) ont déjà été supprimées
-- (décision utilisateur) car aucun mouvement n'y était rattaché.
--
-- Ce script est idempotent : il peut être exécuté plusieurs fois sans erreur.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. materiaux_stock : stock central entreprise
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE materiaux_stock ADD COLUMN IF NOT EXISTS entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE;
ALTER TABLE materiaux_stock ALTER COLUMN entreprise_id SET NOT NULL;
ALTER TABLE materiaux_stock DROP COLUMN IF EXISTS chantier_id;

DROP POLICY IF EXISTS "materiaux_policy" ON materiaux_stock;
CREATE POLICY "materiaux_policy" ON materiaux_stock
FOR ALL USING (entreprise_id = get_entreprise_id());

-- ─────────────────────────────────────────────────────────────────────────
-- 2. mouvements_stock : compléter la colonne manquante + policies + index
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE mouvements_stock ADD COLUMN IF NOT EXISTS fournisseur TEXT;

ALTER TABLE mouvements_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mouvements_stock_select" ON mouvements_stock;
CREATE POLICY "mouvements_stock_select" ON mouvements_stock
FOR SELECT USING (entreprise_id = get_entreprise_id());

DROP POLICY IF EXISTS "mouvements_stock_insert" ON mouvements_stock;
CREATE POLICY "mouvements_stock_insert" ON mouvements_stock
FOR INSERT WITH CHECK (entreprise_id = get_entreprise_id());

CREATE INDEX IF NOT EXISTS idx_mouvements_stock_materiau ON mouvements_stock(materiau_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_chantier ON mouvements_stock(chantier_id);
