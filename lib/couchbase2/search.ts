import * as grpc from '@grpc/grpc-js'

import type { KeyspaceScope, SearchBackend } from '../backends'
import { FeatureNotAvailableError, InvalidArgumentError } from '../errors'
import type { MutationState } from '../mutationstate'
import type { ObservableRequestHandler } from '../observabilityhandler'
import type { SearchQuery } from '../searchquery'
import {
  HighlightStyle,
  SearchMetaData,
  SearchQueryOptions,
  SearchRequest,
  SearchResult,
  SearchRow,
  SearchScanConsistency,
  SearchScoring,
} from '../searchtypes'
import { StreamableRowPromise } from '../streamablepromises'
import type { Facet as FacetPb } from './generated/couchbase/search/v1/Facet'
import type { LatLng as LatLngPb } from './generated/couchbase/search/v1/LatLng'
import type { Query as QueryPb } from './generated/couchbase/search/v1/Query'
import type { SearchQueryRequest as SearchQueryRequestPb } from './generated/couchbase/search/v1/SearchQueryRequest'
import type {
  _couchbase_search_v1_SearchQueryResponse_FacetResult__Output as FacetResultPb,
  _couchbase_search_v1_SearchQueryResponse_Location__Output as LocationPb,
  _couchbase_search_v1_SearchQueryResponse_MetaData__Output as MetaDataPb,
  _couchbase_search_v1_SearchQueryResponse_SearchQueryRow__Output as HitPb,
  SearchQueryResponse__Output as SearchQueryResponsePb,
} from './generated/couchbase/search/v1/SearchQueryResponse'
import type { SearchServiceClient } from './generated/couchbase/search/v1/SearchService'
import type { Sorting as SortingPb } from './generated/couchbase/search/v1/Sorting'
import { durationFromProto } from './query'
import type { Couchbase2Op, RequestContext } from './requestcontext'
import {
  endWithError,
  OpenStreams,
  rethrowListenerErrors,
  retryStream,
} from './streaming'

// The gateway takes a search as structured fields rather than the Search
// service's JSON, so queries, sorts and facets are read from the JSON classic
// sends and rewritten. Anything the gateway cannot send as asked is refused
// with FeatureNotAvailableError before sending. Where the gateway's default
// differs from the Search service's, the service's default is sent
// explicitly.

/**
 * A search, which changes nothing.
 *
 * @internal
 */
export const SEARCH: Couchbase2Op = {
  name: 'search',
  readOnly: true,
  idempotent: true,
}

const UINT32_MAX = 2 ** 32 - 1

/**
 * A JSON object, as a query, sort or facet serializes to.
 */
type Json = { [key: string]: unknown }

/**
 * A `FeatureNotAvailableError` for `what`, which the gateway cannot send.
 */
function unavailable(what: string, why: string): FeatureNotAvailableError {
  return new FeatureNotAvailableError(
    new Error(`${what} cannot be sent over couchbase2: ${why}.`)
  )
}

/**
 * An `InvalidArgumentError` for a search that cannot be sent as it is.
 */
function invalid(message: string): InvalidArgumentError {
  return new InvalidArgumentError(new Error(message))
}

/**
 * Whether `value` survives the gateway unchanged: the gateway holds it as a
 * 32 bit float and forwards the shortest decimal naming that float.
 *
 * @internal
 */
export function exactFloat32(value: number): boolean {
  const single = Math.fround(value)
  if (!Number.isFinite(value) || !Number.isFinite(single)) {
    return false
  }
  for (let digits = 1; digits <= 9; digits++) {
    const shortest = Number(single.toPrecision(digits))
    if (Math.fround(shortest) === single) {
      return shortest === value
    }
  }
  return single === value
}

const FLOAT32_BOUND =
  'the gateway carries it as a 32 bit float, which cannot hold this value'

/**
 * Whether `value` is a JSON object.
 */
function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Refuses a member of `obj` not in `allowed`; the gateway has no field for
 * it.
 */
function onlyMembers(obj: Json, what: string, allowed: readonly string[]) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      throw unavailable(`${what}'s ${key}`, `the gateway has no field for it`)
    }
  }
}

/**
 * `obj[key]` as a string, or undefined when it is not set.
 */
function str(obj: Json, key: string, what: string): string | undefined {
  const value = obj[key]
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value !== 'string') {
    throw invalid(`Expected ${what}'s ${key} to be a string, got ${value}.`)
  }
  return value
}

/**
 * `obj[key]` as a boolean, or undefined when it is not set.
 */
