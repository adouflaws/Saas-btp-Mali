'use client'

import { use, useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { createBrowserClient } from '@supabase/ssr'

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
}

type Tache = { id: string; nom: string; statut: string | null; avancement: number | null }
type Jalon = { id: string; nom: string; date_prevue: string; atteint: boolean | null }
type Photo = { id: string; url: string; nom: string | null; legende: string | null; prise_le: string }

/* ─── Helpers ───────────────────────────────────────── */

const STATUTS: Record<string, { label: string; badge: string; bar: string }> = {
  preparation: { label: 'Préparation', badge: 'bg-blue-500/10 text-blue-400',      bar: 'bg-blue-400' },
  en_cours:    { label: 'En cours',    badge: 'bg-emerald-500/10 text-emerald-400', bar: 'bg-emerald-500' },
  en_pause:    { label: 'En pause',    badge: 'bg-amber-500/10 text-amber-400',     bar: 'bg-amber-500' },
  termine:     { label: 'Terminé',     badge: 'bg-gray-500/10 text-gray-400',       bar: 'bg-gray-400' },
  annule:      { label: 'Annulé',      badge: 'bg-red-500/10 text-red-400',         bar: 'bg-red-400' },
}
function getStatut(v: string | null) { return STATUTS[v ?? ''] ?? STATUTS.en_cours }

/* ─── Page ──────────────────────────────────────────── */

