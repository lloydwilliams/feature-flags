import { booleanFlag, numberFlag, variantFlag } from './define'
import type { FlagValues } from './types'

/**
 * The flag registry - the single source of truth for this app.
 *
 * Adding a key here is all that is needed: `useFlag` becomes aware of it, its
 * value type is inferred, and the dev panel picks up the right control.
 */
export const flags = {
  newCheckout: booleanFlag({
    description: 'Rewritten checkout flow, ramping to 50% of signed-in users.',
    defaultValue: false,
    rules: [
      {
        description: 'Internal staff always get the new flow',
        all: [{ attribute: 'email', operator: 'matches', value: '@example\\.com$' }],
        value: true,
      },
      {
        description: 'Never enable for the legacy enterprise tenant',
        all: [{ attribute: 'org.id', operator: 'eq', value: 'legacy-co' }],
        value: false,
      },
    ],
    rollout: { percentage: 50, value: true },
  }),

  checkoutLayout: variantFlag({
    description: 'A/B/C test of checkout density.',
    variants: ['classic', 'compact', 'minimal'],
    defaultValue: 'classic',
    rules: [
      {
        description: 'Mobile defaults to the compact layout',
        all: [{ attribute: 'device', operator: 'eq', value: 'mobile' }],
        value: 'compact',
      },
    ],
  }),

  betaBanner: booleanFlag({
    description: 'Shows the beta announcement banner.',
    defaultValue: true,
  }),

  searchResultLimit: numberFlag({
    description: 'How many search results to request per page.',
    defaultValue: 25,
    rules: [
      {
        description: 'Pro plans get a larger page size',
        all: [{ attribute: 'org.plan', operator: 'in', value: ['pro', 'enterprise'] }],
        value: 100,
      },
    ],
  }),
} as const

export type AppFlags = typeof flags
export type FlagKey = keyof AppFlags
export type AppFlagValues = FlagValues<AppFlags>

export const flagKeys = Object.keys(flags) as FlagKey[]
