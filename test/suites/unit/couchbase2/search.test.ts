import * as grpc from '@grpc/grpc-js'
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest'

import { Couchbase2MutationToken } from '../../../../lib/couchbase2/kv'
import {
  Couchbase2Op,
  RequestContext,
} from '../../../../lib/couchbase2/requestcontext'
import { loadSchema } from '../../../../lib/couchbase2/schema'
import {
  Couchbase2Search,
  EncodedSearch,
  exactFloat32,
  facetToProto,
  queryToProto,
  searchFacetFromProto,
  searchMetaDataFromProto,
  searchRequestToProto,
  searchRowFromProto,
  sortToProto,
} from '../../../../lib/couchbase2/search'
import { OpenStreams } from '../../../../lib/couchbase2/streaming'
import {
  FeatureNotAvailableError,
  InvalidArgumentError,
} from '../../../../lib/errors'
import { MutationState } from '../../../../lib/mutationstate'
import type { ObservableRequestHandler } from '../../../../lib/observabilityhandler'
import { SearchFacet } from '../../../../lib/searchfacet'
import { MatchOperator, SearchQuery } from '../../../../lib/searchquery'
import { SearchSort } from '../../../../lib/searchsort'
import {
  HighlightStyle,
  SearchRequest,
  SearchScoring,
} from '../../../../lib/searchtypes'
import { VectorQuery, VectorSearch } from '../../../../lib/vectorsearch'

// A search's request and answer, mapped without a gateway.

const json = (value: unknown) => Buffer.from(JSON.stringify(value))

// What the SDK's query serializes to, as the backend reads it.
const proto = (query: SearchQuery) =>
  queryToProto(JSON.parse(JSON.stringify(query)))

describe('#couchbase2 search float bounds', () => {
  it.each([0, 1, -2.5, 0.5, 1.1, 3.14, 16777216, 1e-7])(
    'should carry %d unchanged',
    (value) => {
      expect(exactFloat32(value)).toBe(true)
    }
  )

  it.each([16777217, 0.1 + 0.2, 1e40, NaN, Infinity])(
    'should not carry %d unchanged',
    (value) => {
      expect(exactFloat32(value)).toBe(false)
    }
  )
})

