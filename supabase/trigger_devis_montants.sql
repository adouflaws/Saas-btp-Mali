-- Supprimer les contraintes GENERATED si présentes
ALTER TABLE devis ALTER COLUMN montant_ht  DROP EXPRESSION IF EXISTS;
ALTER TABLE devis ALTER COLUMN montant_tva DROP EXPRESSION IF EXISTS;
ALTER TABLE devis ALTER COLUMN montant_ttc DROP EXPRESSION IF EXISTS;

-- Fonction trigger
CREATE OR REPLACE FUNCTION calculate_devis_montants()
RETURNS TRIGGER AS $$
BEGIN
  NEW.montant_ht  := COALESCE(NEW.montant_ht, 0);
  NEW.montant_tva := ROUND(NEW.montant_ht * 0.18);
  NEW.montant_ttc := NEW.montant_ht + NEW.montant_tva;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_montants_trigger ON devis;

CREATE TRIGGER calculate_montants_trigger
BEFORE INSERT OR UPDATE ON devis
FOR EACH ROW
EXECUTE FUNCTION calculate_devis_montants();
