'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useActionGuard } from '@/hooks/useActionGuard'

const supabase = createClient()

type Avance = {
  id: string; ouvrier_id: string; chantier_id: string | null; montant: number
  date_avance: string; motif: string | null; rembourse: boolean; created_at: string
  ouvriers?: { nom: string; prenom: string | null; metier: string | null } | null
  chantiers?: { nom: string } | null
}

type Ouvrier = { id: string; nom: string; prenom: string | null; metier: string | null; taux_journalier: number | null }
type Chantier = { id: string; nom: string }

type FormData = {
  ouvrier_id: string; chantier_id: string; montant: string; date_avance: string; motif: string
}

const DEFAULT_FORM: FormData = {
  ouvrier_id: '', chantier_id: '', montant: '', date_avance: new Date().toISOString().split('T')[0], motif: '',
}

const INPUT_CLS = 'w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all'
const LABEL_CLS = 'block text-[10px] font-bold uppercase tracking-[0.09em] text-gray-600 mb-1.5'

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

function formatDate(d: string) {
  try { return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return d }
}

export default function AvancesPage() {
  const { guard } = useActionGuard()
  const [avances, setAvances] = useState<Avance[]>([])
  const [ouvriers, setOuvriers] = useState<Ouvrier[]>([])
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [entrepriseId, setEntrepriseId] = useState<string | null>(null)
  const entrepriseIdRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [pageError, setPageError] = useState('')
  const [filtreRembourse, setFiltreRembourse] = useState<'tous' | 'en_cours' | 'rembourse'>('en_cours')
  const [rechercheNom, setRechercheNom] = useState('')

  const fetchAvances = useCallback(async () => {
    const eid = entrepriseIdRef.current
    if (!eid) return
    const { data, error } = await supabase
      .from('avances_salaire')
      .select('*, ouvriers(nom, prenom, metier), chantiers(nom)')
      .eq('entreprise_id', eid)
      .order('date_avance', { ascending: false })
    if (error) setPageError(error.message)
    else setAvances(data ?? [])
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: profile } = await supabase.from('profiles').select('entreprise_id').eq('id', user.id).single()
      const eid = profile?.entreprise_id ?? null
      if (eid) {
        setEntrepriseId(eid)
        entrepriseIdRef.current = eid
      }
      const [{ data: ov }, { data: ch }] = await Promise.all([
        supabase.from('ouvriers').select('id, nom, prenom, metier, taux_journalier')
          .eq('actif', true)
          .eq('entreprise_id', eid ?? '')
          .order('nom'),
        supabase.from('chantiers').select('id, nom')
          .eq('entreprise_id', eid ?? '')
          .order('nom'),
      ])
      setOuvriers(ov ?? [])
      setChantiers(ch ?? [])
      await fetchAvances()
      setLoading(false)
    }
    init()
  }, [fetchAvances])

  function setField(k: keyof FormData, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!entrepriseId) return
    if (!form.ouvrier_id) { setFormError('Sélectionnez un ouvrier.'); return }
    if (!form.montant || Number(form.montant) <= 0) { setFormError('Montant invalide.'); return }
    setSaving(true); setFormError('')
    const { error } = await supabase.from('avances_salaire').insert({
      ouvrier_id: form.ouvrier_id,
      chantier_id: form.chantier_id || null,
      montant: Number(form.montant),
      date_avance: form.date_avance,
      motif: form.motif.trim() || null,
      entreprise_id: entrepriseId,
    })
    if (error) { setFormError(error.message); setSaving(false); return }
    setShowModal(false); setSaving(false); setForm(DEFAULT_FORM); await fetchAvances()
  }

  async function toggleRembourse(a: Avance) {
    const { error } = await supabase.from('avances_salaire').update({ rembourse: !a.rembourse }).eq('id', a.id)
    if (error) setPageError(error.message)
    else await fetchAvances()
  }

  const avancesFiltrees = avances.filter(a => {
    const matchRembourse = filtreRembourse === 'tous' || (filtreRembourse === 'rembourse' ? a.rembourse : !a.rembourse)
    const q = rechercheNom.toLowerCase()
    const nom = `${a.ouvriers?.prenom ?? ''} ${a.ouvriers?.nom ?? ''}`.toLowerCase()
    return matchRembourse && (!q || nom.includes(q))
  })

  const totalEnCours = avances.filter(a => !a.rembourse).reduce((s, a) => s + a.montant, 0)
  const totalGlobal = avances.reduce((s, a) => s + a.montant, 0)

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-[-0.02em]">Avances sur salaire</h1>
          <p className="text-gray-500 text-[13px] mt-1">Gérez les avances et déduisez-les de la paie</p>
        </div>
        <button onClick={() => guard(() => { setForm(DEFAULT_FORM); setFormError(''); setShowModal(true) })}
          className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors w-full sm:w-auto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          Nouvelle avance
        </button>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto mb-6">
        <div className="flex gap-1 bg-[#1a1a1a] rounded-xl p-1 w-fit">
          <Link href="/dashboard/equipes" className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">Ouvriers</Link>
          <Link href="/dashboard/equipes/pointage" className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">Pointage</Link>
          <span className="px-4 py-2 rounded-lg bg-orange-500/10 text-orange-400 text-[13px] font-medium">Avances</span>
          <Link href="/dashboard/equipes/paie" className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">Paie</Link>
        </div>
      </div>

      {pageError && <div className="mb-5 flex items-center gap-2 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">{pageError}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-4 sm:p-5">
          <p className="text-gray-600 text-[11px] uppercase tracking-[0.08em] font-bold mb-1">En cours</p>
          <p className="text-red-400 text-[20px] font-bold">{totalEnCours.toLocaleString('fr-FR')}</p>
          <p className="text-gray-700 text-[11px]">FCFA non remboursés</p>
        </div>
        <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-4 sm:p-5">
          <p className="text-gray-600 text-[11px] uppercase tracking-[0.08em] font-bold mb-1">Total versé</p>
          <p className="text-white text-[20px] font-bold">{totalGlobal.toLocaleString('fr-FR')}</p>
          <p className="text-gray-700 text-[11px]">FCFA cumulés</p>
        </div>
        <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-4 sm:p-5">
          <p className="text-gray-600 text-[11px] uppercase tracking-[0.08em] font-bold mb-1">Avances</p>
          <p className="text-white text-[20px] font-bold">{avances.filter(a => !a.rembourse).length}</p>
          <p className="text-gray-700 text-[11px]">en attente</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600">
            <circle cx="9" cy="9" r="6" /><path d="M15 15l3 3" strokeLinecap="round" />
          </svg>
          <input type="text" value={rechercheNom} onChange={e => setRechercheNom(e.target.value)} placeholder="Rechercher un ouvrier…"
            className="w-full bg-[#232323] border border-white/[0.06] text-white placeholder-gray-600 rounded-xl pl-9 pr-4 py-2.5 text-[13px] focus:outline-none focus:border-orange-500 transition-all" />
        </div>
        <div className="flex gap-0.5 bg-[#1a1a1a] rounded-xl p-1">
          {([['en_cours', 'En cours'], ['rembourse', 'Remboursées'], ['tous', 'Toutes']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFiltreRembourse(v)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${filtreRembourse === v ? 'bg-white/[0.08] text-white' : 'text-gray-600 hover:text-gray-300'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-[14px] font-semibold text-white">
            Historique{!loading && <span className="ml-2 text-gray-600 text-[12px] font-normal">({avancesFiltrees.length})</span>}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14">
            <svg className="animate-spin w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : avancesFiltrees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-6">
            <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-orange-400"><path d="M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" /></svg>
            </div>
            <p className="text-gray-600 text-[13px]">{filtreRembourse === 'en_cours' ? 'Aucune avance en cours.' : 'Aucune avance trouvée.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {avancesFiltrees.map(a => (
              <div key={a.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[11px] font-bold ${a.rembourse ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'}`}>
                    {((a.ouvriers?.prenom?.[0] ?? '') + (a.ouvriers?.nom?.[0] ?? '')).toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-[13px] font-medium">{a.ouvriers?.prenom ? `${a.ouvriers.prenom} ${a.ouvriers.nom}` : (a.ouvriers?.nom ?? '—')}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-gray-600 text-[11px]">{formatDate(a.date_avance)}</span>
                      {a.chantiers && <><span className="text-gray-700 text-[10px]">·</span><span className="text-gray-600 text-[11px]">{a.chantiers.nom}</span></>}
                      {a.motif && <><span className="text-gray-700 text-[10px]">·</span><span className="text-gray-600 text-[11px] italic truncate max-w-[150px]">{a.motif}</span></>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className={`font-bold text-[15px] ${a.rembourse ? 'text-emerald-400/70 line-through' : 'text-orange-400'}`}>
                      {a.montant.toLocaleString('fr-FR')}
                    </p>
                    <p className="text-gray-700 text-[10px]">FCFA</p>
                  </div>
                  <button onClick={() => guard(() => toggleRembourse(a))}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${a.rembourse ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15' : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/15'}`}>
                    {a.rembourse ? 'Remboursée' : 'Marquer remb.'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal nouvelle avance */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl">
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-[14px] font-semibold text-white">Nouvelle avance sur salaire</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M2 2l12 12M14 2L2 14" strokeLinecap="round" /></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              {formError && <div className="bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">{formError}</div>}
              <div>
                <label className={LABEL_CLS}>Ouvrier <span className="text-orange-400">*</span></label>
                <select value={form.ouvrier_id} onChange={e => setField('ouvrier_id', e.target.value)} required className={INPUT_CLS}>
                  <option value="">— Sélectionner —</option>
                  {ouvriers.map(o => <option key={o.id} value={o.id}>{o.prenom ? `${o.prenom} ${o.nom}` : o.nom}{o.metier ? ` — ${o.metier}` : ''}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Montant (FCFA) <span className="text-orange-400">*</span></label>
                  <input type="number" min="0" value={form.montant} onChange={e => setField('montant', e.target.value)} placeholder="5 000" required className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Date</label>
                  <input type="date" value={form.date_avance} onChange={e => setField('date_avance', e.target.value)} className={INPUT_CLS} />
                </div>
              </div>
              <div>
                <label className={LABEL_CLS}>Chantier (optionnel)</label>
                <select value={form.chantier_id} onChange={e => setField('chantier_id', e.target.value)} className={INPUT_CLS}>
                  <option value="">— Aucun chantier —</option>
                  {chantiers.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Motif (optionnel)</label>
                <input type="text" value={form.motif} onChange={e => setField('motif', e.target.value)} placeholder="Raison de l'avance…" className={INPUT_CLS} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white text-[13px] font-medium transition-colors">Annuler</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? <><Spinner />Enregistrement…</> : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
