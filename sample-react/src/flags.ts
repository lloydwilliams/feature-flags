import { DatadogProvider } from '@datadog/openfeature-browser'
import { OpenFeature } from '@openfeature/react-sdk'

/**
 * Datadog Feature Flags wiring, via OpenFeature.
 *
 * Config comes from .env.local (see .env.example). If it is incomplete we skip
 * registering the provider entirely and OpenFeature falls back to its no-op
 * provider, so the app still renders and every flag returns its default.
 */

const applicationId = import.meta.env.VITE_DD_APPLICATION_ID
const clientToken = import.meta.env.VITE_DD_CLIENT_TOKEN
const site = import.meta.env.VITE_DD_SITE ?? 'datadoghq.com'
const env = import.meta.env.VITE_DD_ENV ?? 'dev'

/** Which required values are still missing, for the on-screen notice. */
export const missingConfig = [
  !applicationId && 'VITE_DD_APPLICATION_ID',
  !clientToken && 'VITE_DD_CLIENT_TOKEN',
].filter((value): value is string => typeof value === 'string')

export const isConfigured = missingConfig.length === 0

export const datadogSite = site
export const datadogEnv = env

const TARGETING_KEY_STORAGE = 'sample-react:targeting-key'

/**
 * Stable per-browser targeting key, so percentage rollouts don't reshuffle on
 * every reload. A real app would use its authenticated user id here.
 */
function targetingKey(): string {
  try {
    const existing = localStorage.getItem(TARGETING_KEY_STORAGE)
    if (existing) return existing
    const generated = crypto.randomUUID()
    localStorage.setItem(TARGETING_KEY_STORAGE, generated)
    return generated
  } catch {
    return 'anonymous'
  }
}

export const evaluationContext = {
  targetingKey: targetingKey(),
}

/**
 * Registered at module scope, before render, per the Datadog docs. `setProvider`
 * is not awaited; <OpenFeatureProvider suspendUntilReady> handles the wait.
 */
export function initializeFlags(): void {
  if (!isConfigured) {
    console.warn(
      `[flags] Datadog Feature Flags not configured (missing ${missingConfig.join(', ')}). ` +
        'Flags will return their default values. See .env.example.',
    )
    return
  }

  const provider = new DatadogProvider({
    applicationId,
    clientToken: clientToken!,
    site,
    env,
  })

  OpenFeature.setProvider(provider, evaluationContext)
}
