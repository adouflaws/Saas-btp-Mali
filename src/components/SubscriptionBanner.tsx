'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSubscription } from '@/contexts/SubscriptionContext'

export default function SubscriptionBanner() {
  const [joursRestants, setJoursRestants] = useState<number | null>(null)
  const [statut, setStatut] = useState('')
  const { setIsReadOnly } = useSubscription()

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('entreprise_id')
        .eq('id', user.id)
        .maybeSingle()
      if (!profile?.entreprise_id) return

      const { data: entreprise } = await supabase
        .from('entreprises')
        .select('statut_abonnement, date_fin_abonnement')
        .eq('id', profile.entreprise_id)
        .maybeSingle()
      if (!entreprise) return

      const jours = entreprise.date_fin_abonnement
        ? Math.ceil((new Date(entreprise.date_fin_abonnement).getTime() - Date.now()) / 86400000)
        : 0

      setJoursRestants(jours)
      setStatut(entreprise.statut_abonnement)

      const expired = jours <= 0 && entreprise.statut_abonnement !== 'actif'
      setIsReadOnly(expired)
    }

    check()
  }, [setIsReadOnly])

  if (statut === 'actif' || joursRestants === null) return null

  // Mode lecture seule — compte expiré
  if (joursRestants <= 0 && statut !== 'actif') {
    return (
      <div className="bg-orange-500 text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 shrink-0">
            <rect x="5" y="9" width="10" height="8" rx="1.5" strokeLinejoin="round" />
            <path d="M8 9V6a2 2 0 014 0v3" strokeLinecap="round" />
          </svg>
          <div>
            <p className="font-bold text-sm">Mode lecture seule</p>
            <p className="text-xs opacity-90">Votre abonnement a expiré. Vos données sont conservées.</p>
          </div>
        </div>
        <a
          href="/tarifs"
          className="bg-white text-orange-500 px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap shrink-0 ml-4"
        >
          Réactiver →
        </a>
      </div>
    )
  }

  // Avertissement — expire dans 1-3 jours
  if (joursRestants > 0 && joursRestants <= 3) {
    return (
      <div className="bg-red-600 text-white px-4 py-2 text-sm flex items-center justify-between shrink-0">
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 shrink-0">
            <path d="M8 2L1.5 13.5h13L8 2z" strokeLinejoin="round" strokeLinecap="round"/>
            <path d="M8 6.5v3M8 11.5v.5" strokeLinecap="round"/>
          </svg>
          Plus que {joursRestants} jour{joursRestants > 1 ? 's' : ''} ! Vos données restent sauvegardées.
        </span>
        <a href="/tarifs" className="bg-white text-red-600 px-3 py-1 rounded-lg font-bold text-xs ml-4 whitespace-nowrap">
          Choisir mon plan →
        </a>
      </div>
    )
  }

  // Avertissement — expire dans 4-7 jours
  if (joursRestants >= 4 && joursRestants <= 7) {
    return (
      <div className="bg-orange-500 text-white px-4 py-2 text-sm flex items-center justify-between shrink-0">
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 shrink-0">
            <circle cx="8" cy="8" r="6.5"/>
            <path d="M8 5v3.5l2 2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Essai gratuit : {joursRestants} jours restants
        </span>
        <a href="/tarifs" className="bg-white text-orange-500 px-3 py-1 rounded-lg font-bold text-xs ml-4 whitespace-nowrap">
          Choisir mon plan →
        </a>
      </div>
    )
  }

  return null
}
