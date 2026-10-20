'use client'

import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import NetworkStatus from '@/components/NetworkStatus'
import SubscriptionBanner from '@/components/SubscriptionBanner'
import UpgradeModal from '@/components/UpgradeModal'
import { SubscriptionProvider } from '@/contexts/SubscriptionContext'
import { queueCount, syncQueue } from '@/lib/offline'
import { createClient } from '@/lib/supabase/client'
import OnboardingModal from '@/components/OnboardingModal'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [syncToast, setSyncToast] = useState('')

  /* ── Synchronisation de la queue offline au retour du réseau ── */
  useEffect(() => {
    const supabase = createClient()

    async function runSync() {
      if (queueCount() === 0 || !navigator.onLine) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { ok, errors } = await syncQueue(supabase)
      if (ok === 0 && errors === 0) return

      const msg = errors === 0
        ? `${ok} action${ok > 1 ? 's' : ''} synchronisée${ok > 1 ? 's' : ''}`
        : `${ok} synchronisée${ok > 1 ? 's' : ''}, ${errors} en attente (nouvel essai au prochain retour du réseau)`

      setSyncToast(msg)
      setTimeout(() => setSyncToast(''), 4000)
    }

    // Au chargement aussi : l'appli a pu être fermée hors ligne avec des actions en file
    runSync()
    window.addEventListener('online', runSync)
    return () => window.removeEventListener('online', runSync)
  }, [])

  return (
    <SubscriptionProvider>
      <div className="min-h-screen bg-[#1C1C1C]">

        {/* Bannière abonnement / lecture seule */}
        <SubscriptionBanner />
        <UpgradeModal />

        {/* Indicateur réseau */}
        <NetworkStatus />

        {/* Onboarding modal — premier login */}
        <OnboardingModal />

        {/* Toast synchronisation */}
        {syncToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-[13px] font-semibold px-5 py-3 rounded-xl shadow-xl whitespace-nowrap animate-[toast-in_0.25s_cubic-bezier(0.23,1,0.32,1)_forwards]">
            {syncToast}
          </div>
        )}

        {/* Header mobile uniquement */}
        <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#161616] border-b border-white/[0.06] h-14 flex items-center justify-between px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.06] transition-[color,background-color] duration-150 active:scale-[0.92]"
            aria-label="Ouvrir le menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                <path d="M3 21h18M5 21V11m14 0v10M3 11l9-7 9 7M10 21v-5h4v5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-white font-bold text-[15px]">BTP Mali</span>
          </div>

          <div className="w-10" />
        </header>

        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60 animate-[fade-in_200ms_ease-out_forwards]"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Contenu principal — offset sidebar sur desktop, offset header sur mobile */}
        <main className="lg:ml-[70px] pt-14 lg:pt-0 min-h-screen">
          {children}
        </main>

      </div>
    </SubscriptionProvider>
  )
}
