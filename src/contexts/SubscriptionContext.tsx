'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type SubscriptionContextType = {
  isReadOnly: boolean
  setIsReadOnly: (v: boolean) => void
  upgradeModalOpen: boolean
  showUpgradeModal: () => void
  hideUpgradeModal: () => void
}

export const SubscriptionContext = createContext<SubscriptionContextType>({
  isReadOnly: false,
  setIsReadOnly: () => {},
  upgradeModalOpen: false,
  showUpgradeModal: () => {},
  hideUpgradeModal: () => {},
})

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)

  const showUpgradeModal = useCallback(() => setUpgradeModalOpen(true), [])
  const hideUpgradeModal = useCallback(() => setUpgradeModalOpen(false), [])

  return (
    <SubscriptionContext.Provider value={{ isReadOnly, setIsReadOnly, upgradeModalOpen, showUpgradeModal, hideUpgradeModal }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export const useSubscription = () => useContext(SubscriptionContext)
