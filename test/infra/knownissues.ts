// Open defects in the software under test, each with a ticket.
//
// Unlike a mock limitation, a known issue skips on every target, real clusters
// included. The ticket is required and validated, the skip is counted on its
// own channel, and an id is typechecked, so a typo cannot become a silent
// skip. It records a diagnosed failure, never a way to quiet an undiagnosed
// one. Empty is the intended steady state.

import { Gate } from './capabilities'

/**
 * The one ticket value that is not a ticket: a defect understood but not yet
 * filed. A word rather than a blank, so the filing owed is one `git grep` away.
 */
export const UNTRACKED = 'UNTRACKED'

/**
 * A Jira key, any project. `JSCBC` for this SDK, `CXXCBC` for the core,
 * `CBD` and `MB` for the server.
 */
const TICKET_RE = /^[A-Z][A-Z0-9]+-\d+$/

export function isTicket(value: string): boolean {
  return value === UNTRACKED || TICKET_RE.test(value)
}

export interface KnownIssue {
  /** A real, filed key, or `UNTRACKED`. Validated by the selftest. */
  readonly ticket: string
  /** What is wrong, in the words the ticket uses. "Broken" is not an entry. */
  readonly note: string
}

/**
 * Every accepted defect, by id. Ids are kebab-case and name the symptom
 * (`mutatein-expiry-lost`), not the ticket, so a call site says whether to care.
 */
export const KNOWN_ISSUES = Object.freeze({
  'worker-terminate-cancel-after-env': {
    ticket: 'JSCBC-1527',
    note:
      'after a worker with operations in flight is terminated, the core ' +
      'cancels them on its IO thread and calls a thread-safe function ' +
      'whose environment is gone, aborting the process',
  },
}) satisfies Readonly<Record<string, KnownIssue>>

/** The ids a suite may cite; `never` while the registry is empty. */
export type KnownIssueId = keyof typeof KNOWN_ISSUES

const BY_ID: Readonly<Record<string, KnownIssue>> = KNOWN_ISSUES

/**
 * The first cited issue, or `ok`. Blind to the target, so a product defect
 * cannot be narrowed by deployment until it reads as a cluster property. A
 * defect seen only on some versions says so at the call site:
 * `test.skipIf(ctx.capabilities.version.major < 7 && ctx.known('...'))`.
 */
export function gateKnownIssues(ids: readonly KnownIssueId[]): Gate {
  return gateFrom(ids, BY_ID)
}

/**
 * A seam for the selftest, so the firing path is exercised while the real
 * registry is empty. Suites use `gateKnownIssues`, which typechecks ids.
 */
export function gateFrom(
  ids: readonly string[],
  registry: Readonly<Record<string, KnownIssue>>
): Gate {
  for (const id of ids) {
    const issue = registry[id]
    if (!issue) {
      continue
    }
    return {
      kind: 'known-issue',
      reason: `${issue.ticket} [${id}]: ${issue.note}`,
      fields: { issue: id, ticket: issue.ticket },
    }
  }
  return { kind: 'ok' }
}
