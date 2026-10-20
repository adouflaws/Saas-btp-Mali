import { useSyncExternalStore } from 'react'
import { QUEUE_EVENT, queueCount } from '@/lib/offline'

function subscribe(onChange: () => void) {
  window.addEventListener(QUEUE_EVENT, onChange)
  window.addEventListener('storage', onChange) // file modifiée depuis un autre onglet
  return () => {
    window.removeEventListener(QUEUE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

// Nombre d'actions hors ligne en attente de synchronisation (0 côté serveur).
export function useQueueCount(): number {
  return useSyncExternalStore(subscribe, queueCount, () => 0)
}
