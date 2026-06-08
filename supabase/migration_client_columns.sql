-- Étape 1 : Ajouter les colonnes client sur la table factures
-- Exécuter dans l'éditeur SQL Supabase

ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_nom TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_telephone TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_email TEXT;

-- Optionnel : ajouter client_email sur chantiers si elle n'existe pas encore
ALTER TABLE chantiers ADD COLUMN IF NOT EXISTS client_email TEXT;

-- Rétro-remplissage : copier client_nom et client_telephone depuis chantiers
UPDATE factures f
SET
  client_nom       = c.client_nom,
  client_telephone = c.client_telephone,
  client_email     = c.client_email
FROM chantiers c
WHERE f.chantier_id = c.id
  AND (f.client_nom IS NULL OR f.client_telephone IS NULL);

-- ─────────────────────────────────────────────────────────
-- MINI-PORTAIL CLIENT
-- ─────────────────────────────────────────────────────────

-- Étape 3 : portail_actif sur chantiers
ALTER TABLE chantiers ADD COLUMN IF NOT EXISTS portail_actif BOOLEAN DEFAULT TRUE;

-- Étape 4 : table photos du chantier
CREATE TABLE IF NOT EXISTS photos_chantier (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id   UUID        NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  entreprise_id UUID        REFERENCES entreprises(id),
  url           TEXT        NOT NULL,
  nom           TEXT,
  legende       TEXT,
  prise_le      TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_photos_chantier_id ON photos_chantier(chantier_id);

-- Étape 5 : Storage bucket (à créer manuellement dans Supabase > Storage)
--   Nom du bucket : photos-chantier   ← SANS 's' à la fin
--   Public : OUI (pour que les URLs soient accessibles sans auth)

-- Étape 6 : RLS – lecture publique pour le portail
-- Permet à un visiteur non authentifié de lire un chantier actif par son ID
ALTER TABLE chantiers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE taches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE jalons         ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos_chantier ENABLE ROW LEVEL SECURITY;

-- Politique lecture publique chantier (portail_actif)
DROP POLICY IF EXISTS "portail_public_read_chantier" ON chantiers;
CREATE POLICY "portail_public_read_chantier" ON chantiers
  FOR SELECT USING (portail_actif = TRUE);

-- Politique lecture publique tâches liées à un chantier actif
DROP POLICY IF EXISTS "portail_public_read_taches" ON taches;
CREATE POLICY "portail_public_read_taches" ON taches
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM chantiers c WHERE c.id = chantier_id AND c.portail_actif = TRUE)
  );

-- Politique lecture publique jalons
DROP POLICY IF EXISTS "portail_public_read_jalons" ON jalons;
CREATE POLICY "portail_public_read_jalons" ON jalons
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM chantiers c WHERE c.id = chantier_id AND c.portail_actif = TRUE)
  );

-- Politique lecture publique photos
DROP POLICY IF EXISTS "portail_public_read_photos" ON photos_chantier;
CREATE POLICY "portail_public_read_photos" ON photos_chantier
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM chantiers c WHERE c.id = chantier_id AND c.portail_actif = TRUE)
  );

-- Politique écriture photos (utilisateur authentifié de l'entreprise)
DROP POLICY IF EXISTS "auth_insert_photos" ON photos_chantier;
CREATE POLICY "auth_insert_photos" ON photos_chantier
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_delete_photos" ON photos_chantier;
CREATE POLICY "auth_delete_photos" ON photos_chantier
  FOR DELETE USING (auth.role() = 'authenticated');
