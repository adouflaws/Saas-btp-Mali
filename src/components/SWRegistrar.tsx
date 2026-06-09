'use client'

import { useEffect } from 'react'

export default function SWRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(reg => console.log('[SW] Enregistré :', reg.scope))
        .catch(err => console.warn('[SW] Erreur :', err))
    }
  }, [])
  return null
}
