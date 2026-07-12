'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageSkeleton from '@/components/PageSkeleton'
import { useActionGuard } from '@/hooks/useActionGuard'
import PageTooltip from '@/components/PageTooltip'
import { generateDocument } from '@/lib/pdf/generateDocument'

const supabase = createClient()

/* ─────────────────────────── Types ─────────────────────────── */

type Relance = {
  id: string
  type: 'whatsapp' | 'email' | 'copie'
  niveau: 'j7' | 'j15' | 'j30'
  envoye_le: string
  reponse_client: string | null
  date_reponse: string | null
}

type ChantierInfo = {
  nom: string
  client_nom: string
  client_telephone: string | null
  client_email: string | null
}

type Facture = {
  id: string
  numero: string
  statut: string | null
  montant_ht: number | null
  montant_ttc: number | null
  montant_paye: number | null
  date_emission: string | null
  date_echeance: string | null
  entreprise_id: string | null
  chantier_id: string | null
  devis_id: string | null
  client_nom: string | null
  client_telephone: string | null
  client_email: string | null
  chantiers: ChantierInfo | null
  devis: { chantier_id: string | null; chantiers: ChantierInfo | null } | null
  relances: Relance[]
}

type Entreprise = { nom: string; adresse?: string | null; telephone: string | null; email: string | null; rccm?: string | null; nif?: string | null }
type PaletteKey = 'gray' | 'amber' | 'red' | 'darkred'
type LevelKey = 'j7' | 'j15' | 'j30'
type LevelState = { state: 'active' | 'sent' | 'disabled'; sentDate: string | null }

/* ─────────────────────────── Constantes ────────────────────── */

const PALETTES: Record<PaletteKey, { row: string; badge: string; text: string }> = {
  gray:    { row: '',                               badge: 'bg-gray-500/10 text-gray-400',   text: 'text-gray-400'   },
  amber:   { row: 'border-l-2 border-amber-500/50', badge: 'bg-amber-500/10 text-amber-400', text: 'text-amber-400'  },
  red:     { row: 'border-l-2 border-red-500/50',   badge: 'bg-red-500/10 text-red-400',     text: 'text-red-400'    },
  darkred: { row: 'border-l-2 border-red-700/70',   badge: 'bg-red-900/20 text-red-300',     text: 'text-red-300'    },
}

const LEVEL_LABELS: Record<LevelKey, string> = { j7: 'J+7', j15: 'J+15', j30: 'J+30' }
const LEVEL_MIN: Record<LevelKey, number>    = { j7: 7,  j15: 15, j30: 30 }
const LEVEL_MAX: Record<LevelKey, number>    = { j7: 15, j15: 30, j30: Infinity }

/* ─────────────────────────── Helpers purs ──────────────────── */

function retardJours(d: string | null): number {
  if (!d) return 0
  const t = new Date(); t.setHours(0, 0, 0, 0)
  const e = new Date(d);  e.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((t.getTime() - e.getTime()) / 86400000))
}

function getPaletteKey(j: number): PaletteKey {
  if (j < 7)  return 'gray'
  if (j < 15) return 'amber'
  if (j < 30) return 'red'
  return 'darkred'
}

function fcfa(v: number | null) { return (v ?? 0).toLocaleString('fr-FR') + ' FCFA' }

function getChantierInfo(f: Facture): ChantierInfo | null { return f.chantiers ?? f.devis?.chantiers ?? null }
function getChantierID(f: Facture): string | null         { return f.chantier_id ?? f.devis?.chantier_id ?? null }

function getEffectiveNom(f: Facture): string {
  return f.client_nom || getChantierInfo(f)?.client_nom || f.numero
}
function getEffectiveTel(f: Facture): string | null {
  return f.client_telephone ?? getChantierInfo(f)?.client_telephone ?? null
}
function getEffectiveEmail(f: Facture): string | null {
  return f.client_email ?? getChantierInfo(f)?.client_email ?? null
}

/* Retourne l'état d'un bouton de niveau donné */
function getLevelState(niveau: LevelKey, jours: number, relances: Relance[]): LevelState {
  const min = LEVEL_MIN[niveau]
  const max = LEVEL_MAX[niveau]
  const sent = relances
    .filter(r => r.niveau === niveau)
    .sort((a, b) => new Date(b.envoye_le).getTime() - new Date(a.envoye_le).getTime())[0]

  if (jours >= max) return { state: 'sent', sentDate: sent ? new Date(sent.envoye_le).toLocaleDateString('fr-FR') : null }
  if (jours >= min) {
    if (sent)       return { state: 'sent',   sentDate: new Date(sent.envoye_le).toLocaleDateString('fr-FR') }
    return              { state: 'active',  sentDate: null }
  }
  return { state: 'disabled', sentDate: null }
}

