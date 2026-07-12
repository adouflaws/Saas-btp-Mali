'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cacheGet, cacheSet, queueAdd, queueGet, queueClear, queueCount } from '@/lib/offline'
import { useActionGuard } from '@/hooks/useActionGuard'

const supabase = createClient()

type StatutPresence = 'present' | 'demi_journee' | 'maladie' | 'conge' | 'absent'

type PointageLine = {
  ouvrier_id: string; nom: string; prenom: string | null; metier: string | null
  taux_journalier: number | null; statut: StatutPresence; present: boolean
  montant_jour: number; note: string; existingId?: string
}

type Chantier = { id: string; nom: string }

const STATUTS: Record<StatutPresence, { label: string; color: string; bg: string; border: string }> = {
  present:      { label: 'Présent',  color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40' },
  demi_journee: { label: 'Demi-j.', color: 'text-amber-400',   bg: 'bg-amber-500/15',  border: 'border-amber-500/40' },
  maladie:      { label: 'Maladie', color: 'text-blue-400',    bg: 'bg-blue-500/15',   border: 'border-blue-500/40' },
  conge:        { label: 'Congé',   color: 'text-purple-400',  bg: 'bg-purple-500/15', border: 'border-purple-500/40' },
  absent:       { label: 'Absent',  color: 'text-red-400/80',  bg: 'bg-red-500/10',    border: 'border-red-500/20' },
}

function today() {
  const now = new Date(); const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDate(d: string) {
  try { return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return d }
}

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

export default function PointagePage() {
  const { guard } = useActionGuard()
  const [entrepriseId, setEntrepriseId] = useState<string | null>(null)
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [chantierId, setChantierId] = useState('')
  const [date, setDate] = useState(today())
  const [lignes, setLignes] = useState<PointageLine[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [equipeNonAffectee, setEquipeNonAffectee] = useState(false)
  const prevChantierDate = useRef('')

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const onOnline = () => { setIsOnline(true); syncQueue() }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { setPendingCount(queueCount()) }, [])

  // Récupérer l'entreprise_id du user connecté
  useEffect(() => {
    async function initEntreprise() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('entreprise_id').eq('id', user.id).single()
      if (profile?.entreprise_id) setEntrepriseId(profile.entreprise_id)
    }
    initEntreprise()
  }, [])

  // Charger les chantiers uniquement après avoir l'entreprise_id
  useEffect(() => {
    if (!entrepriseId) return
    async function loadChantiers() {
      const cacheKey = `chantiers_${entrepriseId}`
      const cached = cacheGet<Chantier[]>(cacheKey)
      if (cached) setChantiers(cached)
      if (navigator.onLine) {
        const { data } = await supabase.from('chantiers').select('id, nom')
          .eq('entreprise_id', entrepriseId)
          .in('statut', ['preparation', 'en_cours'])
          .order('nom')
        if (data) { setChantiers(data); cacheSet(cacheKey, data) }
      }
    }
    loadChantiers()
  }, [entrepriseId])

  const loadLignes = useCallback(async () => {
    if (!chantierId) return
    const key = `${chantierId}-${date}`
    if (key === prevChantierDate.current) return
    prevChantierDate.current = key
    setLoading(true); setError('')

    const ouvriersCache = cacheGet(`ouvriers_${entrepriseId ?? 'unknown'}`)
    let ouvriers = ouvriersCache
    if (!ouvriers || navigator.onLine) {
      const q = supabase.from('ouvriers').select('id, nom, prenom, metier, taux_journalier').or('actif.eq.true,actif.is.null').order('nom')
      if (entrepriseId) q.eq('entreprise_id', entrepriseId)
      const { data } = await q
      ouvriers = data ?? []
      cacheSet(`ouvriers_${entrepriseId ?? 'unknown'}`, ouvriers)
    }

    // Ne montrer que l'équipe affectée à ce chantier, si une affectation existe
    let sansEquipeAffectee = false
    if (navigator.onLine) {
      const { data: affectations } = await supabase.from('affectations_chantier')
        .select('ouvrier_id').eq('chantier_id', chantierId).or('actif.eq.true,actif.is.null')
      if (affectations && affectations.length > 0) {
        const idsAffectes = new Set(affectations.map(a => a.ouvrier_id))
        ouvriers = (ouvriers as { id: string }[]).filter(o => idsAffectes.has(o.id))
      } else {
        sansEquipeAffectee = true
      }
    }
    setEquipeNonAffectee(sansEquipeAffectee)

    type OuvrierRow = { id: string; nom: string; prenom: string | null; metier: string | null; taux_journalier: number | null }
    type ExistingRow = { id: string; present: boolean; montant_jour: number; note: string; statut_presence: string | null }
    let existing: Record<string, ExistingRow> = {}

    if (navigator.onLine) {
      const { data: pts } = await supabase.from('pointages').select('id, ouvrier_id, present, montant_jour, note, statut_presence').eq('chantier_id', chantierId).eq('date_pointage', date)
      pts?.forEach(p => { existing[p.ouvrier_id] = p })
    } else {
      const cached = await cacheGet(`pointages_${chantierId}_${date}`)
      if (cached) (cached as ExistingRow[] & { ouvrier_id: string }[]).forEach(p => { existing[(p as ExistingRow & { ouvrier_id: string }).ouvrier_id] = p })
    }

    const lines: PointageLine[] = (ouvriers as OuvrierRow[]).map(o => {
      const ex = existing[o.id]
      let statut: StatutPresence = 'absent'
      if (ex) {
        if (ex.statut_presence) statut = ex.statut_presence as StatutPresence
        else statut = ex.present ? 'present' : 'absent'
      }
      return {
        ouvrier_id: o.id, nom: o.nom, prenom: o.prenom, metier: o.metier,
        taux_journalier: o.taux_journalier, statut,
        present: statut === 'present' || statut === 'demi_journee',
        montant_jour: ex?.montant_jour ?? (statut === 'present' ? (o.taux_journalier ?? 0) : statut === 'demi_journee' ? Math.round((o.taux_journalier ?? 0) / 2) : 0),
        note: ex?.note ?? '', existingId: ex?.id,
      }
    })
    setLignes(lines); setLoading(false)
  }, [chantierId, date])

  useEffect(() => { loadLignes() }, [loadLignes])

  function setStatut(idx: number, statut: StatutPresence) {
    setLignes(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const taux = l.taux_journalier ?? 0
      const montant = statut === 'present' ? taux : statut === 'demi_journee' ? Math.round(taux / 2) : 0
      return { ...l, statut, present: statut === 'present' || statut === 'demi_journee', montant_jour: montant }
    }))
  }

  function setMontant(idx: number, val: string) {
    setLignes(prev => prev.map((l, i) => i === idx ? { ...l, montant_jour: Number(val) || 0 } : l))
  }

  function setNote(idx: number, val: string) {
    setLignes(prev => prev.map((l, i) => i === idx ? { ...l, note: val } : l))
  }

  function setTousPresents() {
    setLignes(prev => prev.map(l => ({ ...l, statut: 'present' as StatutPresence, present: true, montant_jour: l.taux_journalier ?? 0 })))
  }

  function setTousAbsents() {
    setLignes(prev => prev.map(l => ({ ...l, statut: 'absent' as StatutPresence, present: false, montant_jour: 0 })))
  }

  async function syncQueue() {
    const count = queueCount()
    if (count === 0) return
    setSyncing(true)
    const q = queueGet()
    let failed = false
    for (const item of q) {
      try {
        const { error: err } = await supabase.from('pointages').upsert(item.data, { onConflict: 'chantier_id,ouvrier_id,date_pointage' })
        if (err) { failed = true; break }
      } catch { failed = true; break }
    }
    if (!failed) { queueClear(); setPendingCount(0) }
    setSyncing(false)
  }

  async function handleSave() {
    if (!chantierId) { setError('Sélectionnez un chantier.'); return }
    setSaving(true); setError(''); setSuccess('')

    const payload = lignes.map(l => ({
      chantier_id: chantierId, ouvrier_id: l.ouvrier_id, date_pointage: date,
      present: l.present, montant_jour: l.montant_jour, note: l.note || null,
      statut_presence: l.statut,
    }))

    if (navigator.onLine) {
      const { error: err } = await supabase.from('pointages').upsert(payload, { onConflict: 'chantier_id,ouvrier_id,date_pointage' })
      if (err) { setError(err.message); setSaving(false); return }
      cacheSet(`pointages_${chantierId}_${date}`, payload)
      setSuccess('Pointage enregistré.')
      setTimeout(() => setSuccess(''), 3000)
    } else {
      for (const item of payload) queueAdd({ table: 'pointages', op: 'insert', data: item as Record<string, unknown> })
      cacheSet(`pointages_${chantierId}_${date}`, payload)
      setPendingCount(queueCount())
      setSuccess('Sauvegardé hors ligne. Sera synchronisé à la reconnexion.')
      setTimeout(() => setSuccess(''), 4000)
    }
    prevChantierDate.current = ''
    setSaving(false)
    await loadLignes()
  }

  const presents = lignes.filter(l => l.statut === 'present').length
  const demiJournees = lignes.filter(l => l.statut === 'demi_journee').length
  const absents = lignes.filter(l => l.statut === 'absent').length
  const maladies = lignes.filter(l => l.statut === 'maladie').length
  const conges = lignes.filter(l => l.statut === 'conge').length
  const totalJour = lignes.reduce((s, l) => s + l.montant_jour, 0)

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-[-0.02em]">Pointage</h1>
          <p className="text-gray-500 text-[13px] mt-1 capitalize">{formatDate(date)}</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <button onClick={syncQueue} disabled={!isOnline || syncing}
              className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[12px] font-medium px-3 py-2 rounded-xl hover:bg-amber-500/15 transition-colors disabled:opacity-50">
              {syncing ? <Spinner /> : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M1 8a7 7 0 0012.25-4.67M15 8a7 7 0 01-12.25 4.67M1 4l-.5 3.5L4 7M15 12l.5-3.5L12 9" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              {pendingCount} en attente
            </button>
          )}
          <div className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-xl border ${isOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'} ${!isOnline ? 'animate-pulse' : ''}`} />
            {isOnline ? 'En ligne' : 'Hors ligne'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto mb-6">
        <div className="flex gap-1 bg-[#1a1a1a] rounded-xl p-1 w-fit">
          <Link href="/dashboard/equipes" className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">Ouvriers</Link>
          <span className="px-4 py-2 rounded-lg bg-orange-500/10 text-orange-400 text-[13px] font-medium">Pointage</span>
          <Link href="/dashboard/equipes/avances" className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">Avances</Link>
          <Link href="/dashboard/equipes/paie" className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">Paie</Link>
        </div>
      </div>

      {error && <div className="mb-4 flex items-center gap-2 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">{error}</div>}
      {success && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400 rounded-xl px-4 py-3 text-[13px]">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0"><path d="M3 8l4 4 6-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {success}
        </div>
      )}

      {/* Sélecteurs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.09em] text-gray-600 mb-1.5">Chantier</label>
          <select value={chantierId} onChange={e => { setChantierId(e.target.value); prevChantierDate.current = '' }}
            className="w-full bg-[#232323] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:border-orange-500 transition-all">
            <option value="">— Sélectionner un chantier —</option>
            {chantiers.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.09em] text-gray-600 mb-1.5">Date</label>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); prevChantierDate.current = '' }}
            className="w-full bg-[#232323] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:border-orange-500 transition-all" />
        </div>
      </div>

      {chantierId && equipeNonAffectee && lignes.length > 0 && (
        <div className="mb-4 flex items-start gap-2 bg-amber-500/[0.08] border border-amber-500/20 text-amber-300 rounded-xl px-4 py-3 text-[13px]">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 shrink-0 mt-0.5 text-amber-400"><path d="M8 2L1.5 13.5h13L8 2z" strokeLinejoin="round" strokeLinecap="round"/><path d="M8 6.5v3M8 11.5v.5" strokeLinecap="round"/></svg>
          <span>
            Aucune équipe affectée à ce chantier — tous les ouvriers sont affichés.{' '}
            <Link href={`/dashboard/chantiers/${chantierId}`} className="underline hover:no-underline font-medium">
              Affectez des ouvriers depuis la fiche chantier.
            </Link>
          </span>
        </div>
      )}

      {lignes.length > 0 && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="text-gray-600 text-[12px]">Actions groupées :</span>
          <button onClick={() => guard(setTousPresents)} className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px] font-semibold px-3 py-1.5 rounded-xl hover:bg-emerald-500/15 transition-colors">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M3 8l4 4 6-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Tous présents
          </button>
          <button onClick={() => guard(setTousAbsents)} className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] font-semibold px-3 py-1.5 rounded-xl hover:bg-red-500/15 transition-colors">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" /></svg>
            Tous absents
          </button>
        </div>
      )}

      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-[14px] font-semibold text-white">
            Feuille de présence
            {lignes.length > 0 && <span className="ml-2 text-gray-600 text-[12px] font-normal">({lignes.length} ouvriers)</span>}
          </h2>
        </div>

        {!chantierId ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-6">
            <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-orange-400"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <p className="text-gray-600 text-[13px]">Sélectionnez un chantier pour démarrer</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-14">
            <svg className="animate-spin w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : lignes.length === 0 ? (
          <div className="py-14 text-center px-6">
            <p className="text-gray-600 text-[13px]">Aucun ouvrier actif. Ajoutez des ouvriers dans l&apos;onglet Ouvriers.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {lignes.map((l, i) => (
              <div key={l.ouvrier_id} className="px-4 sm:px-5 py-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-gray-400 text-[11px] font-bold">{((l.prenom?.[0] ?? '') + l.nom[0]).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[13px] font-medium mb-0.5">{l.prenom ? `${l.prenom} ${l.nom}` : l.nom}</p>
                    {l.metier && <p className="text-gray-600 text-[11px] mb-2">{l.metier}</p>}
                    {/* Statut buttons */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(Object.entries(STATUTS) as [StatutPresence, typeof STATUTS[StatutPresence]][]).map(([k, s]) => (
                        <button key={k} onClick={() => guard(() => setStatut(i, k))}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${l.statut === k ? `${s.bg} ${s.color} ${s.border}` : 'bg-white/[0.03] border-white/[0.05] text-gray-600 hover:text-gray-300 hover:bg-white/[0.05]'}`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                    {/* Montant + note pour statuts payés */}
                    {(l.statut === 'present' || l.statut === 'demi_journee') && (
                      <div className="flex items-center gap-2">
                        <input type="number" min="0" value={l.montant_jour} onChange={e => setMontant(i, e.target.value)}
                          className="w-28 bg-[#1C1C1C] border border-white/[0.06] text-gray-300 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:border-orange-500 transition-all" />
                        <span className="text-gray-700 text-[11px]">FCFA</span>
                        <input type="text" value={l.note} onChange={e => setNote(i, e.target.value)} placeholder="Note…"
                          className="flex-1 bg-[#1C1C1C] border border-white/[0.06] text-gray-400 placeholder-gray-600 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:border-orange-500 transition-all" />
                      </div>
                    )}
                    {(l.statut === 'maladie' || l.statut === 'conge' || l.statut === 'absent') && (
                      <input type="text" value={l.note} onChange={e => setNote(i, e.target.value)} placeholder="Note (optionnel)…"
                        className="w-full bg-[#1C1C1C] border border-white/[0.06] text-gray-400 placeholder-gray-600 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:border-orange-500 transition-all" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Résumé */}
      {lignes.length > 0 && (
        <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-600 mb-4">Résumé du jour</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            {[
              { label: 'Présents', value: presents, cls: 'text-emerald-400' },
              { label: 'Demi-j.', value: demiJournees, cls: 'text-amber-400' },
              { label: 'Absents', value: absents, cls: 'text-red-400/80' },
              { label: 'Malades', value: maladies, cls: 'text-blue-400' },
              { label: 'Congés', value: conges, cls: 'text-purple-400' },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] rounded-xl p-3 text-center">
                <p className={`text-[22px] font-bold ${s.cls}`}>{s.value}</p>
                <p className="text-gray-600 text-[11px] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between bg-orange-500/[0.07] border border-orange-500/15 rounded-xl px-4 py-3">
            <span className="text-gray-500 text-[13px]">Total journée</span>
            <span className="text-orange-400 font-bold text-[16px]">{totalJour.toLocaleString('fr-FR')} FCFA</span>
          </div>
        </div>
      )}

      {chantierId && lignes.length > 0 && (
        <button onClick={() => guard(handleSave)} disabled={saving}
          className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[14px] font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {saving ? <><Spinner />Enregistrement…</> : (
            <>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M13.5 3.5L6 11l-3.5-3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {isOnline ? 'Enregistrer le pointage' : 'Sauvegarder hors ligne'}
            </>
          )}
        </button>
      )}
    </div>
  )
}
