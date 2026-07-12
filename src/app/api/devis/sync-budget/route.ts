import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { devis_id, forceClear } = await req.json()
    if (!devis_id) return NextResponse.json({ error: 'devis_id manquant' }, { status: 400 })

    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
      ?.replace(/^﻿/, '')
      ?.trim()
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey!)

    const { data: devis, error: devisError } = await supabaseAdmin
      .from('devis')
      .select('id, entreprise_id, chantier_id, statut')
      .eq('id', devis_id)
      .single()

    if (devisError || !devis) {
      return NextResponse.json({ error: devisError?.message ?? 'Devis introuvable' }, { status: 404 })
    }

    // Toujours repartir de zéro pour ce devis : régénération idempotente
    const { error: delError } = await supabaseAdmin.from('budget_previsionnel').delete().eq('devis_id', devis_id)
    if (delError) return NextResponse.json({ error: delError.message }, { status: 400 })

    if (forceClear || devis.statut !== 'accepte' || !devis.chantier_id) {
      return NextResponse.json({ success: true, action: 'cleared' })
    }

    const { data: lignes, error: lignesError } = await supabaseAdmin
      .from('lignes_devis')
      .select('designation, categorie, quantite, prix_unit, total')
      .eq('devis_id', devis_id)

    if (lignesError) return NextResponse.json({ error: lignesError.message }, { status: 400 })
    if (!lignes || lignes.length === 0) return NextResponse.json({ success: true, action: 'no_lignes' })

    const rows = lignes.map(l => ({
      entreprise_id: devis.entreprise_id,
      chantier_id: devis.chantier_id,
      devis_id: devis.id,
      categorie: l.categorie ?? 'materiaux',
      description: l.designation,
      montant_prevu: l.total ?? Math.round((l.quantite ?? 0) * (l.prix_unit ?? 0)),
    }))

    const { error: insError } = await supabaseAdmin.from('budget_previsionnel').insert(rows)
    if (insError) return NextResponse.json({ error: insError.message }, { status: 400 })

    return NextResponse.json({ success: true, action: 'generated', count: rows.length })
  } catch (err) {
    console.error('Erreur sync-budget:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
