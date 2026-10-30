import * as grpc from '@grpc/grpc-js'
import { describe, expect, it } from 'vitest'

import {
  Couchbase2Collections,
  createCollectionRequestToProto,
  scopeSpecsFromProto,
  updateCollectionRequestToProto,
} from '../../../../lib/couchbase2/collections'
import type { CollectionAdminServiceClient } from '../../../../lib/couchbase2/generated/couchbase/admin/collection/v1/CollectionAdminService'
import {
  Couchbase2Op,
  RequestContext,
} from '../../../../lib/couchbase2/requestcontext'
import {
  FeatureNotAvailableError,
  InvalidArgumentError,
} from '../../../../lib/errors'

// The scope and collection management requests and results, mapped without
// a gateway.

describe('#couchbase2 collections create request', () => {
  it('should leave out the settings that were not given', () => {
    expect(createCollectionRequestToProto('b', 's', 'c', {})).toEqual({
      bucket_name: 'b',
      scope_name: 's',
      collection_name: 'c',
    })
  })

  it.each([
    ["the bucket's", 0, undefined],
    ['never', -1, 0],
    ['an hour', 3600, 3600],
  ])('should send a maximum expiry of %s', (_name, maxExpiry, sent) => {
    const message = createCollectionRequestToProto('b', 's', 'c', {
      maxExpiry,
    })
    expect(message.max_expiry_secs).toBe(sent)
  })

  it('should send history', () => {
    const message = createCollectionRequestToProto('b', 's', 'c', {
      history: false,
    })
    expect(message.history_retention_enabled).toBe(false)
  })

  it.each([-2, 1.5, 2 ** 31])(
    'should refuse a maximum expiry of %s',
    (maxExpiry) => {
      expect(() =>
        createCollectionRequestToProto('b', 's', 'c', { maxExpiry })
      ).toThrow(InvalidArgumentError)
    }
  )
})

describe('#couchbase2 collections update request', () => {
  it('should leave out the settings that were not given', () => {
    expect(updateCollectionRequestToProto('b', 's', 'c', {})).toEqual({
      bucket_name: 'b',
      scope_name: 's',
      collection_name: 'c',
    })
  })

  it.each([
    ['never', -1, 0],
    ['an hour', 3600, 3600],
  ])('should send a maximum expiry of %s', (_name, maxExpiry, sent) => {
    const message = updateCollectionRequestToProto('b', 's', 'c', {
      maxExpiry,
    })
    expect(message.max_expiry_secs).toBe(sent)
  })

  it("should refuse the bucket's maximum expiry as not supported", () => {
    expect(() =>
      updateCollectionRequestToProto('b', 's', 'c', { maxExpiry: 0 })
    ).toThrow(FeatureNotAvailableError)
  })

  it('should refuse a maximum expiry below -1', () => {
    expect(() =>
      updateCollectionRequestToProto('b', 's', 'c', { maxExpiry: -2 })
    ).toThrow(InvalidArgumentError)
  })
})

describe('#couchbase2 collections listing', () => {
  it('should read each maximum expiry and history as the SDK spells them', () => {
    const scopes = scopeSpecsFromProto({
      scopes: [
        {
          name: 's',
          collections: [
            { name: 'inherits' },
            { name: 'never', max_expiry_secs: 0 },
            {
              name: 'hour',
              max_expiry_secs: 3600,
              history_retention_enabled: true,
            },
          ],
        },
        { name: 'empty', collections: [] },
      ],
      manifest_uid: '7',
    })
    expect(scopes.map((scope) => scope.name)).toEqual(['s', 'empty'])
    expect(scopes[0].collections).toEqual([
      { name: 'inherits', scopeName: 's', maxExpiry: 0, history: undefined },
      { name: 'never', scopeName: 's', maxExpiry: -1, history: undefined },
      { name: 'hour', scopeName: 's', maxExpiry: 3600, history: true },
    ])
    expect(scopes[1].collections).toEqual([])
  })
})

describe('#couchbase2 collections history', () => {
  const channel = {
    metadata: new grpc.Metadata(),
    context: (op: Couchbase2Op, timeoutMs: number) =>
      new RequestContext(op, timeoutMs),
  }

  function refusing(details: string): CollectionAdminServiceClient {
    const answer = (...args: unknown[]) => {
      const callback = args[args.length - 1] as grpc.requestCallback<unknown>
      callback(
        Object.assign(new Error(details), {
          code: grpc.status.INVALID_ARGUMENT,
          details,
          metadata: new grpc.Metadata(),
        }),
        undefined
      )
    }
    return {
      CreateCollection: answer,
      UpdateCollection: answer,
    } as unknown as CollectionAdminServiceClient
  }

  const req = { timeout: 2500, obs: null }

  it.each([
    [
      'createCollection',
      (c: Couchbase2Collections) =>
        c.createCollection('b', 's', 'c', { history: true }, req),
    ],
    [
      'updateCollection',
      (c: Couchbase2Collections) =>
        c.updateCollection('b', 's', 'c', { history: true }, req),
    ],
  ])(
    'should read history refused by the bucket as not available on %s',
    async (_name, run) => {
      const collections = new Couchbase2Collections(
        channel,
        refusing('history is not allowed on this type of bucket')
      )
      await expect(run(collections)).rejects.toBeInstanceOf(
        FeatureNotAvailableError
      )
    }
  )

  it('should leave any other invalid argument as it is', async () => {
    const collections = new Couchbase2Collections(
      channel,
      refusing('invalid collection name')
    )
    await expect(
      collections.createCollection('b', 's', '!', {}, req)
    ).rejects.toBeInstanceOf(InvalidArgumentError)
  })
})
