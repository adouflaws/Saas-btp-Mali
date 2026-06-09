'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

/* ─── Types ─────────────────────────────────────────────────── */

type Vehicule = {
  id: string; nom: string; immatriculation: string | null
  type: string; actif: boolean; created_at: string
}
type Plein = {
  id: string; vehicule_id: string; chantier_id: string | null
  date_plein: string; litres: number; montant: number
  kilometrage: number | null; station: string | null
  vehicule: { nom: string; type: string } | null
  chantier: { nom: string } | null
}
type Chantier = { id: string; nom: string }

/* ─── Constants ─────────────────────────────────────────────── */

const TYPE_ICONS: Record<string, string> = {
  camion: '🚛', pick_up: '🛻', engin: '🚜', moto: '🏍️', autre: '🚗',
}
const TYPE_LABELS: Record<string, string> = {
  camion: 'Camion', pick_up: 'Pick-up', engin: 'Engin', moto: 'Moto', autre: 'Autre',
}

const DEFAULT_PLEIN: Record<string, string> = {
  vehicule_id: '', chantier_id: '',
  date_plein: new Date().toISOString().split('T')[0],
  litres: '', montant: '', kilometrage: '', station: '',
}
const DEFAULT_VEHICULE = { nom: '', immatriculation: '', type: 'camion' }

/* ─── Helpers ────────────────────────────────────────────────── */

function formatFCFA(n: number) {
  return n.toLocaleString('fr-FR') + ' F'
}

