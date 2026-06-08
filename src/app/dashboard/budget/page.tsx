'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

// ─── Types ───────────────────────────────────────────────────────────────────

type Chantier = {
  id: string; nom: string; ville: string | null
  budget_prevu: number | null; avancement: number | null
}
type Depense = {
  id: string; chantier_id: string; entreprise_id: string
  categorie: string; description: string; fournisseur: string | null
  montant: number; date_depense: string
}
type Stock = {
  id: string; chantier_id: string; nom: string; unite: string
  quantite_stock: number | null; quantite_min: number | null
  prix_unitaire: number | null; updated_at: string
}
type DepForm = { categorie: string; description: string; fournisseur: string; montant: string; date_depense: string }
type StockForm = { nom: string; unite: string; quantite_stock: string; quantite_min: string; prix_unitaire: string }

// ─── Config catégories ───────────────────────────────────────────────────────

const CATS = [
  { value: 'materiaux',      label: 'Matériaux',       color: '#f97316', badge: 'bg-orange-500/10 text-orange-400' },
  { value: 'main_oeuvre',    label: "Main d'œuvre",    color: '#3b82f6', badge: 'bg-blue-500/10 text-blue-400' },
  { value: 'materiel',       label: 'Matériel',        color: '#8b5cf6', badge: 'bg-purple-500/10 text-purple-400' },
  { value: 'transport',      label: 'Transport',       color: '#f59e0b', badge: 'bg-amber-500/10 text-amber-400' },
  { value: 'sous_traitance', label: 'Sous-traitance',  color: '#06b6d4', badge: 'bg-cyan-500/10 text-cyan-400' },
  { value: 'autre',          label: 'Autre',           color: '#6b7280', badge: 'bg-gray-500/10 text-gray-400' },
]
function getCat(v: string) { return CATS.find(c => c.value === v) ?? CATS[5] }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fcfa(v: number | null) { return (v ?? 0).toLocaleString('fr-FR') + ' FCFA' }
function fmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)} K`
  return String(v)
}
function todayStr() { return new Date().toISOString().split('T')[0] }

// Dernières 8 semaines pour le graphique
function getLast8Weeks() {
  const weeks = []
  const now = new Date()
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(d)
    monday.setDate(d.getDate() + diff); monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    weeks.push({
      label: monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
    })
  }
  return weeks
}

// ─── Custom Tooltip recharts ──────────────────────────────────────────────────

const PieTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a1a] border border-white/[0.08] rounded-xl px-3 py-2 shadow-xl">
      <p className="text-gray-400 text-[11px]">{payload[0].name}</p>
      <p className="text-white text-[13px] font-bold">{fcfa(payload[0].value)}</p>
    </div>
  )
}

const AreaTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a1a] border border-white/[0.08] rounded-xl px-3 py-2 shadow-xl">
      <p className="text-gray-500 text-[11px] mb-1">{label}</p>
      <p className="text-orange-400 text-[13px] font-bold">{fcfa(payload[0].value)}</p>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [chantierId, setChantierId] = useState('')
  const [chantier, setChantier] = useState<Chantier | null>(null)
  const [entrepriseId, setEntrepriseId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [depenses, setDepenses] = useState<Depense[]>([])
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  // Filtres
  const [filtreCat, setFiltreCat] = useState('tous')

  // Modal dépense
  const [showDepForm, setShowDepForm] = useState(false)
  const [depForm, setDepForm] = useState<DepForm>({ categorie: 'materiaux', description: '', fournisseur: '', montant: '', date_depense: todayStr() })
  const [savingDep, setSavingDep] = useState(false)
  const [depError, setDepError] = useState('')
  const [deleteDepId, setDeleteDepId] = useState<string | null>(null)
  const [deletingDep, setDeletingDep] = useState(false)

  // Modal stock
  const [showStockForm, setShowStockForm] = useState(false)
  const [editStockId, setEditStockId] = useState<string | null>(null)
  const [stockForm, setStockForm] = useState<StockForm>({ nom: '', unite: '', quantite_stock: '', quantite_min: '', prix_unitaire: '' })
  const [savingStock, setSavingStock] = useState(false)
  const [stockError, setStockError] = useState('')
  const [deleteStockId, setDeleteStockId] = useState<string | null>(null)
  const [deletingStock, setDeletingStock] = useState(false)

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchDepenses = useCallback(async (cid: string) => {
    const { data, error } = await supabase.from('depenses').select('*').eq('chantier_id', cid).order('date_depense', { ascending: false })
    if (error) setPageError(error.message)
    else setDepenses((data ?? []) as Depense[])
  }, [])

  const fetchStocks = useCallback(async (cid: string) => {
    const { data, error } = await supabase.from('materiaux_stock').select('*').eq('chantier_id', cid).order('nom')
    if (error) setPageError(error.message)
    else setStocks((data ?? []) as Stock[])
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('entreprise_id').eq('id', user.id).single()
      if (!profile?.entreprise_id) { setLoading(false); return }
      setEntrepriseId(profile.entreprise_id)
      const { data: c } = await supabase.from('chantiers').select('id, nom, ville, budget_prevu, avancement').eq('entreprise_id', profile.entreprise_id).order('nom')
      const list = (c ?? []) as Chantier[]
      setChantiers(list)
      if (list.length > 0) {
        setChantierId(list[0].id)
        setChantier(list[0])
        await Promise.all([fetchDepenses(list[0].id), fetchStocks(list[0].id)])
      }
      setLoading(false)
    }
    init()
  }, [fetchDepenses, fetchStocks])

  useEffect(() => {
    if (!chantierId) return
    const c = chantiers.find(x => x.id === chantierId) ?? null
    setChantier(c)
    fetchDepenses(chantierId)
    fetchStocks(chantierId)
  }, [chantierId, chantiers, fetchDepenses, fetchStocks])

  // ── Dépenses CRUD ────────────────────────────────────────────────────────

  async function saveDep(e: React.FormEvent) {
    e.preventDefault()
    if (!chantierId || !entrepriseId) return
    setSavingDep(true); setDepError('')
    const { error } = await supabase.from('depenses').insert({
      chantier_id: chantierId,
      entreprise_id: entrepriseId,
      categorie: depForm.categorie,
      description: depForm.description.trim(),
      fournisseur: depForm.fournisseur.trim() || null,
      montant: Number(depForm.montant) || 0,
      date_depense: depForm.date_depense,
      saisi_par: userId,
    })
    if (error) { setDepError(error.message); setSavingDep(false); return }
    setShowDepForm(false); setSavingDep(false)
    setDepForm({ categorie: 'materiaux', description: '', fournisseur: '', montant: '', date_depense: todayStr() })
    await fetchDepenses(chantierId)
  }

  async function deleteDep() {
    if (!deleteDepId || !chantierId) return
    setDeletingDep(true)
    await supabase.from('depenses').delete().eq('id', deleteDepId)
    setDeleteDepId(null); setDeletingDep(false); await fetchDepenses(chantierId)
  }

  // ── Stocks CRUD ──────────────────────────────────────────────────────────

  function openNewStock() {
    setEditStockId(null); setStockForm({ nom: '', unite: '', quantite_stock: '', quantite_min: '', prix_unitaire: '' })
    setStockError(''); setShowStockForm(true)
  }
  function openEditStock(s: Stock) {
    setEditStockId(s.id)
    setStockForm({ nom: s.nom, unite: s.unite, quantite_stock: String(s.quantite_stock ?? ''), quantite_min: String(s.quantite_min ?? ''), prix_unitaire: String(s.prix_unitaire ?? '') })
    setStockError(''); setShowStockForm(true)
  }

  async function saveStock(e: React.FormEvent) {
    e.preventDefault()
    if (!chantierId) return
    setSavingStock(true); setStockError('')
    const payload = {
      nom: stockForm.nom.trim(),
      unite: stockForm.unite.trim(),
      quantite_stock: Number(stockForm.quantite_stock) || 0,
      quantite_min: Number(stockForm.quantite_min) || 0,
      prix_unitaire: Number(stockForm.prix_unitaire) || 0,
    }
    let err
    if (editStockId) {
      const r = await supabase.from('materiaux_stock').update(payload).eq('id', editStockId)
      err = r.error
    } else {
      const r = await supabase.from('materiaux_stock').insert({ ...payload, chantier_id: chantierId })
      err = r.error
    }
    if (err) { setStockError(err.message); setSavingStock(false); return }
    setShowStockForm(false); setSavingStock(false); await fetchStocks(chantierId)
  }

  async function deleteStock() {
    if (!deleteStockId || !chantierId) return
    setDeletingStock(true)
    await supabase.from('materiaux_stock').delete().eq('id', deleteStockId)
    setDeleteStockId(null); setDeletingStock(false); await fetchStocks(chantierId)
  }

  // ── Calculs budget ───────────────────────────────────────────────────────

  const budgetPrevu = chantier?.budget_prevu ?? 0
  const totalDepense = depenses.reduce((a, d) => a + (d.montant ?? 0), 0)
  const restant = budgetPrevu - totalDepense
  const pctConsomme = budgetPrevu > 0 ? Math.min(100, Math.round(totalDepense / budgetPrevu * 100)) : 0
  const enDepassement = pctConsomme >= 80

  // ── Données graphique camembert ──────────────────────────────────────────

  const pieData = CATS.map(c => ({
    name: c.label,
    value: depenses.filter(d => d.categorie === c.value).reduce((a, d) => a + d.montant, 0),
    color: c.color,
  })).filter(d => d.value > 0)

  // ── Données graphique évolution ──────────────────────────────────────────

  const weeks = getLast8Weeks()
  const areaData = weeks.map(w => ({
    label: w.label,
    total: depenses.filter(d => d.date_depense >= w.start && d.date_depense <= w.end).reduce((a, d) => a + d.montant, 0),
  }))

  // ── Dépenses filtrées ────────────────────────────────────────────────────

  const depFiltrees = filtreCat === 'tous' ? depenses : depenses.filter(d => d.categorie === filtreCat)

  // ── Valeur totale stock ──────────────────────────────────────────────────

  const valeurStock = stocks.reduce((a, s) => a + (s.quantite_stock ?? 0) * (s.prix_unitaire ?? 0), 0)
  const enRupture = stocks.filter(s => (s.quantite_stock ?? 0) <= (s.quantite_min ?? 0)).length

  // ─── Spinner helper ──────────────────────────────────────────────────────
  const Spinner = () => (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-8">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Budget & Dépenses</h1>
          <p className="text-gray-500 text-sm mt-1">Suivi budgétaire et gestion des stocks par chantier</p>
        </div>
        <button onClick={() => { setDepError(''); setShowDepForm(true) }}
          disabled={!chantierId}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          Nouvelle dépense
        </button>
      </div>

      {/* Erreur */}
      {pageError && (
        <div className="mb-5 flex items-center gap-2 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>
          {pageError}
        </div>
      )}

      {/* Sélecteur chantier */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-4 mb-6">
        <div className="flex items-center gap-4">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest shrink-0">Chantier</label>
          {loading ? (
            <div className="h-9 w-64 bg-white/[0.04] rounded-xl animate-pulse" />
          ) : chantiers.length === 0 ? (
            <p className="text-amber-400 text-[13px]">Aucun chantier. <Link href="/dashboard/chantiers" className="underline">En créer un →</Link></p>
          ) : (
            <select value={chantierId} onChange={e => setChantierId(e.target.value)}
              className="bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2 text-[13px] font-medium focus:outline-none focus:border-orange-500 transition-all min-w-[280px]">
              {chantiers.map(c => <option key={c.id} value={c.id}>{c.nom}{c.ville ? ` — ${c.ville}` : ''}</option>)}
            </select>
          )}
          {chantier && <span className="text-gray-600 text-[12px]">Avancement : {chantier.avancement ?? 0}%</span>}
        </div>
      </div>

      {/* ── Stats budget ── */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {[
          { label: 'Budget prévu',     value: fmt(budgetPrevu),   full: fcfa(budgetPrevu),   color: 'text-white',       bg: 'bg-white/[0.05]',       icon: '📋' },
          { label: 'Total dépensé',    value: fmt(totalDepense),  full: fcfa(totalDepense),  color: 'text-orange-400',  bg: 'bg-orange-500/10',      icon: '💸' },
          { label: 'Reste disponible', value: fmt(Math.abs(restant)), full: fcfa(Math.abs(restant)), color: restant < 0 ? 'text-red-400' : 'text-emerald-400', bg: restant < 0 ? 'bg-red-500/10' : 'bg-emerald-500/10', icon: restant < 0 ? '⚠️' : '✅' },
        ].map(s => (
          <div key={s.label} className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center text-lg mb-3`}>{s.icon}</div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value} <span className="text-[13px] font-normal text-gray-600">FCFA</span></p>
            <p className="text-gray-500 text-[12px] mt-1">{s.label}</p>
            <p className="text-gray-700 text-[10px] mt-0.5">{s.full}</p>
          </div>
        ))}
      </div>

      {/* Barre progression budget */}
      <div className={`bg-[#232323] rounded-2xl border p-5 mb-6 ${enDepassement ? 'border-red-500/30' : 'border-white/[0.06]'}`}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-medium text-white">Consommation du budget</p>
          <div className="flex items-center gap-2">
            {enDepassement && (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 animate-pulse">
                {pctConsomme >= 100 ? '🚨 Dépassement' : '⚠️ Alerte > 80%'}
              </span>
            )}
            <span className={`text-[15px] font-bold ${pctConsomme >= 100 ? 'text-red-400' : enDepassement ? 'text-amber-400' : 'text-white'}`}>
              {pctConsomme}%
            </span>
          </div>
        </div>
        <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${pctConsomme >= 100 ? 'bg-red-500' : pctConsomme >= 80 ? 'bg-amber-500' : 'bg-orange-500'}`}
            style={{ width: `${Math.min(100, pctConsomme)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-gray-700">
          <span>0</span><span>25%</span><span>50%</span><span>75%</span>
          <span className={pctConsomme >= 80 ? 'text-amber-500 font-semibold' : ''}>80%</span>
          <span>100%</span>
        </div>
      </div>

      {/* ── Graphiques ── */}
      {mounted && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          {/* Camembert catégories */}
          <div className="col-span-2 bg-[#232323] rounded-2xl border border-white/[0.06] p-5">
            <h2 className="text-[14px] font-semibold text-white mb-4">Dépenses par catégorie</h2>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-[180px] text-gray-700 text-[12px]">Aucune dépense enregistrée</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-3">
                  {pieData.map(d => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
                        <span className="text-gray-400 text-[11px]">{d.name}</span>
                      </div>
                      <span className="text-gray-300 text-[11px] font-medium">{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Graphique évolution hebdomadaire */}
          <div className="col-span-3 bg-[#232323] rounded-2xl border border-white/[0.06] p-5">
            <h2 className="text-[14px] font-semibold text-white mb-4">Évolution des dépenses — 8 dernières semaines</h2>
            {areaData.every(w => w.total === 0) ? (
              <div className="flex items-center justify-center h-[220px] text-gray-700 text-[12px]">Aucune donnée sur cette période</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={areaData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => fmt(v)} tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip content={<AreaTooltip />} />
                  <Area type="monotone" dataKey="total" stroke="#f97316" strokeWidth={2} fill="url(#grad)" dot={{ fill: '#f97316', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#f97316' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── Section Dépenses ── */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-[15px] font-semibold text-white">
            Dépenses
            <span className="ml-2 text-gray-600 text-[13px] font-normal">({depenses.length})</span>
          </h2>
          {/* Filtres catégorie */}
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setFiltreCat('tous')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${filtreCat === 'tous' ? 'bg-orange-500/10 text-orange-400' : 'text-gray-600 hover:text-gray-300'}`}>
              Toutes
            </button>
            {CATS.map(c => (
              <button key={c.value} onClick={() => setFiltreCat(c.value)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${filtreCat === c.value ? 'bg-white/[0.08] text-white' : 'text-gray-600 hover:text-gray-300'}`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {depFiltrees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-gray-600 text-[13px]">Aucune dépense {filtreCat !== 'tous' ? `dans "${getCat(filtreCat).label}"` : ''}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {depFiltrees.map(d => {
              const cat = getCat(d.categorie)
              return (
                <div key={d.id} className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${cat.badge}`}>{cat.label}</span>
                    <div className="min-w-0">
                      <p className="text-white text-[13px] font-medium truncate">{d.description}</p>
                      {d.fournisseur && <p className="text-gray-600 text-[11px]">{d.fournisseur}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <p className="text-gray-500 text-[12px] hidden sm:block">
                      {new Date(d.date_depense).toLocaleDateString('fr-FR')}
                    </p>
                    <p className="text-white text-[14px] font-bold">{fcfa(d.montant)}</p>
                    <button onClick={() => setDeleteDepId(d.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
                        <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8L13 4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Total filtré */}
        {depFiltrees.length > 0 && (
          <div className="px-6 py-3 bg-[#1e1e1e] border-t border-white/[0.06] flex justify-between items-center">
            <span className="text-gray-600 text-[12px]">{depFiltrees.length} dépense{depFiltrees.length !== 1 ? 's' : ''}</span>
            <span className="text-orange-400 text-[14px] font-bold">
              {fcfa(depFiltrees.reduce((a, d) => a + d.montant, 0))}
            </span>
          </div>
        )}
      </div>

      {/* ── Section Stocks ── */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-white">
              Stocks matériaux
              {enRupture > 0 && (
                <span className="ml-2 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 animate-pulse">
                  {enRupture} rupture{enRupture > 1 ? 's' : ''}
                </span>
              )}
            </h2>
            {stocks.length > 0 && (
              <p className="text-gray-600 text-[11px] mt-0.5">Valeur totale : <span className="text-gray-400 font-medium">{fcfa(valeurStock)}</span></p>
            )}
          </div>
          <button onClick={openNewStock} disabled={!chantierId}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/[0.08] hover:border-orange-500/40 hover:bg-orange-500/[0.06] text-gray-400 hover:text-orange-400 text-[12px] font-medium transition-colors disabled:opacity-40">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M8 3v10M3 8h10" strokeLinecap="round"/></svg>
            Ajouter matériau
          </button>
        </div>

        {stocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-gray-600 text-[13px]">Aucun matériau enregistré pour ce chantier</p>
          </div>
        ) : (
          <>
            <div className="grid px-6 py-2.5 bg-[#1e1e1e] border-b border-white/[0.04]"
              style={{ gridTemplateColumns: '2fr 80px 100px 100px 120px 80px 28px' }}>
              {['Matériau', 'Unité', 'En stock', 'Seuil min', 'Prix unit.', 'Valeur', ''].map(h => (
                <span key={h} className="text-gray-600 text-[10px] font-semibold uppercase tracking-wider last:text-right">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-white/[0.04]">
              {stocks.map(s => {
                const rupture = (s.quantite_stock ?? 0) <= (s.quantite_min ?? 0)
                const valeur = (s.quantite_stock ?? 0) * (s.prix_unitaire ?? 0)
                return (
                  <div key={s.id}
                    className={`grid items-center px-6 py-3.5 hover:bg-white/[0.02] transition-colors group ${rupture ? 'border-l-2 border-red-500/50' : ''}`}
                    style={{ gridTemplateColumns: '2fr 80px 100px 100px 120px 80px 28px' }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white text-[13px] font-medium">{s.nom}</p>
                        {rupture && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">Rupture</span>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-500 text-[12px]">{s.unite}</p>
                    <p className={`text-[13px] font-semibold ${rupture ? 'text-red-400' : 'text-white'}`}>
                      {(s.quantite_stock ?? 0).toLocaleString('fr-FR')}
                    </p>
                    <p className="text-gray-600 text-[12px]">{(s.quantite_min ?? 0).toLocaleString('fr-FR')}</p>
                    <p className="text-gray-400 text-[12px]">{s.prix_unitaire ? fcfa(s.prix_unitaire) : '—'}</p>
                    <p className="text-gray-300 text-[12px] font-medium">{valeur > 0 ? fmt(valeur) : '—'}</p>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEditStock(s)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-white/[0.04] hover:bg-white/[0.08] text-gray-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3 h-3"><path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ══════════════ Modals ══════════════ */}

      {/* Modal nouvelle dépense */}
      {showDepForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowDepForm(false) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
              <h2 className="text-[15px] font-semibold text-white">Nouvelle dépense</h2>
              <button onClick={() => setShowDepForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M2 2l12 12M14 2L2 14" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={saveDep} className="px-6 py-5 space-y-4">
              {depError && <div className="text-red-400 text-[13px] bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3">{depError}</div>}

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Catégorie</label>
                <select value={depForm.categorie} onChange={e => setDepForm(f => ({ ...f, categorie: e.target.value }))}
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all">
                  {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Description <span className="text-orange-400">*</span></label>
                <input type="text" required value={depForm.description} onChange={e => setDepForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Ex: Achat ciment 50 sacs"
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all" />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Fournisseur</label>
                <input type="text" value={depForm.fournisseur} onChange={e => setDepForm(f => ({ ...f, fournisseur: e.target.value }))}
                  placeholder="Ex: SOCA Bâtiment"
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Montant (FCFA) <span className="text-orange-400">*</span></label>
                  <input type="number" required min="0" value={depForm.montant} onChange={e => setDepForm(f => ({ ...f, montant: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Date</label>
                  <input type="date" value={depForm.date_depense} onChange={e => setDepForm(f => ({ ...f, date_depense: e.target.value }))}
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowDepForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white text-[13px] font-medium transition-colors">Annuler</button>
                <button type="submit" disabled={savingDep}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                  {savingDep ? <><Spinner/>Enregistrement…</> : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression dépense */}
      {deleteDepId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setDeleteDepId(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <h3 className="text-white text-[15px] font-semibold text-center mb-2">Supprimer cette dépense ?</h3>
            <p className="text-gray-500 text-[13px] text-center mb-5">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteDepId(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] font-medium">Annuler</button>
              <button onClick={deleteDep} disabled={deletingDep}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {deletingDep ? <><Spinner/>Suppression…</> : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal stock */}
      {showStockForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowStockForm(false) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
              <h2 className="text-[15px] font-semibold text-white">{editStockId ? 'Modifier le matériau' : 'Ajouter un matériau'}</h2>
              <button onClick={() => setShowStockForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M2 2l12 12M14 2L2 14" strokeLinecap="round"/></svg>
              </button>
            </div>
            <form onSubmit={saveStock} className="px-6 py-5 space-y-4">
              {stockError && <div className="text-red-400 text-[13px] bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3">{stockError}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Nom <span className="text-orange-400">*</span></label>
                  <input type="text" required value={stockForm.nom} onChange={e => setStockForm(f => ({ ...f, nom: e.target.value }))}
                    placeholder="Ex: Ciment"
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Unité <span className="text-orange-400">*</span></label>
                  <input type="text" required value={stockForm.unite} onChange={e => setStockForm(f => ({ ...f, unite: e.target.value }))}
                    placeholder="sac, tonne, m³…"
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { k: 'quantite_stock' as const, label: 'Qté en stock' },
                  { k: 'quantite_min' as const, label: 'Seuil alerte' },
                  { k: 'prix_unitaire' as const, label: 'Prix unit. FCFA' },
                ].map(({ k, label }) => (
                  <div key={k}>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">{label}</label>
                    <input type="number" min="0" value={stockForm[k]} onChange={e => setStockForm(f => ({ ...f, [k]: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all" />
                  </div>
                ))}
              </div>

              {/* Aperçu valeur */}
              {stockForm.quantite_stock && stockForm.prix_unitaire && (
                <div className="bg-orange-500/[0.07] border border-orange-500/20 rounded-xl px-4 py-2.5 flex justify-between">
                  <span className="text-gray-400 text-[12px]">Valeur du stock</span>
                  <span className="text-orange-400 text-[13px] font-bold">
                    {fcfa((Number(stockForm.quantite_stock) || 0) * (Number(stockForm.prix_unitaire) || 0))}
                  </span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowStockForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white text-[13px] font-medium transition-colors">Annuler</button>
                <button type="submit" disabled={savingStock}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                  {savingStock ? <><Spinner/>Enregistrement…</> : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal suppression stock */}
      {deleteStockId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setDeleteStockId(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <h3 className="text-white text-[15px] font-semibold text-center mb-2">Supprimer ce matériau ?</h3>
            <p className="text-gray-500 text-[13px] text-center mb-5">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteStockId(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] font-medium">Annuler</button>
              <button onClick={deleteStock} disabled={deletingStock}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {deletingStock ? <><Spinner/>Suppression…</> : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
