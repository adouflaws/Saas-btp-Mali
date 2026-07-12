'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'signup' | 'reset'

const WA = '22376753087'
const RESET_REDIRECT = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saas-btp-mali.vercel.app') + '/auth/update-password'

function mapSignupError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('already') || m.includes('registered') || m.includes('exists'))
    return 'Cet email existe déjà. Connectez-vous ou réinitialisez votre mot de passe.'
  if ((m.includes('password') && m.includes('6')) || m.includes('too short') || m.includes('weak'))
    return 'Votre mot de passe doit contenir au moins 6 caractères.'
  if (m.includes('invalid email') || m.includes('valid email') || m.includes('email address'))
    return 'Veuillez entrer un email valide.'
  if (m.includes('rate') || m.includes('too many'))
    return 'Trop de tentatives. Réessayez dans 5 minutes.'
  if (m.includes('network') || m.includes('fetch') || m.includes('unavailable') || m.includes('503'))
    return `Service temporairement indisponible. Contactez-nous : wa.me/${WA}`
  return `Une erreur est survenue. Contactez-nous sur WhatsApp : wa.me/${WA}`
}

function mapLoginError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('wrong password') || m.includes('incorrect'))
    return 'Email ou mot de passe incorrect. Vérifiez vos informations.'
  if (m.includes('user not found') || m.includes('no user') || m.includes('not found'))
    return 'Aucun compte trouvé avec cet email. Créez un compte gratuitement.'
  if (m.includes('rate') || m.includes('too many'))
    return 'Trop de tentatives. Réessayez dans 5 minutes.'
  if (m.includes('network') || m.includes('fetch') || m.includes('unavailable'))
    return `Service temporairement indisponible. Contactez-nous : wa.me/${WA}`
  return 'Email ou mot de passe incorrect. Vérifiez vos informations.'
}

function mapResetError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('not found') || m.includes('no user') || m.includes('user not found'))
    return 'Aucun compte trouvé avec cet email.'
  if (m.includes('rate') || m.includes('too many'))
    return 'Trop de tentatives. Réessayez dans 5 minutes.'
  if (m.includes('network') || m.includes('fetch'))
    return `Service temporairement indisponible. Contactez-nous : wa.me/${WA}`
  return `Une erreur est survenue. Contactez-nous : wa.me/${WA}`
}

const INPUT_CLS =
  'w-full bg-[#0D0D0D] border border-white/[0.09] text-white placeholder-gray-600 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/[0.18] transition-[border-color,box-shadow] duration-150'

