'use client'

import { use, useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { createBrowserClient } from '@supabase/ssr'
import { useActionGuard } from '@/hooks/useActionGuard'
import StatusBadge, { statutBarClass } from '@/components/StatusBadge'

const supabase = createClient()
const PORTAL_BASE = 'https://saas-btp-mali.vercel.app/portail'

/* ─── Types ─────────────────────────────────────────── */

type Chantier = {
  id: string
  nom: string
  client_nom: string
  client_telephone: string | null
  ville: string | null
  statut: string | null
  avancement: number | null
  date_debut: string | null
  date_fin_prevue: string | null
  portail_actif: boolean | null
  budget_prevu: number | null
}

type Tache = { id: string; nom: string; statut: string | null; avancement: number | null }
type Jalon = { id: string; nom: string; date_prevue: string; atteint: boolean | null }
type Photo = { id: string; url: string; nom: string | null; legende: string | null; prise_le: string }

type RentaData = {
  totalFacture: number
  totalEncaisse: number
  depMateriaux: number
  depMO: number
  depCarburant: number
  depAutres: number
  totalDepenses: number
}

type SortieMateriau = {
  id: string; quantite: number; prix_unitaire: number | null; created_at: string
  materiaux_stock: { nom: string; unite: string } | null
}

type Affectation = {
  id: string; ouvrier_id: string; date_debut: string
  ouvriers: { nom: string; prenom: string | null; metier: string | null } | null
}
type OuvrierOption = { id: string; nom: string; prenom: string | null; metier: string | null }

type Tab = 'resume' | 'rentabilite' | 'materiaux' | 'equipe'

/* ─── Helpers ───────────────────────────────────────── */

function fcfa(v: number) { return v.toLocaleString('fr-FR') + ' FCFA' }

// Formatage avec un espace normal (U+0020) comme séparateur de milliers —
// toLocaleString('fr-FR') utilise une espace fine insécable (U+202F) qui pose problème à l'affichage.
function fcfaEspace(v: number) {
  const n = Math.round(v)
  const sign = n < 0 ? '-' : ''
  const digits = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${sign}${digits} FCFA`
}

function getMargeConfig(p: number) {
  if (p > 25)  return { color: 'text-emerald-400', gradient: 'from-emerald-500/15 to-emerald-500/5', border: 'border-emerald-500/25', bar: 'bg-emerald-500', label: 'Excellent', msg: 'Excellent chantier ! Continuez sur cette lancée.' }
  if (p >= 15) return { color: 'text-emerald-400', gradient: 'from-emerald-500/10 to-emerald-500/5', border: 'border-emerald-500/20', bar: 'bg-emerald-400', label: 'Correct',   msg: 'Bonne rentabilité.' }
  if (p >= 5)  return { color: 'text-amber-400',   gradient: 'from-amber-500/15 to-amber-500/5',     border: 'border-amber-500/25',   bar: 'bg-amber-500',   label: 'Faible',    msg: 'Marge faible. Vérifiez vos dépenses.' }
  return             { color: 'text-red-400',     gradient: 'from-red-500/15 to-red-500/5',         border: 'border-red-500/25',     bar: 'bg-red-500',     label: 'Attention', msg: 'Ce chantier est peu rentable. Analysez vos coûts.' }
}

/* ─── Page ──────────────────────────────────────────── */

export default function ChantierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { guard } = useActionGuard()
  const { id: chantierId } = use(params)

  /* ── State ── */
  const [chantier, setChantier]     = useState<Chantier | null>(null)
  const [taches, setTaches]         = useState<Tache[]>([])
  const [jalons, setJalons]         = useState<Jalon[]>([])
  const [photos, setPhotos]         = useState<Photo[]>([])
  const [loading, setLoading]       = useState(true)
  const [pageError, setPageError]   = useState('')

  const [activeTab, setActiveTab]   = useState<Tab>('resume')
  const [rentaData, setRentaData]   = useState<RentaData | null>(null)
  const [loadingRenta, setLoadingRenta] = useState(false)
  const [moisPaieNonValidee, setMoisPaieNonValidee] = useState<string[]>([])
  const [budgetPrevisionnel, setBudgetPrevisionnel] = useState<Record<string, number> | null>(null)

  const [sortiesMateriaux, setSortiesMateriaux] = useState<SortieMateriau[]>([])
  const [loadingMateriaux, setLoadingMateriaux] = useState(false)

  const [equipe, setEquipe] = useState<Affectation[]>([])
  const [loadingEquipe, setLoadingEquipe] = useState(false)
  const [showAffecterModal, setShowAffecterModal] = useState(false)
  const [ouvriersDisponibles, setOuvriersDisponibles] = useState<OuvrierOption[]>([])
  const [selectedOuvrierId, setSelectedOuvrierId] = useState('')
  const [savingAffectation, setSavingAffectation] = useState(false)
  const [affectError, setAffectError] = useState('')
  const [retirantId, setRetirantId] = useState<string | null>(null)

  const [copied, setCopied]         = useState(false)
  const [togglingPortail, setTogglingPortail] = useState(false)

  const fileRef                     = useRef<HTMLInputElement>(null)
  const [uploading, setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [addDesc, setAddDesc]       = useState('')

  const [toast, setToast]           = useState<string | null>(null)
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const [editingClient, setEditingClient] = useState(false)
  const [clientForm, setClientForm]       = useState({ client_nom: '', client_telephone: '' })
  const [savingClient, setSavingClient]   = useState(false)

  /* ── Fetch principal ── */
  const fetchData = useCallback(async () => {
    const [{ data: c, error: ce }, { data: t }, { data: j }, { data: p }] = await Promise.all([
      supabase.from('chantiers').select('id, nom, client_nom, client_telephone, ville, statut, avancement, date_debut, date_fin_prevue, portail_actif, budget_prevu').eq('id', chantierId).single(),
      supabase.from('taches').select('id, nom, statut, avancement').eq('chantier_id', chantierId).order('ordre'),
      supabase.from('jalons').select('id, nom, date_prevue, atteint').eq('chantier_id', chantierId).order('date_prevue'),
      supabase.from('photos_chantier').select('id, url, nom, legende, prise_le').eq('chantier_id', chantierId).order('prise_le', { ascending: false }),
    ])
    if (ce) { setPageError(ce.message); return }
    if (c) setChantier(c as Chantier)
    setTaches((t ?? []) as Tache[])
    setJalons((j ?? []) as Jalon[])
    setPhotos((p ?? []) as Photo[])
  }, [chantierId])

  /* ── Fetch données financières (lazy) ── */
  const fetchRenta = useCallback(async () => {
    setLoadingRenta(true)
    // Toutes les dépenses (manuelles + auto_paie + auto_stock + auto_carburant) sont
    // consolidées dans la table depenses — on ne re-somme plus pointages/pleins_carburant
    // en direct pour éviter de compter deux fois le même coût une fois la dépense auto créée.
    const [
      { data: factures },
      { data: depenses },
      { data: budgetPrev },
    ] = await Promise.all([
      supabase.from('factures').select('montant_ttc, montant_paye').eq('chantier_id', chantierId),
      supabase.from('depenses').select('montant, categorie').eq('chantier_id', chantierId),
      supabase.from('budget_previsionnel').select('categorie, montant_prevu').eq('chantier_id', chantierId),
    ])
    if (budgetPrev && budgetPrev.length > 0) {
      const map: Record<string, number> = {}
      budgetPrev.forEach(b => { map[b.categorie] = (map[b.categorie] ?? 0) + (b.montant_prevu ?? 0) })
      setBudgetPrevisionnel(map)
    } else {
      setBudgetPrevisionnel(null)
    }
    const depMat = (depenses ?? []).filter(d => d.categorie === 'materiaux').reduce((a, d) => a + (d.montant ?? 0), 0)
    const depMOd = (depenses ?? []).filter(d => d.categorie === 'main_oeuvre').reduce((a, d) => a + (d.montant ?? 0), 0)
    const depCar = (depenses ?? []).filter(d => d.categorie === 'transport').reduce((a, d) => a + (d.montant ?? 0), 0)
    const depAut = (depenses ?? []).filter(d => !['materiaux', 'main_oeuvre', 'transport'].includes(d.categorie)).reduce((a, d) => a + (d.montant ?? 0), 0)
    setRentaData({
      totalFacture:  (factures ?? []).reduce((a, f) => a + (f.montant_ttc ?? 0), 0),
      totalEncaisse: (factures ?? []).reduce((a, f) => a + (f.montant_paye ?? 0), 0),
      depMateriaux: depMat, depMO: depMOd, depCarburant: depCar, depAutres: depAut,
      totalDepenses: depMat + depMOd + depCar + depAut,
    })
    setLoadingRenta(false)
  }, [chantierId])

  // Vérifie, pour chaque mois où il y a des pointages sur ce chantier, si la paie
  // correspondante a été validée (dépense source='auto_paie'). N'affecte jamais le
  // calcul de rentabilité lui-même — purement informatif.
  const checkPaieValidation = useCallback(async () => {
    const { data: pointages } = await supabase.from('pointages')
      .select('date_pointage').eq('chantier_id', chantierId).eq('present', true)
    if (!pointages || pointages.length === 0) { setMoisPaieNonValidee([]); return }

    const moisSet = new Set<string>()
    pointages.forEach(p => { if (p.date_pointage) moisSet.add((p.date_pointage as string).slice(0, 7)) })
    const moisList = Array.from(moisSet).sort()

    const { data: paiesValidees } = await supabase.from('depenses')
      .select('date_depense').eq('chantier_id', chantierId).eq('source', 'auto_paie')
    const datesValidees = new Set((paiesValidees ?? []).map(d => d.date_depense))

    const nonValides = moisList
      .filter(m => {
        const [y, mo] = m.split('-').map(Number)
        const dernierJour = new Date(y, mo, 0).getDate()
        const dateFin = `${y}-${String(mo).padStart(2, '0')}-${String(dernierJour).padStart(2, '0')}`
        return !datesValidees.has(dateFin)
      })
      .map(m => {
        const [y, mo] = m.split('-').map(Number)
        return new Date(y, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      })
    setMoisPaieNonValidee(nonValides)
  }, [chantierId])

  const fetchMateriaux = useCallback(async () => {
    setLoadingMateriaux(true)
    console.log('=== CHARGEMENT MATERIAUX CHANTIER ===')
    console.log('Chantier ID:', chantierId)
    const { data, error } = await supabase.from('mouvements_stock')
      .select('id, quantite, prix_unitaire, created_at, materiaux_stock(nom, unite)')
      .eq('chantier_id', chantierId)
      .eq('type', 'sortie')
      .order('created_at', { ascending: false })
    console.log('Mouvements trouvés:', data)
    console.log('Erreur:', error)
    if (error) setPageError(error.message)
    setSortiesMateriaux((data ?? []) as unknown as SortieMateriau[])
    setLoadingMateriaux(false)
  }, [chantierId])

  const fetchEquipe = useCallback(async () => {
    setLoadingEquipe(true)
    const { data } = await supabase.from('affectations_chantier')
      .select('id, ouvrier_id, date_debut, ouvriers(nom, prenom, metier)')
      .eq('chantier_id', chantierId)
      .or('actif.eq.true,actif.is.null')
      .order('date_debut', { ascending: false })
    setEquipe((data ?? []) as unknown as Affectation[])
    setLoadingEquipe(false)
  }, [chantierId])

  async function openAffecterModal() {
    setSelectedOuvrierId(''); setAffectError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('entreprise_id').eq('id', user.id).single()
    if (!profile?.entreprise_id) return
    const { data: tousOuvriers } = await supabase.from('ouvriers')
      .select('id, nom, prenom, metier').eq('entreprise_id', profile.entreprise_id).or('actif.eq.true,actif.is.null').order('nom')
    const idsAffectes = new Set(equipe.map(a => a.ouvrier_id))
    setOuvriersDisponibles((tousOuvriers ?? []).filter(o => !idsAffectes.has(o.id)))
    setShowAffecterModal(true)
  }

  async function handleAffecter(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedOuvrierId) return
    setSavingAffectation(true); setAffectError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAffectError('Session expirée.'); setSavingAffectation(false); return }
    const { data: profile } = await supabase.from('profiles').select('entreprise_id').eq('id', user.id).single()
    if (!profile?.entreprise_id) { setAffectError('Entreprise introuvable.'); setSavingAffectation(false); return }

    const { error } = await supabase.from('affectations_chantier').insert({
      entreprise_id: profile.entreprise_id,
      chantier_id: chantierId,
      ouvrier_id: selectedOuvrierId,
      date_debut: new Date().toISOString().split('T')[0],
      actif: true,
    })
    if (error) { setAffectError(error.message); setSavingAffectation(false); return }

    setShowAffecterModal(false); setSavingAffectation(false)
    showToast('Ouvrier affecté au chantier')
    await fetchEquipe()
  }

  async function handleRetirer(affectationId: string) {
    setRetirantId(affectationId)
    const todayStr = new Date().toISOString().split('T')[0]
    await supabase.from('affectations_chantier').update({ actif: false, date_fin: todayStr }).eq('id', affectationId)
    setRetirantId(null)
    showToast('Ouvrier retiré du chantier')
    await fetchEquipe()
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab)
    if (tab === 'rentabilite' && !rentaData && !loadingRenta) fetchRenta()
    if (tab === 'rentabilite') checkPaieValidation()
    if (tab === 'materiaux' && sortiesMateriaux.length === 0 && !loadingMateriaux) fetchMateriaux()
    if (tab === 'equipe' && equipe.length === 0 && !loadingEquipe) fetchEquipe()
  }

  useEffect(() => {
    setLoading(true); fetchData().finally(() => setLoading(false))
  }, [fetchData])

  /* ── Handlers ── */
  const portalUrl = `${PORTAL_BASE}/${chantierId}`

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(portalUrl)
      setCopied(true); setTimeout(() => setCopied(false), 2500)
      showToast('Lien copié !')
    } catch { showToast('Erreur lors de la copie') }
  }

  function handleWhatsApp() {
    if (!chantier) return
    const msg = `Bonjour ${chantier.client_nom}, suivez l'avancement de votre chantier *${chantier.nom}* en temps réel ici : ${portalUrl}`
    const tel = chantier.client_telephone?.replace(/\D/g, '')
    const url = tel ? `https://wa.me/${tel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  async function handleTogglePortail() {
    if (!chantier) return
    setTogglingPortail(true)
    const newVal = !(chantier.portail_actif ?? true)
    const { error } = await supabase.from('chantiers').update({ portail_actif: newVal }).eq('id', chantierId)
    if (error) { showToast('Erreur : ' + error.message) }
    else {
      setChantier(p => p ? { ...p, portail_actif: newVal } : p)
      showToast(newVal ? 'Portail activé' : 'Portail désactivé')
    }
    setTogglingPortail(false)
  }

  async function handleUploadPhotos(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true); setUploadError('')

    console.log('=== DEBUT UPLOAD ===')
    console.log('Nombre de fichiers:', files.length)
    console.log('SUPABASE_URL définie:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('SUPABASE_KEY définie:', !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)

    const supabaseBrowser = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )

    console.log('=== RECUPERATION USER ===')
    const { data: { user }, error: userError } = await supabaseBrowser.auth.getUser()
    console.log('User:', user?.id)
    if (!user) {
      console.error('User non connecté:', userError)
      setUploadError('Non authentifié : ' + (userError?.message ?? 'session manquante'))
      setUploading(false)
      return
    }

    console.log('=== RECUPERATION PROFIL ===')
    const { data: profile, error: profileError } = await supabaseBrowser
      .from('profiles')
      .select('entreprise_id')
      .eq('id', user.id)
      .single()

    console.log('Profile:', profile)
    console.log('Entreprise ID:', profile?.entreprise_id)

    if (profileError || !profile?.entreprise_id) {
      console.error('Profil non trouvé:', profileError)
      setUploadError('Entreprise non trouvée : ' + (profileError?.message ?? 'entreprise_id null'))
      setUploading(false)
      return
    }

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue

      console.log('=== UPLOAD STORAGE ===')
      console.log('File:', file?.name, file?.size)
      console.log('ChantierID:', chantierId)

      const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_').toLowerCase()
      const filePath = `${profile.entreprise_id}/${chantierId}/${Date.now()}_${cleanName}`
      console.log('FilePath:', filePath)

      const { error: storageError } = await supabaseBrowser
        .storage
        .from('photos-chantier')
        .upload(filePath, file, { upsert: true })

      console.log('Storage error:', storageError)

      if (storageError) {
        console.error('Storage error complet:', JSON.stringify(storageError))
        setUploadError('[Storage] ' + storageError.message)
        setUploading(false)
        return
      }

      const { data: { publicUrl } } = supabaseBrowser
        .storage
        .from('photos-chantier')
        .getPublicUrl(filePath)

      console.log('publicUrl:', publicUrl)

      console.log('=== INSERT DB ===')
      const { error: dbError } = await supabaseBrowser
        .from('photos_chantier')
        .insert({
          chantier_id: chantierId,
          entreprise_id: profile.entreprise_id,
          url: publicUrl,
          legende: addDesc.trim() || null,
          prise_le: new Date().toISOString(),
        })

      console.log('DB error:', dbError)

      if (dbError) {
        console.error('DB error complet:', JSON.stringify(dbError))
        setUploadError('[DB] ' + dbError.message + (dbError.details ? ' — ' + dbError.details : '') + (dbError.hint ? ' (' + dbError.hint + ')' : ''))
        setUploading(false)
        return
      }
    }

    showToast(`${files.length} photo${files.length > 1 ? 's' : ''} ajoutée${files.length > 1 ? 's' : ''} ✅`)
    setAddDesc(''); if (fileRef.current) fileRef.current.value = ''
    setUploading(false); await fetchData()
  }

  function openEditClient() {
    if (!chantier) return
    setClientForm({ client_nom: chantier.client_nom ?? '', client_telephone: chantier.client_telephone ?? '' })
    setEditingClient(true)
  }

  async function handleSaveClient(e: React.FormEvent) {
    e.preventDefault()
    if (!chantier) return
    setSavingClient(true)
    const { error } = await supabase.from('chantiers').update({
      client_nom: clientForm.client_nom.trim() || null,
      client_telephone: clientForm.client_telephone.trim() || null,
    }).eq('id', chantierId)
    if (error) { showToast('Erreur : ' + error.message) }
    else {
      setChantier(p => p ? { ...p, client_nom: clientForm.client_nom.trim(), client_telephone: clientForm.client_telephone.trim() || null } : p)
      showToast('Informations client mises à jour')
      setEditingClient(false)
    }
    setSavingClient(false)
  }

  async function handleDeletePhoto(photo: Photo) {
    setDeleting(photo.id)
    const path = photo.url.split('/photos-chantier/')[1]
    if (path) await supabase.storage.from('photos-chantier').remove([decodeURIComponent(path.split('?')[0])])
    await supabase.from('photos_chantier').delete().eq('id', photo.id)
    setDeleting(null); showToast('Photo supprimée'); await fetchData()
  }

  /* ── Loading / Error ── */
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
    </div>
  )

  if (!chantier) return (
    <div className="p-4 sm:p-6 md:p-8"><p className="text-red-400">{pageError || 'Chantier introuvable'}</p></div>
  )

  const avancement   = chantier.avancement ?? 0
  const portailActif = chantier.portail_actif ?? true
  const tachesDone   = taches.filter(t => t.statut === 'termine').length
  const jalonsOk     = jalons.filter(j => j.atteint).length

  /* ── Calculs rentabilité ── */
  const rd           = rentaData
  const margeBrute   = rd ? rd.totalFacture - rd.totalDepenses : 0
  const margePct     = rd && rd.totalFacture > 0 ? Math.round((margeBrute / rd.totalFacture) * 100) : 0
  const mc           = getMargeConfig(margePct)
  const budgetPrevu  = chantier.budget_prevu ?? 0
  const budgetRatio  = budgetPrevu > 0 && rd ? Math.min(Math.round((rd.totalDepenses / budgetPrevu) * 100), 999) : 0

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl">

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-950 border border-emerald-700/50 text-emerald-300 px-5 py-3 rounded-2xl shadow-2xl text-[13px] font-medium">
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <div className="mb-5">
        <Link href="/dashboard/chantiers"
          className="flex items-center gap-1.5 text-gray-600 hover:text-gray-400 text-[12px] mb-4 transition-colors w-fit">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Tous les chantiers
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">{chantier.nom}</h1>
              <StatusBadge type="chantier" statut={chantier.statut} />
            </div>
            <p className="text-gray-500 text-[13px] mt-1">{chantier.client_nom}{chantier.ville && ` · ${chantier.ville}`}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/chantiers/${chantierId}/planning`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-orange-500/10 text-gray-400 hover:text-orange-400 text-[12px] font-medium transition-colors border border-white/[0.06]">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 1v2M11 1v2M2 6h12" strokeLinecap="round"/></svg>
              Planning
            </Link>
            <Link href={`/dashboard/chantiers/${chantierId}/jalons`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-orange-500/10 text-gray-400 hover:text-orange-400 text-[12px] font-medium transition-colors border border-white/[0.06]">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5"><path d="M2 8h12M8 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Jalons
            </Link>
          </div>
        </div>
      </div>

      {/* ── Barre d'onglets ── */}
      <div className="flex border-b border-white/[0.06] mb-6 gap-1">
        {([
          { key: 'resume' as Tab,       label: 'Résumé' },
          { key: 'rentabilite' as Tab,  label: 'Rentabilité' },
          { key: 'materiaux' as Tab,    label: 'Matériaux' },
          { key: 'equipe' as Tab,       label: 'Équipe' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-orange-400 text-orange-400'
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════ ONGLET RÉSUMÉ ══════════════════════ */}
      {activeTab === 'resume' && (
        <>
          {/* Avancement global */}
          <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-400 text-[13px]">Avancement global</p>
              <p className="text-orange-400 text-xl font-black">{avancement}%</p>
            </div>
            <div className="h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${statutBarClass('chantier', chantier.statut)}`} style={{ width: `${avancement}%` }} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              {[
                { label: 'Tâches',          value: taches.length,                        color: 'text-blue-400'    },
                { label: 'Terminées',        value: tachesDone,                           color: 'text-emerald-400' },
                { label: 'Jalons atteints', value: `${jalonsOk}/${jalons.length}`,       color: 'text-orange-400'  },
              ].map(s => (
                <div key={s.label} className="bg-white/[0.03] rounded-xl p-3 text-center">
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-gray-600 text-[10px] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Informations client */}
          {(chantier.client_nom || chantier.client_telephone) && (
            <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white text-[15px] font-semibold flex items-center gap-2">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-orange-400">
                    <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z"/>
                  </svg>
                  Client
                </h2>
                <button
                  onClick={() => guard(openEditClient)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white text-[12px] font-medium transition-colors"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3 h-3">
                    <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Modifier
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-gray-600 text-[12px] w-24 shrink-0">Client</span>
                  <span className="text-white text-[13px] font-medium">{chantier.client_nom}</span>
                </div>
                {chantier.client_telephone && (
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600 text-[12px] w-24 shrink-0">Téléphone</span>
                    <span className="text-white text-[13px] font-medium">{chantier.client_telephone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Partager avec le client */}
          <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-white text-[15px] font-semibold flex items-center gap-2">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-orange-400">
                    <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
                  </svg>
                  Partager avec le client
                </h2>
                <p className="text-gray-600 text-[12px] mt-0.5">Le client peut suivre l'avancement en temps réel</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-medium ${portailActif ? 'text-emerald-400' : 'text-gray-600'}`}>
                  {portailActif ? 'Actif' : 'Désactivé'}
                </span>
                <button
                  onClick={handleTogglePortail}
                  disabled={togglingPortail}
                  className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-60 ${portailActif ? 'bg-emerald-500' : 'bg-white/[0.08]'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${portailActif ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
            {portailActif ? (
              <>
                <div className="flex items-center gap-2 bg-[#1C1C1C] border border-white/[0.06] rounded-xl px-3 py-2.5 mb-3">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 text-orange-400 shrink-0"><path d="M6 10l-1 1a3 3 0 004.243 0l3-3a3 3 0 00-4.243-4.243L6.757 5" strokeLinecap="round"/><path d="M10 6l1-1a3 3 0 00-4.243 0l-3 3a3 3 0 004.243 4.243L9.243 11" strokeLinecap="round"/></svg>
                  <p className="text-gray-400 text-[12px] truncate flex-1 font-mono">{portalUrl}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={handleCopyLink}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-white/[0.06] hover:bg-white/[0.10] text-gray-300'}`}>
                    {copied ? (
                      <><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M2 8l4 4 8-8" strokeLinecap="round" strokeLinejoin="round"/></svg>Lien copié !</>
                    ) : (
                      <><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><rect x="6" y="6" width="8" height="8" rx="1.5"/><path d="M4 10H3a1 1 0 01-1-1V3a1 1 0 011-1h6a1 1 0 011 1v1" strokeLinecap="round"/></svg>Copier le lien</>
                    )}
                  </button>
                  <button onClick={handleWhatsApp}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#128C7E]/20 hover:bg-[#128C7E]/30 text-emerald-400 text-[12px] font-semibold transition-colors border border-emerald-700/30">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Envoyer par WhatsApp
                  </button>
                  <a href={portalUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[12px] font-semibold transition-colors border border-orange-500/20">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>
                    Voir le portail
                  </a>
                </div>
              </>
            ) : (
              <div className="bg-red-500/[0.07] border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-red-400 shrink-0"><path fillRule="evenodd" d="M8 1a7 7 0 100 14A7 7 0 008 1zM8 5a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 018 5zm0 7a1 1 0 100-2 1 1 0 000 2z"/></svg>
                <p className="text-red-400 text-[12px]">Portail désactivé — le client ne peut plus accéder au lien.</p>
              </div>
            )}
          </div>

          {/* Photos */}
          <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-[15px] font-semibold flex items-center gap-2">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-orange-400"><path fillRule="evenodd" d="M1 8a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 018.07 3h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0016.07 6H17a2 2 0 012 2v7a2 2 0 01-2 2H3a2 2 0 01-2-2V8zm13.5 3a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM10 14a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clipRule="evenodd"/></svg>
                Photos du chantier
                {photos.length > 0 && <span className="text-gray-600 text-[12px] font-normal">({photos.length})</span>}
              </h2>
              <button
                onClick={() => guard(() => fileRef.current?.click())}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-semibold transition-colors disabled:opacity-60"
              >
                {uploading ? (
                  <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Upload…</>
                ) : (
                  <><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M8 3v10M3 8h10" strokeLinecap="round"/></svg>Ajouter photos</>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => handleUploadPhotos(e.target.files)} />
            </div>
            <div className="mb-4">
              <input type="text" value={addDesc} onChange={e => setAddDesc(e.target.value)}
                placeholder="Description des photos (optionnel)…"
                className="w-full bg-[#1C1C1C] border border-white/[0.06] text-white placeholder-gray-600 rounded-xl px-4 py-2 text-[12px] focus:outline-none focus:border-orange-500 transition-all"
              />
            </div>
            {uploadError && (
              <div className="bg-red-500/[0.07] border border-red-500/20 rounded-xl px-3 py-2 mb-3 text-red-400 text-[12px]">{uploadError}</div>
            )}
            {photos.length === 0 ? (
              <div className="border-2 border-dashed border-white/[0.08] rounded-xl p-8 text-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-10 h-10 text-gray-700 mx-auto mb-3"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <p className="text-gray-600 text-[13px] mb-1">Aucune photo</p>
                <p className="text-gray-700 text-[11px]">Cliquez sur &quot;Ajouter photos&quot; pour uploader</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.map(photo => (
                  <div key={photo.id} className="group relative aspect-square bg-white/[0.04] rounded-xl overflow-hidden border border-white/[0.06]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.nom ?? ''} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                      <button onClick={() => guard(() => handleDeletePhoto(photo))} disabled={deleting === photo.id}
                        className="self-end w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors">
                        {deleting === photo.id
                          ? <svg className="animate-spin w-3 h-3 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                          : <svg viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.8" className="w-3 h-3"><path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/></svg>
                        }
                      </button>
                      <p className="text-white text-[9px]">
                        {new Date(photo.prise_le).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        {' '}
                        {new Date(photo.prise_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aperçu tâches */}
          {taches.length > 0 && (
            <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <h2 className="text-white text-[14px] font-semibold">Tâches récentes</h2>
                <Link href={`/dashboard/chantiers/${chantierId}/planning`}
                  className="text-orange-400 hover:text-orange-300 text-[12px] transition-colors">Voir tout →</Link>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {taches.slice(0, 5).map(t => {
                  const av = t.avancement ?? 0; const isDone = t.statut === 'termine'
                  return (
                    <div key={t.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <p className={`text-[13px] truncate ${isDone ? 'text-gray-500 line-through' : 'text-white'}`}>{t.nom}</p>
                        <span className="text-gray-600 text-[11px] shrink-0">{av}%</span>
                      </div>
                      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${isDone ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${av}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Aperçu jalons */}
          {jalons.length > 0 && (
            <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <h2 className="text-white text-[14px] font-semibold">Jalons</h2>
                <Link href={`/dashboard/chantiers/${chantierId}/jalons`}
                  className="text-orange-400 hover:text-orange-300 text-[12px] transition-colors">Gérer →</Link>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {jalons.map(j => (
                  <div key={j.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <p className="text-[13px] text-white truncate">{j.nom}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-gray-600 text-[11px]">{new Date(j.date_prevue).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${j.atteint ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-500'}`}>
                        {j.atteint ? 'Atteint' : 'En cours'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════ ONGLET RENTABILITÉ ══════════════════════ */}
      {activeTab === 'rentabilite' && (
        <>
          {moisPaieNonValidee.length > 0 && (
            <div className="mb-5 flex items-start gap-3 bg-amber-100 border border-amber-400 rounded-xl px-4 py-3">
              <span className="text-lg shrink-0 leading-none">⚠️</span>
              <p className="text-[13px] text-amber-900">
                Attention : la paie de <strong>{moisPaieNonValidee.join(', ')}</strong> n&apos;a pas été validée. La marge affichée ne reflète pas le coût réel de la main-d&apos;œuvre.
                {' '}
                <Link href="/dashboard/equipes/paie" className="font-semibold underline hover:no-underline">→ Valider la paie</Link>
              </p>
            </div>
          )}
          {loadingRenta ? (
            <div className="flex items-center justify-center py-20">
              <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          ) : (
          <>
          {/* Prévu (devis) vs Réel (dépenses) */}
          {!budgetPrevisionnel ? (
            <p className="text-gray-600 text-[13px] mb-5">
              Aucun budget prévisionnel — acceptez un devis pour générer le budget automatiquement
            </p>
          ) : (
            <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden mb-5">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <h3 className="text-white text-[14px] font-semibold">Budget prévisionnel — Prévu vs Réel</h3>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[480px]">
                  <div className="grid px-5 py-2.5 bg-[#1e1e1e] border-b border-white/[0.04]" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                    {['Catégorie', 'Prévu (devis)', 'Réel (dépenses)', 'Écart'].map(h => (
                      <span key={h} className="text-gray-600 text-[10px] font-semibold uppercase tracking-wider last:text-right">{h}</span>
                    ))}
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {([
                      { label: 'Matériaux',    prevu: budgetPrevisionnel.materiaux ?? 0,   reel: rd?.depMateriaux ?? 0 },
                      { label: "Main d'œuvre", prevu: budgetPrevisionnel.main_oeuvre ?? 0, reel: rd?.depMO ?? 0 },
                      { label: 'Transport',    prevu: budgetPrevisionnel.transport ?? 0,   reel: rd?.depCarburant ?? 0 },
                      { label: 'Divers',       prevu: budgetPrevisionnel.divers ?? 0,      reel: rd?.depAutres ?? 0 },
                    ]).map(row => {
                      const ecart = row.reel - row.prevu
                      return (
                        <div key={row.label} className="grid items-center px-5 py-3" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                          <span className="text-white text-[13px] font-medium">{row.label}</span>
                          <span className="text-gray-300 text-[13px]">{fcfaEspace(row.prevu)}</span>
                          <span className="text-gray-300 text-[13px]">{fcfaEspace(row.reel)}</span>
                          <span className={`text-[13px] font-semibold text-right ${ecart > 0 ? 'text-red-400' : ecart < 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                            {ecart > 0 ? '+' : ''}{fcfaEspace(ecart)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  {(() => {
                    const totalPrevu = (budgetPrevisionnel.materiaux ?? 0) + (budgetPrevisionnel.main_oeuvre ?? 0) + (budgetPrevisionnel.transport ?? 0) + (budgetPrevisionnel.divers ?? 0)
                    const totalReel = (rd?.depMateriaux ?? 0) + (rd?.depMO ?? 0) + (rd?.depCarburant ?? 0) + (rd?.depAutres ?? 0)
                    const totalEcart = totalReel - totalPrevu
                    return (
                      <div className="grid items-center px-5 py-3.5 bg-[#1e1e1e] border-t-2 border-orange-500/30" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
                        <span className="text-white text-[13px] font-bold uppercase tracking-wide">TOTAL</span>
                        <span className="text-white text-[13px] font-bold">{fcfaEspace(totalPrevu)}</span>
                        <span className="text-white text-[13px] font-bold">{fcfaEspace(totalReel)}</span>
                        <span className={`text-[14px] font-bold text-right ${totalEcart > 0 ? 'text-red-400' : totalEcart < 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                          {totalEcart > 0 ? '+' : ''}{fcfaEspace(totalEcart)}
                        </span>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

          {!rd ? (
            <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-8 text-center">
              <div className="flex items-center justify-center mb-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 text-gray-700">
                  <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" strokeLinejoin="round"/>
                  <path d="M14 3v5h5" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-white font-semibold mb-1">Aucune donnée financière</p>
              <p className="text-gray-500 text-[13px]">Ajoutez des factures et des dépenses pour voir la rentabilité.</p>
            </div>
          ) : (
            <>
              {/* Indicateur marge */}
              <div className="flex items-center justify-between mb-5">
                <p className="text-gray-500 text-[13px]">Analyse de rentabilité pour ce chantier</p>
                <span className={`text-[13px] font-bold px-3 py-1.5 rounded-xl border ${mc.border} ${mc.color} bg-white/[0.03]`}>
                  {mc.label}
                </span>
              </div>

              {/* Section 1 — Résumé financier */}
              <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 mb-5">
                <h3 className="text-white text-[14px] font-semibold mb-4 flex items-center gap-2">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 text-gray-600"><rect x="2" y="6" width="16" height="12" rx="1.5" strokeLinejoin="round"/><path d="M6 6V4a2 2 0 014 0v2" strokeLinecap="round"/></svg>
                  Résumé financier
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Total facturé',     value: rd.totalFacture,                            color: 'text-white',       sub: 'au client' },
                    { label: 'Montant encaissé',  value: rd.totalEncaisse,                           color: 'text-emerald-400', sub: 'paiements reçus' },
                    { label: 'Reste à encaisser', value: Math.max(0, rd.totalFacture - rd.totalEncaisse), color: rd.totalFacture > rd.totalEncaisse ? 'text-amber-400' : 'text-gray-500', sub: 'en attente' },
                  ].map(s => (
                    <div key={s.label} className="bg-white/[0.03] rounded-xl p-4">
                      <p className="text-gray-600 text-[10px] uppercase tracking-widest mb-1.5">{s.label}</p>
                      <p className={`text-[17px] font-bold ${s.color}`}>{fcfa(s.value)}</p>
                      <p className="text-gray-700 text-[11px] mt-0.5">{s.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/[0.05] pt-4 space-y-2">
                  {[
                    { label: 'Matériaux & fournitures', value: rd.depMateriaux,  color: 'text-orange-400' },
                    { label: "Main d'œuvre",            value: rd.depMO,         color: 'text-blue-400'   },
                    { label: 'Carburant',               value: rd.depCarburant,  color: 'text-amber-400'  },
                    { label: 'Autres dépenses',         value: rd.depAutres,     color: 'text-gray-400'   },
                  ].map(d => (
                    <div key={d.label} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                      <span className="text-gray-500 text-[13px]">{d.label}</span>
                      <span className={`text-[13px] font-semibold ${d.color}`}>{fcfa(d.value)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-gray-300 text-[12px] font-bold uppercase tracking-wide">TOTAL DÉPENSES</span>
                    <span className="text-white text-[15px] font-bold">{fcfa(rd.totalDepenses)}</span>
                  </div>
                </div>
              </div>

              {/* Section 3 — Ce qui va dans votre poche */}
              <div className={`bg-gradient-to-br ${mc.gradient} border ${mc.border} rounded-2xl p-6 mb-5`}>
                <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-2">Bénéfice net estimé</p>
                <p className={`text-[2.5rem] font-black leading-none tracking-tight mb-1 ${mc.color}`}>
                  {fcfa(margeBrute)}
                </p>
                {rd.totalFacture > 0 && (
                  <p className="text-gray-400 text-[14px] font-medium mb-4">
                    Soit <span className={`font-bold ${mc.color}`}>{margePct}%</span> de marge sur ce chantier
                  </p>
                )}
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <p className="text-[13px] text-white font-medium">{mc.msg}</p>
                </div>
                {rd.totalFacture > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="text-gray-600">Marge</span>
                      <span className={`font-bold ${mc.color}`}>{margePct}%</span>
                    </div>
                    <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${mc.bar}`} style={{ width: `${Math.max(0, Math.min(margePct, 100))}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-700 mt-1">
                      <span>0%</span><span className="text-amber-600">15%</span><span className="text-emerald-600">25%+</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2 — Budget prévu vs réel */}
              <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 mb-5">
                <h3 className="text-white text-[14px] font-semibold mb-4 flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-gray-600"><path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Budget consommé
                </h3>
                {budgetPrevu > 0 ? (
                  <>
                    <div className="mb-4 p-4 bg-white/[0.03] rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[13px] text-gray-400">Budget total</span>
                        <div className="text-right">
                          <span className={`text-[13px] font-bold ${budgetRatio > 100 ? 'text-red-400' : 'text-white'}`}>{fcfa(rd.totalDepenses)}</span>
                          <span className="text-gray-600 text-[11px] ml-1">/ {fcfa(budgetPrevu)}</span>
                        </div>
                      </div>
                      <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${budgetRatio > 100 ? 'bg-red-500' : budgetRatio > 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(budgetRatio, 100)}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11px] text-gray-600">{budgetRatio}% consommé</span>
                        {budgetRatio > 100 && <span className="text-[11px] text-red-400 font-semibold">Dépassement : {fcfa(rd.totalDepenses - budgetPrevu)}</span>}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: 'Matériaux',      value: rd.depMateriaux  },
                        { label: "Main d'œuvre",   value: rd.depMO         },
                        { label: 'Carburant',      value: rd.depCarburant  },
                        { label: 'Autres',         value: rd.depAutres     },
                      ].map(p => {
                        const r = rd.totalDepenses > 0 ? Math.round(p.value / rd.totalDepenses * 100) : 0
                        return (
                          <div key={p.label}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[12px] text-gray-400">{p.label}</span>
                              <span className="text-[12px] font-semibold text-white">{fcfa(p.value)} <span className="text-gray-600 font-normal">({r}%)</span></span>
                            </div>
                            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                              <div className="h-full bg-orange-500/70 rounded-full" style={{ width: `${r}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500 text-[13px]">Aucun budget défini pour ce chantier.
                    <Link href="/dashboard/chantiers" className="text-orange-400 hover:text-orange-300 ml-1">Modifier →</Link>
                  </p>
                )}
              </div>

              {/* Section 5 — Conseils */}
              {margePct < 15 && rd.totalFacture > 0 && (
                <div className="bg-[#232323] rounded-2xl border border-amber-500/20 p-5">
                  <h3 className="text-amber-400 text-[14px] font-semibold mb-4 flex items-center gap-2">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 shrink-0"><circle cx="8" cy="9" r="5"/><path d="M6 9a2 2 0 114 0" strokeLinecap="round"/><path d="M8 4V2M5 5L3.5 3.5M11 5l1.5-1.5" strokeLinecap="round"/></svg>
                    Conseils pour améliorer votre marge
                  </h3>
                  <div className="space-y-2">
                    {[
                      "Négociez vos prix matériaux avec vos fournisseurs — même 5% d'économie change tout",
                      "Optimisez le nombre de journaliers selon l'avancement réel du chantier",
                      'Vérifiez les pertes et gaspillages de matériaux sur site',
                      'Réévaluez votre tarif client sur les prochains chantiers similaires',
                      ...(rd.depCarburant > rd.totalDepenses * 0.15 ? ['Carburant élevé : planifiez mieux les trajets'] : []),
                      ...(rd.depMO > rd.totalDepenses * 0.5 ? ["Main d'œuvre dominante : envisagez des ouvriers plus qualifiés (moins de jours, même résultat)"] : []),
                    ].map((tip, idx) => (
                      <div key={idx} className="flex items-start gap-3 py-2 border-b border-white/[0.04] last:border-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60 shrink-0 mt-1.5" />
                        <p className="text-[13px] text-gray-300 leading-relaxed">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          </>
          )}
        </>
      )}

      {/* ══════════════════════ ONGLET MATÉRIAUX ══════════════════════ */}
      {activeTab === 'materiaux' && (
        <>
          {pageError && (
            <div className="mb-5 flex items-center gap-2 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">
              {pageError}
            </div>
          )}
          {loadingMateriaux ? (
            <div className="flex items-center justify-center py-20">
              <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          ) : sortiesMateriaux.length === 0 ? (
            <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-8 text-center">
              <p className="text-white font-semibold mb-1">Aucun matériau sorti pour ce chantier</p>
              <p className="text-gray-500 text-[13px]">Enregistrez une sortie de stock depuis <Link href="/dashboard/budget" className="text-orange-400 hover:text-orange-300">Budget &amp; Dépenses</Link>.</p>
            </div>
          ) : (
            <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[560px]">
                  <div className="grid px-5 py-2.5 bg-[#1e1e1e] border-b border-white/[0.04]" style={{ gridTemplateColumns: '2fr 100px 120px 130px 110px' }}>
                    {['Matériau', 'Quantité', 'Prix unit.', 'Total', 'Date'].map(h => (
                      <span key={h} className="text-gray-600 text-[10px] font-semibold uppercase tracking-wider last:text-right">{h}</span>
                    ))}
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {sortiesMateriaux.map(m => {
                      const total = m.quantite * (m.prix_unitaire ?? 0)
                      return (
                        <div key={m.id} className="grid items-center px-5 py-3" style={{ gridTemplateColumns: '2fr 100px 120px 130px 110px' }}>
                          <span className="text-white text-[13px] font-medium">{m.materiaux_stock?.nom ?? '—'}</span>
                          <span className="text-gray-300 text-[13px]">{m.quantite.toLocaleString('fr-FR')} {m.materiaux_stock?.unite}</span>
                          <span className="text-gray-400 text-[12px]">{m.prix_unitaire ? fcfa(m.prix_unitaire) : '—'}</span>
                          <span className="text-white text-[13px] font-semibold">{fcfa(total)}</span>
                          <span className="text-gray-500 text-[12px] text-right">{new Date(m.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="px-5 py-3.5 bg-[#1e1e1e] border-t border-white/[0.06] flex justify-between items-center">
                    <span className="text-gray-400 text-[13px] font-semibold">Total matériaux consommés</span>
                    <span className="text-orange-400 text-[15px] font-bold">
                      {fcfa(sortiesMateriaux.reduce((a, m) => a + m.quantite * (m.prix_unitaire ?? 0), 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════ ONGLET ÉQUIPE ══════════════════════ */}
      {activeTab === 'equipe' && (
        <>
          <div className="flex items-center justify-between mb-5 gap-3">
            <p className="text-gray-500 text-[13px]">Ouvriers affectés à ce chantier</p>
            <button onClick={() => guard(openAffecterModal)}
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-semibold px-3.5 py-2 rounded-xl transition-colors shrink-0">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M8 3v10M3 8h10" strokeLinecap="round"/></svg>
              Affecter un ouvrier
            </button>
          </div>

          {loadingEquipe ? (
            <div className="flex items-center justify-center py-20">
              <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          ) : equipe.length === 0 ? (
            <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-8 text-center">
              <p className="text-white font-semibold mb-1">Aucun ouvrier affecté</p>
              <p className="text-gray-500 text-[13px]">Affectez des ouvriers pour organiser vos équipes par chantier.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {equipe.map(a => (
                <div key={a.id} className="bg-[#232323] rounded-2xl border border-white/[0.06] p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0">
                    <span className="text-gray-400 text-[12px] font-bold">
                      {((a.ouvriers?.prenom?.[0] ?? '') + (a.ouvriers?.nom?.[0] ?? '')).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[13px] font-medium truncate">
                      {a.ouvriers?.prenom ? `${a.ouvriers.prenom} ${a.ouvriers.nom}` : (a.ouvriers?.nom ?? '—')}
                    </p>
                    <p className="text-gray-600 text-[11px] truncate">
                      {a.ouvriers?.metier ?? 'Ouvrier'} · depuis le {new Date(a.date_debut + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                  <button onClick={() => guard(() => handleRetirer(a.id))} disabled={retirantId === a.id}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-red-500/10 text-gray-500 hover:text-red-400 text-[11px] font-medium transition-colors disabled:opacity-50">
                    {retirantId === a.id ? (
                      <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    ) : 'Retirer'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Modal affecter un ouvrier */}
          {showAffecterModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) setShowAffecterModal(false) }}>
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              <div className="relative w-full max-w-sm bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl">
                <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                  <h2 className="text-[15px] font-semibold text-white">Affecter un ouvrier</h2>
                  <button onClick={() => setShowAffecterModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M2 2l12 12M14 2L2 14" strokeLinecap="round"/></svg>
                  </button>
                </div>
                <form onSubmit={handleAffecter} className="px-6 py-5 space-y-4">
                  {affectError && <div className="text-red-400 text-[13px] bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3">{affectError}</div>}
                  {ouvriersDisponibles.length === 0 ? (
                    <p className="text-gray-500 text-[13px]">Tous vos ouvriers actifs sont déjà affectés à ce chantier.</p>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Ouvrier <span className="text-orange-400">*</span></label>
                      <select required value={selectedOuvrierId} onChange={e => setSelectedOuvrierId(e.target.value)}
                        className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all">
                        <option value="">— Sélectionner —</option>
                        {ouvriersDisponibles.map(o => (
                          <option key={o.id} value={o.id}>{o.prenom ? `${o.prenom} ${o.nom}` : o.nom}{o.metier ? ` — ${o.metier}` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowAffecterModal(false)}
                      className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white text-[13px] font-medium transition-colors">Annuler</button>
                    <button type="submit" disabled={savingAffectation || ouvriersDisponibles.length === 0}
                      className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                      {savingAffectation ? (
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      ) : 'Affecter'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
      {/* ── Modal édition client ── */}
      {editingClient && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setEditingClient(false) }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-[#232323] rounded-t-3xl sm:rounded-2xl border border-white/[0.08] shadow-2xl">
            <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
              <h2 className="text-[15px] font-semibold text-white">Modifier le client</h2>
              <button
                onClick={() => setEditingClient(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M2 2l12 12M14 2L2 14" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSaveClient} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                  Nom du client <span className="text-orange-400">*</span>
                </label>
                <input
                  type="text"
                  value={clientForm.client_nom}
                  onChange={e => setClientForm(f => ({ ...f, client_nom: e.target.value }))}
                  required
                  placeholder="Ex: Mamadou Konaté"
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-[border-color,box-shadow] duration-150"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                  Téléphone WhatsApp du client <span className="text-orange-400">*</span>
                </label>
                <input
                  type="text"
                  value={clientForm.client_telephone}
                  onChange={e => setClientForm(f => ({ ...f, client_telephone: e.target.value }))}
                  required
                  placeholder="Ex: +223 76 XX XX XX"
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-[border-color,box-shadow] duration-150"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingClient(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white hover:border-white/[0.15] text-[13px] font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingClient}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {savingClient ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Enregistrement…
                    </>
                  ) : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
