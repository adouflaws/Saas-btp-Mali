-- ============================================================
-- Lecture publique restreinte de "entreprises" pour le portail client
-- ============================================================
-- Constat : la policy "entreprises_select_policy" (fix_entreprises_rls.sql)
-- n'autorise la lecture que si id = get_entreprise_id(), qui vaut NULL pour
-- un visiteur anonyme du portail (/portail/[chantier_id]). Résultat :
-- entreprises.nom / telephone restent invisibles publiquement, y compris
-- pour le bouton "Contacter [entreprise] sur WhatsApp" et le sous-titre
-- entreprise du header du portail.
--
-- Plutôt qu'une policy RLS large sur toute la table "entreprises" (qui
-- exposerait aussi rccm, nif, statut_abonnement, date_fin_abonnement, email...
-- à quiconque interroge la table directement via l'API REST avec la clé anon),
-- on expose une vue restreinte à 3 colonnes, filtrée sur les entreprises
-- ayant au moins un chantier à portail actif. La table "entreprises" elle-
-- même n'est pas accordée à anon : seule la vue l'est.
-- ============================================================

CREATE OR REPLACE VIEW entreprises_portail_public AS
SELECT e.id, e.nom, e.telephone
FROM entreprises e
WHERE EXISTS (
  SELECT 1 FROM chantiers c
  WHERE c.entreprise_id = e.id AND c.portail_actif = TRUE
);

GRANT SELECT ON entreprises_portail_public TO anon;
GRANT SELECT ON entreprises_portail_public TO authenticated;