describe('#couchbase2 search query', () => {
  it('should send a match query with each option it was given', () => {
    expect(
      proto(
        SearchQuery.match('x')
          .field('f')
          .analyzer('a')
          .fuzziness(1)
          .prefixLength(2)
          .operator(MatchOperator.And)
          .boost(1.5)
      )
    ).toEqual({
      match_query: {
        value: 'x',
        field: 'f',
        analyzer: 'a',
        fuzziness: 1,
        prefix_length: 2,
        operator: 'OPERATOR_AND',
        boost: 1.5,
      },
    })
  })

  it.each([
    [
      SearchQuery.term('t').field('f'),
      { term_query: { term: 't', field: 'f' } },
    ],
    [SearchQuery.matchPhrase('p q'), { match_phrase_query: { phrase: 'p q' } }],
    [SearchQuery.phrase(['p', 'q']), { phrase_query: { terms: ['p', 'q'] } }],
    [SearchQuery.prefix('p'), { prefix_query: { prefix: 'p' } }],
    [SearchQuery.regexp('r.*'), { regexp_query: { regexp: 'r.*' } }],
    [SearchQuery.wildcard('w*'), { wildcard_query: { wildcard: 'w*' } }],
    [
      SearchQuery.queryString('+a -b').boost(2),
      { query_string_query: { query_string: '+a -b', boost: 2 } },
    ],
    [
      SearchQuery.booleanField(false).field('f'),
      { boolean_field_query: { value: false, field: 'f' } },
    ],
    [SearchQuery.matchAll(), { match_all_query: {} }],
    [SearchQuery.matchNone(), { match_none_query: {} }],
  ])('should send %j', (query, expected) => {
    expect(proto(query)).toEqual(expected)
  })

  it('should leave out the field of a document ID query', () => {
    expect(proto(SearchQuery.docIds('a', 'b').field('f'))).toEqual({
      doc_id_query: { ids: ['a', 'b'] },
    })
  })

  it('should send geo points as a longitude and a latitude', () => {
    expect(proto(SearchQuery.geoDistance(-2, 51, '10km'))).toEqual({
      geo_distance_query: {
        center: { longitude: -2, latitude: 51 },
        distance: '10km',
      },
    })
    expect(proto(SearchQuery.geoBoundingBox(-3, 52, -1, 50))).toEqual({
      geo_bounding_box_query: {
        top_left: { longitude: -3, latitude: 52 },
        bottom_right: { longitude: -1, latitude: 50 },
      },
    })
    expect(proto(SearchQuery.geoPolygon([[1, 2], { lon: 3, lat: 4 }]))).toEqual(
      {
        geo_polygon_query: {
          vertices: [
            { longitude: 1, latitude: 2 },
            { longitude: 3, latitude: 4 },
          ],
        },
      }
    )
  })

  it("should send a range's minimum as inclusive unless told otherwise", () => {
    expect(proto(SearchQuery.numericRange().min(1).max(5))).toEqual({
      numeric_range_query: {
        min: 1,
        max: 5,
        inclusive_min: true,
        inclusive_max: false,
      },
    })
    expect(queryToProto({ min: 1 })).toEqual({
      numeric_range_query: { min: 1, inclusive_min: true },
    })
    expect(proto(SearchQuery.termRange().min('a', false))).toEqual({
      term_range_query: { min: 'a', inclusive_min: false },
    })
  })

  it('should refuse a bound or a boost a 32 bit float cannot hold', () => {
    expect(() => proto(SearchQuery.numericRange().min(16777217))).toThrow(
      FeatureNotAvailableError
    )
    expect(() => proto(SearchQuery.term('t').boost(0.1 + 0.2))).toThrow(
      FeatureNotAvailableError
    )
  })

  it('should send a date range only with an exclusive start and end', () => {
    expect(
      proto(
        SearchQuery.dateRange()
          .start('2024-01-01', false)
          .end('2024-02-01')
          .dateTimeParser('p')
      )
    ).toEqual({
      date_range_query: {
        start_date: '2024-01-01',
        end_date: '2024-02-01',
        date_time_parser: 'p',
      },
    })
    expect(() => proto(SearchQuery.dateRange().start('2024-01-01'))).toThrow(
      FeatureNotAvailableError
    )
    expect(() =>
      proto(SearchQuery.dateRange().end('2024-02-01', true))
    ).toThrow(FeatureNotAvailableError)
  })

  it('should send no minimum for a disjunction that sets none', () => {
    const sent = proto(
      SearchQuery.disjuncts(SearchQuery.term('a'), SearchQuery.term('b'))
    )
    expect(sent).toEqual({
      disjunction_query: {
        queries: [{ term_query: { term: 'a' } }, { term_query: { term: 'b' } }],
      },
    })
    expect(sent.disjunction_query).not.toHaveProperty('minimum')
  })

  it("should send a boolean query's clauses as conjunctions and disjunctions", () => {
    expect(
      proto(
        SearchQuery.boolean()
          .must(SearchQuery.conjuncts(SearchQuery.term('a')))
          .should(SearchQuery.disjuncts(SearchQuery.term('b')))
          .shouldMin(2)
          .mustNot(SearchQuery.disjuncts(SearchQuery.term('c')))
      )
    ).toEqual({
      boolean_query: {
        must: { queries: [{ term_query: { term: 'a' } }] },
        should: { queries: [{ term_query: { term: 'b' } }], minimum: 2 },
        must_not: { queries: [{ term_query: { term: 'c' } }] },
      },
    })
    expect(
      proto(SearchQuery.boolean().should(SearchQuery.disjuncts()))
    ).toEqual({ boolean_query: { should: { queries: [] } } })
  })

  it.each([
    ['an unknown kind', { geometry: {} }],
    ['an empty boolean query', {}],
    ['a member with no field', { term: 't', analyzer: 'a' }],
    ['a boosted match all', { match_all: null, boost: 2 }],
    ['a point as a geohash', { location: 'gcpvj', distance: '1km' }],
  ])('should refuse %s', (_name, query) => {
    expect(() => queryToProto(query)).toThrow(FeatureNotAvailableError)
  })

  it.each([
    ['a term that is not a string', { term: 1 }],
    ['a negative fuzziness', { term: 't', fuzziness: -1 }],
    ['an unknown operator', { match: 'm', operator: 'xor' }],
    ['a must that is not a conjunction', { must: { term: 't' } }],
  ])('should refuse %s as invalid', (_name, query) => {
    expect(() => queryToProto(query)).toThrow(InvalidArgumentError)
  })
})

