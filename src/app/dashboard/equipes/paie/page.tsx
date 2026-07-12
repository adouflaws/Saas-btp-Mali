'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type LignePaie = {
  ouvrier_id: string; nom: string; prenom: string | null; metier: string | null
  type_contrat: string | null; taux_journalier: number | null
  jours_travailles: number; total_brut: number; avances: number; net_a_payer: number
}

type ChantierPaie = {
  chantier_id: string; nom: string; total_net: number; valide: boolean
}

const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function formatFCFA(v: number) { return v.toLocaleString('fr-FR') + ' FCFA' }

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${week}`
}

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

export default function PaiePage() {
  const now = new Date()
  const entrepriseIdRef = useRef<string | null>(null)
  const [mois, setMois] = useState(now.getMonth() + 1)
  const [annee, setAnnee] = useState(now.getFullYear())
  const [lignes, setLignes] = useState<LignePaie[]>([])
  const [chantierPaies, setChantierPaies] = useState<ChantierPaie[]>([])
  const [validatingChantier, setValidatingChantier] = useState<string | null>(null)
  const [entrepriseNom, setEntrepriseNom] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [toast, setToast] = useState('')
  const userIdRef = useRef<string | null>(null)

  const chargerPaie = useCallback(async () => {
    const eid = entrepriseIdRef.current
    if (!eid) return
    setLoading(true); setPageError('')
    const debut = `${annee}-${String(mois).padStart(2, '0')}-01`
    const finDate = new Date(annee, mois, 0)
    const fin = `${annee}-${String(mois).padStart(2, '0')}-${String(finDate.getDate()).padStart(2, '0')}`

    const [{ data: ouvriers, error: oErr }, { data: chantiers, error: cErr }] = await Promise.all([
      supabase.from('ouvriers').select('id, nom, prenom, metier, type_contrat, taux_journalier').eq('entreprise_id', eid).order('nom'),
      supabase.from('chantiers').select('id, nom').eq('entreprise_id', eid).order('nom'),
    ])
    if (oErr) { setPageError(oErr.message); setLoading(false); return }
    if (cErr) { setPageError(cErr.message); setLoading(false); return }

    const ouvrierIds = (ouvriers ?? []).map(o => o.id)
    const [ptRes, avRes, depRes] = await Promise.all([
      ouvrierIds.length > 0
        ? supabase.from('pointages').select('ouvrier_id, chantier_id, montant_jour, date_pointage').in('ouvrier_id', ouvrierIds).gte('date_pointage', debut).lte('date_pointage', fin).eq('present', true)
        : { data: [], error: null },
      ouvrierIds.length > 0
        ? supabase.from('avances_salaire').select('ouvrier_id, chantier_id, montant').in('ouvrier_id', ouvrierIds).gte('date_avance', debut).lte('date_avance', fin).eq('rembourse', false)
        : { data: [], error: null },
      supabase.from('depenses').select('chantier_id').eq('entreprise_id', eid).eq('source', 'auto_paie').eq('date_depense', fin),
    ])
    if (ptRes.error) { setPageError(ptRes.error.message); setLoading(false); return }
    if (avRes.error) { setPageError(avRes.error.message); setLoading(false); return }

    // ── Récapitulatif global par ouvrier (tous chantiers confondus) — pour la feuille de paie ──
    const ptMap: Record<string, { jours: number; total: number; weeks: Set<string> }> = {}
    ;(ptRes.data ?? []).forEach(p => {
      if (!ptMap[p.ouvrier_id]) ptMap[p.ouvrier_id] = { jours: 0, total: 0, weeks: new Set() }
      ptMap[p.ouvrier_id].jours++
      ptMap[p.ouvrier_id].total += p.montant_jour ?? 0
      if (p.date_pointage) ptMap[p.ouvrier_id].weeks.add(getWeekKey(p.date_pointage as string))
    })

    const avMap: Record<string, number> = {}
    ;(avRes.data ?? []).forEach(a => { avMap[a.ouvrier_id] = (avMap[a.ouvrier_id] ?? 0) + a.montant })

    const result: LignePaie[] = (ouvriers ?? []).map(o => {
      const isHebdo = o.type_contrat === 'hebdomadaire'
      const jours = ptMap[o.id]?.jours ?? 0
      const semaines = ptMap[o.id]?.weeks.size ?? 0
      const brut = isHebdo
        ? semaines * (o.taux_journalier ?? 0)
        : (ptMap[o.id]?.total ?? 0)
      const avances = avMap[o.id] ?? 0
      return {
        ouvrier_id: o.id, nom: o.nom, prenom: o.prenom, metier: o.metier,
        type_contrat: o.type_contrat, taux_journalier: o.taux_journalier,
        jours_travailles: isHebdo ? semaines : jours,
        total_brut: brut, avances, net_a_payer: Math.max(0, brut - avances),
      }
    })
    setLignes(result)

    // ── Répartition par chantier — pour la consolidation automatique des dépenses ──
    const contratParOuvrier: Record<string, { hebdo: boolean; taux: number }> = {}
    ;(ouvriers ?? []).forEach(o => { contratParOuvrier[o.id] = { hebdo: o.type_contrat === 'hebdomadaire', taux: o.taux_journalier ?? 0 } })

    const brutParPaire: Record<string, { total: number; weeks: Set<string> }> = {}
    ;(ptRes.data ?? []).forEach(p => {
      if (!p.chantier_id) return
      const k = `${p.ouvrier_id}__${p.chantier_id}`
      if (!brutParPaire[k]) brutParPaire[k] = { total: 0, weeks: new Set() }
      brutParPaire[k].total += p.montant_jour ?? 0
      if (p.date_pointage) brutParPaire[k].weeks.add(getWeekKey(p.date_pointage as string))
    })
    const avancesParPaire: Record<string, number> = {}
    ;(avRes.data ?? []).forEach(a => {
      if (!a.chantier_id) return
      const k = `${a.ouvrier_id}__${a.chantier_id}`
      avancesParPaire[k] = (avancesParPaire[k] ?? 0) + a.montant
    })

    const totalParChantier: Record<string, number> = {}
    Object.keys(brutParPaire).forEach(k => {
      const [ouvrierId, chantierId] = k.split('__')
      const contrat = contratParOuvrier[ouvrierId]
      const brut = contrat?.hebdo ? brutParPaire[k].weeks.size * contrat.taux : brutParPaire[k].total
      const net = Math.max(0, brut - (avancesParPaire[k] ?? 0))
      totalParChantier[chantierId] = (totalParChantier[chantierId] ?? 0) + net
    })

    const chantierIdsDejaValides = new Set((depRes.data ?? []).map(d => d.chantier_id))
    const repartition: ChantierPaie[] = (chantiers ?? [])
      .filter(c => (totalParChantier[c.id] ?? 0) > 0)
      .map(c => ({ chantier_id: c.id, nom: c.nom, total_net: totalParChantier[c.id], valide: chantierIdsDejaValides.has(c.id) }))
    setChantierPaies(repartition)

    setLoading(false)
  }, [mois, annee])

  async function handleValiderPaie(cp: ChantierPaie) {
    const eid = entrepriseIdRef.current
    if (!eid || cp.valide) return
    setValidatingChantier(cp.chantier_id)
    const finDate = new Date(annee, mois, 0)
    const fin = `${annee}-${String(mois).padStart(2, '0')}-${String(finDate.getDate()).padStart(2, '0')}`

    const { data: existante } = await supabase.from('depenses')
      .select('id').eq('source', 'auto_paie').eq('chantier_id', cp.chantier_id).eq('date_depense', fin).maybeSingle()
    if (existante) {
      setChantierPaies(prev => prev.map(c => c.chantier_id === cp.chantier_id ? { ...c, valide: true } : c))
      setValidatingChantier(null)
      return
    }

    const { error } = await supabase.from('depenses').insert({
      entreprise_id: eid,
      chantier_id: cp.chantier_id,
      categorie: 'main_oeuvre',
      description: `Paie ouvriers — ${MOIS_LABELS[mois - 1]} ${annee}`,
      montant: cp.total_net,
      date_depense: fin,
      source: 'auto_paie',
      source_id: null,
      saisi_par: userIdRef.current,
    })
    if (error) { setPageError(error.message); setValidatingChantier(null); return }

    setChantierPaies(prev => prev.map(c => c.chantier_id === cp.chantier_id ? { ...c, valide: true } : c))
    setToast(`Paie validée pour ${cp.nom}`)
    setTimeout(() => setToast(''), 3500)
    setValidatingChantier(null)
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userIdRef.current = user.id
      const { data: profile } = await supabase.from('profiles').select('entreprise_id').eq('id', user.id).single()
      if (profile?.entreprise_id) {
        entrepriseIdRef.current = profile.entreprise_id
        const { data: ent } = await supabase.from('entreprises').select('nom').eq('id', profile.entreprise_id).single()
        if (ent) setEntrepriseNom(ent.nom)
      }
      await chargerPaie()
    }
    init()
  }, [chargerPaie])

  const hasAvancesAlert = lignes.some(l => l.avances > 0 && l.avances >= l.total_brut * 0.5)

  function exportPDF() {
    const totalBrut = lignes.reduce((s, l) => s + l.total_brut, 0)
    const totalAvances = lignes.reduce((s, l) => s + l.avances, 0)
    const totalNet = lignes.reduce((s, l) => s + l.net_a_payer, 0)
    const totalJours = lignes.reduce((s, l) => s + l.jours_travailles, 0)
    const periode = `${MOIS_LABELS[mois - 1]} ${annee}`

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Feuille de paie — ${periode}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; color:#1a1a1a; background:#fff; padding:40px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:20px; border-bottom:2px solid #f97316; }
    .logo { font-size:22px; font-weight:800; color:#f97316; }
    .logo span { color:#1a1a1a; }
    .header-right { text-align:right; }
    .periode { font-size:18px; font-weight:700; color:#1a1a1a; }
    .sous-titre { font-size:12px; color:#666; margin-top:2px; }
    .entreprise { font-size:13px; font-weight:600; color:#444; margin-top:4px; }
    .badges { display:flex; gap:16px; margin-bottom:28px; flex-wrap:wrap; }
    .badge { background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; padding:12px 20px; }
    .badge-val { font-size:18px; font-weight:800; color:#f97316; }
    .badge-label { font-size:11px; color:#666; margin-top:2px; }
    table { width:100%; border-collapse:collapse; margin-bottom:24px; }
    th { background:#f97316; color:white; padding:10px 12px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
    th:nth-child(n+5) { text-align:right; }
    td { padding:10px 12px; font-size:12px; border-bottom:1px solid #f0f0f0; }
    td:nth-child(n+5) { text-align:right; }
    tr:nth-child(even) td { background:#fafafa; }
    .zero { color:#bbb; }
    .alert-row td { background:#fff7ed !important; }
    .total-row td { border-top:2px solid #f97316; font-weight:700; font-size:13px; background:#fff7ed !important; padding:12px; }
    .net { font-weight:700; color:#16a34a; }
    .avance-val { color:#dc2626; }
    .sig { display:grid; grid-template-columns:1fr 1fr 1fr; gap:32px; margin-top:40px; }
    .sig-box { border-top:1px solid #ccc; padding-top:8px; font-size:11px; color:#666; }
    .footer { margin-top:32px; padding-top:16px; border-top:1px solid #eee; display:flex; justify-content:space-between; color:#999; font-size:11px; }
    @media print { body { padding:24px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">BTP<span>Mali</span></div>
      <div class="entreprise">${entrepriseNom}</div>
    </div>
    <div class="header-right">
      <div class="periode">Feuille de Paie — ${periode}</div>
      <div class="sous-titre">Récapitulatif mensuel des salaires</div>
      <div class="sous-titre">Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
  </div>
  <div class="badges">
    <div class="badge"><div class="badge-val">${lignes.filter(l => l.jours_travailles > 0).length}</div><div class="badge-label">Ouvriers payés</div></div>
    <div class="badge"><div class="badge-val">${totalJours}</div><div class="badge-label">Jours travaillés</div></div>
    <div class="badge"><div class="badge-val">${formatFCFA(totalBrut)}</div><div class="badge-label">Salaire brut</div></div>
    <div class="badge"><div class="badge-val">${formatFCFA(totalAvances)}</div><div class="badge-label">Avances déduites</div></div>
    <div class="badge" style="background:#f0fdf4;border-color:#86efac"><div class="badge-val" style="color:#16a34a">${formatFCFA(totalNet)}</div><div class="badge-label">NET À PAYER</div></div>
  </div>
  <table>
    <thead><tr>
      <th>#</th><th>Nom & Prénom</th><th>Métier</th><th>Jours</th>
      <th>Brut FCFA</th><th>Avances</th><th>NET À PAYER</th>
    </tr></thead>
    <tbody>
      ${lignes.map((l, i) => `
      <tr class="${l.jours_travailles === 0 ? 'zero' : ''} ${l.avances > 0 && l.avances >= l.total_brut * 0.5 ? 'alert-row' : ''}">
        <td>${i + 1}</td>
        <td><strong>${l.prenom ? l.prenom + ' ' : ''}${l.nom}</strong></td>
        <td>${l.metier ?? '—'}</td>
        <td>${l.jours_travailles}</td>
        <td>${l.total_brut > 0 ? formatFCFA(l.total_brut) : '—'}</td>
        <td class="${l.avances > 0 ? 'avance-val' : ''}">${l.avances > 0 ? formatFCFA(l.avances) : '—'}</td>
        <td class="net">${l.net_a_payer > 0 ? formatFCFA(l.net_a_payer) : '—'}</td>
      </tr>`).join('')}
      <tr class="total-row">
        <td colspan="4">TOTAL</td>
        <td>${formatFCFA(totalBrut)}</td>
        <td class="avance-val">${totalAvances > 0 ? formatFCFA(totalAvances) : '—'}</td>
        <td class="net">${formatFCFA(totalNet)}</td>
      </tr>
    </tbody>
  </table>
  <div class="sig">
    <div class="sig-box">Établi par<br/><br/><br/>Nom & Signature</div>
    <div class="sig-box">Responsable chantier<br/><br/><br/>Nom & Signature</div>
    <div class="sig-box">Date d'émission<br/><br/>${new Date().toLocaleDateString('fr-FR')}</div>
  </div>
  <div class="footer">
    <span>BTP Mali — Gestion de chantiers</span>
    <span>Document généré automatiquement — ${periode}</span>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`

    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close() }
  }

  const totalBrut = lignes.reduce((s, l) => s + l.total_brut, 0)
  const totalAvances = lignes.reduce((s, l) => s + l.avances, 0)
  const totalNet = lignes.reduce((s, l) => s + l.net_a_payer, 0)
  const totalJours = lignes.reduce((s, l) => s + l.jours_travailles, 0)
  const payesCount = lignes.filter(l => l.jours_travailles > 0).length
  const annees = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i)

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-[-0.02em]">Paie de salaires</h1>
          <p className="text-gray-500 text-[13px] mt-1">Récapitulatif mensuel calculé depuis les pointages</p>
        </div>
        <button onClick={exportPDF} disabled={lignes.length === 0}
          className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors w-full sm:w-auto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M12 15V3M7 10l5 5 5-5M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Exporter PDF
        </button>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto mb-6">
        <div className="flex gap-1 bg-[#1a1a1a] rounded-xl p-1 w-fit">
        <Link href="/dashboard/equipes" className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">Ouvriers</Link>
        <Link href="/dashboard/equipes/pointage" className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">Pointage</Link>
        <Link href="/dashboard/equipes/avances" className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">Avances</Link>
        <span className="px-4 py-2 rounded-lg bg-orange-500/10 text-orange-400 text-[13px] font-medium">Paie</span>
        </div>
      </div>

      {pageError && <div className="mb-5 flex items-center gap-2 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">{pageError}</div>}

      {/* Alerte avances importantes */}
      {hasAvancesAlert && !loading && (
        <div className="mb-5 flex items-start gap-3 bg-amber-500/[0.08] border border-amber-500/20 text-amber-300 rounded-xl px-4 py-3">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5 text-amber-400"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
          <p className="text-[13px]">Certains ouvriers ont des avances supérieures ou égales à 50% de leur salaire brut. Vérifiez avant le versement.</p>
        </div>
      )}

      {/* Sélecteur période */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-4 mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-gray-600 mb-3">Période</p>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={mois} onChange={e => setMois(Number(e.target.value))}
            className="bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:border-orange-500 transition-all">
            {MOIS_LABELS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
            className="bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:border-orange-500 transition-all">
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {loading && <Spinner />}
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Ouvriers payés', value: String(payesCount), color: 'text-white' },
            { label: 'Jours travaillés', value: String(totalJours), color: 'text-white' },
            { label: 'Salaire brut', value: totalBrut >= 1_000_000 ? `${(totalBrut/1_000_000).toFixed(2)}M` : `${(totalBrut/1_000).toFixed(0)}K`, color: 'text-orange-400', sub: 'FCFA' },
            { label: 'NET À PAYER', value: totalNet >= 1_000_000 ? `${(totalNet/1_000_000).toFixed(2)}M` : `${(totalNet/1_000).toFixed(0)}K`, color: 'text-emerald-400', sub: 'FCFA' },
          ].map(s => (
            <div key={s.label} className="bg-[#232323] rounded-2xl border border-white/[0.06] p-4">
              <p className={`text-[22px] font-bold ${s.color}`}>{s.value}<span className="text-[12px] font-normal text-gray-600 ml-1">{s.sub ?? ''}</span></p>
              <p className="text-gray-600 text-[11px] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tableau */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-white">Détail — {MOIS_LABELS[mois - 1]} {annee}</h2>
          {!loading && <span className="text-gray-600 text-[12px]">{lignes.length} ouvrier{lignes.length !== 1 ? 's' : ''}</span>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : lignes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-white text-[14px] font-medium mb-1">Aucune donnée</p>
            <p className="text-gray-600 text-[12px]">
              Enregistrez des <Link href="/dashboard/equipes/pointage" className="text-orange-400 hover:underline">pointages</Link> pour ce mois
            </p>
          </div>
        ) : (
          <>
            {/* Header — masqué sur mobile */}
            <div className="hidden md:grid px-5 py-3 bg-[#1e1e1e] border-b border-white/[0.04]"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}>
              {['Ouvrier', 'Métier', 'Jours', 'Brut', 'Avances', 'Net à payer'].map(h => (
                <span key={h} className="text-gray-600 text-[11px] font-semibold uppercase tracking-wider last:text-right">{h}</span>
              ))}
            </div>

            <div className="divide-y divide-white/[0.04]">
              {lignes.map(l => {
                const alerteAvance = l.avances > 0 && l.avances >= l.total_brut * 0.5
                return (
                  <div key={l.ouvrier_id}
                    className={`px-5 py-4 ${l.jours_travailles === 0 ? 'opacity-40' : ''} ${alerteAvance ? 'bg-amber-500/[0.04]' : 'hover:bg-white/[0.02]'} transition-colors`}>
                    {/* Mobile: stack */}
                    <div className="md:hidden">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-white text-[13px] font-medium">{l.prenom ? `${l.prenom} ${l.nom}` : l.nom}</p>
                          {l.metier && <p className="text-gray-600 text-[11px]">{l.metier}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-emerald-400 font-bold text-[14px]">{l.net_a_payer > 0 ? formatFCFA(l.net_a_payer) : '—'}</p>
                          <p className="text-gray-600 text-[10px]">Net à payer</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="text-gray-500">
                          {l.jours_travailles} {l.type_contrat === 'hebdomadaire' ? 'sem.' : 'j.'}
                        </span>
                        <span className="text-gray-700">·</span>
                        <span className="text-gray-500">Brut: {l.total_brut > 0 ? l.total_brut.toLocaleString('fr-FR') : '—'}</span>
                        {l.avances > 0 && <><span className="text-gray-700">·</span><span className="text-amber-400">Avances: {l.avances.toLocaleString('fr-FR')}</span></>}
                      </div>
                    </div>
                    {/* Desktop: grid */}
                    <div className="hidden md:grid items-center" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}>
                      <div>
                        <p className="text-white text-[13.5px] font-medium">{l.prenom ? `${l.prenom} ${l.nom}` : l.nom}</p>
                      </div>
                      <p className="text-gray-500 text-[12px]">{l.metier ?? '—'}</p>
                      <p className={`text-[14px] font-bold ${l.jours_travailles > 0 ? 'text-white' : 'text-gray-700'}`}>
                        {l.jours_travailles}
                        <span className="text-[11px] font-normal text-gray-600 ml-1">
                          {l.type_contrat === 'hebdomadaire' ? 'sem.' : 'j.'}
                        </span>
                      </p>
                      <p className={`text-[13px] ${l.total_brut > 0 ? 'text-gray-300' : 'text-gray-700'}`}>
                        {l.total_brut > 0 ? l.total_brut.toLocaleString('fr-FR') : '—'}
                      </p>
                      <p className={`text-[13px] ${l.avances > 0 ? 'text-amber-400 font-medium' : 'text-gray-700'}`}>
                        {l.avances > 0 ? l.avances.toLocaleString('fr-FR') : '—'}
                        {alerteAvance && <span className="ml-1 text-amber-400">⚠</span>}
                      </p>
                      <p className={`text-right text-[14px] font-bold ${l.net_a_payer > 0 ? 'text-emerald-400' : 'text-gray-700'}`}>
                        {l.net_a_payer > 0 ? formatFCFA(l.net_a_payer) : '—'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Ligne total */}
            <div className="hidden md:grid items-center px-5 py-4 bg-[#1e1e1e] border-t-2 border-orange-500/30"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}>
              <p className="text-white text-[13px] font-bold uppercase tracking-wide col-span-2">Total général</p>
              <p className="text-white font-bold">{totalJours}</p>
              <p className="text-gray-300 font-bold">{formatFCFA(totalBrut)}</p>
              <p className="text-amber-400 font-bold">{totalAvances > 0 ? formatFCFA(totalAvances) : '—'}</p>
              <p className="text-right text-emerald-400 text-[16px] font-bold">{formatFCFA(totalNet)}</p>
            </div>
            {/* Mobile total */}
            <div className="md:hidden px-5 py-4 bg-[#1e1e1e] border-t border-orange-500/30 flex items-center justify-between">
              <span className="text-gray-500 text-[12px] font-semibold uppercase tracking-wide">NET À PAYER</span>
              <span className="text-emerald-400 text-[18px] font-bold">{formatFCFA(totalNet)}</span>
            </div>
          </>
        )}
      </div>

      {/* Répartition par chantier — consolidation automatique des dépenses */}
      {!loading && chantierPaies.length > 0 && (
        <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden mt-6">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-[14px] font-semibold text-white">Répartition par chantier — {MOIS_LABELS[mois - 1]} {annee}</h2>
            <p className="text-gray-600 text-[11px] mt-0.5">Valider crée automatiquement une dépense "Main d'œuvre" pour le chantier, incluse dans sa rentabilité.</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {chantierPaies.map(cp => (
              <div key={cp.chantier_id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-white text-[13px] font-medium truncate">{cp.nom}</p>
                  <p className="text-gray-500 text-[12px]">{formatFCFA(cp.total_net)}</p>
                </div>
                {cp.valide ? (
                  <span className="shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center gap-1.5">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M2 8l4 4 8-8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Déjà validée
                  </span>
                ) : (
                  <button onClick={() => handleValiderPaie(cp)} disabled={validatingChantier === cp.chantier_id}
                    className="shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-semibold transition-colors disabled:opacity-60">
                    {validatingChantier === cp.chantier_id ? <><Spinner/>Validation…</> : 'Valider la paie'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-950 border border-emerald-700/50 text-emerald-300 px-5 py-3 rounded-2xl shadow-2xl text-[13px] font-medium">
          {toast}
        </div>
      )}
    </div>
  )
}
