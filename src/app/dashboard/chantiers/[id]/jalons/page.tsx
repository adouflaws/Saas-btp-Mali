'use client'

import { use, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Jalon = {
  id: string
  chantier_id: string
  nom: string
  date_prevue: string
  date_reelle: string | null
  atteint: boolean | null
  alerte_jours: number | null
  created_at: string
}

type Chantier = { id: string; nom: string }

type FormData = {
  nom: string
  date_prevue: string
  alerte_jours: string
}

const DEFAULT_FORM: FormData = { nom: '', date_prevue: '', alerte_jours: '7' }

export default function JalonsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: chantierId } = use(params)

  const [chantier, setChantier] = useState<Chantier | null>(null)
  const [jalons, setJalons] = useState<Jalon[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<Jalon | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchJalons = useCallback(async () => {
    const { data, error } = await supabase
      .from('jalons')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('date_prevue', { ascending: true })
    if (error) setPageError(error.message)
    else setJalons(data ?? [])
  }, [chantierId])

  useEffect(() => {
    async function init() {
      setLoading(true)
      const [{ data: c }] = await Promise.all([
        supabase.from('chantiers').select('id, nom').eq('id', chantierId).single(),
        fetchJalons(),
      ])
      if (c) setChantier(c)
      setLoading(false)
    }
    init()
  }, [chantierId, fetchJalons])

  useEffect(() => {
    if (!showModal) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showModal])

  function setField(k: keyof FormData, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setFormError('')
    const { error } = await supabase.from('jalons').insert({
      chantier_id: chantierId,
      nom: form.nom.trim(),
      date_prevue: form.date_prevue,
      alerte_jours: Number(form.alerte_jours) || 7,
      atteint: false,
    })
    if (error) { setFormError(error.message); setSaving(false); return }
    setShowModal(false); setSaving(false); setForm(DEFAULT_FORM); await fetchJalons()
  }

  async function toggleAtteint(j: Jalon) {
    const nowAtteint = !j.atteint
    const { error } = await supabase.from('jalons').update({
      atteint: nowAtteint,
      date_reelle: nowAtteint ? new Date().toISOString().split('T')[0] : null,
    }).eq('id', j.id)
    if (error) setPageError(error.message)
    else await fetchJalons()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('jalons').delete().eq('id', deleteTarget.id)
    if (error) setPageError(error.message)
    setDeleteTarget(null); setDeleting(false); await fetchJalons()
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function getJalonStatus(j: Jalon) {
    const datePrevue = new Date(j.date_prevue)
    const alerteDate = new Date(datePrevue)
    alerteDate.setDate(alerteDate.getDate() - (j.alerte_jours ?? 7))

    if (j.atteint) return 'atteint'
    if (datePrevue < today) return 'depasse'
    if (today >= alerteDate) return 'alerte'
    return 'ok'
  }

  const statusConfig = {
    atteint: { badge: 'bg-emerald-500/10 text-emerald-400', icon: '✓', label: 'Atteint' },
    depasse:  { badge: 'bg-red-500/10 text-red-400',       icon: '!', label: 'Dépassé' },
    alerte:   { badge: 'bg-amber-500/10 text-amber-400',   icon: '⚠', label: 'Proche' },
    ok:       { badge: 'bg-gray-500/10 text-gray-400',     icon: '○', label: 'Prévu' },
  }

  const atteints = jalons.filter(j => j.atteint).length
  const depasses = jalons.filter(j => getJalonStatus(j) === 'depasse').length

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] text-gray-600 mb-6">
        <Link href="/dashboard/chantiers" className="hover:text-gray-400 transition-colors">Chantiers</Link>
        <span>/</span>
        <span className="text-gray-400">{chantier?.nom ?? '...'}</span>
        <span>/</span>
        <span className="text-orange-400">Jalons</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{chantier?.nom ?? '...'}</h1>
          <p className="text-gray-500 text-sm mt-1">Jalons & étapes clés du chantier</p>
        </div>
        <button onClick={() => { setForm(DEFAULT_FORM); setFormError(''); setShowModal(true) }}
          className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors w-full sm:w-auto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Nouveau jalon
        </button>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto mb-6">
        <div className="flex gap-1 bg-[#1a1a1a] rounded-xl p-1 w-fit">
          <Link href={`/dashboard/chantiers/${chantierId}/planning`}
            className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">
            Tâches
          </Link>
          <span className="px-4 py-2 rounded-lg bg-orange-500/10 text-orange-400 text-[13px] font-medium">
            Jalons
          </span>
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total jalons', value: jalons.length, color: 'text-white', bg: 'bg-white/[0.05]' },
          { label: 'Atteints', value: atteints, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Dépassés', value: depasses, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map(s => (
          <div key={s.label} className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 flex items-center gap-3">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center`}>
              <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
            </div>
            <p className="text-gray-400 text-[13px]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Timeline jalons */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-[15px] font-semibold text-white">
            Liste des jalons
            {!loading && <span className="ml-2 text-gray-600 text-[13px] font-normal">({jalons.length})</span>}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : jalons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-orange-400">
                <path d="M3 12h18M12 3l9 9-9 9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-white text-[14px] font-medium mb-1">Aucun jalon</p>
            <p className="text-gray-600 text-[12px]">Ajoutez des jalons pour marquer les étapes clés</p>
          </div>
        ) : (
          <div className="relative">
            {/* Ligne de timeline */}
            <div className="absolute left-[3.25rem] top-0 bottom-0 w-px bg-white/[0.06]" />
            <div className="divide-y divide-white/[0.04]">
              {jalons.map(j => {
                const status = getJalonStatus(j)
                const cfg = statusConfig[status]
                const datePrevue = new Date(j.date_prevue)

                return (
                  <div key={j.id} className="flex items-start gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                    {/* Indicateur timeline */}
                    <div className="flex flex-col items-center shrink-0 w-8 mt-0.5">
                      <button
                        onClick={() => toggleAtteint(j)}
                        title={j.atteint ? 'Marquer non atteint' : 'Marquer comme atteint'}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 z-10 ${
                          j.atteint
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : status === 'depasse'
                            ? 'border-red-500 bg-red-500/10 text-red-400'
                            : status === 'alerte'
                            ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                            : 'border-white/[0.15] bg-white/[0.04] text-gray-600 hover:border-emerald-500/50'
                        }`}
                      >
                        {j.atteint ? (
                          <svg viewBox="0 0 12 12" fill="none" className="w-3.5 h-3.5">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                            <path d="M3 12h18M12 3l9 9-9 9" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </div>

                    {/* Contenu */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`text-[14px] font-medium ${j.atteint ? 'text-gray-500 line-through' : 'text-white'}`}>
                            {j.nom}
                          </p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-gray-600 text-[12px]">
                              Prévu le {datePrevue.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                            {j.atteint && j.date_reelle && (
                              <span className="text-emerald-600 text-[11px]">
                                · Atteint le {new Date(j.date_reelle).toLocaleDateString('fr-FR')}
                              </span>
                            )}
                            {j.alerte_jours && !j.atteint && (
                              <span className="text-gray-700 text-[11px]">
                                · Alerte {j.alerte_jours}j avant
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${cfg.badge}`}>
                            {cfg.label}
                          </span>
                          <button onClick={() => setDeleteTarget(j)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors">
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
                              <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8L13 4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal création jalon */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl">
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
              <h2 className="text-[15px] font-semibold text-white">Nouveau jalon</h2>
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

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                  Nom du jalon <span className="text-orange-400">*</span>
                </label>
                <input type="text" value={form.nom} onChange={e => setField('nom', e.target.value)} required
                  placeholder="Ex: Livraison fondations"
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all" />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                  Date prévue <span className="text-orange-400">*</span>
                </label>
                <input type="date" value={form.date_prevue} onChange={e => setField('date_prevue', e.target.value)} required
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all" />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                  Alerte (jours avant la date)
                </label>
                <input type="number" min="1" max="90" value={form.alerte_jours}
                  onChange={e => setField('alerte_jours', e.target.value)}
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all" />
                <p className="text-gray-700 text-[11px] mt-1">Le badge &quot;Proche&quot; s&apos;affiche {form.alerte_jours} jour{Number(form.alerte_jours) > 1 ? 's' : ''} avant</p>
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
                  ) : 'Créer le jalon'}
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
            <h3 className="text-white text-[15px] font-semibold text-center mb-2">Supprimer le jalon ?</h3>
            <p className="text-gray-500 text-[13px] text-center mb-5">
              <span className="text-gray-300 font-medium">{deleteTarget.nom}</span> sera définitivement supprimé.
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
