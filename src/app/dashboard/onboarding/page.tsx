'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const TYPES_ACTIVITE = ['Construction', 'Rénovation', 'Travaux publics', 'Autre']

const STEPS = ['Entreprise', 'Chantier', 'Ouvrier', 'Prêt']

function StepDot({ n, current }: { n: number; current: number }) {
  const past = n < current
  const active = n === current
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold border-[1.5px] transition-colors duration-200 ${
      past    ? 'bg-orange-500 border-orange-500 text-white' :
      active  ? 'bg-transparent border-orange-500 text-orange-400' :
                'bg-transparent border-white/[0.12] text-gray-700'
    }`}>
      {past ? (
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
          <path d="M2 6l2.5 2.5L10 3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : n}
    </div>
  )
}

const INPUT = 'w-full bg-[#1C1C1C] border border-white/[0.09] text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-[border-color,box-shadow] duration-150 min-h-[44px]'
const LABEL = 'block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.07em] mb-1.5'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [entrepriseId, setEntrepriseId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  // Step 1
  const [nomEntreprise, setNomEntreprise] = useState('')
  const [ville, setVille] = useState('Bamako')
  const [telephone, setTelephone] = useState('')
  const [typeActivite, setTypeActivite] = useState('')

  // Step 2
  const [chantierNom, setChantierNom] = useState('')
  const [chantierClient, setChantierClient] = useState('')
  const [chantierCreated, setChantierCreated] = useState<string | null>(null)

  // Step 3
  const [ouvrierPrenom, setOuvrierPrenom] = useState('')
  const [ouvrierNom, setOuvrierNom] = useState('')
  const [ouvrierMetier, setOuvrierMetier] = useState('')
  const [ouvrierTypeContrat, setOuvrierTypeContrat] = useState('journalier')
  const [ouvrierTaux, setOuvrierTaux] = useState('')
  const [ouvrierCreated, setOuvrierCreated] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const telephonePreRempli = (user.user_metadata?.telephone as string) || ''
      const { data: profile } = await supabase
        .from('profiles').select('entreprise_id').eq('id', user.id).maybeSingle()
      if (!profile?.entreprise_id) return
      setEntrepriseId(profile.entreprise_id)
      const { data: e } = await supabase
        .from('entreprises')
        .select('nom, ville, telephone, onboarding_step, onboarding_complete')
        .eq('id', profile.entreprise_id)
        .maybeSingle()
      if (e) {
        if (e.onboarding_complete) { router.push('/dashboard'); return }
        setNomEntreprise(e.nom ?? '')
        setVille(e.ville ?? 'Bamako')
        setTelephone(e.telephone || telephonePreRempli)
        if (e.onboarding_step >= 1) setStep(Math.min(e.onboarding_step + 1, 4))
      }
      setLoaded(true)
    }
    init()
  }, [router])

  async function handleStep1(ev: React.FormEvent) {
    ev.preventDefault()
    if (!entrepriseId || !nomEntreprise) return
    setSaving(true); setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('entreprises')
      .update({ nom: nomEntreprise, ville, telephone, onboarding_step: 1 })
      .eq('id', entrepriseId)
    setSaving(false)
    if (err) { setError(err.message); return }
    setStep(2)
  }

  async function handleStep2(ev: React.FormEvent) {
    ev.preventDefault()
    setError('')
    if (chantierNom && chantierClient) {
      setSaving(true)
      const supabase = createClient()
      const { error: err } = await supabase.from('chantiers').insert({
        entreprise_id: entrepriseId,
        nom: chantierNom,
        client_nom: chantierClient,
        statut: 'en_cours',
      })
      setSaving(false)
      if (err) { setError(err.message); return }
      setChantierCreated(chantierNom)
      await supabase.from('entreprises').update({ onboarding_step: 2 }).eq('id', entrepriseId)
    }
    setStep(3)
  }

  async function handleStep3(ev: React.FormEvent) {
    ev.preventDefault()
    setError('')
    if (ouvrierPrenom && ouvrierNom) {
      setSaving(true)
      const supabase = createClient()
      const { error: err } = await supabase.from('ouvriers').insert({
        entreprise_id: entrepriseId,
        prenom: ouvrierPrenom,
        nom: ouvrierNom,
        metier: ouvrierMetier || null,
        type_contrat: ouvrierTypeContrat,
        taux_journalier: ouvrierTaux ? parseInt(ouvrierTaux, 10) : 0,
        actif: true,
      })
      setSaving(false)
      if (err) { setError(err.message); return }
      setOuvrierCreated(`${ouvrierPrenom} ${ouvrierNom}`)
      await supabase.from('entreprises').update({ onboarding_step: 3 }).eq('id', entrepriseId)
    }
    setStep(4)
  }

  async function handleComplete() {
    if (!entrepriseId) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('entreprises')
      .update({ onboarding_complete: true, onboarding_step: 4 })
      .eq('id', entrepriseId)
    setSaving(false)
    router.push('/dashboard')
  }

  if (!loaded) {
    return (
      <div className="min-h-full bg-[#1C1C1C] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/10 border-t-orange-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#1C1C1C]">
      <div className="max-w-[480px] mx-auto px-4 py-10">

        {/* Header + stepper */}
        <div className="mb-8">
          <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.08em] mb-5">
            Configuration — étape {step} sur {STEPS.length}
          </p>
          <div className="flex items-start">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-start flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <StepDot n={i + 1} current={step} />
                  <span className={`text-[10px] font-medium whitespace-nowrap leading-none ${
                    i + 1 === step ? 'text-orange-400' :
                    i + 1 < step  ? 'text-gray-500'   : 'text-gray-700'
                  }`}>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mt-3.5 mx-2 ${i + 1 < step ? 'bg-orange-500/30' : 'bg-white/[0.06]'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-500/[0.07] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">
            {error}
          </div>
        )}

        {/* STEP 1 : Entreprise */}
        {step === 1 && (
          <form
            onSubmit={handleStep1}
            key="step1"
            style={{ animation: 'slide-up-fade 0.22s cubic-bezier(0.23,1,0.32,1) both' }}
          >
            <div className="bg-[#232323] border border-white/[0.07] rounded-2xl p-6 mb-4">
              <h1 className="text-white text-[20px] font-bold tracking-[-0.025em] mb-1">
                Votre entreprise
              </h1>
              <p className="text-gray-500 text-[13px] leading-relaxed mb-6">
                Ces informations apparaîtront sur vos devis et factures.
              </p>

              <div className="space-y-4">
                <div>
                  <label className={LABEL}>
                    Nom de l'entreprise <span className="text-orange-400 normal-case font-normal">*</span>
                  </label>
                  <input
                    className={INPUT}
                    value={nomEntreprise}
                    onChange={e => setNomEntreprise(e.target.value)}
                    placeholder="Ex : Traoré Construction & Fils"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>Ville</label>
                    <input className={INPUT} value={ville} onChange={e => setVille(e.target.value)} placeholder="Bamako" />
                  </div>
                  <div>
                    <label className={LABEL}>Téléphone</label>
                    <input className={INPUT} type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="+223 70 00 00 00" />
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Type d'activité</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TYPES_ACTIVITE.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTypeActivite(prev => prev === t ? '' : t)}
                        className={`px-3 py-2.5 rounded-xl text-[13px] font-medium text-left border transition-[background-color,border-color] duration-150 min-h-[44px] cursor-pointer ${
                          typeActivite === t
                            ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
                            : 'bg-white/[0.03] border-white/[0.07] text-gray-400 hover:border-white/[0.14]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || !nomEntreprise}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-[background-color,transform] duration-150 active:scale-[0.97] text-[14px] min-h-[48px] cursor-pointer"
            >
              {saving ? 'Enregistrement…' : 'Continuer →'}
            </button>
          </form>
        )}

        {/* STEP 2 : Chantier */}
        {step === 2 && (
          <form
            onSubmit={handleStep2}
            key="step2"
            style={{ animation: 'slide-up-fade 0.22s cubic-bezier(0.23,1,0.32,1) both' }}
          >
            <div className="bg-[#232323] border border-white/[0.07] rounded-2xl p-6 mb-4">
              <h1 className="text-white text-[20px] font-bold tracking-[-0.025em] mb-1">
                Premier chantier
              </h1>
              <p className="text-gray-500 text-[13px] leading-relaxed mb-6">
                Quel chantier gérez-vous en ce moment ? Vous pourrez en ajouter d'autres ensuite.
              </p>

              <div className="space-y-4">
                <div>
                  <label className={LABEL}>Nom du chantier</label>
                  <input
                    className={INPUT}
                    value={chantierNom}
                    onChange={e => setChantierNom(e.target.value)}
                    placeholder="Ex : Villa Koné — Kalaban-Coro"
                  />
                </div>
                <div>
                  <label className={LABEL}>Nom du client</label>
                  <input
                    className={INPUT}
                    value={chantierClient}
                    onChange={e => setChantierClient(e.target.value)}
                    placeholder="Ex : M. Koné Mamadou"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold py-3.5 rounded-xl transition-[background-color,transform] duration-150 active:scale-[0.97] text-[14px] min-h-[48px] mb-3 cursor-pointer"
            >
              {saving ? 'Création…' : (chantierNom && chantierClient) ? 'Créer ce chantier →' : 'Continuer sans chantier →'}
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="w-full text-gray-500 hover:text-gray-300 text-[13px] py-2 transition-colors duration-150 cursor-pointer"
            >
              Passer cette étape
            </button>
          </form>
        )}

        {/* STEP 3 : Ouvrier */}
        {step === 3 && (
          <form
            onSubmit={handleStep3}
            key="step3"
            style={{ animation: 'slide-up-fade 0.22s cubic-bezier(0.23,1,0.32,1) both' }}
          >
            <div className="bg-[#232323] border border-white/[0.07] rounded-2xl p-6 mb-4">
              <h1 className="text-white text-[20px] font-bold tracking-[-0.025em] mb-1">
                Premier ouvrier
              </h1>
              <p className="text-gray-500 text-[13px] leading-relaxed mb-6">
                Ajoutez un ouvrier pour commencer à pointer les présences.
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>Prénom</label>
                    <input className={INPUT} value={ouvrierPrenom} onChange={e => setOuvrierPrenom(e.target.value)} placeholder="Moussa" />
                  </div>
                  <div>
                    <label className={LABEL}>Nom</label>
                    <input className={INPUT} value={ouvrierNom} onChange={e => setOuvrierNom(e.target.value)} placeholder="Diallo" />
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Métier</label>
                  <input
                    className={INPUT}
                    value={ouvrierMetier}
                    onChange={e => setOuvrierMetier(e.target.value)}
                    placeholder="Ex : Maçon, Plombier, Électricien"
                  />
                </div>
                <div>
                  <label className={LABEL}>Type de contrat</label>
                  <select className={INPUT} value={ouvrierTypeContrat} onChange={e => setOuvrierTypeContrat(e.target.value)}>
                    <option value="journalier">Journalier</option>
                    <option value="hebdomadaire">Hebdomadaire</option>
                    <option value="mensuel">Mensuel</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>
                    {ouvrierTypeContrat === 'hebdomadaire' ? 'Taux hebdomadaire (FCFA)' : 'Taux journalier (FCFA)'}
                  </label>
                  <input
                    className={INPUT}
                    type="number"
                    value={ouvrierTaux}
                    onChange={e => setOuvrierTaux(e.target.value)}
                    placeholder={ouvrierTypeContrat === 'hebdomadaire' ? '25000' : '5000'}
                    min="0"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold py-3.5 rounded-xl transition-[background-color,transform] duration-150 active:scale-[0.97] text-[14px] min-h-[48px] mb-3 cursor-pointer"
            >
              {saving ? 'Ajout…' : (ouvrierPrenom && ouvrierNom) ? 'Ajouter cet ouvrier →' : 'Continuer sans ouvrier →'}
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="w-full text-gray-500 hover:text-gray-300 text-[13px] py-2 transition-colors duration-150 cursor-pointer"
            >
              Passer cette étape
            </button>
          </form>
        )}

        {/* STEP 4 : Récapitulatif */}
        {step === 4 && (
          <div
            key="step4"
            style={{ animation: 'slide-up-fade 0.22s cubic-bezier(0.23,1,0.32,1) both' }}
          >
            <div className="bg-[#232323] border border-white/[0.07] rounded-2xl p-6 mb-4">
              <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center mb-5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-emerald-400">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h1 className="text-white text-[20px] font-bold tracking-[-0.025em] mb-1">
                Votre espace est configuré
              </h1>
              <p className="text-gray-500 text-[13px] leading-relaxed mb-6">
                Voici ce qui a été mis en place.
              </p>

              <div className="space-y-2.5 mb-6">
                {[
                  { label: 'Entreprise', value: nomEntreprise || null },
                  { label: 'Premier chantier', value: chantierCreated },
                  { label: 'Premier ouvrier', value: ouvrierCreated },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                      value
                        ? 'bg-emerald-500/[0.06] border-emerald-500/20'
                        : 'bg-white/[0.02] border-white/[0.06]'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center border ${
                      value ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-transparent border-white/[0.10]'
                    }`}>
                      {value && (
                        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-2.5 h-2.5 text-emerald-400">
                          <path d="M2 6l2.5 2.5L10 3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-gray-500 text-[10px] uppercase tracking-[0.07em] font-semibold">{label}</p>
                      <p className={`text-[13px] font-medium ${value ? 'text-white' : 'text-gray-600'}`}>
                        {value ?? 'Non renseigné'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-px bg-white/[0.06] mb-5" />

              <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-[0.07em] mb-3">
                Prochaines actions
              </p>
              <div className="space-y-2">
                {[
                  { label: 'Pointer mes ouvriers', href: '/dashboard/equipes' },
                  { label: 'Créer un devis', href: '/dashboard/devis' },
                  { label: 'Voir mes chantiers', href: '/dashboard/chantiers' },
                ].map(a => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.13] text-gray-300 hover:text-white text-[13px] font-medium transition-[background-color,border-color,color] duration-150 group"
                  >
                    {a.label}
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
                      className="w-3.5 h-3.5 text-gray-600 group-hover:text-orange-400 transition-colors shrink-0">
                      <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                ))}
              </div>
            </div>

            <button
              onClick={handleComplete}
              disabled={saving}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold py-3.5 rounded-xl transition-[background-color,transform] duration-150 active:scale-[0.97] text-[14px] min-h-[48px] cursor-pointer"
            >
              {saving ? 'Finalisation…' : 'Accéder à mon dashboard →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
