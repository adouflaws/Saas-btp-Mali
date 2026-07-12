-- Table des tarifs personnalisés par entreprise
-- Colonne "prix" (pas "prix_unitaire") pour correspondre au code TypeScript

CREATE TABLE IF NOT EXISTS tarifs_personnalises (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  entreprise_id   UUID        REFERENCES entreprises(id) ON DELETE CASCADE,
  designation     TEXT        NOT NULL,
  prix            BIGINT      NOT NULL DEFAULT 0,
  unite           TEXT        DEFAULT 'unite',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tarifs_personnalises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tarifs_personnalises_policy"
ON tarifs_personnalises FOR ALL
USING (entreprise_id = get_entreprise_id());
