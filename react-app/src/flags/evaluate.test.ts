import { describe, expect, it } from 'vitest'
import { booleanFlag, numberFlag, variantFlag } from './define'
import { evaluateFlag, hashToBucket, readAttribute } from './evaluate'
import type { EvaluationContext } from './types'

describe('hashToBucket', () => {
  it('is deterministic', () => {
    expect(hashToBucket('newCheckout:user-1')).toBe(
      hashToBucket('newCheckout:user-1'),
    )
  })

  it('stays within 0-99', () => {
    for (let i = 0; i < 500; i++) {
      const bucket = hashToBucket(`flag:user-${i}`)
      expect(bucket).toBeGreaterThanOrEqual(0)
      expect(bucket).toBeLessThan(100)
    }
  })

  it('spreads roughly evenly', () => {
    let enrolled = 0
    const total = 5000
    for (let i = 0; i < total; i++) {
      if (hashToBucket(`flag:user-${i}`) < 50) enrolled++
    }
    // 50% rollout over 5k keys should land close to half.
    expect(enrolled / total).toBeGreaterThan(0.45)
    expect(enrolled / total).toBeLessThan(0.55)
  })

  it('buckets differently per flag for the same user', () => {
    const a = hashToBucket('flagA:user-1')
    const b = hashToBucket('flagB:user-1')
    expect(a).not.toBe(b)
  })
})

describe('readAttribute', () => {
  const context: EvaluationContext = {
    userId: 'u1',
    attributes: { device: 'mobile', org: { id: 'acme', plan: 'pro' } },
  }

  it('reads userId off the root', () => {
    expect(readAttribute(context, 'userId')).toBe('u1')
  })

  it('reads a flat attribute', () => {
    expect(readAttribute(context, 'device')).toBe('mobile')
  })

  it('reads a dotted path', () => {
    expect(readAttribute(context, 'org.plan')).toBe('pro')
  })

  it('returns undefined for a missing path without throwing', () => {
    expect(readAttribute(context, 'org.billing.id')).toBeUndefined()
    expect(readAttribute({}, 'device')).toBeUndefined()
  })
})

describe('evaluateFlag precedence', () => {
  const flag = booleanFlag({
    description: 'test',
    defaultValue: false,
    rules: [
      {
        all: [{ attribute: 'email', operator: 'matches', value: '@acme\\.com$' }],
        value: true,
      },
    ],
    rollout: { percentage: 100, value: true },
  })

  const staff: EvaluationContext = {
    userId: 'u1',
    attributes: { email: 'dev@acme.com' },
  }

  it('prefers an override over everything', () => {
    const result = evaluateFlag('f', flag, staff, {
      overrides: { f: false },
      remote: { f: true },
    })
    expect(result).toMatchObject({ value: false, reason: 'override' })
  })

  it('prefers remote over rules', () => {
    const result = evaluateFlag('f', flag, staff, { remote: { f: false } })
    expect(result).toMatchObject({ value: false, reason: 'remote' })
  })

  it('applies a matching rule before the rollout', () => {
    const result = evaluateFlag('f', flag, staff)
    expect(result).toMatchObject({ value: true, reason: 'rule', ruleIndex: 0 })
  })

  it('falls through to the rollout when no rule matches', () => {
    const result = evaluateFlag('f', flag, {
      userId: 'u2',
      attributes: { email: 'someone@other.com' },
    })
    expect(result.reason).toBe('rollout')
    expect(result.value).toBe(true)
  })

  it('ignores overrides of the wrong type', () => {
    const result = evaluateFlag('f', flag, { userId: 'u3' }, {
      overrides: { f: 'yes' },
    })
    expect(result.reason).not.toBe('override')
  })

  it('reports the bucket even when the rollout does not apply', () => {
    const narrow = booleanFlag({
      description: 'test',
      defaultValue: false,
      rollout: { percentage: 0, value: true },
    })
    const result = evaluateFlag('f', narrow, { userId: 'u1' })
    expect(result).toMatchObject({ value: false, reason: 'default' })
    expect(result.bucket).toBeTypeOf('number')
  })

  it('stays on the default when there is no bucketing key', () => {
    const rollout = booleanFlag({
      description: 'test',
      defaultValue: false,
      rollout: { percentage: 100, value: true },
    })
    const result = evaluateFlag('f', rollout, {})
    expect(result).toMatchObject({ value: false, reason: 'default' })
    expect(result.bucket).toBeUndefined()
  })

  it('takes the first matching rule when several match', () => {
    const multi = booleanFlag({
      description: 'test',
      defaultValue: false,
      rules: [
        { all: [{ attribute: 'plan', operator: 'eq', value: 'pro' }], value: true },
        { all: [{ attribute: 'plan', operator: 'eq', value: 'pro' }], value: false },
      ],
    })
    const result = evaluateFlag('f', multi, { attributes: { plan: 'pro' } })
    expect(result).toMatchObject({ value: true, ruleIndex: 0 })
  })

  it('ignores a rule with no conditions', () => {
    const empty = booleanFlag({
      description: 'test',
      defaultValue: false,
      rules: [{ all: [], value: true }],
    })
    expect(evaluateFlag('f', empty, {}).reason).toBe('default')
  })
})