function bool(obj: Json, key: string, what: string): boolean | undefined {
  const value = obj[key]
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value !== 'boolean') {
    throw invalid(`Expected ${what}'s ${key} to be a boolean, got ${value}.`)
  }
  return value
}

/**
 * `obj[key]` as a number the gateway holds as a 32 bit float, or undefined
 * when it is not set.
 */
function float32(obj: Json, key: string, what: string): number | undefined {
  const value = obj[key]
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value !== 'number') {
    throw invalid(`Expected ${what}'s ${key} to be a number, got ${value}.`)
  }
  if (!exactFloat32(value)) {
    throw unavailable(`${what}'s ${key} of ${value}`, FLOAT32_BOUND)
  }
  return value
}

/**
 * `value` checked to be an integer from 0 to `max`, for the field `name`.
 */
function count(name: string, value: unknown, max: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > max
  ) {
    throw invalid(
      `Expected ${name} to be an integer from 0 to ${max}, got ${value}.`
    )
  }
  return value
}

/**
 * `obj[key]` as an unsigned integer, or undefined when it is not set.
 */
function uint(
  obj: Json,
  key: string,
  what: string,
  max = Number.MAX_SAFE_INTEGER
): number | undefined {
  const value = obj[key]
  return value === undefined || value === null
    ? undefined
    : count(`${what}'s ${key}`, value, max)
}

/**
 * `obj[key]` as a list of strings, or undefined when it is not set.
 */
function strings(obj: Json, key: string, what: string): string[] | undefined {
  const value = obj[key]
  if (value === undefined || value === null) {
    return undefined
  }
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw invalid(`Expected ${what}'s ${key} to be a list of strings.`)
  }
  return value
}

/**
 * A point, which the SDK writes as `[longitude, latitude]` and a raw query
 * may write as an object.
 */
function latLng(value: unknown, what: string): LatLngPb {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((v) => typeof v === 'number')
  ) {
    return { longitude: value[0], latitude: value[1] }
  }
  if (
    isObject(value) &&
    typeof value.lon === 'number' &&
    typeof value.lat === 'number'
  ) {
    return { longitude: value.lon, latitude: value.lat }
  }
  throw unavailable(
    `${what}'s point ${JSON.stringify(value)}`,
    'the gateway takes a point only as a longitude and a latitude'
  )
}

/**
 * The members every query but match all and match none may carry.
 */
function common(
  q: Json,
  what: string,
  field = true
): { boost?: number; field?: string } {
  const out: { boost?: number; field?: string } = {}
  const boost = float32(q, 'boost', what)
  if (boost !== undefined) {
    out.boost = boost
  }
  if (field) {
    const name = str(q, 'field', what)
    if (name !== undefined) {
      out.field = name
    }
  }
  return out
}

/**
 * `fields` without the members that are not set, which the generated types
 * would otherwise send as their defaults.
 */
function defined<T extends object>(fields: T): T {
  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined)
  ) as T
}

/**
 * A numeric or term range. The gateway reads an unset `inclusive_min` as
 * exclusive, where the Search service's default is inclusive, so it is
 * always sent with a minimum.
 */
function range<T>(
  q: Json,
  what: string,
  bound: (obj: Json, key: string, what: string) => T | undefined
) {
  onlyMembers(q, what, [
    'min',
    'max',
    'inclusive_min',
    'inclusive_max',
    'field',
    'boost',
  ])
  const min = bound(q, 'min', what)
  const inclusiveMin = bool(q, 'inclusive_min', what)
  return defined({
    ...common(q, what),
    min,
    max: bound(q, 'max', what),
    inclusive_min:
      min !== undefined && inclusiveMin === undefined ? true : inclusiveMin,
    inclusive_max: bool(q, 'inclusive_max', what),
  })
}

/**
 * A date range. The gateway always excludes the start, where the Search
 * service includes it by default, and cannot include the end.
 */
function dateRange(q: Json, what: string): QueryPb['date_range_query'] {
  onlyMembers(q, what, [
    'start',
    'end',
    'inclusive_start',
    'inclusive_end',
    'datetime_parser',
    'field',
    'boost',
  ])
  const start = str(q, 'start', what)
  if (start !== undefined && bool(q, 'inclusive_start', what) !== false) {
    throw unavailable(
      `${what}'s inclusive start`,
      "the gateway excludes a date range's start; give the start as " +
        'exclusive to search without it'
    )
  }
  if (bool(q, 'inclusive_end', what) === true) {
    throw unavailable(
      `${what}'s inclusive end`,
      "the gateway excludes a date range's end"
    )
  }
  return defined({
    ...common(q, what),
    start_date: start,
    end_date: str(q, 'end', what),
    date_time_parser: str(q, 'datetime_parser', what),
  })
}

