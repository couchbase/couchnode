import * as grpc from '@grpc/grpc-js'
import { describe, expect, it } from 'vitest'

import type { Index__Output as IndexPb } from '../../../../lib/couchbase2/generated/couchbase/admin/search/v1/Index'
import type { SearchAdminServiceClient } from '../../../../lib/couchbase2/generated/couchbase/admin/search/v1/SearchAdminService'
import {
  Couchbase2Op,
  RequestContext,
} from '../../../../lib/couchbase2/requestcontext'
import {
  Couchbase2SearchIndexes,
  indexFieldsToProto,
  paramsToProto,
  searchIndexFromProto,
  searchScopeToProto,
} from '../../../../lib/couchbase2/searchindexes'
import {
  IndexNotFoundError,
  InvalidArgumentError,
  ParsingFailureError,
} from '../../../../lib/errors'

// The search index management requests and results, mapped without a
// gateway.

const json = (value: unknown): Buffer => Buffer.from(JSON.stringify(value))

const LISTED: IndexPb = {
  uuid: 'u1',
  name: 'ix',
  type: 'fulltext-index',
  source_name: 'b',
  source_type: 'gocbcore',
  source_uuid: 'su',
  params: { mapping: json({ default_mapping: { enabled: true } }) },
  plan_params: { indexPartitions: json(1) },
  source_params: {},
}

describe('#couchbase2 search index scope', () => {
  it('should leave out the bucket and scope for the cluster', () => {
    expect(searchScopeToProto({ timeout: 1, obs: null })).toEqual({})
  })

  it('should name the bucket and scope for a scope', () => {
    expect(
      searchScopeToProto({
        timeout: 1,
        obs: null,
        scope: { bucketName: 'b', scopeName: 's' },
      })
    ).toEqual({ bucket_name: 'b', scope_name: 's' })
  })
})

describe('#couchbase2 search index params', () => {
  it('should send each member as its own JSON', () => {
    expect(
      paramsToProto({ a: { b: [1, 'x'] }, c: 'd', e: null }, 'params')
    ).toEqual({ a: json({ b: [1, 'x'] }), c: json('d'), e: json(null) })
  })

  it('should leave out a member that has no JSON form', () => {
    expect(paramsToProto({ a: 1, b: undefined }, 'params')).toEqual({
      a: json(1),
    })
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
  ])('should send no members for %s', (_name, params) => {
    expect(paramsToProto(params, 'params')).toEqual({})
  })

  it.each([
    ['a string', 'x'],
    ['a number', 1],
    ['an array', [1]],
  ])('should refuse %s', (_name, params) => {
    expect(() => paramsToProto(params, 'params')).toThrow(InvalidArgumentError)
  })
})

describe('#couchbase2 search index definition', () => {
  it('should send each field that was given', () => {
    expect(
      indexFieldsToProto({
        name: 'ix',
        type: 'fulltext-index',
        sourceName: 'b',
        sourceType: 'gocbcore',
        sourceUuid: 'su',
        params: { a: 1 },
        planParams: { b: 2 },
        sourceParams: { c: 3 },
      })
    ).toEqual({
      name: 'ix',
      type: 'fulltext-index',
      source_name: 'b',
      source_type: 'gocbcore',
      source_uuid: 'su',
      params: { a: json(1) },
      plan_params: { b: json(2) },
      source_params: { c: json(3) },
    })
  })

  it('should leave out an empty source', () => {
    const fields = indexFieldsToProto({
      name: 'ix',
      type: 'fulltext-index',
      sourceName: '',
      sourceType: '',
      params: {},
    })
    expect(fields).not.toHaveProperty('source_name')
    expect(fields).not.toHaveProperty('source_type')
    expect(fields).not.toHaveProperty('source_uuid')
  })

  it('should read an index as a classic connection does', () => {
    expect(searchIndexFromProto(LISTED)).toEqual({
      uuid: 'u1',
      name: 'ix',
      type: 'fulltext-index',
      sourceName: 'b',
      sourceType: 'gocbcore',
      sourceUuid: 'su',
      params: { mapping: { default_mapping: { enabled: true } } },
      planParams: { indexPartitions: 1 },
      sourceParams: {},
    })
  })

  it('should read a source the gateway left out as empty', () => {
    const index = searchIndexFromProto({
      ...LISTED,
      source_name: undefined,
      source_type: undefined,
      source_uuid: undefined,
    })
    expect(index.sourceName).toBe('')
    expect(index.sourceType).toBe('')
    expect(index.sourceUuid).toBe('')
  })

  it('should refuse a member that is not JSON', () => {
    expect(() =>
      searchIndexFromProto({
        ...LISTED,
        params: { mapping: Buffer.from('{') },
      })
    ).toThrow(ParsingFailureError)
  })
})

