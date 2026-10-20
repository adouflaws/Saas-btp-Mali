'use client'

import { useEffect } from 'react'

export default function SWRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(err => console.warn('[SW] Erreur :', err))
    }
  }, [])
  return null
}
