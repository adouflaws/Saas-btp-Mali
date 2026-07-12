'use client'

import { useState, useEffect, useCallback } from 'react'

/* ─── Types ──────────────────────────────────────── */

type Entreprise = {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  statut_abonnement: string
  date_fin_abonnement: string | null
  plan: string
  created_at: string
}

type FiltreStatut = 'tous' | 'essai' | 'actif' | 'expire' | 'suspendu'
type ModalType = 'activer' | 'jours' | 'suspendre' | 'supprimer'
type Modal = { type: ModalType; id: string; nom: string; telephone?: string | null } | null

/* ─── Helpers ─────────────────────────────────────── */

function joursRestants(dateStr: string | null): number {
  if (!dateStr) return 0
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function fcfa(v: number) { return v.toLocaleString('fr-FR') + ' FCFA' }

function getStatutBadge(statut: string, jours: number) {
  if (statut === 'actif')    return { emoji: '🟢', label: 'Actif',    cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' }
  if (statut === 'suspendu') return { emoji: '⚫', label: 'Suspendu', cls: 'bg-gray-500/15 text-gray-400 border-gray-500/25' }
  if (jours > 0)             return { emoji: '🟠', label: 'Essai',    cls: 'bg-orange-500/15 text-orange-400 border-orange-500/25' }
  return                            { emoji: '🔴', label: 'Expiré',  cls: 'bg-red-500/15 text-red-400 border-red-500/25' }
}

function getPlanBadge(plan: string) {
  if (plan === 'pro')        return 'bg-orange-500/15 text-orange-400 border-orange-500/25'
  if (plan === 'entreprise') return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25'
  return                            'bg-gray-500/15 text-gray-400 border-gray-500/25'
}

/* ─── Page ────────────────────────────────────────── */

export default function AdminClientsPage() {
  const [clients, setClients]     = useState<Entreprise[]>([])
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState('')
  const [search, setSearch]       = useState('')
  const [filtre, setFiltre]       = useState<FiltreStatut>('tous')

  // Modal state
  const [modal, setModal]               = useState<Modal>(null)
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro' | 'entreprise'>('pro')
  const [selectedMois, setSelectedMois] = useState(1)
  const [joursOfferts, setJoursOfferts] = useState('7')
  const [deleteStep, setDeleteStep]     = useState(1)
  const [deleting, setDeleting]         = useState(false)

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/clients')
      const { clients: data, error } = await res.json()
      if (error) console.error('Erreur chargement clients:', error)
      setClients(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  /* ── Stats ── */
  const nbTotal    = clients.length
  const nbEssai    = clients.filter(c => c.statut_abonnement === 'essai' && joursRestants(c.date_fin_abonnement) > 0).length
  const nbActif    = clients.filter(c => c.statut_abonnement === 'actif').length
  const nbExpire   = clients.filter(c => c.statut_abonnement !== 'actif' && c.statut_abonnement !== 'suspendu' && joursRestants(c.date_fin_abonnement) <= 0).length
  const nbSuspendu = clients.filter(c => c.statut_abonnement === 'suspendu').length
  const actifs     = clients.filter(c => c.statut_abonnement === 'actif')
  const revenuMensuel =
    actifs.filter(c => c.plan === 'starter').length   * 35000  +
    actifs.filter(c => c.plan === 'pro').length       * 70000  +
    actifs.filter(c => c.plan === 'entreprise').length * 125000

  /* ── Filtered ── */
  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    if (q && !c.nom.toLowerCase().includes(q) && !(c.email ?? '').toLowerCase().includes(q)) return false
    const j = joursRestants(c.date_fin_abonnement)
    if (filtre === 'essai')    return c.statut_abonnement === 'essai' && j > 0
    if (filtre === 'actif')    return c.statut_abonnement === 'actif'
    if (filtre === 'expire')   return c.statut_abonnement !== 'actif' && c.statut_abonnement !== 'suspendu' && j <= 0
    if (filtre === 'suspendu') return c.statut_abonnement === 'suspendu'
    return true
  })

  /* ── Actions ── */
  async function handleActivate() {
    if (!modal) return
    try {
      console.log('=== ACTIVATION CLIENT ===')
      console.log('Entreprise ID:', modal.id)
      console.log('Plan:', selectedPlan)
      console.log('Mois:', selectedMois)

      const res = await fetch('/api/admin/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entreprise_id: modal.id,
          plan: selectedPlan,
          mois: Number(selectedMois),
        }),
      })
      const result = await res.json()
      console.log('Résultat activation:', result)

      if (result.error) {
        showToast('Erreur : ' + result.error)
        return
      }

      showToast('✅ Client activé !')
      setModal(null)
      load()

      const message = encodeURIComponent(
        `Bonjour, votre abonnement BTP Mali ${selectedPlan} est activé ! 🎉\n🔗 saas-btp-mali.vercel.app/login\n— BTP Mali 🏗️`
      )
      const tel = modal.telephone?.replace(/\D/g, '')
      const waUrl = tel
        ? `https://wa.me/${tel}?text=${message}`
        : `https://wa.me/22376753087?text=${message}`
      window.open(waUrl, '_blank')
    } catch (err) {
      console.error('Erreur:', err)
      showToast('Erreur de connexion')
    }
  }

  async function offrirJours() {
    if (!modal) return
    const n = Math.max(1, parseInt(joursOfferts) || 7)
    try {
      const res = await fetch('/api/admin/action-entreprise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'jours', entreprise_id: modal.id, nb_jours: n }),
      })
      const result = await res.json()
      if (result.error) { showToast(`Erreur : ${result.error}`); return }
      showToast(`🎁 ${n} jours offerts !`)
      setModal(null)
      load()
    } catch { showToast('Erreur de connexion') }
  }

  async function suspendreClient() {
    if (!modal) return
    try {
      const res = await fetch('/api/admin/action-entreprise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suspendre', entreprise_id: modal.id }),
      })
      const result = await res.json()
      if (result.error) { showToast(`Erreur : ${result.error}`); return }
      showToast('⏸️ Compte suspendu')
      setModal(null)
      load()
    } catch { showToast('Erreur de connexion') }
  }

  async function supprimerClient() {
    if (!modal) return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entreprise_id: modal.id }),
      })
      if (res.ok) {
        showToast('🗑️ Client supprimé définitivement')
        setModal(null)
        load()
      } else {
        const data = await res.json()
        showToast(`Erreur : ${data.error}`)
      }
    } catch {
      showToast('Erreur de connexion')
    } finally {
      setDeleting(false)
    }
  }

  function openModal(type: ModalType, c: Entreprise) {
    setModal({ type, id: c.id, nom: c.nom, telephone: c.telephone })
    setDeleteStep(1)
    setDeleting(false)
  }

  /* ─── Render ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#1C1C1C] text-white">

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-[#232323] border border-white/[0.09] text-white text-[13px] font-semibold px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2">
          {toast}
        </div>
      )}

      {/* ── En-tête ── */}
      <div className="border-b border-white/[0.06] px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            ⚙️ Panel Admin — BTP Mali
          </h1>
          <p className="text-gray-500 text-[12px] mt-0.5">Gestion des clients et abonnements</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-[12px] text-gray-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] px-4 py-2 rounded-xl transition-all border border-white/[0.06]"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
            <path d="M2 8a6 6 0 1010.9-3.4M2 4v4h4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Actualiser
        </button>
      </div>

      <div className="p-4 sm:p-6 space-y-6">

        {/* ── Stats + Revenue ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total clients',  value: nbTotal,    color: 'text-white'         },
            { label: 'En essai',       value: nbEssai,    color: 'text-orange-400'    },
            { label: 'Actifs',         value: nbActif,    color: 'text-emerald-400'   },
            { label: 'Expirés',        value: nbExpire,   color: 'text-red-400'       },
            { label: 'Suspendus',      value: nbSuspendu, color: 'text-gray-400'      },
          ].map(s => (
            <div key={s.label} className="bg-[#232323] rounded-2xl border border-white/[0.06] p-4 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-gray-600 text-[11px] mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Revenue mensuel estimé */}
        <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-gray-500 text-[11px] uppercase tracking-widest mb-1">💰 Revenu mensuel estimé (abonnés actifs)</p>
            <p className="text-2xl font-black text-emerald-400">{fcfa(revenuMensuel)}</p>
          </div>
          <div className="flex gap-4 text-[12px] text-gray-500">
            <span>Starter {actifs.filter(c => c.plan === 'starter').length} × 35 000</span>
            <span>Pro {actifs.filter(c => c.plan === 'pro').length} × 70 000</span>
            <span>Entreprise {actifs.filter(c => c.plan === 'entreprise').length} × 125 000</span>
          </div>
        </div>

        {/* ── Search + Filtres ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600">
              <circle cx="7" cy="7" r="4.5"/><path d="M11 11l3 3" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Rechercher entreprise ou email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#232323] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-[13px] text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {([
              { key: 'tous',     label: 'Tous',     n: nbTotal    },
              { key: 'essai',    label: '🟠 Essai', n: nbEssai    },
              { key: 'actif',    label: '🟢 Actif', n: nbActif    },
              { key: 'expire',   label: '🔴 Expiré',n: nbExpire   },
              { key: 'suspendu', label: '⚫ Suspendu',n: nbSuspendu},
            ] as { key: FiltreStatut; label: string; n: number }[]).map(f => (
              <button
                key={f.key}
                onClick={() => setFiltre(f.key)}
                className={`px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all ${
                  filtre === f.key
                    ? 'bg-orange-500 text-white'
                    : 'bg-white/[0.04] text-gray-500 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]'
                }`}
              >
                {f.label} <span className="opacity-60">({f.n})</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Tableau clients ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : (
          <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {['Entreprise', 'Email', 'Plan', 'Statut', 'Jours restants', 'Inscription', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-widest whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filtered.map(c => {
                    const jours  = joursRestants(c.date_fin_abonnement)
                    const statut = getStatutBadge(c.statut_abonnement, jours)
                    return (
                      <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">

                        {/* Nom */}
                        <td className="px-4 py-3.5">
                          <p className="text-white text-[13px] font-semibold">{c.nom}</p>
                          {c.telephone && <p className="text-gray-600 text-[11px]">{c.telephone}</p>}
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3.5">
                          <p className="text-gray-400 text-[13px]">{c.email ?? '—'}</p>
                        </td>

                        {/* Plan badge */}
                        <td className="px-4 py-3.5">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border capitalize ${getPlanBadge(c.plan)}`}>
                            {c.plan || '—'}
                          </span>
                        </td>

                        {/* Statut badge */}
                        <td className="px-4 py-3.5">
                          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 w-fit ${statut.cls}`}>
                            {statut.emoji} {statut.label}
                          </span>
                        </td>

                        {/* Jours restants */}
                        <td className="px-4 py-3.5">
                          {c.date_fin_abonnement ? (
                            <p className={`text-[13px] font-semibold ${jours <= 0 ? 'text-red-400' : jours <= 7 ? 'text-orange-400' : 'text-gray-300'}`}>
                              {jours <= 0 ? 'Expiré' : `${jours}j`}
                              <span className="block text-gray-700 text-[10px] font-normal">
                                {new Date(c.date_fin_abonnement).toLocaleDateString('fr-FR')}
                              </span>
                            </p>
                          ) : <span className="text-gray-700 text-[13px]">—</span>}
                        </td>

                        {/* Inscription */}
                        <td className="px-4 py-3.5">
                          <p className="text-gray-600 text-[12px]">
                            {new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                          </p>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => { openModal('activer', c); setSelectedPlan('pro'); setSelectedMois(1) }}
                              className="text-[11px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                            >
                              ✅ Activer
                            </button>
                            <button
                              onClick={() => { openModal('jours', c); setJoursOfferts('7') }}
                              className="text-[11px] font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                            >
                              🎁 Jours
                            </button>
                            <button
                              onClick={() => openModal('suspendre', c)}
                              className="text-[11px] font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-amber-400 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                            >
                              ⏸️
                            </button>
                            <button
                              onClick={() => openModal('supprimer', c)}
                              className="text-[11px] font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-gray-600 text-[14px]">
                        {search ? 'Aucun client trouvé pour cette recherche' : 'Aucun client pour l\'instant'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ══════ MODAL ACTIVER ══════ */}
      {modal?.type === 'activer' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.09] shadow-2xl p-6">
            <div className="sm:hidden flex justify-center -mt-3 mb-3"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <h3 className="text-[15px] font-bold text-white mb-0.5">✅ Activer l&apos;abonnement</h3>
            <p className="text-gray-500 text-[13px] mb-5">{modal.nom}</p>

            {/* Plan */}
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Plan</p>
            <select
              value={selectedPlan}
              onChange={e => setSelectedPlan(e.target.value as 'starter' | 'pro' | 'entreprise')}
              className="w-full mb-4 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.10] text-white text-[13px] focus:outline-none focus:border-emerald-500/50"
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="entreprise">Entreprise</option>
            </select>

            {/* Durée */}
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Durée</p>
            <select
              value={selectedMois}
              onChange={e => setSelectedMois(Number(e.target.value))}
              className="w-full mb-6 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.10] text-white text-[13px] focus:outline-none focus:border-emerald-500/50"
            >
              <option value={1}>1 mois</option>
              <option value={3}>3 mois</option>
              <option value={6}>6 mois</option>
              <option value={12}>12 mois (1 an)</option>
            </select>

            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] hover:text-white transition-colors">
                Annuler
              </button>
              <button onClick={handleActivate} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold transition-colors">
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL OFFRIR JOURS ══════ */}
      {modal?.type === 'jours' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative w-full max-w-xs bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.09] shadow-2xl p-6">
            <div className="sm:hidden flex justify-center -mt-3 mb-3"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <h3 className="text-[15px] font-bold text-white mb-0.5">🎁 Offrir des jours</h3>
            <p className="text-gray-500 text-[13px] mb-5">{modal.nom}</p>
            <label className="block text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Nombre de jours</label>
            <input
              type="number" min="1" max="365"
              value={joursOfferts}
              onChange={e => setJoursOfferts(e.target.value)}
              className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 mb-5 transition-colors"
            />
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] hover:text-white transition-colors">
                Annuler
              </button>
              <button onClick={offrirJours} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold transition-colors">
                Offrir ✅
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL SUSPENDRE ══════ */}
      {modal?.type === 'suspendre' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative w-full max-w-xs bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.09] shadow-2xl p-6 text-center">
            <div className="sm:hidden flex justify-center -mt-3 mb-3"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <p className="text-4xl mb-3">⏸️</p>
            <h3 className="text-[15px] font-bold text-white mb-1">Suspendre le compte</h3>
            <p className="text-gray-500 text-[13px] mb-5">
              Le client <span className="text-white font-semibold">{modal.nom}</span> n&apos;aura plus accès à l&apos;application.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] hover:text-white transition-colors">
                Annuler
              </button>
              <button onClick={suspendreClient} className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-[13px] font-semibold transition-colors">
                Suspendre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL SUPPRIMER ══════ */}
      {modal?.type === 'supprimer' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !deleting && setModal(null)} />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-red-500/25 shadow-2xl p-6 text-center">
            <div className="sm:hidden flex justify-center -mt-3 mb-3"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            {deleteStep === 1 ? (
              <>
                <p className="text-4xl mb-3">⚠️</p>
                <h3 className="text-[15px] font-bold text-white mb-1">Êtes-vous sûr ?</h3>
                <p className="text-gray-400 text-[13px] mb-5">
                  Vous allez supprimer <span className="text-white font-semibold">{modal.nom}</span>.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] hover:text-white transition-colors">
                    Annuler
                  </button>
                  <button onClick={() => setDeleteStep(2)} className="flex-1 py-2.5 rounded-xl bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/30 text-[13px] font-semibold transition-colors">
                    Oui, continuer
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-4xl mb-3">🗑️</p>
                <h3 className="text-[15px] font-bold text-red-400 mb-1">Action irréversible</h3>
                <p className="text-gray-400 text-[13px] mb-2">
                  Toutes les données de <span className="text-white font-semibold">{modal.nom}</span> seront définitivement supprimées :
                </p>
                <ul className="text-[12px] text-gray-600 text-left mb-5 space-y-1 bg-red-500/[0.07] rounded-xl p-3 border border-red-500/15">
                  <li>• Compte utilisateur</li>
                  <li>• Chantiers, tâches, photos</li>
                  <li>• Factures et dépenses</li>
                  <li>• Toutes les données</li>
                </ul>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteStep(1)} disabled={deleting} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] hover:text-white transition-colors disabled:opacity-50">
                    Retour
                  </button>
                  <button
                    onClick={supprimerClient}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[13px] font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Suppression…</>
                    ) : 'Supprimer définitivement'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
