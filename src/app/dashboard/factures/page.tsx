'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageSkeleton from '@/components/PageSkeleton'
import { useActionGuard } from '@/hooks/useActionGuard'
import StatusBadge, { statutBarClass } from '@/components/StatusBadge'
import { STATUTS_FACTURE } from '@/constants/statuts'
import { generateDocument, type PdfEntreprise } from '@/lib/pdf/generateDocument'

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

const MODES_PAIEMENT = [
  { value: 'wave',         label: 'Wave',         icon: '📱' },
  { value: 'orange_money', label: 'Orange Money', icon: '🟠' },
  { value: 'virement',     label: 'Virement',     icon: '🏦' },
  { value: 'especes',      label: 'Espèces',      icon: '💵' },
  { value: 'cheque',       label: 'Chèque',       icon: '📄' },
]

function fcfa(v: number | null) { return (v ?? 0).toLocaleString('fr-FR') + ' FCFA' }

function getClientNom(f: Facture) {
  return f.client_nom || f.chantiers?.client_nom || null
}

type FiltreFacture = 'toutes' | 'impayees' | 'payees'
const FILTRES_FACTURE: { value: FiltreFacture; label: string }[] = [
  { value: 'toutes', label: 'Toutes' },
  { value: 'impayees', label: 'Impayées' },
  { value: 'payees', label: 'Payées' },
]
function parseFiltreFacture(v: string | null): FiltreFacture {
  return v === 'impayees' || v === 'payees' ? v : 'toutes'
}

export default function FacturesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FacturesPageInner />
    </Suspense>
  )
}

