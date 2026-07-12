import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

type FactureRow = {
  numero: string
  statut: string | null
  montant_ttc: number | null
  montant_paye: number | null
  date_echeance: string | null
  date_emission: string | null
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const chantierId = searchParams.get('chantier_id')
    if (!chantierId) return NextResponse.json({ error: 'chantier_id manquant' }, { status: 400 })

    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
      ?.replace(/^﻿/, '')
      ?.trim()
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey!)

    // Le portail doit rester actif pour exposer des données financières,
    // même si cette route bypass la RLS (service role).
    const { data: chantier, error: chantierError } = await supabaseAdmin
      .from('chantiers')
      .select('id, portail_actif')
      .eq('id', chantierId)
      .single()

    if (chantierError || !chantier) {
      return NextResponse.json({ error: 'Chantier introuvable' }, { status: 404 })
    }
    if (chantier.portail_actif === false) {
      return NextResponse.json({ error: 'Portail désactivé' }, { status: 403 })
    }

    const { data: facturesRaw, error: facturesError } = await supabaseAdmin
      .from('factures')
      .select('numero, statut, montant_ttc, montant_paye, date_echeance, date_emission')
      .eq('chantier_id', chantierId)

    if (facturesError) return NextResponse.json({ error: facturesError.message }, { status: 400 })

    const factures = (facturesRaw ?? []) as FactureRow[]

    if (factures.length === 0) {
      return NextResponse.json({ hasData: false })
    }

    const montantTotal = factures.reduce((s, f) => s + (f.montant_ttc ?? 0), 0)
    const dejaPaye = factures.reduce((s, f) => s + (f.montant_paye ?? 0), 0)
    const resteAPayer = Math.max(0, montantTotal - dejaPaye)

    // Prochaine échéance : facture non payée, triée par date_echeance croissante
    // (repli sur date_emission pour les factures sans échéance renseignée).
    const impayees = factures.filter(f => f.statut !== 'paye')
    const prochaine = [...impayees].sort((a, b) => {
      const ka = a.date_echeance ?? a.date_emission ?? '9999-12-31'
      const kb = b.date_echeance ?? b.date_emission ?? '9999-12-31'
      return ka.localeCompare(kb)
    })[0] ?? null

    let prochaineEcheance = null
    if (prochaine) {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const echeanceDate = prochaine.date_echeance ? new Date(prochaine.date_echeance + 'T00:00:00') : null
      const enRetard = !!echeanceDate && echeanceDate < today
      const joursRetard = enRetard && echeanceDate ? Math.floor((today.getTime() - echeanceDate.getTime()) / 86_400_000) : 0

      prochaineEcheance = {
        numero: prochaine.numero,
        montant: Math.max(0, (prochaine.montant_ttc ?? 0) - (prochaine.montant_paye ?? 0)),
        date_echeance: prochaine.date_echeance,
        en_retard: enRetard,
        jours_retard: joursRetard,
      }
    }

    return NextResponse.json({
      hasData: true,
      montant_total: montantTotal,
      deja_paye: dejaPaye,
      reste_a_payer: resteAPayer,
      prochaine_echeance: prochaineEcheance,
    })
  } catch (err) {
    console.error('Erreur portail/finance:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
