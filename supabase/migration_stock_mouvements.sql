-- Migration : stock central au niveau entreprise + traçabilité des mouvements (entrée/sortie vers chantier)
-- À exécuter une seule fois dans le SQL editor de Supabase.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. materiaux_stock : passer d'un stock par chantier à un stock par entreprise
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE materiaux_stock ADD COLUMN IF NOT EXISTS entreprise_id UUID REFERENCES entreprises(id) ON DELETE CASCADE;

UPDATE materiaux_stock ms
SET entreprise_id = c.entreprise_id
FROM chantiers c
WHERE ms.chantier_id = c.id AND ms.entreprise_id IS NULL;

-- Fusionner les matériaux en double (même nom, même entreprise) en une seule ligne de stock central
WITH doublons AS (
  SELECT
    entreprise_id,
    lower(trim(nom)) AS nom_norm,
    (array_agg(id ORDER BY id))[1]                     AS id_garde,
    (array_agg(nom ORDER BY id))[1]                     AS nom_ref,
    (array_agg(unite ORDER BY id))[1]                   AS unite_ref,
    SUM(COALESCE(quantite_stock, 0))                    AS qte_totale,
    MIN(COALESCE(quantite_min, 0))                      AS seuil_min,
    CASE WHEN SUM(COALESCE(quantite_stock, 0)) > 0
      THEN SUM(COALESCE(quantite_stock, 0) * COALESCE(prix_unitaire, 0)) / SUM(COALESCE(quantite_stock, 0))
      ELSE MAX(COALESCE(prix_unitaire, 0))
    END AS prix_moyen
  FROM materiaux_stock
  WHERE entreprise_id IS NOT NULL
  GROUP BY entreprise_id, lower(trim(nom))
)
UPDATE materiaux_stock ms
SET
  nom            = d.nom_ref,
  unite          = d.unite_ref,
  quantite_stock = d.qte_totale,
  quantite_min   = d.seuil_min,
  prix_unitaire  = d.prix_moyen,
  chantier_id    = NULL
FROM doublons d
WHERE ms.id = d.id_garde;

-- Supprimer les lignes fusionnées (doublons autres que la ligne conservée)
DELETE FROM materiaux_stock ms
USING materiaux_stock autre
WHERE ms.entreprise_id = autre.entreprise_id
  AND lower(trim(ms.nom)) = lower(trim(autre.nom))
  AND ms.id <> autre.id
  AND ms.id > autre.id;

-- Le stock n'appartient plus à un chantier précis
ALTER TABLE materiaux_stock ALTER COLUMN entreprise_id SET NOT NULL;
ALTER TABLE materiaux_stock DROP COLUMN IF EXISTS chantier_id;

DROP POLICY IF EXISTS "materiaux_policy" ON materiaux_stock;
CREATE POLICY "materiaux_policy" ON materiaux_stock
FOR ALL USING (entreprise_id = get_entreprise_id());

-- ─────────────────────────────────────────────────────────────────────────
-- 2. mouvements_stock : journal immuable des entrées/sorties
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mouvements_stock (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  entreprise_id  UUID        NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  materiau_id    UUID        NOT NULL REFERENCES materiaux_stock(id) ON DELETE CASCADE,
  chantier_id    UUID        REFERENCES chantiers(id) ON DELETE SET NULL,
  type           TEXT        NOT NULL CHECK (type IN ('entree', 'sortie')),
  quantite       NUMERIC     NOT NULL CHECK (quantite > 0),
  prix_unitaire  NUMERIC,
  motif          TEXT,
  fournisseur    TEXT,
  created_by     UUID        REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mouvements_stock_materiau  ON mouvements_stock(materiau_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_chantier  ON mouvements_stock(chantier_id);

ALTER TABLE mouvements_stock ENABLE ROW LEVEL SECURITY;

-- Journal : on peut consulter et créer, jamais modifier ni supprimer
DROP POLICY IF EXISTS "mouvements_stock_select" ON mouvements_stock;
CREATE POLICY "mouvements_stock_select" ON mouvements_stock
FOR SELECT USING (entreprise_id = get_entreprise_id());

DROP POLICY IF EXISTS "mouvements_stock_insert" ON mouvements_stock;
CREATE POLICY "mouvements_stock_insert" ON mouvements_stock
FOR INSERT WITH CHECK (entreprise_id = get_entreprise_id());
