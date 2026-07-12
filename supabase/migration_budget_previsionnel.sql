-- Amélioration C : budget prévisionnel généré depuis les devis acceptés
-- À exécuter dans le SQL editor de Supabase AVANT de déployer le code.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Catégorie sur les lignes de devis (nécessaire pour ventiler le budget
--    prévisionnel par catégorie — matériaux / main d'œuvre / divers)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE lignes_devis ADD COLUMN IF NOT EXISTS categorie TEXT NOT NULL DEFAULT 'materiaux';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lignes_devis_categorie_check'
  ) THEN
    ALTER TABLE lignes_devis
      ADD CONSTRAINT lignes_devis_categorie_check
      CHECK (categorie IN ('materiaux', 'main_oeuvre', 'divers'));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. budget_previsionnel
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS budget_previsionnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id),
  chantier_id UUID NOT NULL REFERENCES chantiers(id),
  devis_id UUID REFERENCES devis(id) ON DELETE CASCADE,
  categorie TEXT NOT NULL,
  description TEXT NOT NULL,
  montant_prevu NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE budget_previsionnel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "budget_prev_select" ON budget_previsionnel;
CREATE POLICY "budget_prev_select"
ON budget_previsionnel FOR SELECT
USING (entreprise_id = get_entreprise_id());

DROP POLICY IF EXISTS "budget_prev_insert" ON budget_previsionnel;
CREATE POLICY "budget_prev_insert"
ON budget_previsionnel FOR INSERT
WITH CHECK (entreprise_id = get_entreprise_id());

DROP POLICY IF EXISTS "budget_prev_update" ON budget_previsionnel;
CREATE POLICY "budget_prev_update"
ON budget_previsionnel FOR UPDATE
USING (entreprise_id = get_entreprise_id());

DROP POLICY IF EXISTS "budget_prev_delete" ON budget_previsionnel;
CREATE POLICY "budget_prev_delete"
ON budget_previsionnel FOR DELETE
USING (entreprise_id = get_entreprise_id());

CREATE INDEX IF NOT EXISTS idx_budget_prev_chantier ON budget_previsionnel(chantier_id);
CREATE INDEX IF NOT EXISTS idx_budget_prev_devis ON budget_previsionnel(devis_id);
