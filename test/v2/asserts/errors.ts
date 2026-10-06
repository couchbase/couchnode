// Error assertions that keep the error's context.
//
// Checking only a class and a message throws away `err.context`, the part that
// says which key, which status code and which endpoint. These helpers report
// the context on mismatch and *return* the typed error on success, so a test
// can go on to assert on the context itself.

import { expect } from 'vitest'

import { CouchbaseError } from '../../../lib/errors'
import { AssertCtx, withCtx } from './ctx'
import { formatErrorContext } from './serializer'

export type ErrorClass<E> = abstract new (...args: never[]) => E

function describeThrown(err: unknown): string {
  if (err instanceof Error) {
    const rendered = formatErrorContext(err)
    return (
      `${err.constructor.name}: ${err.message}` +
      (rendered ? `\n  ${rendered}` : '')
    )
  }
  return `a non-Error value: ${JSON.stringify(err)}`
}

/**
 * Like `expectCouchbaseError`, for failures that are a plain `Error` (such as
 * transcoder encode failures raised before any request is made). A string
 * `message` must be contained in the error's message, a RegExp must match it.
 */
export async function expectThrows<E extends Error>(
  fn: () => Promise<unknown>,
  expected: ErrorClass<E>,
  message?: string | RegExp,
  c: AssertCtx = {}
): Promise<E> {
  let thrown: unknown
  let threw = false
  try {
    await fn()
  } catch (err) {
    threw = true
    thrown = err
  }

  if (!threw) {
    expect.unreachable(
      withCtx(`Expected ${expected.name} but the operation succeeded`, c)
    )
  }

  if (!(thrown instanceof expected)) {
    expect.unreachable(
      withCtx(`Expected ${expected.name} but got ${describeThrown(thrown)}`, c)
    )
  }

  const err = thrown as E
  if (typeof message === 'string') {
    expect(
      err.message,
      withCtx(`${expected.name} message should contain '${message}'`, c)
    ).toContain(message)
  } else if (message !== undefined) {
    expect(
      err.message,
      withCtx(`${expected.name} message should match ${message}`, c)
    ).toMatch(message)
  }
  return err
}

/**
 * Asserts `fn` rejects with `expected` and returns the typed error. A mismatch
 * reports the thrown error's full context.
 */
export async function expectCouchbaseError<E extends CouchbaseError>(
  fn: () => Promise<unknown>,
  expected: ErrorClass<E>,
  c: AssertCtx = {}
): Promise<E> {
  let thrown: unknown
  let threw = false
  try {
    await fn()
  } catch (err) {
    threw = true
    thrown = err
  }

  if (!threw) {
    expect.unreachable(
      withCtx(`Expected ${expected.name} but the operation succeeded`, c)
    )
  }

  if (!(thrown instanceof expected)) {
    expect.unreachable(
      withCtx(`Expected ${expected.name} but got ${describeThrown(thrown)}`, c)
    )
  }

  return thrown as E
}

/**
 * Checks only the named context fields, because most of a context is
 * environment-dependent.
 */
export function expectErrorContext(
  err: CouchbaseError,
  expected: Readonly<Record<string, unknown>>,
  c: AssertCtx = {}
): void {
  // Every member of the context union is a class instance, so `object` holds
  // all of them without a cast, and `Reflect.get` reads a named field off any.
  const context: object | undefined = err.context
  expect(
    context,
    withCtx(`${err.constructor.name} carries no context`, c)
  ).toBeDefined()

  for (const [key, value] of Object.entries(expected)) {
    expect(
      context === undefined ? undefined : Reflect.get(context, key),
      withCtx(
        `${err.constructor.name}.context.${key}` +
          `\n  ${formatErrorContext(err) ?? '<no context>'}`,
        c
      )
    ).toEqual(value)
  }
}
