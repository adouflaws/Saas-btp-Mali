'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PageSkeleton from '@/components/PageSkeleton'
import { useActionGuard } from '@/hooks/useActionGuard'
import PageTooltip from '@/components/PageTooltip'
import StatusBadge from '@/components/StatusBadge'
import { STATUTS_DEVIS, type DevisStatutKey } from '@/constants/statuts'
import { generateDocument } from '@/lib/pdf/generateDocument'

const supabase = createClient()

/* ─── Types ─────────────────────────────────────────── */

type DevisRow = {
  id: string
  numero: string
  statut: string | null
  montant_ht: number | null
  montant_ttc: number | null
  tva_taux: number | null
  date_emission: string | null
  date_validite: string | null
  notes: string | null
  chantier_id: string | null
  entreprise_id: string
  client_nom: string | null
  client_telephone: string | null
  token_signature: string | null
  date_signature: string | null
  signe_par: string | null
  chantiers: { nom: string; client_nom: string; ville: string | null; client_telephone: string | null; client_email: string | null } | null
}

type LigneDevisRow = {
  id: string
  designation: string
  unite: string | null
  quantite: number | null
  prix_unit: number | null
  total: number | null
  ordre: number | null
  categorie: string | null
}

type LigneForm = {
  _key: string
  designation: string
  unite: string
  quantite: string
  prix_unit: string
  categorie: string
}

type FormData = {
  chantier_id: string
  date_validite: string
  notes: string
  client_nom: string
  client_telephone: string
}

type Chantier = { id: string; nom: string; client_nom: string; ville: string | null; client_telephone: string | null }

type EntrepriseInfo = {
  nom: string
  adresse: string | null
  telephone: string | null
  email: string | null
  rccm: string | null
  nif: string | null
  logo_url: string | null
}

type OuvrierBiblio = {
  id: string
  nom: string
  prenom: string | null
  metier: string | null
  taux_journalier: number | null
}

type TarifPerso = {
  id: string
  designation: string
  prix: number
  unite: string | null
}

type ModeleDevis = {
  id: string
  nom: string
  created_at: string
  lignes: LigneForm[] | null
}

type BiblioTab = 'materiaux' | 'ouvriers' | 'engins' | 'tarifs'

/* ─── Constantes bibliothèque ────────────────────────── */

const MATERIAUX_BIBLIO = [
  { designation: 'Sac ciment 50kg',        unite: 'sac',    prix: 8000 },
  { designation: 'Tonne fer HA 12mm',       unite: 'tonne',  prix: 450000 },
  { designation: 'Tonne fer HA 8mm',        unite: 'tonne',  prix: 450000 },
  { designation: 'm³ gravier 15/25',        unite: 'm³',     prix: 25000 },
  { designation: 'm³ sable fin',            unite: 'm³',     prix: 18000 },
  { designation: 'Brique standard',         unite: 'unité',  prix: 350 },
  { designation: 'Tôle bac acier 3m',       unite: 'unité',  prix: 30000 },
  { designation: 'Sac plâtre',              unite: 'sac',    prix: 6000 },
  { designation: 'm² carrelage standard',   unite: 'm²',     prix: 8000 },
  { designation: 'm² carrelage premium',    unite: 'm²',     prix: 15000 },
  { designation: 'Litre peinture',          unite: 'L',      prix: 4500 },
  { designation: 'Tube PVC 100mm',          unite: 'unité',  prix: 3500 },
  { designation: 'Câble électrique 2.5mm',  unite: 'm',      prix: 2500 },
]

const ENGINS_BIBLIO = [
  { designation: 'Bétonnière',         unite: 'jour',    prix: 15000 },
  { designation: 'Camion benne',       unite: 'jour',    prix: 75000 },
  { designation: 'Échafaudage',        unite: 'semaine', prix: 25000 },
  { designation: 'Groupe électrogène', unite: 'jour',    prix: 20000 },
]

/* ─── Statuts ────────────────────────────────────────── */

// 'converti' est exclu : ce statut n'est jamais sélectionnable à la main,
// il n'est atteint qu'en passant par l'action "Facturer".
const STATUTS_DEVIS_SELECTABLES = (Object.entries(STATUTS_DEVIS) as [DevisStatutKey, typeof STATUTS_DEVIS[DevisStatutKey]][])
  .filter(([key]) => key !== 'converti')

const CATEGORIES_LIGNE = [
  { value: 'materiaux',   label: 'Matériaux' },
  { value: 'main_oeuvre', label: "Main d'œuvre" },
  { value: 'divers',      label: 'Divers' },
]

/* ─── Utilitaires ────────────────────────────────────── */

function fcfa(v: number | null) { return v ? v.toLocaleString('fr-FR') + ' FCFA' : '— FCFA' }
function newLigne(): LigneForm { return { _key: Math.random().toString(36).slice(2), designation: '', unite: '', quantite: '1', prix_unit: '', categorie: 'materiaux' } }
function ligneTotal(l: LigneForm) { return Math.round((Number(l.quantite) || 0) * (Number(l.prix_unit) || 0)) }

async function syncBudgetPrevisionnel(devisId: string, forceClear = false) {
  try {
    await fetch('/api/devis/sync-budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devis_id: devisId, forceClear }),
    })
  } catch (err) {
    console.error('Erreur synchronisation budget prévisionnel:', err)
  }
}


/* ─── Composant principal ────────────────────────────── */

type FiltreDevis = 'tous' | 'en_attente' | 'accepte' | 'refuse'
const FILTRES_DEVIS: { value: FiltreDevis; label: string }[] = [
  { value: 'tous', label: 'Tous' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'accepte', label: 'Acceptés' },
  { value: 'refuse', label: 'Refusés' },
]
function parseFiltreDevis(v: string | null): FiltreDevis {
  return v === 'en_attente' || v === 'accepte' || v === 'refuse' ? v : 'tous'
}

export default function DevisPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DevisPageInner />
    </Suspense>
  )
}

