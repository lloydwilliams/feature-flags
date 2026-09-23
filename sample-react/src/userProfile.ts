import { getJson } from './api'

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

/**
 * Calls `getUserProfile` for the given email and site.
 *
 * `site` does not change the profile that comes back; it is sent so the API can
 * put it in its server-side flag evaluation context, matching the `site`
 * attribute this app already sends to the browser provider. Without it, a rule
 * targeting on site - which `show-new-feature` does - cannot match on the
 * backend.
 *
 * Rejects with an `ApiError` on a non-2xx response, a timeout, or a network
 * failure - callers are expected to surface it rather than retry.
 */
export function fetchUserProfile(
  email: string,
  site: string,
): Promise<UserProfile> {
  const query = `?email=${encodeURIComponent(email)}&site=${encodeURIComponent(site)}`
  return getJson<UserProfile>(
    `/api/users/profile${query}`,
    'getUserProfile',
  )
}
