// A `fileParallelism: false` project's files overlap nothing: not each other,
// and not the other projects' files either.
//
// The `exclusive` project depends on this: the server serializes bucket
// create, update and delete across the cluster, and an exclusive file running
// beside integration files shows up as an intermittent bucket management `503`
// that reads like an SDK bug. It is observed Vitest behavior, not a documented
// contract, so this test turns an upgrade that changes it into a failure here.
//
// It runs a cluster free fixture whose files each hold a slot for a known time,
// with the parallel project capped like `integration`, so the timeline also
// shows the cap holds.

import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeAll, describe, expect, it } from 'vitest'

import { packageBin } from '../infra/nodebin'

const V2_ROOT = join(import.meta.dirname, '..')
const FIXTURE = join(V2_ROOT, 'selftest', 'fixtures', 'scheduling')

interface Slot {
  readonly label: string
  readonly project: string
  readonly start: number
  readonly end: number
}

function overlaps(a: Slot, b: Slot): boolean {
  return a.start < b.end && b.start < a.end
}

function runFixture(): Slot[] {
  const dir = mkdtempSync(join(tmpdir(), 'cnsched-'))
  const log = join(dir, 'timeline.log')
  try {
    execFileSync(
      process.execPath,
      [
        packageBin('vitest'),
        'run',
        '--config',
        join(FIXTURE, 'vitest.config.mts'),
      ],
      {
        cwd: join(V2_ROOT, '..', '..'),
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, CNSCHEDLOG: log },
      }
    )
    return parse(readFileSync(log, 'utf8'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function parse(text: string): Slot[] {
  const starts = new Map<string, number>()
  const slots: Slot[] = []
  for (const line of text.trim().split('\n')) {
    const [label, event, stamp] = line.split(' ')
    if (event === 'start') {
      starts.set(label, Number(stamp))
    } else {
      const start = starts.get(label)
      if (start === undefined) {
        throw new Error(`'${label}' ended without starting`)
      }
      slots.push({
        label,
        project: label.split('/')[0],
        start,
        end: Number(stamp),
      })
    }
  }
  return slots
}

describe('sequential projects do not overlap anything', () => {
  let slots: Slot[]

  beforeAll(() => {
    slots = runFixture()
  }, 120_000)

  it('ran every fixture file', () => {
    // Without this the two assertions below pass vacuously on an empty
    // timeline, which is what a fixture that failed to run would produce.
    expect(slots.map((s) => s.label).sort()).toEqual([
      'parallel/f1',
      'parallel/f2',
      'parallel/f3',
      'sequential/f1',
      'sequential/f2',
      'sequential/f3',
    ])
  })

  it('overlapped the parallel files, which is the control', () => {
    // If nothing overlapped at all, the machine is running one file at a time
    // for some unrelated reason and the real assertion below would pass without
    // meaning anything.
    const parallel = slots.filter((s) => s.project === 'parallel')
    const anyOverlap = parallel.some((a) =>
      parallel.some((b) => a !== b && overlaps(a, b))
    )
    expect(anyOverlap).toBe(true)
  })

  it('never ran more parallel files at once than the cap', () => {
    // Three files under a cap of two, so an uncapped run would show three.
    const parallel = slots.filter((s) => s.project === 'parallel')
    const peak = Math.max(
      ...parallel.map(
        (a) =>
          parallel.filter((b) => b.start <= a.start && a.start < b.end).length
      )
    )
    expect(peak).toBe(2)
  })

  it('never ran a sequential file while anything else was running', () => {
    const sequential = slots.filter((s) => s.project === 'sequential')
    const collisions = sequential.flatMap((a) =>
      slots
        .filter((b) => b !== a && overlaps(a, b))
        .map((b) => `${a.label} overlapped ${b.label}`)
    )
    expect(collisions).toEqual([])
  })
})