/**
 * The child queries of a conjunction or a disjunction.
 */
function children(q: Json, key: string, what: string): QueryPb[] {
  const value = q[key]
  if (!Array.isArray(value)) {
    throw invalid(`Expected ${what}'s ${key} to be a list of queries.`)
  }
  return value.map((child) => queryToProto(child))
}

/**
 * A conjunction, which a boolean query's `must` also is.
 */
function conjunction(q: Json, what: string): QueryPb['conjunction_query'] {
  onlyMembers(q, what, ['conjuncts', 'boost'])
  return { ...common(q, what, false), queries: children(q, 'conjuncts', what) }
}

/**
 * A disjunction, which a boolean query's `should` and `must_not` also are.
 * The minimum is sent only when the caller set one. Like the Search service,
 * the gateway reads an unset minimum as zero, which leaves a boolean query's
 * `should` optional when it also has a `must`.
 */
function disjunction(q: Json, what: string): QueryPb['disjunction_query'] {
  onlyMembers(q, what, ['disjuncts', 'min', 'boost'])
  return defined({
    ...common(q, what, false),
    queries: children(q, 'disjuncts', what),
    minimum: uint(q, 'min', what, UINT32_MAX),
  })
}

/**
 * A boolean query's clause, which must be the kind of query `key` names.
 */
function clause<T>(
  q: Json,
  key: string,
  kind: string,
  build: (q: Json, what: string) => T
): T | undefined {
  const value = q[key]
  if (value === undefined || value === null) {
    return undefined
  }
  if (!isObject(value) || !(kind in value)) {
    throw invalid(`A boolean query's ${key} must be a ${kind} query.`)
  }
  return build(value, `A boolean query's ${key}`)
}

/**
 * Builds the gateway's query from a query's JSON, given what to call it in
 * an error.
 */
type QueryBuilder = (q: Json, what: string) => QueryPb

/**
 * A boolean query, which the Search service knows by any one of its
 * clauses.
 */
const booleanQuery: QueryBuilder = (q, what) => {
  onlyMembers(q, what, ['must', 'should', 'must_not', 'boost'])
  return {
    boolean_query: defined({
      ...common(q, what, false),
      must: clause(q, 'must', 'conjuncts', conjunction),
      should: clause(q, 'should', 'disjuncts', disjunction),
      must_not: clause(q, 'must_not', 'disjuncts', disjunction),
    }),
  }
}

/**
 * A numeric range, or a term range when a bound is a string.
 */
const rangeQuery: QueryBuilder = (q) =>
  typeof q.min === 'string' || typeof q.max === 'string'
    ? { term_range_query: range(q, 'A term range query', str) }
    : { numeric_range_query: range(q, 'A numeric range query', float32) }

/**
 * Each kind of query, by the member that identifies it. A disjunction
 * carries a `min`, so it is tried before a range.
 */
