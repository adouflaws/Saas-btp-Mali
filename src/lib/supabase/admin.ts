import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Client service role — à n'utiliser QUE dans des routes serveur, après avoir
// vérifié soi-même les droits de l'appelant (la RLS est contournée).
export function createAdminClient(): SupabaseClient {
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
    ?.replace(/^﻿/, '')
    ?.trim()
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type SyncResult = { success: true; action: 'cleared' | 'no_lignes' | 'generated'; count?: number } | { success: false; error: string }

// Régénère le budget prévisionnel d'un devis à partir de ses lignes (idempotent).
// Vidé si le devis n'est pas accepté, n'a pas de chantier, ou si forceClear.
export async function syncBudgetPrevisionnel(admin: SupabaseClient, devisId: string, forceClear = false): Promise<SyncResult> {
  const { data: devis, error: devisError } = await admin
    .from('devis')
    .select('id, entreprise_id, chantier_id, statut')
    .eq('id', devisId)
    .single()
  if (devisError || !devis) return { success: false, error: devisError?.message ?? 'Devis introuvable' }

  const { error: delError } = await admin.from('budget_previsionnel').delete().eq('devis_id', devisId)
  if (delError) return { success: false, error: delError.message }

  if (forceClear || devis.statut !== 'accepte' || !devis.chantier_id) return { success: true, action: 'cleared' }

  const { data: lignes, error: lignesError } = await admin
    .from('lignes_devis')
    .select('designation, categorie, quantite, prix_unit, total')
    .eq('devis_id', devisId)
  if (lignesError) return { success: false, error: lignesError.message }
  if (!lignes || lignes.length === 0) return { success: true, action: 'no_lignes' }

  const rows = lignes.map(l => ({
    entreprise_id: devis.entreprise_id,
    chantier_id: devis.chantier_id,
    devis_id: devis.id,
    categorie: l.categorie ?? 'materiaux',
    description: l.designation,
    montant_prevu: l.total ?? Math.round((l.quantite ?? 0) * (l.prix_unit ?? 0)),
  }))
  const { error: insError } = await admin.from('budget_previsionnel').insert(rows)
  if (insError) return { success: false, error: insError.message }
  return { success: true, action: 'generated', count: rows.length }
}
