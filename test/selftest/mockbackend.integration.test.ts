// The mock backend owns its child process. A `spawn` handle keeps the parent's
// event loop referenced until the child exits, so a child that outlives stop,
// or a failed start that leaves one running, hangs the run with no diagnostic.

import { execFileSync } from 'child_process'
import { writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

import { GoCavesBackend } from '../infra/mock/gocaves'

/** How many live processes have `pattern` on their command line. */
function processesMatching(pattern: string): number {
  try {
    const out = execFileSync('pgrep', ['-f', pattern], { encoding: 'utf8' })
    return out.trim() === '' ? 0 : out.trim().split('\n').length
  } catch {
    // pgrep exits 1 when nothing matched.
    return 0
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const posix = process.platform !== 'win32'

describe('the gocaves mock', () => {
  it('kills its process on stop, and the process is really gone', async () => {
    const backend = new GoCavesBackend()
    const connection = await backend.start()

    // A connection string it minted, with the ports it chose. Asserted rather
    // than assumed because the whole reason this backend allows parallel runs
    // is that nothing about it is fixed: the control port is OS-assigned and
    // the cluster id is a uuid, so two of these overlap without negotiating.
    expect(connection.connectionString).toMatch(
      /^couchbase:\/\/127\.0\.0\.1:\d+/
    )
    expect(connection.username).toBe('Administrator')

    const pid = backend.pid
    expect(pid).toBeTypeOf('number')
    expect(isAlive(pid as number)).toBe(true)

    await backend.stop()
    expect(isAlive(pid as number)).toBe(false)
  }, 60_000)

  it('reports the version the mock says it is, not a hardcoded one', async () => {
    // GoCAVES answers `/pools` with `implementationVersion`, so it is read
    // rather than declared, and version gating follows the real mock.
    const backend = new GoCavesBackend()
    try {
      await backend.start()
      const version = backend.version()
      expect(version.major).toBeGreaterThanOrEqual(7)
    } finally {
      await backend.stop()
    }
  }, 60_000)

  it('is safe to stop twice, and stopping a backend that never started', async () => {
    const backend = new GoCavesBackend()
    await backend.stop()
    await backend.start()
    await backend.stop()
    await backend.stop()
    expect(backend.pid).toBeUndefined()
  }, 60_000)

  it('gives two concurrent instances two isolated mocks', async () => {
    const first = new GoCavesBackend()
    const second = new GoCavesBackend()
    try {
      const [a, b] = await Promise.all([first.start(), second.start()])
      expect(a.connectionString).not.toBe(b.connectionString)
      expect(first.pid).not.toBe(second.pid)
      expect(isAlive(first.pid as number)).toBe(true)
      expect(isAlive(second.pid as number)).toBe(true)
    } finally {
      await Promise.all([first.stop(), second.stop()])
    }
  }, 60_000)

  it.skipIf(!posix)(
    'leaves nothing behind when the binary cannot be executed',
    async () => {
      // Not a binary this platform can run: `spawn` fails, which is a
      // different path from a child that starts and then dies.
      const marker = `gocaves-selftest-${process.pid}`
      const bogus = join(tmpdir(), marker)
      writeFileSync(bogus, 'not a binary', { mode: 0o755 })

      const backend = new GoCavesBackend({ binaryPath: bogus })
      await expect(backend.start()).rejects.toThrow(/gocaves failed to start/)

      expect(processesMatching(marker)).toBe(0)
      expect(backend.pid).toBeUndefined()
    },
    60_000
  )
})
