import * as grpc from '@grpc/grpc-js'
import { describe, expect, it } from 'vitest'

import type { _couchbase_admin_query_v1_GetAllIndexesResponse_Index__Output as ListedIndexPb } from '../../../../lib/couchbase2/generated/couchbase/admin/query/v1/GetAllIndexesResponse'
import type { QueryAdminServiceClient } from '../../../../lib/couchbase2/generated/couchbase/admin/query/v1/QueryAdminService'
import {
  Couchbase2QueryIndexes,
  escapeIndexKey,
  keyspaceToProto,
  queryIndexFromProto,
} from '../../../../lib/couchbase2/queryindexes'
import {
  Couchbase2Op,
  RequestContext,
} from '../../../../lib/couchbase2/requestcontext'
import { loadSchema } from '../../../../lib/couchbase2/schema'
import { STATUS_DETAILS_KEY } from '../../../../lib/couchbase2/statusdetails'
import {
  CouchbaseError,
  IndexNotFoundError,
  InternalServerFailureError,
} from '../../../../lib/errors'
import { NoOpMeter } from '../../../../lib/observability'
import { ObservableRequestHandler } from '../../../../lib/observabilityhandler'
import {
  ObservabilityInstruments,
  QueryIndexMgmtOp,
  SpanStatusCode,
} from '../../../../lib/observabilitytypes'
import { RequestSpan, RequestTracer } from '../../../../lib/tracing'

// The query index management requests and results, mapped without a
// gateway.

const rpc = loadSchema().google.rpc

const LISTED: ListedIndexPb = {
  bucket_name: 'b',
  scope_name: 's',
  collection_name: 'c',
  name: 'ix',
  is_primary: false,
  type: 'INDEX_TYPE_GSI',
  state: 'INDEX_STATE_ONLINE',
  fields: ['`a`', '`b`'],
  condition: '(`a` > 1)',
}

describe('#couchbase2 query index keys', () => {
  it.each([
    ['a plain key', 'name', '`name`'],
    ['a dotted path', 'address.city', '`address.city`'],
    ['a key with spaces', 'two words', '`two words`'],
    ['a backtick', 'a`b', '`a\\`b`'],
    ['a backslash', 'a\\b', '`a\\\\b`'],
    ['an escaped identifier', '`name`', '`name`'],
    ['an identifier with a doubled backtick', '`a``b`', '`a``b`'],
    ['an identifier with an escaped backtick', '`a\\`b`', '`a\\`b`'],
  ])('should send %s as one identifier', (_name, key, sent) => {
    expect(escapeIndexKey(key)).toBe(sent)
  })

  it.each([
    ['closes early', '`a`,`b`', '`\\`a\\`,\\`b\\``'],
    ['escapes its closing backtick', '`a\\`', '`\\`a\\\\\\``'],
  ])('should escape a quoted key that %s', (_name, key, sent) => {
    expect(escapeIndexKey(key)).toBe(sent)
  })
})

describe('#couchbase2 query index keyspace', () => {
  it('should leave out a scope and collection that were not given', () => {
    expect(keyspaceToProto({ bucketName: 'b' })).toEqual({ bucket_name: 'b' })
  })

  it('should leave out an empty scope and collection', () => {
    expect(
      keyspaceToProto({ bucketName: 'b', scopeName: '', collectionName: '' })
    ).toEqual({ bucket_name: 'b' })
  })

  it('should send a collection', () => {
    expect(
      keyspaceToProto({ bucketName: 'b', scopeName: 's', collectionName: 'c' })
    ).toEqual({ bucket_name: 'b', scope_name: 's', collection_name: 'c' })
  })
})

describe('#couchbase2 query index listing', () => {
  it('should read each field as a classic connection spells it', () => {
    expect(queryIndexFromProto(LISTED)).toMatchObject({
      name: 'ix',
      isPrimary: false,
      type: 'gsi',
      state: 'online',
      indexKey: ['`a`', '`b`'],
      condition: '(`a` > 1)',
      partition: undefined,
      bucketName: 'b',
      scopeName: 's',
      collectionName: 'c',
    })
  })

  it('should read an index on the bucket itself', () => {
    const index = queryIndexFromProto({
      ...LISTED,
      scope_name: '',
      collection_name: '',
      condition: undefined,
    })
    expect(index.scopeName).toBeUndefined()
    expect(index.collectionName).toBeUndefined()
    expect(index.condition).toBeUndefined()
  })

  it.each([
    ['INDEX_STATE_DEFERRED', 'deferred'],
    ['INDEX_STATE_BUILDING', 'building'],
    ['INDEX_STATE_PENDING', 'pending'],
    ['INDEX_STATE_OFFLINE', 'offline'],
    ['INDEX_STATE_ABRIDGED', 'abridged'],
    ['INDEX_STATE_SCHEDULED', 'scheduled'],
  ] as const)('should read %s as %s', (wire, state) => {
    expect(queryIndexFromProto({ ...LISTED, state: wire }).state).toBe(state)
  })
})

