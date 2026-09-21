import { useContext, useMemo } from 'react'
import {
  FeatureFlagContext,
  type FeatureFlagContextValue,
} from './context'
import type { AppFlagValues, FlagKey } from './flags'
import type { Evaluation } from './types'

function useFlagContext(): FeatureFlagContextValue {
  const value = useContext(FeatureFlagContext)
  if (!value) {
    throw new Error(
      'Feature flag hooks require a <FeatureFlagProvider> ancestor.',
    )
  }
  return value
}

/**
 * Reads one flag, typed from the registry.
 *
 * `useFlag('newCheckout')` is `boolean`; `useFlag('checkoutLayout')` is
 * `'classic' | 'compact' | 'minimal'`.
 */
export function useFlag<K extends FlagKey>(key: K): AppFlagValues[K] {
  const { evaluations } = useFlagContext()
  return evaluations[key].value as AppFlagValues[K]
}

/** Reads every flag value at once. */
export function useFlags(): AppFlagValues {
  const { evaluations } = useFlagContext()
  return useMemo(() => {
    const values = {} as Record<string, unknown>
    for (const [key, evaluation] of Object.entries(evaluations)) {
      values[key] = evaluation.value
    }
    return values as AppFlagValues
  }, [evaluations])
}

/** The full evaluation for one flag, including why it resolved that way. */
export function useFlagEvaluation<K extends FlagKey>(key: K): Evaluation {
  const { evaluations } = useFlagContext()
  return evaluations[key]
}

/** Everything the dev panel needs. Not intended for product code. */
export function useFlagAdmin(): FeatureFlagContextValue {
  return useFlagContext()
}
