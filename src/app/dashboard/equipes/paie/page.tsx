'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type LignePaie = {
  ouvrier_id: string
  nom: string
  prenom: string | null
  metier: string | null
  type_contrat: string | null
  taux_journalier: number | null
  jours_travailles: number
  total_fcfa: number
}

const MOIS_LABELS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
]

function formatFCFA(v: number) { return v.toLocaleString('fr-FR') + ' FCFA' }

export default function PaiePage() {
  const now = new Date()
  const [mois, setMois] = useState(now.getMonth() + 1)
  const [annee, setAnnee] = useState(now.getFullYear())
  const [lignes, setLignes] = useState<LignePaie[]>([])
  const [entrepriseNom, setEntrepriseNom] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageError, setPageError] = useState('')

  const chargerPaie = useCallback(async () => {
    setLoading(true); setPageError('')

    // Période
    const debut = `${annee}-${String(mois).padStart(2, '0')}-01`
    const finDate = new Date(annee, mois, 0)
    const fin = `${annee}-${String(mois).padStart(2, '0')}-${String(finDate.getDate()).padStart(2, '0')}`

    // Ouvriers de l'entreprise
    const { data: ouvriers, error: oErr } = await supabase
      .from('ouvriers')
      .select('id, nom, prenom, metier, type_contrat, taux_journalier')
      .order('nom')
    if (oErr) { setPageError(oErr.message); setLoading(false); return }

    // Pointages du mois
    const ouvrierIds = (ouvriers ?? []).map(o => o.id)
    const { data: pointages, error: pErr } = ouvrierIds.length > 0
      ? await supabase
          .from('pointages')
          .select('ouvrier_id, present, montant_jour')
          .in('ouvrier_id', ouvrierIds)
          .gte('date_pointage', debut)
          .lte('date_pointage', fin)
          .eq('present', true)
      : { data: [], error: null }
    if (pErr) { setPageError(pErr.message); setLoading(false); return }

    // Agréger par ouvrier
    const map: Record<string, { jours: number; total: number }> = {}
    ;(pointages ?? []).forEach(p => {
      if (!map[p.ouvrier_id]) map[p.ouvrier_id] = { jours: 0, total: 0 }
      map[p.ouvrier_id].jours++
      map[p.ouvrier_id].total += p.montant_jour ?? 0
    })

    const result: LignePaie[] = (ouvriers ?? []).map(o => ({
      ouvrier_id: o.id,
      nom: o.nom,
      prenom: o.prenom,
      metier: o.metier,
      type_contrat: o.type_contrat,
      taux_journalier: o.taux_journalier,
      jours_travailles: map[o.id]?.jours ?? 0,
      total_fcfa: map[o.id]?.total ?? 0,
    }))

    setLignes(result)
    setLoading(false)
  }, [mois, annee])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('entreprise_id').eq('id', user.id).single()
      if (profile?.entreprise_id) {
        const { data: ent } = await supabase
          .from('entreprises').select('nom').eq('id', profile.entreprise_id).single()
        if (ent) setEntrepriseNom(ent.nom)
      }
      await chargerPaie()
    }
    init()
  }, [chargerPaie])

  function exportPDF() {
    const totalGeneral = lignes.reduce((acc, l) => acc + l.total_fcfa, 0)
    const totalJours = lignes.reduce((acc, l) => acc + l.jours_travailles, 0)
    const periode = `${MOIS_LABELS[mois - 1]} ${annee}`

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Feuille de paie — ${periode}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #f97316; }
    .logo { font-size: 22px; font-weight: 800; color: #f97316; }
    .logo span { color: #1a1a1a; }
    .header-right { text-align: right; }
    .periode { font-size: 18px; font-weight: 700; color: #1a1a1a; }
    .sous-titre { font-size: 12px; color: #666; margin-top: 2px; }
    .entreprise { font-size: 13px; font-weight: 600; color: #444; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #f97316; color: white; padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    th:last-child, td:last-child { text-align: right; }
    td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
    tr:nth-child(even) td { background: #fafafa; }
    tr:hover td { background: #fff7ed; }
    .zero { color: #bbb; }
    .total-row td { border-top: 2px solid #f97316; font-weight: 700; font-size: 14px; background: #fff7ed !important; padding: 12px; }
    .badges { display: flex; gap: 16px; margin-bottom: 28px; }
    .badge { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 12px 20px; }
    .badge-val { font-size: 20px; font-weight: 800; color: #f97316; }
    .badge-label { font-size: 11px; color: #666; margin-top: 2px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; display: flex; justify-content: space-between; color: #999; font-size: 11px; }
    @media print { body { padding: 24px; } }
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
    <div class="badge">
      <div class="badge-val">${lignes.filter(l => l.jours_travailles > 0).length}</div>
      <div class="badge-label">Ouvriers payés</div>
    </div>
    <div class="badge">
      <div class="badge-val">${totalJours}</div>
      <div class="badge-label">Jours travaillés</div>
    </div>
    <div class="badge">
      <div class="badge-val">${formatFCFA(totalGeneral)}</div>
      <div class="badge-label">Masse salariale</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Nom & Prénom</th>
        <th>Métier</th>
        <th>Contrat</th>
        <th>Taux/jour</th>
        <th>Jours</th>
        <th>Total FCFA</th>
      </tr>
    </thead>
    <tbody>
      ${lignes.map((l, i) => `
      <tr>
        <td class="${l.total_fcfa === 0 ? 'zero' : ''}">${i + 1}</td>
        <td><strong>${l.prenom ? l.prenom + ' ' : ''}${l.nom}</strong></td>
        <td class="${l.total_fcfa === 0 ? 'zero' : ''}">${l.metier ?? '—'}</td>
        <td class="${l.total_fcfa === 0 ? 'zero' : ''}">${l.type_contrat ?? '—'}</td>
        <td class="${l.total_fcfa === 0 ? 'zero' : ''}">${l.taux_journalier ? formatFCFA(l.taux_journalier) : '—'}</td>
        <td class="${l.jours_travailles === 0 ? 'zero' : ''}">${l.jours_travailles}</td>
        <td class="${l.total_fcfa === 0 ? 'zero' : ''}">${l.total_fcfa > 0 ? formatFCFA(l.total_fcfa) : '—'}</td>
      </tr>`).join('')}
      <tr class="total-row">
        <td colspan="5">TOTAL GÉNÉRAL</td>
        <td>${totalJours} jours</td>
        <td>${formatFCFA(totalGeneral)}</td>
      </tr>
    </tbody>
  </table>

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

  const totalGeneral = lignes.reduce((acc, l) => acc + l.total_fcfa, 0)
  const totalJours = lignes.reduce((acc, l) => acc + l.jours_travailles, 0)
  const payesCount = lignes.filter(l => l.jours_travailles > 0).length

  const annees = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Paie de salaires</h1>
          <p className="text-gray-500 text-sm mt-1">Récapitulatif mensuel calculé depuis les pointages</p>
        </div>
        <button onClick={exportPDF} disabled={lignes.length === 0}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M12 15V3M7 10l5 5 5-5M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Exporter PDF
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1a1a1a] rounded-xl p-1 mb-6 w-fit">
        <Link href="/dashboard/equipes" className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">Ouvriers</Link>
        <Link href="/dashboard/equipes/pointage" className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-200 text-[13px] font-medium transition-colors">Pointage</Link>
        <span className="px-4 py-2 rounded-lg bg-orange-500/10 text-orange-400 text-[13px] font-medium">Paie</span>
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

      {/* Sélecteur période */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 mb-6">
        <p className="text-[11px] font-semibold text-gray-500 mb-3 uppercase tracking-widest">Période</p>
        <div className="flex items-center gap-3">
          <select value={mois} onChange={e => setMois(Number(e.target.value))}
            className="bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all">
            {MOIS_LABELS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
            className="bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all">
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <span className="text-gray-500 text-[13px]">
            {MOIS_LABELS[mois - 1]} {annee}
          </span>
        </div>
      </div>

      {/* Stats résumé */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Ouvriers payés', value: payesCount, color: 'text-orange-400', bg: 'bg-orange-500/10' },
            { label: 'Jours travaillés', value: totalJours, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Masse salariale', value: formatFCFA(totalGeneral), color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          ].map(s => (
            <div key={s.label} className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 flex items-center gap-3">
              <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center shrink-0`}>
                {typeof s.value === 'number'
                  ? <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`w-5 h-5 ${s.color}`}>
                      <circle cx="12" cy="12" r="9" />
                      <path d="M14.5 9.5H10a1.5 1.5 0 000 3h4a1.5 1.5 0 010 3H9.5M12 7v2m0 6v2" strokeLinecap="round" />
                    </svg>}
              </div>
              <div>
                <p className="text-gray-400 text-[12px]">{s.label}</p>
                {typeof s.value === 'string' && <p className={`text-[14px] font-bold ${s.color}`}>{s.value}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tableau paie */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-white">
            Détail par ouvrier — {MOIS_LABELS[mois - 1]} {annee}
          </h2>
          {!loading && (
            <span className="text-gray-600 text-[12px]">{lignes.length} ouvrier{lignes.length !== 1 ? 's' : ''}</span>
          )}
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
            {/* En-tête tableau */}
            <div className="grid px-6 py-3 bg-[#1e1e1e] border-b border-white/[0.04]"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
              {['Ouvrier', 'Métier', 'Taux/jour', 'Jours travaillés', 'Total FCFA'].map(h => (
                <span key={h} className="text-gray-600 text-[11px] font-semibold uppercase tracking-wider last:text-right">{h}</span>
              ))}
            </div>

            <div className="divide-y divide-white/[0.04]">
              {lignes.map(l => (
                <div key={l.ouvrier_id}
                  className={`grid items-center px-6 py-4 transition-colors hover:bg-white/[0.02] ${l.jours_travailles === 0 ? 'opacity-40' : ''}`}
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                  <div>
                    <p className="text-white text-[13.5px] font-medium">
                      {l.prenom ? `${l.prenom} ${l.nom}` : l.nom}
                    </p>
                  </div>
                  <p className="text-gray-500 text-[12px]">{l.metier ?? '—'}</p>
                  <p className="text-gray-400 text-[13px]">
                    {l.taux_journalier ? l.taux_journalier.toLocaleString('fr-FR') : '—'}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[14px] font-bold ${l.jours_travailles > 0 ? 'text-white' : 'text-gray-700'}`}>
                      {l.jours_travailles}
                    </span>
                    {l.jours_travailles > 0 && (
                      <span className="text-gray-600 text-[11px]">jour{l.jours_travailles !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  <p className={`text-right text-[14px] font-bold ${l.total_fcfa > 0 ? 'text-orange-400' : 'text-gray-700'}`}>
                    {l.total_fcfa > 0 ? formatFCFA(l.total_fcfa) : '—'}
                  </p>
                </div>
              ))}
            </div>

            {/* Ligne total */}
            <div className="grid items-center px-6 py-4 bg-[#1e1e1e] border-t-2 border-orange-500/30"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
              <p className="text-white text-[13px] font-bold uppercase tracking-wide">Total général</p>
              <p className="text-gray-500 text-[12px]">{payesCount} payé{payesCount !== 1 ? 's' : ''}</p>
              <p className="text-gray-500 text-[12px]">—</p>
              <p className="text-white text-[14px] font-bold">{totalJours} jours</p>
              <p className="text-right text-orange-400 text-[16px] font-bold">{formatFCFA(totalGeneral)}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
