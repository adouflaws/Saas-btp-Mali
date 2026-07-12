-- ============================================================
-- FONCTION get_next_document_number — version robuste
-- Utilise MAX (pas COUNT) + boucle anti-collision
-- À exécuter dans Supabase > SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION get_next_document_number(
  p_entreprise_id UUID,
  p_type          TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix  TEXT;
  v_max_seq INTEGER := 0;
  v_seq     INTEGER;
  v_numero  TEXT;
  v_exists  BOOLEAN;
BEGIN
  -- Préfixe selon le type
  v_prefix := CASE p_type
    WHEN 'devis'   THEN 'DEV'
    WHEN 'facture' THEN 'FAC'
    ELSE UPPER(LEFT(p_type, 3))
  END;

  -- MAX du numéro séquentiel déjà utilisé pour cette entreprise
  -- (résistant aux suppressions / trous de séquence)
  IF p_type = 'devis' THEN
    SELECT COALESCE(MAX(
      CASE WHEN numero ~ ('^' || v_prefix || '-[0-9]+$')
           THEN (substring(numero FROM '[0-9]+$'))::INTEGER
           ELSE 0 END
    ), 0) INTO v_max_seq
    FROM devis
    WHERE entreprise_id = p_entreprise_id;

  ELSIF p_type = 'facture' THEN
    SELECT COALESCE(MAX(
      CASE WHEN numero ~ ('^' || v_prefix || '-[0-9]+$')
           THEN (substring(numero FROM '[0-9]+$'))::INTEGER
           ELSE 0 END
    ), 0) INTO v_max_seq
    FROM factures
    WHERE entreprise_id = p_entreprise_id;

  ELSE
    RAISE EXCEPTION 'Type invalide : %. Valeurs acceptées : devis, facture', p_type;
  END IF;

  -- Trouver le premier numéro libre (boucle anti-collision)
  v_seq := v_max_seq + 1;
  LOOP
    v_numero := v_prefix || '-' || LPAD(v_seq::TEXT, 3, '0');

    IF p_type = 'devis' THEN
      SELECT EXISTS(
        SELECT 1 FROM devis
        WHERE entreprise_id = p_entreprise_id AND numero = v_numero
      ) INTO v_exists;
    ELSE
      SELECT EXISTS(
        SELECT 1 FROM factures
        WHERE entreprise_id = p_entreprise_id AND numero = v_numero
      ) INTO v_exists;
    END IF;

    EXIT WHEN NOT v_exists;
    v_seq := v_seq + 1;
  END LOOP;

  RETURN v_numero;
END;
$$;

-- ── Test rapide (remplacez l'UUID par le vôtre si besoin) ──
-- SELECT get_next_document_number(
--   (SELECT entreprise_id FROM profiles WHERE id = auth.uid() LIMIT 1),
--   'devis'
-- );
-- SELECT get_next_document_number(
--   (SELECT entreprise_id FROM profiles WHERE id = auth.uid() LIMIT 1),
--   'facture'
-- );
