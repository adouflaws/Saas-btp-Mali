'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Chantier = { id: string; nom: string; ville: string | null }

type Tache = {
  id: string
  chantier_id: string
  nom: string
  description: string | null
  statut: string | null
  priorite: string | null
  date_debut: string | null
  date_fin_prevue: string | null
  avancement: number | null
  created_at: string
  chantiers: { nom: string; ville: string | null } | null
}

type Jalon = {
  id: string
  chantier_id: string
  nom: string
  date_prevue: string
  atteint: boolean | null
  alerte_jours: number | null
  chantiers: { nom: string } | null
}

type FormData = {
  nom: string
  chantier_id: string
  description: string
  statut: string
  priorite: string
  date_debut: string
  date_fin_prevue: string
  avancement: string
}

const DEFAULT_FORM: FormData = {
  nom: '',
  chantier_id: '',
  description: '',
  statut: 'a_faire',
  priorite: 'normale',
  date_debut: '',
  date_fin_prevue: '',
  avancement: '0',
}

const STATUTS = [
  { value: 'a_faire',  label: 'À faire',  badge: 'bg-gray-500/10 text-gray-400',      bar: 'bg-gray-500' },
  { value: 'en_cours', label: 'En cours', badge: 'bg-orange-500/10 text-orange-400',   bar: 'bg-orange-500' },
  { value: 'termine',  label: 'Terminé',  badge: 'bg-emerald-500/10 text-emerald-400', bar: 'bg-emerald-500' },
  { value: 'bloque',   label: 'Bloqué',   badge: 'bg-red-500/10 text-red-400',         bar: 'bg-red-500' },
]

const PRIORITES = [
  { value: 'basse',    label: 'Basse',    color: 'text-gray-400' },
  { value: 'normale',  label: 'Normale',  color: 'text-blue-400' },
  { value: 'haute',    label: 'Haute',    color: 'text-amber-400' },
  { value: 'critique', label: 'Critique', color: 'text-red-400' },
]

function getStatut(v: string | null) { return STATUTS.find(s => s.value === v) ?? STATUTS[0] }
function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000) }

