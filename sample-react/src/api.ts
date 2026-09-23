/**
 * Shared client for sample-java-api.
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

/** Error body the API returns for a 4xx or 5xx. */
interface ApiErrorBody {
  status: number
  error: string
  message: string
}

/**
 * Thrown for any failed API call.
 *
 * Carries the HTTP status so callers can react to the kind of failure - the
 * sign-in flow logs a 4xx as a warning and a 5xx as an error, mirroring how the
 * API logs it on its own side. `status` is null when there was no response at
 * all, which is a failure to reach the API rather than a rejection by it.
 */
export class ApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Request timeout, so a stalled backend cannot hang the UI. */
const REQUEST_TIMEOUT_MS = 5000

/**
 * Performs the call and unwraps failures into `ApiError`.
 *
 * `label` is the API operation name, so the message reads
 * "getUserProfile failed (500): …" rather than naming a URL.
 */
async function request<T>(
  path: string,
  label: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...init?.headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (cause) {
    // A CORS rejection or a backend that is not running both land here, and the
    // browser deliberately withholds the details, so name the likely cause.
    throw new ApiError(
      `Could not reach the API at ${API_BASE_URL}. Is sample-java-api running?`,
      null,
      { cause },
    )
  }

  if (!response.ok) {
    // The API sends a JSON error body, but a proxy or 500 may not.
    const detail = await response
      .json()
      .then((body: ApiErrorBody) => body.message)
      .catch(() => null)
    throw new ApiError(
      detail
        ? `${label} failed (${response.status}): ${detail}`
        : `${label} failed (${response.status})`,
      response.status,
    )
  }

  return (await response.json()) as T
}

export function getJson<T>(path: string, label: string): Promise<T> {
  return request<T>(path, label)
}

export function postJson<T>(
  path: string,
  label: string,
  body: unknown,
): Promise<T> {
  return request<T>(path, label, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
