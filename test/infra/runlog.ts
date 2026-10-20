// Makes what the harness decided on its own visible to a human.
//
// The default reporter hides a passing file's console output, so a reason
// logged in a worker is unseen. Workers append to a run-scoped file instead,
// and globalSetup's teardown prints one grouped summary per channel:
//
// - **skip**: coverage this run was never going to take (tier, protocol, a
//   service the cluster does not run).
// - **provisioning**: coverage taken by a different route than asked for.
// - **limitation**: coverage the mock backend cannot provide. See
//   `infra/limitations.ts`.
// - **known issue**: coverage silenced everywhere by a ticketed defect in the
//   code under test. See `infra/knownissues.ts`.

import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

export type NoticeChannel =
  | 'skip'
  | 'provisioning'
  | 'limitation'
  | 'known-issue'

export interface RunNotice {
  readonly channel: NoticeChannel
  readonly suite: string
  /** The gate kind for a skip; the resource kind for a provisioning notice. */
  readonly kind: string
  readonly reason: string
}

export function createRunLog(runId: string): string {
  const dir = mkdtempSync(join(tmpdir(), `couchnode-test-${runId}-`))
  return join(dir, 'notices.jsonl')
}

export function recordNotice(
  path: string | undefined,
  notice: RunNotice
): void {
  if (!path) {
    return
  }
  try {
    appendFileSync(path, `${JSON.stringify(notice)}\n`)
  } catch {
    // Reporting a decision must never be the thing that fails a run.
  }
}

/** Records a test or suite that a mock backend's own defect made unrunnable. */
export function recordLimitation(
  path: string | undefined,
  notice: Omit<RunNotice, 'channel'>
): void {
  recordNotice(path, { channel: 'limitation', ...notice })
}

/** Records a test or suite silenced by an open defect in the code under test. */
export function recordKnownIssue(
  path: string | undefined,
  notice: Omit<RunNotice, 'channel'>
): void {
  recordNotice(path, { channel: 'known-issue', ...notice })
}

/**
 * Records that a suite got its resources by a route it did not ask for, such
 * as the pre-7.0 bucket standing in for a collection.
 */
export function recordProvisioning(
  path: string | undefined,
  notice: Omit<RunNotice, 'channel'>
): void {
  recordNotice(path, { channel: 'provisioning', ...notice })
}

export function readNotices(path: string): RunNotice[] {
  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as RunNotice)
  } catch {
    return []
  }
}

export function removeRunLog(path: string): void {
  try {
    rmSync(join(path, '..'), { recursive: true, force: true })
  } catch {
    // Best effort; it is a temp directory.
  }
}

/** Grouped by reason, because a whole run skipping for one reason is one line. */
export function summarizeNotices(notices: readonly RunNotice[]): string {
  const sections = [
    summarizeChannel(notices, 'skip', 'suite(s) skipped, by reason'),
    summarizeChannel(
      notices,
      'limitation',
      'test(s) and suite(s) lost to a mock backend defect'
    ),
    summarizeChannel(
      notices,
      'known-issue',
      'test(s) and suite(s) lost to an open defect in the code under test'
    ),
    summarizeChannel(
      notices,
      'provisioning',
      'suite(s) provisioned by a fallback route'
    ),
  ]
  return sections.filter((section) => section !== '').join('\n')
}

function summarizeChannel(
  notices: readonly RunNotice[],
  channel: NoticeChannel,
  heading: string
): string {
  const records = notices.filter((notice) => notice.channel === channel)
  if (records.length === 0) {
    return ''
  }

  const byReason = new Map<string, RunNotice[]>()
  for (const record of records) {
    const bucket = byReason.get(record.reason) ?? []
    bucket.push(record)
    byReason.set(record.reason, bucket)
  }

  const lines = [`[test] ${records.length} ${heading}:`]
  for (const [reason, bucket] of [...byReason.entries()].sort(
    (a, b) => b[1].length - a[1].length
  )) {
    lines.push(`  ${bucket.length} x [${bucket[0].kind}] ${reason}`)
    lines.push(`      ${bucket.map((r) => r.suite).join(', ')}`)
  }
  return lines.join('\n')
}
