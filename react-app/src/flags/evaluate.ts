import { isValidValue } from './define'
import type {
  Condition,
  Evaluation,
  EvaluationContext,
  FlagDefinition,
  FlagRegistry,
  FlagValue,
} from './types'

/**
 * Deterministic 0-99 bucket from a seed string (FNV-1a, 32-bit).
 *
 * The same seed always yields the same bucket, in this process and the next, so
 * raising a rollout percentage only ever adds users - it never reshuffles the
 * ones already enrolled.
 */
export function hashToBucket(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 100
}

/** Reads a possibly dotted attribute path out of the evaluation context. */
export function readAttribute(
  context: EvaluationContext,
  path: string,
): unknown {
  if (path === 'userId') return context.userId

  let current: unknown = context.attributes
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function compare(
  actual: unknown,
  operator: Condition['operator'],
  expected: unknown,
): boolean {
  switch (operator) {
    case 'eq':
      return actual === expected
    case 'neq':
      return actual !== expected
    case 'in':
      return Array.isArray(expected) && expected.includes(actual)
    case 'notIn':
      return Array.isArray(expected) && !expected.includes(actual)
    case 'contains':
      if (Array.isArray(actual)) return actual.includes(expected)
      return (
        typeof actual === 'string' &&
        typeof expected === 'string' &&
        actual.includes(expected)
      )
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (typeof actual !== 'number' || typeof expected !== 'number') {
        return false
      }
      if (operator === 'gt') return actual > expected
      if (operator === 'gte') return actual >= expected
      if (operator === 'lt') return actual < expected
      return actual <= expected
    }
    case 'matches':
      if (typeof actual !== 'string' || typeof expected !== 'string') {
        return false
      }
      try {
        return new RegExp(expected).test(actual)
      } catch {
        // An invalid pattern should not take the app down; treat as no match.
        return false
      }
  }
}

export function matchesCondition(
  context: EvaluationContext,
  condition: Condition,
): boolean {
  return compare(
    readAttribute(context, condition.attribute),
    condition.operator,
    condition.value,
  )
}

export interface EvaluateOptions {
  /** Forced values, highest precedence. Invalid values are ignored. */
  overrides?: Record<string, FlagValue>
  /** Values from a `FlagSource`. Invalid values are ignored. */
  remote?: Record<string, FlagValue>
}

/**
 * Resolves one flag. Precedence: override > remote > rules > rollout > default.
 */
export function evaluateFlag(
  key: string,
  definition: FlagDefinition,
  context: EvaluationContext,
  options: EvaluateOptions = {},
): Evaluation {
  const override = options.overrides?.[key]
  if (override !== undefined && isValidValue(definition, override)) {
    return { key, value: override, reason: 'override' }
  }

  const remote = options.remote?.[key]
  if (remote !== undefined && isValidValue(definition, remote)) {
    return { key, value: remote, reason: 'remote' }
  }

  const rules = definition.rules ?? []
  for (let index = 0; index < rules.length; index++) {
    const rule = rules[index]
    if (
      rule.all.length > 0 &&
      rule.all.every((condition) => matchesCondition(context, condition))
    ) {
      return { key, value: rule.value, reason: 'rule', ruleIndex: index }
    }
  }

  const { rollout } = definition
  if (rollout) {
    const bucketBy = rollout.bucketBy ?? 'userId'
    const raw = readAttribute(context, bucketBy)
    // No bucketing key means we cannot be sticky, so stay on the default
    // rather than flipping the user on every reload.
    if (raw !== undefined && raw !== null) {
      const bucket = hashToBucket(`${key}:${String(raw)}`)
      if (bucket < rollout.percentage) {
        return { key, value: rollout.value, reason: 'rollout', bucket }
      }
      return { key, value: definition.defaultValue, reason: 'default', bucket }
    }
  }

  return { key, value: definition.defaultValue, reason: 'default' }
}

/** Resolves every flag in a registry. */
export function evaluateAll<R extends FlagRegistry>(
  registry: R,
  context: EvaluationContext,
  options: EvaluateOptions = {},
): Record<keyof R, Evaluation> {
  const result = {} as Record<keyof R, Evaluation>
  for (const key of Object.keys(registry) as (keyof R & string)[]) {
    result[key] = evaluateFlag(key, registry[key], context, options)
  }
  return result
}