const LABEL_CLS =
  'block text-[10px] font-bold uppercase tracking-[0.09em] text-gray-600 mb-2'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [entreprise, setEntreprise] = useState('')
  const [telephone, setTelephone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  function switchMode(m: Mode) {
    setMode(m)
    setError('')
    setSuccess('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    const supabase = createClient()

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: RESET_REDIRECT })
      if (error) setError(mapResetError(error.message))
      else setSuccess('Email envoyé ! Vérifiez votre boîte mail et vos spams.')
      setLoading(false)
      return
    }

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nom: email.split('@')[0], entreprise: entreprise || 'Mon Entreprise', telephone: telephone || null } },
      })
      if (error) { setError(mapSignupError(error.message)); setLoading(false); return }
      const waMsg = encodeURIComponent(`Nouveau client inscrit !\nNom : ${entreprise || email}\nEmail : ${email}\nDate : ${new Date().toLocaleString('fr-FR')}\nhttps://saas-btp-mali.vercel.app/admin/clients`)
      console.log(`[BTP Mali] Nouveau client — WhatsApp : https://wa.me/22376753087?text=${waMsg}`)
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) { setSuccess('Compte créé ! Connectez-vous pour accéder à votre espace.'); setMode('login'); setLoading(false); return }
      router.push('/dashboard?welcome=1')
      router.refresh()
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(mapLoginError(error.message)); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  function ErrorBox({ msg }: { msg: string }) {
    return (
      <div className="flex items-start gap-2.5 bg-red-500/[0.07] border border-red-500/[0.14] text-red-400 rounded-xl px-4 py-3 mb-5 text-[13px] leading-relaxed">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        <span>{msg}</span>
      </div>
    )
  }

  function SuccessBox({ msg }: { msg: string }) {
    return (
      <div className="flex items-start gap-2.5 bg-emerald-500/[0.07] border border-emerald-500/[0.14] text-emerald-400 rounded-xl px-4 py-3 mb-5 text-[13px] leading-relaxed">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
        <span>{msg}</span>
      </div>
    )
  }

  const Spinner = () => (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )

  return (
    <div className="min-h-[100dvh] bg-[#080808] flex items-center justify-center p-6 relative overflow-hidden">

      {/* Blueprint grid — structure orthogonale ultra-subtile */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Vignette radiale : assombrit les coins, concentre le regard */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 70% at 50% 45%, transparent 0%, #080808 100%)' }}
      />

      <div className="relative w-full max-w-[400px]">

        {/* ── En-tête de marque ── */}
        <div className="mb-9">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-7 h-7 bg-orange-500 rounded-[8px] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-[15px] h-[15px]">
                <path
                  d="M3 21h18M5 21V11m14 0v10M3 11l9-7 9 7M10 21v-5h4v5"
                  stroke="white"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-600">BTP Mali</span>
          </div>

          <h1 className="text-[2rem] font-bold text-white tracking-[-0.03em] leading-[1.1]">
            Chaque chantier,<br />sous contrôle.
          </h1>

          <p className="text-gray-500 text-[12px] mt-3 tracking-[0.04em]">
            Suivi · Équipes · Finances · Terrain
          </p>
        </div>

        {/* ── Carte formulaire ── */}
        <div className="bg-[#171717] rounded-2xl border border-white/[0.06] overflow-hidden">

          {/* Vue : réinitialisation */}
          {mode === 'reset' ? (
            <div className="p-7" style={{ animation: 'slide-up-fade 0.22s cubic-bezier(0.23,1,0.32,1) both' }}>
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => switchMode('login')}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:text-white hover:bg-white/[0.06] transition-[color,background-color] duration-150 active:scale-[0.92]"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div>
                  <p className="text-white text-[14px] font-semibold leading-none">Réinitialisation</p>
                  <p className="text-gray-600 text-[11px] mt-1">Un lien sera envoyé à votre adresse</p>
                </div>
              </div>

              {success && <SuccessBox msg={success} />}
              {error && <ErrorBox msg={error} />}

              {!success && (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className={LABEL_CLS}>Adresse email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="nom@entreprise.ml"
                      required
                      autoFocus
                      className={INPUT_CLS}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.97] text-white text-[14px] font-semibold py-[11px] rounded-xl transition-[background-color,transform] duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading
                      ? <span className="flex items-center justify-center gap-2"><Spinner /> Envoi en cours…</span>
                      : 'Envoyer le lien'}
                  </button>
                </form>
              )}

              {success && (
                <button
                  onClick={() => switchMode('login')}
                  className="w-full mt-4 py-[11px] rounded-xl border border-white/[0.07] text-gray-500 hover:text-white text-[13px] font-medium transition-[color,border-color] duration-150"
                >
                  Retour à la connexion
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Onglets — style underline */}
              <div className="flex border-b border-white/[0.06] px-7 pt-5">
                {(['login', 'signup'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={[
                      'pb-3 mr-7 text-[13px] font-semibold border-b-2 -mb-px transition-[color,border-color] duration-150',
                      mode === m
                        ? 'text-white border-orange-500'
                        : 'text-gray-600 border-transparent hover:text-gray-400',
                    ].join(' ')}
                  >
                    {m === 'login' ? 'Se connecter' : 'Créer un compte'}
                  </button>
                ))}
              </div>

              {/* Corps du formulaire */}
              <div key={mode} className="p-7 pt-6" style={{ animation: 'slide-up-fade 0.22s cubic-bezier(0.23,1,0.32,1) both' }}>
                {success && <SuccessBox msg={success} />}
                {error && <ErrorBox msg={error} />}

                <form onSubmit={handleSubmit} className="space-y-5">

                  {mode === 'signup' && (
                    <>
                      <div>
                        <label className={LABEL_CLS}>Nom de l&apos;entreprise</label>
                        <input
                          type="text"
                          value={entreprise}
                          onChange={e => setEntreprise(e.target.value)}
                          placeholder="Ex : BTP Traoré & Fils"
                          className={INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Téléphone</label>
                        <input
                          type="tel"
                          value={telephone}
                          onChange={e => setTelephone(e.target.value)}
                          placeholder="+223 XX XX XX XX"
                          className={INPUT_CLS}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className={LABEL_CLS}>Adresse email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="nom@entreprise.ml"
                      required
                      className={INPUT_CLS}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={LABEL_CLS.replace('mb-2', '')}>Mot de passe</label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => switchMode('reset')}
                          className="text-[11px] text-gray-500 hover:text-orange-400 transition-colors duration-150"
                        >
                          Oublié ?
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••••"
                      required
                      minLength={6}
                      className={INPUT_CLS}
                    />
                    {mode === 'signup' && (
                      <p className="text-gray-600 text-[11px] mt-1.5">Minimum 6 caractères</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.97] text-white text-[14px] font-semibold py-[11px] rounded-xl transition-[background-color,transform] duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner />
                        {mode === 'signup' ? 'Création en cours…' : 'Connexion en cours…'}
                      </span>
                    ) : (
                      mode === 'signup' ? 'Créer mon compte' : 'Se connecter'
                    )}
                  </button>
                </form>

                {/* Badges inscription gratuite */}
                {mode === 'signup' && (
                  <>
                    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mt-5 pt-5 border-t border-white/[0.04]">
                      {['14 jours gratuits', 'Accès immédiat', 'Sans carte'].map(badge => (
                        <span key={badge} className="flex items-center gap-1.5 text-emerald-500/80 text-[11px] font-medium">
                          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 shrink-0">
                            <path d="M2 6l2.5 2.5L10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          {badge}
                        </span>
                      ))}
                    </div>
                    <p className="text-gray-600 text-[11px] text-center mt-4 leading-relaxed px-2">
                      En créant un compte, vous acceptez nos{' '}
                      <Link href="/cgu" className="text-gray-500 hover:text-orange-400 underline underline-offset-2 transition-colors duration-150">
                        Conditions Générales d&apos;Utilisation
                      </Link>
                      {' '}et notre{' '}
                      <Link href="/confidentialite" className="text-gray-500 hover:text-orange-400 underline underline-offset-2 transition-colors duration-150">
                        Politique de Confidentialité
                      </Link>
                      .
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Pied de page ── */}
        <div className="mt-5 flex items-center justify-between px-1">
          <a
            href={`https://wa.me/${WA}?text=${encodeURIComponent("Bonjour BTP Mali, j'ai un problème de connexion.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors duration-150 inline-flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 shrink-0">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.533 5.855L0 24l6.335-1.521A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.013-1.376l-.36-.213-3.727.895.944-3.637-.234-.373A9.818 9.818 0 1112 21.818z" />
            </svg>
            Support WhatsApp
          </a>
          <Link
            href="/tarifs"
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors duration-150"
          >
            Tarifs →
          </Link>
        </div>

      </div>
    </div>
  )
}