export default function PlanningPage() {
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [taches, setTaches] = useState<Tache[]>([])
  const [jalons, setJalons] = useState<Jalon[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(false ? '' : '')

  const [deleteTarget, setDeleteTarget] = useState<Tache | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchAll = useCallback(async () => {
    const [tachesRes, jalonsRes] = await Promise.all([
      supabase
        .from('taches')
        .select('*, chantiers(nom, ville)')
        .order('date_debut', { ascending: true, nullsFirst: false }),
      supabase
        .from('jalons')
        .select('*, chantiers(nom)')
        .eq('atteint', false)
        .order('date_prevue', { ascending: true }),
    ])
    if (tachesRes.error) setPageError(tachesRes.error.message)
    else setTaches((tachesRes.data ?? []) as Tache[])
    if (!jalonsRes.error) setJalons((jalonsRes.data ?? []) as Jalon[])
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

      if (profile?.entreprise_id) {
        const { data: c } = await supabase
          .from('chantiers')
          .select('id, nom, ville')
          .eq('entreprise_id', profile.entreprise_id)
          .order('nom')
        setChantiers(c ?? [])
      }

      await fetchAll()
      setLoading(false)
    }
    init()
  }, [fetchAll])

  useEffect(() => {
    if (!showModal) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showModal])

  function openNew() {
    setEditId(null)
    setForm({ ...DEFAULT_FORM, chantier_id: chantiers[0]?.id ?? '' })
    setPageError('')
    setShowModal(true)
  }

  function openEdit(t: Tache) {
    setEditId(t.id)
    setForm({
      nom: t.nom,
      chantier_id: t.chantier_id,
      description: t.description ?? '',
      statut: t.statut ?? 'a_faire',
      priorite: t.priorite ?? 'normale',
      date_debut: t.date_debut ?? '',
      date_fin_prevue: t.date_fin_prevue ?? '',
      avancement: t.avancement != null ? String(t.avancement) : '0',
    })
    setPageError('')
    setShowModal(true)
  }

  function setField(k: keyof FormData, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setPageError('')

    const payload = {
      nom: form.nom.trim(),
      chantier_id: form.chantier_id,
      description: form.description.trim() || null,
      statut: form.statut,
      priorite: form.priorite,
      date_debut: form.date_debut || null,
      date_fin_prevue: form.date_fin_prevue || null,
      avancement: Math.min(100, Math.max(0, Number(form.avancement) || 0)),
    }

    let err
    if (editId) {
      const r = await supabase.from('taches').update(payload).eq('id', editId)
      err = r.error
    } else {
      const r = await supabase.from('taches').insert(payload)
      err = r.error
    }

    if (err) { setPageError(err.message); setSaving(false); return }
    setShowModal(false)
    setSaving(false)
    await fetchAll()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('taches').delete().eq('id', deleteTarget.id)
    if (error) setPageError(error.message)
    setDeleteTarget(null)
    setDeleting(false)
    await fetchAll()
  }

  // Données Gantt : tâches avec des dates
  const tachesAvecDates = taches.filter(t => t.date_debut && t.date_fin_prevue)
  let ganttMin: Date | null = null
  let ganttMax: Date | null = null
  if (tachesAvecDates.length > 0) {
    ganttMin = new Date(Math.min(...tachesAvecDates.map(t => new Date(t.date_debut!).getTime())))
    ganttMax = new Date(Math.max(...tachesAvecDates.map(t => new Date(t.date_fin_prevue!).getTime())))
  }
  const totalDays = ganttMin && ganttMax ? Math.max(daysBetween(ganttMin, ganttMax), 1) : 1
  const today = new Date()
  const todayPct = ganttMin
    ? Math.min(100, Math.max(0, daysBetween(ganttMin, today) / totalDays * 100))
    : null

  // Jalons à venir (filtrés : non atteints, date pas trop passée)
  const jalonsAffichés = jalons.slice(0, 6)

  const today2 = new Date(); today2.setHours(0, 0, 0, 0)
  function jalonStatus(j: Jalon) {
    const d = new Date(j.date_prevue)
    if (d < today2) return 'depasse'
    const alerte = new Date(d); alerte.setDate(alerte.getDate() - (j.alerte_jours ?? 7))
    if (today2 >= alerte) return 'alerte'
    return 'ok'
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Planning</h1>
          <p className="text-gray-500 text-sm mt-1">Vue globale de toutes les tâches et jalons</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Nouvelle tâche
        </button>
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

      {/* Gantt */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Diagramme de Gantt</h2>
            {ganttMin && ganttMax && (
              <p className="text-gray-600 text-[11px] mt-0.5">
                {ganttMin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} →{' '}
                {ganttMax.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {STATUTS.map(s => (
              <div key={s.value} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-sm ${s.bar}`} />
                <span className="text-gray-600 text-[11px]">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : tachesAvecDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-orange-400">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-white text-[14px] font-medium mb-1">Aucune tâche avec des dates</p>
            <p className="text-gray-600 text-[12px]">Créez des tâches avec date début et date fin pour voir le Gantt</p>
          </div>
        ) : (
          <div className="p-6">
            <div className="relative">
              {/* Ligne aujourd'hui */}
              {todayPct !== null && todayPct >= 0 && todayPct <= 100 && (
                <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: `calc(${todayPct}% + 11rem)` }}>
                  <div className="w-px h-full bg-orange-400/50 border-l border-dashed border-orange-400/50" />
                  <div className="absolute -top-5 -translate-x-1/2 text-[10px] text-orange-400 whitespace-nowrap font-medium">
                    Aujourd&apos;hui
                  </div>
                </div>
              )}

              <div className="pt-6 space-y-2.5">
                {tachesAvecDates.map(t => {
                  const start = new Date(t.date_debut!)
                  const end = new Date(t.date_fin_prevue!)
                  const leftPct = daysBetween(ganttMin!, start) / totalDays * 100
                  const widthPct = Math.max(1.5, daysBetween(start, end) / totalDays * 100)
                  const statut = getStatut(t.statut)

                  return (
                    <div key={t.id} className="flex items-center gap-3 group">
                      {/* Label */}
                      <div className="w-44 shrink-0 text-right">
                        <p className="text-gray-300 text-[12px] font-medium truncate">{t.nom}</p>
                        <p className="text-gray-700 text-[10px] truncate">{t.chantiers?.nom}</p>
                      </div>
                      {/* Barre */}
                      <div className="flex-1 h-8 bg-white/[0.04] rounded-lg relative overflow-hidden cursor-pointer"
                        onClick={() => openEdit(t)}>
                        <div
                          className={`absolute top-1.5 bottom-1.5 rounded-md ${statut.bar} opacity-90 hover:opacity-100 transition-opacity flex items-center px-2 min-w-[6px]`}
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        >
                          {widthPct > 10 && (
                            <span className="text-[10px] text-white/90 font-medium truncate">
                              {t.avancement ?? 0}%
                            </span>
                          )}
                          <div className="absolute inset-0 bg-black/20 rounded-md" style={{ left: `${t.avancement ?? 0}%` }} />
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => openEdit(t)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-white/[0.06] hover:bg-white/[0.12] text-gray-400 hover:text-white transition-colors">
                          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3 h-3">
                            <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button onClick={() => setDeleteTarget(t)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-white/[0.06] hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors">
                          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3 h-3">
                            <path d="M1.5 3h9M4 3V2h4v1M4.5 5v4M7.5 5v4M2.5 3l.75 7.5h5.5L9.5 3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Légende dates */}
              <div className="flex justify-between mt-4 pl-[11.75rem]">
                <span className="text-[10px] text-gray-700">
                  {ganttMin!.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
                <span className="text-[10px] text-gray-700">
                  {ganttMax!.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Liste tâches sans dates */}
      {!loading && taches.filter(t => !t.date_debut).length > 0 && (
        <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-[15px] font-semibold text-white">
              Tâches sans dates
              <span className="ml-2 text-gray-600 text-[13px] font-normal">({taches.filter(t => !t.date_debut).length})</span>
            </h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {taches.filter(t => !t.date_debut).map(t => {
              const statut = getStatut(t.statut)
              return (
                <div key={t.id} className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${statut.bar}`} />
                    <div className="min-w-0">
                      <p className="text-white text-[13px] font-medium truncate">{t.nom}</p>
                      <p className="text-gray-700 text-[11px]">{t.chantiers?.nom}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statut.badge}`}>{statut.label}</span>
                    <button onClick={() => openEdit(t)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
                        <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button onClick={() => setDeleteTarget(t)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
                        <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8L13 4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Jalons à venir */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-white">Jalons à venir</h2>
          {jalons.length > 6 && (
            <span className="text-gray-600 text-[12px]">{jalons.length} total</span>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : jalonsAffichés.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-gray-600 text-[13px]">Aucun jalon à venir</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {jalonsAffichés.map(j => {
              const status = jalonStatus(j)
              const badgeMap = {
                depasse: 'bg-red-500/10 text-red-400',
                alerte:  'bg-amber-500/10 text-amber-400',
                ok:      'bg-gray-500/10 text-gray-400',
              }
              const labelMap = { depasse: 'Dépassé', alerte: 'Proche', ok: 'Prévu' }

              return (
                <div key={j.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-orange-400">
                        <path d="M3 12h4l3 8 4-16 3 8h4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white text-[13.5px] font-medium">{j.nom}</p>
                      <p className="text-gray-600 text-[12px]">
                        {j.chantiers?.nom} ·{' '}
                        <Link href={`/dashboard/chantiers/${j.chantier_id}/jalons`}
                          className="text-orange-500/70 hover:text-orange-400 transition-colors">
                          voir jalons
                        </Link>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-[12px]">
                      {new Date(j.date_prevue).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${badgeMap[status as keyof typeof badgeMap]}`}>
                      {labelMap[status as keyof typeof labelMap]}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal formulaire tâche */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
              <h2 className="text-[15px] font-semibold text-white">
                {editId ? 'Modifier la tâche' : 'Nouvelle tâche'}
              </h2>
              <button onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M2 2l12 12M14 2L2 14" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              {/* Nom */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                  Nom de la tâche <span className="text-orange-400">*</span>
                </label>
                <input type="text" value={form.nom} onChange={e => setField('nom', e.target.value)} required
                  placeholder="Ex: Coulage dalle R+2"
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all" />
              </div>

              {/* Chantier */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                  Chantier <span className="text-orange-400">*</span>
                </label>
                {chantiers.length === 0 ? (
                  <p className="text-amber-400 text-[12px] bg-amber-500/[0.08] border border-amber-500/20 rounded-xl px-4 py-3">
                    Aucun chantier disponible.{' '}
                    <Link href="/dashboard/chantiers" className="underline">Créez d&apos;abord un chantier.</Link>
                  </p>
                ) : (
                  <select value={form.chantier_id} onChange={e => setField('chantier_id', e.target.value)} required
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all">
                    <option value="">Sélectionner un chantier…</option>
                    {chantiers.map(c => (
                      <option key={c.id} value={c.id}>{c.nom}{c.ville ? ` — ${c.ville}` : ''}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Statut + Priorité */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Statut</label>
                  <select value={form.statut} onChange={e => setField('statut', e.target.value)}
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all">
                    {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Priorité</label>
                  <select value={form.priorite} onChange={e => setField('priorite', e.target.value)}
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all">
                    {PRIORITES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Date début</label>
                  <input type="date" value={form.date_debut} onChange={e => setField('date_debut', e.target.value)}
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Date fin prévue</label>
                  <input type="date" value={form.date_fin_prevue} onChange={e => setField('date_fin_prevue', e.target.value)}
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all" />
                </div>
              </div>

              {/* Avancement */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                  Avancement <span className="text-gray-600 normal-case font-normal">({form.avancement}%)</span>
                </label>
                <input type="range" min="0" max="100" step="5" value={form.avancement}
                  onChange={e => setField('avancement', e.target.value)}
                  className="w-full accent-orange-500 cursor-pointer" />
                <div className="flex justify-between text-gray-700 text-[10px] mt-1">
                  <span>0%</span><span>50%</span><span>100%</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Description (optionnel)</label>
                <textarea value={form.description} onChange={e => setField('description', e.target.value)}
                  rows={2} placeholder="Détails supplémentaires…"
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white text-[13px] font-medium transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={saving || chantiers.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {saving ? (
                    <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>Enregistrement…</>
                  ) : 'Enregistrer'}
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
            <div className="w-11 h-11 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-red-400">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-white text-[15px] font-semibold text-center mb-2">Supprimer la tâche ?</h3>
            <p className="text-gray-500 text-[13px] text-center mb-5">
              <span className="text-gray-300 font-medium">{deleteTarget.nom}</span> sera définitivement supprimée et disparaîtra du Gantt.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white text-[13px] font-medium transition-colors">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {deleting ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>Suppression…</>
                ) : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