describe('#couchbase2 search sort', () => {
  it.each([
    ['_score', { score_sorting: { descending: false } }],
    ['-_score', { score_sorting: { descending: true } }],
    ['-_id', { id_sorting: { descending: true } }],
    ['f', { field_sorting: { field: 'f', descending: false } }],
  ])('should send %s', (sort, expected) => {
    expect(sortToProto(sort)).toEqual(expected)
  })

  it('should send each kind of SearchSort', () => {
    const sorts = [
      SearchSort.score().descending(true),
      SearchSort.id(),
      // @ts-expect-error The Search service reads missing as first or last.
      SearchSort.field('f').type('number').missing('last'),
      SearchSort.geoDistance('g', 51, -2).unit('km'),
    ].map((s) => sortToProto(JSON.parse(JSON.stringify(s))))
    expect(sorts).toEqual([
      { score_sorting: { descending: true } },
      { id_sorting: { descending: false } },
      {
        field_sorting: {
          field: 'f',
          descending: false,
          type: 'number',
          missing: 'last',
        },
      },
      {
        geo_distance_sorting: {
          field: 'g',
          descending: false,
          center: { longitude: -2, latitude: 51 },
          unit: 'km',
        },
      },
    ])
  })

  it('should refuse a field sort with a mode', () => {
    expect(() =>
      sortToProto(JSON.parse(JSON.stringify(SearchSort.field('f').mode('min'))))
    ).toThrow(FeatureNotAvailableError)
  })
})

describe('#couchbase2 search facet', () => {
  it('should send each kind of facet', () => {
    const toProto = (facet: SearchFacet) =>
      facetToProto(JSON.parse(JSON.stringify(facet)))
    expect(toProto(SearchFacet.term('t', 5))).toEqual({
      term_facet: { field: 't', size: 5 },
    })
    expect(
      toProto(SearchFacet.numeric('n', 2).addRange('low', undefined, 2.5))
    ).toEqual({
      numeric_range_facet: {
        field: 'n',
        size: 2,
        numeric_ranges: [{ name: 'low', max: 2.5 }],
      },
    })
    expect(
      toProto(
        SearchFacet.date('d', 1).addRange(
          'jan',
          new Date('2024-01-01T00:00:00Z')
        )
      )
    ).toEqual({
      date_range_facet: {
        field: 'd',
        size: 1,
        date_ranges: [{ name: 'jan', start: '2024-01-01T00:00:00.000Z' }],
      },
    })
  })

  it('should refuse a numeric range a 32 bit float cannot hold', () => {
    expect(() =>
      facetToProto({
        field: 'n',
        size: 1,
        numeric_ranges: [{ name: 'r', min: 16777217 }],
      })
    ).toThrow(FeatureNotAvailableError)
  })
})

