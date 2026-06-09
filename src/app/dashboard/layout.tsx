'use client'

import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import NetworkStatus from '@/components/NetworkStatus'
import { queueGet, queueClear } from '@/lib/offline'
import { createClient } from '@/lib/supabase/client'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [syncToast, setSyncToast] = useState('')

  /* ── Synchronisation de la queue offline au retour du réseau ── */
  useEffect(() => {
    const supabase = createClient()

    async function syncQueue() {
      const queue = queueGet()
      if (queue.length === 0) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let ok = 0
      let errors = 0

      for (const action of queue) {
        try {
          if (action.op === 'insert') {
            const { error } = await supabase.from(action.table).insert(action.data)
            if (error) errors++; else ok++
          } else if (action.op === 'update' && action.rowId) {
            const { error } = await supabase.from(action.table).update(action.data).eq('id', action.rowId)
            if (error) errors++; else ok++
          }
        } catch {
          errors++
        }
      }

      queueClear()

      const msg = errors === 0
        ? `✅ ${ok} action${ok > 1 ? 's' : ''} synchronisée${ok > 1 ? 's' : ''}`
        : `⚠️ ${ok} synchronisée${ok > 1 ? 's' : ''}, ${errors} échouée${errors > 1 ? 's' : ''}`

      setSyncToast(msg)
      setTimeout(() => setSyncToast(''), 4000)
    }

    const handleOnline = () => syncQueue()
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  return (
    <div className="flex h-screen bg-[#1C1C1C] overflow-hidden flex-col">

      {/* Indicateur réseau */}
      <NetworkStatus />

      {/* Toast synchronisation */}
      {syncToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-[13px] font-semibold px-5 py-3 rounded-xl shadow-xl whitespace-nowrap">
          {syncToast}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Overlay sombre — mobile uniquement */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Contenu principal */}
        <main className="flex-1 overflow-y-auto min-w-0 w-full">

          {/* Header mobile avec hamburger */}
          <div className="flex items-center justify-between px-4 py-3 md:hidden bg-[#171717] border-b border-white/[0.06] sticky top-0 z-30">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              aria-label="Ouvrir le menu"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-sm">
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                  <path d="M3 21h18M5 21V11m14 0v10M3 11l9-7 9 7M10 21v-5h4v5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-white font-bold text-[15px]">BTP Mali</span>
            </div>

            <div className="w-10" />
          </div>

          {children}
        </main>
      </div>
    </div>
  )
}
