import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAILS = ['adouflaws@gmail.com']

async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email || !SUPER_ADMIN_EMAILS.includes(user.email)) return null
  return user
}

// Appel REST direct à PostgREST — bypasse RLS via service role key dans les headers
async function supabaseRest(path: string, method: string, body?: unknown) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
    ?.replace(/^﻿/, '')
    ?.trim()

  console.log('REST', method, url)
  console.log('Key définie:', !!key, '| Préfixe:', key?.slice(0, 15))

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'apikey': key!,
      'Prefer': 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { data = text }

  console.log('HTTP status:', res.status)
  console.log('Résultat:', JSON.stringify(data).slice(0, 300))

  return { ok: res.ok, status: res.status, data }
}

export async function POST(request: NextRequest) {
  const user = await verifySuperAdmin()
  if (!user) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await request.json()
  const { action, entreprise_id } = body

  console.log('=== ACTION ADMIN ENTREPRISE ===')
  console.log('Action:', action)
  console.log('Entreprise ID:', entreprise_id)

  if (!entreprise_id) return NextResponse.json({ error: 'entreprise_id requis' }, { status: 400 })

  /* ── Activer abonnement ── */
  if (action === 'activer') {
    const { plan, duree_jours } = body

    console.log('Plan:', plan)
    console.log('Durée (jours):', duree_jours)

    const dateFin = new Date(Date.now() + duree_jours * 86400000)
    const dateFinStr = dateFin.toISOString().split('T')[0]

    const { ok, data } = await supabaseRest(
      `entreprises?id=eq.${entreprise_id}`,
      'PATCH',
      { statut_abonnement: 'actif', plan, date_fin_abonnement: dateFinStr }
    )

    if (!ok) {
      const msg = typeof data === 'object' && data !== null && 'message' in data
        ? String((data as Record<string, unknown>).message)
        : JSON.stringify(data)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    return NextResponse.json({ success: true, date_fin: dateFinStr })
  }

  /* ── Offrir des jours ── */
  if (action === 'jours') {
    const { nb_jours } = body

    console.log('Nb jours:', nb_jours)

    const { data: getResult } = await supabaseRest(
      `entreprises?id=eq.${entreprise_id}&select=date_fin_abonnement`,
      'GET'
    )

    const ent = Array.isArray(getResult) ? getResult[0] : null
    const base = ent?.date_fin_abonnement
      ? new Date(Math.max(new Date(ent.date_fin_abonnement).getTime(), Date.now()))
      : new Date()
    const newDate = new Date(base.getTime() + nb_jours * 86400000).toISOString().split('T')[0]

    const { ok, data } = await supabaseRest(
      `entreprises?id=eq.${entreprise_id}`,
      'PATCH',
      { date_fin_abonnement: newDate, statut_abonnement: 'essai' }
    )

    if (!ok) {
      const msg = typeof data === 'object' && data !== null && 'message' in data
        ? String((data as Record<string, unknown>).message)
        : JSON.stringify(data)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    return NextResponse.json({ success: true, date_fin: newDate })
  }

  /* ── Suspendre ── */
  if (action === 'suspendre') {
    const { ok, data } = await supabaseRest(
      `entreprises?id=eq.${entreprise_id}`,
      'PATCH',
      { statut_abonnement: 'suspendu' }
    )

    if (!ok) {
      const msg = typeof data === 'object' && data !== null && 'message' in data
        ? String((data as Record<string, unknown>).message)
        : JSON.stringify(data)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
