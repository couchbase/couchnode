// Why a test did not run, in a form a report can read back.
//
// Vitest's own JUnit reporter writes a bare `<skipped/>`, which cannot tell a
// cluster lacking search from a broken gate. So every gate that skips renders
// one line in a fixed grammar,
//
//     SKIP[feature-missing] feature=xattr required=5.0.0 observed=4.6.0 server=real note="..."
//
// carried on the test's `meta` (inherited from a `describe`) to
// `reporters/junit.ts`, which writes it as `<skipped message>`. The category
// is the gate's `kind`, the same one the run log counts by.

import type { Gate } from './capabilities'

declare module 'vitest' {
  interface TaskMeta {
    /** The rendered skip line, set on every test a gate skipped. */
    skipReason?: string
  }
}

/** A gate that skips. `ok` runs and `env-degraded` fails, so neither has one. */
export type SkipGate = Exclude<Gate, { kind: 'ok' } | { kind: 'env-degraded' }>

/**
 * One value in the `key=value` grammar: bare unless it holds whitespace or a
 * quote, quoted and escaped otherwise.
 */
export function renderValue(value: string): string {
  if (value === '') {
    return '""'
  }
  if (/[\s"]/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return value
}

export function skipMessage(gate: SkipGate): string {
  const parts = [`SKIP[${gate.kind}]`]
  for (const [key, value] of Object.entries(gate.fields ?? {})) {
    parts.push(`${key}=${renderValue(value)}`)
  }
  // Newlines folded: the line ends up in an XML attribute and a table cell.
  parts.push(`note=${renderValue(gate.reason.replace(/\s*\n\s*/g, ' '))}`)
  return parts.join(' ')
}

export function skipOptions(gate: SkipGate): { meta: { skipReason: string } } {
  return { meta: { skipReason: skipMessage(gate) } }
}

export function isSkipGate(value: unknown): value is SkipGate {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { kind?: unknown }).kind === 'string' &&
    typeof (value as { reason?: unknown }).reason === 'string'
  )
}

/**
 * A test declaration's arguments with the skip reason merged into its options.
 * `(name, fn, timeout)` and `(name, options, fn)` both come out as the second
 * form, the only one that carries `meta`.
 */
function withReason(args: unknown[], gate: SkipGate): unknown[] {
  const [name, second, third] = args
  const { meta } = skipOptions(gate)
  if (typeof second === 'function') {
    const timeout = typeof third === 'number' ? { timeout: third } : {}
    return [name, { ...timeout, meta }, second]
  }
  if (typeof second === 'object' && second !== null) {
    const options = second as { meta?: object }
    return [name, { ...options, meta: { ...options.meta, ...meta } }, third]
  }
  return [name, { meta }]
}

/** The part of Vitest's `test` that `withSkipReasons` touches. */
interface Skippable {
  skipIf(condition: unknown): unknown
  readonly skip: (...args: never[]) => unknown
}

/**
 * A `test` whose `skipIf` keeps the gate's reason.
 *
 * The suite predicates (`lacking`, `having`, `limited`, `known`, `belowTier`,
 * `notOn`) return the gate that fired, so `test.skipIf(lacking(X))` carries
 * its reason. A plain `true` skips with no reason. Only the plain call form
 * gains the reason: `test.skipIf(gate).each(...)` skips without one.
 */
export function withSkipReasons<T extends Skippable>(base: T): T {
  return new Proxy(base, {
    get(target, property, receiver) {
      if (property !== 'skipIf') {
        return Reflect.get(target, property, receiver)
      }
      return (condition: unknown) => {
        if (!isSkipGate(condition)) {
          return target.skipIf(condition)
        }
        return new Proxy(target.skip, {
          apply(skip, thisArg, args: unknown[]) {
            return Reflect.apply(skip, thisArg, withReason(args, condition))
          },
        })
      }
    },
  })
}
