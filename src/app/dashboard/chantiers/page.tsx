'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cacheSet, cacheGet } from '@/lib/offline'

const supabase = createClient()

type Chantier = {
  id: string
  nom: string
  client_nom: string
  client_telephone: string | null
  adresse: string | null
  ville: string | null
  statut: string | null
  date_debut: string | null
  date_fin_prevue: string | null
  budget_prevu: number | null
  avancement: number | null
  chef_chantier_id: string | null
  marche_public: boolean | null
  created_at: string
}

type FormData = {
  nom: string
  client_nom: string
  client_telephone: string
  client_email: string
  ville: string
  date_debut: string
  date_fin_prevue: string
  budget_prevu: string
  statut: string
  avancement: string
}

const DEFAULT_FORM: FormData = {
  nom: '',
  client_nom: '',
  client_telephone: '',
  client_email: '',
  ville: 'Bamako',
  date_debut: '',
  date_fin_prevue: '',
  budget_prevu: '',
  statut: 'preparation',
  avancement: '0',
}

const STATUTS = [
  { value: 'preparation', label: 'Préparation', badge: 'bg-blue-500/10 text-blue-400', bar: 'bg-blue-400' },
  { value: 'en_cours', label: 'En cours', badge: 'bg-emerald-500/10 text-emerald-400', bar: 'bg-emerald-500' },
  { value: 'en_pause', label: 'En pause', badge: 'bg-amber-500/10 text-amber-400', bar: 'bg-amber-500' },
  { value: 'termine', label: 'Terminé', badge: 'bg-gray-500/10 text-gray-400', bar: 'bg-gray-400' },
  { value: 'annule', label: 'Annulé', badge: 'bg-red-500/10 text-red-400', bar: 'bg-red-400' },
]

function getStatut(value: string | null) {
  return STATUTS.find(s => s.value === value) ?? STATUTS[1]
}

function formatBudget(val: number | null): string {
  if (!val && val !== 0) return '—'
  return val.toLocaleString('fr-FR') + ' FCFA'
}