const QUERIES: readonly [string, string, QueryBuilder][] = [
  ['must', 'A boolean query', booleanQuery],
  ['should', 'A boolean query', booleanQuery],
  ['must_not', 'A boolean query', booleanQuery],
  [
    'conjuncts',
    'A conjunction query',
    (q, what) => ({ conjunction_query: conjunction(q, what) }),
  ],
  [
    'disjuncts',
    'A disjunction query',
    (q, what) => ({ disjunction_query: disjunction(q, what) }),
  ],
  [
    'terms',
    'A phrase query',
    (q, what) => {
      onlyMembers(q, what, ['terms', 'field', 'boost'])
      return {
        phrase_query: { ...common(q, what), terms: strings(q, 'terms', what) },
      }
    },
  ],
  [
    'term',
    'A term query',
    (q, what) => {
      onlyMembers(q, what, [
        'term',
        'field',
        'fuzziness',
        'prefix_length',
        'boost',
      ])
      return {
        term_query: defined({
          ...common(q, what),
          term: str(q, 'term', what),
          fuzziness: uint(q, 'fuzziness', what),
          prefix_length: uint(q, 'prefix_length', what),
        }),
      }
    },
  ],
  [
    'match',
    'A match query',
    (q, what) => {
      onlyMembers(q, what, [
        'match',
        'field',
        'analyzer',
        'fuzziness',
        'prefix_length',
        'operator',
        'boost',
      ])
      const operator = str(q, 'operator', what)
      if (operator !== undefined && operator !== 'or' && operator !== 'and') {
        throw invalid(`${operator} is not a valid match operator.`)
      }
      return {
        match_query: defined({
          ...common(q, what),
          value: str(q, 'match', what),
          analyzer: str(q, 'analyzer', what),
          fuzziness: uint(q, 'fuzziness', what),
          prefix_length: uint(q, 'prefix_length', what),
          operator:
            operator === undefined
              ? undefined
              : operator === 'and'
                ? ('OPERATOR_AND' as const)
                : ('OPERATOR_OR' as const),
        }),
      }
    },
  ],
  [
    'match_phrase',
    'A match phrase query',
    (q, what) => {
      onlyMembers(q, what, ['match_phrase', 'field', 'analyzer', 'boost'])
      return {
        match_phrase_query: defined({
          ...common(q, what),
          phrase: str(q, 'match_phrase', what),
          analyzer: str(q, 'analyzer', what),
        }),
      }
    },
  ],
  [
    'prefix',
    'A prefix query',
    (q, what) => {
      onlyMembers(q, what, ['prefix', 'field', 'boost'])
      return {
        prefix_query: { ...common(q, what), prefix: str(q, 'prefix', what) },
      }
    },
  ],
  [
    'regexp',
    'A regexp query',
    (q, what) => {
      onlyMembers(q, what, ['regexp', 'field', 'boost'])
      return {
        regexp_query: { ...common(q, what), regexp: str(q, 'regexp', what) },
      }
    },
  ],
  [
    'query',
    'A query string query',
    (q, what) => {
      onlyMembers(q, what, ['query', 'boost'])
      return {
        query_string_query: {
          ...common(q, what, false),
          query_string: str(q, 'query', what),
        },
      }
    },
  ],
  ['min', 'A range query', rangeQuery],
  ['max', 'A range query', rangeQuery],
  [
    'start',
    'A date range query',
    (q, what) => ({ date_range_query: dateRange(q, what) }),
  ],
  [
    'end',
    'A date range query',
    (q, what) => ({ date_range_query: dateRange(q, what) }),
  ],
  [
    'wildcard',
    'A wildcard query',
    (q, what) => {
      onlyMembers(q, what, ['wildcard', 'field', 'boost'])
      return {
        wildcard_query: {
          ...common(q, what),
          wildcard: str(q, 'wildcard', what),
        },
      }
    },
  ],
  [
    'ids',
    'A document ID query',
    (q, what) => {
      // The Search service reads no field for a document ID query, so one
      // set on it changes nothing and is not sent.
      onlyMembers(q, what, ['ids', 'field', 'boost'])
      return {
        doc_id_query: {
          ...common(q, what, false),
          ids: strings(q, 'ids', what),
        },
      }
    },
  ],
  [
    'bool',
    'A boolean field query',
    (q, what) => {
      onlyMembers(q, what, ['bool', 'field', 'boost'])
      return {
        boolean_field_query: {
          ...common(q, what),
          value: bool(q, 'bool', what),
        },
      }
    },
  ],
  [
    'location',
    'A geo distance query',
    (q, what) => {
      onlyMembers(q, what, ['location', 'distance', 'field', 'boost'])
      return {
        geo_distance_query: {
          ...common(q, what),
          center: latLng(q.location, what),
          distance: str(q, 'distance', what),
        },
      }
    },
  ],
  [
    'top_left',
    'A geo bounding box query',
    (q, what) => {
      onlyMembers(q, what, ['top_left', 'bottom_right', 'field', 'boost'])
      return {
        geo_bounding_box_query: {
          ...common(q, what),
          top_left: latLng(q.top_left, what),
          bottom_right: latLng(q.bottom_right, what),
        },
      }
    },
  ],
  [
    'polygon_points',
    'A geo polygon query',
    (q, what) => {
      onlyMembers(q, what, ['polygon_points', 'field', 'boost'])
      if (!Array.isArray(q.polygon_points)) {
        throw invalid(`Expected ${what}'s polygon_points to be a list.`)
      }
      return {
        geo_polygon_query: {
          ...common(q, what),
          vertices: q.polygon_points.map((p) => latLng(p, what)),
        },
      }
    },
  ],
  [
    'match_all',
    'A match all query',
    (q, what) => {
      onlyMembers(q, what, ['match_all'])
      return { match_all_query: {} }
    },
  ],
  [
    'match_none',
    'A match none query',
    (q, what) => {
      onlyMembers(q, what, ['match_none'])
      return { match_none_query: {} }
    },
  ],
]

