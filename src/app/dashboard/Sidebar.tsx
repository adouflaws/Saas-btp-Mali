'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const navItems: Array<{ href: string; label: string; icon: React.ReactNode }> = [
  {
    href: '/dashboard',
    label: 'Tableau de bord',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1.5" strokeLinejoin="round" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" strokeLinejoin="round" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" strokeLinejoin="round" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/chantiers',
    label: 'Chantiers',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path d="M3 21h18M5 21V11m14 0v10M10 21v-5h4v5M3 11l9-7 9 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/planning',
    label: 'Planning',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <rect x="3" y="4" width="18" height="18" rx="2" strokeLinejoin="round" />
        <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" strokeLinecap="round" strokeWidth="2.2" />
      </svg>
    ),
  },
  {
    href: '/dashboard/equipes',
    label: 'Équipes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/devis',
    label: 'Devis',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinejoin="round" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/factures',
    label: 'Factures',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/creances',
    label: 'Créances',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round"/>
        <circle cx="18" cy="5" r="3" fill="currentColor" stroke="none" className="text-red-400"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/budget',
    label: 'Budget',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/carburant',
    label: 'Carburant',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path d="M3 22V6a2 2 0 012-2h8a2 2 0 012 2v16" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 22h12" strokeLinecap="round"/>
        <path d="M3 11h12" strokeLinecap="round"/>
        <path d="M15 7h2a2 2 0 012 2v2.5a1.5 1.5 0 003 0V7l-3-3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/tarifs',
    label: 'Abonnement',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/parametres',
    label: 'Paramètres',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

type SidebarProps = {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const SUPER_ADMIN_EMAILS = ['adouflaws@gmail.com']
      setIsSuperAdmin(!!user?.email && SUPER_ADMIN_EMAILS.includes(user.email))
    })
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-50',
        'bg-[#171717] border-r border-white/[0.06]',
        'flex flex-col h-full overflow-hidden',
        'transition-all duration-300 ease-in-out',
        'w-[250px]',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0 lg:w-[70px] lg:hover:w-[250px]',
        'group',
      ].join(' ')}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/[0.06] flex items-center justify-between min-h-[64px]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/15 shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
              <path
                d="M3 21h18M5 21V11m14 0v10M3 11l9-7 9 7M10 21v-5h4v5"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="min-w-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
            <p className="text-white font-bold text-[15px] leading-none whitespace-nowrap">BTP Mali</p>
            <p className="text-gray-600 text-[11px] mt-0.5 whitespace-nowrap">Gestion de chantiers</p>
          </div>
        </div>

        {/* Bouton fermer — mobile seulement */}
        <button
          onClick={onClose}
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-[color,background-color] duration-150 active:scale-[0.92] shrink-0 ml-2"
          aria-label="Fermer le menu"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M2 2l12 12M14 2L2 14" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-[color,background-color] duration-150 active:scale-[0.98] group/item ${
                isActive
                  ? 'bg-orange-500/10 text-orange-400'
                  : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.05]'
              }`}
            >
              <span
                className={`transition-colors duration-150 shrink-0 ${
                  isActive
                    ? 'text-orange-400'
                    : 'text-gray-600 group-hover/item:text-gray-400'
                }`}
              >
                {item.icon}
              </span>
              <span className="flex-1 whitespace-nowrap lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">{item.label}</span>
              {isActive && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200"
                  style={{ animation: 'scale-in-fade 0.18s cubic-bezier(0.23,1,0.32,1) both' }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Lien Admin — visible uniquement pour super_admin */}
      {isSuperAdmin && (
        <div className="px-2.5 pb-2 border-t border-white/[0.06] pt-3">
          <Link
            href="/admin/clients"
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-[color,background-color] duration-150 active:scale-[0.98] group/item ${
              pathname.startsWith('/admin')
                ? 'bg-purple-500/10 text-purple-400'
                : 'text-gray-600 hover:text-gray-300 hover:bg-white/[0.05]'
            }`}
          >
            <span className={`transition-colors duration-150 shrink-0 ${pathname.startsWith('/admin') ? 'text-purple-400' : 'text-gray-700 group-hover/item:text-gray-500'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                <circle cx="12" cy="8" r="4" strokeLinecap="round"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 8l1.5-1.5M19 5l1.5-1.5M19 11h2M17 14l1.5 1.5" strokeLinecap="round"/>
              </svg>
            </span>
            <span className="flex-1 whitespace-nowrap lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">Admin</span>
          </Link>
        </div>
      )}

      {/* Déconnexion */}
      <div className="px-2.5 py-4 border-t border-white/[0.06]">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium text-gray-500 hover:text-red-400 hover:bg-red-500/[0.07] transition-[color,background-color] duration-150 active:scale-[0.97] group/item"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="w-5 h-5 text-gray-600 group-hover/item:text-red-400 transition-colors shrink-0"
          >
            <path
              d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="whitespace-nowrap lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">Déconnexion</span>
        </button>
      </div>
    </aside>
  )
}
