import { expect } from 'vitest'

import { KeyValueErrorContext } from '../../../lib/errorcontexts'
import { DocumentNotFoundError } from '../../../lib/errors'
import { expectCouchbaseError } from '../../asserts/errors'
import { ServerFeature } from '../../infra/capabilities'
import { CollectionStrategy } from '../../infra/requirements'
import { defineSuite } from '../../infra/suite'

// The named-collection half needs no feature gate of its own:
// `gateProvisioning` skips it on a backend without collections.
defineSuite(
  '#errors',
  { features: [ServerFeature.KeyValue], collection: CollectionStrategy.Both },
  ({ test }) => {
    test('should should return a context with crud operations', async ({
      collection,
      env,
    }) => {
      const key = 'some-missing-key'
      const ctx = env.ctx({ op: 'get', key, collection: collection.name })

      const err = await expectCouchbaseError(
        () => collection.get(key),
        DocumentNotFoundError,
        ctx
      )
      expect(err.context, 'error context type').toBeInstanceOf(
        KeyValueErrorContext
      )
    })
  }
)
