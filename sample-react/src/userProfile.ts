/**
 * Client for the sample-java-api backend.
 *
 * The API runs separately (see `sample-java-api/README.md`); point the app at a
 * different host with `VITE_API_BASE_URL` in `.env.local`.
 */

/**
 * Origin of the sample-java-api. Exported because main.tsx passes it to RUM's
 * `allowedTracingUrls`, and the two must not drift: a mismatch silently stops
 * trace headers being attached to these requests.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

/**
 * The organization a user belongs to. Shaped to pass straight to
 * `datadogRum.setAccount`, which requires `id` and treats the rest as
 * `account.*` attributes.
 */
export interface Account {
  id: string
  name: string
  plan: string
}

/** Mirrors the `UserProfile` record returned by the Java API. */
export interface UserProfile {
  email: string
  firstName: string
  lastName: string
  displayName: string
  jobTitle: string
  department: string
  location: string
  avatarUrl: string
  /** ISO date, e.g. "2021-03-15". */
  memberSince: string
  roles: string[]
  account: Account
}

/** Error body the API returns for a 4xx. */
interface ApiError {
  status: number
  error: string
  message: string
}

/**
 * Thrown for any failed profile call.
 *
 * Carries the HTTP status so callers can react to the kind of failure - the
 * sign-in flow logs a 4xx as a warning and a 5xx as an error, mirroring how the
 * API logs it on its own side. `status` is null when there was no response at
 * all, which is a failure to reach the API rather than a rejection by it.
 */
export class ProfileApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ProfileApiError'
    this.status = status
  }
}

/** Request timeout, so a stalled backend cannot hang the sign-in form. */
const REQUEST_TIMEOUT_MS = 5000

/**
 * Calls `getUserProfile` for the given email and site.
 *
 * `site` does not change the profile that comes back; it is sent so the API can
 * put it in its server-side flag evaluation context, matching the `site`
 * attribute this app already sends to the browser provider. Without it, a rule
 * targeting on site - which `show-new-feature` does - cannot match on the
 * backend.
 *
 * Rejects with a human-readable message on a non-2xx response, a timeout, or a
 * network failure - callers are expected to surface it rather than retry.
 */
export async function fetchUserProfile(
  email: string,
  site: string,
): Promise<UserProfile> {
  const url =
    `${API_BASE_URL}/api/users/profile` +
    `?email=${encodeURIComponent(email)}&site=${encodeURIComponent(site)}`

  let response: Response
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (cause) {
    // A CORS rejection or a backend that is not running both land here, and the
    // browser deliberately withholds the details, so name the likely cause.
    throw new ProfileApiError(
      `Could not reach the profile API at ${API_BASE_URL}. Is sample-java-api running?`,
      null,
      { cause },
    )
  }

  if (!response.ok) {
    // The API sends a JSON error body, but a proxy or 500 may not.
    const detail = await response
      .json()
      .then((body: ApiError) => body.message)
      .catch(() => null)
    throw new ProfileApiError(
      detail
        ? `getUserProfile failed (${response.status}): ${detail}`
        : `getUserProfile failed (${response.status})`,
      response.status,
    )
  }

  return (await response.json()) as UserProfile
}