function InputField({
  label, type = 'text', value, onChange, required, placeholder, min, max
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
  min?: string
  max?: string
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
        {label}{required && <span className="text-orange-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all"
      />
    </div>
  )
}

export default function ChantiersPage() {
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [entrepriseId, setEntrepriseId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<Chantier | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchChantiers = useCallback(async (eid: string) => {
    // Offline : charger depuis le cache localStorage
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = cacheGet<Chantier[]>('chantiers')
      if (cached) setChantiers(cached)
      else setPageError('Hors ligne — aucune donnée en cache disponible.')
      return
    }

    const { data, error } = await supabase
      .from('chantiers')
      .select('*')
      .eq('entreprise_id', eid)
      .order('created_at', { ascending: false })
    if (error) setPageError(error.message)
    else {
      setChantiers(data ?? [])
      // Sauvegarder en cache pour usage offline
      if (data) cacheSet('chantiers', data)
    }
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('entreprise_id')
        .eq('id', user.id)
        .single()

      if (!profile?.entreprise_id) {
        setPageError("Aucune entreprise associée à votre compte.")
        setLoading(false)
        return
      }

      setEntrepriseId(profile.entreprise_id)
      await fetchChantiers(profile.entreprise_id)
      setLoading(false)
    }
    init()
  }, [fetchChantiers])

  useEffect(() => {
    if (!showModal) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showModal])

  function openNew() {
    setEditId(null)
    setForm(DEFAULT_FORM)
    setFormError('')
    setShowModal(true)
  }

  function openEdit(c: Chantier) {
    setEditId(c.id)
    setForm({
      nom: c.nom,
      client_nom: c.client_nom,
      client_telephone: c.client_telephone ?? '',
      client_email: (c as Chantier & { client_email?: string }).client_email ?? '',
      ville: c.ville ?? 'Bamako',
      date_debut: c.date_debut ?? '',
      date_fin_prevue: c.date_fin_prevue ?? '',
      budget_prevu: c.budget_prevu != null ? String(c.budget_prevu) : '',
      statut: c.statut ?? 'preparation',
      avancement: c.avancement != null ? String(c.avancement) : '0',
    })
    setFormError('')
    setShowModal(true)
  }

  function setField(key: keyof FormData, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!entrepriseId) return
    setSaving(true)
    setFormError('')

    const payload = {
      nom: form.nom.trim(),
      client_nom: form.client_nom.trim(),
      client_telephone: form.client_telephone.trim() || null,
      client_email: form.client_email.trim() || null,
      ville: form.ville.trim() || 'Bamako',
      date_debut: form.date_debut || null,
      date_fin_prevue: form.date_fin_prevue || null,
      budget_prevu: form.budget_prevu ? Number(form.budget_prevu) : null,
      statut: form.statut,
      avancement: Math.min(100, Math.max(0, Number(form.avancement) || 0)),
    }

    let err
    if (editId) {
      const res = await supabase.from('chantiers').update(payload).eq('id', editId)
      err = res.error
    } else {
      const res = await supabase.from('chantiers').insert({ ...payload, entreprise_id: entrepriseId })
      err = res.error
    }

    if (err) {
      setFormError(err.message)
      setSaving(false)
      return
    }

    setShowModal(false)
    setSaving(false)
    await fetchChantiers(entrepriseId)
  }

  async function handleDelete() {
    if (!deleteTarget || !entrepriseId) return
    setDeleting(true)
    const { error } = await supabase.from('chantiers').delete().eq('id', deleteTarget.id)
    if (error) setPageError(error.message)
    setDeleteTarget(null)
    setDeleting(false)
    await fetchChantiers(entrepriseId)
  }

  const actifs = chantiers.filter(c => c.statut === 'en_cours').length
  const enPause = chantiers.filter(c => c.statut === 'en_pause').length
  const termines = chantiers.filter(c => c.statut === 'termine').length

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* En-tête */}
      <div className="mb-6 md:mb-8 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Chantiers</h1>
          <p className="text-gray-500 text-sm mt-1">Gestion et suivi de vos chantiers actifs</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors min-h-[44px] shrink-0"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Nouveau chantier
        </button>
      </div>

      {/* Erreur page */}
      {pageError && (
        <div className="mb-6 flex items-center gap-2.5 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {pageError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6 md:mb-8">
        {[
          { label: 'En cours', value: actifs, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'En pause', value: enPause, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Terminés', value: termines, color: 'text-gray-400', bg: 'bg-gray-500/10' },
        ].map(s => (
          <div key={s.label} className="bg-[#232323] rounded-2xl border border-white/[0.06] p-3 sm:p-5 flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 ${s.bg} rounded-xl flex items-center justify-center shrink-0`}>
              <span className={`text-base sm:text-lg font-bold ${s.color}`}>{s.value}</span>
            </div>
            <p className="text-gray-400 text-[11px] sm:text-[13px] text-center sm:text-left">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Liste */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-white">
            Liste des chantiers
            {!loading && <span className="ml-2 text-gray-600 text-[13px] font-normal">({chantiers.length})</span>}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : chantiers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-orange-400">
                <path d="M3 21h18M5 21V11m14 0v10M3 11l9-7 9 7M10 21v-5h4v5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-white text-[15px] font-medium mb-1">Aucun chantier</p>
            <p className="text-gray-600 text-[13px]">Créez votre premier chantier pour commencer</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {chantiers.map(c => {
              const statut = getStatut(c.statut)
              return (
                <div key={c.id} className="px-6 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    {/* Icône + infos */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-orange-400">
                          <path d="M3 21h18M5 21V11m14 0v10M3 11l9-7 9 7M10 21v-5h4v5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-[14px] font-medium truncate">{c.nom}</p>
                        <p className="text-gray-500 text-[12px] mt-0.5">{c.client_nom}</p>
                        {c.ville && (
                          <p className="text-gray-700 text-[11px] mt-0.5 flex items-center gap-1">
                            <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5">
                              <path fillRule="evenodd" d="M8 1.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM2 6a6 6 0 1110.174 4.31c-.203.196-.43.402-.662.616-.472.444-.973.954-1.512 1.574a.75.75 0 01-1.149-.965c.548-.651 1.07-1.182 1.567-1.649.237-.222.46-.426.649-.614A6 6 0 012 6z" clipRule="evenodd" />
                            </svg>
                            {c.ville}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Droite */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-gray-300 text-[13px] font-medium">{formatBudget(c.budget_prevu)}</p>
                        {c.date_fin_prevue && (
                          <p className="text-gray-700 text-[11px] mt-0.5">
                            Fin : {new Date(c.date_fin_prevue).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                      <span className={`text-[10px] sm:text-[11px] font-medium px-2 sm:px-2.5 py-1 rounded-full whitespace-nowrap ${statut.badge}`}>
                        {statut.label}
                      </span>
                      {/* Actions */}
                      <Link
                        href={`/dashboard/chantiers/${c.id}`}
                        className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 transition-colors text-[11px] sm:text-[12px] font-medium"
                        title="Détail & Partage"
                      >
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5 shrink-0">
                          <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>
                        </svg>
                        Détail
                      </Link>
                      {/* Planning — masqué sur mobile */}
                      <Link
                        href={`/dashboard/chantiers/${c.id}/planning`}
                        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-orange-500/10 text-gray-400 hover:text-orange-400 transition-colors text-[12px] font-medium"
                        title="Voir le planning"
                      >
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
                          <rect x="2" y="2" width="12" height="12" rx="1.5" />
                          <path d="M5 1v2M11 1v2M2 6h12" strokeLinecap="round" />
                          <path d="M5 9h.01M8 9h.01M11 9h.01M5 12h.01M8 12h.01" strokeLinecap="round" strokeWidth="2" />
                        </svg>
                        Planning
                      </Link>
                      <button
                        onClick={() => openEdit(c)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white transition-colors"
                        title="Modifier"
                      >
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
                          <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                        title="Supprimer"
                      >
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
                          <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8L13 4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Barre de progression */}
                  {c.statut !== 'preparation' && (
                    <div className="ml-12 mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-700 text-[11px]">Avancement</span>
                        <span className="text-gray-500 text-[11px]">{c.avancement ?? 0}%</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${statut.bar}`}
                          style={{ width: `${c.avancement ?? 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal formulaire */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
              <h2 className="text-[15px] font-semibold text-white">
                {editId ? 'Modifier le chantier' : 'Nouveau chantier'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M2 2l12 12M14 2L2 14" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  {formError}
                </div>
              )}

              <InputField label="Nom du chantier" value={form.nom} onChange={v => setField('nom', v)} required placeholder="Ex: Immeuble R+4 Bamako Centre" />
              <InputField label="Nom du client" value={form.client_nom} onChange={v => setField('client_nom', v)} required placeholder="Ex: M. Traoré Amadou" />
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Téléphone client" value={form.client_telephone} onChange={v => setField('client_telephone', v)} placeholder="+223 XX XX XX XX" />
                <InputField label="Email client" value={form.client_email} onChange={v => setField('client_email', v)} placeholder="client@email.com" />
              </div>
              <InputField label="Ville" value={form.ville} onChange={v => setField('ville', v)} placeholder="Bamako" />

              <div className="grid grid-cols-2 gap-4">
                <InputField label="Date début" type="date" value={form.date_debut} onChange={v => setField('date_debut', v)} />
                <InputField label="Date fin prévue" type="date" value={form.date_fin_prevue} onChange={v => setField('date_fin_prevue', v)} />
              </div>

              <InputField label="Budget prévu (FCFA)" type="number" value={form.budget_prevu} onChange={v => setField('budget_prevu', v)} placeholder="Ex: 45000000" min="0" />

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Statut</label>
                <select
                  value={form.statut}
                  onChange={e => setField('statut', e.target.value)}
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all"
                >
                  {STATUTS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                  Avancement <span className="text-gray-600 normal-case font-normal">({form.avancement}%)</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={form.avancement}
                  onChange={e => setField('avancement', e.target.value)}
                  className="w-full accent-orange-500 cursor-pointer"
                />
                <div className="flex justify-between text-gray-700 text-[10px] mt-1">
                  <span>0%</span><span>50%</span><span>100%</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white hover:border-white/[0.15] text-[13px] font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Enregistrement…
                    </>
                  ) : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null) }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6 text-red-400">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-white text-[15px] font-semibold text-center mb-2">Supprimer le chantier ?</h3>
            <p className="text-gray-500 text-[13px] text-center mb-6">
              <span className="text-gray-300 font-medium">{deleteTarget.nom}</span> sera définitivement supprimé. Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white text-[13px] font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Suppression…
                  </>
                ) : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
