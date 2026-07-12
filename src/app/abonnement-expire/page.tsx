'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const WA = '22376753087'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '35 000',
    desc: 'Artisan / 1–5 personnes',
    features: ['2 chantiers actifs', 'Devis & factures', '3 utilisateurs'],
    color: 'border-white/[0.1]',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '70 000',
    desc: 'PME 5–20 personnes',
    features: ['10 chantiers', 'Gestion ouvriers & paie', 'Stocks & carburant', '15 utilisateurs'],
    color: 'border-orange-500/50',
    featured: true,
  },
  {
    id: 'entreprise',
    name: 'Entreprise',
    price: '125 000',
    desc: '20–100 personnes',
    features: ['Chantiers illimités', 'Utilisateurs illimités', 'Support 24/7'],
    color: 'border-white/[0.1]',
  },
]

export default function AbonnementExpirePage() {
  const [email, setEmail] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email)
    })
  }, [])

  function waLink(plan: string) {
    const msg = `Bonjour, mon essai BTP Mali de 14 jours est terminé. Je souhaite souscrire au plan ${plan} pour continuer. Email : ${email}`
    return `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`
  }

  return (
    <div className="min-h-[100dvh] bg-[#1C1C1C] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-4 py-4 flex items-center justify-center">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
              <path d="M3 21h18M5 21V11m14 0v10M3 11l9-7 9 7M10 21v-5h4v5"
                stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-bold text-[17px]">BTP Mali</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-start px-4 py-12 max-w-2xl mx-auto w-full">

        {/* Illustration */}
        <div className="w-20 h-20 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-center mb-6">
          <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-orange-400">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Titre */}
        <h1 className="text-2xl sm:text-3xl font-semibold text-white text-center tracking-[-0.03em] mb-3">
          Votre essai gratuit est terminé
        </h1>

        {/* Message rassurant */}
        <div className="bg-emerald-500/[0.08] border border-emerald-500/20 rounded-xl px-5 py-4 mb-8 text-center max-w-md">
          <p className="text-emerald-400 text-[14px] leading-relaxed flex items-start gap-2 justify-center">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 shrink-0 mt-0.5">
              <rect x="3" y="7" width="10" height="8" rx="1.5" strokeLinejoin="round"/>
              <path d="M5.5 7V5a2.5 2.5 0 015 0v2" strokeLinecap="round"/>
            </svg>
            <span>Vos données sont en sécurité et seront restaurées dès l&apos;activation de votre abonnement.</span>
          </p>
          <p className="text-gray-500 text-[13px] mt-2">
            Vous avez utilisé BTP Mali pendant 14 jours. Choisissez un plan pour continuer.
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-8">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className={`relative bg-[#242424] border rounded-xl p-5 flex flex-col ${plan.color} ${
                plan.featured ? 'ring-1 ring-orange-500/30' : ''
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    Le plus populaire
                  </span>
                </div>
              )}
              <div className="mb-3">
                <h3 className="font-semibold text-white text-[16px] tracking-[-0.02em]">{plan.name}</h3>
                <p className="text-gray-500 text-[11px] mt-0.5">{plan.desc}</p>
              </div>
              <div className="mb-4">
                <span className="text-2xl font-bold text-white tracking-[-0.03em]">{plan.price}</span>
                <span className="text-gray-500 text-[12px] ml-1">FCFA/mois</span>
              </div>
              <ul className="space-y-1.5 mb-5 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-gray-400 text-[12px]">
                    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-emerald-400 shrink-0">
                      <path d="M3 8l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={waLink(plan.name)}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full py-2.5 rounded-xl text-[13px] font-semibold text-center transition-[color,background-color,box-shadow,transform] active:scale-[0.97] ${
                  plan.featured
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700'
                    : 'bg-white/[0.06] text-white hover:bg-white/[0.1] border border-white/[0.08]'
                }`}
              >
                Choisir {plan.name}
              </a>
            </div>
          ))}
        </div>

        {/* CTA principal */}
        <Link
          href="/tarifs"
          className="w-full max-w-sm flex items-center justify-center gap-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 rounded-xl transition-[color,background-color,box-shadow,transform] active:scale-[0.97] shadow-xl shadow-orange-500/25 text-[15px]"
        >
          Payer maintenant →
        </Link>

        <p className="text-gray-600 text-[12px] mt-4 text-center">
          Activation immédiate après confirmation du paiement
        </p>

        <div className="mt-8 pt-6 border-t border-white/[0.05] w-full text-center">
          <Link href="/login" className="text-gray-600 hover:text-gray-400 text-[12px] transition-colors">
            Se déconnecter et changer de compte
          </Link>
        </div>
      </div>
    </div>
  )
}
