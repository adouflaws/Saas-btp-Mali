import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function DELETE(request: NextRequest) {
  try {
    // Vérifier que le caller est super_admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const SUPER_ADMIN_EMAILS = ['adouflaws@gmail.com']
    if (!user.email || !SUPER_ADMIN_EMAILS.includes(user.email))
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { entreprise_id } = await request.json()
    if (!entreprise_id) return NextResponse.json({ error: 'entreprise_id requis' }, { status: 400 })

    // Client admin avec service role key
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
      ?.replace(/^﻿/, '')
      ?.trim()

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey!
    )

    // Récupérer les IDs auth des utilisateurs de cette entreprise
    const { data: profiles } = await admin
      .from('profiles').select('id').eq('entreprise_id', entreprise_id)
    const userIds = (profiles ?? []).map((p: { id: string }) => p.id)

    // Suppression dans l'ordre
    await admin.from('abonnements').delete().eq('entreprise_id', entreprise_id)
    await admin.from('profiles').delete().eq('entreprise_id', entreprise_id)
    await admin.from('entreprises').delete().eq('id', entreprise_id)
    for (const uid of userIds) {
      await admin.auth.admin.deleteUser(uid)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
