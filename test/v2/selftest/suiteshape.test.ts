// The static check, run over the tree and over deliberately bad inputs.
//
// A test rather than a lint script, so it cannot be left out of CI.

import { join } from 'path'
import { describe, expect, it } from 'vitest'

import { checkSource, checkTree, formatViolations } from '../tools/checksuites'

const V2_ROOT = join(import.meta.dirname, '..')

describe('the test tree obeys its own rules', () => {
  it('has no mixed blocks, no connects in test bodies, no opaque contexts', () => {
    const violations = checkTree(
      [join(V2_ROOT, 'suites'), join(V2_ROOT, 'selftest')],
      V2_ROOT
    )
    expect(formatViolations(violations)).toBe('')
  })

  it('has no flush anywhere under test/v2, infrastructure included', () => {
    // Wider than the block rules on purpose: infrastructure offering a flush
    // is the likeliest way for the habit to come back.
    const violations = checkTree(
      [
        join(V2_ROOT, 'suites'),
        join(V2_ROOT, 'selftest'),
        join(V2_ROOT, 'infra'),
        join(V2_ROOT, 'tools'),
      ],
      V2_ROOT
    ).filter((v) => v.rule === 'flush-in-suite')
    expect(formatViolations(violations)).toBe('')
  })
})

describe('mixed kinds', () => {
  it('rejects a block holding a cluster test and a cluster-free one', () => {
    const violations = checkSource(
      'bad.test.ts',
      `describe('mixed', () => {
         test('needs a server', async ({ collection }) => {})
         test('needs nothing', () => {})
       })`
    )
    expect(violations.map((v) => v.rule)).toEqual(['mixed-kinds'])
    expect(violations[0].message).toContain("'needs a server'")
    expect(violations[0].message).toContain("'needs nothing'")
  })

  it('accepts a block of each kind on its own', () => {
    expect(
      checkSource(
        'ok.test.ts',
        `describe('integration', () => {
           test('a', async ({ collection }) => {})
           test('b', async ({ env }) => {})
         })
         describe('unit', () => {
           test('c', () => {})
           test('d', () => {})
         })`
      )
    ).toEqual([])
  })

  it('accepts a cluster-free block nested inside a cluster one', () => {
    // Nesting is fine; being siblings is not. A unit describe inside an
    // integration file still needs no server.
    expect(
      checkSource(
        'ok.test.ts',
        `describe('outer', () => {
           test('a', async ({ collection }) => {})
           describe('inner', () => {
             test('pure', () => {})
           })
         })`
      )
    ).toEqual([])
  })

  it('reads a suite declared through defineSuite the same way', () => {
    const violations = checkSource(
      'bad.test.ts',
      `defineSuite('kv', { features: [] }, ({ test }) => {
         test('needs a server', async ({ collection }) => {})
         test('needs nothing', () => {})
       })`
    )
    expect(violations.map((v) => v.rule)).toEqual(['mixed-kinds'])
  })
})

describe('connections', () => {
  it('rejects connecting from a test body', () => {
    const violations = checkSource(
      'bad.test.ts',
      `describe('leaky', () => {
         test('connects', async () => {
           const cluster = await couchbase.connect('couchbase://localhost')
           await cluster.close()
         })
       })`
    )
    expect(violations.map((v) => v.rule)).toContain('connect-in-test')
  })

  it('rejects connecting from a hook', () => {
    const violations = checkSource(
      'bad.test.ts',
      `describe('leaky', () => {
         beforeAll(async () => {
           await Cluster.connect('couchbase://localhost')
         })
       })`
    )
    expect(violations.map((v) => v.rule)).toEqual(['connect-in-test'])
  })

  it('accepts env.openCluster, which the env closes', () => {
    expect(
      checkSource(
        'ok.test.ts',
        `describe('fine', () => {
           test('extra connection', async ({ env }) => {
             const extra = await env.openCluster()
           })
         })`
      )
    ).toEqual([])
  })
})

describe('fixture declarations', () => {
  it('rejects a test that takes its whole context as one parameter', () => {
    const violations = checkSource(
      'bad.test.ts',
      `describe('opaque', () => {
         test('does something', async (ctx) => {
           await ctx.collection.upsert('k', {})
         })
       })`
    )
    expect(violations.map((v) => v.rule)).toEqual(['opaque-fixtures'])
  })
})

describe('no flushing', () => {
  it('rejects a flush wherever in the file it is', () => {
    const violations = checkSource(
      'bad.test.ts',
      `describe('rangescan', () => {
         beforeAll(async () => {
           await bmgr.flushBucket(H.bucketName)
         })
         test('scans', async ({ collection }) => {})
       })`
    )
    expect(violations.map((v) => v.rule)).toEqual(['flush-in-suite'])
    expect(violations[0].message).toContain('CollectionStrategy.Named')
  })

  it('finds one hidden in a helper below the suite', () => {
    // The reason this rule is not walked per block: a helper at the bottom of
    // the file is outside every describe, and the block walk never reaches it.
    const violations = checkSource(
      'bad.test.ts',
      `describe('s', () => {
         test('a', async ({ collection }) => { await clean() })
       })
       async function clean() {
         await manager.flushBucket('default')
       }`
    )
    expect(violations.map((v) => v.rule)).toEqual(['flush-in-suite'])
  })

  it('lets a file that owns its buckets flush one', () => {
    // `*.exclusive.test.ts` means the file creates buckets, so a flush there
    // reaches a bucket nothing else reads. The three tests whose subject is
    // `flushBucket` cannot be written without calling it.
    expect(
      checkSource(
        'suites/mgmt/bucketmanager.exclusive.test.ts',
        `describe('bucketmanager', () => {
           test('flushes', async ({ cluster }) => {
             await cluster.buckets().flushBucket(mine)
           })
         })`
      )
    ).toEqual([])
  })

  it('still rejects the same call in a file that owns no buckets', () => {
    // The exception is the filename and nothing else, so the rule keeps its
    // reach over every ordinary suite.
    const violations = checkSource(
      'suites/kv/crud.test.ts',
      `describe('crud', () => {
         test('flushes', async ({ cluster }) => {
           await cluster.buckets().flushBucket('default')
         })
       })`
    )
    expect(violations.map((v) => v.rule)).toEqual(['flush-in-suite'])
  })

  it('leaves a suite testing flushBucket itself alone until it calls it', () => {
    // A suite whose subject *is* the operation has to be able to name it. The
    // rule fires on a call, so asserting on the method does not trip it.
    expect(
      checkSource(
        'ok.test.ts',
        `describe('bucketmanager', () => {
           test('exposes flush', async ({ cluster }) => {
             expect(cluster.buckets().flushBucket).toBeTypeOf('function')
           })
         })`
      )
    ).toEqual([])
  })
})
