'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingModal() {
  const [show, setShow] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('btp_modal_dismissed')) return
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('entreprise_id').eq('id', user.id).maybeSingle()
      if (!profile?.entreprise_id) return
      const { data: e } = await supabase
        .from('entreprises')
        .select('onboarding_complete')
        .eq('id', profile.entreprise_id)
        .maybeSingle()
      if (e?.onboarding_complete === true) return
      const { count } = await supabase
        .from('chantiers')
        .select('*', { count: 'exact', head: true })
        .eq('entreprise_id', profile.entreprise_id)
      if ((count ?? 0) === 0) setShow(true)
    }
    check()
  }, [])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div
        className="bg-[#232323] border border-white/[0.08] rounded-2xl p-8 max-w-[420px] w-full"
        style={{ animation: 'slide-up-fade 0.25s cubic-bezier(0.23,1,0.32,1) both' }}
      >
        <div className="w-11 h-11 bg-orange-500/15 rounded-xl flex items-center justify-center mb-6">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
            strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-orange-400">
            <path d="M3 21h18M5 21V11m14 0v10M3 11l9-7 9 7M10 21v-5h4v5"/>
          </svg>
        </div>

        <h2 className="text-white text-[22px] font-bold tracking-[-0.025em] leading-snug mb-2">
          Bienvenue sur BTP Mali
        </h2>
        <p className="text-gray-400 text-[14px] leading-relaxed mb-8">
          Configurons votre espace en 5 minutes pour que vous puissiez gérer vos chantiers dès aujourd'hui.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => { setShow(false); router.push('/dashboard/onboarding') }}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3.5 rounded-xl font-semibold text-[14px] transition-[background-color,transform] duration-150 active:scale-[0.97] min-h-[48px] cursor-pointer"
          >
            Configurer mon espace →
          </button>
          <button
            onClick={() => {
              sessionStorage.setItem('btp_modal_dismissed', '1')
              setShow(false)
            }}
            className="text-gray-500 hover:text-gray-300 text-[13px] transition-colors duration-150 py-2 cursor-pointer"
          >
            Je le ferai plus tard
          </button>
        </div>
      </div>
    </div>
  )
}
