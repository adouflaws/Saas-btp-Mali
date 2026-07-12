-- ============================================================
-- FIX : Contrainte UNIQUE globale sur numero → par entreprise
--
-- PROBLÈME ROOT CAUSE :
--   devis.numero avait UNIQUE global → si l'entreprise A a
--   déjà DEV-001, l'entreprise B ne peut pas créer DEV-001.
--   La fonction retourne bien DEV-001 (table vide pour B),
--   mais l'INSERT échoue en 23505 à chaque tentative.
--
-- SOLUTION : Contrainte composite (entreprise_id, numero)
--   → chaque entreprise a sa propre séquence indépendante.
-- ============================================================

-- ── 1. TABLE devis ──────────────────────────────────────────

-- Supprimer l'ancienne contrainte globale (noms possibles)
ALTER TABLE devis DROP CONSTRAINT IF EXISTS devis_numero_key;
ALTER TABLE devis DROP CONSTRAINT IF EXISTS devis_numero_unique;
ALTER TABLE devis DROP CONSTRAINT IF EXISTS uq_devis_numero;

-- Supprimer si déjà créée (idempotent)
ALTER TABLE devis DROP CONSTRAINT IF EXISTS devis_numero_entreprise_unique;

-- Ajouter la contrainte composite correcte
ALTER TABLE devis
  ADD CONSTRAINT devis_numero_entreprise_unique
  UNIQUE (entreprise_id, numero);

-- ── 2. TABLE factures ───────────────────────────────────────

-- Supprimer l'ancienne contrainte globale
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_numero_key;
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_numero_unique;
ALTER TABLE factures DROP CONSTRAINT IF EXISTS uq_factures_numero;

-- Supprimer si déjà créée (idempotent)
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_numero_entreprise_unique;

-- Ajouter la contrainte composite correcte
ALTER TABLE factures
  ADD CONSTRAINT factures_numero_entreprise_unique
  UNIQUE (entreprise_id, numero);

-- ── 3. Vérification ─────────────────────────────────────────
-- Exécuter séparément pour confirmer les nouvelles contraintes :
--
-- SELECT tc.table_name, tc.constraint_name, kcu.column_name
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name
-- WHERE tc.constraint_type = 'UNIQUE'
--   AND tc.table_name IN ('devis', 'factures')
-- ORDER BY tc.table_name, kcu.ordinal_position;
