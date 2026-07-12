'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)
  const [expired, setExpired] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout>

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        clearTimeout(timer)
        setReady(true)
        setExpired(false)
      }
    })

    // Vérifie la session existante immédiatement
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        clearTimeout(timer)
        setReady(true)
      }
    })

    // Après 4s sans session → lien expiré
    timer = setTimeout(() => {
      setExpired(true)
    }, 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (password.length < 6) {
      setError('Votre mot de passe doit contenir au moins 6 caractères.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      const m = error.message.toLowerCase()
      if (m.includes('expired') || m.includes('invalid') || m.includes('token')) {
        setError('Ce lien a expiré. Demandez un nouveau lien de réinitialisation.')
        setExpired(true)
        setReady(false)
      } else {
        setError('Une erreur est survenue. Contactez-nous sur WhatsApp : wa.me/22376753087')
      }
      setLoading(false)
      return
    }
    setSuccess(true)
    setLoading(false)
    setTimeout(() => router.push('/login'), 2000)
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

      <div className="relative w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-500 rounded-3xl shadow-2xl shadow-orange-500/30 mb-5">
            <svg viewBox="0 0 24 24" fill="none" className="w-11 h-11">
              <path d="M3 21h18" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M5 21V10L12 4l7 6v11" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 21v-5h6v5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 10h6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-[2.5rem] font-bold text-white tracking-tight leading-none">BTP Mali</h1>
          <p className="text-gray-500 mt-2.5 text-[14px]">Réinitialisation du mot de passe</p>
        </div>

        <div className="bg-[#242424] rounded-2xl border border-white/[0.07] shadow-2xl p-8">

          {/* ── Succès ── */}
          {success ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7 text-emerald-400">
                  <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-white text-[15px] font-semibold mb-1">Mot de passe mis à jour ✅</p>
              <p className="text-gray-500 text-[13px]">Redirection vers la connexion…</p>
            </div>

          ) : expired ? (
            /* ── Lien expiré ── */
            <div className="text-center py-2">
              <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7 text-orange-400">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-white text-[15px] font-semibold mb-2">Ce lien a expiré</p>
              <p className="text-gray-500 text-[13px] mb-6 leading-relaxed">
                Demandez un nouveau lien de réinitialisation depuis la page de connexion.
              </p>
              <button
                onClick={() => router.push('/login')}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-orange-500/25 text-[14px]"
              >
                Renvoyer un lien →
              </button>
            </div>

          ) : !ready ? (
            /* ── Chargement ── */
            <div className="text-center py-8">
              <svg className="animate-spin w-6 h-6 text-orange-400 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-gray-500 text-[13px]">Vérification du lien…</p>
            </div>

          ) : (
            /* ── Formulaire ── */
            <>
              <div className="mb-6">
                <p className="text-white text-[15px] font-semibold">Nouveau mot de passe</p>
                <p className="text-gray-600 text-[12px] mt-1">Choisissez un mot de passe d&apos;au moins 6 caractères.</p>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-500/[0.08] border border-red-500/20 text-red-400 rounded-xl px-4 py-3 mb-5 text-[13px]">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    required
                    minLength={6}
                    autoFocus
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-[border-color,box-shadow] duration-150"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                    Confirmer le mot de passe
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••••"
                    required
                    minLength={6}
                    className={`w-full bg-[#1C1C1C] border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-[border-color,box-shadow] duration-150 text-white placeholder-gray-600 ${
                      confirm && confirm !== password
                        ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/15'
                        : confirm && confirm === password && password.length >= 6
                        ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/15'
                        : 'border-white/[0.08] focus:border-orange-500 focus:ring-orange-500/20'
                    }`}
                  />
                  {confirm && confirm !== password && (
                    <p className="text-red-400 text-[11px] mt-1.5">Les mots de passe ne correspondent pas</p>
                  )}
                  {confirm && confirm === password && password.length >= 6 && (
                    <p className="text-emerald-400 text-[11px] mt-1.5">✅ Les mots de passe correspondent</p>
                  )}
                </div>

                {/* Indicateur de force */}
                {password && (
                  <div className="space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map(i => {
                        const strength = Math.min(4, Math.floor(password.length / 3))
                        return (
                          <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${
                            i <= strength
                              ? strength >= 4 ? 'bg-emerald-500' : strength >= 3 ? 'bg-amber-500' : 'bg-orange-500'
                              : 'bg-white/[0.08]'
                          }`} />
                        )
                      })}
                    </div>
                    <p className="text-gray-700 text-[10px]">
                      {password.length < 6 ? 'Trop court' : password.length < 9 ? 'Faible' : password.length < 12 ? 'Correct' : 'Fort'}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || password.length < 6 || (!!confirm && confirm !== password)}
                  className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.97] text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-orange-500/25 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Mise à jour…
                    </span>
                  ) : 'Enregistrer le mot de passe'}
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
