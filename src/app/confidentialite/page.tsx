import Link from 'next/link'

export const metadata = { title: 'Politique de Confidentialité — BTP Mali' }

const SECTIONS = [
  {
    n: '1', title: 'Données collectées',
    body: "Lors de votre inscription et de l'utilisation du service, nous collectons : votre nom, le nom de votre entreprise, votre numéro de téléphone, votre adresse email, ainsi que les données que vous saisissez dans le logiciel (chantiers, ouvriers, devis, factures, photos de chantier).",
  },
  {
    n: '2', title: 'Utilisation des données',
    body: "Ces données sont utilisées exclusivement pour : vous permettre d'utiliser les fonctionnalités du logiciel, vous contacter dans le cadre du support client, vous informer de l'état de votre abonnement. Vos données ne sont jamais vendues ni partagées avec des tiers à des fins commerciales.",
  },
  {
    n: '3', title: 'Stockage et sécurité',
    body: "Vos données sont hébergées de manière sécurisée chez Supabase, une infrastructure cloud certifiée, avec chiffrement des données en transit et au repos. Chaque entreprise ne peut accéder qu'à ses propres données, grâce à un système d'isolation stricte (Row Level Security).",
  },
  {
    n: '4', title: 'Conservation des données',
    body: "Vos données sont conservées pendant toute la durée d'utilisation du service. En cas de résiliation, elles restent accessibles pendant une période raisonnable avant suppression définitive, sauf demande explicite de suppression immédiate.",
  },
  {
    n: '5', title: 'Vos droits',
    items: [
      "L'accès à l'ensemble de vos données",
      "L'export de vos données",
      "La rectification d'informations inexactes",
      "La suppression définitive de votre compte et de vos données",
    ],
    body: "Pour exercer ces droits, contactez-nous au +223 76 75 30 87 ou par email à adouflaws@gmail.com.",
  },
  {
    n: '6', title: 'Cookies et données techniques',
    body: "Le logiciel utilise des cookies de session nécessaires au fonctionnement de l'authentification. Aucun cookie publicitaire ou de suivi tiers n'est utilisé.",
  },
  {
    n: '7', title: 'Modifications',
    body: "Cette politique peut être mise à jour pour refléter des changements dans nos pratiques. La date de dernière mise à jour est indiquée en bas de cette page.",
  },
]

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <div className="max-w-3xl mx-auto px-5 py-10 sm:py-16">

        {/* Retour */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-[13px] font-medium transition-colors duration-150 mb-10"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Retour à l&apos;accueil
        </Link>

        {/* En-tête */}
        <div className="mb-12">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-7 h-7 bg-orange-500 rounded-[8px] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-[15px] h-[15px]">
                <path d="M3 21h18M5 21V11m14 0v10M3 11l9-7 9 7M10 21v-5h4v5" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">BTP Mali</span>
          </div>
          <h1 className="text-[1.8rem] sm:text-4xl font-black tracking-[-0.03em] text-white leading-tight mb-3">
            Politique de<br/>Confidentialité
          </h1>
          <p className="text-gray-500 text-[14px]">Dernière mise à jour : 18 juin 2026</p>
        </div>

        {/* Séparateur */}
        <div className="h-px bg-white/[0.07] mb-12" />

        {/* Sections */}
        <div className="space-y-10">
          {SECTIONS.map(s => (
            <section key={s.n}>
              <h2 className="text-orange-400 text-[11px] font-bold uppercase tracking-[0.1em] mb-2">
                Article {s.n}
              </h2>
              <h3 className="text-white text-[17px] font-semibold tracking-[-0.015em] mb-3">
                {s.title}
              </h3>
              {s.items && (
                <div className="mb-3">
                  <p className="text-gray-400 text-[14px] sm:text-[15px] leading-relaxed mb-3">
                    Vous pouvez à tout moment demander :
                  </p>
                  <ul className="space-y-2 pl-1">
                    {s.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-gray-400 text-[14px] sm:text-[15px] leading-relaxed">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-[3px]" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 8l3 3 7-7"/>
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-gray-400 text-[14px] sm:text-[15px] leading-relaxed">
                {s.body}
              </p>
            </section>
          ))}
        </div>

        {/* Séparateur bas */}
        <div className="h-px bg-white/[0.07] mt-14 mb-8" />

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-gray-600 text-[12px]">
            © 2026 BTP Mali — Bamako, Mali
          </p>
          <div className="flex items-center gap-5 text-[12px]">
            <Link href="/cgu" className="text-gray-600 hover:text-orange-400 transition-colors duration-150">
              CGU
            </Link>
            <Link href="/login" className="text-gray-600 hover:text-orange-400 transition-colors duration-150">
              Se connecter
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
