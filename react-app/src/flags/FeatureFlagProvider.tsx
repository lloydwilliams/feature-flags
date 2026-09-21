import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  FeatureFlagContext,
  type FeatureFlagContextValue,
  type SourceStatus,
} from './context'
import { evaluateAll } from './evaluate'
import { flags as defaultRegistry } from './flags'
import {
  OVERRIDE_STORAGE_KEY,
  readStoredOverrides,
  readUrlOverrides,
  writeStoredOverrides,
} from './overrides'
import type { FlagSource } from './source'
import type { EvaluationContext, FlagRegistry, FlagValue } from './types'

export interface FeatureFlagProviderProps {
  children: ReactNode
  /** Defaults to the app registry in `flags.ts`. Override in tests. */
  registry?: FlagRegistry
  /**
   * Who we are evaluating for.
   *
   * Treated as a dependency by identity: build it at module scope, or memoize
   * it, or the remote source will refetch on every render.
   */
  context?: EvaluationContext
  /** Optional remote config. Failures are non-fatal. */
  source?: FlagSource
  /** Seeds overrides without touching localStorage. Handy in tests. */
  initialOverrides?: Record<string, FlagValue>
  /** Set false to keep overrides in memory only. */
  persist?: boolean
}

const EMPTY_CONTEXT: EvaluationContext = {}
const EMPTY_REMOTE: Record<string, FlagValue> = {}

/** The outcome of one `source.load()`, tagged with what produced it. */
interface LoadResult {
  source: FlagSource
  context: EvaluationContext
  remote: Record<string, FlagValue>
  error: Error | null
}

export function FeatureFlagProvider({
  children,
  registry = defaultRegistry,
  context = EMPTY_CONTEXT,
  source,
  initialOverrides,
  persist = true,
}: FeatureFlagProviderProps) {
  const [overrides, setOverrides] = useState<Record<string, FlagValue>>(() => {
    if (initialOverrides) return initialOverrides
    if (!persist) return {}

    const { reset } = readUrlOverrides(registry)
    if (reset) {
      writeStoredOverrides({})
      return {}
    }
    return readStoredOverrides(registry)
  })

  // URL overrides are read once per load and never persisted, so a shared
  // `?ff_x=true` link stops applying once you navigate away.
  const urlOverrides = useMemo(
    () => readUrlOverrides(registry).overrides,
    [registry],
  )

  const [result, setResult] = useState<LoadResult | null>(null)

  useEffect(() => {
    if (!source) return

    let active = true
    source
      .load(context)
      .then((remote) => {
        if (active) setResult({ source, context, remote, error: null })
      })
      .catch((error: unknown) => {
        if (!active) return
        // Never block the UI on flag delivery: log and fall back to local
        // rules and defaults.
        const wrapped =
          error instanceof Error ? error : new Error(String(error))
        console.warn('[flags] source failed, using defaults:', wrapped)
        setResult({ source, context, remote: {}, error: wrapped })
      })

    return () => {
      active = false
    }
  }, [source, context])

  // Derived rather than stored, so swapping source or context reports
  // `loading` immediately without another render pass.
  const fresh =
    result !== null && result.source === source && result.context === context
  const remote = fresh ? result.remote : EMPTY_REMOTE
  const sourceError = fresh ? result.error : null
  const sourceStatus: SourceStatus = !source
    ? 'idle'
    : !fresh
      ? 'loading'
      : result.error
        ? 'error'
        : 'ready'

  // Keep overrides consistent across tabs.
  useEffect(() => {
    if (!persist) return

    const onStorage = (event: StorageEvent) => {
      if (event.key !== OVERRIDE_STORAGE_KEY) return
      setOverrides(readStoredOverrides(registry))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [persist, registry])

  const setOverride = useCallback(
    (key: string, value: FlagValue) => {
      setOverrides((current) => {
        const next = { ...current, [key]: value }
        if (persist) writeStoredOverrides(next)
        return next
      })
    },
    [persist],
  )

  const clearOverride = useCallback(
    (key: string) => {
      setOverrides((current) => {
        const next = { ...current }
        delete next[key]
        if (persist) writeStoredOverrides(next)
        return next
      })
    },
    [persist],
  )

  const clearAllOverrides = useCallback(() => {
    setOverrides({})
    if (persist) writeStoredOverrides({})
  }, [persist])

  const evaluations = useMemo(
    () =>
      evaluateAll(registry, context, {
        // URL wins over the persisted panel state.
        overrides: { ...overrides, ...urlOverrides },
        remote,
      }),
    [registry, context, overrides, urlOverrides, remote],
  )

  const value = useMemo<FeatureFlagContextValue>(
    () => ({
      registry,
      context,
      evaluations,
      overrides,
      urlOverrides,
      sourceStatus,
      sourceError,
      setOverride,
      clearOverride,
      clearAllOverrides,
    }),
    [
      registry,
      context,
      evaluations,
      overrides,
      urlOverrides,
      sourceStatus,
      sourceError,
      setOverride,
      clearOverride,
      clearAllOverrides,
    ],
  )

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  )
}
