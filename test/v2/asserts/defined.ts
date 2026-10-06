// Presence assertions that narrow.
//
// `expect(x).toBeDefined()` does not narrow `x`, so the next line has to cast
// it. An assertion function carries the check into the type.

import { expect } from 'vitest'

export function expectDefined<T>(
  value: T | undefined,
  message: string
): asserts value is T {
  expect(value, message).toBeDefined()
}