describe('operators', () => {
  const run = (operator: string, expected: unknown, actual: unknown) =>
    evaluateFlag(
      'f',
      booleanFlag({
        description: 'test',
        defaultValue: false,
        rules: [
          {
            all: [
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              { attribute: 'x', operator: operator as any, value: expected },
            ],
            value: true,
          },
        ],
      }),
      { attributes: { x: actual } },
    ).value

  it('handles equality', () => {
    expect(run('eq', 'a', 'a')).toBe(true)
    expect(run('neq', 'a', 'b')).toBe(true)
  })

  it('handles set membership', () => {
    expect(run('in', ['a', 'b'], 'b')).toBe(true)
    expect(run('notIn', ['a', 'b'], 'c')).toBe(true)
    expect(run('in', 'not-an-array', 'a')).toBe(false)
  })

  it('handles contains for strings and arrays', () => {
    expect(run('contains', 'ell', 'hello')).toBe(true)
    expect(run('contains', 'b', ['a', 'b'])).toBe(true)
  })

  it('handles numeric comparison and rejects non-numbers', () => {
    expect(run('gt', 5, 6)).toBe(true)
    expect(run('gte', 5, 5)).toBe(true)
    expect(run('lt', 5, 4)).toBe(true)
    expect(run('lte', 5, 5)).toBe(true)
    expect(run('gt', 5, '6')).toBe(false)
  })

  it('handles regex and survives an invalid pattern', () => {
    expect(run('matches', '^a.c$', 'abc')).toBe(true)
    expect(run('matches', '([', 'abc')).toBe(false)
  })
})

describe('variant and number flags', () => {
  const layout = variantFlag({
    description: 'test',
    variants: ['classic', 'compact'],
    defaultValue: 'classic',
  })

  it('accepts a known variant as an override', () => {
    const result = evaluateFlag('f', layout, {}, {
      overrides: { f: 'compact' },
    })
    expect(result).toMatchObject({ value: 'compact', reason: 'override' })
  })

  it('rejects an unknown variant', () => {
    const result = evaluateFlag('f', layout, {}, { overrides: { f: 'wild' } })
    expect(result).toMatchObject({ value: 'classic', reason: 'default' })
  })

  it('rejects a non-finite number override', () => {
    const limit = numberFlag({ description: 'test', defaultValue: 25 })
    const result = evaluateFlag('f', limit, {}, {
      overrides: { f: Number.NaN },
    })
    expect(result).toMatchObject({ value: 25, reason: 'default' })
  })
})
