'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'btp_visited_pages'

function getVisited(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

function markVisited(key: string) {
  const v = getVisited()
  if (!v.includes(key)) localStorage.setItem(STORAGE_KEY, JSON.stringify([...v, key]))
}

export default function PageTooltip({ pageKey, message }: { pageKey: string; message: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!getVisited().includes(pageKey)) {
      const t = setTimeout(() => setVisible(true), 500)
      return () => clearTimeout(t)
    }
  }, [pageKey])

  function dismiss() {
    markVisited(pageKey)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="mb-5 cursor-pointer"
      onClick={dismiss}
      style={{ animation: 'slide-up-fade 0.22s cubic-bezier(0.23,1,0.32,1) both' }}
    >
      <div className="flex items-start gap-3 bg-orange-500/[0.07] border border-orange-500/20 rounded-xl px-4 py-3">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-orange-400 shrink-0 mt-0.5">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd"/>
        </svg>
        <p className="text-orange-300/90 text-[13px] leading-relaxed flex-1">{message}</p>
        <button
          onClick={e => { e.stopPropagation(); dismiss() }}
          className="text-orange-400/40 hover:text-orange-400 transition-colors shrink-0 mt-0.5 cursor-pointer"
          aria-label="Fermer"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <path d="M2 2l12 12M14 2L2 14" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