function monthRange(offset: number) {
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth() + offset
  return {
    first: new Date(y, m, 1).toISOString().split('T')[0],
    last:  new Date(y, m + 1, 0).toISOString().split('T')[0],
    prefix: new Date(y, m, 1).toISOString().substring(0, 7),
  }
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function CarburantPage() {
  const [entrepriseId, setEntrepriseId] = useState<string | null>(null)
  const [userId, setUserId]             = useState<string | null>(null)
  const [vehicules, setVehicules]       = useState<Vehicule[]>([])
  const [pleins, setPleins]             = useState<Plein[]>([])
  const [chantiers, setChantiers]       = useState<Chantier[]>([])
  const [loading, setLoading]           = useState(true)
  const [pageError, setPageError]       = useState('')

  const [showPlein, setShowPlein]       = useState(false)
  const [pleinForm, setPleinForm]       = useState(DEFAULT_PLEIN)
  const [savingPlein, setSavingPlein]   = useState(false)
  const [pleinErr, setPleinErr]         = useState('')

  const [showVehicule, setShowVehicule]         = useState(false)
  const [vehiculeForm, setVehiculeForm]         = useState(DEFAULT_VEHICULE)
  const [savingVehicule, setSavingVehicule]     = useState(false)
  const [vehiculeErr, setVehiculeErr]           = useState('')

  const [toast, setToast] = useState('')

  /* ── Fetch ── */

  const fetchAll = useCallback(async (eid: string) => {
    const prev = monthRange(-1)
    const [vRes, pRes, cRes] = await Promise.all([
      supabase.from('vehicules')
        .select('*')
        .order('created_at'),
      supabase.from('pleins_carburant')
        .select('*, vehicule:vehicules(nom, type), chantier:chantiers(nom)')
        .gte('date_plein', prev.first)
        .order('date_plein', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('chantiers')
        .select('id, nom')
        .eq('entreprise_id', eid)
        .in('statut', ['preparation', 'en_cours'])
        .order('nom'),
    ])
    if (vRes.error) setPageError(vRes.error.message)
    else setVehicules((vRes.data ?? []) as Vehicule[])
    if (pRes.error) setPageError(pRes.error.message)
    else setPleins((pRes.data ?? []) as Plein[])
    setChantiers((cRes.data ?? []) as Chantier[])
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles').select('entreprise_id').eq('id', user.id).single()
      if (!profile?.entreprise_id) {
        setPageError('Aucune entreprise associée à votre compte.')
        setLoading(false); return
      }
      setEntrepriseId(profile.entreprise_id)
      await fetchAll(profile.entreprise_id)
      setLoading(false)
    }
    init()
  }, [fetchAll])

  /* ── Stats ── */

  const cur  = monthRange(0)
  const prev = monthRange(-1)

  const pleinsCur  = pleins.filter(p => p.date_plein.startsWith(cur.prefix))
  const pleinsPrev = pleins.filter(p => p.date_plein.startsWith(prev.prefix))

  const totalCur  = pleinsCur.reduce((s, p)  => s + Number(p.montant), 0)
  const totalPrev = pleinsPrev.reduce((s, p) => s + Number(p.montant), 0)
  const hausse    = totalPrev > 0 && totalCur > totalPrev * 1.3
  const haussePct = totalPrev > 0 ? Math.round((totalCur / totalPrev - 1) * 100) : 0

  const vehiculesActifs = vehicules.filter(v => v.actif)

  const coutVehicule = vehiculesActifs
    .map(v => ({
      v,
      total:  pleinsCur.filter(p => p.vehicule_id === v.id).reduce((s, p) => s + Number(p.montant), 0),
      litres: pleinsCur.filter(p => p.vehicule_id === v.id).reduce((s, p) => s + Number(p.litres),  0),
    }))
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total)

  const coutChantier = Object.values(
    pleinsCur.reduce((acc, p) => {
      const k = p.chantier_id ?? '__none__'
      const label = p.chantier?.nom ?? 'Sans chantier'
      if (!acc[k]) acc[k] = { label, total: 0 }
      acc[k].total += Number(p.montant)
      return acc
    }, {} as Record<string, { label: string; total: number }>)
  ).sort((a, b) => b.total - a.total)

  const maxV = Math.max(...coutVehicule.map(x => x.total), 1)
  const maxC = Math.max(...coutChantier.map(x => x.total), 1)

  /* ── Actions ── */

  async function savePlein(e: React.FormEvent) {
    e.preventDefault()
    setSavingPlein(true); setPleinErr('')

    // Re-fetch user + entreprise_id fraîchement (évite bug si state null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPleinErr('Session expirée, veuillez vous reconnecter.'); setSavingPlein(false); return }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles').select('entreprise_id').eq('id', user.id).single()

    if (profileErr || !profile?.entreprise_id) {
      const msg = profileErr?.message ?? 'Entreprise introuvable'
      console.error('Erreur profil:', profileErr)
      setPleinErr(msg); setSavingPlein(false); return
    }

    console.log('=== INSERTION PLEIN ===')
    console.log('entreprise_id:', profile.entreprise_id)
    console.log('vehicule_id:', pleinForm.vehicule_id)
    console.log('litres:', pleinForm.litres, '| montant:', pleinForm.montant)

    const { error } = await supabase.from('pleins_carburant').insert({
      vehicule_id:   pleinForm.vehicule_id,
      chantier_id:   pleinForm.chantier_id || null,
      entreprise_id: profile.entreprise_id,
      date_plein:    pleinForm.date_plein,
      litres:        Number(pleinForm.litres),
      montant:       Number(pleinForm.montant),
      kilometrage:   pleinForm.kilometrage ? Number(pleinForm.kilometrage) : null,
      station:       pleinForm.station.trim() || null,
      saisi_par:     user.id,
    })

    if (error) {
      console.error('Erreur plein:', error)
      setPleinErr(error.message)
      setSavingPlein(false); return
    }

    // Succès
    setShowPlein(false)
    setPleinForm({ ...DEFAULT_PLEIN, date_plein: new Date().toISOString().split('T')[0] })
    setSavingPlein(false)
    setToast('Plein enregistré ✅')
    setTimeout(() => setToast(''), 3500)
    await fetchAll(profile.entreprise_id)
    // Mettre à jour aussi entrepriseId si nécessaire
    setEntrepriseId(profile.entreprise_id)
    setUserId(user.id)
  }

  async function saveVehicule(e: React.FormEvent) {
    e.preventDefault()
    if (!entrepriseId) return
    setSavingVehicule(true); setVehiculeErr('')
    const { error } = await supabase.from('vehicules').insert({
      nom:             vehiculeForm.nom.trim(),
      immatriculation: vehiculeForm.immatriculation.trim() || null,
      type:            vehiculeForm.type,
      entreprise_id:   entrepriseId,
      actif:           true,
    })
    if (error) { setVehiculeErr(error.message); setSavingVehicule(false); return }
    setShowVehicule(false)
    setVehiculeForm(DEFAULT_VEHICULE)
    setSavingVehicule(false)
    await fetchAll(entrepriseId)
  }

  async function toggleActif(v: Vehicule) {
    await supabase.from('vehicules').update({ actif: !v.actif }).eq('id', v.id)
    if (entrepriseId) await fetchAll(entrepriseId)
  }

  /* ── Loading ── */

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
    </div>
  )

  /* ─────────────────────────────────────────────────────────── */
  /* ── RENDER ── */
  /* ─────────────────────────────────────────────────────────── */

  return (
    <div className="p-4 sm:p-6 md:p-8">

      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Carburant</h1>
          <p className="text-gray-500 text-sm mt-1">Suivi de consommation des véhicules</p>
        </div>
        <button
          onClick={() => { setPleinForm({ ...DEFAULT_PLEIN, date_plein: new Date().toISOString().split('T')[0] }); setPleinErr(''); setShowPlein(true) }}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors min-h-[44px] shrink-0"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
          </svg>
          Nouveau plein
        </button>
      </div>

      {pageError && (
        <div className="mb-6 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">
          {pageError}
        </div>
      )}

      {/* ── 4 cartes résumé ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total ce mois', value: totalCur > 0 ? formatFCFA(totalCur) : '—', icon: '⛽', bg: 'bg-orange-500/10' },
          { label: 'Pleins ce mois', value: String(pleinsCur.length), icon: '🧾', bg: 'bg-blue-500/10' },
          { label: 'Véhicules actifs', value: String(vehiculesActifs.length), icon: '🚛', bg: 'bg-emerald-500/10' },
          {
            label: 'Coût moyen/plein',
            value: pleinsCur.length > 0 ? formatFCFA(Math.round(totalCur / pleinsCur.length)) : '—',
            icon: '📊', bg: 'bg-purple-500/10',
          },
        ].map(card => (
          <div key={card.label} className="bg-[#232323] rounded-2xl border border-white/[0.06] p-4">
            <div className={`w-9 h-9 ${card.bg} rounded-xl flex items-center justify-center mb-3 text-base`}>
              {card.icon}
            </div>
            <p className="text-white text-base sm:text-lg font-bold leading-none mb-1.5 truncate">{card.value}</p>
            <p className="text-gray-500 text-[11px] sm:text-[12px]">{card.label}</p>
          </div>
        ))}
      </div>

      {/* ── Alerte +30% ── */}
      {hausse && (
        <div className="mb-6 flex items-start gap-3 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl px-4 py-3">
          <span className="text-xl shrink-0 mt-0.5">⚠️</span>
          <div>
            <p className="text-amber-400 text-[13px] font-semibold">Consommation en hausse ce mois</p>
            <p className="text-amber-500/60 text-[12px] mt-0.5">
              {formatFCFA(totalCur)} ce mois vs {formatFCFA(totalPrev)} le mois précédent (+{haussePct}%)
            </p>
          </div>
        </div>
      )}

      {/* ── Grille principale : Véhicules + Pleins récents ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* VÉHICULES */}
        <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-white">
              Véhicules
              <span className="ml-2 text-gray-600 text-[12px] font-normal">({vehicules.length})</span>
            </h2>
            <button
              onClick={() => { setVehiculeForm(DEFAULT_VEHICULE); setVehiculeErr(''); setShowVehicule(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[12px] font-medium transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
              Ajouter
            </button>
          </div>

          {vehicules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center px-4">
              <span className="text-4xl mb-3">🚗</span>
              <p className="text-white text-[14px] font-medium mb-1">Aucun véhicule</p>
              <p className="text-gray-600 text-[12px]">Ajoutez vos véhicules pour démarrer le suivi</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {vehicules.map(v => {
                const totalV  = pleinsCur.filter(p => p.vehicule_id === v.id).reduce((s, p) => s + Number(p.montant), 0)
                const nbPleinsV = pleinsCur.filter(p => p.vehicule_id === v.id).length
                return (
                  <div key={v.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${v.actif ? 'bg-orange-500/10' : 'bg-white/[0.03]'}`}>
                      {TYPE_ICONS[v.type] ?? '🚗'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className={`text-[14px] font-semibold truncate ${v.actif ? 'text-white' : 'text-gray-600 line-through'}`}>
                          {v.nom}
                        </p>
                        {v.immatriculation && (
                          <span className="text-gray-600 text-[10px] font-mono shrink-0 hidden sm:inline">{v.immatriculation}</span>
                        )}
                      </div>
                      <p className="text-gray-600 text-[11px] mt-0.5">
                        {TYPE_LABELS[v.type] ?? 'Autre'}
                        {totalV > 0 && ` · ${formatFCFA(totalV)} / ${nbPleinsV} plein${nbPleinsV > 1 ? 's' : ''} ce mois`}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleActif(v)}
                      className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                        v.actif
                          ? 'bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400'
                          : 'bg-white/[0.04] text-gray-600 hover:bg-emerald-500/10 hover:text-emerald-400'
                      }`}
                    >
                      {v.actif ? 'Actif' : 'Inactif'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* PLEINS RÉCENTS */}
        <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-[15px] font-semibold text-white">Derniers pleins</h2>
          </div>

          {pleins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center px-4">
              <span className="text-4xl mb-3">⛽</span>
              <p className="text-white text-[14px] font-medium mb-1">Aucun plein enregistré</p>
              <p className="text-gray-600 text-[12px]">Cliquez sur «&nbsp;Nouveau plein&nbsp;» pour commencer</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[380px]">
                <thead>
                  <tr>
                    <th className="px-5 py-2.5 text-left text-gray-600 text-[10px] font-semibold uppercase tracking-wider">Véhicule</th>
                    <th className="px-2 py-2.5 text-left text-gray-600 text-[10px] font-semibold uppercase tracking-wider">Date</th>
                    <th className="px-2 py-2.5 text-right text-gray-600 text-[10px] font-semibold uppercase tracking-wider">Litres</th>
                    <th className="px-2 py-2.5 pr-5 text-right text-gray-600 text-[10px] font-semibold uppercase tracking-wider">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {pleins.slice(0, 20).map(p => (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-white text-[13px] font-medium">
                          {TYPE_ICONS[p.vehicule?.type ?? 'autre']} {p.vehicule?.nom ?? '—'}
                        </p>
                        {p.chantier?.nom && (
                          <p className="text-gray-600 text-[11px] truncate max-w-[160px]">{p.chantier.nom}</p>
                        )}
                        {p.station && !p.chantier?.nom && (
                          <p className="text-gray-700 text-[11px] truncate max-w-[160px]">{p.station}</p>
                        )}
                      </td>
                      <td className="px-2 py-3 text-gray-400 text-[12px] whitespace-nowrap">
                        {new Date(p.date_plein + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      </td>
                      <td className="px-2 py-3 text-gray-300 text-[12px] text-right whitespace-nowrap">
                        {Number(p.litres).toFixed(1)} L
                      </td>
                      <td className="px-2 py-3 pr-5 text-orange-400 text-[12px] font-semibold text-right whitespace-nowrap">
                        {Number(p.montant).toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Récapitulatif par barres ── */}
      {(coutVehicule.length > 0 || coutChantier.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Par véhicule */}
          {coutVehicule.length > 0 && (
            <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5">
              <h2 className="text-[15px] font-semibold text-white mb-5">
                Coût par véhicule
                <span className="ml-2 text-gray-600 text-[12px] font-normal">ce mois</span>
              </h2>
              <div className="space-y-4">
                {coutVehicule.map(({ v, total, litres }) => (
                  <div key={v.id}>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="shrink-0 text-sm">{TYPE_ICONS[v.type]}</span>
                        <span className="text-white text-[13px] font-medium truncate">{v.nom}</span>
                        <span className="text-gray-600 text-[11px] shrink-0">{litres.toFixed(0)} L</span>
                      </div>
                      <span className="text-orange-400 text-[13px] font-semibold shrink-0">
                        {formatFCFA(total)}
                      </span>
                    </div>
                    <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full"
                        style={{ width: `${(total / maxV) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Par chantier */}
          {coutChantier.length > 0 && (
            <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5">
              <h2 className="text-[15px] font-semibold text-white mb-5">
                Coût par chantier
                <span className="ml-2 text-gray-600 text-[12px] font-normal">ce mois</span>
              </h2>
              <div className="space-y-4">
                {coutChantier.map(({ label, total }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <span className="text-white text-[13px] font-medium truncate min-w-0">{label}</span>
                      <span className="text-blue-400 text-[13px] font-semibold shrink-0">
                        {formatFCFA(total)}
                      </span>
                    </div>
                    <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(total / maxC) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Toast succès ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-emerald-600 text-white text-[13px] font-semibold px-5 py-3 rounded-xl shadow-xl whitespace-nowrap">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd"/>
          </svg>
          {toast}
        </div>
      )}

      {/* ══════════════════════════════
          MODAL : Nouveau plein
      ══════════════════════════════ */}
      {showPlein && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowPlein(false) }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full sm:max-w-lg bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Poignée mobile */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-[15px] font-semibold text-white">Nouveau plein</h2>
              <button onClick={() => setShowPlein(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M2 2l12 12M14 2L2 14" strokeLinecap="round"/></svg>
              </button>
            </div>

            <form onSubmit={savePlein} className="px-6 py-5 space-y-4">
              {pleinErr && <div className="text-red-400 bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3 text-[13px]">{pleinErr}</div>}

              {/* Véhicule */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Véhicule *</label>
                <select required value={pleinForm.vehicule_id} onChange={e => setPleinForm(f => ({ ...f, vehicule_id: e.target.value }))}
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all">
                  <option value="">— Sélectionner —</option>
                  {vehiculesActifs.map(v => (
                    <option key={v.id} value={v.id}>{TYPE_ICONS[v.type]} {v.nom}{v.immatriculation ? ` · ${v.immatriculation}` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Chantier */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Chantier (optionnel)</label>
                <select value={pleinForm.chantier_id} onChange={e => setPleinForm(f => ({ ...f, chantier_id: e.target.value }))}
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all">
                  <option value="">— Aucun —</option>
                  {chantiers.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Date</label>
                <input type="date" required value={pleinForm.date_plein} onChange={e => setPleinForm(f => ({ ...f, date_plein: e.target.value }))}
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all" />
              </div>

              {/* Litres + Montant */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Litres *</label>
                  <input type="number" required min="0.1" step="0.1" placeholder="Ex: 45.5"
                    value={pleinForm.litres} onChange={e => setPleinForm(f => ({ ...f, litres: e.target.value }))}
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Montant FCFA *</label>
                  <input type="number" required min="1" step="1" placeholder="Ex: 45000"
                    value={pleinForm.montant} onChange={e => setPleinForm(f => ({ ...f, montant: e.target.value }))}
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all" />
                </div>
              </div>

              {/* Kilométrage + Station */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Kilométrage</label>
                  <input type="number" min="0" placeholder="Ex: 12500"
                    value={pleinForm.kilometrage} onChange={e => setPleinForm(f => ({ ...f, kilometrage: e.target.value }))}
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Station</label>
                  <input type="text" placeholder="Ex: Total Bamako"
                    value={pleinForm.station} onChange={e => setPleinForm(f => ({ ...f, station: e.target.value }))}
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all" />
                </div>
              </div>

              <div className="flex gap-3 pt-2 pb-2">
                <button type="button" onClick={() => setShowPlein(false)}
                  className="flex-1 min-h-[44px] rounded-xl border border-white/[0.08] text-gray-400 hover:text-white text-[13px] font-medium transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={savingPlein}
                  className="flex-1 min-h-[44px] rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {savingPlein ? <><Spinner /> Enregistrement…</> : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          MODAL : Nouveau véhicule
      ══════════════════════════════ */}
      {showVehicule && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowVehicule(false) }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full sm:max-w-sm bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl">
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-[15px] font-semibold text-white">Ajouter un véhicule</h2>
              <button onClick={() => setShowVehicule(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M2 2l12 12M14 2L2 14" strokeLinecap="round"/></svg>
              </button>
            </div>

            <form onSubmit={saveVehicule} className="px-6 py-5 space-y-4">
              {vehiculeErr && <div className="text-red-400 bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3 text-[13px]">{vehiculeErr}</div>}

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Nom *</label>
                <input type="text" required placeholder="Ex: Camion SINOTRUK 01"
                  value={vehiculeForm.nom} onChange={e => setVehiculeForm(f => ({ ...f, nom: e.target.value }))}
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all" />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Immatriculation</label>
                <input type="text" placeholder="Ex: BM 1234 A"
                  value={vehiculeForm.immatriculation} onChange={e => setVehiculeForm(f => ({ ...f, immatriculation: e.target.value }))}
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all" />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Type</label>
                <select value={vehiculeForm.type} onChange={e => setVehiculeForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all">
                  <option value="camion">🚛 Camion</option>
                  <option value="pick_up">🛻 Pick-up</option>
                  <option value="engin">🚜 Engin</option>
                  <option value="moto">🏍️ Moto</option>
                  <option value="autre">🚗 Autre</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2 pb-2">
                <button type="button" onClick={() => setShowVehicule(false)}
                  className="flex-1 min-h-[44px] rounded-xl border border-white/[0.08] text-gray-400 hover:text-white text-[13px] font-medium transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={savingVehicule}
                  className="flex-1 min-h-[44px] rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {savingVehicule ? <><Spinner /> Ajout…</> : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
