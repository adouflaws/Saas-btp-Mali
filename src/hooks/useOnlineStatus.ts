import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

// En ligne / hors ligne. Côté serveur on suppose « en ligne » : Node 21+ expose un
// `navigator` sans `onLine`, ce qui faisait rendre le bandeau hors ligne au serveur
// et provoquait un écart d'hydratation.
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}
