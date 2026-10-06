// Row-set assertions for the streaming APIs: query, analytics, search, views.

import { expect } from 'vitest'

import { AssertCtx, withCtx } from './ctx'

export function assertRowCount(
  rows: readonly unknown[],
  expected: number,
  c: AssertCtx = {}
): void {
  expect(
    rows.length,
    withCtx(`expected ${expected} row(s), got ${rows.length}`, c)
  ).toEqual(expected)
}

export function assertRowsAtLeast(
  rows: readonly unknown[],
  minimum: number,
  c: AssertCtx = {}
): void {
  expect(
    rows.length,
    withCtx(`expected at least ${minimum} row(s), got ${rows.length}`, c)
  ).toBeGreaterThanOrEqual(minimum)
}
