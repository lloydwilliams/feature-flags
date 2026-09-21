import type { FlagDefinition, FlagValue, Rollout, Rule } from './types'

/**
 * Builders for flag definitions.
 *
 * These exist for typing reasons: writing `{ defaultValue: false }` inline would
 * infer the literal type `false`, so `useFlag(...)` would be typed `false`
 * instead of `boolean`. Going through a builder widens booleans and numbers
 * while keeping variant unions narrow.
 */

interface BooleanFlagInput {
  description: string
  defaultValue: boolean
  rules?: Rule<boolean>[]
  rollout?: Rollout<boolean>
}

export function booleanFlag(input: BooleanFlagInput): FlagDefinition<boolean> {
  return { ...input, kind: 'boolean', variants: [true, false] }
}

interface VariantFlagInput<V extends string> {
  description: string
  variants: readonly V[]
  defaultValue: V
  rules?: Rule<V>[]
  rollout?: Rollout<V>
}

export function variantFlag<const V extends string>(
  input: VariantFlagInput<V>,
): FlagDefinition<V> {
  return { ...input, kind: 'variant' }
}

interface NumberFlagInput {
  description: string
  defaultValue: number
  rules?: Rule<number>[]
  rollout?: Rollout<number>
}

export function numberFlag(input: NumberFlagInput): FlagDefinition<number> {
  return { ...input, kind: 'number' }
}

/** True when `value` is a legal value for `definition`. */
export function isValidValue(
  definition: FlagDefinition,
  value: unknown,
): value is FlagValue {
  switch (definition.kind) {
    case 'boolean':
      return typeof value === 'boolean'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'variant':
      return (
        typeof value === 'string' &&
        (definition.variants?.includes(value) ?? false)
      )
  }
}