describe('#couchbase2 search request', () => {
  const query = SearchQuery.matchAll()

  it('should send the options it has a field for', () => {
    const { message } = searchRequestToProto(
      'ix',
      query,
      {
        limit: 10,
        skip: 5,
        explain: true,
        fields: ['a'],
        collections: ['c'],
        sort: ['-_score'],
        facets: { t: SearchFacet.term('t', 3) },
      },
      undefined
    )
    expect(message).toEqual({
      index_name: 'ix',
      query: { match_all_query: {} },
      scan_consistency: 'SCAN_CONSISTENCY_NOT_BOUNDED',
      limit: 10,
      skip: 5,
      include_explanation: true,
      include_locations: false,
      disable_scoring: false,
      fields: ['a'],
      collections: ['c'],
      highlight_fields: [],
      sort: [{ score_sorting: { descending: true } }],
      facets: { t: { term_facet: { field: 't', size: 3 } } },
    })
  })

  it("should name a scope's index in full and send no bucket or scope", () => {
    const { message } = searchRequestToProto(
      'ix',
      new SearchRequest(query),
      {},
      { bucketName: 'b', scopeName: 's' }
    )
    expect(message.index_name).toBe('b.s.ix')
    expect(message).not.toHaveProperty('bucket_name')
    expect(message).not.toHaveProperty('scope_name')
  })

  it('should keep fragments and locations only when asked for', () => {
    const plain = searchRequestToProto('ix', query, {})
    expect([plain.fragments, plain.locations]).toEqual([false, false])
    const located = searchRequestToProto('ix', query, {
      includeLocations: true,
    })
    expect([located.fragments, located.locations]).toEqual([false, true])
    const styled = searchRequestToProto('ix', query, {
      highlight: { style: HighlightStyle.HTML },
    })
    expect(styled.message.highlight_style).toBe('HIGHLIGHT_STYLE_HTML')
    expect([styled.fragments, styled.locations]).toEqual([true, true])
    const fields = searchRequestToProto('ix', query, {
      highlight: { fields: ['f'] },
    })
    expect([fields.fragments, fields.locations]).toEqual([true, true])
  })

  it('should send scoring of none as no scoring', () => {
    const { message } = searchRequestToProto('ix', query, {
      scoring: SearchScoring.none(),
    })
    expect(message.disable_scoring).toBe(true)
  })

  it.each([
    [
      'vector search',
      new SearchRequest(
        VectorSearch.fromVectorQuery(VectorQuery.create('v', [1, 2]))
      ),
      {},
    ],
    ['a limit of 0', query, { limit: 0 }],
    ['score fusion', query, { scoring: SearchScoring.reciprocalRankFusion() }],
    [
      'a mutation state',
      query,
      {
        consistentWith: new MutationState(
          new Couchbase2MutationToken({
            bucket_name: 'b',
            vbucket_id: 1,
            vbucket_uuid: '2',
            seq_no: '3',
          })
        ),
      },
    ],
  ])('should refuse %s', (_name, request, options) => {
    expect(() => searchRequestToProto('ix', request, options)).toThrow(
      FeatureNotAvailableError
    )
  })

  it.each([
    { limit: -1 },
    { skip: 1.5 },
    { disableScoring: true, scoring: SearchScoring.none() },
    { highlight: { style: 'bold' as HighlightStyle } },
  ])('should refuse %j as invalid', (options) => {
    expect(() => searchRequestToProto('ix', query, options)).toThrow(
      InvalidArgumentError
    )
  })

  it('should send an empty mutation state as none', () => {
    expect(
      searchRequestToProto('ix', query, { consistentWith: new MutationState() })
        .message
    ).toEqual(searchRequestToProto('ix', query, {}).message)
  })

  it.each([
    [{ raw: { x: 1 } }, 'raw'],
    [{ showRequest: true }, 'showRequest'],
  ])('should warn that %j is not sent', (options, name) => {
    const warn = vi
      .spyOn(process, 'emitWarning')
      .mockImplementation(() => undefined)
    onTestFinished(() => warn.mockRestore())
    expect(searchRequestToProto('ix', query, options).message).toEqual(
      searchRequestToProto('ix', query, {}).message
    )
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0][0])).toContain(name)
  })
})

