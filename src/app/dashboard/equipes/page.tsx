'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Ouvrier = {
  id: string
  entreprise_id: string
  nom: string
  prenom: string | null
  telephone: string | null
  metier: string | null
  type_contrat: string | null
  taux_journalier: number | null
  actif: boolean | null
  created_at: string
}

type FormData = {
  nom: string
  prenom: string
  telephone: string
  metier: string
  type_contrat: string
  taux_journalier: string
}

const DEFAULT_FORM: FormData = {
  nom: '',
  prenom: '',
  telephone: '',
  metier: '',
  type_contrat: 'journalier',
  taux_journalier: '',
}

const CONTRATS = [
  { value: 'journalier',   label: 'Journalier' },
  { value: 'mensuel',      label: 'Mensuel' },
  { value: 'prestataire',  label: 'Prestataire' },
]

function formatFCFA(v: number | null) {
  if (!v && v !== 0) return '—'
  return v.toLocaleString('fr-FR') + ' FCFA'
}

function initials(nom: string, prenom: string | null) {
  return ((prenom?.[0] ?? '') + nom[0]).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-500/20 text-blue-300',
  'bg-purple-500/20 text-purple-300',
  'bg-emerald-500/20 text-emerald-300',
  'bg-amber-500/20 text-amber-300',
  'bg-rose-500/20 text-rose-300',
  'bg-cyan-500/20 text-cyan-300',
]