export default function ChantierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: chantierId } = use(params)

  const [chantier, setChantier]     = useState<Chantier | null>(null)
  const [taches, setTaches]         = useState<Tache[]>([])
  const [jalons, setJalons]         = useState<Jalon[]>([])
  const [photos, setPhotos]         = useState<Photo[]>([])
  const [loading, setLoading]       = useState(true)
  const [pageError, setPageError]   = useState('')

  // Partage
  const [copied, setCopied]         = useState(false)

  // Toggle portail
  const [togglingPortail, setTogglingPortail] = useState(false)

  // Upload photos
  const fileRef                     = useRef<HTMLInputElement>(null)
  const [uploading, setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [addDesc, setAddDesc]       = useState('')

  // Toast
  const [toast, setToast]           = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const fetchData = useCallback(async () => {
    const [{ data: c, error: ce }, { data: t }, { data: j }, { data: p }] = await Promise.all([
      supabase.from('chantiers').select('id, nom, client_nom, client_telephone, ville, statut, avancement, date_debut, date_fin_prevue, portail_actif').eq('id', chantierId).single(),
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

  useEffect(() => {
    setLoading(true); fetchData().finally(() => setLoading(false))
  }, [fetchData])

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
      showToast(newVal ? 'Portail activé ✅' : 'Portail désactivé')
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

  async function handleDeletePhoto(photo: Photo) {
    setDeleting(photo.id)
    const path = photo.url.split('/photos-chantier/')[1]
    if (path) await supabase.storage.from('photos-chantier').remove([decodeURIComponent(path.split('?')[0])])
    await supabase.from('photos_chantier').delete().eq('id', photo.id)
    setDeleting(null); showToast('Photo supprimée'); await fetchData()
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
    </div>
  )

  if (!chantier) return (
    <div className="p-8"><p className="text-red-400">{pageError || 'Chantier introuvable'}</p></div>
  )

  const statut      = getStatut(chantier.statut)
  const avancement  = chantier.avancement ?? 0
  const portailActif = chantier.portail_actif ?? true
  const tachesDone  = taches.filter(t => t.statut === 'termine').length
  const jalonsOk    = jalons.filter(j => j.atteint).length

  return (
    <div className="p-8 max-w-4xl">

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-950 border border-emerald-700/50 text-emerald-300 px-5 py-3 rounded-2xl shadow-2xl text-[13px] font-medium">
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <div className="mb-6">
        <Link href="/dashboard/chantiers"
          className="flex items-center gap-1.5 text-gray-600 hover:text-gray-400 text-[12px] mb-4 transition-colors w-fit">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Tous les chantiers
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{chantier.nom}</h1>
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statut.badge}`}>{statut.label}</span>
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

      {/* ── Avancement global ── */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-gray-400 text-[13px]">Avancement global</p>
          <p className="text-orange-400 text-xl font-black">{avancement}%</p>
        </div>
        <div className="h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${statut.bar}`} style={{ width: `${avancement}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Tâches', value: taches.length, color: 'text-blue-400' },
            { label: 'Terminées', value: tachesDone, color: 'text-emerald-400' },
            { label: 'Jalons atteints', value: `${jalonsOk}/${jalons.length}`, color: 'text-orange-400' },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.03] rounded-xl p-3 text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-gray-600 text-[10px] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION PARTAGER AVEC LE CLIENT ── */}
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

          {/* Toggle portail */}
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
            {/* Lien */}
            <div className="flex items-center gap-2 bg-[#1C1C1C] border border-white/[0.06] rounded-xl px-3 py-2.5 mb-3">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 text-orange-400 shrink-0"><path d="M6 10l-1 1a3 3 0 004.243 0l3-3a3 3 0 00-4.243-4.243L6.757 5" strokeLinecap="round"/><path d="M10 6l1-1a3 3 0 00-4.243 0l-3 3a3 3 0 004.243 4.243L9.243 11" strokeLinecap="round"/></svg>
              <p className="text-gray-400 text-[12px] truncate flex-1 font-mono">{portalUrl}</p>
            </div>

            {/* Boutons */}
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

      {/* ── PHOTOS DU CHANTIER ── */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-[15px] font-semibold flex items-center gap-2">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-orange-400"><path fillRule="evenodd" d="M1 8a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 018.07 3h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0016.07 6H17a2 2 0 012 2v7a2 2 0 01-2 2H3a2 2 0 01-2-2V8zm13.5 3a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM10 14a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clipRule="evenodd"/></svg>
            Photos du chantier
            {photos.length > 0 && <span className="text-gray-600 text-[12px] font-normal">({photos.length})</span>}
          </h2>
          <button
            onClick={() => fileRef.current?.click()}
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

        {/* Description optionnelle avant upload */}
        <div className="mb-4">
          <input
            type="text"
            value={addDesc}
            onChange={e => setAddDesc(e.target.value)}
            placeholder="Description des photos (optionnel)…"
            className="w-full bg-[#1C1C1C] border border-white/[0.06] text-white placeholder-gray-700 rounded-xl px-4 py-2 text-[12px] focus:outline-none focus:border-orange-500 transition-all"
          />
        </div>

        {uploadError && (
          <div className="bg-red-500/[0.07] border border-red-500/20 rounded-xl px-3 py-2 mb-3 text-red-400 text-[12px]">{uploadError}</div>
        )}

        {photos.length === 0 ? (
          <div className="border-2 border-dashed border-white/[0.08] rounded-xl p-8 text-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" className="w-10 h-10 text-gray-700 mx-auto mb-3"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <p className="text-gray-600 text-[13px] mb-1">Aucune photo</p>
            <p className="text-gray-700 text-[11px]">Cliquez sur "Ajouter photos" pour uploader</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map(photo => (
              <div key={photo.id} className="group relative aspect-square bg-white/[0.04] rounded-xl overflow-hidden border border-white/[0.06]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.nom ?? ''} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                  <button
                    onClick={() => handleDeletePhoto(photo)}
                    disabled={deleting === photo.id}
                    className="self-end w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
                  >
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

      {/* ── Aperçu tâches ── */}
      {taches.length > 0 && (
        <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-white text-[14px] font-semibold">Tâches récentes</h2>
            <Link href={`/dashboard/chantiers/${chantierId}/planning`}
              className="text-orange-400 hover:text-orange-300 text-[12px] transition-colors">
              Voir tout →
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {taches.slice(0, 5).map(t => {
              const av = t.avancement ?? 0
              const isDone = t.statut === 'termine'
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

      {/* ── Aperçu jalons ── */}
      {jalons.length > 0 && (
        <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-white text-[14px] font-semibold">Jalons</h2>
            <Link href={`/dashboard/chantiers/${chantierId}/jalons`}
              className="text-orange-400 hover:text-orange-300 text-[12px] transition-colors">
              Gérer →
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {jalons.map(j => (
              <div key={j.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <p className="text-[13px] text-white truncate">{j.nom}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-gray-600 text-[11px]">{new Date(j.date_prevue).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${j.atteint ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-500'}`}>
                    {j.atteint ? '✅' : '⏳'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
