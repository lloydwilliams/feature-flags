import { postJson } from './api'

/** Mirrors the `AiScanResponse` record returned by StartAIScan. */
export interface AiScanResult {
  /**
   * Whether the scan actually ran. False means `show-ai-scan` is not live for
   * this site - a normal 200, not a failure, so callers branch on this rather
   * than on the status code.
   */
  enabled: boolean
  site: string
  amount: number
  /**
   * Why the flag evaluated as it did, straight from the server-side evaluation:
   * `TARGETING_MATCH` for a rule naming this site, `SPLIT` for a percentage
   * rollout, `STATIC` when neither applied.
   */
  reason?: string
  /**
   * Which rollout bucket the caller landed in, when the reason is `SPLIT`.
   * Datadog reports it as `"true"`/`"false"` for boolean flags, so it is
   * usually present; the API omits the field when the provider supplies none.
   */
  variant?: string
  /** Human-readable line, ready to show. Composed by the API, not here. */
  message: string
}

/**
 * Calls StartAIScan.
 *
 * `email` and `site` are the server-side flag evaluation context: the API
 * evaluates `show-ai-scan` for that site and decides there, so the decision
 * cannot drift from whatever the browser provider happens to have cached.
 *
 * Rejects with an `ApiError` on a non-2xx response, a timeout, or a network
 * failure.
 */
export function startAiScan(
  amount: number,
  email: string,
  site: string,
): Promise<AiScanResult> {
  return postJson<AiScanResult>('/api/ai-scan/start', 'StartAIScan', {
    amount,
    email,
    site,
  })
}