export default function EquipesPage() {
  const [ouvriers, setOuvriers] = useState<Ouvrier[]>([])
  const [entrepriseId, setEntrepriseId] = useState<string | null>(null)
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

  const fetchOuvriers = useCallback(async () => {
    const { data, error } = await supabase
      .from('ouvriers')
      .select('*')
      .order('nom', { ascending: true })
    if (error) setPageError(error.message)
    else setOuvriers(data ?? [])
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: profile } = await supabase
        .from('profiles').select('entreprise_id').eq('id', user.id).single()
      if (profile?.entreprise_id) setEntrepriseId(profile.entreprise_id)
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

  function openNew() {
    setEditId(null); setForm(DEFAULT_FORM); setFormError(''); setShowModal(true)
  }
  function openEdit(o: Ouvrier) {
    setEditId(o.id)
    setForm({
      nom: o.nom,
      prenom: o.prenom ?? '',
      telephone: o.telephone ?? '',
      metier: o.metier ?? '',
      type_contrat: o.type_contrat ?? 'journalier',
      taux_journalier: o.taux_journalier != null ? String(o.taux_journalier) : '',
    })
    setFormError(''); setShowModal(true)
  }
  function setField(k: keyof FormData, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!entrepriseId) return
    setSaving(true); setFormError('')
    const payload = {
      nom: form.nom.trim(),
      prenom: form.prenom.trim() || null,
      telephone: form.telephone.trim() || null,
      metier: form.metier.trim() || null,
      type_contrat: form.type_contrat,
      taux_journalier: form.taux_journalier ? Number(form.taux_journalier) : null,
    }
    let err
    if (editId) {
      const r = await supabase.from('ouvriers').update(payload).eq('id', editId)
      err = r.error
    } else {
      const r = await supabase.from('ouvriers').insert({ ...payload, entreprise_id: entrepriseId, actif: true })
      err = r.error
    }
    if (err) { setFormError(err.message); setSaving(false); return }
    setShowModal(false); setSaving(false); await fetchOuvriers()
  }

  async function toggleActif(o: Ouvrier) {
    const { error } = await supabase.from('ouvriers').update({ actif: !o.actif }).eq('id', o.id)
    if (error) setPageError(error.message)
    else await fetchOuvriers()
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
    const matchActif = filtreActif === 'tous' || (filtreActif === 'actif' ? o.actif : !o.actif)
    const q = recherche.toLowerCase()
    const matchRecherche = !q || [o.nom, o.prenom, o.metier].some(v => v?.toLowerCase().includes(q))
    return matchActif && matchRecherche
  })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Équipes</h1>
          <p className="text-gray-500 text-sm mt-1">Gestion des ouvriers, pointages et paie</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Nouvel ouvrier
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1a1a1a] rounded-xl p-1 mb-6 w-fit">
        <span className="px-4 py-2 rounded-lg bg-orange-500/10 text-orange-400 text-[13px] font-medium">Ouvriers</span>
        <Link href="/dashboard/equipes/pointage" className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">Pointage</Link>
        <Link href="/dashboard/equipes/paie" className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">Paie</Link>
      </div>

      {/* Erreur */}
      {pageError && (
        <div className="mb-5 flex items-center gap-2 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {pageError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total ouvriers', value: ouvriers.length, color: 'text-white',        bg: 'bg-white/[0.05]' },
          { label: 'Actifs',         value: actifs,           color: 'text-emerald-400',  bg: 'bg-emerald-500/10' },
          { label: 'Inactifs',       value: inactifs,         color: 'text-gray-400',     bg: 'bg-gray-500/10' },
        ].map(s => (
          <div key={s.label} className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 flex items-center gap-3">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center`}>
              <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
            </div>
            <p className="text-gray-400 text-[13px]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtres + Recherche */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600">
            <circle cx="9" cy="9" r="6" /><path d="M15 15l3 3" strokeLinecap="round" />
          </svg>
          <input type="text" value={recherche} onChange={e => setRecherche(e.target.value)}
            placeholder="Rechercher un ouvrier…"
            className="w-full bg-[#232323] border border-white/[0.06] text-white placeholder-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-[13px] focus:outline-none focus:border-orange-500 transition-all" />
        </div>
        <div className="flex gap-1 bg-[#1a1a1a] rounded-xl p-1">
          {(['tous', 'actif', 'inactif'] as const).map(f => (
            <button key={f} onClick={() => setFiltreActif(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors capitalize ${filtreActif === f ? 'bg-white/[0.08] text-white' : 'text-gray-600 hover:text-gray-300'}`}>
              {f === 'tous' ? 'Tous' : f === 'actif' ? 'Actifs' : 'Inactifs'}
            </button>
          ))}
        </div>
      </div>

      {/* Liste ouvriers */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-[15px] font-semibold text-white">
            Liste des ouvriers
            {!loading && <span className="ml-2 text-gray-600 text-[13px] font-normal">({ouvriersFiltres.length})</span>}
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
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-white text-[14px] font-medium mb-1">
              {recherche ? 'Aucun résultat' : 'Aucun ouvrier'}
            </p>
            <p className="text-gray-600 text-[12px]">
              {recherche ? 'Essayez un autre terme de recherche' : 'Ajoutez votre premier ouvrier'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {ouvriersFiltres.map((o, i) => {
              const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length]
              const contrat = CONTRATS.find(c => c.value === o.type_contrat)
              return (
                <div key={o.id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[13px] font-bold ${avatarColor}`}>
                      {initials(o.nom, o.prenom)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-[14px] font-medium truncate">
                        {o.prenom ? `${o.prenom} ${o.nom}` : o.nom}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {o.metier && <span className="text-gray-500 text-[12px]">{o.metier}</span>}
                        {o.metier && o.type_contrat && <span className="text-gray-700 text-[11px]">·</span>}
                        {contrat && <span className="text-gray-600 text-[11px]">{contrat.label}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-gray-300 text-[13px] font-medium">{formatFCFA(o.taux_journalier)}</p>
                      <p className="text-gray-700 text-[11px]">/ jour</p>
                    </div>
                    {o.telephone && (
                      <span className="text-gray-600 text-[12px] hidden md:block">{o.telephone}</span>
                    )}
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${o.actif ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'}`}>
                      {o.actif ? 'Actif' : 'Inactif'}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(o)} title="Modifier"
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-white transition-colors">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
                          <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button onClick={() => toggleActif(o)} title={o.actif ? 'Désactiver' : 'Activer'}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] transition-colors ${o.actif ? 'hover:bg-amber-500/10 text-gray-500 hover:text-amber-400' : 'hover:bg-emerald-500/10 text-gray-500 hover:text-emerald-400'}`}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
                          {o.actif
                            ? <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM5 8h6" strokeLinecap="round" />
                            : <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM6 8l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" />}
                        </svg>
                      </button>
                      <button onClick={() => setDeleteTarget(o)} title="Supprimer"
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
                          <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8L13 4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal formulaire */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
              <h2 className="text-[15px] font-semibold text-white">
                {editId ? 'Modifier l\'ouvrier' : 'Nouvel ouvrier'}
              </h2>
              <button onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M2 2l12 12M14 2L2 14" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {([['prenom', 'Prénom', 'Ex: Mamadou'], ['nom', 'Nom', 'Ex: Diarra']] as const).map(([k, label, ph]) => (
                  <div key={k}>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                      {label}{k === 'nom' && <span className="text-orange-400 ml-0.5">*</span>}
                    </label>
                    <input type="text" value={form[k]} onChange={e => setField(k, e.target.value)}
                      required={k === 'nom'} placeholder={ph}
                      className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Téléphone</label>
                  <input type="tel" value={form.telephone} onChange={e => setField('telephone', e.target.value)}
                    placeholder="+223 XX XX XX XX"
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Métier</label>
                  <input type="text" value={form.metier} onChange={e => setField('metier', e.target.value)}
                    placeholder="Ex: Maçon, Coffreur…"
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Type de contrat</label>
                  <select value={form.type_contrat} onChange={e => setField('type_contrat', e.target.value)}
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all">
                    {CONTRATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Taux journalier (FCFA)</label>
                  <input type="number" min="0" value={form.taux_journalier} onChange={e => setField('taux_journalier', e.target.value)}
                    placeholder="Ex: 7500"
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white text-[13px] font-medium transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving
                    ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Enregistrement…</>
                    : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <h3 className="text-white text-[15px] font-semibold text-center mb-2">Supprimer l&apos;ouvrier ?</h3>
            <p className="text-gray-500 text-[13px] text-center mb-5">
              <span className="text-gray-300 font-medium">{deleteTarget.prenom} {deleteTarget.nom}</span> et tous ses pointages seront supprimés.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white text-[13px] font-medium transition-colors">Annuler</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {deleting
                  ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Suppression…</>
                  : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
