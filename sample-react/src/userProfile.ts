/**
 * Client for the sample-java-api backend.
 *
 * The API runs separately (see `sample-java-api/README.md`); point the app at a
 * different host with `VITE_API_BASE_URL` in `.env.local`.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

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

/** Request timeout, so a stalled backend cannot hang the sign-in form. */
const REQUEST_TIMEOUT_MS = 5000

/**
 * Calls `getUserProfile` for the given email.
 *
 * Rejects with a human-readable message on a non-2xx response, a timeout, or a
 * network failure - callers are expected to surface it rather than retry.
 */
export async function fetchUserProfile(email: string): Promise<UserProfile> {
  const url = `${API_BASE_URL}/api/users/profile?email=${encodeURIComponent(email)}`

  let response: Response
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (cause) {
    // A CORS rejection or a backend that is not running both land here, and the
    // browser deliberately withholds the details, so name the likely cause.
    throw new Error(
      `Could not reach the profile API at ${API_BASE_URL}. Is sample-java-api running?`,
      { cause },
    )
  }

  if (!response.ok) {
    // The API sends a JSON error body, but a proxy or 500 may not.
    const detail = await response
      .json()
      .then((body: ApiError) => body.message)
      .catch(() => null)
    throw new Error(
      detail
        ? `getUserProfile failed (${response.status}): ${detail}`
        : `getUserProfile failed (${response.status})`,
    )
  }

  return (await response.json()) as UserProfile
}
