'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Facture = {
  id: string
  numero: string
  statut: string | null
  montant_ht: number | null
  montant_ttc: number | null
  tva_taux: number | null
  montant_paye: number | null
  date_emission: string | null
  date_echeance: string | null
  mode_paiement: string | null
  notes: string | null
  chantier_id: string | null
  devis_id: string | null
  client_nom: string | null
  client_telephone: string | null
  client_email: string | null
  chantiers: { nom: string; client_nom: string; client_telephone: string | null; client_email: string | null; ville: string | null } | null
}

const STATUTS_FACTURE = [
  { value: 'en_attente',         label: 'En attente',   badge: 'bg-amber-500/10 text-amber-400' },
  { value: 'partiellement_paye', label: 'Part. payée',  badge: 'bg-blue-500/10 text-blue-400' },
  { value: 'paye',               label: 'Payée',        badge: 'bg-emerald-500/10 text-emerald-400' },
  { value: 'en_retard',          label: 'En retard',    badge: 'bg-red-500/10 text-red-400' },
]

const MODES_PAIEMENT = [
  { value: 'wave',         label: 'Wave',         icon: '📱' },
  { value: 'orange_money', label: 'Orange Money', icon: '🟠' },
  { value: 'virement',     label: 'Virement',     icon: '🏦' },
  { value: 'especes',      label: 'Espèces',      icon: '💵' },
  { value: 'cheque',       label: 'Chèque',       icon: '📄' },
]

function getStatutFac(v: string | null) { return STATUTS_FACTURE.find(s => s.value === v) ?? STATUTS_FACTURE[0] }
function fcfa(v: number | null) { return (v ?? 0).toLocaleString('fr-FR') + ' FCFA' }

function getClientNom(f: Facture) {
  return f.client_nom || f.chantiers?.client_nom || null
}

