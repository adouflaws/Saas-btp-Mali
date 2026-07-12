'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useActionGuard } from '@/hooks/useActionGuard'

const supabase = createClient()

type EntrepriseData = {
  id: string
  nom: string
  adresse: string | null
  telephone: string | null
  email: string | null
  rccm: string | null
  nif: string | null
  logo_url: string | null
}

type TarifPerso = {
  id: string
  designation: string
  prix: number
  unite: string | null
}

type TarifForm = {
  designation: string
  prix: string
  unite: string
}

function newTarifForm(): TarifForm { return { designation: '', prix: '', unite: '' } }

export default function ParametresPage() {
  const { guard } = useActionGuard()
  const [entrepriseId, setEntrepriseId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pageError, setPageError] = useState('')

  // Entreprise form
  const [form, setForm] = useState({ nom: '', adresse: '', telephone: '', email: '', rccm: '', nif: '', logo_url: '' })

  // Tarifs personnalisés
  const [tarifs, setTarifs] = useState<TarifPerso[]>([])
  const [showAddTarif, setShowAddTarif] = useState(false)
  const [tarifForm, setTarifForm] = useState<TarifForm>(newTarifForm())
  const [savingTarif, setSavingTarif] = useState(false)
  const [deletingTarifId, setDeletingTarifId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      setLoading(true)

      // ── 1. Auth ──────────────────────────────────────────
      let userId: string | null = null
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        console.log('[parametres] auth user:', user?.id, authError)
        if (!user) { setLoading(false); return }
        userId = user.id
      } catch (e) {
        console.error('[parametres] auth exception:', e)
        setLoading(false); return
      }

      // ── 2. Profil → entreprise_id ─────────────────────────
      let eid: string | null = null
      try {
        const { data: profile, error: profError } = await supabase
          .from('profiles').select('entreprise_id').eq('id', userId).single()
        console.log('[parametres] profile:', profile, profError)
        if (!profile?.entreprise_id) {
          setPageError('Aucune entreprise associée à ce compte.')
          setLoading(false); return
        }
        eid = profile.entreprise_id
        setEntrepriseId(eid)
      } catch (e) {
        console.error('[parametres] profile exception:', e)
        setPageError('Impossible de charger le profil.')
        setLoading(false); return
      }

      // ── 3. Données entreprise ─────────────────────────────
      try {
        const { data: ent, error: entError } = await supabase
          .from('entreprises')
          .select('id, nom, adresse, telephone, email, rccm, nif, logo_url')
          .eq('id', eid)
          .maybeSingle()
        console.log('[parametres] entreprise:', ent, entError)
        if (entError) { setPageError('Erreur chargement entreprise : ' + entError.message) }
        if (ent) {
          const e = ent as EntrepriseData
          setForm({
            nom: e.nom ?? '',
            adresse: e.adresse ?? '',
            telephone: e.telephone ?? '',
            email: e.email ?? '',
            rccm: e.rccm ?? '',
            nif: e.nif ?? '',
            logo_url: e.logo_url ?? '',
          })
        }
      } catch (e) {
        console.error('[parametres] entreprise exception:', e)
      }

      // ── 4. Tarifs (non-bloquant) ──────────────────────────
      try {
        const { data: tarifsData, error: tarifsError } = await supabase
          .from('tarifs_personnalises')
          .select('*')
          .eq('entreprise_id', eid)
          .order('designation')
        console.log('[parametres] tarifs:', tarifsData, tarifsError)
        if (tarifsError) { console.error('Erreur chargement tarifs:', tarifsError) }
        setTarifs((tarifsData ?? []) as TarifPerso[])
      } catch (e) {
        console.error('[parametres] tarifs exception:', e)
        setTarifs([])
      }

      setLoading(false)
    }
    init()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setPageError('')

    console.log('=== SAVE PARAMETRES ===')
    console.log('entreprise_id utilise:', entrepriseId)

    if (!entrepriseId) {
      setPageError('Erreur : aucune entreprise associée à ce compte (entreprise_id null).')
      return
    }

    setSaving(true)

    const payload = {
      nom: form.nom.trim(),
      adresse: form.adresse.trim() || null,
      telephone: form.telephone.trim() || null,
      email: form.email.trim() || null,
      rccm: form.rccm.trim() || null,
      nif: form.nif.trim() || null,
      logo_url: form.logo_url.trim() || null,
    }

    console.log('Donnees a enregistrer:', payload)

    const { data, error } = await supabase
      .from('entreprises')
      .update(payload)
      .eq('id', entrepriseId)
      .select()

    console.log('Reponse Supabase complete:', { data, error })

    if (error) {
      console.error('Erreur complete:', JSON.stringify(error, null, 2))
      setPageError(`Erreur Supabase : ${error.message} (code : ${error.code})`)
      setSaving(false)
      return
    }

    if (!data || data.length === 0) {
      console.error('Aucune ligne mise a jour - RLS ou entreprise_id incorrect')
      setPageError('Aucune ligne mise à jour — politique RLS Supabase ou entreprise_id incorrect.')
      setSaving(false)
      return
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    setSaving(false)
  }

  async function reloadTarifs(eid: string) {
    const { data } = await supabase
      .from('tarifs_personnalises').select('*').eq('entreprise_id', eid).order('designation')
    setTarifs((data ?? []) as TarifPerso[])
  }

  async function handleAddTarif(e: React.FormEvent) {
    e.preventDefault()
    if (!entrepriseId || !tarifForm.designation.trim()) return
    setSavingTarif(true)
    const { error } = await supabase.from('tarifs_personnalises').insert({
      entreprise_id: entrepriseId,
      designation: tarifForm.designation.trim(),
      prix: Number(tarifForm.prix) || 0,
      unite: tarifForm.unite.trim() || null,
    })
    if (!error) {
      await reloadTarifs(entrepriseId)
      setTarifForm(newTarifForm())
      setShowAddTarif(false)
    }
    setSavingTarif(false)
  }

  async function handleDeleteTarif(id: string) {
    setDeletingTarifId(id)
    await supabase.from('tarifs_personnalises').delete().eq('id', id)
    if (entrepriseId) await reloadTarifs(entrepriseId)
    setDeletingTarifId(null)
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 flex items-center justify-center min-h-[300px]">
        <svg className="animate-spin w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Paramètres</h1>
        <p className="text-gray-500 text-sm mt-1">Informations de votre entreprise et tarifs personnalisés</p>
      </div>

      {pageError && (
        <div className="mb-5 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">
          {pageError}
        </div>
      )}

      {/* Section : Informations entreprise */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-white mb-5 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-orange-400">
            <path d="M3 21h18M5 21V11m14 0v10M3 11l9-7 9 7M10 21v-5h4v5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Informations de l&apos;entreprise
        </h2>
        <form onSubmit={handleSave} className="space-y-4">
          {/* Nom */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
              Nom de l&apos;entreprise <span className="text-orange-400">*</span>
            </label>
            <input
              type="text" required
              value={form.nom}
              onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
              placeholder="Ex: DIABATÉ BTP SARL"
              className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all"
            />
          </div>

          {/* Adresse + Téléphone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Adresse</label>
              <input
                type="text"
                value={form.adresse}
                onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                placeholder="Ex: Bamako, Quartier du Fleuve"
                className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Téléphone</label>
              <input
                type="text"
                value={form.telephone}
                onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
                placeholder="+223 XX XX XX XX"
                className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all"
              />
            </div>
          </div>

          {/* Email + Logo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="contact@entreprise.ml"
                className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">URL Logo</label>
              <input
                type="url"
                value={form.logo_url}
                onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
                placeholder="https://..."
                className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all"
              />
            </div>
          </div>

          {/* RCCM + NIF */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">RCCM</label>
              <input
                type="text"
                value={form.rccm}
                onChange={e => setForm(f => ({ ...f, rccm: e.target.value }))}
                placeholder="Ex: MA-BAM-2024-B-1234"
                className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">NIF</label>
              <input
                type="text"
                value={form.nif}
                onChange={e => setForm(f => ({ ...f, nif: e.target.value }))}
                placeholder="Ex: 123456789"
                className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-all"
              />
            </div>
          </div>

          {/* Preview logo */}
          {form.logo_url && (
            <div className="flex items-center gap-3 p-3 bg-[#1C1C1C] rounded-xl border border-white/[0.06]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.logo_url} alt="Logo" className="h-10 object-contain" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
              <span className="text-gray-500 text-[12px]">Aperçu du logo</span>
            </div>
          )}

          {/* Save button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60"
            >
              {saving
                ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Enregistrement…</>
                : 'Sauvegarder'}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-emerald-400 text-[13px]">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/>
                </svg>
                Sauvegardé
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Section : Tarifs personnalisés */}
      <div className="bg-[#232323] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-white flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-orange-400">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Mes tarifs personnalisés
            <span className="text-gray-600 text-[12px] font-normal">({tarifs.length})</span>
          </h2>
          <button
            onClick={() => guard(() => { setTarifForm(newTarifForm()); setShowAddTarif(true) })}
            className="flex items-center gap-1.5 text-orange-400 hover:text-orange-300 text-[12px] font-medium transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M8 3v10M3 8h10" strokeLinecap="round"/>
            </svg>
            Ajouter
          </button>
        </div>

        {/* Add form */}
        {showAddTarif && (
          <form onSubmit={handleAddTarif} className="px-6 py-4 border-b border-white/[0.06] bg-orange-500/[0.04]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-widest">Désignation *</label>
                <input
                  type="text" required autoFocus
                  value={tarifForm.designation}
                  onChange={e => setTarifForm(f => ({ ...f, designation: e.target.value }))}
                  placeholder="Ex: Pose carrelage"
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-orange-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-widest">Prix FCFA *</label>
                <input
                  type="number" min="0" required
                  value={tarifForm.prix}
                  onChange={e => setTarifForm(f => ({ ...f, prix: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-orange-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-widest">Unité</label>
                <input
                  type="text"
                  value={tarifForm.unite}
                  onChange={e => setTarifForm(f => ({ ...f, unite: e.target.value }))}
                  placeholder="m², jour, m³…"
                  className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:border-orange-500 transition-all"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => setShowAddTarif(false)}
                className="px-4 py-2 rounded-xl border border-white/[0.08] text-gray-400 text-[12px] font-medium hover:text-white transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={savingTarif}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-semibold transition-colors disabled:opacity-60">
                {savingTarif ? 'Ajout…' : 'Ajouter'}
              </button>
            </div>
          </form>
        )}

        {tarifs.length === 0 && !showAddTarif ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-10 h-10 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-orange-400">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-white text-[13px] font-medium mb-1">Aucun tarif personnalisé</p>
            <p className="text-gray-600 text-[11px]">Ajoutez vos tarifs pour les retrouver dans la bibliothèque de prix</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="grid px-6 py-2.5 bg-[#1C1C1C]/50" style={{ gridTemplateColumns: '3fr 1fr 1fr 40px' }}>
              {['Désignation', 'Prix FCFA', 'Unité', ''].map(h => (
                <span key={h} className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-white/[0.04]">
              {tarifs.map(t => (
                <div key={t.id} className="grid px-6 py-3 items-center hover:bg-white/[0.02] transition-colors group" style={{ gridTemplateColumns: '3fr 1fr 1fr 40px' }}>
                  <span className="text-white text-[13px]">{t.designation}</span>
                  <span className="text-orange-400 text-[13px] font-medium">{(t.prix ?? 0).toLocaleString('fr-FR')}</span>
                  <span className="text-gray-500 text-[12px]">{t.unite ?? '—'}</span>
                  <button
                    onClick={() => guard(() => handleDeleteTarif(t.id))}
                    disabled={deletingTarifId === t.id}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
                      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8L13 4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Info box */}
      <div className="mt-4 bg-blue-500/[0.06] border border-blue-500/20 rounded-xl px-4 py-3">
        <p className="text-blue-400 text-[12px]">
          <strong>Astuce :</strong> Ces informations apparaissent sur vos PDF de devis et factures. Les tarifs personnalisés sont disponibles dans la bibliothèque de prix lors de la création d&apos;un devis.
        </p>
      </div>
    </div>
  )
}