/**
 * A query, from the JSON a classic connection sends, as the gateway's.
 *
 * @internal
 */
export function queryToProto(query: unknown): QueryPb {
  if (isObject(query)) {
    const kind = QUERIES.find(([key]) => key in query)
    if (kind) {
      const [, what, build] = kind
      return build(query, what)
    }
  }
  throw unavailable(
    `The search query ${JSON.stringify(query)}`,
    'the gateway takes no query of this kind'
  )
}

/**
 * A sort, from a string or the JSON of a `SearchSort`, as the gateway's. A
 * string names a field, `_id` or `_score`, descending after a `-`.
 *
 * @internal
 */
export function sortToProto(sort: unknown): SortingPb {
  if (typeof sort === 'string') {
    const descending = sort.startsWith('-')
    const name = descending ? sort.slice(1) : sort
    if (name === '_score') {
      return { score_sorting: { descending } }
    }
    if (name === '_id') {
      return { id_sorting: { descending } }
    }
    return { field_sorting: { field: name, descending } }
  }
  if (!isObject(sort)) {
    throw invalid(`Expected a sort to be a string or a SearchSort.`)
  }
  const descending = bool(sort, 'desc', 'A sort') ?? false
  switch (sort.by) {
    case 'score':
      onlyMembers(sort, 'A score sort', ['by', 'desc'])
      return { score_sorting: { descending } }
    case 'id':
      onlyMembers(sort, 'An ID sort', ['by', 'desc'])
      return { id_sorting: { descending } }
    case 'field': {
      const what = 'A field sort'
      if (sort.mode !== undefined) {
        throw unavailable(
          `${what}'s mode`,
          'the gateway answers a sort with a mode with an error'
        )
      }
      onlyMembers(sort, what, ['by', 'field', 'desc', 'type', 'missing'])
      return {
        field_sorting: defined({
          field: str(sort, 'field', what),
          descending,
          type: str(sort, 'type', what),
          missing: str(sort, 'missing', what),
        }),
      }
    }
    case 'geo_distance': {
      const what = 'A geo distance sort'
      onlyMembers(sort, what, ['by', 'field', 'location', 'unit', 'desc'])
      return {
        geo_distance_sorting: defined({
          field: str(sort, 'field', what),
          descending,
          center: latLng(sort.location, what),
          unit: str(sort, 'unit', what),
        }),
      }
    }
    default:
      throw unavailable(
        `A sort by ${JSON.stringify(sort.by)}`,
        'the gateway takes no sort of this kind'
      )
  }
}

/**
 * The named ranges of a numeric or date facet.
 */
function facetRanges(facet: Json, key: string, what: string): Json[] {
  const value = facet[key]
  if (!Array.isArray(value) || !value.every(isObject)) {
    throw invalid(`Expected ${what}'s ${key} to be a list of ranges.`)
  }
  return value
}

/**
 * A facet, from the JSON of a `SearchFacet`, as the gateway's.
 *
 * @internal
 */
export function facetToProto(facet: unknown): FacetPb {
  if (!isObject(facet)) {
    throw invalid('Expected a facet to be a SearchFacet.')
  }
  if ('numeric_ranges' in facet) {
    const what = 'A numeric facet'
    onlyMembers(facet, what, ['field', 'size', 'numeric_ranges'])
    return {
      numeric_range_facet: {
        field: str(facet, 'field', what),
        size: uint(facet, 'size', what, UINT32_MAX) ?? 0,
        numeric_ranges: facetRanges(facet, 'numeric_ranges', what).map((r) => {
          onlyMembers(r, `${what}'s range`, ['name', 'min', 'max'])
          return defined({
            name: str(r, 'name', what),
            min: float32(r, 'min', `${what}'s range`),
            max: float32(r, 'max', `${what}'s range`),
          })
        }),
      },
    }
  }
  if ('date_ranges' in facet) {
    const what = 'A date facet'
    onlyMembers(facet, what, ['field', 'size', 'date_ranges'])
    return {
      date_range_facet: {
        field: str(facet, 'field', what),
        size: uint(facet, 'size', what, UINT32_MAX) ?? 0,
        date_ranges: facetRanges(facet, 'date_ranges', what).map((r) => {
          onlyMembers(r, `${what}'s range`, ['name', 'start', 'end'])
          return defined({
            name: str(r, 'name', what),
            start: str(r, 'start', what),
            end: str(r, 'end', what),
          })
        }),
      },
    }
  }
  const what = 'A term facet'
  onlyMembers(facet, what, ['field', 'size'])
  return {
    term_facet: {
      field: str(facet, 'field', what),
      size: uint(facet, 'size', what, UINT32_MAX) ?? 0,
    },
  }
}

