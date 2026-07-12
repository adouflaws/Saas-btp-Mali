'use client'

import { use, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cacheSet, cacheGet, queueAdd } from '@/lib/offline'
import StatusBadge, { statutBarClass, statutBadgeClasses } from '@/components/StatusBadge'
import { STATUTS_TACHE } from '@/constants/statuts'

const supabase = createClient()

type Tache = {
  id: string
  chantier_id: string
  nom: string
  statut: string | null
  priorite: string | null
  date_debut: string | null
  date_fin_prevue: string | null
  avancement: number | null
  ordre: number | null
  created_at: string
}

type Chantier = { id: string; nom: string; ville: string | null }

type FormData = {
  nom: string
  statut: string
  priorite: string
  date_debut: string
  date_fin_prevue: string
  avancement: string
}

const DEFAULT_FORM: FormData = {
  nom: '',
  statut: 'a_faire',
  priorite: 'normale',
  date_debut: '',
  date_fin_prevue: '',
  avancement: '0',
}

const PRIORITES = [
  { value: 'basse',    label: 'Basse',    color: 'text-gray-400' },
  { value: 'normale',  label: 'Normale',  color: 'text-blue-400' },
  { value: 'haute',    label: 'Haute',    color: 'text-amber-400' },
  { value: 'critique', label: 'Critique', color: 'text-red-400' },
]

function getPriorite(v: string | null) { return PRIORITES.find(p => p.value === v) ?? PRIORITES[1] }

function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000) }

