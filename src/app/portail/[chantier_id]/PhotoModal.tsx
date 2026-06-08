'use client'

import { useState } from 'react'

type Photo = { id: string; url: string; nom: string | null; legende: string | null; prise_le: string }

function relativeTime(dateStr: string): string {
  const now  = new Date()
  const date = new Date(dateStr)
  const diffMs    = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays  = Math.floor(diffHours / 24)
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (diffHours < 1)  return 'Il y a moins d\'une heure'
  if (diffDays === 0) return `Aujourd'hui à ${time}`
  if (diffDays === 1) return `Hier à ${time}`
  if (diffDays < 7)   return `Il y a ${diffDays} jours`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PhotoModal({ photos }: { photos: Photo[] }) {
  const [modal, setModal] = useState<Photo | null>(null)

  if (photos.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-8 h-8 text-orange-300">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-gray-600 text-[14px] font-semibold mb-1">Aucune photo pour l'instant</p>
        <p className="text-gray-400 text-[12px]">Les photos seront ajoutées prochainement</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map(photo => (
          <button
            key={photo.id}
            onClick={() => setModal(photo)}
            className="group relative aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.nom ?? 'Photo chantier'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent">
              <div className="absolute bottom-0 left-0 right-0 px-2 py-2">
                <p className="text-white text-[10px] font-medium leading-tight">{relativeTime(photo.prise_le)}</p>
                {photo.legende && <p className="text-white/70 text-[9px] truncate mt-0.5">{photo.legende}</p>}
              </div>
            </div>
          </button>
        ))}
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModal(null)}
        >
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={modal.url} alt={modal.nom ?? ''} className="w-full rounded-2xl shadow-2xl" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-4 rounded-b-2xl">
              <p className="text-white text-[12px] font-semibold">{relativeTime(modal.prise_le)}</p>
              {modal.legende && <p className="text-white/70 text-[11px] mt-0.5">{modal.legende}</p>}
            </div>
            <button
              onClick={() => setModal(null)}
              className="absolute top-3 right-3 w-9 h-9 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" className="w-4 h-4">
                <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
