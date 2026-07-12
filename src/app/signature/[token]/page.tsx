'use client'

import { use, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type DevisPublic = {
  id: string
  numero: string
  statut: string | null
  montant_ht: number | null
  montant_ttc: number | null
  tva_taux: number | null
  date_emission: string | null
  date_validite: string | null
  token_signature: string | null
  date_signature: string | null
  signe_par: string | null
  notes: string | null
  chantiers: { nom: string; client_nom: string } | null
  entreprises: { nom: string; telephone: string | null; email: string | null } | null
}

type LigneDevisRow = {
  id: string
  designation: string
  unite: string | null
  quantite: number | null
  prix_unit: number | null
  total: number | null
  ordre: number | null
}

function fcfa(v: number | null) {
  return (v ?? 0).toLocaleString('fr-FR') + ' FCFA'
}

type PageAction = 'idle' | 'accepting' | 'refusing' | 'done_accept' | 'done_refuse'

export default function SignaturePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [devis, setDevis] = useState<DevisPublic | null>(null)
  const [lignes, setLignes] = useState<LigneDevisRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clientNom, setClientNom] = useState('')
  const [showLignes, setShowLignes] = useState(false)
  const [action, setAction] = useState<PageAction>('idle')

  useEffect(() => {
    async function fetchDevis() {
      const { data, error: err } = await supabase
        .from('devis')
        .select('*, chantiers(nom, client_nom), entreprises(nom, telephone, email)')
        .eq('token_signature', token)
        .single()

      if (err || !data) {
        setError('Lien invalide ou devis introuvable.')
        setLoading(false)
        return
      }

      const d = data as DevisPublic
      setDevis(d)
      setClientNom(d.chantiers?.client_nom ?? '')

      if (d.statut === 'accepte') setAction('done_accept')
      else if (d.statut === 'refuse') setAction('done_refuse')

      // Fetch lignes
      const { data: ligs } = await supabase
        .from('lignes_devis')
        .select('*')
        .eq('devis_id', d.id)
        .order('ordre')

      setLignes((ligs ?? []) as LigneDevisRow[])
      setLoading(false)
    }
    fetchDevis()
  }, [token])

  async function handleAccepter() {
    if (!devis || !clientNom.trim()) return
    setAction('accepting')
    const { error: err } = await supabase.from('devis').update({
      statut: 'accepte',
      date_signature: new Date().toISOString(),
      signe_par: clientNom.trim(),
    }).eq('id', devis.id)

    if (err) { setAction('idle'); return }
    setAction('done_accept')

    fetch('/api/devis/sync-budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devis_id: devis.id }),
    }).catch(e => console.error('Erreur synchronisation budget prévisionnel:', e))

    // Notification WhatsApp
    const montant = (devis.montant_ttc ?? 0).toLocaleString('fr-FR')
    const msg = encodeURIComponent(`✅ ${clientNom.trim()} a accepté le devis ${devis.numero} de ${montant} FCFA`)
    setTimeout(() => {
      window.open(`https://wa.me/22376753087?text=${msg}`, '_blank')
    }, 800)
  }

  async function handleRefuser() {
    if (!devis) return
    setAction('refusing')
    await supabase.from('devis').update({ statut: 'refuse' }).eq('id', devis.id)
    setAction('done_refuse')

    fetch('/api/devis/sync-budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devis_id: devis.id }),
    }).catch(e => console.error('Erreur synchronisation budget prévisionnel:', e))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <svg className="animate-spin w-8 h-8 text-orange-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6 text-red-400">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-white font-bold text-lg mb-2">Lien invalide</h1>
          <p className="text-gray-500 text-[13px]">{error}</p>
        </div>
      </div>
    )
  }

  if (!devis) return null

  const ht = devis.montant_ht ?? 0
  const tva = Math.round(ht * (devis.tva_taux ?? 18) / 100)
  const ttc = ht + tva

  // Already signed
  if (action === 'done_accept') {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-emerald-500/15 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-8 h-8 text-emerald-400">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" strokeLinecap="round"/>
              <path d="M22 4L12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-white text-xl font-bold mb-2">Devis accepté</h1>
          <p className="text-emerald-400 text-[14px] font-medium mb-1">{devis.numero}</p>
          <p className="text-gray-500 text-[13px] mb-4">
            Signé par <strong className="text-white">{devis.signe_par ?? clientNom}</strong>
            {devis.date_signature && (
              <> le {new Date(devis.date_signature).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</>
            )}
          </p>
          <div className="bg-[#1C1C1C] rounded-2xl border border-white/[0.06] p-4">
            <p className="text-gray-500 text-[11px] uppercase tracking-wider mb-1">Montant TTC</p>
            <p className="text-emerald-400 text-2xl font-bold">{fcfa(ttc)}</p>
          </div>
          <p className="text-gray-600 text-[11px] mt-4">
            L&apos;entreprise {devis.entreprises?.nom ?? ''} a été notifiée.
          </p>
        </div>
      </div>
    )
  }

  if (action === 'done_refuse') {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-8 h-8 text-red-400">
              <circle cx="12" cy="12" r="10"/>
              <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-white text-xl font-bold mb-2">Devis refusé</h1>
          <p className="text-gray-500 text-[13px]">
            Votre réponse a été enregistrée. Contactez {devis.entreprises?.nom ?? "l'entreprise"} pour plus d&apos;informations.
          </p>
          {devis.entreprises?.telephone && (
            <a
              href={`tel:${devis.entreprises.telephone}`}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 rounded-xl bg-white/[0.06] text-gray-300 text-[13px] font-medium hover:bg-white/[0.1] transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.64A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.29 6.29l1.28-1.28a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {devis.entreprises.telephone}
            </a>
          )}
        </div>
      </div>
    )
  }

  const isExpire = devis.statut === 'expire' || (devis.date_validite && new Date(devis.date_validite) < new Date())

  return (
    <div className="min-h-screen bg-[#080808] py-8 px-4">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="text-center mb-7">
          <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
              <path d="M3 21h18M5 21V11m14 0v10M3 11l9-7 9 7M10 21v-5h4v5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-gray-500 text-[13px]">{devis.entreprises?.nom ?? 'BTP Mali'}</p>
          <h1 className="text-white text-xl font-bold mt-1">Devis à signer</h1>
        </div>

        {/* Carte devis */}
        <div className="bg-[#171717] rounded-2xl border border-white/[0.06] p-5 mb-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-orange-400 font-bold text-[16px]">{devis.numero}</p>
              <p className="text-gray-500 text-[12px] mt-0.5">
                Chantier : {devis.chantiers?.nom ?? '—'}
              </p>
            </div>
            {isExpire && (
              <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-amber-500/10 text-amber-400">
                Expiré
              </span>
            )}
          </div>

          {/* Montants */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center py-2 border-b border-white/[0.06]">
              <span className="text-gray-500 text-[12px]">Montant HT</span>
              <span className="text-gray-300 text-[13px]">{fcfa(ht)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/[0.06]">
              <span className="text-gray-500 text-[12px]">TVA {devis.tva_taux ?? 18}%</span>
              <span className="text-gray-300 text-[13px]">{fcfa(tva)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-white text-[13px] font-semibold">Total TTC</span>
              <span className="text-orange-400 text-[17px] font-bold">{fcfa(ttc)}</span>
            </div>
          </div>

          {/* Dates */}
          {(devis.date_emission || devis.date_validite) && (
            <div className="text-[11px] text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
              {devis.date_emission && (
                <span>Émis le {new Date(devis.date_emission).toLocaleDateString('fr-FR')}</span>
              )}
              {devis.date_validite && (
                <span>Valide jusqu&apos;au {new Date(devis.date_validite).toLocaleDateString('fr-FR')}</span>
              )}
            </div>
          )}

          {/* Toggle lignes */}
          {lignes.length > 0 && (
            <button
              onClick={() => setShowLignes(v => !v)}
              className="mt-4 flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`w-3.5 h-3.5 transition-transform ${showLignes ? 'rotate-180' : ''}`}>
                <path d="M3 6l5 5 5-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {showLignes ? 'Masquer le détail' : `Voir les ${lignes.length} ligne${lignes.length > 1 ? 's' : ''}`}
            </button>
          )}

          {showLignes && (
            <div className="mt-3 space-y-1.5">
              {lignes.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).map((l, i) => (
                <div key={l.id} className="flex justify-between items-center py-1.5 border-b border-white/[0.04] last:border-0">
                  <div>
                    <span className="text-gray-400 text-[11px] mr-2">{i + 1}.</span>
                    <span className="text-gray-300 text-[12px]">{l.designation}</span>
                    <span className="text-gray-600 text-[11px] ml-1.5">{l.quantite} {l.unite}</span>
                  </div>
                  <span className="text-gray-400 text-[12px] shrink-0 ml-2">{(l.total ?? 0).toLocaleString('fr-FR')} F</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        {devis.notes && (
          <div className="bg-[#171717] rounded-xl border border-white/[0.06] px-4 py-3 mb-5">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">Notes</p>
            <p className="text-gray-400 text-[13px]">{devis.notes}</p>
          </div>
        )}

        {isExpire ? (
          <div className="bg-amber-500/[0.08] border border-amber-500/20 rounded-xl px-4 py-3 text-center">
            <p className="text-amber-400 text-[13px]">Ce devis a expiré. Contactez {devis.entreprises?.nom ?? "l'entreprise"} pour obtenir un nouveau devis.</p>
          </div>
        ) : (
          /* Formulaire de signature */
          <div className="bg-[#171717] rounded-2xl border border-white/[0.06] p-5">
            <h2 className="text-white text-[14px] font-semibold mb-4">Votre décision</h2>

            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                Votre nom complet <span className="text-orange-400">*</span>
              </label>
              <input
                type="text"
                value={clientNom}
                onChange={e => setClientNom(e.target.value)}
                placeholder="Prénom NOM"
                className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleRefuser}
                disabled={action === 'refusing' || action === 'accepting' || !clientNom.trim()}
                className="py-3 rounded-xl border border-red-500/30 bg-red-500/[0.08] text-red-400 text-[13px] font-semibold hover:bg-red-500/[0.15] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {action === 'refusing'
                  ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M2 2l12 12M14 2L2 14" strokeLinecap="round"/></svg>}
                Refuser
              </button>

              <button
                onClick={handleAccepter}
                disabled={action === 'accepting' || action === 'refusing' || !clientNom.trim()}
                className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {action === 'accepting'
                  ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M2 8l4 4 8-8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                Accepter
              </button>
            </div>

            <p className="text-gray-700 text-[11px] text-center mt-3">
              En acceptant, vous approuvez ce devis de {fcfa(ttc)} et autorisez le démarrage des travaux.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-gray-700 text-[11px]">
            Document généré par <span className="text-orange-400">BTP Mali</span> — Gestion professionnelle de chantiers
          </p>
        </div>
      </div>
    </div>
  )
}
