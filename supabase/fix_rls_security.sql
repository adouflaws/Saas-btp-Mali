-- ============================================================
-- CORRECTION SÉCURITÉ RLS — BTP MALI
-- À exécuter dans Supabase SQL Editor (une seule fois)
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. FONCTION get_entreprise_id()
--    SECURITY DEFINER = bypass RLS pour lire profiles
--    sans récursion infinie
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_entreprise_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT entreprise_id
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

-- ──────────────────────────────────────────────────────────
-- 2. ACTIVER RLS SUR TOUTES LES TABLES
-- ──────────────────────────────────────────────────────────
ALTER TABLE chantiers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE taches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ouvriers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pointages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis            ENABLE ROW LEVEL SECURITY;
ALTER TABLE lignes_devis     ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures         ENABLE ROW LEVEL SECURITY;
ALTER TABLE depenses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiaux_stock  ENABLE ROW LEVEL SECURITY;
ALTER TABLE jalons           ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pleins_carburant ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos_chantier  ENABLE ROW LEVEL SECURITY;
ALTER TABLE abonnements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE relances         ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────
-- 3. POLICIES PAR TABLE
-- ──────────────────────────────────────────────────────────

-- CHANTIERS
DROP POLICY IF EXISTS "chantiers_policy" ON chantiers;
CREATE POLICY "chantiers_policy" ON chantiers
FOR ALL USING (entreprise_id = get_entreprise_id());
-- Note : portail_public_read_chantier reste actif pour le mini-portail client

-- TACHES
DROP POLICY IF EXISTS "taches_policy" ON taches;
CREATE POLICY "taches_policy" ON taches
FOR ALL USING (
  chantier_id IN (
    SELECT id FROM chantiers
    WHERE entreprise_id = get_entreprise_id()
  )
);

-- OUVRIERS
DROP POLICY IF EXISTS "ouvriers_policy" ON ouvriers;
CREATE POLICY "ouvriers_policy" ON ouvriers
FOR ALL USING (entreprise_id = get_entreprise_id());

-- POINTAGES
DROP POLICY IF EXISTS "pointages_policy" ON pointages;
CREATE POLICY "pointages_policy" ON pointages
FOR ALL USING (
  chantier_id IN (
    SELECT id FROM chantiers
    WHERE entreprise_id = get_entreprise_id()
  )
);

-- DEVIS
DROP POLICY IF EXISTS "devis_policy" ON devis;
CREATE POLICY "devis_policy" ON devis
FOR ALL USING (entreprise_id = get_entreprise_id());

-- LIGNES_DEVIS
DROP POLICY IF EXISTS "lignes_devis_policy" ON lignes_devis;
CREATE POLICY "lignes_devis_policy" ON lignes_devis
FOR ALL USING (
  devis_id IN (
    SELECT id FROM devis
    WHERE entreprise_id = get_entreprise_id()
  )
);

-- FACTURES
DROP POLICY IF EXISTS "factures_policy" ON factures;
CREATE POLICY "factures_policy" ON factures
FOR ALL USING (entreprise_id = get_entreprise_id());

-- DEPENSES
DROP POLICY IF EXISTS "depenses_policy" ON depenses;
CREATE POLICY "depenses_policy" ON depenses
FOR ALL USING (entreprise_id = get_entreprise_id());

-- MATERIAUX_STOCK
DROP POLICY IF EXISTS "materiaux_policy" ON materiaux_stock;
CREATE POLICY "materiaux_policy" ON materiaux_stock
FOR ALL USING (
  chantier_id IN (
    SELECT id FROM chantiers
    WHERE entreprise_id = get_entreprise_id()
  )
);

-- JALONS
DROP POLICY IF EXISTS "jalons_policy" ON jalons;
CREATE POLICY "jalons_policy" ON jalons
FOR ALL USING (
  chantier_id IN (
    SELECT id FROM chantiers
    WHERE entreprise_id = get_entreprise_id()
  )
);

-- VEHICULES
DROP POLICY IF EXISTS "vehicules_policy" ON vehicules;
CREATE POLICY "vehicules_policy" ON vehicules
FOR ALL USING (entreprise_id = get_entreprise_id());

-- PLEINS_CARBURANT
DROP POLICY IF EXISTS "pleins_policy" ON pleins_carburant;
CREATE POLICY "pleins_policy" ON pleins_carburant
FOR ALL USING (entreprise_id = get_entreprise_id());

-- PHOTOS_CHANTIER (4 policies séparées pour garder lecture publique portail)
DROP POLICY IF EXISTS "photos_insert_policy" ON photos_chantier;
DROP POLICY IF EXISTS "photos_update_policy" ON photos_chantier;
DROP POLICY IF EXISTS "photos_delete_policy" ON photos_chantier;
DROP POLICY IF EXISTS "photos_select_policy" ON photos_chantier;
DROP POLICY IF EXISTS "auth_insert_photos"   ON photos_chantier;
DROP POLICY IF EXISTS "auth_delete_photos"   ON photos_chantier;
DROP POLICY IF EXISTS "portail_public_read_photos" ON photos_chantier;

CREATE POLICY "photos_select_policy" ON photos_chantier
FOR SELECT USING (
  entreprise_id = get_entreprise_id()
  OR auth.role() = 'anon'
);

CREATE POLICY "photos_insert_policy" ON photos_chantier
FOR INSERT WITH CHECK (entreprise_id = get_entreprise_id());

CREATE POLICY "photos_update_policy" ON photos_chantier
FOR UPDATE USING (entreprise_id = get_entreprise_id());

CREATE POLICY "photos_delete_policy" ON photos_chantier
FOR DELETE USING (entreprise_id = get_entreprise_id());

-- ABONNEMENTS
DROP POLICY IF EXISTS "abonnements_policy" ON abonnements;
CREATE POLICY "abonnements_policy" ON abonnements
FOR ALL USING (entreprise_id = get_entreprise_id());

-- RELANCES
DROP POLICY IF EXISTS "relances_policy" ON relances;
CREATE POLICY "relances_policy" ON relances
FOR ALL USING (entreprise_id = get_entreprise_id());

-- PROFILES
-- SELECT/UPDATE : son propre profil OU tout profil de la même entreprise
-- INSERT : uniquement son propre profil (auth.uid() = id)
-- (la création initiale se fait via trigger avec elevated privileges)
DROP POLICY IF EXISTS "profiles_policy" ON profiles;

CREATE POLICY "profiles_select_policy" ON profiles
FOR SELECT USING (
  id = auth.uid()
  OR entreprise_id = get_entreprise_id()
);

CREATE POLICY "profiles_insert_policy" ON profiles
FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_policy" ON profiles
FOR UPDATE USING (
  id = auth.uid()
  OR entreprise_id = get_entreprise_id()
);

-- ──────────────────────────────────────────────────────────
-- 4. VÉRIFICATION FINALE
--    Exécuter séparément pour voir l'état des policies
-- ──────────────────────────────────────────────────────────
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;
