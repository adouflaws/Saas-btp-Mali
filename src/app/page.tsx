'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const WA = '22376753087'

function useScrollReveal() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const els = document.querySelectorAll('[data-reveal]') as NodeListOf<HTMLElement>
    els.forEach(el => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(10px)'
      const delay = el.dataset.revealDelay ?? '0'
      el.style.transition = `opacity 0.4s cubic-bezier(0.23,1,0.32,1) ${delay}ms, transform 0.4s cubic-bezier(0.23,1,0.32,1) ${delay}ms`
    })
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target as HTMLElement
          el.style.opacity = '1'
          el.style.transform = 'translateY(0)'
          obs.unobserve(el)
        }
      }),
      { threshold: 0.06, rootMargin: '0px 0px -40px 0px' }
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])
}

const FEATURES = [
  { n: '01', title: 'Paie automatique en FCFA', desc: 'Pointage ouvrier et calcul de paie en 1 clic. Fini les 4 heures perdues chaque vendredi soir sur Excel.' },
  { n: '02', title: 'Relances clients WhatsApp', desc: 'Facturation avec relances automatiques à J+7, J+15 et J+30. Vos impayés diminuent de 60%.' },
  { n: '03', title: 'Marge réelle par chantier', desc: 'Rentabilité visible en temps réel. Vous savez exactement ce qui va dans votre poche.' },
  { n: '04', title: 'Portail client en temps réel', desc: 'Photos, avancement, jalons. Partagez un lien avec vos clients. Ils suivent sans vous appeler.' },
  { n: '05', title: 'Mode offline terrain', desc: 'Pointez vos ouvriers sans connexion à Mopti, Ségou ou Sikasso. Sync automatique au retour du réseau.' },
  { n: '06', title: 'Devis professionnels en 2 min', desc: 'Bibliothèque de prix maliens intégrée. TVA 18% automatique. PDF prêt à envoyer à votre client.' },
]

const TEMOIGNAGES = [
  {
    text: "BTP Mali nous a fait gagner 3 heures par jour. Le vendredi soir, je rentre enfin chez moi à l'heure pour la première fois en 5 ans.",
    name: 'Mamadou Koné', co: 'BTP Koné Construction, Bamako',
  },
  {
    text: "Les relances WhatsApp automatiques ont diminué nos impayés de 60%. On a récupéré 4 millions FCFA en 3 mois.",
    name: 'Aïcha Traoré', co: 'ATB Construction, Bamako',
  },
  {
    text: "Enfin un logiciel qui comprend le Mali. Mes ouvriers en brousse pointent même sans réseau.",
    name: 'Ibrahim Diarra', co: 'IDC BTP, Sikasso',
  },
]

const PLANS = [
  { name: 'Starter', price: '35 000', desc: '1 à 5 personnes', features: ['2 chantiers actifs', 'Devis & factures', '3 utilisateurs'], featured: false },
  { name: 'Pro', price: '70 000', desc: '5 à 20 personnes', features: ['10 chantiers actifs', 'Gestion ouvriers & paie', 'Stocks & carburant', '15 utilisateurs'], featured: true },
  { name: 'Entreprise', price: '125 000', desc: '20 personnes et plus', features: ['Chantiers illimités', 'Utilisateurs illimités', 'Support prioritaire 24/7'], featured: false },
]

const FAQS = [
  { q: "Je n'ai pas le temps d'apprendre un nouveau logiciel.", r: "Formation 1-à-1 gratuite incluse. Vous êtes opérationnel en 2 heures avec accompagnement par WhatsApp. Notre équipe configure tout pour vous." },
  { q: "Mes ouvriers ne savent pas utiliser un téléphone.", r: "Seul vous (le patron) avez besoin de l'utiliser. Vos ouvriers ne touchent jamais au logiciel. Vous entrez les pointages vous-même depuis votre téléphone." },
  { q: "Et si mes données disparaissent ?", r: "Sauvegarde automatique chaque jour. Hébergement sécurisé chez Supabase (utilisé par GitHub et OpenAI). Vos données sont à vous et exportables à tout moment." },
  { q: "Y a-t-il un engagement ?", r: "Aucun engagement. Vous pouvez résilier à tout moment depuis votre dashboard. Pas de pénalité. Vos données restent exportables." },
  { q: "Comment payer mon abonnement ?", r: "Orange Money, Wave ou virement bancaire. Activation sous 2 heures après réception du paiement. Notre équipe vous guide par WhatsApp." },
]

