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

/** Pre-sign-in context: a stable anonymous identity, nothing else. */
export const anonymousContext = {
  targetingKey: targetingKey(),
}

/**
 * Promotes the signed-in user into the flag evaluation context, so Datadog can
 * target on them.
 *
 * Attribute names here are what you reference in Datadog's targeting rules:
 * flat keys like `email` and `site` - not the `usr.`-prefixed form used when
 * querying RUM events.
 *
 * `targetingKey` switches from the anonymous UUID to the email, which is the
 * point (rules and percentage rollouts follow the person, not the browser) but
 * does mean a user can cross a rollout boundary at sign-in.
 *
 * The provider also derives these from the RUM user automatically, but setting
 * them explicitly wins over that and does not depend on RUM's global being
 * ready first.
 */
export async function identifyUser(
  email: string,
  userSite: string,
): Promise<void> {
  await OpenFeature.setContext({
    targetingKey: email,
    email,
    site: userSite,
  })
}

/** Returns to the anonymous context on sign-out. */
export async function resetUserContext(): Promise<void> {
  await OpenFeature.setContext(anonymousContext)
}

/** Registered at module scope, before render, per the Datadog docs. */
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

  OpenFeature.setProvider(provider, anonymousContext)
}
