import Link from 'next/link'

export const metadata = { title: 'Conditions Générales d\'Utilisation — BTP Mali' }

const SECTIONS = [
  {
    n: '1', title: 'Objet',
    body: "Les présentes conditions générales d'utilisation régissent l'accès et l'utilisation du logiciel BTP Mali, édité par Adou Flaws, accessible à l'adresse saas-btp-mali.vercel.app.",
  },
  {
    n: '2', title: 'Description du service',
    body: "BTP Mali est un logiciel de gestion de chantiers en ligne (SaaS) destiné aux entreprises du secteur du bâtiment et des travaux publics au Mali. Il permet la gestion des chantiers, des équipes, des devis, des factures et des relances clients.",
  },
  {
    n: '3', title: 'Inscription et compte utilisateur',
    body: "L'utilisation du service nécessite la création d'un compte. L'utilisateur s'engage à fournir des informations exactes et à maintenir la confidentialité de ses identifiants de connexion. L'utilisateur est responsable de toute activité effectuée depuis son compte.",
  },
  {
    n: '4', title: 'Essai gratuit',
    body: "Un essai gratuit de 14 jours est proposé à l'inscription, sans engagement et sans nécessité de moyen de paiement. À l'issue de cette période, l'accès aux fonctionnalités de modification est suspendu jusqu'à l'activation d'un abonnement payant. Les données de l'utilisateur restent conservées et accessibles en lecture.",
  },
  {
    n: '5', title: 'Abonnement et facturation',
    body: "Les plans d'abonnement et leurs tarifs sont disponibles sur la page /tarifs. Le paiement s'effectue par Orange Money, Wave ou virement bancaire. L'activation du compte intervient après réception et confirmation du paiement. L'abonnement est sans engagement et peut être résilié à tout moment.",
  },
  {
    n: '6', title: 'Données et propriété',
    body: "Les données saisies par l'utilisateur (chantiers, factures, informations clients) restent sa propriété. L'utilisateur peut à tout moment demander l'export ou la suppression de ses données en contactant le support.",
  },
  {
    n: '7', title: 'Disponibilité du service',
    body: "BTP Mali s'efforce d'assurer une disponibilité continue du service, sans pouvoir garantir une absence totale d'interruption, notamment pour des opérations de maintenance ou des causes indépendantes de sa volonté.",
  },
  {
    n: '8', title: 'Responsabilité',
    body: "BTP Mali ne pourra être tenu responsable des conséquences résultant d'une mauvaise utilisation du logiciel, d'une perte de connexion internet, ou d'erreurs de saisie de l'utilisateur. Il appartient à l'utilisateur de vérifier l'exactitude des informations générées (devis, factures) avant leur envoi à des tiers.",
  },
  {
    n: '9', title: 'Modification des conditions',
    body: "BTP Mali se réserve le droit de modifier les présentes conditions. Les utilisateurs seront informés de toute modification substantielle.",
  },
  {
    n: '10', title: 'Contact',
    body: "Pour toute question relative aux présentes conditions, vous pouvez nous contacter au +223 76 75 30 87 ou par email à adouflaws@gmail.com.",
  },
]

export default function CGUPage() {
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
            Conditions Générales<br/>d&apos;Utilisation
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
            <Link href="/confidentialite" className="text-gray-600 hover:text-orange-400 transition-colors duration-150">
              Politique de confidentialité
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