/**
 * `value` as the JSON a classic connection sends for it.
 */
function toJson(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

/**
 * Whether `state` holds any mutation token.
 */
function hasTokens(state: MutationState | undefined): boolean {
  return (
    !!state &&
    Object.values(state._data).some(
      (vbuckets) => Object.keys(vbuckets).length > 0
    )
  )
}

/**
 * Warns that `name` is set but not sent, as the gateway has no field for it.
 */
function warnNotSent(name: string, reason: string): void {
  process.emitWarning(
    `couchbase2 does not send the search option ${name}: ${reason}.`,
    'CouchbaseWarning'
  )
}

/**
 * Whether to disable scoring, from the deprecated `disableScoring` or a
 * `scoring` mode of none. Score fusion merges vector results, which the
 * gateway cannot search for.
 */
function disableScoringToProto(options: SearchQueryOptions): boolean {
  if (options.disableScoring && options.scoring !== undefined) {
    throw invalid(
      'Cannot specify both disableScoring and scoring, use scoring alone.'
    )
  }
  if (options.scoring === undefined) {
    return options.disableScoring || false
  }
  if (SearchScoring.modeOf(options.scoring) !== 'none') {
    throw unavailable(
      'Score fusion',
      'it merges vector results, and the gateway cannot search for vectors'
    )
  }
  return true
}

/**
 * The gateway's highlight style for `style`.
 */
function highlightStyleToProto(
  style: HighlightStyle | undefined
): SearchQueryRequestPb['highlight_style'] {
  switch (style) {
    case undefined:
      return undefined
    case HighlightStyle.HTML:
      return 'HIGHLIGHT_STYLE_HTML'
    case HighlightStyle.ANSI:
      return 'HIGHLIGHT_STYLE_ANSI'
    default:
      throw invalid(`${style} is not a valid highlight style.`)
  }
}

/**
 * A search's request, with what reading its answer needs to know of it.
 *
 * @internal
 */
export interface EncodedSearch {
  /**
   * The request the gateway is sent.
   */
  message: SearchQueryRequestPb

  /**
   * Whether the request asked for highlighting, so that a hit keeps its
   * fragments.
   */
  fragments: boolean

  /**
   * Whether the request asked for highlighting or locations, so that a hit
   * keeps its locations.
   */
  locations: boolean

  /**
   * Each facet's JSON, by name, which its ranges' bounds are read back from.
   */
  facets: { [name: string]: Json }
}

/**
 * A search's request. The gateway ignores a search's bucket and scope, so
 * a scope's index is sent by its full name, `bucket.scope.index`.
 *
 * @internal
 */
export function searchRequestToProto(
  indexName: string,
  request: SearchQuery | SearchRequest,
  options: SearchQueryOptions,
  scope?: KeyspaceScope
): EncodedSearch {
  const query = request instanceof SearchRequest ? request.searchQuery : request
  if (request instanceof SearchRequest && request.vectorSearch) {
    throw unavailable(
      'Vector search',
      'the gateway answers a search with vector queries with an error'
    )
  }
  if (hasTokens(options.consistentWith)) {
    throw unavailable(
      'consistentWith',
      "the gateway's search request carries no mutation state"
    )
  }
  if (
    options.consistency !== undefined &&
    options.consistency !== SearchScanConsistency.NotBounded
  ) {
    throw invalid(
      `${options.consistency} is not a valid search scan consistency.`
    )
  }
  if (options.raw && Object.keys(options.raw).length > 0) {
    warnNotSent('raw', 'the gateway takes no extra search parameters')
  }
  for (const name of ['showRequest', 'logRequest', 'logResponse'] as const) {
    if (options[name]) {
      warnNotSent(name, 'the gateway writes the request the service reads')
    }
  }

  const message: SearchQueryRequestPb = {
    index_name: scope
      ? `${scope.bucketName}.${scope.scopeName}.${indexName}`
      : indexName,
    query: queryToProto(toJson(query)),
    scan_consistency: 'SCAN_CONSISTENCY_NOT_BOUNDED',
    include_explanation: options.explain || false,
    include_locations: options.includeLocations || false,
    disable_scoring: disableScoringToProto(options),
    fields: options.fields ?? [],
    collections: options.collections ?? [],
    highlight_fields: options.highlight?.fields ?? [],
  }
  if (options.limit !== undefined) {
    message.limit = count('limit', options.limit, UINT32_MAX)
    if (message.limit === 0) {
      throw unavailable('A limit of 0', 'the gateway reads it as no limit')
    }
  }
  if (options.skip !== undefined) {
    message.skip = count('skip', options.skip, UINT32_MAX)
  }
  const style = highlightStyleToProto(options.highlight?.style)
  if (style !== undefined) {
    message.highlight_style = style
  }
  if (options.sort) {
    message.sort = (options.sort as unknown[]).map((s) =>
      sortToProto(toJson(s))
    )
  }

  const facets: { [name: string]: Json } = {}
  message.facets = {}
  for (const [name, facet] of Object.entries(options.facets ?? {})) {
    if (facet !== undefined) {
      const json = toJson(facet)
      message.facets[name] = facetToProto(json)
      facets[name] = json as Json
    }
  }

  const fragments =
    style !== undefined || (message.highlight_fields ?? []).length > 0
  return {
    message,
    fragments,
    locations: fragments || !!message.include_locations,
    facets,
  }
}

/**
 * A term's location in a hit, as a classic connection reports one.
 */
function locationFromProto(location: LocationPb): any {
  const out: any = {
    field: location.field,
    term: location.term,
    position: location.position,
    start_offset: location.start,
    end_offset: location.end,
  }
  if (location.array_positions.length > 0) {
    out.array_positions = location.array_positions
  }
  return out
}

/**
 * A hit, as classic reports one. The gateway sends each stored field as
 * its own JSON, merged here into one object. It highlights every search, so
 * fragments and locations are kept only when the request asked for them.
 *
 * @internal
 */
export function searchRowFromProto(hit: HitPb, encoded: EncodedSearch): any {
  const fields = Object.entries(hit.fields)
  return {
    index: hit.index,
    id: hit.id,
    score: hit.score,
    locations: encoded.locations ? hit.locations.map(locationFromProto) : [],
    fragments: encoded.fragments
      ? Object.fromEntries(
          Object.entries(hit.fragments).map(([name, f]) => [name, f.content])
        )
      : {},
    fields:
      fields.length > 0
        ? Object.fromEntries(
            fields.map(([name, value]) => [
              name,
              JSON.parse(value.toString('utf8')),
            ])
          )
        : undefined,
    explanation:
      hit.explanation.length > 0
        ? JSON.parse(hit.explanation.toString('utf8'))
        : undefined,
  }
}

/**
 * The ranges a facet asked for, by name.
 */
function requestedRanges(
  facet: Json | undefined,
  key: string
): Map<unknown, Json> {
  const ranges = facet?.[key]
  return new Map(
    Array.isArray(ranges) ? ranges.filter(isObject).map((r) => [r.name, r]) : []
  )
}

/**
 * A facet's result, as classic reports one. The gateway sends numeric bounds
 * as integers and date bounds as timestamps, so each range's bounds are
 * taken from the request, as the Search service would echo them.
 *
 * @internal
 */
export function searchFacetFromProto(
  name: string,
  result: FacetResultPb,
  requested: Json | undefined
): any {
  const out = (
    facet: { field: string; total: string; missing: string; other: string },
    lists: object
  ) => ({
    name,
    field: facet.field,
    total: Number(facet.total),
    missing: Number(facet.missing),
    other: Number(facet.other),
    terms: [],
    date_ranges: [],
    numeric_ranges: [],
    ...lists,
  })
  if (result.term_facet) {
    const facet = result.term_facet
    return out(facet, {
      terms: facet.terms.map((t) => ({ term: t.name, count: Number(t.size) })),
    })
  }
  if (result.numeric_range_facet) {
    const facet = result.numeric_range_facet
    const sent = requestedRanges(requested, 'numeric_ranges')
    return out(facet, {
      numeric_ranges: facet.numeric_ranges.map((r) => ({
        name: r.name,
        count: Number(r.size),
        min: sent.get(r.name)?.min,
        max: sent.get(r.name)?.max,
      })),
    })
  }
  const facet = result.date_range_facet
  if (!facet) {
    return out({ field: '', total: '0', missing: '0', other: '0' }, {})
  }
  const sent = requestedRanges(requested, 'date_ranges')
  return out(facet, {
    date_ranges: facet.date_ranges.map((r) => ({
      name: r.name,
      count: Number(r.size),
      start: sent.get(r.name)?.start,
      end: sent.get(r.name)?.end,
    })),
  })
}

/**
 * A search's metadata and facets, as classic reports them. The gateway
 * carries no client context ID.
 *
 * @internal
 */
export function searchMetaDataFromProto(
  meta: MetaDataPb | undefined,
  facets: { [name: string]: FacetResultPb },
  encoded: EncodedSearch
): SearchMetaData {
  const metrics = meta?.metrics
  return {
    facets: Object.fromEntries(
      Object.entries(facets).map(([name, result]) => [
        name,
        searchFacetFromProto(name, result, encoded.facets[name]),
      ])
    ),
    client_context_id: '',
    metrics: {
      took: durationFromProto(metrics?.execution_time ?? null),
      total_rows: Number(metrics?.total_rows ?? 0),
      max_score: metrics?.max_score ?? 0,
      success_partition_count: Number(metrics?.success_partition_count ?? 0),
      error_partition_count: Number(metrics?.error_partition_count ?? 0),
    },
    errors: meta?.errors ?? {},
  } as SearchMetaData
}

/**
 * What a search needs from the backend.
 *
 * @internal
 */
export interface Couchbase2SearchChannel {
  /**
   * The metadata every call carries.
   */
  readonly metadata: grpc.Metadata

  /**
   * The streams open on the channel, canceled when it closes.
   */
  readonly streams: OpenStreams

  /**
   * The timeout of a search that does not set its own, in milliseconds.
   */
  readonly searchTimeout: number

  /**
   * A new request's context, traced under `obs` when it is given.
   */
  context(
    op: Couchbase2Op,
    timeoutMs: number,
    obs?: ObservableRequestHandler | null
  ): RequestContext
}

/**
 * The emitter a search's rows, metadata and failure are reported through.
 */
type SearchEmitter = StreamableRowPromise<
  SearchResult,
  SearchRow,
  SearchMetaData
>

/**
 * Searches over the gateway's `SearchService`.
 *
 * @internal
 */
export class Couchbase2Search implements SearchBackend {
  private readonly _channel: Couchbase2SearchChannel
  private readonly _client: SearchServiceClient

  constructor(channel: Couchbase2SearchChannel, client: SearchServiceClient) {
    this._channel = channel
    this._client = client
  }

  /**
   * Sends the search and emits its hits as each message arrives. A request
   * that cannot be built fails on a later tick, so the caller can attach
   * listeners first. `obs` ends with the stream.
   */
  search(
    indexName: string,
    request: SearchQuery | SearchRequest,
    options: SearchQueryOptions,
    scope?: KeyspaceScope,
    obs?: ObservableRequestHandler | null
  ): SearchEmitter {
    const emitter = new StreamableRowPromise<
      SearchResult,
      SearchRow,
      SearchMetaData
    >((rows, meta) => new SearchResult({ rows, meta }))

    let encoded: EncodedSearch
    try {
      encoded = searchRequestToProto(indexName, request, options, scope)
    } catch (err) {
      process.nextTick(() => {
        obs?.endWithError(err)
        endWithError(emitter, err)
      })
      return emitter
    }

    const ctx = this._channel.context(
      SEARCH,
      options.timeout || this._channel.searchTimeout,
      obs
    )
    void this._stream(emitter, ctx, encoded, obs)
    return emitter
  }

  /**
   * Reads the stream one message at a time and emits each message's hits
   * before reading the next. The gateway may send facets and metadata in
   * any message, so they are gathered and emitted once the stream ends.
   */
  private async _stream(
    emitter: SearchEmitter,
    ctx: RequestContext,
    encoded: EncodedSearch,
    obs: ObservableRequestHandler | null | undefined
  ): Promise<void> {
    let meta: MetaDataPb | undefined
    const facets: { [name: string]: FacetResultPb } = {}
    let result: SearchMetaData
    try {
      const responses = retryStream<SearchQueryResponsePb>(
        ctx,
        (options) =>
          this._client.SearchQuery(
            encoded.message,
            this._channel.metadata,
            options
          ),
        { streams: this._channel.streams }
      )
      for await (const resp of responses) {
        for (const hit of resp.hits) {
          emitter.emit('row', searchRowFromProto(hit, encoded))
        }
        Object.assign(facets, resp.facets)
        if (resp.meta_data) {
          meta = resp.meta_data
        }
      }
      result = searchMetaDataFromProto(meta, facets, encoded)
    } catch (err) {
      obs?.endWithError(err)
      endWithError(emitter, err)
      return
    }

    obs?.end()
    rethrowListenerErrors(() => {
      emitter.emit('meta', result)
      emitter.emit('end')
    })
  }
}