export default function FacturesPage() {
  const [factures, setFactures] = useState<Facture[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  // Modal paiement
  const [paiementTarget, setPaiementTarget] = useState<Facture | null>(null)
  const [modePaiement, setModePaiement] = useState('wave')
  const [montantPaiement, setMontantPaiement] = useState('')
  const [payant, setPayant] = useState(false)

  // Modal édition
  const [editTarget, setEditTarget] = useState<Facture | null>(null)
  const [editDateEcheance, setEditDateEcheance] = useState('')
  const [editMode, setEditMode] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editStatut, setEditStatut] = useState('')
  const [saving, setSaving] = useState(false)

  // Modal suppression
  const [deleteTarget, setDeleteTarget] = useState<Facture | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Modal ajout client
  const [clientTarget, setClientTarget] = useState<Facture | null>(null)
  const [clientNomVal, setClientNomVal] = useState('')
  const [clientTelVal, setClientTelVal] = useState('')
  const [clientEmailVal, setClientEmailVal] = useState('')
  const [savingClient, setSavingClient] = useState(false)

  const fetchFactures = useCallback(async () => {
    const { data, error } = await supabase
      .from('factures')
      .select('*, chantiers(nom, client_nom, client_telephone, client_email, ville)')
      .order('date_emission', { ascending: false })
    if (error) setPageError(error.message)
    else setFactures((data ?? []) as Facture[])
  }, [])

  useEffect(() => {
    async function init() { setLoading(true); await fetchFactures(); setLoading(false) }
    init()
  }, [fetchFactures])

  useEffect(() => {
    if (!paiementTarget) return
    setMontantPaiement(String((paiementTarget.montant_ttc ?? 0) - (paiementTarget.montant_paye ?? 0)))
    setModePaiement('wave')
  }, [paiementTarget])

  useEffect(() => {
    if (!editTarget) return
    setEditDateEcheance(editTarget.date_echeance ?? '')
    setEditMode(editTarget.mode_paiement ?? '')
    setEditNotes(editTarget.notes ?? '')
    setEditStatut(editTarget.statut ?? 'en_attente')
  }, [editTarget])

  useEffect(() => {
    if (!editTarget || !editDateEcheance) return
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const ech = new Date(editDateEcheance); ech.setHours(0, 0, 0, 0)
    setEditStatut(prev => {
      if (prev === 'paye') return prev
      if (ech < today) return 'en_retard'
      if (prev === 'en_retard') return 'en_attente'
      return prev
    })
  }, [editDateEcheance, editTarget])

  function openAddClient(f: Facture) {
    setClientTarget(f)
    setClientNomVal(getClientNom(f) ?? '')
    setClientTelVal(f.client_telephone ?? f.chantiers?.client_telephone ?? '')
    setClientEmailVal(f.client_email ?? f.chantiers?.client_email ?? '')
  }

  async function handleSaveClient() {
    if (!clientTarget) return
    setSavingClient(true)
    await supabase.from('factures').update({
      client_nom:       clientNomVal.trim() || null,
      client_telephone: clientTelVal.trim() || null,
      client_email:     clientEmailVal.trim() || null,
    }).eq('id', clientTarget.id)
    if (clientTarget.chantier_id) {
      await supabase.from('chantiers').update({
        client_nom:       clientNomVal.trim() || undefined,
        client_telephone: clientTelVal.trim() || undefined,
        client_email:     clientEmailVal.trim() || undefined,
      }).eq('id', clientTarget.chantier_id)
    }
    setSavingClient(false); setClientTarget(null); await fetchFactures()
  }

  async function handlePaiement() {
    if (!paiementTarget) return
    setPayant(true)
    const montant = Number(montantPaiement) || 0
    const totalPaye = (paiementTarget.montant_paye ?? 0) + montant
    const ttc = paiementTarget.montant_ttc ?? 0
    const newStatut = totalPaye >= ttc ? 'paye' : totalPaye > 0 ? 'partiellement_paye' : 'en_attente'
    await supabase.from('factures').update({
      montant_paye: totalPaye,
      statut: newStatut,
      mode_paiement: modePaiement,
    }).eq('id', paiementTarget.id)
    setPaiementTarget(null); setPayant(false); await fetchFactures()
  }

  async function handleEdit() {
    if (!editTarget) return
    setSaving(true)
    await supabase.from('factures').update({
      date_echeance: editDateEcheance || null,
      mode_paiement: editMode || null,
      notes: editNotes || null,
      statut: editStatut,
    }).eq('id', editTarget.id)
    setSaving(false); setEditTarget(null); await fetchFactures()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from('factures').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null); setDeleting(false); await fetchFactures()
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  function isEnRetard(f: Facture) {
    return f.statut !== 'paye' && f.date_echeance && new Date(f.date_echeance) < today
  }

  const totalEncaisse = factures.filter(f => f.statut === 'paye').reduce((a, f) => a + (f.montant_ttc ?? 0), 0)
  const totalEnAttente = factures.filter(f => f.statut !== 'paye').reduce((a, f) => a + ((f.montant_ttc ?? 0) - (f.montant_paye ?? 0)), 0)
  const enRetardCount = factures.filter(f => isEnRetard(f)).length

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Factures</h1>
          <p className="text-gray-500 text-sm mt-1">Suivi des encaissements et paiements</p>
        </div>
        <Link href="/dashboard/devis"
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          Nouveau devis
        </Link>
      </div>

      {pageError && (
        <div className="mb-5 flex items-center gap-2 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>
          {pageError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Encaissé', value: fcfa(totalEncaisse), color: 'text-emerald-400', bg: 'bg-emerald-500/10',
            icon: <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/></svg> },
          { label: 'En attente de paiement', value: fcfa(totalEnAttente), color: 'text-amber-400', bg: 'bg-amber-500/10',
            icon: <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd"/></svg> },
          { label: 'En retard', value: String(enRetardCount), color: 'text-red-400', bg: 'bg-red-500/10',
            icon: <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg> },
        ].map(s => (
          <div key={s.label} className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-3 ${s.color}`}>{s.icon}</div>
            <p className={`text-[18px] font-bold ${s.color}`}>{s.value}</p>
            <p className="text-gray-500 text-[12px] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Liste factures */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-[15px] font-semibold text-white">
            Liste des factures
            {!loading && <span className="ml-2 text-gray-600 text-[13px] font-normal">({factures.length})</span>}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          </div>
        ) : factures.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-orange-400"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
            </div>
            <p className="text-white text-[14px] font-medium mb-1">Aucune facture</p>
            <p className="text-gray-600 text-[12px]">
              <Link href="/dashboard/devis" className="text-orange-400 hover:underline">Convertissez un devis accepté</Link> pour créer une facture
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {factures.map(f => {
              const statut = getStatutFac(f.statut)
              const ttc = f.montant_ttc ?? 0
              const paye = f.montant_paye ?? 0
              const restant = Math.max(0, ttc - paye)
              const pct = ttc > 0 ? Math.min(100, Math.round(paye / ttc * 100)) : 0
              const retard = isEnRetard(f)
              const clientNom = getClientNom(f)

              return (
                <div key={f.id} className={`px-6 py-4 hover:bg-white/[0.02] transition-colors group ${retard ? 'border-l-2 border-red-500/40' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 bg-white/[0.04] rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-gray-500"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4" strokeLinecap="round"/></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white text-[14px] font-semibold">{f.numero}</p>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statut.badge}`}>{statut.label}</span>
                          {retard && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">En retard</span>}
                          {f.mode_paiement && (
                            <span className="text-[10px] text-gray-600">
                              via {MODES_PAIEMENT.find(m => m.value === f.mode_paiement)?.label ?? f.mode_paiement}
                            </span>
                          )}
                        </div>

                        {/* Nom client */}
                        <div className="flex items-center gap-2 mt-0.5">
                          {clientNom ? (
                            <p className="text-gray-400 text-[12px] font-medium">{clientNom}</p>
                          ) : (
                            <button
                              onClick={() => openAddClient(f)}
                              className="flex items-center gap-1 text-[11px] text-orange-400 hover:text-orange-300 font-medium transition-colors"
                            >
                              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3 h-3"><path d="M8 3v10M3 8h10" strokeLinecap="round"/></svg>
                              Ajouter client
                            </button>
                          )}
                          {f.chantiers?.nom && (
                            <span className="text-gray-600 text-[12px]">· {f.chantiers.nom}</span>
                          )}
                        </div>

                        {/* Contact client */}
                        {(f.client_telephone || f.chantiers?.client_telephone || f.client_email || f.chantiers?.client_email) && (
                          <div className="flex items-center gap-3 mt-0.5">
                            {(f.client_telephone || f.chantiers?.client_telephone) && (
                              <span className="text-gray-700 text-[11px] flex items-center gap-1">
                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3"><path d="M9.5 2.5s1.5.5 1.5 2.5-1.5 2.5-1.5 2.5M11 12.5c-5.5 0-7.5-5.5-7.5-5.5s0-1.5 1.5-1.5l1.5 3-1 1c.5 1 2 2 2 2l1-1 3 1.5c0 1.5-1.5 1.5-1.5 0z" strokeLinecap="round"/></svg>
                                {f.client_telephone || f.chantiers?.client_telephone}
                              </span>
                            )}
                            {(f.client_email || f.chantiers?.client_email) && (
                              <span className="text-gray-700 text-[11px]">{f.client_email || f.chantiers?.client_email}</span>
                            )}
                          </div>
                        )}

                        {(f.date_emission || f.date_echeance) && (
                          <p className="text-gray-700 text-[11px] mt-0.5">
                            {f.date_emission && `Émise le ${new Date(f.date_emission).toLocaleDateString('fr-FR')}`}
                            {f.date_echeance && ` · Échéance ${new Date(f.date_echeance).toLocaleDateString('fr-FR')}`}
                          </p>
                        )}
                        {f.notes && (
                          <p className="text-gray-600 text-[11px] mt-1 italic truncate max-w-xs">{f.notes}</p>
                        )}

                        {/* Barre de paiement */}
                        {ttc > 0 && (
                          <div className="mt-2.5 max-w-xs">
                            <div className="flex justify-between text-[10px] mb-1">
                              <span className="text-gray-600">Payé : {fcfa(paye)}</span>
                              <span className="text-gray-700">{pct}%</span>
                            </div>
                            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-white/[0.06]'}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                            {restant > 0 && (
                              <p className="text-gray-700 text-[10px] mt-1">Restant : {fcfa(restant)}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-white text-[14px] font-bold">{fcfa(ttc)}</p>
                        <p className="text-gray-700 text-[11px]">TTC</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Modifier client */}
                        <button onClick={() => openAddClient(f)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-white text-[11px] font-medium transition-colors opacity-0 group-hover:opacity-100"
                          title="Modifier les infos client">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3"><path d="M8 2a3 3 0 110 6 3 3 0 010-6zM2 14c0-3 2.5-5 6-5s6 2 6 5" strokeLinecap="round"/></svg>
                        </button>
                        {/* Paiement */}
                        {f.statut !== 'paye' && (
                          <button onClick={() => setPaiementTarget(f)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-medium transition-colors">
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3 h-3"><path d="M2 8l5 5L14 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            Paiement
                          </button>
                        )}
                        {/* Modifier */}
                        <button onClick={() => setEditTarget(f)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[11px] font-medium transition-colors"
                          title="Modifier la facture">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3 h-3">
                            <path d="M11.333 2a1.886 1.886 0 112.667 2.667L5.167 13.5 2 14l.5-3.167L11.333 2z" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Modifier
                        </button>
                        {/* Voir devis associé */}
                        {f.devis_id && (
                          <Link href="/dashboard/devis"
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-white transition-colors" title="Voir le devis">
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M14 2H6a1.5 1.5 0 00-1.5 1.5v10A1.5 1.5 0 006 15h8a1.5 1.5 0 001.5-1.5v-10A1.5 1.5 0 0014 2z"/><path d="M14 2v4h-4M8 9h4M8 12h2" strokeLinecap="round"/></svg>
                          </Link>
                        )}
                        {/* Supprimer */}
                        <button onClick={() => setDeleteTarget(f)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" title="Supprimer">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8L13 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal ajout / modification client ── */}
      {clientTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setClientTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-white text-[15px] font-semibold">Informations client</h3>
                <p className="text-gray-600 text-[12px] mt-0.5">{clientTarget.numero}</p>
              </div>
              <button onClick={() => setClientTarget(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Nom complet du client</label>
                <input type="text" value={clientNomVal} onChange={e => setClientNomVal(e.target.value)}
                  placeholder="Ex: M. Traoré Amadou" autoFocus
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Téléphone WhatsApp</label>
                <input type="tel" value={clientTelVal} onChange={e => setClientTelVal(e.target.value)}
                  placeholder="+223 76 00 00 00"
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Email</label>
                <input type="email" value={clientEmailVal} onChange={e => setClientEmailVal(e.target.value)}
                  placeholder="client@email.com"
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all" />
              </div>
            </div>
            <p className="text-gray-700 text-[11px] mt-3">Les informations seront aussi mises à jour sur le chantier associé.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setClientTarget(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] font-medium">Annuler</button>
              <button onClick={handleSaveClient} disabled={savingClient || !clientNomVal.trim()}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {savingClient ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Enregistrement…</> : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal paiement ── */}
      {paiementTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setPaiementTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <h3 className="text-white text-[15px] font-semibold mb-1">Enregistrer un paiement</h3>
            <p className="text-gray-600 text-[12px] mb-5">{paiementTarget.numero} · {getClientNom(paiementTarget) ?? '—'}</p>
            <div className="bg-[#1C1C1C] rounded-xl p-4 mb-5 space-y-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-gray-500">Total TTC</span>
                <span className="text-white font-medium">{fcfa(paiementTarget.montant_ttc)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-gray-500">Déjà payé</span>
                <span className="text-emerald-400 font-medium">{fcfa(paiementTarget.montant_paye)}</span>
              </div>
              <div className="h-px bg-white/[0.06]" />
              <div className="flex justify-between text-[14px]">
                <span className="text-gray-400 font-medium">Restant dû</span>
                <span className="text-orange-400 font-bold">{fcfa(Math.max(0, (paiementTarget.montant_ttc ?? 0) - (paiementTarget.montant_paye ?? 0)))}</span>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Montant reçu (FCFA)</label>
              <input type="number" min="0" value={montantPaiement} onChange={e => setMontantPaiement(e.target.value)}
                className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all" />
            </div>
            <div className="mb-5">
              <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-widest">Mode de paiement</label>
              <div className="grid grid-cols-3 gap-2">
                {MODES_PAIEMENT.map(m => (
                  <button key={m.value} type="button" onClick={() => setModePaiement(m.value)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-colors ${modePaiement === m.value ? 'border-orange-500 bg-orange-500/10' : 'border-white/[0.06] hover:border-white/[0.12]'}`}>
                    <span className="text-lg">{m.icon}</span>
                    <span className={`text-[11px] font-medium ${modePaiement === m.value ? 'text-orange-400' : 'text-gray-500'}`}>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPaiementTarget(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] font-medium">Annuler</button>
              <button onClick={handlePaiement} disabled={payant || !montantPaiement}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {payant ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Enregistrement…</> : 'Enregistrer le paiement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal édition ── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setEditTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-white text-[15px] font-semibold">Modifier la facture</h3>
                <p className="text-gray-600 text-[12px] mt-0.5">{editTarget.numero} · {getClientNom(editTarget) ?? '—'}</p>
              </div>
              <button onClick={() => setEditTarget(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Date d&apos;échéance</label>
                <input type="date" value={editDateEcheance} onChange={e => setEditDateEcheance(e.target.value)}
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all [color-scheme:dark]" />
                {editDateEcheance && (() => {
                  const t = new Date(); t.setHours(0,0,0,0)
                  const e = new Date(editDateEcheance); e.setHours(0,0,0,0)
                  return e < t ? (
                    <p className="text-red-400 text-[11px] mt-1.5 flex items-center gap-1">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M8 1a7 7 0 100 14A7 7 0 008 1zM8 5a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 018 5zm0 7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>
                      Date dépassée — statut passera en retard
                    </p>
                  ) : null
                })()}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-widest">Mode de paiement</label>
                <div className="grid grid-cols-3 gap-2">
                  {MODES_PAIEMENT.map(m => (
                    <button key={m.value} type="button" onClick={() => setEditMode(editMode === m.value ? '' : m.value)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-colors ${editMode === m.value ? 'border-orange-500 bg-orange-500/10' : 'border-white/[0.06] hover:border-white/[0.12]'}`}>
                      <span className="text-lg">{m.icon}</span>
                      <span className={`text-[11px] font-medium ${editMode === m.value ? 'text-orange-400' : 'text-gray-500'}`}>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-widest">Statut</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUTS_FACTURE.map(s => (
                    <button key={s.value} type="button" onClick={() => setEditStatut(s.value)}
                      className={`py-2 px-3 rounded-xl border text-[11px] font-medium transition-colors text-left ${editStatut === s.value ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-white/[0.06] hover:border-white/[0.12] text-gray-500'}`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${s.badge.split(' ')[0]}`} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Notes</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                  placeholder="Informations supplémentaires…" rows={3}
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditTarget(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] font-medium">Annuler</button>
              <button onClick={handleEdit} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? (<><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Enregistrement…</>) : 'Enregistrer'}
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
            <h3 className="text-white text-[15px] font-semibold text-center mb-2">Supprimer la facture ?</h3>
            <p className="text-gray-500 text-[13px] text-center mb-5">
              <span className="text-white font-medium">{deleteTarget.numero}</span> sera définitivement supprimée.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] font-medium">Annuler</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold disabled:opacity-60">
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
