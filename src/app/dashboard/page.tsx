const stats = [
  {
    label: 'Chantiers actifs',
    value: '12',
    sub: '+3 ce mois',
    positive: true,
    bg: 'bg-orange-500/10',
    iconColor: 'text-orange-400',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
        <path
          d="M3 21h18M5 21V11m14 0v10M3 11l9-7 9 7M10 21v-5h4v5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: 'Budget total FCFA',
    value: '485 000 000',
    sub: 'Exercice 2024',
    positive: true,
    bg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
        <circle cx="12" cy="12" r="9" />
        <path
          d="M14.5 9.5H10a1.5 1.5 0 000 3h4a1.5 1.5 0 010 3H9.5M12 7v2m0 6v2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: 'Ouvriers',
    value: '87',
    sub: '+5 ce mois',
    positive: true,
    bg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Factures en attente',
    value: '6',
    sub: '12 500 000 FCFA',
    positive: false,
    bg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinejoin="round" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function DashboardPage() {
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {/* En-tête */}
      <div className="mb-6 md:mb-8">
        <p className="text-gray-600 text-[13px] capitalize">{dateStr}</p>
        <h1 className="text-xl md:text-2xl font-bold text-white mt-1">Tableau de bord</h1>
        <p className="text-gray-500 text-sm mt-1">
          Vue d&apos;ensemble de vos chantiers et activités
        </p>
      </div>

      {/* Cartes statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[#232323] rounded-2xl border border-white/[0.06] p-6 hover:border-white/[0.12] transition-all"
          >
            <div className="flex items-start justify-between mb-5">
              <div
                className={`w-11 h-11 ${stat.bg} rounded-xl flex items-center justify-center ${stat.iconColor}`}
              >
                {stat.icon}
              </div>
              <span
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                  stat.positive
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                {stat.sub}
              </span>
            </div>
            <p className="text-[2rem] font-bold text-white leading-none mb-1.5">
              {stat.value}
            </p>
            <p className="text-gray-500 text-[13px]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Section activité récente */}
      <div className="mt-8 bg-[#232323] rounded-2xl border border-white/[0.06] p-6">
        <h2 className="text-[15px] font-semibold text-white mb-4">
          Activité récente
        </h2>
        <div className="space-y-3">
          {[
            { action: 'Nouveau chantier créé', detail: 'Immeuble R+4 — Bamako Centre', time: 'Il y a 2h' },
            { action: 'Facture émise', detail: 'Devis #INV-0042 — 3 500 000 FCFA', time: 'Il y a 5h' },
            { action: 'Équipe affectée', detail: 'Maçonnerie → Chantier Sotuba', time: 'Hier' },
            { action: 'Budget mis à jour', detail: 'Route Nationale N1 — +15 000 000 FCFA', time: 'Hier' },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0"
            >
              <div>
                <p className="text-white text-[13.5px] font-medium">{item.action}</p>
                <p className="text-gray-600 text-[12px] mt-0.5">{item.detail}</p>
              </div>
              <span className="text-gray-700 text-[11px] shrink-0 ml-4">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
