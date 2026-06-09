'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cacheSet, cacheGet, queueAdd } from '@/lib/offline'

const supabase = createClient()

type Ouvrier = {
  id: string
  nom: string
  prenom: string | null
  metier: string | null
  taux_journalier: number | null
  actif: boolean | null
}

type Chantier = { id: string; nom: string; ville: string | null }

type PointageLine = {
  ouvrier_id: string
  present: boolean
  montant_jour: number
  note: string
  existingId?: string
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function formatFCFA(v: number) {
  return v.toLocaleString('fr-FR') + ' FCFA'
}

export default function PointagePage() {
  const [ouvriers, setOuvriers] = useState<Ouvrier[]>([])
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [date, setDate] = useState(todayStr())
  const [chantierId, setChantierId] = useState('')
  const [lignes, setLignes] = useState<Record<string, PointageLine>>({})
  const [loading, setLoading] = useState(true)
  const [loadingPointages, setLoadingPointages] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pageError, setPageError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [offlineMsg, setOfflineMsg] = useState('')

  const fetchChantiers = useCallback(async (entrepriseId: string) => {
    if (!navigator.onLine) {
      return cacheGet<Chantier[]>('chantiers_pointage') ?? []
    }
    const { data } = await supabase
      .from('chantiers')
      .select('id, nom, ville')
      .eq('entreprise_id', entrepriseId)
      .eq('statut', 'en_cours')
      .order('nom')
    if (data) cacheSet('chantiers_pointage', data)
    return data ?? []
  }, [])

  const fetchOuvriers = useCallback(async () => {
    if (!navigator.onLine) {
      return cacheGet<Ouvrier[]>('ouvriers_pointage') ?? []
    }
    const { data } = await supabase
      .from('ouvriers')
      .select('id, nom, prenom, metier, taux_journalier, actif')
      .eq('actif', true)
      .order('nom')
    if (data) cacheSet('ouvriers_pointage', data)
    return data ?? []
  }, [])

  // Détection réseau
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

  useEffect(() => {
    async function init() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles').select('entreprise_id').eq('id', user.id).single()
      if (!profile?.entreprise_id) { setLoading(false); return }

      const [ouv, chan] = await Promise.all([
        fetchOuvriers(),
        fetchChantiers(profile.entreprise_id),
      ])
      setOuvriers(ouv as Ouvrier[])
      setChantiers(chan as Chantier[])
      if (chan.length > 0) setChantierId(chan[0].id)
      setLoading(false)
    }
    init()
  }, [fetchOuvriers, fetchChantiers])

  // Charger les pointages existants quand date ou chantier change
  const loadPointages = useCallback(async (ouv: Ouvrier[]) => {
    if (!chantierId || ouv.length === 0) return
    setLoadingPointages(true)

    const { data: existing } = await supabase
      .from('pointages')
      .select('id, ouvrier_id, present, montant_jour, note')
      .eq('chantier_id', chantierId)
      .eq('date_pointage', date)

    const lines: Record<string, PointageLine> = {}
    ouv.forEach(o => {
      const ex = existing?.find(p => p.ouvrier_id === o.id)
      lines[o.id] = ex
        ? { ouvrier_id: o.id, present: ex.present, montant_jour: ex.montant_jour ?? 0, note: ex.note ?? '', existingId: ex.id }
        : { ouvrier_id: o.id, present: false, montant_jour: 0, note: '' }
    })
    setLignes(lines)
    setLoadingPointages(false)
  }, [chantierId, date])

  useEffect(() => {
    if (ouvriers.length > 0) loadPointages(ouvriers)
  }, [ouvriers, chantierId, date, loadPointages])

  function togglePresent(ouvrierId: string) {
    setLignes(prev => {
      const o = ouvriers.find(x => x.id === ouvrierId)
      const wasPresent = prev[ouvrierId]?.present ?? false
      const newPresent = !wasPresent
      return {
        ...prev,
        [ouvrierId]: {
          ...prev[ouvrierId],
          present: newPresent,
          montant_jour: newPresent ? (o?.taux_journalier ?? 0) : 0,
        }
      }
    })
    setSaved(false)
  }

  function setNote(ouvrierId: string, note: string) {
    setLignes(prev => ({ ...prev, [ouvrierId]: { ...prev[ouvrierId], note } }))
    setSaved(false)
  }

  async function handleSave() {
    if (!chantierId) return
    setSaving(true); setPageError('')

    const toInsert: object[] = []
    const toUpdate: { id: string; data: object }[] = []

    Object.values(lignes).forEach(l => {
      const payload = {
        ouvrier_id: l.ouvrier_id,
        chantier_id: chantierId,
        date_pointage: date,
        present: l.present,
        montant_jour: l.montant_jour,
        note: l.note || null,
        saisi_par: userId,
      }
      if (l.existingId) toUpdate.push({ id: l.existingId, data: payload })
      else toInsert.push(payload)
    })

    /* ── Mode hors ligne : mettre en queue ── */
    if (!isOnline) {
      toInsert.forEach(data =>
        queueAdd({ table: 'pointages', op: 'insert', data: data as Record<string, unknown> })
      )
      toUpdate.forEach(({ id, data }) =>
        queueAdd({ table: 'pointages', op: 'update', data: data as Record<string, unknown>, rowId: id })
      )
      setSaving(false); setSaved(true)
      setOfflineMsg('📥 Pointage sauvegardé localement — sera synchronisé au retour du réseau')
      setTimeout(() => { setSaved(false); setOfflineMsg('') }, 4500)
      return
    }

    /* ── Mode en ligne : envoi Supabase ── */
    const ops: Promise<{ error: { message: string } | null }>[] = []
    if (toInsert.length > 0) ops.push(supabase.from('pointages').insert(toInsert) as unknown as Promise<{ error: { message: string } | null }>)
    toUpdate.forEach(u => ops.push(supabase.from('pointages').update(u.data).eq('id', u.id) as unknown as Promise<{ error: { message: string } | null }>))

    const results = await Promise.all(ops)
    const err = results.find(r => r.error)
    if (err?.error) { setPageError(err.error.message); setSaving(false); return }

    setSaving(false); setSaved(true)
    await loadPointages(ouvriers)
    setTimeout(() => setSaved(false), 3000)
  }

  const presents = Object.values(lignes).filter(l => l.present).length
  const totalJour = Object.values(lignes).reduce((acc, l) => acc + (l.montant_jour ?? 0), 0)

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
          <span>Mode hors ligne — le pointage sera sauvegardé localement</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Pointage</h1>
          <p className="text-gray-500 text-sm mt-1">Enregistrement des présences journalières</p>
        </div>
        <button onClick={handleSave} disabled={saving || !chantierId || ouvriers.length === 0}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0">
          {saving
            ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Enregistrement…</>
            : saved
            ? <><svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/></svg>Enregistré !</>
            : 'Enregistrer le pointage'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1a1a1a] rounded-xl p-1 mb-6 w-fit">
        <Link href="/dashboard/equipes" className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">Ouvriers</Link>
        <span className="px-4 py-2 rounded-lg bg-orange-500/10 text-orange-400 text-[13px] font-medium">Pointage</span>
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

      {/* Sélecteurs */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-4">
          <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-widest">Date de pointage</label>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setSaved(false) }}
            className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all" />
        </div>
        <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-4">
          <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-widest">Chantier</label>
          {chantiers.length === 0 ? (
            <p className="text-amber-400 text-[12px]">Aucun chantier en cours. <Link href="/dashboard/chantiers" className="underline">Voir les chantiers</Link></p>
          ) : (
            <select value={chantierId} onChange={e => { setChantierId(e.target.value); setSaved(false) }}
              className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all">
              {chantiers.map(c => <option key={c.id} value={c.id}>{c.nom}{c.ville ? ` — ${c.ville}` : ''}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Résumé journée */}
      {ouvriers.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Présents', value: presents, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Absents', value: ouvriers.length - presents, color: 'text-gray-400', bg: 'bg-gray-500/10' },
            { label: 'Total du jour', value: formatFCFA(totalJour), color: 'text-orange-400', bg: 'bg-orange-500/10', wide: true },
          ].map(s => (
            <div key={s.label} className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 flex items-center gap-3">
              <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center shrink-0`}>
                <span className={`text-sm font-bold ${s.color}`}>{typeof s.value === 'number' ? s.value : ''}</span>
              </div>
              <div>
                <p className="text-gray-400 text-[12px]">{s.label}</p>
                {typeof s.value === 'string' && <p className={`text-[14px] font-bold ${s.color}`}>{s.value}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Liste pointages */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-[15px] font-semibold text-white">
            Ouvriers actifs
            {!loading && <span className="ml-2 text-gray-600 text-[13px] font-normal">({ouvriers.length})</span>}
          </h2>
        </div>

        {loading || loadingPointages ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : ouvriers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-white text-[14px] font-medium mb-1">Aucun ouvrier actif</p>
            <p className="text-gray-600 text-[12px]">
              <Link href="/dashboard/equipes" className="text-orange-400 hover:underline">Ajouter des ouvriers</Link> pour commencer le pointage
            </p>
          </div>
        ) : (
          <>
            {/* En-tête */}
            <div className="grid px-6 py-2.5 bg-[#1e1e1e] border-b border-white/[0.04]"
              style={{ gridTemplateColumns: '1fr 120px 140px 1fr' }}>
              <span className="text-gray-600 text-[11px] font-semibold uppercase tracking-wider">Ouvrier</span>
              <span className="text-gray-600 text-[11px] font-semibold uppercase tracking-wider text-center">Présence</span>
              <span className="text-gray-600 text-[11px] font-semibold uppercase tracking-wider text-right">Montant</span>
              <span className="text-gray-600 text-[11px] font-semibold uppercase tracking-wider pl-4">Note</span>
            </div>

            <div className="divide-y divide-white/[0.04]">
              {ouvriers.map(o => {
                const ligne = lignes[o.id]
                const isPresent = ligne?.present ?? false
                return (
                  <div key={o.id}
                    className={`grid items-center px-6 py-3.5 transition-colors ${isPresent ? 'hover:bg-emerald-500/[0.03]' : 'hover:bg-white/[0.02]'}`}
                    style={{ gridTemplateColumns: '1fr 120px 140px 1fr' }}>
                    {/* Infos ouvrier */}
                    <div>
                      <p className="text-white text-[13.5px] font-medium">
                        {o.prenom ? `${o.prenom} ${o.nom}` : o.nom}
                      </p>
                      <p className="text-gray-600 text-[11px]">{o.metier ?? '—'}</p>
                    </div>

                    {/* Toggle présence */}
                    <div className="flex justify-center">
                      <button onClick={() => togglePresent(o.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPresent ? 'bg-emerald-500' : 'bg-gray-700'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isPresent ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    {/* Montant */}
                    <div className="text-right">
                      <p className={`text-[13px] font-semibold ${isPresent ? 'text-emerald-400' : 'text-gray-700'}`}>
                        {formatFCFA(ligne?.montant_jour ?? 0)}
                      </p>
                    </div>

                    {/* Note */}
                    <div className="pl-4">
                      <input type="text" value={ligne?.note ?? ''} onChange={e => setNote(o.id, e.target.value)}
                        placeholder="Note…"
                        className="w-full bg-transparent border-b border-white/[0.06] text-gray-400 placeholder-gray-700 text-[12px] py-1 focus:outline-none focus:border-orange-500 transition-all" />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer total */}
            <div className="px-6 py-4 bg-[#1e1e1e] border-t border-white/[0.06] flex items-center justify-between">
              <p className="text-gray-500 text-[13px]">
                <span className="text-white font-medium">{presents}</span> présent{presents !== 1 ? 's' : ''} sur {ouvriers.length} ouvrier{ouvriers.length !== 1 ? 's' : ''}
              </p>
              <p className="text-orange-400 text-[15px] font-bold">{formatFCFA(totalJour)}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
