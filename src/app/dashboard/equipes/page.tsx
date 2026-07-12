'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageSkeleton from '@/components/PageSkeleton'
import { useActionGuard } from '@/hooks/useActionGuard'
import PageTooltip from '@/components/PageTooltip'

const supabase = createClient()

type Ouvrier = {
  id: string; entreprise_id: string; nom: string; prenom: string | null
  telephone: string | null; metier: string | null; type_contrat: string | null
  taux_journalier: number | null; actif: boolean | null; created_at: string
  numero_cni: string | null; date_embauche: string | null; adresse: string | null
  contact_urgence: string | null; photo_url: string | null
}

type FormData = {
  nom: string; prenom: string; telephone: string; metier: string
  type_contrat: string; taux_journalier: string
  date_embauche: string; contact_urgence: string
}

type FicheHistorique = {
  totalJours: number; totalPaye: number
  chantiers: { id: string; nom: string }[]
  pointagesMois: { date: string; statut: string | null; present: boolean | null }[]
}

const DEFAULT_FORM: FormData = {
  nom: '', prenom: '', telephone: '', metier: '', type_contrat: 'journalier',
  taux_journalier: '', date_embauche: '', contact_urgence: '',
}

const CONTRATS = [
  { value: 'journalier', label: 'Journalier' },
  { value: 'hebdomadaire', label: 'Hebdomadaire' },
  { value: 'mensuel', label: 'Mensuel' },
]

const METIERS = [
  'Maçon', 'Ferrailleur', 'Coffreur', 'Carreleur', 'Électricien', 'Plombier', 'Autre',
]

const AVATAR_COLORS = [
  'bg-blue-500/20 text-blue-300', 'bg-purple-500/20 text-purple-300',
  'bg-emerald-500/20 text-emerald-300', 'bg-amber-500/20 text-amber-300',
  'bg-rose-500/20 text-rose-300', 'bg-cyan-500/20 text-cyan-300',
]

const INPUT_CLS = 'w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all'
const LABEL_CLS = 'block text-[10px] font-bold uppercase tracking-[0.09em] text-gray-600 mb-1.5'

const STATUT_CAL: Record<string, string> = {
  present: 'bg-emerald-500/25 text-emerald-300',
  demi_journee: 'bg-amber-500/25 text-amber-300',
  maladie: 'bg-blue-500/25 text-blue-300',
  conge: 'bg-purple-500/25 text-purple-300',
  absent: 'bg-red-500/15 text-red-400/80',
}

const MOIS_ABR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function formatFCFA(v: number | null) {
  if (!v && v !== 0) return '—'
  return v.toLocaleString('fr-FR') + ' FCFA'
}
function initials(nom: string, prenom: string | null) {
  return ((prenom?.[0] ?? '') + nom[0]).toUpperCase()
}
function formatDate(d: string | null) {
  if (!d) return '—'
  try { return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return d }
}

function CalendrierMini({ pts }: { pts: { date: string; statut: string | null; present: boolean | null }[] }) {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth()
  const dim = new Date(y, m + 1, 0).getDate()
  let sd = new Date(y, m, 1).getDay(); if (sd === 0) sd = 7
  const map: Record<string, string> = {}
  pts.forEach(p => { map[p.date] = p.statut ?? (p.present === true ? 'present' : 'absent') })
  const cells: (null | { day: number; statut: string | null })[] = []
  for (let i = 0; i < sd - 1; i++) cells.push(null)
  for (let d = 1; d <= dim; d++) {
    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, statut: map[ds] ?? null })
  }
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-gray-600 mb-3">Pointage — {MOIS_ABR[m]} {y}</p>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['L','M','M','J','V','S','D'].map((d, i) => <span key={i} className="text-[9px] text-gray-700 text-center font-bold">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => c === null ? <div key={i} /> :
          <div key={i} className={`h-[22px] rounded flex items-center justify-center text-[10px] font-medium ${c.statut ? (STATUT_CAL[c.statut] ?? 'bg-white/[0.03] text-gray-700') : 'bg-white/[0.03] text-gray-700'}`}>
            {c.day}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {[['present','bg-emerald-500','Présent'],['demi_journee','bg-amber-500','Demi-j.'],['maladie','bg-blue-400','Maladie'],['conge','bg-purple-400','Congé'],['absent','bg-red-400/60','Absent']].map(([k,c,l]) => (
          <span key={k} className="flex items-center gap-1 text-[10px] text-gray-600">
            <span className={`w-1.5 h-1.5 rounded-full ${c} shrink-0`} />{l}
          </span>
        ))}
      </div>
    </div>
  )
}