export default function PlanningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: chantierId } = use(params)

  const [chantier, setChantier] = useState<Chantier | null>(null)
  const [taches, setTaches] = useState<Tache[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<Tache | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [offlineMsg, setOfflineMsg] = useState('')

  /* ── Détection réseau ── */
  useEffect(() => {
    const onOnline  = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const fetchTaches = useCallback(async () => {
    /* Offline : charger depuis localStorage */
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = cacheGet<Tache[]>(`taches_${chantierId}`)
      if (cached) setTaches(cached)
      else setPageError('Hors ligne — aucune tâche en cache disponible.')
      return
    }
    const { data, error } = await supabase
      .from('taches')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('ordre', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) setPageError(error.message)
    else {
      setTaches(data ?? [])
      /* Sauvegarder pour usage offline */
      if (data) cacheSet(`taches_${chantierId}`, data)
    }
  }, [chantierId])

  useEffect(() => {
    async function init() {
      setLoading(true)

      /* Offline : utiliser le cache chantiers existant */
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cachedChantiers = cacheGet<Array<{ id: string; nom: string; ville: string | null }>>('chantiers')
        const found = cachedChantiers?.find(ch => ch.id === chantierId)
        if (found) setChantier(found)
        await fetchTaches()
        setLoading(false)
        return
      }

      const [{ data: c }] = await Promise.all([
        supabase.from('chantiers').select('id, nom, ville').eq('id', chantierId).single(),
        fetchTaches(),
      ])
      if (c) setChantier(c)
      setLoading(false)
    }
    init()
  }, [chantierId, fetchTaches])

  useEffect(() => {
    if (!showModal) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showModal])

  function openNew() {
    setEditId(null); setForm(DEFAULT_FORM); setFormError(''); setShowModal(true)
  }
  function openEdit(t: Tache) {
    setEditId(t.id)
    setForm({
      nom: t.nom,
      statut: t.statut ?? 'a_faire',
      priorite: t.priorite ?? 'normale',
      date_debut: t.date_debut ?? '',
      date_fin_prevue: t.date_fin_prevue ?? '',
      avancement: t.avancement != null ? String(t.avancement) : '0',
    })
    setFormError(''); setShowModal(true)
  }
  function setField(k: keyof FormData, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function showOfflineToast(msg: string) {
    setOfflineMsg(msg)
    setTimeout(() => setOfflineMsg(''), 4500)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setFormError('')
    const payload = {
      nom: form.nom.trim(),
      statut: form.statut,
      priorite: form.priorite,
      date_debut: form.date_debut || null,
      date_fin_prevue: form.date_fin_prevue || null,
      avancement: Math.min(100, Math.max(0, Number(form.avancement) || 0)),
    }

    /* ── Mode hors ligne : mettre en queue + mise à jour optimiste ── */
    if (!isOnline) {
      if (editId) {
        queueAdd({ table: 'taches', op: 'update', data: payload as Record<string, unknown>, rowId: editId })
        const updated = taches.map(t => t.id === editId ? { ...t, ...payload } : t)
        setTaches(updated)
        cacheSet(`taches_${chantierId}`, updated)
      } else {
        queueAdd({ table: 'taches', op: 'insert', data: { ...payload, chantier_id: chantierId } as Record<string, unknown> })
        const tempTache: Tache = {
          id: `temp_${Date.now()}`,
          chantier_id: chantierId,
          ...payload,
          ordre: null,
          created_at: new Date().toISOString(),
        }
        const updated = [...taches, tempTache]
        setTaches(updated)
        cacheSet(`taches_${chantierId}`, updated)
      }
      setShowModal(false); setSaving(false)
      showOfflineToast('Tâche sauvegardée localement — sera synchronisée au retour du réseau')
      return
    }

    /* ── Mode en ligne : envoi Supabase ── */
    let err
    if (editId) {
      const r = await supabase.from('taches').update(payload).eq('id', editId)
      err = r.error
    } else {
      const r = await supabase.from('taches').insert({ ...payload, chantier_id: chantierId })
      err = r.error
    }
    if (err) { setFormError(err.message); setSaving(false); return }
    setShowModal(false); setSaving(false); await fetchTaches()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    if (!isOnline) {
      showOfflineToast('📡 Impossible de supprimer hors ligne — reconnectez-vous d\'abord')
      setDeleteTarget(null)
      return
    }
    setDeleting(true)
    const { error } = await supabase.from('taches').delete().eq('id', deleteTarget.id)
    if (error) setPageError(error.message)
    setDeleteTarget(null); setDeleting(false); await fetchTaches()
  }

  /* Basculer statut tâche (checkbox) */
  async function toggleTacheStatut(t: Tache) {
    const newStatut = t.statut === 'termine' ? 'en_cours' : 'termine'
    const newAv = newStatut === 'termine' ? 100 : t.avancement
    const updateData = { statut: newStatut, avancement: newAv }

    if (!isOnline) {
      queueAdd({ table: 'taches', op: 'update', data: updateData as Record<string, unknown>, rowId: t.id })
      const updated = taches.map(task => task.id === t.id ? { ...task, ...updateData } : task)
      setTaches(updated)
      cacheSet(`taches_${chantierId}`, updated)
      showOfflineToast('Modification sauvegardée localement — sera synchronisée au retour du réseau')
      return
    }
    await supabase.from('taches').update(updateData).eq('id', t.id)
    await fetchTaches()
  }

  /* Progression globale = moyenne avancement */
  const progression = taches.length > 0
    ? Math.round(taches.reduce((acc, t) => acc + (t.avancement ?? 0), 0) / taches.length)
    : 0

  /* Données Gantt */
  const tachesAvecDates = taches.filter(t => t.date_debut && t.date_fin_prevue)
  let ganttMin: Date | null = null
  let ganttMax: Date | null = null
  if (tachesAvecDates.length > 0) {
    ganttMin = new Date(Math.min(...tachesAvecDates.map(t => new Date(t.date_debut!).getTime())))
    ganttMax = new Date(Math.max(...tachesAvecDates.map(t => new Date(t.date_fin_prevue!).getTime())))
  }
  const totalDays = ganttMin && ganttMax ? Math.max(daysBetween(ganttMin, ganttMax), 1) : 1
  const today = new Date()
  const todayPct = ganttMin ? Math.min(100, Math.max(0, daysBetween(ganttMin, today) / totalDays * 100)) : null

  return (
    <div className="p-4 sm:p-6 md:p-8">

      {/* Toast hors ligne */}
      {offlineMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90vw] sm:w-auto flex items-start gap-2.5 bg-amber-600 text-white text-[13px] font-semibold px-5 py-3 rounded-xl shadow-xl">
          <span className="shrink-0 text-base mt-0.5">📶</span>
          <span>{offlineMsg}</span>
        </div>
      )}

      {/* Bandeau hors ligne */}
      {!isOnline && (
        <div className="mb-4 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl px-4 py-2.5 text-[13px]">
          <span>📡</span>
          <span>Mode hors ligne — les modifications seront sauvegardées localement</span>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] text-gray-600 mb-6">
        <Link href="/dashboard/chantiers" className="hover:text-gray-400 transition-colors">Chantiers</Link>
        <span>/</span>
        <span className="text-gray-400">{chantier?.nom ?? '...'}</span>
        <span>/</span>
        <span className="text-orange-400">Planning</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{chantier?.nom ?? '...'}</h1>
          <p className="text-gray-500 text-sm mt-1">Planning & suivi des tâches</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors w-full sm:w-auto"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Nouvelle tâche
        </button>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto mb-6">
        <div className="flex gap-1 bg-[#1a1a1a] rounded-xl p-1 w-fit">
          <span className="px-4 py-2 rounded-lg bg-orange-500/10 text-orange-400 text-[13px] font-medium">
            Tâches
          </span>
          <Link href={`/dashboard/chantiers/${chantierId}/jalons`}
            className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">
            Jalons
          </Link>
        </div>
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

      {/* Progression globale */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white text-[14px] font-semibold">Progression globale du chantier</p>
            <p className="text-gray-600 text-[12px] mt-0.5">{taches.length} tâche{taches.length !== 1 ? 's' : ''} · moyenne des avancements</p>
          </div>
          <span className={`text-3xl font-bold ${progression === 100 ? 'text-emerald-400' : 'text-orange-400'}`}>
            {progression}%
          </span>
        </div>
        <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progression === 100 ? 'bg-emerald-500' : 'bg-orange-500'}`}
            style={{ width: `${progression}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          {Object.entries(STATUTS_TACHE).map(([key, def]) => {
            const count = taches.filter(t => t.statut === key).length
            return count > 0 ? (
              <span key={key} className={`text-[11px] px-2 py-0.5 rounded-full ${statutBadgeClasses('tache', key)}`}>
                {count} {def.label.toLowerCase()}
              </span>
            ) : null
          })}
        </div>
      </div>

      {/* Gantt Chart */}
      {tachesAvecDates.length > 0 && ganttMin && ganttMax && (
        <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-6 mb-6">
          <h2 className="text-[15px] font-semibold text-white mb-5">Diagramme de Gantt</h2>
          <div className="relative">
            {todayPct !== null && todayPct >= 0 && todayPct <= 100 && (
              <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: `${todayPct}%` }}>
                <div className="w-px h-full bg-orange-400/60 border-l border-dashed border-orange-400/60" />
                <div className="absolute -top-5 -translate-x-1/2 text-[10px] text-orange-400 whitespace-nowrap">
                  Aujourd&apos;hui
                </div>
              </div>
            )}
            <div className="pt-6 space-y-2">
              {tachesAvecDates.map(t => {
                const start = new Date(t.date_debut!)
                const end = new Date(t.date_fin_prevue!)
                const leftPct = daysBetween(ganttMin!, start) / totalDays * 100
                const widthPct = Math.max(1, daysBetween(start, end) / totalDays * 100)
                return (
                  <div key={t.id} className="flex items-center gap-3">
                    <div className="w-36 shrink-0 text-right">
                      <p className="text-gray-400 text-[12px] font-medium truncate">{t.nom}</p>
                    </div>
                    <div className="flex-1 h-7 bg-white/[0.04] rounded-lg relative overflow-hidden">
                      <div
                        className={`absolute top-1 bottom-1 rounded-md ${statutBarClass('tache', t.statut)} flex items-center px-2 min-w-[4px]`}
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      >
                        {widthPct > 8 && (
                          <span className="text-[10px] text-white/80 font-medium truncate">
                            {t.avancement ?? 0}%
                          </span>
                        )}
                        <div
                          className="absolute inset-0 bg-black/20 rounded-md"
                          style={{ left: `${t.avancement ?? 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-3 px-[9.5rem]">
              <span className="text-[10px] text-gray-700">
                {ganttMin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
              <span className="text-[10px] text-gray-700">
                {ganttMax.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Liste des tâches */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-[15px] font-semibold text-white">
            Liste des tâches
            {!loading && <span className="ml-2 text-gray-600 text-[13px] font-normal">({taches.length})</span>}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : taches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-orange-400">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-white text-[14px] font-medium mb-1">Aucune tâche</p>
            <p className="text-gray-600 text-[12px]">Ajoutez des tâches pour suivre l&apos;avancement</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {taches.map(t => {
              const priorite = getPriorite(t.priorite)
              return (
                <div key={t.id} className="px-6 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Checkbox visuel */}
                      <button
                        onClick={() => toggleTacheStatut(t)}
                        className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                          t.statut === 'termine'
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-white/[0.15] hover:border-emerald-500/50'
                        }`}
                      >
                        {t.statut === 'termine' && (
                          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>

                      <div className="min-w-0">
                        <p className={`text-[14px] font-medium ${t.statut === 'termine' ? 'text-gray-600 line-through' : 'text-white'}`}>
                          {t.nom}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          {t.date_debut && (
                            <span className="text-gray-700 text-[11px]">
                              {new Date(t.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              {t.date_fin_prevue && ` → ${new Date(t.date_fin_prevue).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                            </span>
                          )}
                          <span className={`text-[11px] font-semibold ${priorite.color}`}>
                            {priorite.label}
                          </span>
                        </div>
                        {t.statut !== 'a_faire' && (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden max-w-[120px]">
                              <div className={`h-full rounded-full ${statutBarClass('tache', t.statut)}`} style={{ width: `${t.avancement ?? 0}%` }} />
                            </div>
                            <span className="text-gray-600 text-[11px]">{t.avancement ?? 0}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge type="tache" statut={t.statut} />
                      <button onClick={() => openEdit(t)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-white transition-colors">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
                          <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleteTarget(t)}
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
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
              {formError && (
                <div className="flex items-center gap-2 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                  Nom de la tâche <span className="text-orange-400">*</span>
                </label>
                <input type="text" value={form.nom} onChange={e => setField('nom', e.target.value)} required
                  placeholder="Ex: Fondations coulées"
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Statut</label>
                  <select value={form.statut} onChange={e => setField('statut', e.target.value)}
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all">
                    {Object.entries(STATUTS_TACHE).map(([key, def]) => <option key={key} value={key}>{def.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Priorité</label>
                  <select value={form.priorite} onChange={e => setField('priorite', e.target.value)}
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all">
                    {PRIORITES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {(['date_debut', 'date_fin_prevue'] as const).map((k, i) => (
                  <div key={k}>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                      {i === 0 ? 'Date début' : 'Date fin prévue'}
                    </label>
                    <input type="date" value={form[k]} onChange={e => setField(k, e.target.value)}
                      className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all" />
                  </div>
                ))}
              </div>

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

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white text-[13px] font-medium transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="sm:hidden flex justify-center -mt-3 mb-3"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <div className="w-11 h-11 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-red-400">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-white text-[15px] font-semibold text-center mb-2">Supprimer la tâche ?</h3>
            <p className="text-gray-500 text-[13px] text-center mb-5">
              <span className="text-gray-300 font-medium">{deleteTarget.nom}</span> sera définitivement supprimée.
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
