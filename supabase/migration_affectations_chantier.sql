-- Amélioration D : affectation des ouvriers par chantier
-- À exécuter dans le SQL editor de Supabase AVANT de tester.
--
-- Note : le prompt fait référence à une table "employes", mais dans ce projet
-- les ouvriers sont stockés dans la table "ouvriers" (utilisée par paie,
-- pointage, avances, bibliothèque de devis…). La FK et la colonne ci-dessous
-- ont été adaptées en conséquence (ouvrier_id -> ouvriers(id)).

CREATE TABLE IF NOT EXISTS affectations_chantier (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id UUID NOT NULL REFERENCES entreprises(id),
  chantier_id UUID NOT NULL REFERENCES chantiers(id),
  ouvrier_id UUID NOT NULL REFERENCES ouvriers(id),
  date_debut DATE NOT NULL DEFAULT CURRENT_DATE,
  date_fin DATE,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(chantier_id, ouvrier_id, date_debut)
);

ALTER TABLE affectations_chantier ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "affect_select" ON affectations_chantier;
CREATE POLICY "affect_select"
ON affectations_chantier FOR SELECT
USING (entreprise_id = get_entreprise_id());

DROP POLICY IF EXISTS "affect_insert" ON affectations_chantier;
CREATE POLICY "affect_insert"
ON affectations_chantier FOR INSERT
WITH CHECK (entreprise_id = get_entreprise_id());

DROP POLICY IF EXISTS "affect_update" ON affectations_chantier;
CREATE POLICY "affect_update"
ON affectations_chantier FOR UPDATE
USING (entreprise_id = get_entreprise_id());

DROP POLICY IF EXISTS "affect_delete" ON affectations_chantier;
CREATE POLICY "affect_delete"
ON affectations_chantier FOR DELETE
USING (entreprise_id = get_entreprise_id());

CREATE INDEX IF NOT EXISTS idx_affect_chantier ON affectations_chantier(chantier_id);
CREATE INDEX IF NOT EXISTS idx_affect_ouvrier ON affectations_chantier(ouvrier_id);