describe('#couchbase2 search answer', () => {
  const encoded = (options = {}, facets = {}): EncodedSearch => ({
    ...searchRequestToProto('ix', SearchQuery.matchAll(), options),
    facets,
  })

  const HIT = {
    id: 'd1',
    score: 1.5,
    index: 'ix_123',
    explanation: Buffer.alloc(0),
    locations: [
      {
        field: 'f',
        term: 't',
        position: 1,
        start: 0,
        end: 1,
        array_positions: [],
      },
    ],
    fragments: { f: { content: ['<mark>t</mark>'] } },
    fields: { a: json(1), b: json({ c: 'd' }) },
  }

  it('should read a hit as a classic connection does', () => {
    expect(
      searchRowFromProto(
        { ...HIT, explanation: json({ value: 1 }) },
        encoded({ highlight: { style: HighlightStyle.HTML } })
      )
    ).toEqual({
      index: 'ix_123',
      id: 'd1',
      score: 1.5,
      locations: [
        { field: 'f', term: 't', position: 1, start_offset: 0, end_offset: 1 },
      ],
      fragments: { f: ['<mark>t</mark>'] },
      fields: { a: 1, b: { c: 'd' } },
      explanation: { value: 1 },
    })
  })

  it('should drop highlighting the request did not ask for', () => {
    const row = searchRowFromProto({ ...HIT, fields: {} }, encoded())
    expect(row.locations).toEqual([])
    expect(row.fragments).toEqual({})
    expect(row.fields).toBeUndefined()
    expect(row.explanation).toBeUndefined()
  })

  it("should read a range facet's bounds from the request", () => {
    const facet = searchFacetFromProto(
      'n',
      {
        numeric_range_facet: {
          field: 'n',
          total: '4',
          missing: '1',
          other: '0',
          numeric_ranges: [{ name: 'mid', size: '3', min: '0', max: '2' }],
        },
      },
      { numeric_ranges: [{ name: 'mid', min: 0.5, max: 2.75 }] }
    )
    expect(facet).toEqual({
      name: 'n',
      field: 'n',
      total: 4,
      missing: 1,
      other: 0,
      terms: [],
      date_ranges: [],
      numeric_ranges: [{ name: 'mid', count: 3, min: 0.5, max: 2.75 }],
    })
    const dates = searchFacetFromProto(
      'd',
      {
        date_range_facet: {
          field: 'd',
          total: '1',
          missing: '0',
          other: '0',
          date_ranges: [{ name: 'jan', size: '1', start: null, end: null }],
        },
      },
      { date_ranges: [{ name: 'jan', start: '2024-01-01T00:00:00.000Z' }] }
    )
    expect(dates.date_ranges).toEqual([
      {
        name: 'jan',
        count: 1,
        start: '2024-01-01T00:00:00.000Z',
        end: undefined,
      },
    ])
  })

  it('should read the metadata, with the facets', () => {
    const meta = searchMetaDataFromProto(
      {
        metrics: {
          execution_time: { seconds: '1', nanos: 250000000 },
          total_rows: '7',
          max_score: 2.5,
          total_partition_count: '2',
          success_partition_count: '2',
          error_partition_count: '0',
        },
        errors: {},
      },
      {
        t: {
          term_facet: {
            field: 't',
            total: '7',
            missing: '0',
            other: '1',
            terms: [{ name: 'x', field: 't', size: '6' }],
          },
        },
      },
      encoded()
    )
    expect(meta).toEqual({
      facets: {
        t: {
          name: 't',
          field: 't',
          total: 7,
          missing: 0,
          other: 1,
          terms: [{ term: 'x', count: 6 }],
          date_ranges: [],
          numeric_ranges: [],
        },
      },
      client_context_id: '',
      metrics: {
        took: 1250,
        total_rows: 7,
        max_score: 2.5,
        success_partition_count: 2,
        error_partition_count: 0,
      },
      errors: {},
    })
  })
})

type Answer = {
  messages: unknown[]
  end: 'ok' | grpc.status
}

/**
 * A handler that records how the request ended.
 */
function endingHandler(): ObservableRequestHandler {
  return {
    end: vi.fn(),
    endWithError: vi.fn(),
  } as unknown as ObservableRequestHandler
}