function FicheDrawer({ ouvrier, hist, loadingHist, onClose, onEdit, onToggle, colorCls }: {
  ouvrier: Ouvrier; hist: FicheHistorique | null; loadingHist: boolean
  onClose: () => void; onEdit: (o: Ouvrier) => void; onToggle: (o: Ouvrier) => void; colorCls: string
}) {
  const contrat = CONTRATS.find(c => c.value === ouvrier.type_contrat)
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-[400px] bg-[#171717] border-l border-white/[0.06] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">Fiche ouvrier</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M2 2l12 12M14 2L2 14" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {/* Profil */}
          <div className="px-5 pt-5 pb-5 border-b border-white/[0.06]">
            <div className="flex items-start gap-4 mb-4">
              {ouvrier.photo_url
                ? <img src={ouvrier.photo_url} alt="" className="w-[60px] h-[60px] rounded-2xl object-cover shrink-0" />
                : <div className={`w-[60px] h-[60px] rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 ${colorCls}`}>{initials(ouvrier.nom, ouvrier.prenom)}</div>}
              <div className="min-w-0 flex-1">
                <p className="text-white text-[17px] font-bold leading-tight tracking-[-0.01em]">
                  {ouvrier.prenom ? `${ouvrier.prenom} ${ouvrier.nom}` : ouvrier.nom}
                </p>
                {ouvrier.metier && <p className="text-gray-500 text-[13px] mt-0.5">{ouvrier.metier}</p>}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ouvrier.actif ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-500'}`}>
                    {ouvrier.actif ? 'Actif' : 'Inactif'}
                  </span>
                  {contrat && <span className="text-[11px] text-gray-600 bg-white/[0.04] px-2 py-0.5 rounded-full">{contrat.label}</span>}
                </div>
              </div>
            </div>
            {ouvrier.taux_journalier != null && (
              <div className="flex items-center justify-between bg-orange-500/[0.07] border border-orange-500/15 rounded-xl px-4 py-2.5">
                <span className="text-gray-500 text-[12px]">
                  {ouvrier.type_contrat === 'hebdomadaire' ? 'Taux hebdomadaire' :
                   ouvrier.type_contrat === 'mensuel' ? 'Taux mensuel' : 'Taux journalier'}
                </span>
                <span className="text-orange-400 font-bold text-[15px]">{formatFCFA(ouvrier.taux_journalier)}</span>
              </div>
            )}
          </div>

          {/* Informations */}
          <div className="px-5 py-5 border-b border-white/[0.06]">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-600 mb-4">Informations</p>
            <div className="space-y-3.5">
              {([
                ['📞', 'Téléphone', ouvrier.telephone],
                ['🪪', 'CNI / NINA', ouvrier.numero_cni],
                ['📅', "Date d'embauche", formatDate(ouvrier.date_embauche)],
                ['📍', 'Adresse / Quartier', ouvrier.adresse],
                ['🆘', 'Urgence', ouvrier.contact_urgence],
              ] as [string, string, string | null][]).map(([icon, label, val]) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="shrink-0 text-[13px] mt-0.5 opacity-60">{icon}</span>
                  <div className="min-w-0">
                    <p className="text-gray-600 text-[10px] uppercase tracking-[0.07em] font-bold">{label}</p>
                    <p className={`text-[13px] mt-0.5 ${val ? 'text-gray-300' : 'text-gray-700'}`}>{val || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Historique */}
          {loadingHist ? (
            <div className="flex items-center justify-center py-10">
              <svg className="animate-spin w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : hist ? (
            <>
              <div className="px-5 py-5 border-b border-white/[0.06]">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-600 mb-4">Historique global</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/[0.03] rounded-xl border border-white/[0.04] p-4">
                    <p className="text-white text-[22px] font-bold leading-none">{hist.totalJours}</p>
                    <p className="text-gray-600 text-[11px] mt-1">Jours travaillés</p>
                  </div>
                  <div className="bg-orange-500/[0.07] rounded-xl border border-orange-500/10 p-4">
                    <p className="text-orange-400 text-[17px] font-bold leading-none">
                      {hist.totalPaye >= 1_000_000 ? `${(hist.totalPaye/1_000_000).toFixed(1)}M`
                        : hist.totalPaye >= 1_000 ? `${(hist.totalPaye/1_000).toFixed(0)}K`
                        : hist.totalPaye.toLocaleString('fr-FR')}
                    </p>
                    <p className="text-gray-600 text-[11px] mt-1">FCFA versés</p>
                  </div>
                </div>
                {hist.chantiers.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-gray-600 mb-2">Chantiers</p>
                    <div className="space-y-1">
                      {hist.chantiers.map(c => (
                        <div key={c.id} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500/50 shrink-0" />
                          <span className="text-gray-400 text-[12px]">{c.nom}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-5 py-5">
                <CalendrierMini pts={hist.pointagesMois} />
              </div>
            </>
          ) : null}
        </div>

        <div className="px-5 py-4 border-t border-white/[0.06] flex gap-3 shrink-0">
          <button onClick={() => { onEdit(ouvrier); onClose() }}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-colors">
            Modifier
          </button>
          <button onClick={() => onToggle(ouvrier)}
            className={`flex-1 py-2.5 rounded-xl border text-[13px] font-semibold transition-colors ${ouvrier.actif ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}`}>
            {ouvrier.actif ? 'Désactiver' : 'Réactiver'}
          </button>
        </div>
      </aside>
    </>
  )
}

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

export default function EquipesPage() {
  const { guard, isReadOnly } = useActionGuard()
  const [ouvriers, setOuvriers] = useState<Ouvrier[]>([])
  const [entrepriseId, setEntrepriseId] = useState<string | null>(null)
  const entrepriseIdRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Ouvrier | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [filtreActif, setFiltreActif] = useState<'tous' | 'actif' | 'inactif'>('tous')
  const [recherche, setRecherche] = useState('')
  const [selectedOuvrier, setSelectedOuvrier] = useState<Ouvrier | null>(null)
  const [ficheHist, setFicheHist] = useState<FicheHistorique | null>(null)
  const [loadingFiche, setLoadingFiche] = useState(false)

  const fetchOuvriers = useCallback(async () => {
    const eid = entrepriseIdRef.current
    if (!eid) return
    const { data, error } = await supabase.from('ouvriers').select('*').eq('entreprise_id', eid).order('nom')
    if (error) setPageError(error.message)
    else setOuvriers(data ?? [])
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: profile } = await supabase.from('profiles').select('entreprise_id').eq('id', user.id).single()
      if (profile?.entreprise_id) {
        setEntrepriseId(profile.entreprise_id)
        entrepriseIdRef.current = profile.entreprise_id
      }
      await fetchOuvriers()
      setLoading(false)
    }
    init()
  }, [fetchOuvriers])

  useEffect(() => {
    if (!showModal) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [showModal])

  useEffect(() => {
    if (!selectedOuvrier) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedOuvrier(null) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [selectedOuvrier])

  async function openFiche(o: Ouvrier) {
    setSelectedOuvrier(o); setFicheHist(null); setLoadingFiche(true)
    try {
      const now = new Date()
      const y = now.getFullYear(); const m = String(now.getMonth() + 1).padStart(2, '0')
      const firstDay = `${y}-${m}-01`
      const lastDay = `${y}-${m}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`
      const [a, b, c] = await Promise.all([
        supabase.from('pointages').select('montant_jour').eq('ouvrier_id', o.id).eq('present', true),
        supabase.from('pointages').select('chantier_id, chantiers(id, nom)').eq('ouvrier_id', o.id).eq('present', true),
        supabase.from('pointages').select('date_pointage, statut_presence, present').eq('ouvrier_id', o.id).gte('date_pointage', firstDay).lte('date_pointage', lastDay),
      ])
      const chantiersMap: Record<string, { id: string; nom: string }> = {}
      b.data?.forEach(p => {
        if (p.chantier_id && p.chantiers) {
          const ch = p.chantiers as unknown as { id: string; nom: string }
          chantiersMap[p.chantier_id] = { id: ch.id, nom: ch.nom }
        }
      })
      setFicheHist({
        totalJours: a.data?.length ?? 0,
        totalPaye: a.data?.reduce((s, p) => s + (p.montant_jour ?? 0), 0) ?? 0,
        chantiers: Object.values(chantiersMap),
        pointagesMois: (c.data ?? []).map(p => ({
          date: p.date_pointage as string,
          statut: p.statut_presence as string | null,
          present: p.present as boolean | null,
        })),
      })
    } finally { setLoadingFiche(false) }
  }

  function openNew() { setEditId(null); setForm(DEFAULT_FORM); setFormError(''); setShowModal(true) }
  function openEdit(o: Ouvrier) {
    setEditId(o.id)
    setForm({
      nom: o.nom, prenom: o.prenom ?? '', telephone: o.telephone ?? '',
      metier: o.metier ?? '', type_contrat: o.type_contrat ?? 'journalier',
      taux_journalier: o.taux_journalier != null ? String(o.taux_journalier) : '',
      date_embauche: o.date_embauche ?? '', contact_urgence: o.contact_urgence ?? '',
    })
    setFormError(''); setShowModal(true)
  }
  function setField(k: keyof FormData, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!entrepriseId) return
    setSaving(true); setFormError('')
    const payload = {
      nom: form.nom.trim(), prenom: form.prenom.trim() || null,
      telephone: form.telephone.trim() || null, metier: form.metier || null,
      type_contrat: form.type_contrat,
      taux_journalier: form.taux_journalier ? Number(form.taux_journalier) : null,
      date_embauche: form.date_embauche || null,
      contact_urgence: form.contact_urgence.trim() || null,
    }
    let err
    if (editId) ({ error: err } = await supabase.from('ouvriers').update(payload).eq('id', editId))
    else ({ error: err } = await supabase.from('ouvriers').insert({ ...payload, entreprise_id: entrepriseId, actif: true }))
    if (err) { setFormError(err.message); setSaving(false); return }
    setShowModal(false); setSaving(false); await fetchOuvriers()
  }

  async function toggleActif(o: Ouvrier) {
    const { error } = await supabase.from('ouvriers').update({ actif: !o.actif }).eq('id', o.id)
    if (error) { setPageError(error.message); return }
    await fetchOuvriers()
    if (selectedOuvrier?.id === o.id) setSelectedOuvrier(prev => prev ? { ...prev, actif: !prev.actif } : null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('ouvriers').delete().eq('id', deleteTarget.id)
    if (error) setPageError(error.message)
    setDeleteTarget(null); setDeleting(false); await fetchOuvriers()
  }

  const actifs = ouvriers.filter(o => o.actif).length
  const inactifs = ouvriers.filter(o => !o.actif).length
  const ouvriersFiltres = ouvriers.filter(o => {
    const matchActif = filtreActif === 'tous' || (filtreActif === 'actif' ? !!o.actif : !o.actif)
    const q = recherche.toLowerCase()
    return matchActif && (!q || [o.nom, o.prenom, o.metier].some(v => v?.toLowerCase().includes(q)))
  })

  if (loading) return <PageSkeleton />

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {selectedOuvrier && (
        <FicheDrawer
          ouvrier={selectedOuvrier} hist={ficheHist} loadingHist={loadingFiche}
          onClose={() => setSelectedOuvrier(null)} onEdit={openEdit} onToggle={toggleActif}
          colorCls={AVATAR_COLORS[ouvriers.findIndex(o => o.id === selectedOuvrier.id) % AVATAR_COLORS.length]}
        />
      )}

      <PageTooltip pageKey="equipes" message="Ajoutez vos ouvriers ici, puis pointez-les chaque matin en 1 clic. La paie se calcule automatiquement." />

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-[-0.02em]">Équipes</h1>
          <p className="text-gray-500 text-[13px] mt-1">Ouvriers, pointages et paie</p>
        </div>
        <button onClick={() => guard(openNew)} className={`flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors w-full sm:w-auto ${isReadOnly ? 'opacity-60' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          Nouvel ouvrier
        </button>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto mb-6">
        <div className="flex gap-1 bg-[#1a1a1a] rounded-xl p-1 w-fit">
          <span className="px-4 py-2 rounded-lg bg-orange-500/10 text-orange-400 text-[13px] font-medium">Ouvriers</span>
          <Link href="/dashboard/equipes/pointage" className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">Pointage</Link>
          <Link href="/dashboard/equipes/avances" className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">Avances</Link>
          <Link href="/dashboard/equipes/paie" className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">Paie</Link>
        </div>
      </div>

      {pageError && (
        <div className="mb-5 flex items-center gap-2 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
          {pageError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total', value: ouvriers.length, color: 'text-white', bg: 'bg-white/[0.04]' },
          { label: 'Actifs', value: actifs, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Inactifs', value: inactifs, color: 'text-gray-500', bg: 'bg-gray-500/10' },
        ].map(s => (
          <div key={s.label} className="bg-[#232323] rounded-2xl border border-white/[0.06] p-4 sm:p-5 flex items-center gap-3">
            <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center shrink-0`}>
              <span className={`text-base font-bold ${s.color}`}>{s.value}</span>
            </div>
            <p className="text-gray-500 text-[12px]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600">
            <circle cx="9" cy="9" r="6" /><path d="M15 15l3 3" strokeLinecap="round" />
          </svg>
          <input type="text" value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher…"
            className="w-full bg-[#232323] border border-white/[0.06] text-white placeholder-gray-600 rounded-xl pl-9 pr-4 py-2.5 text-[13px] focus:outline-none focus:border-orange-500 transition-all" />
        </div>
        <div className="flex gap-0.5 bg-[#1a1a1a] rounded-xl p-1">
          {(['tous', 'actif', 'inactif'] as const).map(f => (
            <button key={f} onClick={() => setFiltreActif(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${filtreActif === f ? 'bg-white/[0.08] text-white' : 'text-gray-600 hover:text-gray-300'}`}>
              {f === 'tous' ? 'Tous' : f === 'actif' ? 'Actifs' : 'Inactifs'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-[14px] font-semibold text-white">
            Ouvriers{!loading && <span className="ml-2 text-gray-600 text-[12px] font-normal">({ouvriersFiltres.length})</span>}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : ouvriersFiltres.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-orange-400">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-white text-[14px] font-medium mb-1">{recherche ? 'Aucun résultat' : 'Aucun ouvrier'}</p>
            <p className="text-gray-600 text-[12px]">{recherche ? 'Essayez un autre terme' : 'Ajoutez votre premier ouvrier'}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {ouvriersFiltres.map((o, i) => {
              const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length]
              const contrat = CONTRATS.find(c => c.value === o.type_contrat)
              return (
                <div key={o.id} onClick={() => openFiche(o)}
                  className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors group cursor-pointer">
                  <div className="flex items-center gap-3 min-w-0">
                    {o.photo_url
                      ? <img src={o.photo_url} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />
                      : <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[12px] font-bold ${avatarColor}`}>{initials(o.nom, o.prenom)}</div>}
                    <div className="min-w-0">
                      <p className="text-white text-[14px] font-medium truncate">{o.prenom ? `${o.prenom} ${o.nom}` : o.nom}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {o.metier && <span className="text-gray-500 text-[12px]">{o.metier}</span>}
                        {o.metier && contrat && <span className="text-gray-700 text-[11px]">·</span>}
                        {contrat && <span className="text-gray-600 text-[11px]">{contrat.label}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-gray-300 text-[13px] font-medium">{formatFCFA(o.taux_journalier)}</p>
                      <p className="text-gray-700 text-[11px]">
                        {o.type_contrat === 'hebdomadaire' ? '/ sem.' : o.type_contrat === 'mensuel' ? '/ mois' : '/ jour'}
                      </p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${o.actif ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-500'}`}>
                      {o.actif ? 'Actif' : 'Inactif'}
                    </span>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => guard(() => openEdit(o))} title="Modifier" className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-white transition-colors">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5"><path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      <button onClick={() => toggleActif(o)} title={o.actif ? 'Désactiver' : 'Activer'}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] transition-colors ${o.actif ? 'hover:bg-amber-500/10 text-gray-500 hover:text-amber-400' : 'hover:bg-emerald-500/10 text-gray-500 hover:text-emerald-400'}`}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
                          {o.actif ? <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM5 8h6" strokeLinecap="round" />
                            : <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM6 8l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" />}
                        </svg>
                      </button>
                      <button onClick={() => guard(() => setDeleteTarget(o))} title="Supprimer" className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8L13 4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
              <h2 className="text-[14px] font-semibold text-white">{editId ? "Modifier l'ouvrier" : 'Nouvel ouvrier'}</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M2 2l12 12M14 2L2 14" strokeLinecap="round" /></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {formError && <div className="flex items-center gap-2 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">{formError}</div>}

              {/* Ligne 1 : Prénom + Nom */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Prénom <span className="text-orange-400">*</span></label>
                  <input type="text" value={form.prenom} onChange={e => setField('prenom', e.target.value)} placeholder="Mamadou" required autoFocus className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Nom <span className="text-orange-400">*</span></label>
                  <input type="text" value={form.nom} onChange={e => setField('nom', e.target.value)} placeholder="Diarra" required className={INPUT_CLS} />
                </div>
              </div>

              {/* Ligne 2 : Métier */}
              <div>
                <label className={LABEL_CLS}>Métier <span className="text-orange-400">*</span></label>
                <select value={form.metier} onChange={e => setField('metier', e.target.value)} required className={INPUT_CLS}>
                  <option value="">— Sélectionner un métier —</option>
                  {METIERS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Ligne 3 : Contrat + Taux */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Contrat <span className="text-orange-400">*</span></label>
                  <select value={form.type_contrat} onChange={e => setField('type_contrat', e.target.value)} className={INPUT_CLS}>
                    {CONTRATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>
                    {form.type_contrat === 'hebdomadaire' ? 'Taux / sem. (FCFA)' : 'Taux / jour (FCFA)'}{' '}
                    <span className="text-orange-400">*</span>
                  </label>
                  <input type="number" min="0" value={form.taux_journalier} onChange={e => setField('taux_journalier', e.target.value)} placeholder={form.type_contrat === 'hebdomadaire' ? '25 000' : '7 500'} required className={INPUT_CLS} />
                </div>
              </div>

              {/* Séparateur optionnel */}
              <div className="border-t border-white/[0.05] pt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-600 mb-3">Optionnel</p>
                <div className="space-y-3">
                  <div>
                    <label className={LABEL_CLS}>Téléphone</label>
                    <input type="tel" value={form.telephone} onChange={e => setField('telephone', e.target.value)} placeholder="+223 76 00 00 00" className={INPUT_CLS} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLS}>Date d&apos;embauche</label>
                      <input type="date" value={form.date_embauche} onChange={e => setField('date_embauche', e.target.value)} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Contact urgence</label>
                      <input type="text" value={form.contact_urgence} onChange={e => setField('contact_urgence', e.target.value)} placeholder="Nom — +223 …" className={INPUT_CLS} />
                    </div>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[14px] font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <><Spinner />Enregistrement…</> : 'Enregistrer'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="sm:hidden flex justify-center -mt-3 mb-3"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <h3 className="text-white text-[15px] font-semibold text-center mb-2">Supprimer l&apos;ouvrier ?</h3>
            <p className="text-gray-500 text-[13px] text-center mb-5">
              <span className="text-gray-300 font-medium">{deleteTarget.prenom} {deleteTarget.nom}</span> et tous ses pointages seront supprimés.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white text-[13px] font-medium transition-colors">Annuler</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {deleting ? <><Spinner />Suppression…</> : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
