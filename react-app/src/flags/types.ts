/**
 * Core types for the feature flag system.
 *
 * Flag configuration is intentionally declarative (no predicate functions), so
 * the exact same shape can be authored locally or fetched as JSON from a remote
 * service. See `source.ts`.
 */

/** Values a flag is allowed to resolve to. */
export type FlagValue = boolean | string | number

export type Operator =
  | 'eq'
  | 'neq'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'matches'

/** A single attribute test against the evaluation context. */
export interface Condition {
  /** `userId`, or any key under `context.attributes`. Supports dots: `org.plan`. */
  attribute: string
  operator: Operator
  value: unknown
}

/** Targeting rule. All conditions must pass (AND). First matching rule wins. */
export interface Rule<V extends FlagValue = FlagValue> {
  description?: string
  all: Condition[]
  value: V
}

/** Sticky percentage rollout. */
export interface Rollout<V extends FlagValue = FlagValue> {
  /** 0-100. Buckets are deterministic, so the enrolled set only grows. */
  percentage: number
  value: V
  /** Attribute to bucket on. Defaults to `userId`. */
  bucketBy?: string
}

export type FlagKind = 'boolean' | 'variant' | 'number'

export interface FlagDefinition<V extends FlagValue = FlagValue> {
  description: string
  defaultValue: V
  /** Drives which control the dev panel renders. */
  kind: FlagKind
  /** Required for `variant` flags; also used to validate overrides. */
  variants?: readonly V[]
  rules?: Rule<V>[]
  rollout?: Rollout<V>
}

export type FlagRegistry = Record<string, FlagDefinition>

/** Maps a registry to the value type each of its flags resolves to. */
export type FlagValues<R extends FlagRegistry> = {
  [K in keyof R]: R[K] extends FlagDefinition<infer V> ? V : never
}

export interface EvaluationContext {
  /** Default bucketing key for percentage rollouts. */
  userId?: string
  attributes?: Record<string, unknown>
}

/**
 * Why a flag resolved the way it did, in precedence order.
 *
 * `override` - forced locally (dev panel or `?ff_*` URL param)
 * `remote`   - supplied by the configured `FlagSource`
 * `rule`     - a targeting rule matched
 * `rollout`  - the context fell inside the rollout bucket
 * `default`  - nothing else applied
 */
export type EvaluationReason =
  | 'override'
  | 'remote'
  | 'rule'
  | 'rollout'
  | 'default'

export interface Evaluation<V extends FlagValue = FlagValue> {
  key: string
  value: V
  reason: EvaluationReason
  /** Set when `reason === 'rule'`. */
  ruleIndex?: number
  /** The 0-99 bucket, whenever a rollout was considered. */
  bucket?: number
}
