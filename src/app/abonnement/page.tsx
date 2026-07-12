'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

const WA = '22376753087'

function waLink(text: string) {
  return `https://wa.me/${WA}?text=${encodeURIComponent(text)}`
}

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    badge: 'Démarrage',
    badgeClass: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
    target: 'Artisan / 1–5 personnes',
    priceMonthly: 35000,
    priceAnnual: 29167,
    annualTotal: 350000,
    featured: false,
    features: [
      { label: '2 chantiers actifs', ok: true },
      { label: 'Planning & suivi avancement', ok: true },
      { label: 'Devis & factures en FCFA', ok: true },
      { label: 'TVA 18% automatique', ok: true },
      { label: '3 utilisateurs', ok: true },
      { label: 'Portail client', ok: true },
      { label: 'Support par email', ok: true },
      { label: 'Gestion équipes & pointage', ok: false },
      { label: 'Stocks & carburant', ok: false },
      { label: 'Relances WhatsApp', ok: false },
    ],
    cta: 'Essai gratuit 30 jours',
    ctaClass: 'bg-white hover:bg-gray-100 text-gray-900',
    ctaType: 'trial' as const,
  },
  {
    id: 'pro',
    name: 'Pro',
    badge: 'Le plus populaire',
    badgeClass: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
    target: 'PME 5–20 personnes',
    priceMonthly: 70000,
    priceAnnual: 58333,
    annualTotal: 700000,
    featured: true,
    features: [
      { label: '10 chantiers actifs', ok: true },
      { label: 'Tout le plan Starter', ok: true },
      { label: 'Gestion ouvriers & pointage', ok: true },
      { label: 'Calcul paie automatique FCFA', ok: true },
      { label: 'Stocks & matériaux', ok: true },
      { label: 'Suivi carburant véhicules', ok: true },
      { label: 'Relances WhatsApp J+7/J+15/J+30', ok: true },
      { label: 'PDF de relance professionnel', ok: true },
      { label: 'Mode hors-ligne (offline)', ok: true },
      { label: '15 utilisateurs', ok: true },
      { label: 'Support prioritaire WhatsApp', ok: true },
    ],
    cta: 'Essai gratuit 30 jours',
    ctaClass: 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30',
    ctaType: 'trial' as const,
  },
  {
    id: 'entreprise',
    name: 'Entreprise',
    badge: 'Grandes entreprises',
    badgeClass: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    target: '20–100 personnes',
    priceMonthly: 125000,
    priceAnnual: 104167,
    annualTotal: 1250000,
    featured: false,
    features: [
      { label: 'Chantiers illimités', ok: true },
      { label: 'Tout le plan Pro', ok: true },
      { label: 'Utilisateurs illimités', ok: true },
      { label: 'Tableau de bord multi-sites', ok: true },
      { label: 'Rapports officiels PDF', ok: true },
      { label: 'Formation incluse (2 heures)', ok: true },
      { label: 'Support dédié WhatsApp 24/7', ok: true },
      { label: 'Déploiement et config sur site', ok: true },
    ],
    cta: 'Nous contacter',
    ctaClass: 'bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.12]',
    ctaType: 'contact' as const,
  },
]

const FAQ = [
  {
    q: "Y a-t-il un engagement ?",
    a: "Non. Vous pouvez résilier à tout moment sans frais.",
  },
  {
    q: "Puis-je changer de plan ?",
    a: "Oui, à tout moment. La différence est calculée au prorata.",
  },
  {
    q: "Mes données sont-elles sécurisées ?",
    a: "Oui. Vos données sont chiffrées et sauvegardées quotidiennement.",
  },
  {
    q: "Le logiciel fonctionne-t-il sans internet ?",
    a: "Oui. BTP Mali fonctionne en mode hors-ligne pour le pointage et la consultation des chantiers.",
  },
  {
    q: "Proposez-vous une formation ?",
    a: "Oui. Une session de 2 heures est incluse dans tous les plans à l'inscription.",
  },
]

function fmt(n: number) {
  return n.toLocaleString('fr-FR')
}

