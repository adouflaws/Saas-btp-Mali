import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const SUPER_ADMIN_EMAILS = ['adouflaws@gmail.com']

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email || !SUPER_ADMIN_EMAILS.includes(user.email)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      ?.replace(/^﻿/, '')
      ?.trim()

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey!
    )

    const { data: entreprises, error } = await admin
      .from('entreprises')
      .select('id, nom, telephone, statut_abonnement, date_fin_abonnement, plan, created_at, profiles(id)')
      .neq('nom', 'Mon Entreprise')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })

    const clients = (entreprises ?? [])
      .map(e => {
        const profiles = Array.isArray(e.profiles) ? e.profiles : []
        const authUser = users?.find(u => profiles.some((p: { id: string }) => p.id === u.id))
        return {
          id: e.id,
          nom: e.nom,
          email: authUser?.email ?? null,
          telephone: (e as { telephone?: string | null }).telephone ?? null,
          statut_abonnement: e.statut_abonnement,
          date_fin_abonnement: e.date_fin_abonnement,
          plan: e.plan,
          created_at: e.created_at,
        }
      })
      .filter(e => !SUPER_ADMIN_EMAILS.includes(e.email ?? ''))

    return NextResponse.json({ clients })
  } catch (err) {
    console.error('Erreur /api/admin/clients:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
