// The skip line grammar, which a report parses back out of the JUnit file.

import { describe, expect, it } from 'vitest'

import { isSkipGate, renderValue, skipMessage } from '../infra/skips'

describe('renderValue', () => {
  it('leaves a plain token bare', () => {
    expect(renderValue('xattr')).toBe('xattr')
    expect(renderValue('7.0.0')).toBe('7.0.0')
  })

  it('quotes a value with whitespace', () => {
    expect(renderValue('two words')).toBe('"two words"')
  })

  it('escapes quotes and backslashes inside a quoted value', () => {
    expect(renderValue('say "hi" \\ bye')).toBe('"say \\"hi\\" \\\\ bye"')
  })

  it('renders an empty value as an empty pair of quotes', () => {
    expect(renderValue('')).toBe('""')
  })
})

describe('skipMessage', () => {
  it('renders category, fields in order, then the note', () => {
    expect(
      skipMessage({
        kind: 'feature-missing',
        reason: "Feature 'xattr' requires Couchbase Server >= 5.0.0.",
        fields: { feature: 'xattr', required: '5.0.0', observed: '4.6.0' },
      })
    ).toBe(
      'SKIP[feature-missing] feature=xattr required=5.0.0 observed=4.6.0 ' +
        `note="Feature 'xattr' requires Couchbase Server >= 5.0.0."`
    )
  })

  it('renders a gate with no fields as category and note', () => {
    expect(skipMessage({ kind: 'no-cluster', reason: 'none' })).toBe(
      'SKIP[no-cluster] note=none'
    )
  })

  it('folds a multi-line reason onto one line', () => {
    expect(
      skipMessage({ kind: 'tier-excluded', reason: 'first\n   second' })
    ).toBe('SKIP[tier-excluded] note="first second"')
  })
})

describe('isSkipGate', () => {
  it('accepts a gate and nothing a bare skipIf condition would be', () => {
    expect(isSkipGate({ kind: 'known-issue', reason: 'r' })).toBe(true)
    expect(isSkipGate(true)).toBe(false)
    expect(isSkipGate(false)).toBe(false)
    expect(isSkipGate(undefined)).toBe(false)
    expect(isSkipGate({ kind: 'known-issue' })).toBe(false)
  })
})
