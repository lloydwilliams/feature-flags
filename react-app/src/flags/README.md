# Feature flags

A dependency-free, typed feature flag system: declarative targeting rules,
sticky percentage rollouts, local overrides, and a dev panel.

## Usage

Wrap the app once, with a **stable** context object:

```tsx
import { FeatureFlagProvider } from './flags'

// Module scope (or useMemo). The provider treats `context` as a dependency by
// identity, so a fresh object every render refetches the source in a loop.
const context = { userId: user.id, attributes: { email: user.email } }

<FeatureFlagProvider context={context}>
  <App />
</FeatureFlagProvider>
```

Read flags. Types come from the registry, so keys autocomplete and values are
narrowed:

```tsx
const enabled = useFlag('newCheckout')      // boolean
const layout = useFlag('checkoutLayout')    // 'classic' | 'compact' | 'minimal'
const limit = useFlag('searchResultLimit')  // number
```

Or gate markup declaratively:

```tsx
<Feature flag="betaBanner">
  <Banner />
</Feature>

<Feature flag="checkoutLayout" equals="minimal" fallback={<Classic />}>
  <Minimal />
</Feature>
```

Need to know *why* a flag resolved the way it did:

```tsx
const { value, reason, bucket } = useFlagEvaluation('newCheckout')
// reason: 'override' | 'remote' | 'rule' | 'rollout' | 'default'
```

## Adding a flag

Add one entry to `flags.ts`. Nothing else needs touching — the hooks become
aware of it and the dev panel picks the right control from `kind`.

```ts
export const flags = {
  myFlag: booleanFlag({
    description: 'Shown in the dev panel.',
    defaultValue: false,
    rules: [
      {
        description: 'Staff only',
        all: [{ attribute: 'email', operator: 'matches', value: '@example\\.com$' }],
        value: true,
      },
    ],
    rollout: { percentage: 25, value: true },
  }),
}
```

Builders: `booleanFlag`, `variantFlag` (multivariate string), `numberFlag`.
They exist for typing — an inline `defaultValue: false` would infer the literal
type `false`, making `useFlag` return `false` instead of `boolean`.

## Precedence

Highest to lowest. First thing that applies wins:

| # | Reason     | Source                                                    |
|---|------------|-----------------------------------------------------------|
| 1 | `override` | `?ff_<key>=<value>` URL param, then the dev panel         |
| 2 | `remote`   | the configured `FlagSource`                                |
| 3 | `rule`     | first matching targeting rule (conditions AND together)   |
| 4 | `rollout`  | context falls inside the percentage bucket                 |
| 5 | `default`  | `defaultValue`                                             |

Values of the wrong type are ignored at every layer, so a stale override or a
bad server payload cannot put a flag into an illegal state.

## Targeting

Conditions read `userId` or any dotted path under `attributes`:

```ts
{ attribute: 'org.plan', operator: 'in', value: ['pro', 'enterprise'] }
```

Operators: `eq`, `neq`, `in`, `notIn`, `contains`, `gt`, `gte`, `lt`, `lte`,
`matches` (regex). Type mismatches and invalid regexes evaluate to no-match
rather than throwing.

## Rollouts are sticky

Buckets come from `FNV-1a(flagKey + ':' + bucketKey) % 100`, so a given user
lands in the same bucket forever. Raising a percentage only adds users; it never
reshuffles the ones already enrolled. Because the flag key is part of the seed,
two flags at 50% don't hit the same half of your users.

Bucketing needs a key. With no `userId` (or no `bucketBy` attribute) the flag
stays on its default instead of flipping on each reload.

## Overrides

- **Dev panel** — bottom-right, dev builds only. Persists to `localStorage`
  under `ff:overrides` and syncs across tabs.
- **URL** — `?ff_newCheckout=true&ff_searchResultLimit=50`. Outranks the panel
  and is deliberately *not* persisted, so a shared debug link stops applying
  once you navigate away. The panel shows these as locked.
- **Reset** — `?ff_reset=1`, or "Reset all" in the panel.

## Remote config

```tsx
import { createHttpSource } from './flags'

const source = createHttpSource('/api/flags')  // module scope: stable identity
<FeatureFlagProvider context={context} source={source}>
```

The source POSTs the evaluation context and expects `{ "flagKey": value }`.
Failures are non-fatal: the error is logged, `sourceStatus` becomes `'error'`,
and evaluation falls back to local rules and defaults. Use
`createStaticSource(values)` in tests.

## Testing

`evaluate.ts` is pure and has no React dependency, so precedence, operators, and
bucket distribution are covered directly in `evaluate.test.ts` (`npm test`).

For component tests, drive the provider explicitly instead of touching storage:

```tsx
<FeatureFlagProvider
  context={{ userId: 'test' }}
  initialOverrides={{ newCheckout: true }}
  persist={false}
>
```
