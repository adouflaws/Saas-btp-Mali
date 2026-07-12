'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import OnboardingChecklist from '@/components/OnboardingChecklist'
import PageSkeleton from '@/components/PageSkeleton'

function WelcomeToast() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (searchParams.get('welcome') === '1') {
      setShow(true)
      router.replace('/dashboard', { scroll: false })
      setTimeout(() => setShow(false), 5000)
    }
  }, [searchParams, router])

  if (!show) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-[13px] font-semibold px-6 py-3.5 rounded-xl shadow-xl whitespace-nowrap animate-[toast-in_0.25s_cubic-bezier(0.23,1,0.32,1)_forwards]">
      Bienvenue ! Votre essai gratuit de 14 jours a commencé.
    </div>
  )
}

type Stats = {
  chantiers: number
  ouvriers: number
  factures: number
  nonPointesAujourdHui: number
  facturesEnRetard: number
  montantEnRetard: number
  caMois: number
  joursRestants: number | null
  statut: string
  facturesEnCoursMontant: number
  encaisseMoisMontant: number
}

type Alerte = { label: string; href: string }

function formatFCFA(n: number): string {
  if (n === 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')} M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} K`
  return n.toLocaleString('fr-FR')
}

// Formatage avec un espace normal (U+0020) — toLocaleString('fr-FR') utilise
// une espace fine insécable (U+202F) qui pose problème à l'affichage.
function fcfaEspace(v: number): string {
  const n = Math.round(v)
  const digits = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${n < 0 ? '-' : ''}${digits} FCFA`
}

/* ── Activité récente ── */
type ActivityIconType = 'devis' | 'chantier' | 'facture' | 'stock' | 'pointage'

function ActivityIcon({ type }: { type: ActivityIconType }) {
  if (type === 'devis') return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M9.5 1.5H4a1 1 0 00-1 1v11a1 1 0 001 1h8a1 1 0 001-1V5l-3.5-3.5z"/>
      <path d="M9 1.5V5h3.5M5 8h6M5 10.5h4"/>
    </svg>
  )
  if (type === 'chantier') return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M2 14h12M3.5 14V7.5m9 0V14M2 7.5l6-5 6 5M6.5 14v-3.5h3V14"/>
    </svg>
  )
  if (type === 'stock') return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M8 1.5l6 3.25v6.5L8 14.5l-6-3.25v-6.5L8 1.5z"/>
      <path d="M2 4.75L8 8m0 0l6-3.25M8 8v6.5"/>
    </svg>
  )
  if (type === 'pointage') return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="8" cy="8" r="6"/>
      <path d="M8 5v3.5l2.5 1.5"/>
    </svg>
  )
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="2" y="2" width="12" height="12" rx="1.5"/>
      <path d="M5 6h6M5 8.5h6M5 11h3.5"/>
    </svg>
  )
}

type ActivityItem = { iconType: ActivityIconType; label: string; time: string; href: string }

function ActiviteRecente() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setChecked(true); return }
      const { data: profile } = await supabase.from('profiles').select('entreprise_id').eq('id', user.id).maybeSingle()
      const eid = profile?.entreprise_id
      if (!eid) { setChecked(true); return }

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoISO = sevenDaysAgo.toISOString()
      const todayStr = new Date().toISOString().split('T')[0]

      const { data: entrepriseChantiers } = await supabase.from('chantiers').select('id').eq('entreprise_id', eid)
      const chantierIds = (entrepriseChantiers ?? []).map(c => c.id)

      const [
        { data: devis },
        { data: devisAcceptes },
        { data: chantiers },
        { data: factures },
        { data: facturesPayees },
        { data: sorties },
        { data: pointagesToday },
      ] = await Promise.all([
        supabase.from('devis').select('created_at, numero').eq('entreprise_id', eid).gte('created_at', sevenDaysAgoISO).order('created_at', { ascending: false }).limit(5),
        supabase.from('devis').select('numero, date_signature, signe_par').eq('entreprise_id', eid).eq('statut', 'accepte').not('date_signature', 'is', null).gte('date_signature', sevenDaysAgoISO).order('date_signature', { ascending: false }).limit(5),
        supabase.from('chantiers').select('id, created_at, nom').eq('entreprise_id', eid).gte('created_at', sevenDaysAgoISO).order('created_at', { ascending: false }).limit(5),
        supabase.from('factures').select('created_at, numero').eq('entreprise_id', eid).gte('created_at', sevenDaysAgoISO).order('created_at', { ascending: false }).limit(5),
        supabase.from('factures').select('numero, montant_ttc, date_paiement').eq('entreprise_id', eid).not('date_paiement', 'is', null).gte('date_paiement', sevenDaysAgoISO).order('date_paiement', { ascending: false }).limit(5),
        supabase.from('mouvements_stock').select('id, quantite, created_at, chantier_id, materiaux_stock(nom, unite), chantiers(nom)').eq('entreprise_id', eid).eq('type', 'sortie').gte('created_at', sevenDaysAgoISO).order('created_at', { ascending: false }).limit(5),
        chantierIds.length > 0
          ? supabase.from('pointages').select('chantier_id, created_at, chantiers(nom)').eq('date_pointage', todayStr).in('chantier_id', chantierIds)
          : Promise.resolve({ data: [] as { chantier_id: string; created_at: string; chantiers: { nom: string } | null }[] }),
      ])

      const toRelTime = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 60) return `il y a ${mins}m`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `il y a ${hrs}h`
        if (hrs < 48) return 'hier'
        return `il y a ${Math.floor(hrs / 24)}j`
      }

      // Pointages du jour → une ligne par chantier avec le nombre d'ouvriers pointés
      const parChantier = new Map<string, { nom: string; count: number; dernier: string }>()
      ;(pointagesToday as unknown as { chantier_id: string; created_at: string; chantiers: { nom: string } | null }[] ?? []).forEach(p => {
        const existant = parChantier.get(p.chantier_id)
        if (existant) {
          existant.count += 1
          if (p.created_at > existant.dernier) existant.dernier = p.created_at
        } else {
          parChantier.set(p.chantier_id, { nom: p.chantiers?.nom ?? 'chantier', count: 1, dernier: p.created_at })
        }
      })

      const all = [
        ...(devis ?? []).filter(d => d.created_at).map(d => ({
          iconType: 'devis' as const,
          label: d.numero ? `Devis ${d.numero} créé` : 'Devis créé',
          href: '/dashboard/devis',
          _time: d.created_at as string,
        })),
        ...(devisAcceptes ?? []).filter(d => d.date_signature).map(d => ({
          iconType: 'devis' as const,
          label: `Devis ${d.numero} accepté${d.signe_par ? ` par ${d.signe_par}` : ''}`,
          href: '/dashboard/devis',
          _time: d.date_signature as string,
        })),
        ...(chantiers ?? []).filter(c => c.created_at).map(c => ({
          iconType: 'chantier' as const,
          label: `Chantier "${c.nom}" créé`,
          href: `/dashboard/chantiers/${c.id}`,
          _time: c.created_at as string,
        })),
        ...(factures ?? []).filter(f => f.created_at).map(f => ({
          iconType: 'facture' as const,
          label: f.numero ? `Facture ${f.numero} émise` : 'Facture émise',
          href: '/dashboard/factures',
          _time: f.created_at as string,
        })),
        ...(facturesPayees ?? []).filter(f => f.date_paiement).map(f => ({
          iconType: 'facture' as const,
          label: `Facture ${f.numero} payée (${fcfaEspace(f.montant_ttc ?? 0)})`,
          href: '/dashboard/factures',
          _time: f.date_paiement as string,
        })),
        ...(sorties as unknown as { id: string; quantite: number; created_at: string; chantier_id: string | null; materiaux_stock: { nom: string; unite: string } | null; chantiers: { nom: string } | null }[] ?? []).map(s => ({
          iconType: 'stock' as const,
          label: `Sortie stock : ${s.quantite} ${s.materiaux_stock?.unite ?? ''} ${s.materiaux_stock?.nom ?? ''} → ${s.chantiers?.nom ?? 'chantier'}`,
          href: s.chantier_id ? `/dashboard/chantiers/${s.chantier_id}` : '/dashboard/budget',
          _time: s.created_at,
        })),
        ...Array.from(parChantier.entries()).map(([chantierId, v]) => ({
          iconType: 'pointage' as const,
          label: `Pointage : ${v.count} ouvrier${v.count > 1 ? 's' : ''} sur ${v.nom}`,
          href: '/dashboard/equipes/pointage',
          _time: v.dernier,
        })),
      ]
        .sort((a, b) => new Date(b._time).getTime() - new Date(a._time).getTime())
        .slice(0, 8)
        .map(({ _time, ...rest }) => ({ ...rest, time: toRelTime(_time) }))

      setItems(all)
      setChecked(true)
    })()
  }, [])

  if (!checked) return null

  if (items.length === 0) {
    return (
      <div>
        <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.08em] mb-4">Activité récente</h2>
        <p className="text-gray-600 text-[13px]">Créez votre premier chantier pour commencer.</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.08em] mb-4">Activité récente</h2>
      <div>
        {items.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className="flex items-center gap-3 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors -mx-2 px-2 rounded-lg"
          >
            <span className="text-gray-600 shrink-0"><ActivityIcon type={item.iconType} /></span>
            <span className="text-gray-400 text-[13.5px] flex-1">{item.label}</span>
            <span className="text-gray-600 text-[12px] shrink-0 tabular-nums">{item.time}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

/* ── Dashboard avec données ── */
function NormalDashboard({ stats, nom, alertes }: { stats: Stats; nom: string; alertes: Alerte[] }) {
  const heure = new Date().getHours()
  const salut = heure < 12 ? 'Bonjour' : heure < 18 ? 'Bon après-midi' : 'Bonsoir'

  const statCards = [
    { label: 'Chantiers actifs', value: String(stats.chantiers), href: '/dashboard/chantiers' },
    { label: 'Factures en cours', value: formatFCFA(stats.facturesEnCoursMontant) + ' FCFA', href: '/dashboard/factures' },
    { label: 'Trésorerie encaissée (mois)', value: formatFCFA(stats.encaisseMoisMontant) + ' FCFA', href: '/dashboard/budget' },
    { label: 'Équipe', value: String(stats.ouvriers), href: '/dashboard/equipes' },
  ]

  const todoItems: { label: string; href: string }[] = []
  if (stats.nonPointesAujourdHui > 0) {
    const n = stats.nonPointesAujourdHui
    todoItems.push({
      label: `${n} ouvrier${n > 1 ? 's' : ''} à pointer`,
      href: '/dashboard/equipes/pointage',
    })
  }
  if (stats.facturesEnRetard > 0) {
    const n = stats.facturesEnRetard
    todoItems.push({
      label: `${n} facture${n > 1 ? 's' : ''} à relancer`,
      href: '/dashboard/creances',
    })
  }
  if (stats.statut === 'essai' && stats.joursRestants !== null && stats.joursRestants <= 7 && stats.joursRestants >= 0) {
    todoItems.push({
      label: `${stats.joursRestants} jour${stats.joursRestants > 1 ? 's' : ''} d'essai restants`,
      href: '/tarifs',
    })
  }

  return (
    <>
    <div className="p-4 sm:p-6 space-y-8">

      {/* Section 1 — Salutation */}
      <div className="opacity-0" style={{ animation: 'slide-up-fade 0.3s cubic-bezier(0.23,1,0.32,1) 0ms forwards' }}>
        <h1 className="text-[26px] font-bold text-white tracking-[-0.03em] leading-tight">
          {salut}{nom ? `, ${nom}` : ''}
        </h1>
        <p className="text-gray-500 text-[14px] mt-1.5">Aperçu de votre activité</p>
      </div>

      {/* Section 1bis — Alertes urgentes */}
      {alertes.length > 0 && (
        <div
          className="space-y-2 opacity-0"
          style={{ animation: 'slide-up-fade 0.28s cubic-bezier(0.23,1,0.32,1) 20ms forwards' }}
        >
          {alertes.slice(0, 4).map((a, i) => (
            <Link
              key={i}
              href={a.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/[0.08] border border-red-500/25 hover:bg-red-500/[0.13] transition-colors group"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-red-400 shrink-0">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM9 6a1 1 0 011 1v3a1 1 0 01-2 0V7a1 1 0 011-1zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
              </svg>
              <span className="text-red-300 text-[13.5px] flex-1">{a.label}</span>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5 text-red-500/60 group-hover:text-red-400 transition-colors shrink-0">
                <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ))}
        </div>
      )}

      {/* Section 2 — 4 stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card, i) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-[#232323] border border-white/[0.06] rounded-xl p-5 opacity-0 cursor-pointer hover:border-orange-500/30 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 transition-[transform,box-shadow,border-color] duration-200"
            style={{ animation: 'slide-up-fade 0.28s cubic-bezier(0.23,1,0.32,1) forwards', animationDelay: `${60 + i * 55}ms` }}
          >
            <p className="text-gray-500 text-[11px] font-medium uppercase tracking-[0.06em] mb-4">{card.label}</p>
            <p className="text-[1.9rem] font-bold text-white leading-none tracking-[-0.02em]">{card.value}</p>
          </Link>
        ))}
      </div>

      {/* Section 3 — Actions rapides */}
      <div
        className="flex sm:flex-wrap gap-2 overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 opacity-0"
        style={{ animation: 'slide-up-fade 0.28s cubic-bezier(0.23,1,0.32,1) 280ms forwards' }}
      >
        <Link
          href="/dashboard/chantiers"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-transparent hover:bg-orange-500/10 text-orange-400 text-[13px] font-semibold border border-orange-500/40 transition-[background-color,transform] duration-150 active:scale-[0.97] shrink-0"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5 shrink-0" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 14h12M3.5 14V7.5m9 0V14M2 7.5l6-5 6 5M6.5 14v-3h3V14"/>
            <path d="M10 3.5V2h2v2.5" strokeWidth="1.6"/>
          </svg>
          Nouveau chantier
        </Link>
        <Link
          href="/dashboard/equipes/pointage"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-transparent hover:bg-white/[0.06] text-white text-[13px] font-semibold transition-[background-color,transform] duration-150 border border-white/[0.10] active:scale-[0.97] shrink-0"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5 shrink-0" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="6"/>
            <path d="M8 5v3.5l2.5 1.5"/>
          </svg>
          Pointer aujourd'hui
        </Link>
        <Link
          href="/dashboard/devis"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-transparent hover:bg-white/[0.06] text-white text-[13px] font-semibold transition-[background-color,transform] duration-150 border border-white/[0.10] active:scale-[0.97] shrink-0"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5 shrink-0" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 1.5H4a1 1 0 00-1 1v11a1 1 0 001 1h8a1 1 0 001-1V5z"/>
            <path d="M9 1.5V5h3.5M6 8h4M6 10.5h2.5M11.5 10.5l1 1-1 1" strokeWidth="1.6"/>
          </svg>
          Nouveau devis
        </Link>
      </div>

      {/* Section 4 — À faire aujourd'hui */}
      {todoItems.length > 0 && (
        <div
          className="opacity-0"
          style={{ animation: 'slide-up-fade 0.28s cubic-bezier(0.23,1,0.32,1) 360ms forwards' }}
        >
          <h2 className="text-[11px] font-semibold text-gray-600 uppercase tracking-[0.08em] mb-3">À faire aujourd'hui</h2>
          <div className="space-y-2">
            {todoItems.slice(0, 4).map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#232323] border border-white/[0.06] hover:border-white/[0.10] transition-colors group"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                <span className="text-gray-300 text-[13.5px] flex-1">{item.label}</span>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5 text-gray-700 group-hover:text-orange-400 transition-colors shrink-0">
                  <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Section 5 — Activité récente */}
      <div
        className="opacity-0"
        style={{ animation: 'slide-up-fade 0.28s cubic-bezier(0.23,1,0.32,1) 440ms forwards' }}
      >
        <ActiviteRecente />
      </div>

    </div>
    {/* Checklist onboarding — visible si onboarding_complete = false */}
    <OnboardingChecklist />
    </>
  )
}

/* ── Dashboard vide : bienvenue ── */
function WelcomeDashboard({ joursRestants, statut, nom }: { joursRestants: number | null; statut: string; nom: string }) {
  const etapes = [
    {
      titre: 'Créez un chantier',
      desc: 'Ajoutez votre premier chantier',
      href: '/dashboard/chantiers',
    },
    {
      titre: 'Ajoutez vos ouvriers',
      desc: 'Gérez votre équipe et le pointage quotidien',
      href: '/dashboard/equipes',
    },
    {
      titre: 'Faites votre premier devis',
      desc: 'Générez un devis professionnel en FCFA en 2 minutes',
      href: '/dashboard/devis',
    },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-8">

      {/* Message bienvenue */}
      <div className="opacity-0" style={{ animation: 'slide-up-fade 0.3s cubic-bezier(0.23,1,0.32,1) forwards' }}>
        {statut === 'essai' && joursRestants !== null && joursRestants > 0 && (
          <div className="inline-flex items-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-1.5 mb-4">
            <span className="text-emerald-400 text-[12px] font-semibold">Essai gratuit — {joursRestants} jours restants</span>
          </div>
        )}
        <h1 className="text-[26px] font-bold text-white tracking-[-0.03em] leading-tight">
          Bienvenue{nom ? `, ${nom}` : ''}
        </h1>
        <p className="text-gray-500 text-[14px] mt-2">
          Configurez votre espace en 3 étapes pour commencer à gérer vos chantiers.
        </p>
      </div>

      {/* Checklist 3 étapes */}
      <div className="space-y-3">
        {etapes.map((etape, i) => (
          <Link
            key={etape.href}
            href={etape.href}
            className="flex items-center gap-4 p-4 rounded-xl bg-[#232323] border border-white/[0.06] hover:border-white/[0.10] transition-colors group opacity-0"
            style={{ animation: 'slide-up-fade 0.25s cubic-bezier(0.23,1,0.32,1) forwards', animationDelay: `${80 + i * 70}ms` }}
          >
            <div className="w-8 h-8 rounded-full border-2 border-white/[0.10] group-hover:border-orange-500/40 flex items-center justify-center shrink-0 transition-colors">
              <span className="text-gray-600 text-[11px] font-bold group-hover:text-orange-400 transition-colors">0{i + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-[14px]">{etape.titre}</p>
              <p className="text-gray-600 text-[12px] mt-0.5">{etape.desc}</p>
            </div>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-gray-700 group-hover:text-orange-400 transition-colors shrink-0">
              <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ))}
      </div>

      {/* 1 bouton principal */}
      <div
        className="opacity-0"
        style={{ animation: 'slide-up-fade 0.28s cubic-bezier(0.23,1,0.32,1) 320ms forwards' }}
      >
        <Link
          href="/dashboard/chantiers"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-[14px] transition-[background-color,transform] duration-150 active:scale-[0.97]"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 shrink-0" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 14h12M3.5 14V7.5m9 0V14M2 7.5l6-5 6 5M6.5 14v-3h3V14"/>
          </svg>
          Commencer maintenant
        </Link>
      </div>

    </div>
  )
}

/* ── Page principale ── */
export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    chantiers: 0,
    ouvriers: 0,
    factures: 0,
    nonPointesAujourdHui: 0,
    facturesEnRetard: 0,
    montantEnRetard: 0,
    caMois: 0,
    joursRestants: null,
    statut: '',
    facturesEnCoursMontant: 0,
    encaisseMoisMontant: 0,
  })
  const [alertes, setAlertes] = useState<Alerte[]>([])
  const [joursRestants, setJoursRestants] = useState<number | null>(null)
  const [statut, setStatut] = useState('')
  const [isNewClient, setIsNewClient] = useState<boolean | null>(null)
  const [nom, setNom] = useState('')

  useEffect(() => {
    const supabase = createClient()

    async function fetchStats() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setIsNewClient(true); return }

      const fullName = user.user_metadata?.full_name as string | undefined
      const emailPrefix = user.email?.split('@')[0] ?? ''
      setNom(fullName || emailPrefix)

      const { data: profile } = await supabase
        .from('profiles')
        .select('entreprise_id')
        .eq('id', user.id)
        .maybeSingle()

      let _jours: number | null = null
      let _statut = ''

      if (profile?.entreprise_id) {
        const { data: entreprise } = await supabase
          .from('entreprises')
          .select('statut_abonnement, date_fin_abonnement')
          .eq('id', profile.entreprise_id)
          .maybeSingle()

        if (entreprise?.date_fin_abonnement) {
          _jours = Math.ceil(
            (new Date(entreprise.date_fin_abonnement).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          )
          _statut = entreprise.statut_abonnement || ''
          setJoursRestants(_jours)
          setStatut(_statut)
        }

        const { data: chantiers } = await supabase
          .from('chantiers')
          .select('id')
          .eq('entreprise_id', profile.entreprise_id)

        setIsNewClient(!chantiers || chantiers.length === 0)
      } else {
        setIsNewClient(true)
      }

      const eid = profile?.entreprise_id ?? ''
      const todayStr = new Date().toISOString().split('T')[0]
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]
      const fifteenDaysAgo = new Date()
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
      const fifteenDaysAgoStr = fifteenDaysAgo.toISOString().split('T')[0]
      const debutMois = new Date()
      debutMois.setDate(1)
      const debutMoisStr = debutMois.toISOString().split('T')[0]
      const debutMoisISO = debutMois.toISOString()

      const [
        { count: chantiersCount },
        { count: ouvriersCount },
        { count: facturesCount },
        { data: ouvriersActifs },
        { data: pointagesAujourdHui },
        { data: facturesRetard },
        { data: facturesMois },
        { data: facturesEnCours },
        { data: facturesEncaisseesMois },
        { count: facturesImpayees30jCount },
        { count: devisEnAttenteCount },
        { data: stocksBas },
      ] = await Promise.all([
        supabase.from('chantiers').select('*', { count: 'exact', head: true }).eq('entreprise_id', eid),
        supabase.from('ouvriers').select('*', { count: 'exact', head: true }).eq('entreprise_id', eid),
        supabase.from('factures').select('*', { count: 'exact', head: true }).eq('entreprise_id', eid),
        supabase.from('ouvriers').select('id').eq('actif', true).eq('entreprise_id', eid),
        supabase.from('pointages').select('ouvrier_id').eq('date_pointage', todayStr),
        supabase.from('factures').select('montant_ttc, montant_paye').eq('entreprise_id', eid).neq('statut', 'paye').lte('date_emission', sevenDaysAgoStr),
        supabase.from('factures').select('montant_ttc').eq('entreprise_id', eid).gte('date_emission', debutMoisStr),
        supabase.from('factures').select('montant_ttc, montant_paye').eq('entreprise_id', eid).neq('statut', 'paye'),
        supabase.from('factures').select('montant_ttc').eq('entreprise_id', eid).eq('statut', 'paye').gte('date_paiement', debutMoisISO),
        supabase.from('factures').select('*', { count: 'exact', head: true }).eq('entreprise_id', eid).neq('statut', 'paye').lte('date_emission', thirtyDaysAgoStr),
        supabase.from('devis').select('*', { count: 'exact', head: true }).eq('entreprise_id', eid).eq('statut', 'envoye').lte('date_emission', fifteenDaysAgoStr),
        supabase.from('materiaux_stock').select('nom, unite, quantite_stock, quantite_min').eq('entreprise_id', eid),
      ])

      const pointesIds = new Set((pointagesAujourdHui ?? []).map(p => p.ouvrier_id))
      const nonPointes = (ouvriersActifs ?? []).filter(o => !pointesIds.has(o.id)).length
      const nbFacturesRetard = (facturesRetard ?? []).length
      const montantRetard = (facturesRetard ?? []).reduce((acc, f) => acc + Math.max(0, (f.montant_ttc ?? 0) - (f.montant_paye ?? 0)), 0)
      const totalCaMois = (facturesMois ?? []).reduce((acc, f) => acc + (f.montant_ttc ?? 0), 0)
      const totalFacturesEnCours = (facturesEnCours ?? []).reduce((acc, f) => acc + Math.max(0, (f.montant_ttc ?? 0) - (f.montant_paye ?? 0)), 0)
      const totalEncaisseMois = (facturesEncaisseesMois ?? []).reduce((acc, f) => acc + (f.montant_ttc ?? 0), 0)

      setStats({
        chantiers: chantiersCount ?? 0,
        ouvriers: ouvriersCount ?? 0,
        factures: facturesCount ?? 0,
        nonPointesAujourdHui: nonPointes,
        facturesEnRetard: nbFacturesRetard,
        montantEnRetard: montantRetard,
        caMois: totalCaMois,
        joursRestants: _jours,
        statut: _statut,
        facturesEnCoursMontant: totalFacturesEnCours,
        encaisseMoisMontant: totalEncaisseMois,
      })

      // ── Alertes urgentes ──────────────────────────────────────────────
      const nouvellesAlertes: Alerte[] = []

      if ((facturesImpayees30jCount ?? 0) > 0) {
        const n = facturesImpayees30jCount ?? 0
        nouvellesAlertes.push({
          label: `${n} facture${n > 1 ? 's' : ''} impayée${n > 1 ? 's' : ''} depuis +30 jours`,
          href: '/dashboard/factures?filtre=impayees',
        })
      }

      // Paie du mois précédent non validée sur certains chantiers
      if (eid) {
        const prevMonthRef = new Date()
        prevMonthRef.setMonth(prevMonthRef.getMonth() - 1)
        const prevMonthStart = new Date(prevMonthRef.getFullYear(), prevMonthRef.getMonth(), 1).toISOString().split('T')[0]
        const prevMonthEndDate = new Date(prevMonthRef.getFullYear(), prevMonthRef.getMonth() + 1, 0)
        const prevMonthEnd = prevMonthEndDate.toISOString().split('T')[0]
        const prevMonthLabel = prevMonthEndDate.toLocaleDateString('fr-FR', { month: 'long' })

        const { data: chantierIdsData } = await supabase.from('chantiers').select('id').eq('entreprise_id', eid)
        const chantierIds = (chantierIdsData ?? []).map(c => c.id)

        if (chantierIds.length > 0) {
          const [{ data: pointagesMoisDernier }, { data: paiesValidees }] = await Promise.all([
            supabase.from('pointages').select('chantier_id').in('chantier_id', chantierIds).gte('date_pointage', prevMonthStart).lte('date_pointage', prevMonthEnd).eq('present', true),
            supabase.from('depenses').select('chantier_id').eq('entreprise_id', eid).eq('source', 'auto_paie').eq('date_depense', prevMonthEnd),
          ])
          const chantiersAvecPointages = new Set((pointagesMoisDernier ?? []).map(p => p.chantier_id))
          const chantiersValides = new Set((paiesValidees ?? []).map(p => p.chantier_id))
          const nonValides = [...chantiersAvecPointages].filter(id => !chantiersValides.has(id)).length
          if (nonValides > 0) {
            nouvellesAlertes.push({
              label: `Paie de ${prevMonthLabel} non validée sur ${nonValides} chantier${nonValides > 1 ? 's' : ''}`,
              href: '/dashboard/equipes/paie',
            })
          }
        }
      }

      // Stock bas — le matériau le plus critique
      const materiauCritique = (stocksBas ?? [])
        .filter(s => (s.quantite_stock ?? 0) <= (s.quantite_min ?? 0) && (s.quantite_min ?? 0) > 0)
        .sort((a, b) => ((a.quantite_stock ?? 0) - (a.quantite_min ?? 0)) - ((b.quantite_stock ?? 0) - (b.quantite_min ?? 0)))[0]
      if (materiauCritique) {
        nouvellesAlertes.push({
          label: `Stock de ${materiauCritique.nom} bas (< ${materiauCritique.quantite_min} ${materiauCritique.unite})`,
          href: '/dashboard/budget',
        })
      }

      if ((devisEnAttenteCount ?? 0) > 0) {
        const n = devisEnAttenteCount ?? 0
        nouvellesAlertes.push({
          label: `${n} devis en attente de réponse client depuis +15 jours`,
          href: '/dashboard/devis?filtre=en_attente',
        })
      }

      setAlertes(nouvellesAlertes.slice(0, 4))
    }

    fetchStats()
  }, [])

  return (
    <>
      <Suspense fallback={null}>
        <WelcomeToast />
      </Suspense>
      {isNewClient === null
        ? <PageSkeleton />
        : isNewClient
        ? <WelcomeDashboard joursRestants={joursRestants} statut={statut} nom={nom} />
        : <NormalDashboard stats={stats} nom={nom} alertes={alertes} />
      }
    </>
  )
}
