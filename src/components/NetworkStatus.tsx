'use client'

import { useEffect, useState } from 'react'
import { queueCount } from '@/lib/offline'

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    // Vérification initiale
    if (!navigator.onLine) {
      setIsOnline(false)
      setVisible(true)
      setPending(queueCount())
    }

    const onOnline = () => {
      setIsOnline(true)
      setVisible(true)
      setPending(0)
      // Auto-cache la bannière "En ligne" après 3.5s
      setTimeout(() => setVisible(false), 3500)
    }
    const onOffline = () => {
      setIsOnline(false)
      setVisible(true)
      setPending(queueCount())
    }

    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  if (!visible) return null

  return (
    <div className={`w-full py-2 px-4 text-center text-[12px] font-semibold select-none ${
      isOnline ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
    }`}>
      {isOnline
        ? 'Connexion rétablie — Données synchronisées'
        : `Hors ligne — Les données seront synchronisées au retour du réseau${pending > 0 ? ` · ${pending} action${pending > 1 ? 's' : ''} en attente` : ''}`
      }
    </div>
  )
}
