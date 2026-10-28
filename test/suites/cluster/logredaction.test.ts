import { expect } from 'vitest'

import binding from '../../../lib/binding'
import { withCtx } from '../../asserts/ctx'
import { ServerFeature } from '../../infra/capabilities'
import { CollectionStrategy } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'

// A file of its own because the redaction state is process wide and cannot
// be turned off once on, so it would leak into any test sharing the worker. One test for the same reason: it reads the state before and after,
// and a second test could not rely on the order.

defineSuite(
  '#logRedaction',
  {
    collection: CollectionStrategy.DefaultCollection,
    features: [ServerFeature.KeyValue],
  },
  ({ test }) => {
    test('enables redaction when connecting with logRedaction', async ({
      env,
    }) => {
      await env.openCluster()
      expect(
        binding.isLogRedactionEnabled(),
        withCtx('redaction after a connection without logRedaction')
      ).toBe(false)

      await env.openCluster({}, { logRedaction: true })
      expect(
        binding.isLogRedactionEnabled(),
        withCtx('redaction after a connection with logRedaction')
      ).toBe(true)
    })
  }
)
