'use client'

import { useSubscription } from '@/contexts/SubscriptionContext'

export default function UpgradeModal() {
  const { upgradeModalOpen, hideUpgradeModal } = useSubscription()
  if (!upgradeModalOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={hideUpgradeModal} />
      <div className="relative w-full max-w-sm bg-[#232323] rounded-2xl border border-white/[0.09] shadow-2xl p-8 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-[17px] font-bold text-white mb-2">Action non disponible</h2>
        <p className="text-gray-400 text-[13px] mb-1">
          Cette action nécessite un abonnement actif.
        </p>
        <p className="text-gray-500 text-[13px] mb-6">
          Réactivez votre compte pour reprendre toutes les fonctionnalités. Vos données sont conservées.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href="/tarifs"
            className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-bold transition-colors"
          >
            Voir les plans →
          </a>
          <a
            href="https://wa.me/22376753087"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 rounded-xl border border-white/[0.10] text-orange-400 hover:text-orange-300 text-[13px] font-semibold transition-colors"
          >
            Contacter le support WhatsApp
          </a>
          <button
            onClick={hideUpgradeModal}
            className="text-gray-600 hover:text-gray-400 text-[12px] transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
