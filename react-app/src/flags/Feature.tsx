import type { ReactNode } from 'react'
import { useFlag } from './hooks'
import type { AppFlagValues, FlagKey } from './flags'

export interface FeatureProps<K extends FlagKey> {
  flag: K
  /**
   * Render when the flag equals this value. Defaults to `true`, so boolean
   * flags need only `<Feature flag="betaBanner">`.
   */
  equals?: AppFlagValues[K]
  children: ReactNode
  fallback?: ReactNode
}

/** Declarative gate, for when a hook plus a ternary is noisier than markup. */
export function Feature<K extends FlagKey>({
  flag,
  equals,
  children,
  fallback = null,
}: FeatureProps<K>) {
  const value = useFlag(flag)
  const expected = (equals ?? true) as AppFlagValues[K]
  return <>{value === expected ? children : fallback}</>
}
