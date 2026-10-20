'use client'

import { useEffect, useState } from 'react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useQueueCount } from '@/hooks/useQueueCount'

export default function NetworkStatus() {
  const isOnline = useOnlineStatus()
  const pending = useQueueCount()
  // Bannière verte « Connexion rétablie », affichée 3,5 s après un retour du réseau
  const [retabli, setRetabli] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const onOnline = () => {
      setRetabli(true)
      clearTimeout(timer)
      timer = setTimeout(() => setRetabli(false), 3500)
    }
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('online', onOnline)
      clearTimeout(timer)
    }
  }, [])

  if (isOnline && !retabli) return null

  return (
    <div className={`w-full py-2 px-4 text-center text-[12px] font-semibold select-none ${
      isOnline ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
    }`}>
      {isOnline
        // Le résultat réel de la synchronisation est annoncé par le toast du layout
        ? 'Connexion rétablie — synchronisation en cours'
        : `Hors ligne — Les données seront synchronisées au retour du réseau${pending > 0 ? ` · ${pending} action${pending > 1 ? 's' : ''} en attente` : ''}`
      }
    </div>
  )
}