function FacturesPageInner() {
  const { guard } = useActionGuard()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [filtre, setFiltre] = useState<FiltreFacture>(() => parseFiltreFacture(searchParams.get('filtre')))
  const [factures, setFactures] = useState<Facture[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  function changerFiltre(v: FiltreFacture) {
    setFiltre(v)
    router.push(v === 'toutes' ? '/dashboard/factures' : `/dashboard/factures?filtre=${v}`, { scroll: false })
  }

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

  // Ajout téléphone legacy
  const [telTarget, setTelTarget] = useState<Facture | null>(null)
  const [telVal, setTelVal] = useState('')
  const [savingTel, setSavingTel] = useState(false)

  // Entreprise info pour PDF
  const [entrepriseInfo, setEntrepriseInfo] = useState<PdfEntreprise>({ nom: 'BTP Mali' })

  const fetchFactures = useCallback(async () => {
    const { data, error } = await supabase
      .from('factures')
      .select('*, chantiers(nom, client_nom, client_telephone, client_email, ville)')
      .order('date_emission', { ascending: false })
    if (error) setPageError(error.message)
    else setFactures((data ?? []) as Facture[])
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('entreprise_id')
          .eq('id', user.id)
          .single()
        if (profile?.entreprise_id) {
          const { data: ent } = await supabase
            .from('entreprises')
            .select('nom, adresse, telephone, email, rccm, nif')
            .eq('id', profile.entreprise_id)
            .single()
          if (ent) setEntrepriseInfo(ent as PdfEntreprise)
        }
      }
      await fetchFactures()
      setLoading(false)
    }
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

  function openTelModal(f: Facture) {
    setTelTarget(f)
    setTelVal(f.client_telephone ?? f.chantiers?.client_telephone ?? '')
  }

  async function handleSaveTel() {
    if (!telTarget) return
    setSavingTel(true)
    await supabase.from('factures').update({ client_telephone: telVal.trim() || null }).eq('id', telTarget.id)
    setSavingTel(false); setTelTarget(null); await fetchFactures()
  }

  async function downloadFacturePDF(f: Facture) {
    const { data: lignesRaw } = await supabase
      .from('lignes_factures')
      .select('designation, unite, quantite, prix_unitaire')
      .eq('facture_id', f.id)
      .order('id')
    const lignes = (lignesRaw ?? []).map((l: { designation: string; unite: string | null; quantite: number | null; prix_unitaire: number | null }) => ({
      designation: l.designation,
      unite: l.unite,
      quantite: l.quantite ?? 0,
      prix_unit: l.prix_unitaire ?? 0,
      total: Math.round((l.quantite ?? 0) * (l.prix_unitaire ?? 0)),
    }))
    const ht = f.montant_ht ?? 0
    const tva_taux = f.tva_taux ?? 18
    const tva = Math.round(ht * tva_taux / 100)
    await generateDocument({
      type: 'facture',
      entreprise: entrepriseInfo,
      numero: f.numero,
      date_emission: f.date_emission,
      date_echeance: f.date_echeance,
      client_nom: getClientNom(f),
      tva_taux,
      ht,
      tva,
      ttc: f.montant_ttc ?? (ht + tva),
      montant_paye: f.montant_paye,
      notes: f.notes,
      lignes,
    })
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
      ...(newStatut === 'paye' ? { date_paiement: new Date().toISOString() } : {}),
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

  const facturesFiltrees = factures.filter(f => {
    if (filtre === 'impayees') return f.statut !== 'paye'
    if (filtre === 'payees') return f.statut === 'paye'
    return true
  })

  if (loading) return <PageSkeleton />

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Factures</h1>
          <p className="text-gray-500 text-sm mt-1">Suivi des encaissements et paiements</p>
        </div>
        <Link href="/dashboard/devis"
          className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors w-full sm:w-auto">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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
        <div className="px-6 py-4 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-white">
            Liste des factures
            {!loading && <span className="ml-2 text-gray-600 text-[13px] font-normal">({facturesFiltrees.length})</span>}
          </h2>
          <div className="flex gap-1.5 overflow-x-auto">
            {FILTRES_FACTURE.map(f => (
              <button key={f.value} onClick={() => changerFiltre(f.value)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                  filtre === f.value
                    ? 'bg-orange-500 text-white'
                    : 'bg-transparent border border-white/[0.12] text-gray-400 hover:text-white hover:border-white/[0.25]'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          </div>
        ) : facturesFiltrees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-orange-400"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
            </div>
            <p className="text-white text-[14px] font-medium mb-1">
              {factures.length === 0 ? 'Aucune facture' : 'Aucune facture pour ce filtre'}
            </p>
            {factures.length === 0 && (
              <p className="text-gray-600 text-[12px]">
                <Link href="/dashboard/devis" className="text-orange-400 hover:underline">Convertissez un devis accepté</Link> pour créer une facture
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {facturesFiltrees.map(f => {
              const ttc = f.montant_ttc ?? 0
              const paye = f.montant_paye ?? 0
              const restant = Math.max(0, ttc - paye)
              const pct = ttc > 0 ? Math.min(100, Math.round(paye / ttc * 100)) : 0
              const retard = isEnRetard(f)
              const clientNom = getClientNom(f)

              return (
                <div key={f.id} className={`px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition-colors ${retard ? 'border-l-2 border-red-500/40' : ''}`}>
                  {/* Ligne info */}
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-white/[0.04] rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-gray-500"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4" strokeLinecap="round"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white text-[14px] font-semibold whitespace-nowrap">{f.numero}</p>
                            <StatusBadge type="facture" statut={f.statut} />
                            {retard && f.statut !== 'en_retard' && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 whitespace-nowrap">En retard</span>
                            )}
                            {f.mode_paiement && (
                              <span className="text-[10px] text-gray-600 whitespace-nowrap">
                                via {MODES_PAIEMENT.find(m => m.value === f.mode_paiement)?.label ?? f.mode_paiement}
                              </span>
                            )}
                          </div>

                          {/* Client + chantier */}
                          <div className="mt-0.5">
                            {clientNom ? (
                              <p className="text-gray-400 text-[12px] font-medium truncate">
                                {clientNom}{f.chantiers?.nom ? ` · ${f.chantiers.nom}` : ''}
                              </p>
                            ) : (
                              <p className="text-gray-600 text-[12px] truncate">
                                {f.chantiers?.nom ?? '—'}
                              </p>
                            )}
                            {!f.client_telephone && (
                              <button onClick={() => guard(() => openTelModal(f))}
                                className="text-[11px] text-orange-400/70 hover:text-orange-400 font-medium transition-colors mt-0.5">
                                + Ajouter le téléphone
                              </button>
                            )}
                          </div>

                          {/* Dates */}
                          {(f.date_emission || f.date_echeance) && (
                            <p className="text-gray-700 text-[11px] mt-0.5">
                              {f.date_emission && `Émise le ${new Date(f.date_emission).toLocaleDateString('fr-FR')}`}
                              {f.date_echeance && ` · Échéance ${new Date(f.date_echeance).toLocaleDateString('fr-FR')}`}
                            </p>
                          )}
                          {f.notes && (
                            <p className="text-gray-600 text-[11px] mt-1 italic truncate">{f.notes}</p>
                          )}

                          {/* Barre de paiement */}
                          {ttc > 0 && (
                            <div className="mt-2.5">
                              <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-gray-600 tabular-nums">Payé : {fcfa(paye)}</span>
                                <span className="text-gray-700">{pct}%</span>
                              </div>
                              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-white/[0.06]'}`}
                                  style={{ width: `${pct}%` }} />
                              </div>
                              {restant > 0 && (
                                <p className="text-gray-700 text-[10px] mt-1 tabular-nums">Restant : {fcfa(restant)}</p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right hidden sm:block shrink-0 ml-2">
                          <p className="text-white text-[14px] font-bold whitespace-nowrap tabular-nums">{fcfa(ttc)}</p>
                          <p className="text-gray-700 text-[11px]">TTC</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ligne actions */}
                  <div className="mt-2.5 ml-12 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {f.statut !== 'paye' && (
                        <button onClick={() => setPaiementTarget(f)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-medium transition-colors">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3 h-3"><path d="M2 8l5 5L14 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Paiement
                        </button>
                      )}
                      <button onClick={() => setEditTarget(f)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[11px] font-medium transition-colors">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3 h-3">
                          <path d="M11.333 2a1.886 1.886 0 112.667 2.667L5.167 13.5 2 14l.5-3.167L11.333 2z" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Modifier
                      </button>
                      {f.devis_id && (
                        <Link href="/dashboard/devis"
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-white transition-colors" title="Voir le devis">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M14 2H6a1.5 1.5 0 00-1.5 1.5v10A1.5 1.5 0 006 15h8a1.5 1.5 0 001.5-1.5v-10A1.5 1.5 0 0014 2z"/><path d="M14 2v4h-4M8 9h4M8 12h2" strokeLinecap="round"/></svg>
                        </Link>
                      )}
                      <button onClick={() => downloadFacturePDF(f)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-white transition-colors" title="Télécharger PDF">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M8 2v8M5 7l3 3 3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button onClick={() => setDeleteTarget(f)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors" title="Supprimer">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8L13 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                    <p className="text-white text-[13px] font-bold whitespace-nowrap tabular-nums sm:hidden">{fcfa(ttc)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal ajout téléphone legacy ── */}
      {telTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) setTelTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="sm:hidden flex justify-center -mt-3 mb-3"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-white text-[15px] font-semibold">Téléphone du client</h3>
                <p className="text-gray-600 text-[12px] mt-0.5">{telTarget.numero}</p>
              </div>
              <button onClick={() => setTelTarget(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/></svg>
              </button>
            </div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Téléphone WhatsApp</label>
            <input type="tel" value={telVal} onChange={e => setTelVal(e.target.value)} autoFocus
              placeholder="+223 76 00 00 00"
              className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all" />
            <div className="flex gap-3 mt-5">
              <button onClick={() => setTelTarget(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] font-medium">Annuler</button>
              <button onClick={handleSaveTel} disabled={savingTel || !telVal.trim()}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {savingTel ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Enregistrement…</> : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal paiement ── */}
      {paiementTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) setPaiementTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="sm:hidden flex justify-center -mt-3 mb-3"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
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
                className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all" />
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) setEditTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="sm:hidden flex justify-center -mt-3 mb-3"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
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
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all [color-scheme:dark]" />
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
                  {Object.entries(STATUTS_FACTURE).map(([key, def]) => (
                    <button key={key} type="button" onClick={() => setEditStatut(key)}
                      className={`py-2 px-3 rounded-xl border text-[11px] font-medium transition-colors text-left ${editStatut === key ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-white/[0.06] hover:border-white/[0.12] text-gray-500'}`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${statutBarClass('facture', key)}`} />
                      {def.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Notes</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                  placeholder="Informations supplémentaires…" rows={3}
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all resize-none" />
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="sm:hidden flex justify-center -mt-3 mb-3"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
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
