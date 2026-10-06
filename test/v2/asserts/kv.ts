// KV result assertions.
//
// Every helper takes an `AssertCtx` and every failure message carries it, so a
// failure names the collection strategy, key and operation that produced it.

import { expect } from 'vitest'

import { GetResult, MutationResult } from '../../../lib/crudoptypes'
import { Cas } from '../../../lib/utilities'
import { AssertCtx, withCtx } from './ctx'

export function assertMutationResult(
  res: MutationResult,
  c: AssertCtx = {}
): void {
  expect(res, withCtx('mutation returned no result', c)).toBeDefined()
  expect(res.cas, withCtx('mutation returned no cas', c)).toBeTruthy()
}

export function assertDocEquals<T>(
  res: GetResult,
  expected: T,
  c: AssertCtx = {}
): void {
  expect(res, withCtx('get returned no result', c)).toBeDefined()
  expect(res.cas, withCtx('get returned no cas', c)).toBeTruthy()
  expect(res.content, withCtx('document content', c)).toEqual(expected)
}

/** Compares string forms, because `Cas` is an opaque object. */
export function assertCasChanged(
  before: Cas,
  after: Cas,
  c: AssertCtx = {}
): void {
  expect(String(after), withCtx('cas did not change', c)).not.toEqual(
    String(before)
  )
}

export function assertCasUnchanged(
  before: Cas,
  after: Cas,
  c: AssertCtx = {}
): void {
  expect(String(after), withCtx('cas changed unexpectedly', c)).toEqual(
    String(before)
  )
}
