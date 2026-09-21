import type { EvaluationContext } from './flags'

const USER_ID_KEY = 'ff:demo-user-id'

/**
 * A stable per-browser id so percentage rollouts are sticky across reloads.
 * A real app would use its own authenticated user id here.
 */
function stableUserId(): string {
  try {
    const existing = localStorage.getItem(USER_ID_KEY)
    if (existing) return existing
    const generated = crypto.randomUUID()
    localStorage.setItem(USER_ID_KEY, generated)
    return generated
  } catch {
    return 'anonymous'
  }
}

/**
 * Built once at module scope on purpose: the provider treats `context` as a
 * dependency, so a new object every render would refetch the flag source in a
 * loop. Real apps should `useMemo` it (or rebuild it only on sign-in).
 */
export const demoContext: EvaluationContext = {
  userId: stableUserId(),
  attributes: {
    email: 'you@localhost',
    device: matchMedia('(max-width: 640px)').matches ? 'mobile' : 'desktop',
    org: { id: 'demo-co', plan: 'free' },
  },
}
