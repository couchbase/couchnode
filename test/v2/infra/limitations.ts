// Defects in a mock backend that no `ServerFeature` can name, such as "subdoc
// works, except that `mutateIn` rejects an expiry". Each entry has a stable id,
// a note detailed enough to file upstream as it stands, and the mock version it
// was observed against (`selftest/limitations.test.ts` fails when the pinned
// version moves, forcing a re-check). Each use records a notice, so the run
// summary lists every id with the suites it silenced.
//
// Never a way to quiet a failing test: the evidence for an entry is that the
// same test passes against a real cluster.

import {
  ClusterCapabilities,
  Gate,
  MockBackendKind,
  isClassic,
} from './capabilities'

/**
 * A copy rather than an import of `mock/gocaves.ts`'s constant, which would
 * pull `child_process`, `net` and `fs` into every worker. The selftest fails if
 * the two diverge.
 */
export const MEASURED_AGAINST = 'v0.0.1-74'

export interface MockLimitation {
  /** The backends this defect belongs to. Never `none`; see `gateLimitations`. */
  readonly backends: readonly MockBackendKind[]
  /** Which operation, what was asked, what came back: a bug report as is. */
  readonly note: string
  readonly observedIn: string
}

/** Every known sub-feature defect, by id. Ids lead with the backend. */
export const MOCK_LIMITATIONS = Object.freeze({
  'gocaves-mutatein-expiry': Object.freeze({
    backends: Object.freeze(['gocaves'] as const),
    note:
      'a `mutateIn` carrying an expiry is rejected outright: the subdocument ' +
      'response is `invalid_argument` (status 4) before any path is evaluated. ' +
      'The same call with no expiry succeeds, and the same call with an expiry ' +
      'succeeds against a real 7.6 cluster, so it is the expiry field the mock ' +
      'refuses rather than anything about the specs.',
    observedIn: MEASURED_AGAINST,
  }),
  'gocaves-subdoc-mutation-macros': Object.freeze({
    backends: Object.freeze(['gocaves'] as const),
    note:
      'no mutate-in macro is recognized. `${Mutation.seqno}` and the four ' +
      'array macro forms (append, prepend, insert, addUnique) all come back as ' +
      '`xattr_unknown_macro` (124), including the paths whose expected result ' +
      'is an `InvalidArgumentError` raised by the SDK, so the negative tests ' +
      'fail here too.',
    observedIn: MEASURED_AGAINST,
  }),
  'gocaves-scope-error-classification': Object.freeze({
    backends: Object.freeze(['gocaves'] as const),
    note:
      'a missing scope or collection cannot be recognized by the client, ' +
      'because the mock reports it in a body that is not JSON: ' +
      '`{"errors":{"_":"Scope with name "s" is not found"}` interpolates the ' +
      'name without escaping the quotes around it and leaves the object a ' +
      'brace short. The core cannot parse that, so a DELETE returns ' +
      '`unsupported_operation` (12) and the create path returns ' +
      '`invalid_argument` where `ScopeNotFound` and `CollectionNotFound` are ' +
      'expected. This is the defect that also reaches cleanup code, which is ' +
      'why `limits()` exists as well as the gates.',
    observedIn: MEASURED_AGAINST,
  }),
}) satisfies Readonly<Record<string, MockLimitation>>

export type LimitationId = keyof typeof MOCK_LIMITATIONS

/**
 * Reads the backend and nothing else. A real cluster has backend `none`, which
 * no entry can name, so a wrong entry can only lose coverage on a mock, never
 * hide a defect from a real cluster run.
 */
export function gateLimitations(
  caps: ClusterCapabilities,
  ids: readonly LimitationId[]
): Gate {
  if (!isClassic(caps)) {
    return { kind: 'ok' }
  }
  for (const id of ids) {
    const limitation = MOCK_LIMITATIONS[id] as MockLimitation | undefined
    if (!limitation || !limitation.backends.includes(caps.backend)) {
      continue
    }
    return {
      kind: 'mock-limitation',
      reason: `${caps.backend} ${limitation.observedIn} [${id}]: ${limitation.note}`,
      fields: {
        limitation: id,
        mock: caps.backend,
        version: limitation.observedIn,
      },
    }
  }
  return { kind: 'ok' }
}

/**
 * For cleanup code, which no skip reaches: a teardown tolerating "already
 * gone" has to recognize the server's error, which
 * `gocaves-scope-error-classification` breaks. Not for widening what a test
 * accepts; skip the test instead.
 */
export function limits(caps: ClusterCapabilities, id: LimitationId): boolean {
  if (!isClassic(caps)) {
    return false
  }
  const limitation = MOCK_LIMITATIONS[id] as MockLimitation | undefined
  return limitation?.backends.includes(caps.backend) ?? false
}
