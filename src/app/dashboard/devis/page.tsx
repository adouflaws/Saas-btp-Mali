'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type DevisRow = {
  id: string
  numero: string
  statut: string | null
  montant_ht: number | null
  montant_ttc: number | null
  tva_taux: number | null
  date_emission: string | null
  date_validite: string | null
  notes: string | null
  chantier_id: string | null
  entreprise_id: string
  chantiers: { nom: string; client_nom: string; ville: string | null; client_telephone: string | null; client_email: string | null } | null
}

type LigneDevisRow = {
  id: string
  designation: string
  unite: string | null
  quantite: number | null
  prix_unit: number | null
  total: number | null
  ordre: number | null
}

type LigneForm = {
  _key: string
  designation: string
  unite: string
  quantite: string
  prix_unit: string
}

type FormData = {
  chantier_id: string
  date_validite: string
  notes: string
}

type Chantier = { id: string; nom: string; client_nom: string; ville: string | null }

const STATUTS_DEVIS = [
  { value: 'brouillon', label: 'Brouillon', badge: 'bg-gray-500/10 text-gray-400' },
  { value: 'envoye',    label: 'Envoyé',    badge: 'bg-blue-500/10 text-blue-400' },
  { value: 'accepte',   label: 'Accepté',   badge: 'bg-emerald-500/10 text-emerald-400' },
  { value: 'refuse',    label: 'Refusé',    badge: 'bg-red-500/10 text-red-400' },
  { value: 'expire',    label: 'Expiré',    badge: 'bg-amber-500/10 text-amber-400' },
]

function getStatutDevis(v: string | null) { return STATUTS_DEVIS.find(s => s.value === v) ?? STATUTS_DEVIS[0] }
function fcfa(v: number | null) { return v ? v.toLocaleString('fr-FR') + ' FCFA' : '— FCFA' }
function newLigne(): LigneForm { return { _key: Math.random().toString(36).slice(2), designation: '', unite: '', quantite: '', prix_unit: '' } }
function ligneTotal(l: LigneForm) { return Math.round((Number(l.quantite) || 0) * (Number(l.prix_unit) || 0)) }

async function genererNumeroDevis(year: number): Promise<string> {
  const { data } = await supabase
    .from('devis').select('numero')
    .ilike('numero', `DEV-${year}-%`)
    .order('numero', { ascending: false }).limit(1)
  const last = data?.[0]?.numero
  const next = last ? parseInt(last.split('-')[2] ?? '0') + 1 : 1
  return `DEV-${year}-${String(next).padStart(3, '0')}`
}