/* Dernier J+7 envoyé (pour le message J+15) */
function dateJ7Sent(relances: Relance[]): string {
  const r = relances
    .filter(x => x.niveau === 'j7')
    .sort((a, b) => new Date(a.envoye_le).getTime() - new Date(b.envoye_le).getTime())[0]
  return r ? new Date(r.envoye_le).toLocaleDateString('fr-FR') : ''
}

/* ─────────────────────────── Messages WhatsApp ──────────────── */

function fmtDate(d: string | null): string {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR') : ''
}

function genMessage(niveau: LevelKey, f: Facture, ent: Entreprise): string {
  const clientNom = getEffectiveNom(f)
  const ttcStr    = Math.round(f.montant_ttc ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const entNom    = ent.nom || 'BTP Mali'
  const entTel    = ent.telephone ?? ''

  if (niveau === 'j7') return [
    `Bonjour ${clientNom},`,
    '',
    `Nous nous permettons de vous rappeler que la facture numero ${f.numero}, d'un montant de ${ttcStr} FCFA, emise le ${fmtDate(f.date_emission)}, est echue depuis 7 jours.`,
    '',
    `Nous vous serions reconnaissants de bien vouloir proceder au reglement dans les meilleurs delais.`,
    '',
    `Modes de paiement acceptes : Orange Money, Wave, virement bancaire.`,
    '',
    `Nous restons a votre disposition pour toute information complementaire.`,
    '',
    `Cordialement,`,
    entNom,
    entTel,
  ].filter(Boolean).join('\n')

  if (niveau === 'j15') return [
    `Bonjour ${clientNom},`,
    '',
    `Malgre notre precedent rappel concernant la facture numero ${f.numero}, d'un montant de ${ttcStr} FCFA, celle-ci demeure impayee a ce jour, soit 15 jours apres son echeance.`,
    '',
    `Nous vous demandons de proceder au reglement sous 48 heures afin d'eviter toute mesure supplementaire.`,
    '',
    `Pour tout arrangement de paiement, nous vous invitons a nous contacter sans delai.`,
    '',
    `Dans l'attente de votre retour,`,
    '',
    `Cordialement,`,
    entNom,
    entTel,
  ].filter(Boolean).join('\n')

  return [
    `Bonjour ${clientNom},`,
    '',
    `Nous constatons que la facture numero ${f.numero}, d'un montant de ${ttcStr} FCFA, demeure impayee depuis 30 jours, malgre nos relances successives.`,
    '',
    `A defaut de reglement integral sous 72 heures, nous nous verrons contraints d'engager les demarches necessaires au recouvrement de cette creance, incluant l'application des penalites de retard prevues.`,
    '',
    `Nous vous invitons a regulariser cette situation dans les delais impartis ou a nous contacter immediatement.`,
    '',
    `Cordialement,`,
    entNom,
    entTel,
  ].filter(Boolean).join('\n')
}

/* ─────────────────────── Messages Email ─────────────────────── */

function genEmailSubject(niveau: LevelKey, f: Facture): string {
  if (niveau === 'j7')  return `Rappel de paiement - Facture ${f.numero}`
  if (niveau === 'j15') return `Relance - Facture ${f.numero} impayee depuis 15 jours`
  return `Mise en demeure - Facture ${f.numero}`
}

function genEmailBody(niveau: LevelKey, f: Facture, ent: Entreprise): string {
  const clientNom = getEffectiveNom(f)
  const ttcStr    = Math.round(f.montant_ttc ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const entNom    = ent.nom || 'BTP Mali'
  const sig       =[entNom, ent.telephone ? `Tel : ${ent.telephone}` : null, ent.email ?? null].filter(Boolean).join('\n')

  if (niveau === 'j7') return [
    `Bonjour ${clientNom},`,
    '',
    `Nous nous permettons de vous rappeler que la facture ${f.numero}, d'un montant de ${ttcStr} FCFA, emise le ${fmtDate(f.date_emission)}, est echue depuis 7 jours.`,
    '',
    `Nous vous serions reconnaissants de bien vouloir proceder au reglement dans les meilleurs delais.`,
    '',
    `Modes de paiement acceptes : Orange Money, Wave, virement bancaire.`,
    '',
    `Nous restons a votre disposition pour toute information complementaire.`,
    '',
    `Cordialement,`,
    sig,
  ].join('\n')

  if (niveau === 'j15') return [
    `Bonjour ${clientNom},`,
    '',
    `Malgre notre precedent rappel concernant la facture ${f.numero}, d'un montant de ${ttcStr} FCFA, celle-ci demeure impayee a ce jour, soit 15 jours apres son echeance.`,
    '',
    `Nous vous demandons de proceder au reglement sous 48 heures afin d'eviter toute mesure supplementaire.`,
    '',
    `Pour tout arrangement de paiement, nous vous invitons a nous contacter sans delai.`,
    '',
    `Dans l'attente de votre retour,`,
    '',
    `Cordialement,`,
    sig,
  ].join('\n')

  return [
    `Mise en demeure`,
    '',
    `Bonjour ${clientNom},`,
    '',
    `Nous constatons que la facture ${f.numero}, d'un montant de ${ttcStr} FCFA, demeure impayee depuis 30 jours, malgre nos relances successives.`,
    '',
    `A defaut de reglement integral sous 72 heures, nous nous verrons contraints d'engager les demarches necessaires au recouvrement de cette creance, incluant l'application des penalites de retard prevues.`,
    '',
    `Nous vous invitons a regulariser cette situation dans les delais impartis ou a nous contacter immediatement.`,
    '',
    `Cordialement,`,
    sig,
  ].join('\n')
}

/* ────────────────────── Pénalités de retard ──────────────────── */

function calculPenalite(restant: number, jours: number): number {
  if (jours < 30) return 0
  return Math.round(restant * 0.015 * (jours / 30))
}

/* ─────────────────────────── PDF ────────────────────────────── */

async function generateAndDownloadPDF(params: {
  f: Facture
  niveau: LevelKey
  ent: Entreprise
  message: string
}): Promise<void> {
  const { f, ent, message } = params
  const ht  = f.montant_ht ?? 0
  const ttc = f.montant_ttc ?? 0
  const tva = Math.round(ht * 18 / 100)
  await generateDocument({
    type: 'relance',
    entreprise: {
      nom:       ent.nom,
      adresse:   ent.adresse,
      telephone: ent.telephone,
      email:     ent.email,
      rccm:      ent.rccm,
      nif:       ent.nif,
    },
    numero:        f.numero,
    date_emission: f.date_emission,
    date_echeance: f.date_echeance,
    client_nom:    getEffectiveNom(f),
    tva_taux:      18,
    ht,
    tva,
    ttc,
    montant_paye:  f.montant_paye,
    lignes: [{
      designation: `Facture ${f.numero}`,
      unite:       'forfait',
      quantite:    1,
      prix_unit:   ttc,
      total:       ttc,
    }],
    relance_message: message,
  })
}

/* ──────────────────────────── Page ─────────────────────────── */

export default function CreancesPage() {
  const { guard } = useActionGuard()
  const [factures, setFactures]         = useState<Facture[]>([])
  const [loading, setLoading]           = useState(true)
  const [entreprise, setEntreprise]     = useState<Entreprise>({ nom: '', telephone: null, email: null })

  const [paiementTarget, setPaiementTarget] = useState<Facture | null>(null)
  const [payant, setPayant]             = useState(false)

  const [expanded, setExpanded]         = useState<Set<string>>(new Set())
  const [previewId, setPreviewId]       = useState<string | null>(null)

  // Toast
  const [toast, setToast]               = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Instruction PDF après envoi WA
  const [waInstruction, setWaInstruction] = useState<string | null>(null)

  // Relance en cours (chargement)
  const [loadingRelance, setLoadingRelance] = useState<string | null>(null)

  // Réponse client en cours d'enregistrement
  const [savingReponse, setSavingReponse] = useState<string | null>(null)

  // Dropdown réponse ouvert
  const [reponseDropdown, setReponseDropdown] = useState<string | null>(null)

  // Ajout téléphone legacy
  const [telTarget, setTelTarget] = useState<string | null>(null)
  const [telVal, setTelVal]       = useState('')
  const [savingTel, setSavingTel] = useState(false)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: profile }, { data: facs }] = await Promise.all([
      supabase.from('profiles').select('entreprises(nom, adresse, telephone, email, rccm, nif)').eq('id', user.id).single(),
      supabase
        .from('factures')
        .select(`*, chantiers(nom, client_nom, client_telephone, client_email),
          devis(chantier_id, chantiers(nom, client_nom, client_telephone, client_email)),
          relances(id, type, niveau, envoye_le, reponse_client, date_reponse)`)
        .neq('statut', 'paye')
        .order('date_echeance', { ascending: true }),
    ])

    if (profile?.entreprises) {
      const e = profile.entreprises as unknown as Entreprise
      setEntreprise({
        nom:       e.nom       ?? '',
        adresse:   e.adresse   ?? null,
        telephone: e.telephone ?? null,
        email:     e.email     ?? null,
        rccm:      e.rccm      ?? null,
        nif:       e.nif       ?? null,
      })
    }
    setFactures((facs ?? []) as Facture[])
  }, [])

  useEffect(() => {
    setLoading(true); fetchData().finally(() => setLoading(false))
  }, [fetchData])

  /* ── Clic bouton relance : PDF → WhatsApp → log ── */
  async function handleRelance(f: Facture, niveau: LevelKey) {
    const key = `${f.id}_${niveau}`
    setLoadingRelance(key)
    try {
      const msg = genMessage(niveau, f, entreprise)

      // 1. Génère et télécharge le PDF
      await generateAndDownloadPDF({ f, niveau, ent: entreprise, message: msg })

      // 2. Ouvre WhatsApp si le numéro existe
      const tel = getEffectiveTel(f)?.replace(/\D/g, '')
      if (tel) {
        console.log('[WA message avant encodage]', JSON.stringify(msg))
        window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank')
        setWaInstruction(f.id)
        setTimeout(() => setWaInstruction(p => p === f.id ? null : p), 10000)
      } else {
        showToast('PDF téléchargé — ajoutez le téléphone pour envoyer sur WhatsApp', 'error')
      }

      // 3. Log relance
      if (f.entreprise_id) {
        await supabase.from('relances').insert({ facture_id: f.id, entreprise_id: f.entreprise_id, type: 'whatsapp', niveau })
        await fetchData()
      }
    } finally {
      setLoadingRelance(null)
    }
  }

  /* ── Relance Email ── */
  async function handleEmailRelance(f: Facture, niveau: LevelKey) {
    const email   = getEffectiveEmail(f)
    const subject = genEmailSubject(niveau, f)
    const body    = genEmailBody(niveau, f, entreprise)

    if (email) {
      window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
    } else {
      showToast('Aucun email client — ajoutez-en un via "Modifier"', 'error')
    }

    if (f.entreprise_id) {
      await supabase.from('relances').insert({ facture_id: f.id, entreprise_id: f.entreprise_id, type: 'email', niveau })
      await fetchData()
    }
  }

  /* ── Statut réponse client ── */
  async function handleSetReponse(f: Facture, reponse: string) {
    const sorted = [...(f.relances ?? [])].sort((a, b) => new Date(b.envoye_le).getTime() - new Date(a.envoye_le).getTime())
    const latest = sorted[0]
    if (!latest) { showToast('Aucune relance envoyée pour cette facture', 'error'); return }
    setSavingReponse(latest.id)
    const { error } = await supabase.from('relances')
      .update({ reponse_client: reponse, date_reponse: new Date().toISOString() })
      .eq('id', latest.id)
    setSavingReponse(null)
    if (error) { showToast('Erreur : ' + error.message, 'error'); return }
    showToast('Réponse enregistrée')
    await fetchData()
  }

  /* ── Copier message dans le presse-papier ── */
  async function copyMessage(f: Facture, niveau: LevelKey) {
    const msg = genMessage(niveau, f, entreprise)
    try {
      await navigator.clipboard.writeText(msg)
      showToast('Message copié dans le presse-papier')
    } catch {
      showToast('Impossible de copier — accès refusé', 'error')
    }
  }

  /* ── Téléphone legacy ── */
  function openTelModal(f: Facture) {
    setTelTarget(f.id)
    setTelVal(getEffectiveTel(f) ?? '')
  }

  async function handleSaveTel() {
    if (!telTarget) return
    setSavingTel(true)
    const { error } = await supabase.from('factures').update({ client_telephone: telVal.trim() || null }).eq('id', telTarget)
    setSavingTel(false); setTelTarget(null)
    if (error) { showToast('Erreur : ' + error.message, 'error'); return }
    showToast('Téléphone mis à jour')
    await fetchData()
  }

  /* ── Paiement ── */
  async function marquerPaye() {
    if (!paiementTarget) return
    setPayant(true)
    await supabase.from('factures').update({ statut: 'paye', montant_paye: paiementTarget.montant_ttc, date_paiement: new Date().toISOString() }).eq('id', paiementTarget.id)
    setPayant(false); setPaiementTarget(null); await fetchData()
  }

  function toggleExpand(id: string) {
    setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const totalCreances = factures.reduce((a, f) => a + Math.max(0, (f.montant_ttc ?? 0) - (f.montant_paye ?? 0)), 0)
  const countByKey = (k: PaletteKey) => factures.filter(f => getPaletteKey(retardJours(f.date_echeance)) === k).length

  if (loading) return <PageSkeleton />

  return (
    <div className="p-4 sm:p-6 md:p-8">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl border text-[13px] font-medium transition-all ${
          toast.type === 'success'
            ? 'bg-emerald-950 border-emerald-700/50 text-emerald-300'
            : 'bg-red-950 border-red-700/50 text-red-300'
        }`}>
          <span>{toast.msg}</span>
        </div>
      )}

      <PageTooltip pageKey="creances" message="Vos factures impayées apparaissent ici. Les relances WhatsApp partent automatiquement à J+7, J+15 et J+30." />

      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Créances & Relances</h1>
        <p className="text-gray-500 text-sm mt-1">Suivi des factures impayées et relances clients</p>
      </div>

      {/* Total créances */}
      <div className="bg-gradient-to-br from-red-500/10 to-orange-500/5 border border-red-500/20 rounded-2xl p-6 mb-6">
        <p className="text-[11px] uppercase tracking-widest font-semibold text-gray-500 mb-2">Total des créances</p>
        <p className="text-3xl font-bold text-white">{fcfa(totalCreances)}</p>
        <p className="text-gray-600 text-[12px] mt-2">
          {factures.length} facture{factures.length !== 1 ? 's' : ''} non payée{factures.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Stats ancienneté */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {([
          { key: 'gray'    as PaletteKey, label: '0–7 jours',   color: 'text-gray-400'  },
          { key: 'amber'   as PaletteKey, label: '7–15 jours',  color: 'text-amber-400' },
          { key: 'red'     as PaletteKey, label: '15–30 jours', color: 'text-red-400'   },
          { key: 'darkred' as PaletteKey, label: '+30 jours',   color: 'text-red-300'   },
        ]).map(s => (
          <div key={s.key} className="bg-[#232323] rounded-2xl border border-white/[0.06] p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{countByKey(s.key)}</p>
            <p className="text-gray-600 text-[11px] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Liste */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-[15px] font-semibold text-white">
            Factures non payées
            {!loading && <span className="ml-2 text-gray-600 text-[13px] font-normal">({factures.length})</span>}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        ) : factures.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-emerald-400">
                <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-white text-[14px] font-medium mb-1">Aucune créance en attente</p>
            <p className="text-gray-600 text-[12px]">Toutes vos factures sont payées</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {factures.map(f => {
              const jours          = retardJours(f.date_echeance)
              const pkey           = getPaletteKey(jours)
              const palette        = PALETTES[pkey]
              const restant        = Math.max(0, (f.montant_ttc ?? 0) - (f.montant_paye ?? 0))
              const relances       = f.relances ?? []
              const tel            = getEffectiveTel(f)
              const email          = getEffectiveEmail(f)
              const isWaInstr      = waInstruction === f.id
              const nomClient      = getEffectiveNom(f)
              const nomIsPlaceholder = nomClient === f.numero
              const penalite       = calculPenalite(restant, jours)
              const activeLevel: LevelKey | null = jours >= 30 ? 'j30' : jours >= 15 ? 'j15' : jours >= 7 ? 'j7' : null
              const isLoading      = activeLevel ? loadingRelance === `${f.id}_${activeLevel}` : false
              const latestRelance  = [...relances].sort((a, b) => new Date(b.envoye_le).getTime() - new Date(a.envoye_le).getTime())[0]
              const latestReponse  = latestRelance?.reponse_client ?? null

              return (
                <div key={f.id} className={`px-4 py-3 hover:bg-white/[0.015] transition-colors ${palette.row}`}>

                  {/* ── Ligne 1 : N° + badge + montant ── */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-white text-[13px] font-semibold shrink-0 tabular-nums">{f.numero}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${palette.badge}`}>
                        {jours === 0 ? 'Pas échu' : `${jours}j`}
                      </span>
                    </div>
                    <span className={`text-[14px] font-bold shrink-0 tabular-nums ${palette.text}`}>{fcfa(restant)}</span>
                  </div>

                  {/* ── Ligne 2 : Client ── */}
                  <div className="flex items-center gap-2 mt-1 min-w-0">
                    <span className="text-gray-300 text-[12px] font-medium truncate">
                      {nomIsPlaceholder ? (f.chantiers?.nom ?? '—') : nomClient}
                    </span>
                    {!tel && (
                      <button onClick={() => guard(() => openTelModal(f))}
                        className="shrink-0 text-[11px] text-orange-400/70 hover:text-orange-400 transition-colors">
                        + Ajouter le téléphone
                      </button>
                    )}
                  </div>

                  {/* ── Ligne 3 : Échéance + boutons d'action ── */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {f.date_echeance && (
                      <span className="text-gray-600 text-[10px] shrink-0">
                        Éch. {new Date(f.date_echeance).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                    {penalite > 0 && (
                      <span className="text-orange-400/50 text-[10px] shrink-0 mr-1">+pén.</span>
                    )}

                    {/* 📱 WhatsApp */}
                    {activeLevel && (
                      <button
                        onClick={() => handleRelance(f, activeLevel)}
                        disabled={isLoading}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                      >
                        {isLoading
                          ? <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                          : <span>📱</span>}
                        <span>WA {LEVEL_LABELS[activeLevel]}</span>
                      </button>
                    )}

                    {/* 📧 Email */}
                    {activeLevel && (
                      <button
                        onClick={() => handleEmailRelance(f, activeLevel)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-all ${
                          email
                            ? 'bg-blue-500/10 border-blue-500/25 text-blue-400 hover:bg-blue-500/20'
                            : 'bg-white/[0.03] border-white/[0.06] text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        <span>📧</span>
                        <span>Email</span>
                      </button>
                    )}

                    {/* 📋 Copier message */}
                    {activeLevel && (
                      <button
                        onClick={() => copyMessage(f, activeLevel)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:text-gray-200 hover:bg-white/[0.07] transition-all"
                      >
                        <span>📋</span>
                        <span>Copier</span>
                      </button>
                    )}

                    {/* 💬 Réponse dropdown */}
                    {relances.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => setReponseDropdown(reponseDropdown === f.id ? null : f.id)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-all ${
                            latestReponse
                              ? 'bg-orange-500/15 border-orange-500/30 text-orange-300'
                              : 'bg-white/[0.04] border-white/[0.08] text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5 shrink-0"><path d="M14 2H2a1 1 0 00-1 1v8a1 1 0 001 1h4l3 3 3-3h2a1 1 0 001-1V3a1 1 0 00-1-1z" strokeLinejoin="round"/></svg>
                          <span>
                            {latestReponse === 'va_payer' ? 'Va payer'
                              : latestReponse === 'delai' ? 'Délai'
                              : latestReponse === 'conteste' ? 'Conteste'
                              : 'Réponse'}
                          </span>
                        </button>
                        {reponseDropdown === f.id && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setReponseDropdown(null)} />
                            <div className="absolute bottom-full left-0 mb-1 bg-[#2a2a2a] border border-white/[0.1] rounded-xl shadow-2xl z-30 w-48 overflow-hidden">
                              {[
                                { value: 'va_payer', label: 'Client va payer' },
                                { value: 'delai',    label: 'Demande un délai' },
                                { value: 'conteste', label: 'Conteste la facture' },
                              ].map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => { handleSetReponse(f, opt.value); setReponseDropdown(null) }}
                                  disabled={savingReponse !== null}
                                  className={`w-full text-left px-3 py-2 text-[12px] hover:bg-white/[0.06] transition-colors disabled:opacity-50 ${
                                    latestReponse === opt.value ? 'text-orange-300 bg-orange-500/10' : 'text-gray-300'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Marquer payée */}
                    <button
                      onClick={() => setPaiementTarget(f)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all ml-auto"
                    >
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3 h-3">
                        <path d="M2 8l5 5L14 3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Marquer payée</span>
                    </button>
                  </div>

                  {/* ── Instruction WA ── */}
                  {isWaInstr && (
                    <div className="mt-1.5 flex items-center gap-2 px-3 py-1.5 bg-emerald-500/[0.07] border border-emerald-600/20 rounded-lg text-[11px] text-emerald-300">
                      <span>📎</span>
                      <span>PDF téléchargé — joignez-le au message WhatsApp avant d&apos;envoyer.</span>
                    </div>
                  )}

                  {/* ── Historique collapsible ── */}
                  {relances.length > 0 && (
                    <div className="mt-1.5">
                      <button
                        onClick={() => toggleExpand(f.id)}
                        className="flex items-center gap-1 text-[10px] text-gray-700 hover:text-gray-500 transition-colors"
                      >
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`w-2.5 h-2.5 transition-transform ${expanded.has(f.id) ? 'rotate-180' : ''}`}>
                          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Historique ({relances.length}) · {relances.filter(r => r.type === 'whatsapp').length} WA · {relances.filter(r => r.type === 'email').length} Email
                      </button>
                      {expanded.has(f.id) && (
                        <div className="mt-1 pl-3 space-y-1 border-l border-white/[0.06]">
                          {[...relances]
                            .sort((a, b) => new Date(b.envoye_le).getTime() - new Date(a.envoye_le).getTime())
                            .map(r => (
                              <div key={r.id} className="flex items-center gap-2 text-[10px] py-0.5">
                                <span className="text-emerald-600 shrink-0">✓</span>
                                <span className={r.type === 'whatsapp' ? 'text-emerald-400' : r.type === 'email' ? 'text-blue-400' : 'text-gray-400'}>
                                  {r.type === 'whatsapp' ? '📱' : r.type === 'email' ? '📧' : '📋'}{' '}
                                  {{ j7: 'J+7', j15: 'J+15', j30: 'J+30' }[r.niveau]} — {new Date(r.envoye_le).toLocaleDateString('fr-FR')}
                                </span>
                                {r.reponse_client && (
                                  <span className={`ml-auto px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0 ${
                                    r.reponse_client === 'va_payer' ? 'bg-emerald-500/15 text-emerald-400' :
                                    r.reponse_client === 'delai'    ? 'bg-amber-500/15 text-amber-400' :
                                    'bg-red-500/15 text-red-400'
                                  }`}>
                                    {r.reponse_client === 'va_payer' ? 'Va payer' : r.reponse_client === 'delai' ? 'Délai' : 'Conteste'}
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal paiement ── */}
      {paiementTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) setPaiementTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="sm:hidden flex justify-center -mt-3 mb-3"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <h3 className="text-white text-[15px] font-semibold text-center mb-2">Marquer comme payée ?</h3>
            <p className="text-gray-500 text-[13px] text-center mb-5">
              Facture <span className="text-white font-medium">{paiementTarget.numero}</span> — entièrement payée.
            </p>
            <div className="bg-[#1C1C1C] rounded-xl p-4 mb-5 space-y-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-gray-500">Client</span>
                <span className="text-white font-medium">{getEffectiveNom(paiementTarget)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-gray-500">Montant TTC</span>
                <span className="text-emerald-400 font-bold">{fcfa(paiementTarget.montant_ttc)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPaiementTarget(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] font-medium">Annuler</button>
              <button onClick={marquerPaye} disabled={payant}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {payant ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>…</> : 'Confirmer le paiement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ajout téléphone legacy ── */}
      {telTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) setTelTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="sm:hidden flex justify-center -mt-3 mb-3"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white text-[15px] font-semibold">Téléphone du client</h3>
              <button onClick={() => setTelTarget(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/></svg>
              </button>
            </div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Téléphone WhatsApp</label>
            <input type="tel" value={telVal} onChange={e => setTelVal(e.target.value)} autoFocus
              placeholder="+223 76 00 00 00"
              className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all" />
            <div className="flex gap-3 mt-5">
              <button onClick={() => setTelTarget(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] font-medium">Annuler</button>
              <button onClick={handleSaveTel} disabled={savingTel || !telVal.trim()}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {savingTel ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Enregistrement…</> : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
