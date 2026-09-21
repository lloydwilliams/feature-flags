import type { EvaluationContext, FlagValue } from './types'

/**
 * Where remotely-controlled flag values come from.
 *
 * Kept to a single method so it can be backed by anything: a config endpoint,
 * a vendor SDK, a websocket, or a static object in tests.
 */
export interface FlagSource {
  load(context: EvaluationContext): Promise<Record<string, FlagValue>>
}

/** Fixed values. Useful in tests and Storybook. */
export function createStaticSource(
  values: Record<string, FlagValue>,
): FlagSource {
  return { load: () => Promise.resolve(values) }
}

/**
 * Fetches `{ "flagKey": value }` JSON from `url`.
 *
 * The evaluation context is sent as a POST body so the server can do its own
 * targeting; values it returns land at `remote` precedence.
 */
export function createHttpSource(
  url: string,
  init?: RequestInit,
): FlagSource {
  return {
    async load(context) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(context),
        ...init,
      })
      if (!response.ok) {
        throw new Error(`Flag source ${url} responded ${response.status}`)
      }
      return (await response.json()) as Record<string, FlagValue>
    },
  }
}
