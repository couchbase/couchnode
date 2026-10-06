// A deliberately failing suite, run as a child process by
// `selftest/serializerwiring.integration.test.ts` and excluded from the normal
// run. It asserts nothing about the error: the serializer's job is the errors
// nobody wrote an assertion for.

import { ServerFeature } from '../../infra/capabilities'
import { defineSuite } from '../../infra/suite'

defineSuite(
  'escaping error',
  { features: [ServerFeature.KeyValue] },
  ({ test }) => {
    test('lets a CouchbaseError escape', async ({ collection, env }) => {
      await collection.get(env.key())
    })
  }
)
