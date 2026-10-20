// Once per test file, inside the worker.
//
// Three jobs: install the segfault handler, install the error serializer so
// every escaped `CouchbaseError` reports its context, and assert on the way out
// that the file did not leak a handle.
//
// A leaked handle keeps a process alive after its work is done: a hang with no
// diagnostic rather than a failure. Forcing an exit is not the fix, since it
// would mask exactly these leaks. The gate names the surviving handle kinds;
// `CNHANDLES=1` adds a creation stack per handle (see `dumpHandles`).

import { createRequire } from 'module'
import { afterAll, beforeAll } from 'vitest'

import { installErrorSerializer } from './asserts/serializer'

try {
  // Optional: a native addon that may not have built for this Node version.
  // `createRequire` because this file is ESM, where a bare `require` would
  // throw into the catch and the handler would silently never install.
  const requireCjs = createRequire(import.meta.url)
  const SegfaultHandler = requireCjs('segfault-handler') as {
    registerHandler: () => void
  }
  SegfaultHandler.registerHandler()
} catch {
  // Nothing to do: a missing segfault handler costs a nicer crash report.
}

installErrorSerializer()

/**
 * Handle kinds the runner itself creates and destroys constantly. Growth in
 * these says nothing about a suite; growth in anything else (a socket, a
 * server, a child process, a worker) is a leak.
 */
const NOISY_RESOURCES = new Set([
  'Immediate',
  'Timeout',
  'FSReqCallback',
  'FSEventWrap',
  'ThreadPoolWork',
  'TickObject',
  'ZlibStream',
])

/** How long to let in-flight teardown settle before counting handles. */
const SETTLE_MS = 250

type ResourceCounts = Map<string, number>

function activeResources(): ResourceCounts {
  const counts: ResourceCounts = new Map()
  for (const kind of process.getActiveResourcesInfo()) {
    if (!NOISY_RESOURCES.has(kind)) {
      counts.set(kind, (counts.get(kind) ?? 0) + 1)
    }
  }
  return counts
}

let baseline: ResourceCounts = new Map()

beforeAll(() => {
  baseline = activeResources()
})

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))

  const after = activeResources()
  const leaked: string[] = []
  for (const [kind, count] of after) {
    const before = baseline.get(kind) ?? 0
    if (count > before) {
      leaked.push(`${kind}: ${before} -> ${count}`)
    }
  }

  if (leaked.length > 0) {
    dumpHandles()
    throw new Error(
      'This file leaked event-loop handles, which is what makes a run hang ' +
        'instead of exiting. Every connection and child process must be owned ' +
        `by a fixture, not closed at the end of a test body. Leaked: ${leaked.join(
          ', '
        )}` +
        (process.env.CNHANDLES
          ? ''
          : ' Re-run with CNHANDLES=1 for a stack per surviving handle.')
    )
  }
})

/**
 * With `CNHANDLES` set, print a creation stack for every handle still holding
 * the loop open. Off by default because `why-is-node-running` patches
 * `async_hooks` for every test, leaking or not. Optional: the gate never
 * depends on it.
 */
function dumpHandles(): void {
  if (!process.env.CNHANDLES) {
    return
  }
  try {
    const requireCjs = createRequire(import.meta.url)
    const why = requireCjs('why-is-node-running') as () => void
    why()
  } catch {
    console.log(
      '[test] CNHANDLES is set but why-is-node-running did not load; ' +
        'the handle kinds above are all the diagnosis there is.'
    )
  }
}
