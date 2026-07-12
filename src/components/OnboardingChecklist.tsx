'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Item = { label: string; done: boolean; href: string; cta: string }

export default function OnboardingChecklist() {
  const [items, setItems] = useState<Item[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('entreprise_id').eq('id', user.id).maybeSingle()
      const eid = profile?.entreprise_id
      if (!eid) return
      const { data: e } = await supabase
        .from('entreprises').select('onboarding_complete').eq('id', eid).maybeSingle()
      if (e?.onboarding_complete === true) return

      const [
        { count: chantiersN },
        { count: ouvriersN },
        { count: devisN },
      ] = await Promise.all([
        supabase.from('chantiers').select('*', { count: 'exact', head: true }).eq('entreprise_id', eid),
        supabase.from('ouvriers').select('*', { count: 'exact', head: true }).eq('entreprise_id', eid),
        supabase.from('devis').select('*', { count: 'exact', head: true }).eq('entreprise_id', eid),
      ])

      setItems([
        { label: 'Compte créé',            done: true,                    href: '#',                         cta: '' },
        { label: 'Entreprise configurée',  done: true,                    href: '#',                         cta: '' },
        { label: 'Premier chantier',       done: (chantiersN ?? 0) > 0,  href: '/dashboard/chantiers',      cta: 'Créer' },
        { label: 'Ouvriers ajoutés',       done: (ouvriersN ?? 0) > 0,   href: '/dashboard/equipes',        cta: 'Ajouter' },
        { label: 'Premier devis',          done: (devisN ?? 0) > 0,       href: '/dashboard/devis',          cta: 'Créer' },
        { label: 'Portail client partagé', done: false,                   href: '/dashboard/chantiers',      cta: 'Partager' },
      ])
      setVisible(true)
    }
    load()
  }, [])

  if (!visible || items.length === 0) return null

  const done = items.filter(i => i.done).length
  const pct = Math.round((done / items.length) * 100)

  return (
    <div
      className="mx-4 sm:mx-6 lg:mx-8 mb-8 bg-[#232323] border border-white/[0.07] rounded-2xl p-5 opacity-0"
      style={{ animation: 'slide-up-fade 0.3s cubic-bezier(0.23,1,0.32,1) 200ms forwards' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-[14px]">Finalisez votre configuration</h3>
          <p className="text-gray-500 text-[12px] mt-0.5">{done} sur {items.length} étapes complétées</p>
        </div>
        <span className="text-orange-400 font-bold text-[13px] tabular-nums shrink-0 ml-3">{pct}%</span>
      </div>

      <div className="h-1 bg-white/[0.06] rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-orange-500 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center border ${
              item.done ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-transparent border-white/[0.10]'
            }`}>
              {item.done && (
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-2.5 h-2.5 text-emerald-400">
                  <path d="M2 6l2.5 2.5L10 3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span className={`flex-1 text-[13px] ${item.done ? 'text-gray-600 line-through' : 'text-gray-300'}`}>
              {item.label}
            </span>
            {!item.done && item.href !== '#' && (
              <Link
                href={item.href}
                className="text-orange-400 hover:text-orange-300 text-[12px] font-medium transition-colors duration-150 shrink-0"
              >
                {item.cta} →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
