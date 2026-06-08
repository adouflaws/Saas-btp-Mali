'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

/* ─────────────────────────── Types ─────────────────────────── */

type Relance = {
  id: string
  type: 'whatsapp' | 'email' | 'copie'
  niveau: 'j7' | 'j15' | 'j30'
  envoye_le: string
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

type Entreprise = { nom: string; telephone: string | null; email: string | null }
type PaletteKey = 'gray' | 'amber' | 'red' | 'darkred'
type LevelKey = 'j7' | 'j15' | 'j30'
type LevelState = { state: 'active' | 'sent' | 'disabled'; sentDate: string | null }

type ClientTarget = {
  facture_id: string
  chantier_id: string | null
}

/* ─────────────────────────── Constantes ────────────────────── */

const PALETTES: Record<PaletteKey, { row: string; badge: string; text: string }> = {
  gray:    { row: '',                               badge: 'bg-gray-500/10 text-gray-400',   text: 'text-gray-400'   },
  amber:   { row: 'border-l-2 border-amber-500/50', badge: 'bg-amber-500/10 text-amber-400', text: 'text-amber-400'  },
  red:     { row: 'border-l-2 border-red-500/50',   badge: 'bg-red-500/10 text-red-400',     text: 'text-red-400'    },
  darkred: { row: 'border-l-2 border-red-700/70',   badge: 'bg-red-900/20 text-red-300',     text: 'text-red-300'    },
}

const LEVEL_LABELS: Record<LevelKey, string> = { j7: 'J+7', j15: 'J+15', j30: '⚠️ J+30' }
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

function genMessage(niveau: LevelKey, f: Facture, ent: Entreprise): string {
  const clientNom = getEffectiveNom(f)
  const prenom    = clientNom.split(/\s+/).find(p => p.length > 2) ?? clientNom
  const ttcStr    = (f.montant_ttc ?? 0).toLocaleString('fr-FR')
  const entNom    = ent.nom || 'BTP Mali'

  if (niveau === 'j7') return [
    `Bonjour ${prenom} 👋`,
    '',
    `Nous vous rappelons que la facture *${f.numero}* d'un montant de *${ttcStr} FCFA* est arrivée à échéance depuis *7 jours*.`,
    '',
    `Veuillez trouver en pièce jointe notre avis de relance.`,
    '',
    `Merci de régulariser dans les meilleurs délais.`,
    '',
    `Modes de paiement :`,
    `💚 Wave | 🟠 Orange Money | 🏦 Virement`,
    '',
    `Merci pour votre confiance 🙏`,
    `— ${entNom}`,
  ].join('\n')

  if (niveau === 'j15') {
    const dj7 = dateJ7Sent(f.relances ?? [])
    return [
      `Bonjour ${prenom},`,
      '',
      `Malgré notre rappel${dj7 ? ` du ${dj7}` : ''}, la facture *${f.numero}* de *${ttcStr} FCFA* reste impayée depuis *15 jours*.`,
      '',
      `L'avis de relance est en pièce jointe.`,
      '',
      `Règlement requis sous *48 heures*.`,
      '',
      `— ${entNom}`,
    ].join('\n')
  }

  return [
    `⚠️ MISE EN DEMEURE ⚠️`,
    '',
    `${clientNom},`,
    '',
    `La facture *${f.numero}* de *${ttcStr} FCFA* est impayée depuis *30 jours*.`,
    '',
    `Document officiel en pièce jointe.`,
    '',
    `Sans règlement sous *72 heures*, une procédure de recouvrement sera engagée.`,
    '',
    `— ${entNom}`,
  ].join('\n')
}

/* ─────────────────────────── PDF (jsPDF) ────────────────────── */

async function generateAndDownloadPDF(params: {
  f: Facture
  niveau: LevelKey
  ent: Entreprise
  message: string
}): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { f, niveau, ent, message } = params
  const clientNom  = getEffectiveNom(f)
  const tel        = getEffectiveTel(f) ?? '—'
  const entNom     = ent.nom || 'BTP Mali'
  const joursRetard = retardJours(f.date_echeance)
  const montantDu  = Math.max(0, (f.montant_ttc ?? 0) - (f.montant_paye ?? 0))
  const ht         = f.montant_ht ?? 0
  const ttc        = f.montant_ttc ?? 0
  const tva        = Math.round(ht * 18 / 100)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210

  const orange: [number,number,number] = [249, 115, 22]
  const bg:     [number,number,number] = [17,  17,  17]
  const card:   [number,number,number] = [30,  30,  30]
  const gray:   [number,number,number] = [100, 116, 139]
  const white:  [number,number,number] = [255, 255, 255]
  const red:    [number,number,number] = [239, 68,  68]
  const titleClr: [number,number,number] = niveau === 'j30' ? red : niveau === 'j15' ? [248,113,113] : orange

  // ── fond
  doc.setFillColor(...bg); doc.rect(0, 0, W, 297, 'F')

  // ── bande orange gauche
  doc.setFillColor(...orange); doc.rect(0, 0, 4, 297, 'F')

  // ── header
  doc.setFillColor(...card); doc.rect(4, 0, W-4, 36, 'F')
  doc.setFillColor(...orange); doc.roundedRect(8, 5, 24, 26, 3, 3, 'F')
  doc.setTextColor(...white); doc.setFont('helvetica', 'bold')
  doc.setFontSize(8);  doc.text('BTP', 11.5, 16)
  doc.setFontSize(7);  doc.text('MALI', 11, 23)

  doc.setFontSize(14); doc.setTextColor(...white)
  doc.text(entNom, 36, 16)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...gray)
  doc.text('BTP Mali — Gestion de chantiers professionnelle', 36, 22)

  // titre + date
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...titleClr)
  const titleTxt = niveau === 'j30' ? 'MISE EN DEMEURE' : 'AVIS DE RELANCE'
  doc.text(titleTxt, W - 10, 14, { align: 'right' })
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...gray)
  doc.text(new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }), W - 10, 21, { align: 'right' })

  doc.setDrawColor(45,45,45); doc.setLineWidth(0.3); doc.line(4, 37, W, 37)

  // ── deux encadrés CLIENT + FACTURE
  const boxY = 42, boxH = 34
  // CLIENT
  doc.setFillColor(...card); doc.roundedRect(8, boxY, 90, boxH, 3, 3, 'F')
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...orange)
  doc.text('CLIENT', 13, boxY + 7)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...gray)
  doc.text('Nom :', 13, boxY + 15)
  doc.text('Tél :', 13, boxY + 22)
  doc.setTextColor(...white); doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  const nomLines = doc.splitTextToSize(clientNom, 58)
  doc.text(nomLines[0], 30, boxY + 15)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.text(tel, 30, boxY + 22)

  // FACTURE
  doc.setFillColor(...card); doc.roundedRect(102, boxY, 100, boxH, 3, 3, 'F')
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...orange)
  doc.text('FACTURE', 107, boxY + 7)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...gray); doc.setFontSize(7)
  doc.text('Numéro :', 107, boxY + 15)
  doc.text('Date émission :', 107, boxY + 22)
  doc.text('Date échéance :', 107, boxY + 28)
  doc.text('Retard :', 107, boxY + 34)
  doc.setTextColor(...white); doc.setFontSize(8)
  doc.text(f.numero, 135, boxY + 15)
  doc.text(f.date_emission ? new Date(f.date_emission).toLocaleDateString('fr-FR') : '—', 143, boxY + 22)
  doc.text(f.date_echeance ? new Date(f.date_echeance).toLocaleDateString('fr-FR') : '—', 143, boxY + 28)
  doc.setTextColor(...(joursRetard >= 30 ? red : joursRetard >= 15 ? [248,113,113] as [number,number,number] : orange))
  doc.setFont('helvetica', 'bold')
  doc.text(`${joursRetard} jours`, 122, boxY + 34)

  // ── tableau montants
  const tblY = boxY + boxH + 8
  doc.setFillColor(40, 40, 40); doc.rect(8, tblY, W - 16, 8, 'F')
  const cols = [64, 64, 66]
  const hdrs = ['Montant HT', 'TVA 18%', 'Total TTC']
  let cx = 10
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...gray)
  hdrs.forEach((h, i) => { doc.text(h, cx + cols[i]/2, tblY + 5.5, { align: 'center' }); cx += cols[i] })

  doc.setFillColor(25, 25, 25); doc.rect(8, tblY + 8, W - 16, 10, 'F')
  cx = 10
  const vals = [
    ht.toLocaleString('fr-FR') + ' FCFA',
    tva.toLocaleString('fr-FR') + ' FCFA',
    ttc.toLocaleString('fr-FR') + ' FCFA',
  ]
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white)
  vals.forEach((v, i) => { doc.text(v, cx + cols[i]/2, tblY + 14, { align: 'center' }); cx += cols[i] })

  // ── MONTANT DÛ
  const duY = tblY + 26
  doc.setFillColor(80, 10, 10); doc.roundedRect(8, duY, W - 16, 16, 3, 3, 'F')
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(252, 165, 165)
  doc.text('MONTANT DÛ', W / 2, duY + 6.5, { align: 'center' })
  doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(...red)
  doc.text(montantDu.toLocaleString('fr-FR') + ' FCFA', W / 2, duY + 14, { align: 'center' })

  // ── Message de relance
  doc.setDrawColor(40,40,40); doc.line(8, duY + 20, W - 8, duY + 20)
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...gray)
  doc.text('MESSAGE DE RELANCE', 10, duY + 27)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 200, 200); doc.setFontSize(8)
  const msgClean = message.replace(/\*/g, '')
  const msgLines = doc.splitTextToSize(msgClean, W - 20)
  let msgY = duY + 34
  for (const line of msgLines) {
    if (msgY > 240) { doc.text('…', 10, msgY); break }
    doc.text(line, 10, msgY); msgY += 5
  }

  // ── Modes de paiement
  const pmY = Math.max(msgY + 6, 248)
  doc.setDrawColor(40,40,40); doc.line(8, pmY - 3, W - 8, pmY - 3)
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...gray)
  doc.text('MODES DE PAIEMENT', 10, pmY + 3)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...white)
  doc.text('💚 Wave     🟠 Orange Money     🏦 Virement bancaire', 10, pmY + 10)
  if (ent.telephone) {
    doc.setTextColor(...gray); doc.setFontSize(7)
    doc.text(`Numéro : ${ent.telephone}`, 10, pmY + 16)
  }

  // ── Signature droite
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...orange)
  doc.text(entNom, W - 10, pmY + 3, { align: 'right' })
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...gray)
  if (ent.email) doc.text(ent.email, W - 10, pmY + 9, { align: 'right' })
  doc.text('BTP Mali — Gestion de chantiers professionnelle', W - 10, pmY + 15, { align: 'right' })

  // ── bande bas
  doc.setFillColor(...orange); doc.rect(0, 291, W, 6, 'F')
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...gray)
  doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} · Facture ${f.numero}`, W/2, 289.5, { align: 'center' })

  const dateStr = new Date().toISOString().split('T')[0]
  doc.save(`Relance_${f.numero}_${dateStr}.pdf`)
}

/* ──────────────────────────── Page ─────────────────────────── */

export default function CreancesPage() {
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

  // Modal client
  const [clientTarget, setClientTarget] = useState<ClientTarget | null>(null)
  const [clientNom, setClientNom]       = useState('')
  const [clientTel, setClientTel]       = useState('')
  const [clientEmail, setClientEmail]   = useState('')
  const [savingClient, setSavingClient] = useState(false)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: profile }, { data: facs }] = await Promise.all([
      supabase.from('profiles').select('entreprises(nom, telephone, email)').eq('id', user.id).single(),
      supabase
        .from('factures')
        .select(`*, chantiers(nom, client_nom, client_telephone, client_email),
          devis(chantier_id, chantiers(nom, client_nom, client_telephone, client_email)),
          relances(id, type, niveau, envoye_le)`)
        .neq('statut', 'paye')
        .order('date_echeance', { ascending: true }),
    ])

    if (profile?.entreprises) {
      const e = profile.entreprises as unknown as Entreprise
      setEntreprise({ nom: e.nom ?? '', telephone: e.telephone ?? null, email: e.email ?? null })
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

  /* ── Modal client ── */
  function openClientModal(f: Facture) {
    setClientTarget({ facture_id: f.id, chantier_id: getChantierID(f) })
    setClientNom(getEffectiveNom(f) !== f.numero ? getEffectiveNom(f) : '')
    setClientTel(getEffectiveTel(f) ?? '')
    setClientEmail(getEffectiveEmail(f) ?? '')
  }

  async function handleSaveClient() {
    if (!clientTarget || !clientNom.trim() || !clientTel.trim()) return
    setSavingClient(true)
    const updates = {
      client_nom:       clientNom.trim(),
      client_telephone: clientTel.trim(),
      client_email:     clientEmail.trim() || null,
    }
    const { error: e1 } = await supabase.from('factures').update(updates).eq('id', clientTarget.facture_id)
    if (e1) { showToast('Erreur : ' + e1.message, 'error'); setSavingClient(false); return }
    if (clientTarget.chantier_id) {
      await supabase.from('chantiers').update(updates).eq('id', clientTarget.chantier_id)
    }
    setSavingClient(false); setClientTarget(null)
    showToast('Client mis à jour ✅')
    await fetchData()
  }

  /* ── Paiement ── */
  async function marquerPaye() {
    if (!paiementTarget) return
    setPayant(true)
    await supabase.from('factures').update({ statut: 'paye', montant_paye: paiementTarget.montant_ttc }).eq('id', paiementTarget.id)
    setPayant(false); setPaiementTarget(null); await fetchData()
  }

  function toggleExpand(id: string) {
    setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const totalCreances = factures.reduce((a, f) => a + Math.max(0, (f.montant_ttc ?? 0) - (f.montant_paye ?? 0)), 0)
  const countByKey = (k: PaletteKey) => factures.filter(f => getPaletteKey(retardJours(f.date_echeance)) === k).length

  /* ── Rendu d'un bouton de niveau ── */
  function LevelBtn({ f, niveau }: { f: Facture; niveau: LevelKey }) {
    const jours  = retardJours(f.date_echeance)
    const ls     = getLevelState(niveau, jours, f.relances ?? [])
    const isLoading = loadingRelance === `${f.id}_${niveau}`

    const colors: Record<LevelKey, string> = {
      j7:  'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25',
      j15: 'bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25',
      j30: 'bg-red-900/25 border-red-700/50 text-red-200 hover:bg-red-900/40',
    }

    if (ls.state === 'disabled') return (
      <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border border-white/[0.04] bg-white/[0.02] opacity-40 select-none min-w-[70px]">
        <span className="text-[10px] font-bold text-gray-600">{LEVEL_LABELS[niveau]}</span>
        <span className="text-[9px] text-gray-700">Pas encore</span>
      </div>
    )

    if (ls.state === 'sent') return (
      <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border border-white/[0.05] bg-white/[0.02] min-w-[70px]">
        <span className="text-[10px] font-medium text-gray-500">{LEVEL_LABELS[niveau]}</span>
        <span className="text-[9px] text-emerald-600 font-medium">✓ {ls.sentDate ?? 'Envoyé'}</span>
      </div>
    )

    // Active
    return (
      <button
        onClick={() => handleRelance(f, niveau)}
        disabled={!!isLoading}
        className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border transition-all min-w-[70px] font-medium disabled:opacity-60 ${colors[niveau]}`}
      >
        {isLoading ? (
          <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <span className="text-[11px] font-bold">{LEVEL_LABELS[niveau]}</span>
        )}
        <span className="text-[9px] opacity-80">
          {isLoading ? 'PDF…' : niveau === 'j30' ? 'Mise en demeure' : 'Envoyer relance'}
        </span>
      </button>
    )
  }

  return (
    <div className="p-8">

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

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Créances & Relances</h1>
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
      <div className="grid grid-cols-4 gap-3 mb-6">
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
              const jours   = retardJours(f.date_echeance)
              const pkey    = getPaletteKey(jours)
              const palette = PALETTES[pkey]
              const restant = Math.max(0, (f.montant_ttc ?? 0) - (f.montant_paye ?? 0))
              const relances = f.relances ?? []
              const tel     = getEffectiveTel(f)
              const isWaInstr = waInstruction === f.id
              const nomClient = getEffectiveNom(f)
              const nomIsPlaceholder = nomClient === f.numero

              return (
                <div key={f.id} className={`px-6 py-5 hover:bg-white/[0.015] transition-colors ${palette.row}`}>
                  <div className="flex items-start justify-between gap-4">

                    {/* Gauche */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 bg-white/[0.04] rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`w-4 h-4 ${palette.text}`}>
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round"/>
                          <rect x="9" y="3" width="6" height="4" rx="1"/>
                          <path d="M9 12h6M9 16h4" strokeLinecap="round"/>
                        </svg>
                      </div>

                      <div className="min-w-0 flex-1">

                        {/* N° + retard */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white text-[14px] font-semibold">{f.numero}</p>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${palette.badge}`}>
                            {jours === 0 ? 'Pas encore échu' : `${jours}j de retard`}
                          </span>
                        </div>

                        {/* ── Encadré client ── */}
                        <div className="mt-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 text-orange-400 shrink-0">
                                <path d="M8 2a3 3 0 110 6 3 3 0 010-6zM2 14c0-3 2.5-5 6-5s6 2 6 5" strokeLinecap="round"/>
                              </svg>
                              {nomIsPlaceholder ? (
                                <button onClick={() => openClientModal(f)}
                                  className="text-[12px] text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1 transition-colors">
                                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3 h-3"><path d="M8 3v10M3 8h10" strokeLinecap="round"/></svg>
                                  Ajouter les infos client
                                </button>
                              ) : (
                                <p className="text-white text-[13px] font-semibold truncate">{nomClient}</p>
                              )}
                              {getChantierInfo(f)?.nom && (
                                <span className="text-gray-600 text-[11px] truncate">· {getChantierInfo(f)?.nom}</span>
                              )}
                            </div>
                            <button onClick={() => openClientModal(f)}
                              className="shrink-0 flex items-center gap-1 text-[10px] text-gray-600 hover:text-orange-400 transition-colors">
                              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3 h-3"><path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              Modifier
                            </button>
                          </div>
                          <div className="flex items-center gap-4 mt-1.5">
                            {tel ? (
                              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-3 h-3 text-emerald-500 shrink-0"><path d="M9.5 2.5s1.5.5 1.5 2.5-1.5 2.5-1.5 2.5M11 12.5c-5.5 0-7.5-5.5-7.5-5.5s0-1.5 1.5-1.5l1.5 3-1 1c.5 1 2 2 2 2l1-1 3 1.5c0 1.5-1.5 1.5-1.5 0z" strokeLinecap="round"/></svg>
                                {tel}
                              </span>
                            ) : (
                              <button onClick={() => openClientModal(f)}
                                className="flex items-center gap-1 text-[11px] text-orange-400 hover:text-orange-300 font-medium transition-colors">
                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3 h-3"><path d="M8 3v10M3 8h10" strokeLinecap="round"/></svg>
                                Ajouter téléphone
                              </button>
                            )}
                            {getEffectiveEmail(f) && (
                              <span className="text-[11px] text-gray-600 truncate">{getEffectiveEmail(f)}</span>
                            )}
                          </div>
                        </div>

                        {f.date_echeance && (
                          <p className="text-gray-700 text-[11px] mt-1.5">
                            Échéance : {new Date(f.date_echeance).toLocaleDateString('fr-FR')}
                          </p>
                        )}

                        {/* ── Zone relance ── */}
                        <div className="mt-3">
                          {jours === 0 ? (
                            <p className="text-[11px] text-gray-700 italic">Pas encore échu — aucune relance requise</p>
                          ) : jours < 7 ? (
                            <div className="flex items-center gap-2 bg-gray-500/[0.08] border border-gray-500/20 rounded-xl px-3 py-2">
                              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-gray-500 shrink-0"><path fillRule="evenodd" d="M8 1a7 7 0 100 14A7 7 0 008 1zM8 5a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 018 5zm0 7a1 1 0 100-2 1 1 0 000 2z"/></svg>
                              <p className="text-[12px] text-gray-500">
                                Relance disponible dans <span className="font-bold text-gray-400">{7 - jours} jour{7 - jours > 1 ? 's' : ''}</span>
                              </p>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-white/[0.07] overflow-hidden">

                              {/* Header */}
                              <div className="flex items-center justify-between px-3 py-2 bg-white/[0.025]">
                                <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3"><path d="M14 2H6a1.5 1.5 0 00-1.5 1.5v10A1.5 1.5 0 006 15h8a1.5 1.5 0 001.5-1.5v-10A1.5 1.5 0 0014 2z"/><path d="M8 5h4M8 8h4M8 11h2" strokeLinecap="round"/></svg>
                                  Relances — clic = PDF téléchargé + WhatsApp ouvert
                                </div>
                                <button
                                  onClick={() => setPreviewId(previewId === f.id ? null : f.id)}
                                  className="text-[10px] text-gray-600 hover:text-orange-400 transition-colors flex items-center gap-0.5"
                                >
                                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>
                                  {previewId === f.id ? 'Masquer' : 'Aperçu message'}
                                </button>
                              </div>

                              {/* Aperçu message */}
                              {previewId === f.id && (
                                <div className="px-3 py-3 bg-[#181818] border-t border-white/[0.05]">
                                  {/* Détermine le niveau actif pour l'aperçu */}
                                  {(() => {
                                    const niv = jours >= 30 ? 'j30' : jours >= 15 ? 'j15' : 'j7'
                                    return (
                                      <pre className="text-[11px] text-gray-300 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">
                                        {genMessage(niv as LevelKey, f, entreprise)}
                                      </pre>
                                    )
                                  })()}
                                </div>
                              )}

                              {/* ── Instruction PDF après WA ── */}
                              {isWaInstr && (
                                <div className="flex items-start gap-2 px-3 py-2.5 bg-emerald-500/[0.07] border-t border-emerald-600/20">
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/></svg>
                                  <p className="text-[12px] text-emerald-300 leading-relaxed">
                                    📎 Le PDF de relance vient d&apos;être téléchargé.{' '}
                                    <strong>Joignez-le à ce message WhatsApp avant d&apos;envoyer.</strong>
                                  </p>
                                </div>
                              )}

                              {/* ── 3 boutons de niveau ── */}
                              <div className="flex items-start gap-2 px-3 py-3 border-t border-white/[0.04] flex-wrap">
                                {(['j7', 'j15', 'j30'] as LevelKey[]).map(niv => (
                                  <LevelBtn key={niv} f={f} niveau={niv} />
                                ))}
                              </div>

                              {/* Historique */}
                              {relances.length > 0 && (
                                <div className="border-t border-white/[0.04]">
                                  <button
                                    onClick={() => toggleExpand(f.id)}
                                    className="w-full flex items-center justify-between px-3 py-2 text-[10px] text-gray-600 hover:text-gray-400 hover:bg-white/[0.02] transition-colors"
                                  >
                                    <span className="flex items-center gap-1">
                                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`w-3 h-3 transition-transform ${expanded.has(f.id) ? 'rotate-180' : ''}`}>
                                        <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                      Historique ({relances.length})
                                    </span>
                                    <span className="text-gray-700">
                                      {relances.filter(r => r.type === 'whatsapp').length} WA ·{' '}
                                      {relances.filter(r => r.niveau === 'j7').length} J+7 ·{' '}
                                      {relances.filter(r => r.niveau === 'j15').length} J+15 ·{' '}
                                      {relances.filter(r => r.niveau === 'j30').length} J+30
                                    </span>
                                  </button>
                                  {expanded.has(f.id) && (
                                    <div className="pb-2 px-3 space-y-1 bg-[#181818]">
                                      {[...relances]
                                        .sort((a, b) => new Date(b.envoye_le).getTime() - new Date(a.envoye_le).getTime())
                                        .map(r => (
                                          <div key={r.id} className="flex items-center gap-2 text-[10px] py-0.5">
                                            <span className="text-emerald-500">✓</span>
                                            <span className={`font-medium ${r.type === 'whatsapp' ? 'text-emerald-400' : r.type === 'email' ? 'text-blue-400' : 'text-gray-400'}`}>
                                              {r.type === 'whatsapp' ? '📱' : r.type === 'email' ? '📧' : '📋'}{' '}
                                              {{ j7: 'J+7', j15: 'J+15', j30: 'J+30' }[r.niveau]} — {new Date(r.envoye_le).toLocaleDateString('fr-FR')}
                                            </span>
                                          </div>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Droite : montant + payé */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-white text-[15px] font-bold">{fcfa(restant)}</p>
                        <p className="text-gray-700 text-[11px]">restant dû</p>
                      </div>
                      <button
                        onClick={() => setPaiementTarget(f)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-medium transition-colors"
                      >
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3 h-3">
                          <path d="M2 8l5 5L14 3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Payé
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal paiement ── */}
      {paiementTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setPaiementTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl p-6">
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

      {/* ── Modal client ── */}
      {clientTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setClientTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-white text-[15px] font-semibold">Informations client</h3>
                <p className="text-gray-600 text-[12px] mt-0.5">Mis à jour sur la facture et le chantier</p>
              </div>
              <button onClick={() => setClientTarget(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                  Nom complet du client <span className="text-orange-400">*</span>
                </label>
                <input
                  type="text"
                  value={clientNom}
                  onChange={e => setClientNom(e.target.value)}
                  placeholder="Ex: M. Traoré Amadou"
                  autoFocus
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                  Numéro WhatsApp <span className="text-orange-400">*</span>
                </label>
                <input
                  type="tel"
                  value={clientTel}
                  onChange={e => setClientTel(e.target.value)}
                  placeholder="+223 76 00 00 00"
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                  Email <span className="text-gray-700 normal-case font-normal">(optionnel)</span>
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                  placeholder="client@email.com"
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setClientTarget(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] font-medium">Annuler</button>
              <button
                onClick={handleSaveClient}
                disabled={savingClient || !clientNom.trim() || !clientTel.trim()}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingClient ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Enregistrement…</>
                ) : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