describe('#couchbase2 query indexes client', () => {
  const channel = {
    metadata: new grpc.Metadata(),
    context: (op: Couchbase2Op, timeoutMs: number) =>
      new RequestContext(op, timeoutMs),
  }
  const req = { timeout: 2500, obs: null }
  const keyspace = { bucketName: 'b', scopeName: 's', collectionName: 'c' }

  type Answer = [grpc.ServiceError | null, unknown?]

  // A client whose every call takes the next answer, and which records what
  // each call was sent.
  function answering(...answers: Answer[]): {
    client: QueryAdminServiceClient
    sent: unknown[]
  } {
    const sent: unknown[] = []
    const answer = (...args: unknown[]) => {
      sent.push(args[0])
      const callback = args[args.length - 1] as grpc.requestCallback<unknown>
      const [err, resp] = answers.shift() ?? [null, {}]
      callback(err, resp)
    }
    const client = {
      CreateIndex: answer,
      CreatePrimaryIndex: answer,
      DropIndex: answer,
      DropPrimaryIndex: answer,
      GetAllIndexes: answer,
      BuildDeferredIndexes: answer,
      WaitForIndexOnline: answer,
    } as unknown as QueryAdminServiceClient
    return { client, sent }
  }

  function failed(
    code: grpc.status,
    detail: { violation?: string; resourceType?: string }
  ): grpc.ServiceError {
    const details = []
    if (detail.violation) {
      details.push({
        type_url: 'type.googleapis.com/google.rpc.PreconditionFailure',
        value: rpc.PreconditionFailure.serialize({
          violations: [{ type: detail.violation }],
        }),
      })
    }
    if (detail.resourceType) {
      details.push({
        type_url: 'type.googleapis.com/google.rpc.ResourceInfo',
        value: rpc.ResourceInfo.serialize({
          resource_type: detail.resourceType,
          resource_name: 'ix',
        }),
      })
    }
    const metadata = new grpc.Metadata()
    metadata.set(
      STATUS_DETAILS_KEY,
      rpc.Status.serialize({ code, message: grpc.status[code], details })
    )
    return Object.assign(new Error(grpc.status[code]), {
      code,
      details: grpc.status[code],
      metadata,
    })
  }

  const notBuilding = (): grpc.ServiceError =>
    failed(grpc.status.FAILED_PRECONDITION, { violation: 'NOT_BUILDING' })

  it('should send each key escaped, with the settings that were given', async () => {
    const { client, sent } = answering()
    const indexes = new Couchbase2QueryIndexes(channel, client)
    await indexes.createIndex(
      keyspace,
      'ix',
      ['a', 'b`c'],
      { ignoreIfExists: true, deferred: true },
      req
    )
    expect(sent).toEqual([
      {
        bucket_name: 'b',
        scope_name: 's',
        collection_name: 'c',
        name: 'ix',
        fields: ['`a`', '`b\\`c`'],
        ignore_if_exists: true,
        deferred: true,
      },
    ])
  })

  it('should leave out the name of a primary index created without one', async () => {
    const { client, sent } = answering()
    const indexes = new Couchbase2QueryIndexes(channel, client)
    await indexes.createPrimaryIndex(
      { bucketName: 'b' },
      undefined,
      { ignoreIfExists: false, numReplicas: 1 },
      req
    )
    expect(sent).toEqual([
      { bucket_name: 'b', ignore_if_exists: false, num_replicas: 1 },
    ])
  })

  it('should drop a named primary index as a primary index', async () => {
    const { client, sent } = answering()
    const indexes = new Couchbase2QueryIndexes(channel, client)
    await indexes.dropPrimaryIndex(keyspace, 'p', true, req)
    expect(sent).toEqual([
      {
        bucket_name: 'b',
        scope_name: 's',
        collection_name: 'c',
        name: 'p',
        ignore_if_missing: true,
      },
    ])
  })

  it('should return the name of each index the build starts', async () => {
    const { client } = answering([
      null,
      {
        indexes: [
          { bucket_name: 'b', name: 'x' },
          { bucket_name: 'b', name: 'y' },
        ],
      },
    ])
    const indexes = new Couchbase2QueryIndexes(channel, client)
    await expect(indexes.buildDeferredIndexes(keyspace, req)).resolves.toEqual([
      'x',
      'y',
    ])
  })

  it('should list the indexes', async () => {
    const { client } = answering([null, { indexes: [LISTED] }])
    const indexes = new Couchbase2QueryIndexes(channel, client)
    const listed = await indexes.getAllIndexes(keyspace, req)
    expect(listed.map((i) => i.name)).toEqual(['ix'])
  })

  it('should wait on each index, and on the primary index when asked', async () => {
    const { client, sent } = answering()
    const indexes = new Couchbase2QueryIndexes(channel, client)
    await indexes.watchIndexes(keyspace, ['x', 'y'], true, 5000, req)
    expect(sent.map((m) => (m as { name: string }).name)).toEqual([
      'x',
      'y',
      '#primary',
    ])
  })

  it('should ask again about an index that has not been built', async () => {
    const { client, sent } = answering([notBuilding()], [null, {}])
    const indexes = new Couchbase2QueryIndexes(channel, client)
    await indexes.watchIndexes(keyspace, ['x'], false, 5000, req)
    expect(sent).toHaveLength(2)
  })

  it('should give up on an index not built within the time left', async () => {
    const { client } = answering([notBuilding()])
    const indexes = new Couchbase2QueryIndexes(channel, client)
    const watch = indexes.watchIndexes(keyspace, ['x'], false, 500, req)
    await expect(watch).rejects.toThrow(
      'Failed to find all indexes online within the alloted time.'
    )
    await expect(watch).rejects.not.toBeInstanceOf(InternalServerFailureError)
  })

  it('should end a watch that runs out of time as a classic one does', async () => {
    const { client } = answering()
    const indexes = new Couchbase2QueryIndexes(channel, client)
    const watch = indexes.watchIndexes(keyspace, ['x'], false, 0, req)
    await expect(watch).rejects.toBeInstanceOf(CouchbaseError)
    await expect(watch).rejects.toThrow(
      'Failed to find all indexes online within the alloted time.'
    )
  })

  it('should trace each wait as an operation under the watch', async () => {
    const spans: { name: string; parent?: RequestSpan; span: RequestSpan }[] =
      []
    let failedWaits = 0
    const tracer: RequestTracer = {
      requestSpan: (name, parent) => {
        const span: RequestSpan = {
          name,
          setAttribute: () => {},
          addEvent: () => {},
          setStatus: (status) => {
            if (status.code === SpanStatusCode.ERROR) failedWaits++
          },
          end: () => {},
        }
        spans.push({ name, parent, span })
        return span
      },
    }
    const watch = new ObservableRequestHandler(
      QueryIndexMgmtOp.QueryIndexWatchIndexes,
      new ObservabilityInstruments(tracer, new NoOpMeter())
    )
    const { client } = answering([notBuilding()], [null, {}], [null, {}])
    const indexes = new Couchbase2QueryIndexes(channel, client)
    await indexes.watchIndexes(keyspace, ['x', 'y'], false, 5000, {
      timeout: 5000,
      obs: watch,
    })
    const waits = spans.filter(
      (s) => s.name === QueryIndexMgmtOp.QueryIndexWaitForIndexOnline
    )
    expect(waits).toHaveLength(3)
    for (const wait of waits) {
      expect(wait.parent).toBe(spans[0].span)
    }
    expect(failedWaits, 'the refused wait').toBe(1)
  })

  it('should raise IndexNotFoundError for a missing index', async () => {
    const { client } = answering([
      failed(grpc.status.NOT_FOUND, { resourceType: 'queryindex' }),
    ])
    const indexes = new Couchbase2QueryIndexes(channel, client)
    await expect(
      indexes.watchIndexes(keyspace, ['x'], false, 5000, req)
    ).rejects.toBeInstanceOf(IndexNotFoundError)
  })
})