export default function TarifsPage() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [annual, setAnnual] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user)
    })
  }, [])
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  /* Modal état */
  const [modal, setModal] = useState<{ plan: typeof PLANS[0] } | null>(null)
  const [form, setForm] = useState({ nom: '', email: '', entreprise: '', tel: '' })

  function openModal(plan: typeof PLANS[0]) {
    setForm({ nom: '', email: '', entreprise: '', tel: '' })
    setModal({ plan })
  }

  function handleWhatsApp(plan: typeof PLANS[0]) {
    if (plan.ctaType === 'contact') {
      window.open(
        waLink(
          `Bonjour BTP Mali 👋\n\nJe suis intéressé par le plan Entreprise à 125 000 FCFA/mois.\nPouvez-vous me contacter ?`
        ),
        '_blank'
      )
      return
    }
    openModal(plan)
  }

  function sendTrialWA(e: React.FormEvent) {
    e.preventDefault()
    if (!modal) return
    const planName = modal.plan.name.toUpperCase()
    const msg =
      `Bonjour BTP Mali 👋\n\nJe souhaite démarrer mon essai gratuit de 30 jours.\n\n📋 Mes informations :\n` +
      `Nom : ${form.nom}\nEmail : ${form.email}\nEntreprise : ${form.entreprise}\nTéléphone : ${form.tel}\n` +
      `Plan choisi : ${planName}\n\nMerci !`
    window.open(waLink(msg), '_blank')
    setModal(null)
  }

  return (
    <div className="min-h-[100dvh] bg-[#1C1C1C] text-white">

      {/* ── Navigation ── */}
      <header className="border-b border-white/[0.06] sticky top-0 z-40 bg-[#1C1C1C]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-md shadow-orange-500/20">
              <svg viewBox="0 0 24 24" fill="none" className="w-4.5 h-4.5">
                <path d="M3 21h18M5 21V11m14 0v10M3 11l9-7 9 7M10 21v-5h4v5"
                  stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-bold text-[15px] text-white">BTP Mali</span>
          </Link>
          <button
            onClick={() => router.push(isLoggedIn ? '/dashboard' : '/login')}
            className="flex items-center gap-2 text-[13px] font-medium text-gray-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.08] px-4 py-2 rounded-xl transition-[color,background-color]"
          >
            {isLoggedIn ? 'Mon dashboard' : 'Accéder au logiciel'}
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
              <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-16 pb-12 px-4 sm:px-6">
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              'linear-gradient(#F97316 1px, transparent 1px), linear-gradient(90deg, #F97316 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[12px] font-semibold px-4 py-1.5 rounded-full mb-6">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-3.5 h-3.5">
              <path d="M8 1.5C5.51 1.5 3.5 3.51 3.5 6c0 3.75 4.5 8.5 4.5 8.5S12.5 9.75 12.5 6c0-2.49-2.01-4.5-4.5-4.5z" strokeLinejoin="round"/>
              <circle cx="8" cy="6" r="1.5"/>
            </svg>
            Made in Mali
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white leading-tight tracking-[-0.03em] mb-4">
            Gérez vos chantiers<br />
            <span className="text-orange-400">professionnellement</span>
          </h1>
          <p className="text-gray-400 text-lg mb-10">
            Le seul logiciel BTP conçu pour le Mali
          </p>

          {/* Toggle Mensuel / Annuel */}
          <div className="inline-flex items-center bg-[#282828] border border-white/[0.08] rounded-2xl p-1 gap-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-[color,background-color,box-shadow,transform] ${
                !annual ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-[color,background-color,box-shadow,transform] ${
                annual ? 'bg-orange-500 text-white shadow shadow-orange-500/30' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Annuel
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${annual ? 'bg-white/20 text-white' : 'bg-emerald-500/15 text-emerald-400'}`}>
                2 mois offerts
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Plans ── */}
      <section className="px-4 sm:px-6 pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {PLANS.map(plan => {
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl border p-6 sm:p-7 transition-transform ${
                  plan.featured
                    ? 'bg-[#242424] border-white/[0.12] md:-mt-3 md:-mb-3 md:py-10'
                    : 'bg-[#1E1E1E] border-white/[0.07]'
                }`}
              >
                {/* Badge */}
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-xl font-semibold text-white tracking-[-0.02em] mb-1">{plan.name}</h2>
                    <p className="text-gray-500 text-[12px]">{plan.target}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${plan.badgeClass}`}>
                    {plan.badge}
                  </span>
                </div>

                {/* Prix */}
                <div className="mb-6">
                  {annual ? (
                    <>
                      {/* Prix mensuel barré */}
                      <p className="text-gray-600 text-[13px] line-through mb-1">
                        {fmt(plan.priceMonthly)} FCFA/mois
                      </p>
                      {/* Prix annuel total en grand */}
                      <div className="flex items-end gap-1.5">
                        <span className="text-3xl sm:text-4xl font-bold text-white tracking-[-0.03em]">{fmt(plan.annualTotal)}</span>
                        <span className="text-gray-400 text-[13px] mb-1">FCFA/an</span>
                      </div>
                      {/* Équivalent mensuel */}
                      <p className="text-emerald-400 text-[12px] font-medium mt-1.5">
                        soit {fmt(plan.priceAnnual)} FCFA/mois — 2 mois offerts
                      </p>
                    </>
                  ) : (
                    <div className="flex items-end gap-1.5">
                      <span className="text-3xl sm:text-4xl font-bold text-white tracking-[-0.03em]">{fmt(plan.priceMonthly)}</span>
                      <span className="text-gray-500 text-[13px] mb-1">FCFA/mois</span>
                    </div>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className={`flex items-start gap-2.5 text-[13px] ${f.ok ? 'text-gray-300' : 'text-gray-600'}`}>
                      {f.ok ? (
                        <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0">
                          <path d="M3 8l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 mt-0.5 text-gray-700 shrink-0">
                          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      )}
                      {f.label}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => handleWhatsApp(plan)}
                  className={`w-full py-3 rounded-xl text-[14px] font-semibold transition-[color,background-color,box-shadow,transform] active:scale-[0.97] ${plan.ctaClass}`}
                >
                  {plan.cta}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Modes de paiement ── */}
      <section className="px-4 sm:px-6 py-14 border-t border-white/[0.05]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl font-semibold text-white tracking-[-0.02em] mb-8">Modes de paiement acceptés</h2>
          <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
            {[
              { dot: 'bg-orange-500', label: 'Orange Money', sub: 'Prioritaire', color: 'border-orange-500/30 bg-orange-500/[0.06]' },
              { dot: 'bg-emerald-400', label: 'Wave', sub: '', color: 'border-emerald-500/20 bg-emerald-500/[0.05]' },
              { dot: 'bg-blue-400', label: 'Virement bancaire', sub: '', color: 'border-blue-500/20 bg-blue-500/[0.05]' },
            ].map(p => (
              <div key={p.label} className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border ${p.color}`}>
                <span className={`w-4 h-4 rounded-full ${p.dot} shrink-0`} />
                <div className="text-left">
                  <p className="text-white text-[13px] font-semibold">{p.label}</p>
                  {p.sub && <p className="text-orange-400 text-[10px] font-medium">{p.sub}</p>}
                </div>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-[14px] leading-relaxed">
            Après confirmation de votre paiement, votre compte est activé <span className="text-white font-medium">sous 2 heures.</span>
          </p>
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section className="px-4 sm:px-6 py-14 border-t border-white/[0.05]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-semibold text-white text-center tracking-[-0.02em] mb-10">Comment ça marche</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                num: '1',
                title: 'Choisissez votre plan',
                desc: 'Sélectionnez le plan adapté à la taille de votre entreprise',
              },
              {
                num: '2',
                title: 'Contactez-nous sur WhatsApp',
                desc: 'Envoyez votre demande et effectuez le paiement par Orange Money',
              },
              {
                num: '3',
                title: 'Commencez à gérer vos chantiers',
                desc: 'Votre compte est activé sous 2 heures. Formation gratuite incluse !',
              },
            ].map(step => (
              <div key={step.num} className="relative bg-[#1E1E1E] border border-white/[0.06] rounded-xl p-6 text-center">
                <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-orange-400 font-bold text-[15px]">{step.num}</span>
                </div>
                <h3 className="text-white text-[14px] font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-500 text-[13px] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Garantie ── */}
      <section className="px-4 sm:px-6 py-10">
        <div className="max-w-2xl mx-auto">
          <div className="bg-orange-500/[0.07] border border-orange-500/25 rounded-xl p-7 text-center">
            <div className="flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-9 h-9 text-orange-400">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round" strokeLinecap="round"/>
                <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-white text-[17px] font-semibold tracking-[-0.02em] mb-2">Satisfait ou remboursé 30 jours</h3>
            <p className="text-gray-400 text-[14px] leading-relaxed">
              Si BTP Mali ne répond pas à vos besoins, nous vous remboursons intégralement dans les 30 premiers jours.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-4 sm:px-6 py-14 border-t border-white/[0.05]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-white text-center tracking-[-0.02em] mb-8">Questions fréquentes</h2>
          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <div
                key={i}
                className="bg-[#1E1E1E] border border-white/[0.06] rounded-xl overflow-hidden"
              >
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-white text-[14px] font-medium">{item.q}</span>
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                  >
                    <path d="M3 6l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-200 ease-out overflow-hidden ${
                    openFaq === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="min-h-0">
                    <div className="px-5 pb-4">
                      <p className="text-gray-400 text-[13px] leading-relaxed">{item.a}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] px-4 sm:px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px]">
          <div className="flex items-center gap-2 text-gray-500">
            <span className="font-semibold text-gray-400">BTP Mali</span>
            <span>—</span>
            <span>Made in Mali</span>
          </div>
          <div className="flex items-center gap-5 flex-wrap justify-center">
            <button
              onClick={() => router.push(isLoggedIn ? '/dashboard' : '/login')}
              className="text-gray-500 hover:text-orange-400 transition-colors"
            >
              {isLoggedIn ? 'Mon dashboard' : 'Accéder au logiciel'}
            </button>
            <a
              href={waLink('Bonjour BTP Mali, je souhaite vous contacter.')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-orange-400 transition-colors"
            >
              Nous contacter
            </a>
            <Link href="/cgu" className="text-gray-500 hover:text-orange-400 transition-colors">CGU</Link>
            <Link href="/confidentialite" className="text-gray-500 hover:text-orange-400 transition-colors">Confidentialité</Link>
          </div>
        </div>
      </footer>

      {/* ── Modal essai gratuit ── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#232323] rounded-xl border border-white/[0.09] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-white tracking-[-0.01em]">Démarrer votre essai gratuit</h3>
                <p className="text-gray-500 text-[12px] mt-0.5">
                  Plan sélectionné :&nbsp;
                  <span className="text-orange-400 font-semibold">{modal.plan.name}</span>
                  &nbsp;—&nbsp;{fmt(modal.plan.priceMonthly)} FCFA/mois
                </p>
              </div>
              <button
                onClick={() => setModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M2 2l12 12M14 2L2 14" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form onSubmit={sendTrialWA} className="px-6 py-5 space-y-4">
              {[
                { key: 'nom' as const, label: 'Nom complet', type: 'text', placeholder: 'Ex : Amadou Traoré' },
                { key: 'email' as const, label: 'Email', type: 'email', placeholder: 'nom@entreprise.ml' },
                { key: 'entreprise' as const, label: "Nom de l'entreprise", type: 'text', placeholder: 'Ex : BTP Traoré & Fils' },
                { key: 'tel' as const, label: 'Téléphone WhatsApp', type: 'tel', placeholder: '+223 XX XX XX XX' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
                    {field.label} <span className="text-orange-400">*</span>
                  </label>
                  <input
                    type={field.type}
                    value={form[field.key]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    required
                    className="w-full bg-[#1C1C1C] border border-white/[0.08] text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-[border-color,box-shadow]"
                  />
                </div>
              ))}

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-[color,background-color,box-shadow,transform] active:scale-[0.97] shadow-lg shadow-orange-500/25 mt-2"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.533 5.855L0 24l6.335-1.521A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.013-1.376l-.36-.213-3.727.895.944-3.637-.234-.373A9.818 9.818 0 1112 21.818z"/>
                </svg>
                Envoyer ma demande sur WhatsApp
              </button>

              <p className="text-gray-600 text-[11px] text-center">
                Vous serez redirigé vers WhatsApp avec vos informations pré-remplies
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
