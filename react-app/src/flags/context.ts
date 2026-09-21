import { createContext } from 'react'
import type {
  Evaluation,
  EvaluationContext,
  FlagRegistry,
  FlagValue,
} from './types'

export type SourceStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface FeatureFlagContextValue {
  registry: FlagRegistry
  context: EvaluationContext
  evaluations: Record<string, Evaluation>
  /** Persisted overrides only; URL overrides are applied but not listed here. */
  overrides: Record<string, FlagValue>
  urlOverrides: Record<string, FlagValue>
  sourceStatus: SourceStatus
  sourceError: Error | null
  setOverride: (key: string, value: FlagValue) => void
  clearOverride: (key: string) => void
  clearAllOverrides: () => void
}

/** Lives in its own module so the provider file only exports components. */
export const FeatureFlagContext =
  createContext<FeatureFlagContextValue | null>(null)
