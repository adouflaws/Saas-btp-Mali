import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { entreprise_id, plan, mois } = await req.json()

    console.log('Activation:', { entreprise_id, plan, mois })

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      ?.replace(/^﻿/, '')
      ?.trim()

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey!
    )

    const date_fin = new Date()
    date_fin.setMonth(date_fin.getMonth() + Number(mois))

    const { data, error } = await supabaseAdmin
      .from('entreprises')
      .update({
        statut_abonnement: 'actif',
        plan: plan,
        date_fin_abonnement: date_fin.toISOString().split('T')[0],
      })
      .eq('id', entreprise_id)
      .select()

    console.log('Résultat update:', data)
    console.log('Erreur update:', error)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('Erreur serveur:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
