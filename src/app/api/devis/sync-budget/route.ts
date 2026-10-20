import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, syncBudgetPrevisionnel } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  try {
    const { devis_id, forceClear } = await req.json()
    if (!devis_id) return NextResponse.json({ error: 'devis_id manquant' }, { status: 400 })

    // L'appelant doit être connecté et appartenir à l'entreprise du devis :
    // la route agit en service role, donc on ne fait pas confiance au devis_id reçu.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const admin = createAdminClient()
    const [{ data: profile }, { data: devis }] = await Promise.all([
      admin.from('profiles').select('entreprise_id').eq('id', user.id).single(),
      admin.from('devis').select('entreprise_id').eq('id', devis_id).single(),
    ])
    if (!devis) return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })
    if (!profile?.entreprise_id || profile.entreprise_id !== devis.entreprise_id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const result = await syncBudgetPrevisionnel(admin, devis_id, !!forceClear)
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json(result)
  } catch (err) {
    console.error('Erreur sync-budget:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