function imprimerDevis(devis: DevisRow, lignes: LigneDevisRow[], entrepriseNom: string) {
  const ht = devis.montant_ht ?? 0
  const tva = Math.round(ht * (devis.tva_taux ?? 18) / 100)
  const ttc = ht + tva
  const lignesHtml = lignes
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
    .map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${l.designation}</strong></td>
      <td class="center">${l.unite ?? '—'}</td>
      <td class="right">${(l.quantite ?? 0).toLocaleString('fr-FR')}</td>
      <td class="right">${(l.prix_unit ?? 0).toLocaleString('fr-FR')}</td>
      <td class="right amount">${(l.total ?? 0).toLocaleString('fr-FR')}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Devis ${devis.numero}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; color:#1a1a1a; padding:40px; font-size:13px; }
.header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:36px; padding-bottom:20px; border-bottom:3px solid #f97316; }
.brand { font-size:28px; font-weight:900; color:#f97316; letter-spacing:-1px; }
.brand span { color:#1a1a1a; }
.doc-title { font-size:22px; font-weight:800; color:#1a1a1a; margin-bottom:4px; }
.doc-meta { color:#666; font-size:12px; line-height:1.8; }
.meta-label { font-weight:600; color:#333; }
.parties { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:28px; padding:20px; background:#fafafa; border-radius:12px; border:1px solid #eee; }
.partie h3 { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#f97316; margin-bottom:8px; }
.partie p { color:#333; font-size:13px; line-height:1.7; }
.partie .name { font-size:15px; font-weight:700; color:#1a1a1a; }
table { width:100%; border-collapse:collapse; margin-bottom:20px; }
thead { background:#1a1a1a; color:white; }
th { padding:10px 12px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; text-align:left; }
th.center { text-align:center; }
th.right { text-align:right; }
td { padding:10px 12px; border-bottom:1px solid #f0f0f0; vertical-align:top; }
td.center { text-align:center; }
td.right { text-align:right; }
td.amount { font-weight:600; }
tr:nth-child(even) td { background:#fafafa; }
.totaux { display:flex; justify-content:flex-end; margin-bottom:28px; }
.totaux-box { width:280px; border:1px solid #eee; border-radius:10px; overflow:hidden; }
.total-row { display:flex; justify-content:space-between; padding:8px 16px; font-size:13px; border-bottom:1px solid #f0f0f0; }
.total-row:last-child { border:none; background:#f97316; color:white; font-size:16px; font-weight:800; padding:12px 16px; }
.total-row .label { color:inherit; }
.notes-box { background:#fff9f5; border:1px solid #fed7aa; border-radius:10px; padding:16px; margin-bottom:28px; }
.notes-box h4 { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#f97316; margin-bottom:6px; }
.conditions { border-top:1px solid #eee; padding-top:16px; color:#888; font-size:11px; line-height:1.8; }
.footer { display:flex; justify-content:space-between; align-items:center; margin-top:32px; padding-top:16px; border-top:1px solid #eee; color:#aaa; font-size:11px; }
.validity { background:#fff9f5; border-left:3px solid #f97316; padding:8px 12px; margin-bottom:20px; font-size:12px; color:#666; }
@media print { body { padding:24px; } }
</style></head><body>
<div class="header">
  <div>
    <div class="brand">BTP<span>Mali</span></div>
    <div style="color:#666; font-size:12px; margin-top:4px;">${entrepriseNom}</div>
  </div>
  <div style="text-align:right;">
    <div class="doc-title">DEVIS ${devis.numero}</div>
    <div class="doc-meta">
      <div><span class="meta-label">Date d'émission :</span> ${devis.date_emission ? new Date(devis.date_emission).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'}) : '—'}</div>
      ${devis.date_validite ? `<div><span class="meta-label">Valide jusqu'au :</span> ${new Date(devis.date_validite).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</div>` : ''}
      <div><span class="meta-label">Statut :</span> ${getStatutDevis(devis.statut).label}</div>
    </div>
  </div>
</div>
<div class="parties">
  <div class="partie">
    <h3>Émetteur</h3>
    <p class="name">${entrepriseNom}</p>
    <p>Bamako, Mali</p>
  </div>
  <div class="partie">
    <h3>Client</h3>
    <p class="name">${devis.chantiers?.client_nom ?? '—'}</p>
    <p>Chantier : ${devis.chantiers?.nom ?? '—'}</p>
    ${devis.chantiers?.ville ? `<p>${devis.chantiers.ville}</p>` : ''}
  </div>
</div>
${devis.date_validite ? `<div class="validity">⚠ Ce devis est valable jusqu'au ${new Date(devis.date_validite).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}.</div>` : ''}
<table>
  <thead><tr>
    <th style="width:30px">#</th>
    <th>Désignation</th>
    <th class="center" style="width:60px">Unité</th>
    <th class="right" style="width:70px">Qté</th>
    <th class="right" style="width:100px">Prix unit.</th>
    <th class="right" style="width:110px">Total HT</th>
  </tr></thead>
  <tbody>${lignesHtml}</tbody>
</table>
<div class="totaux">
  <div class="totaux-box">
    <div class="total-row"><span class="label">Sous-total HT</span><span>${ht.toLocaleString('fr-FR')} FCFA</span></div>
    <div class="total-row"><span class="label">TVA ${devis.tva_taux ?? 18}%</span><span>${tva.toLocaleString('fr-FR')} FCFA</span></div>
    <div class="total-row"><span class="label">TOTAL TTC</span><span>${ttc.toLocaleString('fr-FR')} FCFA</span></div>
  </div>
</div>
${devis.notes ? `<div class="notes-box"><h4>Notes</h4><p>${devis.notes}</p></div>` : ''}
<div class="conditions">
  <strong>Conditions de paiement :</strong> 30% à la commande, solde à la livraison.<br>
  <strong>Validité :</strong> Ce devis est valable 30 jours à compter de sa date d'émission.<br>
  Ce document a été généré par BTP Mali — Logiciel de gestion de chantiers.
</div>
<div class="footer">
  <span>BTP Mali — Gestion de chantiers professionnelle</span>
  <span>${devis.numero} · ${new Date().toLocaleDateString('fr-FR')}</span>
</div>
<script>window.onload=()=>window.print()</script>
</body></html>`

  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}

export default function DevisPage() {
  const [devisList, setDevisList] = useState<DevisRow[]>([])
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [entrepriseId, setEntrepriseId] = useState<string | null>(null)
  const [entrepriseNom, setEntrepriseNom] = useState('BTP Mali')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  // Modal devis
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>({ chantier_id: '', date_validite: '', notes: '' })
  const [lignes, setLignes] = useState<LigneForm[]>([newLigne()])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Modal statut
  const [statutTarget, setStatutTarget] = useState<DevisRow | null>(null)
  const [newStatut, setNewStatut] = useState('')
  const [updatingStatut, setUpdatingStatut] = useState(false)

  // Modal suppression
  const [deleteTarget, setDeleteTarget] = useState<DevisRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Modal convertir
  const [convertTarget, setConvertTarget] = useState<DevisRow | null>(null)
  const [converting, setConverting] = useState(false)

  const fetchDevis = useCallback(async () => {
    const { data, error } = await supabase
      .from('devis')
      .select('*, chantiers(nom, client_nom, ville, client_telephone, client_email)')
      .order('created_at', { ascending: false })
    if (error) setPageError(error.message)
    else setDevisList((data ?? []) as DevisRow[])
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('entreprise_id').eq('id', user.id).single()
      if (profile?.entreprise_id) {
        setEntrepriseId(profile.entreprise_id)
        const { data: ent } = await supabase.from('entreprises').select('nom').eq('id', profile.entreprise_id).single()
        if (ent) setEntrepriseNom(ent.nom)
        const { data: c } = await supabase.from('chantiers').select('id, nom, client_nom, ville').eq('entreprise_id', profile.entreprise_id).order('nom')
        setChantiers((c ?? []) as Chantier[])
      }
      await fetchDevis()
      setLoading(false)
    }
    init()
  }, [fetchDevis])

  useEffect(() => {
    if (!showModal) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [showModal])

  async function openNew() {
    setEditId(null)
    setForm({ chantier_id: chantiers[0]?.id ?? '', date_validite: '', notes: '' })
    setLignes([newLigne()])
    setFormError('')
    setShowModal(true)
  }

  async function openEdit(d: DevisRow) {
    setEditId(d.id)
    setForm({ chantier_id: d.chantier_id ?? '', date_validite: d.date_validite ?? '', notes: d.notes ?? '' })
    // Charger lignes existantes
    const { data: ligs } = await supabase.from('lignes_devis').select('*').eq('devis_id', d.id).order('ordre')
    setLignes((ligs ?? []).length > 0
      ? (ligs as LigneDevisRow[]).map(l => ({
          _key: l.id,
          designation: l.designation,
          unite: l.unite ?? '',
          quantite: String(l.quantite ?? ''),
          prix_unit: String(l.prix_unit ?? ''),
        }))
      : [newLigne()])
    setFormError('')
    setShowModal(true)
  }

  const totalHT = lignes.reduce((acc, l) => acc + ligneTotal(l), 0)
  const totalTVA = Math.round(totalHT * 18 / 100)
  const totalTTC = totalHT + totalTVA

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!entrepriseId) return
    if (lignes.every(l => !l.designation.trim())) { setFormError('Ajoutez au moins une ligne de devis.'); return }
    setSaving(true); setFormError('')

    const today = new Date().toISOString().split('T')[0]
    const payload = {
      chantier_id: form.chantier_id || null,
      entreprise_id: entrepriseId,
      statut: 'brouillon',
      montant_ht: totalHT,
      tva_taux: 18,
      date_emission: today,
      date_validite: form.date_validite || null,
      notes: form.notes.trim() || null,
      cree_par: userId,
    }

    let devisId = editId
    if (editId) {
      const { error } = await supabase.from('devis').update({ ...payload, statut: undefined }).eq('id', editId)
      if (error) { setFormError(error.message); setSaving(false); return }
      await supabase.from('lignes_devis').delete().eq('devis_id', editId)
    } else {
      const numero = await genererNumeroDevis(new Date().getFullYear())
      const { data, error } = await supabase.from('devis').insert({ ...payload, numero }).select('id').single()
      if (error) { setFormError(error.message); setSaving(false); return }
      devisId = data.id
    }

    const lignesPayload = lignes.filter(l => l.designation.trim()).map((l, i) => ({
      devis_id: devisId!,
      designation: l.designation.trim(),
      unite: l.unite.trim() || null,
      quantite: Number(l.quantite) || 0,
      prix_unit: Number(l.prix_unit) || 0,
      ordre: i,
    }))
    if (lignesPayload.length > 0) {
      const { error } = await supabase.from('lignes_devis').insert(lignesPayload)
      if (error) { setFormError(error.message); setSaving(false); return }
    }

    setShowModal(false); setSaving(false); await fetchDevis()
  }

  async function handleStatut() {
    if (!statutTarget || !newStatut) return
    setUpdatingStatut(true)
    await supabase.from('devis').update({ statut: newStatut }).eq('id', statutTarget.id)
    setStatutTarget(null); setUpdatingStatut(false); await fetchDevis()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from('lignes_devis').delete().eq('devis_id', deleteTarget.id)
    await supabase.from('devis').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null); setDeleting(false); await fetchDevis()
  }

  async function handleConvertir() {
    if (!convertTarget || !entrepriseId) return
    setConverting(true)
    const ht = convertTarget.montant_ht ?? 0
    const tva = Math.round(ht * (convertTarget.tva_taux ?? 18) / 100)
    const ttc = ht + tva
    const year = new Date().getFullYear()
    // Générer numéro facture
    const { data: lastFac } = await supabase.from('factures').select('numero').ilike('numero', `FAC-${year}-%`).order('numero', { ascending: false }).limit(1)
    const lastN = lastFac?.[0]?.numero ? parseInt(lastFac[0].numero.split('-')[2] ?? '0') + 1 : 1
    const facNumero = `FAC-${year}-${String(lastN).padStart(3, '0')}`
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('factures').insert({
      devis_id: convertTarget.id,
      chantier_id: convertTarget.chantier_id,
      entreprise_id: entrepriseId,
      numero: facNumero,
      statut: 'en_attente',
      montant_ht: ht,
      tva_taux: convertTarget.tva_taux ?? 18,
      montant_ttc: ttc,
      montant_paye: 0,
      date_emission: today,
      client_nom:       convertTarget.chantiers?.client_nom       ?? null,
      client_telephone: convertTarget.chantiers?.client_telephone ?? null,
      client_email:     convertTarget.chantiers?.client_email     ?? null,
    })
    if (!error) await supabase.from('devis').update({ statut: 'accepte' }).eq('id', convertTarget.id)
    setConvertTarget(null); setConverting(false); await fetchDevis()
  }

  async function getPDFLignes(devisId: string): Promise<LigneDevisRow[]> {
    const { data } = await supabase.from('lignes_devis').select('*').eq('devis_id', devisId).order('ordre')
    return (data ?? []) as LigneDevisRow[]
  }

  // Stats
  const totalDevisHT = devisList.reduce((acc, d) => acc + (d.montant_ht ?? 0), 0)
  const acceptes = devisList.filter(d => d.statut === 'accepte').length
  const enAttente = devisList.filter(d => ['brouillon','envoye'].includes(d.statut ?? '')).length

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Devis</h1>
          <p className="text-gray-500 text-sm mt-1">Création et suivi de vos devis clients</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/factures"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white hover:border-white/[0.15] text-[13px] font-medium transition-colors">
            Voir les factures
          </Link>
          <button onClick={openNew}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Nouveau devis
          </button>
        </div>
      </div>

      {/* Erreur */}
      {pageError && (
        <div className="mb-5 flex items-center gap-2 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>
          {pageError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total devis', value: devisList.length, color: 'text-white', bg: 'bg-white/[0.05]' },
          { label: 'Acceptés', value: acceptes, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'En attente', value: enAttente, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        ].map(s => (
          <div key={s.label} className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 flex items-center gap-3">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center`}>
              <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
            </div>
            <div>
              <p className="text-gray-400 text-[12px]">{s.label}</p>
              {s.label === 'Total devis' && !loading && (
                <p className="text-gray-600 text-[11px]">{fcfa(totalDevisHT)} HT total</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Liste devis */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-[15px] font-semibold text-white">
            Liste des devis
            {!loading && <span className="ml-2 text-gray-600 text-[13px] font-normal">({devisList.length})</span>}
          </h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          </div>
        ) : devisList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-orange-400"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinejoin="round"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round"/></svg>
            </div>
            <p className="text-white text-[14px] font-medium mb-1">Aucun devis</p>
            <p className="text-gray-600 text-[12px]">Créez votre premier devis</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {devisList.map(d => {
              const statut = getStatutDevis(d.statut)
              const canEdit = ['brouillon'].includes(d.statut ?? '')
              const canConvert = d.statut === 'accepte'
              return (
                <div key={d.id} className="px-6 py-4 hover:bg-white/[0.02] transition-colors group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 bg-white/[0.04] rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-gray-500"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinejoin="round"/><path d="M14 2v6h6" strokeLinecap="round"/></svg>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white text-[14px] font-semibold">{d.numero}</p>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statut.badge}`}>{statut.label}</span>
                        </div>
                        <p className="text-gray-500 text-[12px] mt-0.5">
                          {d.chantiers?.client_nom ?? '—'} · {d.chantiers?.nom ?? '—'}
                        </p>
                        {d.date_emission && (
                          <p className="text-gray-700 text-[11px] mt-0.5">
                            Émis le {new Date(d.date_emission).toLocaleDateString('fr-FR')}
                            {d.date_validite && ` · Valide jusqu'au ${new Date(d.date_validite).toLocaleDateString('fr-FR')}`}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-white text-[14px] font-bold">{fcfa(d.montant_ttc)}</p>
                        <p className="text-gray-700 text-[11px]">TTC · HT {fcfa(d.montant_ht)}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5">
                        {/* Statut */}
                        <button onClick={() => { setStatutTarget(d); setNewStatut(d.statut ?? 'brouillon') }}
                          className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-white text-[11px] font-medium transition-colors hidden group-hover:flex items-center gap-1">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1.5" strokeLinecap="round"/></svg>
                          Statut
                        </button>
                        {/* PDF */}
                        <button onClick={async () => { const ligs = await getPDFLignes(d.id); imprimerDevis(d, ligs, entrepriseNom) }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-white transition-colors" title="Télécharger PDF">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M8 2v8M5 7l3 3 3-3M3 12h10" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                        {/* Modifier (brouillon) */}
                        {canEdit && (
                          <button onClick={() => openEdit(d)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-white transition-colors" title="Modifier">
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5"><path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        )}
                        {/* Convertir en facture */}
                        {canConvert && (
                          <button onClick={() => setConvertTarget(d)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-medium transition-colors" title="Convertir en facture">
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3"><path d="M2 8h10M9 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            Facturer
                          </button>
                        )}
                        {/* Supprimer (brouillon) */}
                        {canEdit && (
                          <button onClick={() => setDeleteTarget(d)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors" title="Supprimer">
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8L13 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal formulaire devis ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-3xl bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] shrink-0">
              <h2 className="text-[15px] font-semibold text-white">{editId ? 'Modifier le devis' : 'Nouveau devis'}</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M2 2l12 12M14 2L2 14" strokeLinecap="round"/></svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              <form id="devis-form" onSubmit={handleSave} className="px-6 py-5 space-y-5">
                {formError && <div className="bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">{formError}</div>}

                {/* Chantier + dates */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Chantier <span className="text-orange-400">*</span></label>
                    {chantiers.length === 0
                      ? <p className="text-amber-400 text-[12px]">Aucun chantier. <Link href="/dashboard/chantiers" className="underline">Créer</Link></p>
                      : <select value={form.chantier_id} onChange={e => setForm(f => ({ ...f, chantier_id: e.target.value }))} required
                          className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all">
                          {chantiers.map(c => <option key={c.id} value={c.id}>{c.nom} — {c.client_nom}</option>)}
                        </select>}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Date validité</label>
                    <input type="date" value={form.date_validite} onChange={e => setForm(f => ({ ...f, date_validite: e.target.value }))}
                      className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Notes</label>
                    <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Conditions particulières…"
                      className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all" />
                  </div>
                </div>

                {/* Lignes de devis */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Lignes de devis</label>
                    <button type="button" onClick={() => setLignes(l => [...l, newLigne()])}
                      className="flex items-center gap-1.5 text-orange-400 hover:text-orange-300 text-[12px] font-medium transition-colors">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M8 3v10M3 8h10" strokeLinecap="round"/></svg>
                      Ajouter une ligne
                    </button>
                  </div>

                  {/* En-tête */}
                  <div className="grid gap-2 mb-2 px-1" style={{ gridTemplateColumns: '3fr 1fr 80px 110px 100px 28px' }}>
                    {['Désignation', 'Unité', 'Qté', 'Prix unit. (FCFA)', 'Total HT', ''].map(h => (
                      <span key={h} className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">{h}</span>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {lignes.map((l, i) => {
                      const tot = ligneTotal(l)
                      return (
                        <div key={l._key} className="grid gap-2 items-center" style={{ gridTemplateColumns: '3fr 1fr 80px 110px 100px 28px' }}>
                          <input value={l.designation} onChange={e => setLignes(ls => ls.map((x, j) => j === i ? { ...x, designation: e.target.value } : x))}
                            placeholder="Ex: Béton armé B25" required={i === 0}
                            className="bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-orange-500 transition-all" />
                          <input value={l.unite} onChange={e => setLignes(ls => ls.map((x, j) => j === i ? { ...x, unite: e.target.value } : x))}
                            placeholder="m³"
                            className="bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-orange-500 transition-all" />
                          <input type="number" min="0" value={l.quantite} onChange={e => setLignes(ls => ls.map((x, j) => j === i ? { ...x, quantite: e.target.value } : x))}
                            placeholder="0"
                            className="bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-orange-500 transition-all" />
                          <input type="number" min="0" value={l.prix_unit} onChange={e => setLignes(ls => ls.map((x, j) => j === i ? { ...x, prix_unit: e.target.value } : x))}
                            placeholder="0"
                            className="bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-orange-500 transition-all" />
                          <div className="bg-white/[0.04] rounded-xl px-3 py-2 text-[13px] text-gray-300 font-medium text-right">
                            {tot.toLocaleString('fr-FR')}
                          </div>
                          <button type="button" onClick={() => setLignes(ls => ls.filter((_, j) => j !== i))}
                            disabled={lignes.length === 1}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path d="M3 8h10" strokeLinecap="round"/></svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Totaux */}
                <div className="flex justify-end">
                  <div className="w-64 bg-[#1C1C1C] rounded-2xl border border-white/[0.08] overflow-hidden">
                    {[
                      { label: 'Sous-total HT', value: totalHT },
                      { label: 'TVA 18%', value: totalTVA },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center px-4 py-2.5 border-b border-white/[0.06]">
                        <span className="text-gray-500 text-[12px]">{r.label}</span>
                        <span className="text-gray-300 text-[13px] font-medium">{r.value.toLocaleString('fr-FR')} FCFA</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center px-4 py-3 bg-orange-500/10">
                      <span className="text-orange-400 text-[13px] font-semibold">TOTAL TTC</span>
                      <span className="text-orange-400 text-[15px] font-bold">{totalTTC.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/[0.06] flex gap-3 shrink-0">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white text-[13px] font-medium transition-colors">Annuler</button>
              <button type="submit" form="devis-form" disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Enregistrement…</> : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal changement statut ── */}
      {statutTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setStatutTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <h3 className="text-white text-[15px] font-semibold mb-1">Changer le statut</h3>
            <p className="text-gray-600 text-[12px] mb-4">{statutTarget.numero}</p>
            <div className="space-y-2 mb-5">
              {STATUTS_DEVIS.map(s => (
                <button key={s.value} onClick={() => setNewStatut(s.value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${newStatut === s.value ? 'border-orange-500 bg-orange-500/10' : 'border-white/[0.06] hover:border-white/[0.12]'}`}>
                  <span className="text-white text-[13px]">{s.label}</span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${s.badge}`}>{s.label}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStatutTarget(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] font-medium transition-colors">Annuler</button>
              <button onClick={handleStatut} disabled={updatingStatut}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60">
                {updatingStatut ? 'Mise à jour…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal convertir en facture ── */}
      {convertTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setConvertTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="w-11 h-11 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-emerald-400"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4" strokeLinecap="round"/></svg>
            </div>
            <h3 className="text-white text-[15px] font-semibold text-center mb-2">Convertir en facture ?</h3>
            <p className="text-gray-500 text-[13px] text-center mb-1">
              <span className="text-white font-medium">{convertTarget.numero}</span> → une facture sera créée
            </p>
            <p className="text-emerald-400 text-[14px] font-bold text-center mb-5">{fcfa(convertTarget.montant_ttc)}</p>
            <div className="flex gap-3">
              <button onClick={() => setConvertTarget(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] font-medium">Annuler</button>
              <button onClick={handleConvertir} disabled={converting}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {converting ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Création…</> : 'Créer la facture'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal suppression ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <h3 className="text-white text-[15px] font-semibold text-center mb-2">Supprimer le devis ?</h3>
            <p className="text-gray-500 text-[13px] text-center mb-5">
              <span className="text-white font-medium">{deleteTarget.numero}</span> et toutes ses lignes seront supprimés.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] font-medium">Annuler</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
