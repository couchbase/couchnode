import { expect } from 'vitest'

import { CouchbaseError } from '../../../lib/errors'
import { withCtx } from '../../asserts/ctx'
import { expectThrows } from '../../asserts/errors'
import { ServerFeature, TestProtocol } from '../../infra/capabilities'
import { defineSuite } from '../../infra/suite'

// A C++ exception that escapes an addon entry point surfaces as a JS error.
// The native side parses a string CAS as an unsigned 64-bit number, and a
// string that is not one makes the parse throw a standard exception rather
// than a Napi::Error. Before every entry point translated those, it aborted
// the process, so on the old code this file ends its own test process.

defineSuite(
  '#native exceptions',
  {
    features: [ServerFeature.KeyValue],
    // The parse belongs to the native addon; couchbase2 has none.
    protocols: [TestProtocol.Classic],
  },
  ({ test }) => {
    test('should reject a CAS string that is not a 64-bit number', async ({
      collection,
      env,
    }) => {
      const key = env.key()
      await collection.insert(key, { foo: 'bar' })
      env.registerCleanup(async () => {
        await collection.remove(key)
      })

      // Not a number, then one past the largest unsigned 64-bit value.
      for (const cas of ['not-a-cas', '18446744073709551616']) {
        const c = env.ctx({ op: 'replace', key, extra: `cas=${cas}` })
        const err = await expectThrows(
          () => collection.replace(key, { foo: 'baz' }, { cas }),
          Error,
          undefined,
          c
        )
        expect(
          err,
          withCtx('raised before any request is made', c)
        ).not.toBeInstanceOf(CouchbaseError)
      }

      const res = await collection.get(key)
      expect(
        res.content,
        withCtx('document unchanged', env.ctx({ op: 'get', key }))
      ).toEqual({ foo: 'bar' })
    })
  }
)