function DevisPageInner() {
  const { guard, isReadOnly } = useActionGuard()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filtre, setFiltre] = useState<FiltreDevis>(() => parseFiltreDevis(searchParams.get('filtre')))
  const entrepriseIdRef = useRef<string | null>(null)

  function changerFiltre(v: FiltreDevis) {
    setFiltre(v)
    router.push(v === 'tous' ? '/dashboard/devis' : `/dashboard/devis?filtre=${v}`, { scroll: false })
  }

  const [devisList, setDevisList] = useState<DevisRow[]>([])
  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [entrepriseId, setEntrepriseId] = useState<string | null>(null)
  const [entrepriseInfo, setEntrepriseInfo] = useState<EntrepriseInfo>({ nom: 'BTP Mali', adresse: null, telephone: null, email: null, rccm: null, nif: null, logo_url: null })
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  // Bibliothèque
  const [ouvriersBiblio, setOuvriersBiblio] = useState<OuvrierBiblio[]>([])
  const [tarifsPerso, setTarifsPerso] = useState<TarifPerso[]>([])
  const [showBibliotheque, setShowBibliotheque] = useState(false)
  const [biblioTab, setBiblioTab] = useState<BiblioTab>('materiaux')
  const [biblioLineIdx, setBiblioLineIdx] = useState(0)

  // Modèles
  const [showModeleChoice, setShowModeleChoice] = useState(false)
  const [showSaveModele, setShowSaveModele] = useState(false)
  const [showLoadModele, setShowLoadModele] = useState(false)
  const [modeles, setModeles] = useState<ModeleDevis[]>([])
  const [nomModele, setNomModele] = useState('')
  const [savingModele, setSavingModele] = useState(false)

  // Signature
  const [signatureTarget, setSignatureTarget] = useState<DevisRow | null>(null)
  const [signatureToken, setSignatureToken] = useState('')
  const [generatingToken, setGeneratingToken] = useState(false)

  // Modal devis
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>({ chantier_id: '', date_validite: '', notes: '', client_nom: '', client_telephone: '' })
  const [lignes, setLignes] = useState<LigneForm[]>([newLigne()])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [clientFromChantier, setClientFromChantier] = useState(false)

  // Modal statut
  const [statutTarget, setStatutTarget] = useState<DevisRow | null>(null)
  const [newStatut, setNewStatut] = useState('')
  const [updatingStatut, setUpdatingStatut] = useState(false)

  // Modal suppression
  const [deleteTarget, setDeleteTarget] = useState<DevisRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Modal convertir
  const [convertTarget, setConvertTarget] = useState<DevisRow | null>(null)
  const [converting, setConverting] = useState(false)

  /* ─── Fetch ─────────────────────────────────────────── */

  const fetchDevis = useCallback(async () => {
    const eid = entrepriseIdRef.current
    if (!eid) return
    const { data, error } = await supabase
      .from('devis')
      .select('*, chantiers(nom, client_nom, ville, client_telephone, client_email)')
      .eq('entreprise_id', eid)
      .order('created_at', { ascending: false })
    if (error) setPageError(error.message)
    else setDevisList((data ?? []) as DevisRow[])
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles').select('entreprise_id').eq('id', user.id).single()

      if (profile?.entreprise_id) {
        const eid = profile.entreprise_id
        setEntrepriseId(eid)
        entrepriseIdRef.current = eid

        const [entRes, chRes, ouvrRes, tarifsRes] = await Promise.all([
          supabase.from('entreprises').select('nom, adresse, telephone, email, rccm, nif, logo_url').eq('id', eid).single(),
          supabase.from('chantiers').select('id, nom, client_nom, ville, client_telephone').eq('entreprise_id', eid).order('nom'),
          supabase.from('ouvriers').select('id, nom, prenom, metier, taux_journalier').eq('actif', true).eq('entreprise_id', eid).order('nom'),
          supabase.from('tarifs_personnalises').select('*').eq('entreprise_id', eid).order('designation'),
        ])

        if (entRes.data) setEntrepriseInfo(entRes.data as EntrepriseInfo)
        setChantiers((chRes.data ?? []) as Chantier[])
        setOuvriersBiblio((ouvrRes.data ?? []) as OuvrierBiblio[])
        if (tarifsRes.error) {
          console.error('Erreur chargement tarifs:', tarifsRes.error)
          setTarifsPerso([])
        } else {
          setTarifsPerso((tarifsRes.data ?? []) as TarifPerso[])
        }
      }

      await fetchDevis()
      setLoading(false)
    }
    init()
  }, [fetchDevis])

  useEffect(() => {
    if (!showModal) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [showModal])

  /* ─── Actions modal devis ────────────────────────────── */

  function openNew() {
    setEditId(null)
    setForm({ chantier_id: '', date_validite: '', notes: '', client_nom: '', client_telephone: '' })
    setLignes([newLigne()])
    setFormError('')
    setClientFromChantier(false)
    setShowModal(true)
  }

  async function openEdit(d: DevisRow) {
    setEditId(d.id)
    setClientFromChantier(false)
    setForm({
      chantier_id: d.chantier_id ?? '',
      date_validite: d.date_validite ?? '',
      notes: d.notes ?? '',
      client_nom: d.client_nom ?? d.chantiers?.client_nom ?? '',
      client_telephone: d.client_telephone ?? d.chantiers?.client_telephone ?? '',
    })
    const { data: ligs } = await supabase.from('lignes_devis').select('*').eq('devis_id', d.id).order('ordre')
    setLignes((ligs ?? []).length > 0
      ? (ligs as LigneDevisRow[]).map(l => ({
          _key: l.id,
          designation: l.designation,
          unite: l.unite ?? '',
          quantite: String(l.quantite ?? ''),
          prix_unit: String(l.prix_unit ?? ''),
          categorie: l.categorie ?? 'materiaux',
        }))
      : [newLigne()])
    setFormError('')
    setShowModal(true)
  }

  const totalHT = lignes.reduce((acc, l) => acc + ligneTotal(l), 0)
  const totalTVA = Math.round(totalHT * 18 / 100)
  const totalTTC = totalHT + totalTVA

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const eid = entrepriseIdRef.current
    if (!eid) return
    if (lignes.every(l => !l.designation.trim())) { setFormError('Ajoutez au moins une ligne de devis.'); return }
    if (!form.client_nom.trim() || !form.client_telephone.trim()) {
      setFormError('Le nom et le téléphone du client sont obligatoires.')
      return
    }
    setSaving(true); setFormError('')

    const montant_ht_calcule = lignes.reduce((sum, l) => sum + Math.round((Number(l.quantite) || 0) * (Number(l.prix_unit) || 0)), 0)

    const today = new Date().toISOString().split('T')[0]

    let devisId = editId
    if (editId) {
      const { error } = await supabase.from('devis').update({
        chantier_id: form.chantier_id || null,
        entreprise_id: eid,
        montant_ht: montant_ht_calcule,
        date_validite: form.date_validite || null,
        notes: form.notes.trim() || null,
        client_nom: form.client_nom.trim(),
        client_telephone: form.client_telephone.trim(),
      }).eq('id', editId)
      if (error) { setFormError(error.message); setSaving(false); return }
      await supabase.from('lignes_devis').delete().eq('devis_id', editId)
    } else {
      // Retry jusqu'à 3 fois en cas de collision de numéro (23505)
      let devisInserted = false
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_next_document_number', {
          p_entreprise_id: eid,
          p_type: 'devis',
        })
        if (rpcError) {
          console.error('[devis] get_next_document_number erreur:', rpcError)
          setFormError('Impossible de générer le numéro de devis : ' + rpcError.message)
          setSaving(false); return
        }
        const numero = rpcData as string
        console.log(`[devis] tentative ${attempt} — numéro généré :`, numero)

        const { data, error } = await supabase.from('devis').insert({
          chantier_id: form.chantier_id || null,
          entreprise_id: eid,
          montant_ht: montant_ht_calcule,
          statut: 'brouillon',
          date_validite: form.date_validite || null,
          notes: form.notes.trim() || null,
          client_nom: form.client_nom.trim(),
          client_telephone: form.client_telephone.trim(),
          numero,
        }).select('id').single()

        if (error?.code === '23505') {
          console.warn(`[devis] collision 23505 sur numéro ${numero}, nouvelle tentative…`)
          if (attempt === 3) { setFormError('Erreur de numérotation persistante — réessayez.'); setSaving(false); return }
          continue
        }
        if (error) { setFormError(error.message); setSaving(false); return }
        devisId = data.id
        devisInserted = true
        break
      }
      if (!devisInserted) { setSaving(false); return }
    }

    const lignesPayload = lignes.filter(l => l.designation.trim()).map((l, i) => ({
      devis_id: devisId!,
      designation: l.designation.trim(),
      unite: l.unite.trim() || null,
      quantite: Number(l.quantite) || 1,
      prix_unit: Number(l.prix_unit) || 0,
      categorie: l.categorie || 'materiaux',
      ordre: i,
    }))
    if (lignesPayload.length > 0) {
      const { error } = await supabase.from('lignes_devis').insert(lignesPayload)
      if (error) { setFormError(error.message); setSaving(false); return }
    }

    setShowModal(false); setSaving(false); await fetchDevis()
    // Si ce devis est déjà accepté (ex: modification d'un devis accepté), régénère son budget prévisionnel
    if (devisId) await syncBudgetPrevisionnel(devisId)
  }

  /* ─── Bibliothèque de prix ───────────────────────────── */

  function openBibliotheque(idx: number) {
    setBiblioLineIdx(idx)
    setBiblioTab('ouvriers')
    setShowBibliotheque(true)
  }

  function selectFromBibliotheque(designation: string, unite: string, prix: number, categorie: string = 'materiaux') {
    setLignes(ls => ls.map((l, i) => i === biblioLineIdx
      ? { ...l, designation, unite, prix_unit: String(prix), categorie }
      : l))
    setShowBibliotheque(false)
  }

  /* ─── Modèles de devis ───────────────────────────────── */

  async function handleSaveModele(e: React.FormEvent) {
    e.preventDefault()
    const eid = entrepriseIdRef.current
    if (!nomModele.trim() || !eid) return
    setSavingModele(true)

    const lignesJson = lignes
      .filter(l => l.designation.trim())
      .map(l => ({
        designation: l.designation.trim(),
        unite: l.unite.trim() || '',
        quantite: l.quantite || '1',
        prix_unit: l.prix_unit || '0',
        categorie: l.categorie || 'materiaux',
      }))

    console.log('=== SAVE MODELE ===')
    console.log('Nom modele:', nomModele)
    console.log('Lignes:', lignes)
    console.log('Lignes JSON:', lignesJson)
    console.log('Entreprise ID:', eid)

    const { data, error } = await supabase
      .from('modeles_devis')
      .insert({ entreprise_id: eid, nom: nomModele.trim(), lignes: lignesJson })
      .select()

    console.log('Résultat:', data)
    console.log('Erreur:', error)
    if (error) console.error('Erreur complète:', JSON.stringify(error, null, 2))

    setSavingModele(false)
    setShowSaveModele(false)
    setNomModele('')
  }

  async function openLoadModele() {
    const eid = entrepriseIdRef.current
    if (!eid) return
    const { data, error } = await supabase
      .from('modeles_devis')
      .select('id, nom, created_at, lignes')
      .eq('entreprise_id', eid)
      .order('created_at', { ascending: false })
    console.log('Modèles trouvés:', data, 'Erreur:', error)
    setModeles((data ?? []) as ModeleDevis[])
    setShowLoadModele(true)
  }

  function handleLoadModele(modeleId: string) {
    const modele = modeles.find(m => m.id === modeleId)
    if (modele?.lignes && modele.lignes.length > 0) {
      setLignes(modele.lignes.map(l => ({
        _key: Math.random().toString(36).slice(2),
        designation: l.designation ?? '',
        unite: l.unite ?? '',
        quantite: String(l.quantite ?? '1'),
        prix_unit: String(l.prix_unit ?? '0'),
        categorie: l.categorie ?? 'materiaux',
      })))
    }
    setShowLoadModele(false)
  }

  /* ─── Signature électronique ─────────────────────────── */

  async function handleEnvoyerSignature(d: DevisRow) {
    setGeneratingToken(true)
    let token = d.token_signature
    if (!token) {
      token = crypto.randomUUID()
      await supabase.from('devis').update({ token_signature: token, statut: 'envoye' }).eq('id', d.id)
      await fetchDevis()
    }
    setSignatureToken(token)
    setSignatureTarget(d)
    setGeneratingToken(false)
  }

  /* ─── Autres handlers ────────────────────────────────── */

  async function handleStatut() {
    if (!statutTarget || !newStatut) return
    setUpdatingStatut(true)
    await supabase.from('devis').update({ statut: newStatut }).eq('id', statutTarget.id)
    await syncBudgetPrevisionnel(statutTarget.id)
    setStatutTarget(null); setUpdatingStatut(false); await fetchDevis()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from('lignes_devis').delete().eq('devis_id', deleteTarget.id)
    await supabase.from('devis').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null); setDeleting(false); await fetchDevis()
  }

  async function handleConvertir() {
    if (!convertTarget) return
    const eid = entrepriseIdRef.current
    if (!eid) return
    setConverting(true)

    const devis_id = convertTarget.id

    console.log('=== CONVERSION DEVIS → FACTURE ===')
    console.log('Devis ID:', devis_id)

    // Récupère le devis complet avec ses lignes
    const { data: devis, error: devisError } = await supabase
      .from('devis')
      .select('*, lignes_devis(*)')
      .eq('id', devis_id)
      .single()

    console.log('Devis récupéré:', devis)
    console.log('Erreur récupération:', devisError)

    if (devisError || !devis) {
      alert('Devis introuvable')
      setConverting(false)
      return
    }

    // Génère le numéro de facture
    const { data: numero, error: numeroError } = await supabase.rpc(
      'get_next_document_number',
      { p_entreprise_id: eid, p_type: 'facture' }
    )

    console.log('Numéro facture généré:', numero)
    console.log('Erreur numéro:', numeroError)

    if (numeroError || !numero) {
      alert('Erreur génération numéro facture')
      setConverting(false)
      return
    }

    const ht = devis.montant_ht ?? 0
    const tva = Math.round(ht * (devis.tva_taux ?? 18) / 100)
    const ttc = ht + tva

    // Crée la facture
    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .insert({
        numero,
        chantier_id: devis.chantier_id,
        entreprise_id: eid,
        devis_id: devis.id,
        montant_ht: ht,
        tva_taux: devis.tva_taux ?? 18,
        montant_ttc: ttc,
        montant_paye: 0,
        client_nom: devis.client_nom ?? null,
        client_telephone: devis.client_telephone ?? null,
        client_email: null,
        statut: 'en_attente',
        date_emission: new Date().toISOString().split('T')[0],
        date_echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      })
      .select()
      .single()

    console.log('Facture créée:', facture)
    console.log('Erreur création facture:', factureError)

    if (factureError) {
      console.error('Erreur complète:', JSON.stringify(factureError, null, 2))
      alert('Erreur: ' + factureError.message)
      setConverting(false)
      return
    }

    // Copie les lignes du devis vers la facture
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lignesDevis = (devis as any).lignes_devis ?? []
    if (lignesDevis.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lignesFacture = lignesDevis.map((ligne: any) => ({
        facture_id: facture.id,
        designation: ligne.designation,
        unite: ligne.unite,
        quantite: ligne.quantite,
        prix_unitaire: ligne.prix_unit,
      }))
      const { error: lignesError } = await supabase.from('lignes_factures').insert(lignesFacture)
      console.log('Erreur copie lignes:', lignesError)
    }

    // Met à jour le statut du devis
    await supabase.from('devis').update({ statut: 'converti' }).eq('id', devis_id)

    console.log('SUCCESS: Facture créée avec succès !')
    setConvertTarget(null)
    setConverting(false)
    router.push('/dashboard/factures')
  }

  async function getPDFLignes(devisId: string): Promise<LigneDevisRow[]> {
    const { data } = await supabase.from('lignes_devis').select('*').eq('devis_id', devisId).order('ordre')
    return (data ?? []) as LigneDevisRow[]
  }

  /* ─── Stats ──────────────────────────────────────────── */

  const totalDevisHT = devisList.reduce((acc, d) => acc + (d.montant_ht ?? 0), 0)
  const acceptes = devisList.filter(d => d.statut === 'accepte').length
  // Aligné sur la définition du filtre "En attente" (même sens partout : envoyé, en attente de réponse client)
  const enAttente = devisList.filter(d => d.statut === 'envoye').length

  const devisFiltres = devisList.filter(d => {
    if (filtre === 'en_attente') return d.statut === 'envoye'
    if (filtre === 'accepte') return d.statut === 'accepte'
    if (filtre === 'refuse') return d.statut === 'refuse'
    return true
  })

  /* ─── Render ─────────────────────────────────────────── */

  // Suppress unused variable warning - entrepriseId used as dependency guard
  void entrepriseId

  if (loading) return <PageSkeleton />

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <PageTooltip pageKey="devis" message="Créez des devis professionnels en FCFA. Utilisez la bibliothèque de prix pour aller plus vite." />
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Devis</h1>
          <p className="text-gray-500 text-sm mt-1">Création et suivi de vos devis clients</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <Link href="/dashboard/factures"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white hover:border-white/[0.15] text-[13px] font-medium transition-colors w-full sm:w-auto">
            Voir les factures
          </Link>
          <button onClick={() => guard(openNew)}
            className={`flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors w-full sm:w-auto ${isReadOnly ? 'opacity-60' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Nouveau devis
          </button>
        </div>
      </div>

      {pageError && (
        <div className="mb-5 flex items-center gap-2 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>
          {pageError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total devis', value: devisList.length, color: 'text-white', bg: 'bg-white/[0.05]' },
          { label: 'Acceptés', value: acceptes, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'En attente', value: enAttente, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        ].map(s => (
          <div key={s.label} className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 flex items-center gap-3">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center`}>
              <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
            </div>
            <div>
              <p className="text-gray-400 text-[12px]">{s.label}</p>
              {s.label === 'Total devis' && !loading && (
                <p className="text-gray-600 text-[11px]">{fcfa(totalDevisHT)} HT total</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Liste devis */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-white">
            Liste des devis
            {!loading && <span className="ml-2 text-gray-600 text-[13px] font-normal">({devisFiltres.length})</span>}
          </h2>
          <div className="flex gap-1.5 overflow-x-auto">
            {FILTRES_DEVIS.map(f => (
              <button key={f.value} onClick={() => changerFiltre(f.value)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                  filtre === f.value
                    ? 'bg-orange-500 text-white'
                    : 'bg-transparent border border-white/[0.12] text-gray-400 hover:text-white hover:border-white/[0.25]'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          </div>
        ) : devisFiltres.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-orange-400"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinejoin="round"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round"/></svg>
            </div>
            <p className="text-white text-[14px] font-medium mb-1">
              {devisList.length === 0 ? 'Aucun devis' : 'Aucun devis pour ce filtre'}
            </p>
            {devisList.length === 0 && <p className="text-gray-600 text-[12px]">Créez votre premier devis</p>}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {devisFiltres.map(d => {
              const canEdit = ['brouillon'].includes(d.statut ?? '')
              const canConvert = d.statut === 'accepte'
              const canSign = ['brouillon', 'envoye'].includes(d.statut ?? '')
              return (
                <div key={d.id} className="px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition-colors">
                  {/* Ligne info */}
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-white/[0.04] rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-gray-500"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinejoin="round"/><path d="M14 2v6h6" strokeLinecap="round"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white text-[14px] font-semibold whitespace-nowrap">{d.numero}</p>
                            <StatusBadge type="devis" statut={d.statut} />
                            {d.date_signature && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 whitespace-nowrap">
                                Signé — {d.signe_par}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-[12px] mt-0.5 truncate">
                            {d.chantiers?.client_nom ?? '—'}{d.chantiers?.nom ? ` · ${d.chantiers.nom}` : ''}
                          </p>
                          {d.date_emission && (
                            <p className="text-gray-700 text-[11px] mt-0.5">
                              Émis le {new Date(d.date_emission).toLocaleDateString('fr-FR')}
                              {d.date_validite && ` · Valide jusqu'au ${new Date(d.date_validite).toLocaleDateString('fr-FR')}`}
                            </p>
                          )}
                        </div>
                        <div className="text-right hidden sm:block shrink-0 ml-2">
                          <p className="text-white text-[14px] font-bold whitespace-nowrap tabular-nums">{fcfa(d.montant_ttc)}</p>
                          <p className="text-gray-700 text-[11px] whitespace-nowrap">TTC · HT {fcfa(d.montant_ht)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ligne actions */}
                  <div className="mt-2.5 ml-12 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {canSign && (
                        <button
                          onClick={() => handleEnvoyerSignature(d)}
                          disabled={generatingToken}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[11px] font-medium transition-colors"
                        >
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
                            <path d="M14 1L1 6l5 3 6-5-5 6 3 5z" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Signer
                        </button>
                      )}
                      <button onClick={() => { setStatutTarget(d); setNewStatut(d.statut ?? 'brouillon') }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-white text-[11px] font-medium transition-colors">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1.5" strokeLinecap="round"/></svg>
                        Statut
                      </button>
                      <button onClick={async () => {
                          const ligs = await getPDFLignes(d.id)
                          const ht = d.montant_ht ?? 0
                          const tva_taux = d.tva_taux ?? 18
                          const tva = Math.round(ht * tva_taux / 100)
                          await generateDocument({
                            type: 'devis',
                            entreprise: entrepriseInfo,
                            numero: d.numero,
                            date_emission: d.date_emission,
                            date_validite: d.date_validite,
                            client_nom: d.client_nom ?? d.chantiers?.client_nom ?? null,
                            tva_taux,
                            ht,
                            tva,
                            ttc: ht + tva,
                            notes: d.notes,
                            lignes: ligs
                              .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
                              .map(l => ({
                                designation: l.designation,
                                unite: l.unite,
                                quantite: l.quantite ?? 0,
                                prix_unit: l.prix_unit ?? 0,
                                total: l.total ?? Math.round((l.quantite ?? 0) * (l.prix_unit ?? 0)),
                              })),
                          })
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-white transition-colors" title="Télécharger PDF">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M8 2v8M5 7l3 3 3-3M3 12h10" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      {canEdit && (
                        <button onClick={() => guard(() => openEdit(d))}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-white transition-colors" title="Modifier">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5"><path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      )}
                      {canConvert && (
                        <button onClick={() => setConvertTarget(d)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-medium transition-colors">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3"><path d="M2 8h10M9 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Facturer
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => guard(() => setDeleteTarget(d))}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors" title="Supprimer">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8L13 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      )}
                    </div>
                    <p className="text-white text-[13px] font-bold whitespace-nowrap tabular-nums sm:hidden">{fcfa(d.montant_ttc)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal formulaire devis ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-3xl bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl max-h-[92vh] flex flex-col">
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] shrink-0">
              <h2 className="text-[15px] font-semibold text-white">{editId ? 'Modifier le devis' : 'Nouveau devis'}</h2>
              <div className="flex items-center gap-2">
                <button type="button" onClick={openLoadModele}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] text-gray-400 hover:text-white text-[12px] font-medium transition-colors">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M5 7h6M5 10h4" strokeLinecap="round"/></svg>
                  Utiliser un modèle
                </button>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M2 2l12 12M14 2L2 14" strokeLinecap="round"/></svg>
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              <form id="devis-form" onSubmit={handleSave} className="px-6 py-5 space-y-5">
                {formError && <div className="bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">{formError}</div>}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Chantier <span className="text-orange-400">*</span></label>
                    {chantiers.length === 0
                      ? <p className="text-amber-400 text-[12px]">Aucun chantier. <Link href="/dashboard/chantiers" className="underline">Créer</Link></p>
                      : <select value={form.chantier_id} onChange={e => {
                            const cid = e.target.value
                            const ch = chantiers.find(c => c.id === cid)
                            const hasClient = !!(ch?.client_nom || ch?.client_telephone)
                            setClientFromChantier(hasClient)
                            setForm(f => ({
                              ...f,
                              chantier_id: cid,
                              client_nom: ch?.client_nom || f.client_nom,
                              client_telephone: ch?.client_telephone || f.client_telephone,
                            }))
                          }} required
                          className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all">
                          <option value="" disabled>— Sélectionner un chantier —</option>
                          {chantiers.map(c => <option key={c.id} value={c.id}>{c.nom} — {c.client_nom}</option>)}
                        </select>}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Date validité</label>
                    <input type="date" value={form.date_validite} onChange={e => setForm(f => ({ ...f, date_validite: e.target.value }))}
                      className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Notes</label>
                    <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Conditions particulières…"
                      className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all" />
                  </div>
                </div>

                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Nom du client <span className="text-orange-400">*</span></label>
                      <input type="text" value={form.client_nom} onChange={e => { setForm(f => ({ ...f, client_nom: e.target.value })); setClientFromChantier(false) }} required
                        placeholder="Ex: Mamadou Konaté"
                        className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Téléphone WhatsApp du client <span className="text-orange-400">*</span></label>
                      <input type="tel" value={form.client_telephone} onChange={e => { setForm(f => ({ ...f, client_telephone: e.target.value })); setClientFromChantier(false) }} required
                        placeholder="Ex: +223 76 XX XX XX"
                        className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all" />
                    </div>
                  </div>
                  {clientFromChantier && (
                    <p className="text-emerald-400/70 text-[11px] mt-1.5 flex items-center gap-1.5">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3 h-3 shrink-0"><path d="M2 8l4 4 8-8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Informations récupérées depuis le chantier
                    </p>
                  )}
                </div>

                {/* Lignes de devis */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Lignes de devis</label>
                    <button type="button" onClick={() => setLignes(l => [...l, newLigne()])}
                      className="flex items-center gap-1.5 text-orange-400 hover:text-orange-300 text-[12px] font-medium transition-colors">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M8 3v10M3 8h10" strokeLinecap="round"/></svg>
                      Ajouter une ligne
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                  <div className="min-w-[520px]">
                  <div className="grid gap-2 mb-2 px-1" style={{ gridTemplateColumns: '2.4fr 1fr 80px 110px 110px 100px 28px' }}>
                    {['Désignation', 'Unité', 'Qté', 'Prix unit. (FCFA)', 'Catégorie', 'Total HT', ''].map(h => (
                      <span key={h} className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">{h}</span>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {lignes.map((l, i) => {
                      const tot = ligneTotal(l)
                      return (
                        <div key={l._key} className="grid gap-2 items-start" style={{ gridTemplateColumns: '2.4fr 1fr 80px 110px 110px 100px 28px' }}>
                          <div>
                            <input value={l.designation}
                              onChange={e => setLignes(ls => ls.map((x, j) => j === i ? { ...x, designation: e.target.value } : x))}
                              placeholder="Ex: Béton armé B25" required={i === 0}
                              className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-orange-500 transition-all" />
                            <button
                              type="button"
                              onClick={() => { setBiblioLineIdx(i); setShowBibliotheque(true) }}
                              className="text-xs text-orange-400 hover:text-orange-300 whitespace-nowrap flex items-center gap-1 mt-1">
                              📚 Bibliothèque
                            </button>
                          </div>
                          <input value={l.unite} onChange={e => setLignes(ls => ls.map((x, j) => j === i ? { ...x, unite: e.target.value } : x))}
                            placeholder="m³"
                            className="bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-orange-500 transition-all" />
                          <input type="number" min="1" value={l.quantite === '' ? '' : (l.quantite || '1')} onChange={e => setLignes(ls => ls.map((x, j) => j === i ? { ...x, quantite: e.target.value } : x))}
                            placeholder="1"
                            className="bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-orange-500 transition-all" />
                          <input type="number" min="0" value={l.prix_unit} onChange={e => setLignes(ls => ls.map((x, j) => j === i ? { ...x, prix_unit: e.target.value } : x))}
                            placeholder="0"
                            className="bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-orange-500 transition-all" />
                          <select value={l.categorie} onChange={e => setLignes(ls => ls.map((x, j) => j === i ? { ...x, categorie: e.target.value } : x))}
                            className="bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-2 py-2 text-[12px] focus:outline-none focus:border-orange-500 transition-all">
                            {CATEGORIES_LIGNE.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                          <div className="bg-white/[0.04] rounded-xl px-3 py-2 text-[13px] text-gray-300 font-medium text-right">
                            {tot.toLocaleString('fr-FR')}
                          </div>
                          <button type="button" onClick={() => setLignes(ls => ls.filter((_, j) => j !== i))}
                            disabled={lignes.length === 1}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path d="M3 8h10" strokeLinecap="round"/></svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  </div>
                  </div>
                </div>

                {/* Totaux */}
                <div className="flex justify-end">
                  <div className="w-64 bg-[#1C1C1C] rounded-2xl border border-white/[0.08] overflow-hidden">
                    {[
                      { label: 'Sous-total HT', value: totalHT },
                      { label: 'TVA 18%', value: totalTVA },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center px-4 py-2.5 border-b border-white/[0.06]">
                        <span className="text-gray-500 text-[12px]">{r.label}</span>
                        <span className="text-gray-300 text-[13px] font-medium">{r.value.toLocaleString('fr-FR')} FCFA</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center px-4 py-3 bg-orange-500/10">
                      <span className="text-orange-400 text-[13px] font-semibold">TOTAL TTC</span>
                      <span className="text-orange-400 text-[15px] font-bold">{totalTTC.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/[0.06] flex gap-3 shrink-0">
              <button type="button" onClick={() => setShowModeleChoice(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white text-[12px] font-medium transition-colors shrink-0">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V2zM5 2v4h6V2M10 10H6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Modèle
              </button>
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white text-[13px] font-medium transition-colors">Annuler</button>
              <button type="submit" form="devis-form" disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Enregistrement…</> : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal bibliothèque de prix ── */}
      {showBibliotheque && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowBibliotheque(false)} />
          <div className="relative w-full max-w-2xl bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
              <h3 className="text-[15px] font-semibold text-white">Bibliothèque de prix</h3>
              <button onClick={() => setShowBibliotheque(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M2 2l12 12M14 2L2 14" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/[0.06] px-6 shrink-0">
              {([
                { key: 'ouvriers' as BiblioTab, label: 'Mes ouvriers' },
                { key: 'materiaux' as BiblioTab, label: 'Matériaux' },
                { key: 'engins' as BiblioTab, label: 'Engins' },
                { key: 'tarifs' as BiblioTab, label: 'Mes tarifs' },
              ]).map(tab => (
                <button key={tab.key} onClick={() => setBiblioTab(tab.key)}
                  className={`px-4 py-3 text-[13px] font-medium border-b-2 transition-colors ${biblioTab === tab.key ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1">
              {biblioTab === 'materiaux' && (
                <div className="divide-y divide-white/[0.04]">
                  {MATERIAUX_BIBLIO.map(item => (
                    <button key={item.designation} type="button"
                      onClick={() => selectFromBibliotheque(item.designation, item.unite, item.prix, 'materiaux')}
                      className="w-full flex items-center justify-between px-6 py-3 hover:bg-white/[0.04] transition-colors text-left">
                      <div>
                        <span className="text-white text-[13px]">{item.designation}</span>
                        <span className="text-gray-600 text-[11px] ml-2">/ {item.unite}</span>
                      </div>
                      <span className="text-orange-400 text-[13px] font-medium shrink-0">{item.prix.toLocaleString('fr-FR')} FCFA</span>
                    </button>
                  ))}
                </div>
              )}

              {biblioTab === 'engins' && (
                <div className="divide-y divide-white/[0.04]">
                  {ENGINS_BIBLIO.map(item => (
                    <button key={item.designation} type="button"
                      onClick={() => selectFromBibliotheque(item.designation, item.unite, item.prix, 'divers')}
                      className="w-full flex items-center justify-between px-6 py-3 hover:bg-white/[0.04] transition-colors text-left">
                      <div>
                        <span className="text-white text-[13px]">{item.designation}</span>
                        <span className="text-gray-600 text-[11px] ml-2">/ {item.unite}</span>
                      </div>
                      <span className="text-orange-400 text-[13px] font-medium shrink-0">{item.prix.toLocaleString('fr-FR')} FCFA</span>
                    </button>
                  ))}
                </div>
              )}

              {biblioTab === 'ouvriers' && (
                <div className="divide-y divide-white/[0.04]">
                  {ouvriersBiblio.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                      <p className="text-gray-500 text-[13px]">Aucun ouvrier actif</p>
                      <p className="text-gray-700 text-[11px] mt-1">Ajoutez des ouvriers dans le module Équipes</p>
                    </div>
                  ) : ouvriersBiblio.map(o => (
                    <button key={o.id} type="button"
                      onClick={() => selectFromBibliotheque(
                        `Main d'œuvre - ${o.metier ?? 'Ouvrier'}`,
                        'jour',
                        o.taux_journalier ?? 0,
                        'main_oeuvre'
                      )}
                      className="w-full flex items-center justify-between px-6 py-3 hover:bg-white/[0.04] transition-colors text-left">
                      <div>
                        <span className="text-white text-[13px]">{o.prenom} {o.nom}</span>
                        <span className="text-gray-500 text-[11px] ml-2">{o.metier ?? '—'}</span>
                      </div>
                      <span className="text-orange-400 text-[13px] font-medium shrink-0">
                        {(o.taux_journalier ?? 0).toLocaleString('fr-FR')} FCFA/j
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {biblioTab === 'tarifs' && (
                <div className="divide-y divide-white/[0.04]">
                  {tarifsPerso.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                      <p className="text-gray-500 text-[13px]">Aucun tarif personnalisé</p>
                      <Link href="/dashboard/parametres" onClick={() => setShowBibliotheque(false)}
                        className="text-orange-400 text-[12px] mt-1 hover:underline">
                        Configurer dans les Paramètres →
                      </Link>
                    </div>
                  ) : tarifsPerso.map(t => (
                    <button key={t.id} type="button"
                      onClick={() => selectFromBibliotheque(t.designation, t.unite ?? '', t.prix, 'divers')}
                      className="w-full flex items-center justify-between px-6 py-3 hover:bg-white/[0.04] transition-colors text-left">
                      <div>
                        <span className="text-white text-[13px]">{t.designation}</span>
                        {t.unite && <span className="text-gray-600 text-[11px] ml-2">/ {t.unite}</span>}
                      </div>
                      <span className="text-orange-400 text-[13px] font-medium shrink-0">{(t.prix ?? 0).toLocaleString('fr-FR')} FCFA</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal choix modèle ── */}
      {showModeleChoice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModeleChoice(false)} />
          <div className="relative w-full max-w-xs bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white text-[15px] font-semibold">Modèles de devis</h3>
              <button onClick={() => setShowModeleChoice(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M2 2l12 12M14 2L2 14" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => { setShowModeleChoice(false); setShowSaveModele(true) }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/[0.08] hover:border-orange-500/50 hover:bg-orange-500/[0.06] transition-colors text-left group">
                <span className="text-2xl">💾</span>
                <div>
                  <p className="text-white text-[13px] font-semibold">Sauvegarder comme modèle</p>
                  <p className="text-gray-600 text-[11px] mt-0.5">Enregistrer les lignes actuelles</p>
                </div>
              </button>
              <button
                onClick={() => { setShowModeleChoice(false); openLoadModele() }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/[0.08] hover:border-orange-500/50 hover:bg-orange-500/[0.06] transition-colors text-left group">
                <span className="text-2xl">📂</span>
                <div>
                  <p className="text-white text-[13px] font-semibold">Utiliser un modèle existant</p>
                  <p className="text-gray-600 text-[11px] mt-0.5">Charger un modèle enregistré</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal sauvegarder modèle ── */}
      {showSaveModele && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSaveModele(false)} />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <h3 className="text-white text-[15px] font-semibold mb-1">Sauvegarder comme modèle</h3>
            <p className="text-gray-600 text-[12px] mb-4">Ce modèle pourra être rechargé dans un futur devis</p>
            <form onSubmit={handleSaveModele}>
              <input autoFocus required
                type="text" value={nomModele}
                onChange={e => setNomModele(e.target.value)}
                placeholder="Ex: Villa 3 chambres, Clôture standard…"
                className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all mb-4"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowSaveModele(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] font-medium transition-colors hover:text-white">Annuler</button>
                <button type="submit" disabled={savingModele}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60">
                  {savingModele ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal charger modèle ── */}
      {showLoadModele && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLoadModele(false)} />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h3 className="text-white text-[14px] font-semibold">Utiliser un modèle</h3>
              <button onClick={() => setShowLoadModele(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M2 2l12 12M14 2L2 14" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {modeles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <p className="text-gray-500 text-[13px]">Aucun modèle sauvegardé</p>
                  <p className="text-gray-700 text-[11px] mt-1">Créez un devis puis cliquez &quot;Modèle&quot;</p>
                </div>
              ) : modeles.map(m => (
                <button key={m.id} type="button"
                  onClick={() => handleLoadModele(m.id)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-orange-500/10 rounded-lg flex items-center justify-center">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 text-orange-400">
                        <rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M5 7h6M5 10h4" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <span className="text-white text-[13px]">{m.nom}</span>
                  </div>
                  <span className="text-gray-600 text-[11px]">{new Date(m.created_at).toLocaleDateString('fr-FR')}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal signature électronique ── */}
      {signatureTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSignatureTarget(null)} />
          <div className="relative w-full max-w-md bg-[#232323] rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-[15px] font-semibold">Lien de signature</h3>
              <button onClick={() => setSignatureTarget(null)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M2 2l12 12M14 2L2 14" strokeLinecap="round"/></svg>
              </button>
            </div>

            <div className="bg-[#1C1C1C] rounded-xl border border-white/[0.06] p-4 mb-4">
              <p className="text-gray-500 text-[11px] uppercase tracking-wider mb-2">Lien à envoyer au client</p>
              <p className="text-white text-[11px] break-all font-mono leading-relaxed">
                {typeof window !== 'undefined' ? window.location.origin : 'https://saas-btp-mali.vercel.app'}/signature/{signatureToken}
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/signature/${signatureToken}`
                  navigator.clipboard.writeText(url)
                }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.08] text-gray-300 hover:text-white hover:border-white/[0.2] text-[13px] font-medium transition-colors"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                  <rect x="5" y="5" width="9" height="9" rx="1" strokeLinejoin="round"/>
                  <path d="M11 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h2" strokeLinejoin="round"/>
                </svg>
                Copier le lien
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-dessous le devis ${signatureTarget.numero} à signer en ligne :\n${typeof window !== 'undefined' ? window.location.origin : 'https://saas-btp-mali.vercel.app'}/signature/${signatureToken}\n\nMontant TTC : ${(signatureTarget.montant_ttc ?? 0).toLocaleString('fr-FR')} FCFA\n\nCordialement,\n${entrepriseInfo.nom}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/20 text-[13px] font-medium transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Envoyer par WhatsApp
              </a>
            </div>

            <p className="text-gray-700 text-[11px] text-center mt-3">
              Le client accepte ou refuse en cliquant sur le lien. Vous recevrez une notification WhatsApp.
            </p>
          </div>
        </div>
      )}

      {/* ── Modal changement statut ── */}
      {statutTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) setStatutTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="sm:hidden flex justify-center -mt-3 mb-3"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <h3 className="text-white text-[15px] font-semibold mb-1">Changer le statut</h3>
            <p className="text-gray-600 text-[12px] mb-4">{statutTarget.numero}</p>
            <div className="space-y-2 mb-5">
              {STATUTS_DEVIS_SELECTABLES.map(([key, def]) => (
                <button key={key} onClick={() => setNewStatut(key)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${newStatut === key ? 'border-orange-500 bg-orange-500/10' : 'border-white/[0.06] hover:border-white/[0.12]'}`}>
                  <span className="text-white text-[13px]">{def.label}</span>
                  <StatusBadge type="devis" statut={key} />
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStatutTarget(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] font-medium transition-colors">Annuler</button>
              <button onClick={handleStatut} disabled={updatingStatut}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60">
                {updatingStatut ? 'Mise à jour…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal convertir en facture ── */}
      {convertTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) setConvertTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="sm:hidden flex justify-center -mt-3 mb-3"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <div className="w-11 h-11 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-emerald-400"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4" strokeLinecap="round"/></svg>
            </div>
            <h3 className="text-white text-[15px] font-semibold text-center mb-2">Convertir en facture ?</h3>
            <p className="text-gray-500 text-[13px] text-center mb-1">
              <span className="text-white font-medium">{convertTarget.numero}</span> → une facture sera créée
            </p>
            <p className="text-emerald-400 text-[14px] font-bold text-center mb-5">{fcfa(convertTarget.montant_ttc)}</p>
            <div className="flex gap-3">
              <button onClick={() => setConvertTarget(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] font-medium">Annuler</button>
              <button onClick={handleConvertir} disabled={converting}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {converting ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Création…</> : 'Créer la facture'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal suppression ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null) }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl p-6">
            <div className="sm:hidden flex justify-center -mt-3 mb-3"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <h3 className="text-white text-[15px] font-semibold text-center mb-2">Supprimer le devis ?</h3>
            <p className="text-gray-500 text-[13px] text-center mb-5">
              <span className="text-white font-medium">{deleteTarget.numero}</span> et toutes ses lignes seront supprimés.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-[13px] font-medium">Annuler</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
