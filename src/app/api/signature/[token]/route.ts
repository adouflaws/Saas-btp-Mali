import { NextResponse } from 'next/server'
import { createAdminClient, syncBudgetPrevisionnel } from '@/lib/supabase/admin'

// Page publique de signature : le client n'a pas de compte et la RLS bloque
// toute lecture anonyme de "devis". Le jeton (UUID non devinable) fait office
// d'autorisation, vérifiée ici côté serveur.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function findDevis(token: string) {
  if (!UUID.test(token)) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('devis')
    .select('id, numero, statut, montant_ht, montant_ttc, tva_taux, date_emission, date_validite, date_signature, signe_par, notes, client_nom, chantiers(nom, client_nom), entreprises(nom, telephone, email)')
    .eq('signature_token', token)
    .maybeSingle()
  return data ? { admin, devis: data } : null
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const found = await findDevis(token)
  if (!found) return NextResponse.json({ error: 'Lien invalide ou devis introuvable.' }, { status: 404 })

  const { data: lignes } = await found.admin
    .from('lignes_devis')
    .select('id, designation, unite, quantite, prix_unit, total, ordre')
    .eq('devis_id', found.devis.id)
    .order('ordre')

  return NextResponse.json({ devis: found.devis, lignes: lignes ?? [] })
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const found = await findDevis(token)
  if (!found) return NextResponse.json({ error: 'Lien invalide ou devis introuvable.' }, { status: 404 })
  const { admin, devis } = found

  // Une réponse déjà donnée ne peut plus être modifiée par le lien
  if (devis.statut === 'accepte' || devis.statut === 'refuse') {
    return NextResponse.json({ error: 'Ce devis a déjà reçu une réponse.' }, { status: 409 })
  }

  const { action, nom } = await req.json().catch(() => ({}))
  if (action !== 'accepter' && action !== 'refuser') {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
  }
  const signataire = typeof nom === 'string' ? nom.trim().slice(0, 120) : ''
  if (action === 'accepter' && !signataire) {
    return NextResponse.json({ error: 'Indiquez votre nom pour signer.' }, { status: 400 })
  }

  const update = action === 'accepter'
    ? { statut: 'accepte', date_signature: new Date().toISOString(), signe_par: signataire }
    : { statut: 'refuse' }
  const { error } = await admin.from('devis').update(update).eq('id', devis.id)
  if (error) return NextResponse.json({ error: "La réponse n'a pas pu être enregistrée. Réessayez." }, { status: 500 })

  const sync = await syncBudgetPrevisionnel(admin, devis.id)
  if (!sync.success) console.error('Erreur synchronisation budget prévisionnel:', sync.error)

  return NextResponse.json({ success: true })
}
