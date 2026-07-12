-- Correctif : la table mouvements_stock a été créée sans la contrainte de clé
-- étrangère materiau_id -> materiaux_stock(id) (vérifié : un INSERT avec un
-- materiau_id inexistant était accepté). Résultat : PostgREST ne trouve pas la
-- relation et l'embed "materiaux_stock(nom, unite)" utilisé par l'onglet
-- Matériaux de la fiche chantier échoue avec PGRST200
-- ("Could not find a relationship between 'mouvements_stock' and 'materiaux_stock'").
--
-- Ce script est idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mouvements_stock_materiau_id_fkey'
  ) THEN
    ALTER TABLE mouvements_stock
      ADD CONSTRAINT mouvements_stock_materiau_id_fkey
      FOREIGN KEY (materiau_id) REFERENCES materiaux_stock(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

ALTER TABLE mouvements_stock
  VALIDATE CONSTRAINT mouvements_stock_materiau_id_fkey;

-- Forcer PostgREST à recharger son cache de schéma pour reconnaître la relation
NOTIFY pgrst, 'reload schema';