describe('#couchbase2 search over a call', () => {
  let server: grpc.Server
  let answer: Answer = { messages: [], end: 'ok' }
  let search: Couchbase2Search
  let close: () => void

  beforeAll(async () => {
    const schema = loadSchema()
    server = new grpc.Server()
    server.addService(schema.couchbase.search.v1.SearchService.service, {
      SearchQuery: (call: grpc.ServerWritableStream<unknown, unknown>) => {
        for (const message of answer.messages) {
          call.write(message)
        }
        if (answer.end === 'ok') {
          call.end()
        } else {
          call.emit(
            'error',
            Object.assign(new Error(grpc.status[answer.end]), {
              code: answer.end,
              details: 'bad query',
            })
          )
        }
      },
    })
    const port = await new Promise<number>((resolve, reject) =>
      server.bindAsync(
        '127.0.0.1:0',
        grpc.ServerCredentials.createInsecure(),
        (err, p) => (err ? reject(err) : resolve(p))
      )
    )
    const client = new schema.couchbase.search.v1.SearchService(
      `127.0.0.1:${port}`,
      grpc.credentials.createInsecure()
    )
    close = () => client.close()
    search = new Couchbase2Search(
      {
        metadata: new grpc.Metadata(),
        streams: new OpenStreams(),
        searchTimeout: 5000,
        context: (op: Couchbase2Op, timeoutMs: number) =>
          new RequestContext(op, timeoutMs),
      },
      client
    )
  })

  afterAll(() => {
    close()
    server.forceShutdown()
  })

  const hit = (id: string) => ({ id, score: 1, index: 'ix' })

  it('should emit every hit, then the metadata and facets of any message', async () => {
    answer = {
      messages: [
        { hits: [hit('a'), hit('b')] },
        {
          hits: [],
          facets: {
            t: { term_facet: { field: 't', total: 2, terms: [] } },
          },
        },
        {
          hits: [hit('c')],
          meta_data: { metrics: { total_rows: 3 }, errors: {} },
        },
      ],
      end: 'ok',
    }
    const events: unknown[] = []
    await new Promise<void>((resolve) => {
      search
        .search('ix', SearchQuery.matchAll(), {})
        .on('row', (row) => events.push(row.id))
        .on('meta', (meta: any) =>
          events.push([meta.metrics.total_rows, Object.keys(meta.facets)])
        )
        .on('error', (err) => events.push(err))
        .on('end', () => resolve())
    })
    expect(events).toEqual(['a', 'b', 'c', [3, ['t']]])
  })

  it('should collect the hits when awaited', async () => {
    answer = { messages: [{ hits: [hit('a')] }], end: 'ok' }
    const result = await search.search('ix', SearchQuery.matchAll(), {})
    expect(result.rows.map((r) => r.id)).toEqual(['a'])
    expect((result.meta as any).metrics.total_rows).toBe(0)
  })

  it('should fail with the call status the gateway reports', async () => {
    answer = { messages: [], end: grpc.status.INVALID_ARGUMENT }
    const err = await search
      .search('ix', SearchQuery.matchAll(), {})
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(InvalidArgumentError)
  })

  it('should fail a request it cannot build on a later tick', async () => {
    const emitter = search.search('ix', SearchQuery.matchAll(), { limit: 0 })
    await expect(emitter).rejects.toBeInstanceOf(FeatureNotAvailableError)
  })

  it('should end its span when the stream ends', async () => {
    answer = { messages: [{ hits: [hit('a')] }], end: 'ok' }
    const obs = endingHandler()
    await search.search('ix', SearchQuery.matchAll(), {}, undefined, obs)
    expect(obs.end).toHaveBeenCalledTimes(1)
    expect(obs.endWithError).not.toHaveBeenCalled()
  })

  it('should end its span with the failure that ended the stream', async () => {
    answer = { messages: [], end: grpc.status.INVALID_ARGUMENT }
    const obs = endingHandler()
    const err = await search
      .search('ix', SearchQuery.matchAll(), {}, undefined, obs)
      .catch((e: unknown) => e)
    expect(obs.endWithError).toHaveBeenCalledWith(err)
    expect(obs.end).not.toHaveBeenCalled()
  })

  it('should end its span when the request cannot be built', async () => {
    const obs = endingHandler()
    const err = await search
      .search('ix', SearchQuery.matchAll(), { limit: 0 }, undefined, obs)
      .catch((e: unknown) => e)
    expect(obs.endWithError).toHaveBeenCalledWith(err)
  })
})
