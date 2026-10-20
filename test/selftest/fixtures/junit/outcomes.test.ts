// Every outcome `reporters/junit.ts` renders, one test each. Run only by
// `selftest/junit.test.ts`; several of these fail on purpose.

import { beforeAll, describe, expect, it, test } from 'vitest'

import { SkipGate, skipOptions, withSkipReasons } from '../../../infra/skips'

const MISSING: SkipGate = {
  kind: 'feature-missing',
  reason: "Feature 'xattr' requires Couchbase Server >= 5.0.0.",
  fields: { feature: 'xattr', required: '5.0.0' },
}

const KNOWN: SkipGate = {
  kind: 'known-issue',
  reason: 'JSCBC-0000 [fixture]: a block skipped as a whole.',
  fields: { issue: 'fixture', ticket: 'JSCBC-0000' },
}

const gated = withSkipReasons(test)

describe('#gated', () => {
  gated.skipIf(MISSING)('declared with a gate', () => {})
  gated.skipIf(MISSING)('declared with a gate and a timeout', () => {}, 1000)
  gated.skipIf(MISSING)(
    'declared with a gate and options',
    { timeout: 1000 },
    () => {}
  )
  gated.skipIf(true)('declared with a bare true', () => {})
  gated.skipIf(false)('not skipped by false', () => {})
})

describe.skip('#skipped block', skipOptions(KNOWN), () => {
  describe('#nested', () => {
    it('inherits the block reason', () => {})
  })
  describe.skip('#gated inside', skipOptions(MISSING), () => {
    it('is still a skip', () => {})
  })
})

it('skips at runtime', ({ skip }) => {
  skip('decided while running')
})

it.todo('is not written yet')

it('fails', () => {
  expect(1).toBe(2)
})

it.fails('fails as expected', () => {
  throw new Error('expected')
})

let attempts = 0
it('passes on its second attempt', { retry: 2 }, () => {
  attempts++
  if (attempts < 2) {
    throw new Error('first attempt')
  }
})

it('escapes <markup> & "quotes" in a title', () => {})

describe('#hook', () => {
  beforeAll(() => {
    throw new Error('the hook failed')
  })
  it('never runs', () => {})
})
