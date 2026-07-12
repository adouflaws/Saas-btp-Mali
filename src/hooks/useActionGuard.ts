import { useSubscription } from '@/contexts/SubscriptionContext'

export function useActionGuard() {
  const { isReadOnly, showUpgradeModal } = useSubscription()

  const guard = (action: () => void) => {
    if (isReadOnly) {
      showUpgradeModal()
      return
    }
    action()
  }

  return { guard, isReadOnly }
}
