'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'signup' | 'reset'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  function switchMode(m: Mode) {
    setMode(m); setError(''); setSuccess('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    const supabase = createClient()

    if (mode === 'reset') {
      const redirectTo = `${window.location.origin}/auth/update-password`
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) {
        setError(`Erreur : ${error.message}`)
      } else {
        setSuccess('Email envoyé ! Vérifiez votre boîte mail et cliquez sur le lien pour réinitialiser votre mot de passe.')
      }
      setLoading(false)
      return
    }

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message.includes('already')
          ? 'Ce compte existe déjà. Connectez-vous.'
          : `Erreur : ${error.message}`)
        setLoading(false)
        return
      }
      setSuccess('Compte créé ! Connectez-vous.')
      setMode('login')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#1C1C1C] flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(#F97316 1px, transparent 1px), linear-gradient(90deg, #F97316 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-500 rounded-full opacity-[0.06] blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-600 rounded-full opacity-[0.04] blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl shadow-2xl shadow-orange-500/30 mb-5">
            <svg viewBox="0 0 24 24" fill="none" className="w-11 h-11">
              <path d="M3 21h18" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M5 21V10L12 4l7 6v11" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 21v-5h6v5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 10h6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-[2.5rem] font-bold text-white tracking-tight leading-none">BTP Mali</h1>
          <p className="text-gray-500 mt-2.5 text-[14px]">Gestion de chantiers professionnelle</p>
        </div>

        {/* Carte */}
        <div className="bg-[#242424] rounded-2xl border border-white/[0.07] shadow-2xl p-8">

          {/* ── Vue : Mot de passe oublié ── */}
          {mode === 'reset' ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => switchMode('login')}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div>
                  <p className="text-white text-[15px] font-semibold">Mot de passe oublié</p>
                  <p className="text-gray-600 text-[11px] mt-0.5">Un lien sera envoyé à votre adresse</p>
                </div>
              </div>

              {success && (
                <div className="flex items-start gap-2.5 bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400 rounded-xl px-4 py-3 mb-5 text-[13px]">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  {success}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2.5 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 mb-5 text-[13px]">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              {!success && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                      Adresse email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="nom@entreprise.ml"
                      required
                      className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-orange-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Envoi en cours…
                      </span>
                    ) : 'Envoyer le lien de réinitialisation'}
                  </button>
                </form>
              )}

              {success && (
                <button
                  onClick={() => switchMode('login')}
                  className="w-full mt-4 py-3 rounded-xl border border-white/[0.08] text-gray-400 hover:text-white text-[13px] font-medium transition-colors"
                >
                  Retour à la connexion
                </button>
              )}
            </>
          ) : (
            /* ── Vue : Login / Signup ── */
            <>
              {/* Onglets */}
              <div className="flex bg-[#1C1C1C] rounded-xl p-1 mb-6">
                <button
                  onClick={() => switchMode('login')}
                  className={`flex-1 py-2 rounded-lg text-[13px] font-medium transition-all ${
                    mode === 'login' ? 'bg-orange-500 text-white shadow' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Se connecter
                </button>
                <button
                  onClick={() => switchMode('signup')}
                  className={`flex-1 py-2 rounded-lg text-[13px] font-medium transition-all ${
                    mode === 'signup' ? 'bg-orange-500 text-white shadow' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Créer un compte
                </button>
              </div>

              {success && (
                <div className="flex items-start gap-2.5 bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400 rounded-xl px-4 py-3 mb-5 text-[13px]">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  {success}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2.5 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 mb-5 text-[13px]">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                    Adresse email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nom@entreprise.ml"
                    required
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
                      Mot de passe
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('reset')}
                        className="text-[11px] text-gray-600 hover:text-orange-400 transition-colors"
                      >
                        Mot de passe oublié ?
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
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all"
                  />
                  {mode === 'signup' && (
                    <p className="text-gray-700 text-[11px] mt-1.5">Minimum 6 caractères</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/35 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {mode === 'signup' ? 'Création en cours…' : 'Connexion en cours…'}
                    </span>
                  ) : (
                    mode === 'signup' ? 'Créer mon compte' : 'Se connecter'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-gray-700 text-[11px] mt-8 tracking-wide">
          © {new Date().getFullYear()} BTP Mali · Tous droits réservés
        </p>
      </div>
    </div>
  )
}
