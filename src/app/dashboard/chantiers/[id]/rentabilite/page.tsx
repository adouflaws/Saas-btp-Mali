'use client'

import { use, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

/* ─── Types ─────────────────────────────────────────── */

type ChantierInfo = {
  id: string; nom: string; client_nom: string
  budget_prevu: number | null; ville: string | null
}

type RentaData = {
  chantier: ChantierInfo
  totalFacture: number
  totalEncaisse: number
  depMateriaux: number
  depMO: number
  depCarburant: number
  depAutres: number
  totalDepenses: number
}

/* ─── Helpers ─────────────────────────────────────────── */

function fcfa(v: number) { return v.toLocaleString('fr-FR') + ' FCFA' }

function pct(val: number, total: number) {
  if (total <= 0) return 0
  return Math.min(Math.round((val / total) * 100), 100)
}

function getMargeConfig(p: number) {
  if (p > 25)  return { color: 'text-emerald-400', bg: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-500/30', bar: 'bg-emerald-500', label: '🟢 Excellent',  msg: '🏆 Excellent chantier ! Continuez sur cette lancée.' }
  if (p >= 15) return { color: 'text-emerald-400', bg: 'from-emerald-500/15 to-emerald-500/5', border: 'border-emerald-500/20', bar: 'bg-emerald-400', label: '🟡 Correct',    msg: '✅ Bonne rentabilité.' }
  if (p >= 5)  return { color: 'text-amber-400',   bg: 'from-amber-500/15 to-amber-500/5',     border: 'border-amber-500/25',   bar: 'bg-amber-500',   label: '🟠 Faible',     msg: '⚠️ Marge faible. Vérifiez vos dépenses.' }
  return             { color: 'text-red-400',     bg: 'from-red-500/15 to-red-500/5',         border: 'border-red-500/25',     bar: 'bg-red-500',     label: '🔴 Attention',  msg: '🚨 Ce chantier est peu rentable. Analysez vos coûts.' }
}

/* ─── Composant barre de progression ───────────────────── */

function BarPoste({ label, icon, reel, total, budgetTotal }: {
  label: string; icon: string; reel: number; total: number; budgetTotal: number
}) {
  const ratio     = pct(reel, total)
  const overBudget = budgetTotal > 0 && reel > budgetTotal * 0.4
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] text-gray-400 flex items-center gap-1.5">
          <span>{icon}</span>{label}
        </span>
        <span className={`text-[12px] font-semibold ${overBudget ? 'text-red-400' : 'text-white'}`}>
          {fcfa(reel)}
          {total > 0 && <span className="text-gray-600 font-normal text-[10px] ml-1">({ratio}%)</span>}
        </span>
      </div>
      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${overBudget ? 'bg-red-500' : 'bg-orange-500'}`}
          style={{ width: `${ratio}%` }}
        />
      </div>
    </div>
  )
}

/* ─── Page ──────────────────────────────────────────────── */

export default function RentabilitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: chantierId } = use(params)
  const [data, setData]     = useState<RentaData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const [
      { data: c },
      { data: factures },
      { data: depenses },
      { data: pointages },
      { data: pleins },
    ] = await Promise.all([
      supabase.from('chantiers').select('id, nom, client_nom, budget_prevu, ville').eq('id', chantierId).single(),
      supabase.from('factures').select('montant_ttc, montant_paye').eq('chantier_id', chantierId),
      supabase.from('depenses').select('montant, categorie').eq('chantier_id', chantierId),
      supabase.from('pointages').select('montant_jour').eq('chantier_id', chantierId),
      supabase.from('pleins_carburant').select('montant').eq('chantier_id', chantierId),
    ])
    if (!c) return

    const totalFacture  = (factures ?? []).reduce((a, f) => a + (f.montant_ttc ?? 0), 0)
    const totalEncaisse = (factures ?? []).reduce((a, f) => a + (f.montant_paye ?? 0), 0)
    const totalPts      = (pointages ?? []).reduce((a, p) => a + (p.montant_jour ?? 0), 0)
    const depMat        = (depenses ?? []).filter(d => d.categorie === 'materiaux').reduce((a, d) => a + (d.montant ?? 0), 0)
    const depMO_dep     = (depenses ?? []).filter(d => d.categorie === 'main_oeuvre').reduce((a, d) => a + (d.montant ?? 0), 0)
    const depCar        = (pleins ?? []).reduce((a, p) => a + (p.montant ?? 0), 0)
    const depAut        = (depenses ?? []).filter(d => !['materiaux','main_oeuvre'].includes(d.categorie)).reduce((a, d) => a + (d.montant ?? 0), 0)
    const depMO         = depMO_dep + totalPts

    setData({
      chantier: c,
      totalFacture, totalEncaisse,
      depMateriaux: depMat, depMO, depCarburant: depCar, depAutres: depAut,
      totalDepenses: depMat + depMO + depCar + depAut,
    })
  }, [chantierId])

  useEffect(() => {
    setLoading(true); fetchData().finally(() => setLoading(false))
  }, [fetchData])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
    </div>
  )

  if (!data) return <div className="p-8"><p className="text-red-400">Chantier introuvable</p></div>

  const { chantier, totalFacture, totalEncaisse, depMateriaux, depMO, depCarburant, depAutres, totalDepenses } = data
  const resteAEncaisser = Math.max(0, totalFacture - totalEncaisse)
  const margeBrute      = totalFacture - totalDepenses
  const margePct        = totalFacture > 0 ? Math.round((margeBrute / totalFacture) * 100) : 0
  const budgetPrevu     = chantier.budget_prevu ?? 0
  const budgetRatio     = budgetPrevu > 0 ? pct(totalDepenses, budgetPrevu) : 0
  const mc              = getMargeConfig(margePct)
  const noData          = totalFacture === 0 && totalDepenses === 0

  return (
    <div className="p-8 max-w-4xl">

      {/* ── Header ── */}
      <div className="mb-6">
        <Link href={`/dashboard/chantiers/${chantierId}`}
          className="flex items-center gap-1.5 text-gray-600 hover:text-gray-400 text-[12px] mb-4 transition-colors w-fit">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
            <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {chantier.nom}
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              📊 Rentabilité
            </h1>
            <p className="text-gray-500 text-[13px] mt-1">
              {chantier.nom}{chantier.ville && ` · ${chantier.ville}`} · {chantier.client_nom}
            </p>
          </div>
          <span className={`text-[13px] font-bold px-3 py-1.5 rounded-xl border ${mc.border} ${mc.color} bg-white/[0.03]`}>
            {mc.label}
          </span>
        </div>
      </div>

      {noData && (
        <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-8 text-center mb-6">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-white font-semibold text-[15px] mb-1">Aucune donnée financière</p>
          <p className="text-gray-500 text-[13px]">Ajoutez des factures et des dépenses pour voir la rentabilité.</p>
        </div>
      )}

      {/* ════ SECTION 1 — Résumé financier ════ */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 mb-5">
        <h2 className="text-white text-[14px] font-semibold mb-4 flex items-center gap-2">
          <span className="text-orange-400">💼</span> Résumé financier
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Total facturé',     value: totalFacture,    color: 'text-white',       sub: 'au client' },
            { label: 'Montant encaissé',  value: totalEncaisse,   color: 'text-emerald-400', sub: 'paiements reçus' },
            { label: 'Reste à encaisser', value: resteAEncaisser, color: resteAEncaisser > 0 ? 'text-amber-400' : 'text-gray-500', sub: 'en attente' },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.03] rounded-xl p-4">
              <p className="text-gray-600 text-[11px] uppercase tracking-widest mb-1.5">{s.label}</p>
              <p className={`text-[18px] font-bold ${s.color}`}>{fcfa(s.value)}</p>
              <p className="text-gray-700 text-[11px] mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.05] pt-4">
          <p className="text-[11px] uppercase tracking-widest text-gray-600 mb-3">Dépenses réelles</p>
          <div className="space-y-2">
            {[
              { label: 'Matériaux & fournitures', value: depMateriaux,  color: 'text-orange-400' },
              { label: "Main d'œuvre",            value: depMO,         color: 'text-blue-400'   },
              { label: 'Carburant',               value: depCarburant,  color: 'text-amber-400'  },
              { label: 'Autres dépenses',         value: depAutres,     color: 'text-gray-400'   },
            ].map(d => (
              <div key={d.label} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <span className="text-gray-500 text-[13px]">{d.label}</span>
                <span className={`text-[13px] font-semibold ${d.color}`}>{fcfa(d.value)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <span className="text-gray-300 text-[13px] font-bold uppercase tracking-wide">TOTAL DÉPENSES</span>
              <span className="text-white text-[15px] font-bold">{fcfa(totalDepenses)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ════ SECTION 3 — Ce qui va dans votre poche (mis en avant) ════ */}
      <div className={`bg-gradient-to-br ${mc.bg} border ${mc.border} rounded-2xl p-6 mb-5`}>
        <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-2">💰 Bénéfice net estimé</p>
        <p className={`text-[2.5rem] font-black leading-none tracking-tight mb-1 ${mc.color}`}>
          {fcfa(margeBrute)}
        </p>
        {totalFacture > 0 && (
          <p className="text-gray-400 text-[14px] font-medium mb-4">
            Soit <span className={`font-bold ${mc.color}`}>{margePct}%</span> de marge sur ce chantier
          </p>
        )}
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06]`}>
          <span className="text-[14px]">{mc.msg.split(' ')[0]}</span>
          <p className="text-[13px] text-white font-medium">{mc.msg.split(' ').slice(1).join(' ')}</p>
        </div>

        {/* Barre de marge */}
        {totalFacture > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-gray-600">Marge</span>
              <span className={`font-bold ${mc.color}`}>{margePct}%</span>
            </div>
            <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${mc.bar}`} style={{ width: `${Math.max(0, Math.min(margePct, 100))}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-700 mt-1">
              <span>0%</span>
              <span className="text-amber-600">15%</span>
              <span className="text-emerald-600">25%+</span>
            </div>
          </div>
        )}
      </div>

      {/* ════ SECTION 2 — Budget prévu vs réel ════ */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 mb-5">
        <h2 className="text-white text-[14px] font-semibold mb-4 flex items-center gap-2">
          <span className="text-blue-400">📊</span> Budget prévu vs réel
        </h2>

        {budgetPrevu > 0 ? (
          <>
            {/* Barre globale */}
            <div className="mb-5 p-4 bg-white/[0.03] rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] text-gray-400">Budget consommé</span>
                <div className="text-right">
                  <span className={`text-[13px] font-bold ${budgetRatio > 100 ? 'text-red-400' : 'text-white'}`}>{fcfa(totalDepenses)}</span>
                  <span className="text-gray-600 text-[11px] ml-1">/ {fcfa(budgetPrevu)}</span>
                </div>
              </div>
              <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${budgetRatio > 100 ? 'bg-red-500' : budgetRatio > 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(budgetRatio, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[11px] text-gray-600">{budgetRatio}% du budget utilisé</span>
                {budgetRatio > 100 && (
                  <span className="text-[11px] text-red-400 font-semibold">⚠️ Dépassement de {fcfa(totalDepenses - budgetPrevu)}</span>
                )}
              </div>
            </div>

            {/* Répartition par poste */}
            <p className="text-[11px] uppercase tracking-widest text-gray-600 mb-3">Répartition des dépenses</p>
            <div className="space-y-4">
              <BarPoste label="Matériaux & fournitures" icon="🧱" reel={depMateriaux} total={totalDepenses} budgetTotal={budgetPrevu} />
              <BarPoste label="Main d'œuvre" icon="👷" reel={depMO} total={totalDepenses} budgetTotal={budgetPrevu} />
              <BarPoste label="Carburant" icon="⛽" reel={depCarburant} total={totalDepenses} budgetTotal={budgetPrevu} />
              <BarPoste label="Autres" icon="📦" reel={depAutres} total={totalDepenses} budgetTotal={budgetPrevu} />
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500 text-[13px] mb-3">Aucun budget prévu défini pour ce chantier.</p>
            <Link href="/dashboard/chantiers"
              className="text-[12px] text-orange-400 hover:text-orange-300 transition-colors">
              Modifier le chantier pour ajouter un budget →
            </Link>
          </div>
        )}
      </div>

      {/* ════ SECTION 5 — Conseils personnalisés ════ */}
      {margePct < 15 && totalFacture > 0 && (
        <div className="bg-[#232323] rounded-2xl border border-amber-500/20 p-5 mb-5">
          <h2 className="text-amber-400 text-[14px] font-semibold mb-4 flex items-center gap-2">
            <span>💡</span> Conseils pour améliorer votre marge
          </h2>
          <div className="space-y-2.5">
            {[
              { icon: '🏪', text: 'Négociez vos prix matériaux avec vos fournisseurs — même 5% d\'économie change tout' },
              { icon: '👷', text: 'Optimisez le nombre de journaliers sur le chantier selon l\'avancement réel' },
              { icon: '📦', text: 'Vérifiez les pertes et gaspillages de matériaux sur site' },
              { icon: '💰', text: 'Réévaluez votre tarif client sur les prochains chantiers similaires' },
              ...(depCarburant > totalDepenses * 0.15 ? [{ icon: '⛽', text: 'Carburant élevé : planifiez mieux les trajets pour réduire les coûts' }] : []),
              ...(depMO > totalDepenses * 0.5 ? [{ icon: '🔧', text: 'Main d\'œuvre dominante : envisagez des ouvriers plus qualifiés (moins de jours, même résultat)' }] : []),
            ].map((c, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0">
                <span className="text-[16px] shrink-0 mt-0.5">{c.icon}</span>
                <p className="text-[13px] text-gray-300 leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liens de navigation */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Link href={`/dashboard/chantiers/${chantierId}`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] text-gray-400 text-[12px] font-medium transition-colors border border-white/[0.06]">
          ← Vue générale
        </Link>
        <Link href="/dashboard/budget"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-orange-500/10 text-gray-400 hover:text-orange-400 text-[12px] font-medium transition-colors border border-white/[0.06]">
          📊 Gérer les dépenses →
        </Link>
        <Link href="/dashboard/factures"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-orange-500/10 text-gray-400 hover:text-orange-400 text-[12px] font-medium transition-colors border border-white/[0.06]">
          🧾 Gérer les factures →
        </Link>
      </div>
    </div>
  )
}
