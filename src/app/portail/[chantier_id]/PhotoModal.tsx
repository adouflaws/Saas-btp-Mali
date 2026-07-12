'use client'

import { useState, useCallback, useEffect } from 'react'

type Photo = { id: string; url: string; nom: string | null; legende: string | null; prise_le: string }

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PhotoModal({ photos }: { photos: Photo[] }) {
  const [index, setIndex] = useState<number | null>(null)

  const close = useCallback(() => setIndex(null), [])
  const prev  = useCallback(() => setIndex(i => (i !== null && i > 0 ? i - 1 : i)), [])
  const next  = useCallback(() => setIndex(i => (i !== null && i < photos.length - 1 ? i + 1 : i)), [photos.length])

  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     close()
      if (e.key === 'ArrowLeft')  prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, close, prev, next])

  if (photos.length === 0) {
    return (
      <div className="py-10 text-center">
        <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-gray-300">
            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-[#6B7280] text-sm">Aucune photo pour ce chantier</p>
      </div>
    )
  }

  return (
    <>
      {/* ── Grille 2 colonnes ── */}
      <div className="grid grid-cols-2 gap-3">
        {photos.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setIndex(i)}
            className="text-left focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 rounded-xl"
          >
            {/* Image */}
            <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.nom ?? `Photo ${i + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
              />
            </div>

            {/* Légende + date SOUS la photo */}
            <div className="mt-2 px-0.5">
              {p.legende && (
                <p className="text-[#1C1C1C] text-[12px] font-medium leading-tight truncate">{p.legende}</p>
              )}
              <p className="text-[#6B7280] text-[11px] mt-0.5">{fmtDate(p.prise_le)}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Modal ── */}
      {index !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/90 p-0 sm:p-4"
          onClick={close}
        >
          <div
            className="bg-[#111] w-full sm:w-auto sm:max-w-3xl rounded-t-3xl sm:rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle mobile */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-white/40 text-[12px] tabular-nums">
                {index + 1} / {photos.length}
              </p>
              <button
                onClick={close}
                className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                aria-label="Fermer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-white">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Image */}
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photos[index].url}
                alt={photos[index].nom ?? `Photo ${index + 1}`}
                className="w-full max-h-[60vh] object-contain"
              />

              {/* Prev */}
              {index > 0 && (
                <button
                  onClick={prev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors"
                  aria-label="Photo precedente"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-white">
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}

              {/* Next */}
              {index < photos.length - 1 && (
                <button
                  onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors"
                  aria-label="Photo suivante"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-white">
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Info photo */}
            <div className="px-4 py-4">
              {photos[index].legende && (
                <p className="text-white/80 text-[13px] font-medium mb-1">{photos[index].legende}</p>
              )}
              <p className="text-white/40 text-[12px]">{fmtDate(photos[index].prise_le)}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
