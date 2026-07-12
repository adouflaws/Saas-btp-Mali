-- Amélioration E : nécessaire pour calculer la "Trésorerie encaissée ce mois"
-- et l'activité "Facture payée" sur le dashboard — factures n'avait aucune
-- colonne indiquant QUAND un paiement a eu lieu (seulement le montant cumulé
-- montant_paye). Sans elle, impossible de savoir si l'argent a été encaissé
-- ce mois-ci ou un mois précédent.

ALTER TABLE factures ADD COLUMN IF NOT EXISTS date_paiement TIMESTAMPTZ;