const IconWA = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.533 5.855L0 24l6.335-1.521A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
  </svg>
)

const IconBuilding = ({ cls }: { cls: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
    <path d="M3 21h18M5 21V11m14 0v10M3 11l9-7 9 7M10 21v-5h4v5" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  useScrollReveal()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setIsLoggedIn(!!data.user))
  }, [])

  const navItems = [
    { label: 'Fonctionnalités', id: 'features' },
    { label: 'Témoignages', id: 'temoignages' },
    { label: 'Tarifs', id: 'tarifs' },
    { label: 'FAQ', id: 'faq' },
  ]

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="bg-[#0D0D0D] text-white min-h-screen overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0D0D0D]/96 backdrop-blur-md" role="navigation" aria-label="Navigation principale">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

          <Link href="/" aria-label="BTP Mali" className="flex items-center gap-2.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 rounded-lg">
            <div className="w-8 h-8 bg-orange-500 rounded-[10px] flex items-center justify-center shrink-0">
              <IconBuilding cls="w-4 h-4"/>
            </div>
            <span className="font-bold text-[16px] tracking-[-0.02em]">BTP Mali</span>
          </Link>

          <div className="hidden md:flex items-center gap-7">
            {navItems.map(item => (
              <button key={item.id} onClick={() => scrollTo(item.id)}
                className="text-[13px] text-gray-500 hover:text-white transition-colors duration-150 font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 rounded px-1">
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link href="/dashboard"
                className="bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-[background-color,transform] duration-150 active:scale-[0.97] min-h-[44px] flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
                Mon dashboard
              </Link>
            ) : (
              <>
                <Link href="/login"
                  className="hidden sm:flex text-gray-500 hover:text-white text-[13px] font-medium transition-colors duration-150 items-center min-h-[44px] px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 rounded">
                  Se connecter
                </Link>
                <Link href="/login"
                  className="bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-[background-color,transform] duration-150 active:scale-[0.97] min-h-[44px] flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
                  Essai gratuit
                </Link>
              </>
            )}
            <button onClick={() => setMenuOpen(v => !v)} aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={menuOpen}
              className="md:hidden w-11 h-11 flex items-center justify-center rounded-xl text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors duration-150">
              {menuOpen
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
              }
            </button>
          </div>
        </div>

        <div className={`md:hidden grid ${menuOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
          style={{ transition: 'grid-template-rows 220ms cubic-bezier(0.23,1,0.32,1)' }}>
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-white/[0.06] px-4 py-3 flex flex-col gap-1">
              {navItems.map(item => (
                <button key={item.id} onClick={() => { scrollTo(item.id); setMenuOpen(false) }}
                  className="text-left text-[14px] text-gray-400 hover:text-white py-3 px-2 rounded-lg min-h-[44px] transition-colors duration-150 cursor-pointer">
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="min-h-[100dvh] flex flex-col justify-center pt-16 pb-12 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto w-full">
          <div data-reveal className="inline-flex items-center gap-2 text-[12px] font-medium text-gray-600 border border-white/[0.07] px-3.5 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0" aria-hidden="true"/>
            Essai 14 jours gratuits · 100% Mali
          </div>

          <h1 data-reveal className="text-[2.4rem] sm:text-5xl lg:text-[3.8rem] font-black text-white leading-[1.05] tracking-[-0.04em] mb-5">
            Gérez tous vos chantiers<br className="hidden sm:block"/>
            <span className="text-orange-400"> depuis votre téléphone.</span>
          </h1>

          <p data-reveal className="text-[16px] sm:text-[17px] text-gray-500 leading-relaxed max-w-xl mb-9">
            Paie, devis, créances, pointage. Tout ce dont une PME BTP malienne a besoin, même sans internet.
          </p>

          <div data-reveal className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <Link href="/login"
              className="flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white font-bold px-7 py-4 rounded-xl transition-[background-color,transform] duration-150 active:scale-[0.97] text-[15px] min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D]">
              Démarrer gratuitement →
            </Link>
            <a href={`https://wa.me/${WA}?text=${encodeURIComponent('Bonjour, je voudrais voir une démo de BTP Mali.')}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 font-medium px-6 py-4 rounded-xl transition-[background-color,transform] duration-150 active:scale-[0.97] text-[15px] min-h-[52px]">
              <span className="text-emerald-400"><IconWA/></span>
              Voir une démo (90 sec)
            </a>
          </div>
        </div>
      </section>

      {/* ── FEATURES — eyebrow 1/3 ── */}
      <section id="features" className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div data-reveal className="mb-14 sm:mb-16">
            <p className="text-[11px] font-semibold text-orange-400 uppercase tracking-[0.1em] mb-3">Fonctionnalités</p>
            <h2 className="text-[1.9rem] sm:text-5xl font-black text-white tracking-[-0.035em] leading-tight max-w-2xl">
              Tout ce dont une PME BTP malienne a besoin.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-10 sm:gap-y-12">
            {FEATURES.map((f, i) => (
              <div key={i} data-reveal data-reveal-delay={`${i * 60}`} className="flex gap-5 items-start">
                <span className="text-[2.2rem] font-black text-white/[0.07] leading-none shrink-0 tabular-nums mt-0.5 w-12 select-none" aria-hidden="true">
                  {f.n}
                </span>
                <div>
                  <h3 className="text-white font-bold text-[15px] mb-1.5 tracking-[-0.015em]">{f.title}</h3>
                  <p className="text-gray-500 text-[13px] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div data-reveal className="mt-14">
            <Link href="/login"
              className="inline-flex items-center bg-orange-500 hover:bg-orange-600 text-white font-bold px-7 py-3.5 rounded-xl transition-[background-color,transform] duration-150 active:scale-[0.97] text-[14px] min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D]">
              Démarrer mon essai gratuit →
            </Link>
          </div>
        </div>
      </section>

      {/* ── TEMOIGNAGES — staggered layout, not 3-equal cards — eyebrow 2/3 ── */}
      <section id="temoignages" className="bg-[#0A0A0A] border-t border-white/[0.05] py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div data-reveal className="mb-12 sm:mb-14">
            <p className="text-[11px] font-semibold text-orange-400 uppercase tracking-[0.1em] mb-3">Témoignages</p>
            <h2 className="text-[1.9rem] sm:text-5xl font-black text-white tracking-[-0.035em] leading-tight max-w-2xl">
              Ce qu'en disent les patrons maliens.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5">

            {/* Featured large quote (3/5 width on desktop) */}
            <div data-reveal className="lg:col-span-3 bg-[#171717] border border-white/[0.06] rounded-2xl p-7 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex gap-0.5 mb-6" role="img" aria-label="5 étoiles sur 5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <svg key={j} viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-amber-400" aria-hidden="true">
                      <path d="M8 1l2.06 4.17 4.6.67-3.33 3.25.79 4.58L8 11.17l-4.12 2.17.79-4.58L1.34 5.84l4.6-.67L8 1z"/>
                    </svg>
                  ))}
                </div>
                <p className="text-gray-300 text-[17px] leading-relaxed mb-7">
                  &ldquo;{TEMOIGNAGES[0].text}&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3 pt-5 border-t border-white/[0.06]">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0 bg-blue-600">MK</div>
                <div>
                  <p className="text-white font-semibold text-[14px]">{TEMOIGNAGES[0].name}</p>
                  <p className="text-gray-600 text-[12px] mt-0.5">{TEMOIGNAGES[0].co}</p>
                </div>
              </div>
            </div>

            {/* Two smaller quotes stacked (2/5 width on desktop) */}
            <div className="lg:col-span-2 flex flex-col gap-4 sm:gap-5">
              {TEMOIGNAGES.slice(1).map((t, i) => (
                <div key={i} data-reveal data-reveal-delay={`${(i + 1) * 80}`}
                  className="bg-[#171717] border border-white/[0.06] rounded-2xl p-5 sm:p-6 flex flex-col flex-1 justify-between">
                  <div>
                    <div className="flex gap-0.5 mb-4" role="img" aria-label="5 étoiles sur 5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <svg key={j} viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-amber-400" aria-hidden="true">
                          <path d="M8 1l2.06 4.17 4.6.67-3.33 3.25.79 4.58L8 11.17l-4.12 2.17.79-4.58L1.34 5.84l4.6-.67L8 1z"/>
                        </svg>
                      ))}
                    </div>
                    <p className="text-gray-400 text-[13px] leading-relaxed mb-4">&ldquo;{t.text}&rdquo;</p>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-[13px]">{t.name}</p>
                    <p className="text-gray-600 text-[12px] mt-0.5">{t.co}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TARIFS — eyebrow 3/3 ── */}
      <section id="tarifs" className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div data-reveal className="mb-12 sm:mb-14">
            <p className="text-[11px] font-semibold text-orange-400 uppercase tracking-[0.1em] mb-3">Tarifs</p>
            <h2 className="text-[1.9rem] sm:text-5xl font-black text-white tracking-[-0.035em] leading-tight max-w-2xl">
              Prix transparents, adaptés au Mali.
            </h2>
            <p className="text-gray-600 text-[14px] mt-3">Essai gratuit 14 jours, aucune carte bancaire requise.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS.map((plan, i) => (
              <div key={i} data-reveal data-reveal-delay={`${i * 80}`}
                className={`relative flex flex-col rounded-2xl p-6 border ${
                  plan.featured
                    ? 'bg-[#1C1C1C] border-orange-500/25 ring-1 ring-orange-500/15'
                    : 'bg-[#111111] border-white/[0.06]'
                }`}>
                {plan.featured && (
                  <div className="absolute -top-3 left-6">
                    <span className="bg-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">Le plus populaire</span>
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="text-white font-bold text-[16px] mb-0.5">{plan.name}</h3>
                  <p className="text-gray-600 text-[12px]">{plan.desc}</p>
                </div>
                <div className="mb-6">
                  <span className="text-[2rem] font-black text-white tabular-nums">{plan.price}</span>
                  <span className="text-gray-600 text-[12px] ml-1.5">FCFA/mois</span>
                </div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-gray-500 text-[13px]">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-emerald-500 shrink-0" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 8l3 3 7-7"/>
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/login"
                  className={`flex items-center justify-center py-3 rounded-xl text-[13px] font-bold transition-[background-color,transform] duration-150 active:scale-[0.97] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 ${
                    plan.featured
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-white/[0.05] hover:bg-white/[0.09] text-gray-400 border border-white/[0.07]'
                  }`}>
                  Commencer →
                </Link>
              </div>
            ))}
          </div>

          <div data-reveal className="mt-6 text-center">
            <Link href="/tarifs" className="text-orange-400 hover:text-orange-300 text-[13px] font-medium transition-colors duration-150">
              Voir tous les détails et comparer les plans →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ — no eyebrow (budget exhausted at 3/3) ── */}
      <section id="faq" className="bg-[#0A0A0A] border-t border-white/[0.05] py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div data-reveal className="mb-12">
            <h2 className="text-[1.9rem] sm:text-4xl font-black text-white tracking-[-0.035em] leading-tight">
              Questions fréquentes.
            </h2>
          </div>

          <div className="space-y-2">
            {FAQS.map((item, i) => (
              <div key={i} data-reveal className="border border-white/[0.06] rounded-xl overflow-hidden bg-[#111111]">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left gap-4 min-h-[56px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-inset"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}>
                  <span className="text-white text-[14px] font-semibold leading-snug">{item.q}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    className={`w-4 h-4 text-gray-600 shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                    aria-hidden="true">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                <div className={`grid transition-[grid-template-rows] duration-200 ${openFaq === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="px-5 pb-5 pt-1">
                      <p className="text-gray-500 text-[14px] leading-relaxed">{item.r}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-orange-500/[0.15]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 data-reveal className="text-[2rem] sm:text-5xl font-black text-white tracking-[-0.04em] leading-[1.07] mb-5">
            Prêt à reprendre le contrôle<br/>de votre entreprise ?
          </h2>
          <p data-reveal className="text-gray-500 text-[15px] sm:text-[17px] leading-relaxed mb-10 max-w-lg mx-auto">
            Rejoignez les PME BTP maliennes qui pilotent leurs chantiers depuis leur téléphone.
          </p>
          <div data-reveal className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center mb-10">
            <Link href="/login"
              className="flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white font-bold px-10 py-4 rounded-xl transition-[background-color,transform] duration-150 active:scale-[0.97] text-[15px] min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0D0D]">
              Démarrer mon essai de 14 jours →
            </Link>
            <a href={`https://wa.me/${WA}?text=${encodeURIComponent('Bonjour, je voudrais voir une démo de BTP Mali.')}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.07] text-gray-400 font-medium px-7 py-4 rounded-xl transition-[background-color,transform] duration-150 active:scale-[0.97] text-[14px] min-h-[52px]">
              Voir une démo WhatsApp
            </a>
          </div>
          <div data-reveal className="flex flex-wrap justify-center gap-6 text-gray-600 text-[12px]">
            {['Sans carte bancaire', 'Accès immédiat', 'Annulez quand vous voulez'].map(g => (
              <span key={g} className="flex items-center gap-1.5">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3 h-3 text-emerald-500 shrink-0" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 6l2.5 2.5L10 3"/>
                </svg>
                {g}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#080808] border-t border-white/[0.05] py-12 sm:py-16 px-4 sm:px-6" role="contentinfo">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-10 mb-10">
            <div className="max-w-[200px]">
              <Link href="/" aria-label="BTP Mali" className="flex items-center gap-2 mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 rounded-lg">
                <div className="w-7 h-7 bg-orange-500 rounded-[8px] flex items-center justify-center shrink-0">
                  <IconBuilding cls="w-3.5 h-3.5"/>
                </div>
                <span className="font-bold text-[15px]">BTP Mali</span>
              </Link>
              <p className="text-gray-700 text-[13px] leading-relaxed">Le logiciel de gestion BTP fait par des Maliens, pour les Maliens.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 sm:gap-14">
              <nav aria-label="Liens produit">
                <h4 className="text-gray-600 font-semibold text-[11px] uppercase tracking-[0.07em] mb-4">Produit</h4>
                <div className="space-y-3">
                  {[
                    { label: 'Fonctionnalités', href: '#features' },
                    { label: 'Tarifs', href: '/tarifs' },
                    { label: 'Se connecter', href: '/login' },
                    { label: 'Démo WhatsApp', href: `https://wa.me/${WA}?text=${encodeURIComponent('Bonjour, je voudrais voir une démo de BTP Mali.')}`, ext: true },
                  ].map(item => (
                    'ext' in item && item.ext
                      ? <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer"
                          className="block text-gray-600 hover:text-gray-400 text-[13px] transition-colors duration-150">{item.label}</a>
                      : <Link key={item.label} href={item.href}
                          className="block text-gray-600 hover:text-gray-400 text-[13px] transition-colors duration-150">{item.label}</Link>
                  ))}
                </div>
              </nav>

              <nav aria-label="Support">
                <h4 className="text-gray-600 font-semibold text-[11px] uppercase tracking-[0.07em] mb-4">Support</h4>
                <div className="space-y-3">
                  <a href={`https://wa.me/${WA}`} target="_blank" rel="noopener noreferrer" className="block text-gray-600 hover:text-gray-400 text-[13px] transition-colors duration-150">WhatsApp</a>
                  <a href="mailto:support@btpmali.com" className="block text-gray-600 hover:text-gray-400 text-[13px] transition-colors duration-150">Email</a>
                  <Link href="#faq" className="block text-gray-600 hover:text-gray-400 text-[13px] transition-colors duration-150">FAQ</Link>
                </div>
              </nav>

              <nav aria-label="Légal">
                <h4 className="text-gray-600 font-semibold text-[11px] uppercase tracking-[0.07em] mb-4">Légal</h4>
                <div className="space-y-3">
                  <Link href="/confidentialite" className="block text-gray-600 hover:text-gray-400 text-[13px] transition-colors duration-150">Confidentialité</Link>
                  <Link href="/cgu" className="block text-gray-600 hover:text-gray-400 text-[13px] transition-colors duration-150">CGU</Link>
                </div>
              </nav>
            </div>
          </div>

          <div className="border-t border-white/[0.05] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-700 text-[12px]">© 2025 BTP Mali. Fait à Bamako, Mali.</p>
            <a href={`https://wa.me/${WA}?text=${encodeURIComponent("Bonjour BTP Mali, j'ai besoin d'aide.")}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-500 text-[12px] transition-colors duration-150">
              <span className="text-emerald-500"><IconWA/></span>
              Support WhatsApp
            </a>
          </div>
        </div>
      </footer>

    </div>
  )
}