describe('#couchbase2 search indexes client', () => {
  const channel = {
    metadata: new grpc.Metadata(),
    context: (op: Couchbase2Op, timeoutMs: number) =>
      new RequestContext(op, timeoutMs),
  }
  const req = { timeout: 2500, obs: null }
  const scoped = { ...req, scope: { bucketName: 'b', scopeName: 's' } }

  type Answer = [grpc.ServiceError | null, unknown?]

  // A client whose every call takes the next answer, and which records the
  // method and message of each call.
  function answering(...answers: Answer[]): {
    client: SearchAdminServiceClient
    sent: [string, unknown][]
  } {
    const sent: [string, unknown][] = []
    const method =
      (name: string) =>
      (...args: unknown[]) => {
        sent.push([name, args[0]])
        const callback = args[args.length - 1] as grpc.requestCallback<unknown>
        const [err, resp] = answers.shift() ?? [null, {}]
        callback(err, resp)
      }
    const client = Object.fromEntries(
      [
        'GetIndex',
        'ListIndexes',
        'CreateIndex',
        'UpdateIndex',
        'DeleteIndex',
        'GetIndexedDocumentsCount',
        'PauseIndexIngest',
        'ResumeIndexIngest',
        'AllowIndexQuerying',
        'DisallowIndexQuerying',
        'FreezeIndexPlan',
        'UnfreezeIndexPlan',
        'AnalyzeDocument',
      ].map((name) => [name, method(name)])
    ) as unknown as SearchAdminServiceClient
    return { client, sent }
  }

  const definition = {
    name: 'ix',
    type: 'fulltext-index',
    sourceName: 'b',
    sourceType: 'gocbcore',
    params: { a: 1 },
  }

  it('should create an index that has no uuid', async () => {
    const { client, sent } = answering()
    const indexes = new Couchbase2SearchIndexes(channel, client)
    await indexes.upsertIndex(definition, scoped)
    expect(sent).toEqual([
      [
        'CreateIndex',
        {
          bucket_name: 'b',
          scope_name: 's',
          name: 'ix',
          type: 'fulltext-index',
          source_name: 'b',
          source_type: 'gocbcore',
          params: { a: json(1) },
          plan_params: {},
          source_params: {},
        },
      ],
    ])
  })

  it('should update an index that has a uuid', async () => {
    const { client, sent } = answering()
    const indexes = new Couchbase2SearchIndexes(channel, client)
    await indexes.upsertIndex({ ...definition, uuid: 'u1' }, req)
    expect(sent).toEqual([
      [
        'UpdateIndex',
        {
          index: {
            uuid: 'u1',
            name: 'ix',
            type: 'fulltext-index',
            source_name: 'b',
            source_type: 'gocbcore',
            params: { a: json(1) },
            plan_params: {},
            source_params: {},
          },
        },
      ],
    ])
  })

  it('should read the index a get found', async () => {
    const { client, sent } = answering([null, { index: LISTED }])
    const indexes = new Couchbase2SearchIndexes(channel, client)
    const index = await indexes.getIndex('ix', scoped)
    expect(index.name).toBe('ix')
    expect(sent).toEqual([
      ['GetIndex', { bucket_name: 'b', scope_name: 's', name: 'ix' }],
    ])
  })

  it('should raise IndexNotFoundError for a get that found no index', async () => {
    const { client } = answering([null, { index: null }])
    const indexes = new Couchbase2SearchIndexes(channel, client)
    await expect(indexes.getIndex('ix', req)).rejects.toBeInstanceOf(
      IndexNotFoundError
    )
  })

  it('should list the indexes', async () => {
    const { client } = answering([null, { indexes: [LISTED] }])
    const indexes = new Couchbase2SearchIndexes(channel, client)
    const listed = await indexes.getAllIndexes(req)
    expect(listed.map((i) => i.name)).toEqual(['ix'])
  })

  it('should read the count as a number', async () => {
    const { client } = answering([null, { count: '42' }])
    const indexes = new Couchbase2SearchIndexes(channel, client)
    await expect(indexes.getIndexedDocumentsCount('ix', req)).resolves.toBe(42)
  })

  it.each([
    ['dropIndex', 'DeleteIndex'],
    ['pauseIngest', 'PauseIndexIngest'],
    ['resumeIngest', 'ResumeIndexIngest'],
    ['allowQuerying', 'AllowIndexQuerying'],
    ['disallowQuerying', 'DisallowIndexQuerying'],
    ['freezePlan', 'FreezeIndexPlan'],
    ['unfreezePlan', 'UnfreezeIndexPlan'],
  ] as const)('should send %s as %s', async (call, method) => {
    const { client, sent } = answering()
    const indexes = new Couchbase2SearchIndexes(channel, client)
    await indexes[call]('ix', scoped)
    expect(sent).toEqual([
      [method, { bucket_name: 'b', scope_name: 's', name: 'ix' }],
    ])
  })

  it('should send the document as JSON and read the analysis back', async () => {
    const analysis = [{ field: 'a', tokens: ['x'] }]
    const { client, sent } = answering([
      null,
      { status: 'ok', analyzed: json(analysis) },
    ])
    const indexes = new Couchbase2SearchIndexes(channel, client)
    await expect(
      indexes.analyzeDocument('ix', { a: 'x' }, req)
    ).resolves.toEqual(analysis)
    expect(sent).toEqual([
      ['AnalyzeDocument', { name: 'ix', doc: json({ a: 'x' }) }],
    ])
  })

  it('should refuse an analysis that is not JSON', async () => {
    const { client } = answering([
      null,
      { status: 'ok', analyzed: Buffer.from('{') },
    ])
    const indexes = new Couchbase2SearchIndexes(channel, client)
    await expect(indexes.analyzeDocument('ix', {}, req)).rejects.toBeInstanceOf(
      ParsingFailureError
    )
  })
})
