/* eslint jsdoc/require-jsdoc: off */

/**
 * GeoPoint represents a specific coordinate on earth.  We support
 * a number of different variants of geopoints being specified.
 *
 * @category Full Text Search
 */
export type GeoPoint =
  | [longitude: number, latitude: number]
  | { lon: number; lat: number }
  | { longitude: number; latitude: number }

function _parseGeoPoint(v: GeoPoint): [number, number] {
  if (Array.isArray(v)) {
    return v
  } else if (v instanceof Object) {
    const latLonObj = v as any
    if (latLonObj.lon || latLonObj.lat) {
      return [latLonObj.lon, latLonObj.lat]
    } else if (latLonObj.longitude || latLonObj.latitude) {
      return [latLonObj.longitude, latLonObj.latitude]
    }
  }

  throw new Error('invalid geopoint specified')
}

/**
 * @internal
 */
function _unpackListArgs<T>(args: T[] | T[][]): T[] {
  if (Array.isArray(args[0])) {
    return (args[0] as any) as T[]
  }
  return (args as any) as T[]
}

/**
 * Provides the ability to specify the query for a search query.
 *
 * @category Full Text Search
 */
export class SearchQuery {
  protected _data: any

  constructor(data: any) {
    if (!data) {
      data = {}
    }

    this._data = data
  }

  toJSON(): any {
    return this._data
  }

  /**
   * @internal
   */
  static toJSON(query: SearchQuery | any): any {
    if (query.toJSON) {
      return query.toJSON()
    }
    return query
  }

  /**
   * @internal
   */
  static hasProp(query: SearchQuery | any, prop: string): boolean {
    const json = this.toJSON(query)
    return json[prop] !== undefined
  }

  static match(match: string): MatchSearchQuery {
    return new MatchSearchQuery(match)
  }

  static matchPhrase(phrase: string): MatchPhraseSearchQuery {
    return new MatchPhraseSearchQuery(phrase)
  }

  static regexp(regexp: string): RegexpSearchQuery {
    return new RegexpSearchQuery(regexp)
  }

  static queryString(query: string): QueryStringSearchQuery {
    return new QueryStringSearchQuery(query)
  }

  static numericRange(): NumericRangeSearchQuery {
    return new NumericRangeSearchQuery()
  }

  static dateRange(): DateRangeSearchQuery {
    return new DateRangeSearchQuery()
  }

  /**
   * Creates a ConjunctionSearchQuery from a set of other SearchQuery's.
   *
   * @deprecated Use the multi-argument overload instead.
   */
  static conjuncts(queries: SearchQuery[]): ConjunctionSearchQuery

  /**
   * Creates a ConjunctionSearchQuery from a set of other SearchQuery's.
   */
  static conjuncts(...queries: SearchQuery[]): ConjunctionSearchQuery

  /**
   * @internal
   */
  static conjuncts(
    ...args: SearchQuery[] | SearchQuery[][]
  ): ConjunctionSearchQuery {
    const queries = _unpackListArgs(args)
    return new ConjunctionSearchQuery(...queries)
  }

  /**
   * Creates a DisjunctionSearchQuery from a set of other SearchQuery's.
   *
   * @deprecated Use the multi-argument overload instead.
   */
  static disjuncts(queries: SearchQuery[]): DisjunctionSearchQuery

  /**
   * Creates a DisjunctionSearchQuery from a set of other SearchQuery's.
   */
  static disjuncts(...queries: SearchQuery[]): DisjunctionSearchQuery

  /**
   * @internal
   */
  static disjuncts(
    ...args: SearchQuery[] | SearchQuery[][]
  ): DisjunctionSearchQuery {
    const queries = _unpackListArgs(args)
    return new DisjunctionSearchQuery(...queries)
  }

  static boolean(): BooleanSearchQuery {
    return new BooleanSearchQuery()
  }

  static wildcard(wildcard: string): WildcardSearchQuery {
    return new WildcardSearchQuery(wildcard)
  }

  /**
   * Creates a DocIdSearchQuery from a set of document-ids.
   *
   * @deprecated Use the multi-argument overload instead.
   */
  static docIds(queries: string[]): DocIdSearchQuery

  /**
   * Creates a DocIdSearchQuery from a set of document-ids.
   */
  static docIds(...queries: string[]): DocIdSearchQuery

  /**
   * @internal
   */
  static docIds(...args: string[] | string[][]): DocIdSearchQuery {
    const queries = _unpackListArgs(args)
    return new DocIdSearchQuery(...queries)
  }

  static booleanField(val: boolean): BooleanFieldSearchQuery {
    return new BooleanFieldSearchQuery(val)
  }

  static term(term: string): TermSearchQuery {
    return new TermSearchQuery(term)
  }

  static phrase(terms: string[]): PhraseSearchQuery {
    return new PhraseSearchQuery(terms)
  }

  static prefix(prefix: string): PrefixSearchQuery {
    return new PrefixSearchQuery(prefix)
  }

  static matchAll(): MatchAllSearchQuery {
    return new MatchAllSearchQuery()
  }

  static matchNone(): MatchNoneSearchQuery {
    return new MatchNoneSearchQuery()
  }

  static geoDistance(
    lon: number,
    lat: number,
    distance: number
  ): GeoDistanceSearchQuery {
    return new GeoDistanceSearchQuery(lon, lat, distance)
  }

  static geoBoundingBox(
    tl_lon: number,
    tl_lat: number,
    br_lon: number,
    br_lat: number
  ): GeoBoundingBoxSearchQuery {
    return new GeoBoundingBoxSearchQuery(tl_lon, tl_lat, br_lon, br_lat)
  }

  static geoPolygon(points: GeoPoint[]): GeoPolygonSearchQuery {
    return new GeoPolygonSearchQuery(points)
  }
}

/**
 * Represents a match search query.
 *
 * @category Full Text Search
 */
export class MatchSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor(match: string) {
    super({
      match: match,
    })
  }

  field(field: string): MatchSearchQuery {
    this._data.field = field
    return this
  }

  analyzer(analyzer: string): MatchSearchQuery {
    this._data.analyzer = analyzer
    return this
  }

  prefixLength(prefixLength: number): MatchSearchQuery {
    this._data.prefix_length = prefixLength
    return this
  }

  fuzziness(fuzziness: number): MatchSearchQuery {
    this._data.fuzziness = fuzziness
    return this
  }

  boost(boost: number): MatchSearchQuery {
    this._data.boost = boost
    return this
  }
}

/**
 * Represents a match-phrase search query.
 *
 * @category Full Text Search
 */
export class MatchPhraseSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor(phrase: string) {
    super({
      match_phrase: phrase,
    })
  }

  field(field: string): MatchPhraseSearchQuery {
    this._data.field = field
    return this
  }

  analyzer(analyzer: string): MatchPhraseSearchQuery {
    this._data.analyzer = analyzer
    return this
  }

  boost(boost: number): MatchPhraseSearchQuery {
    this._data.boost = boost
    return this
  }
}

/**
 * Represents a regexp search query.
 *
 * @category Full Text Search
 */
export class RegexpSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor(regexp: string) {
    super({
      regexp: regexp,
    })
  }

  field(field: string): RegexpSearchQuery {
    this._data.field = field
    return this
  }

  boost(boost: number): RegexpSearchQuery {
    this._data.boost = boost
    return this
  }
}

/**
 * Represents a query-string search query.
 *
 * @category Full Text Search
 */
export class QueryStringSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor(query: string) {
    super({
      query: query,
    })
  }

  boost(boost: number): QueryStringSearchQuery {
    this._data.boost = boost
    return this
  }
}

/**
 * Represents a numeric-range search query.
 *
 * @category Full Text Search
 */
export class NumericRangeSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor() {
    super({})
  }

  min(min: number, inclusive?: boolean): NumericRangeSearchQuery {
    if (inclusive === undefined) {
      inclusive = true
    }

    this._data.min = min
    this._data.inclusive_min = inclusive
    return this
  }

  max(max: number, inclusive?: boolean): NumericRangeSearchQuery {
    if (inclusive === undefined) {
      inclusive = false
    }

    this._data.max = max
    this._data.inclusive_max = inclusive
    return this
  }

  field(field: string): NumericRangeSearchQuery {
    this._data.field = field
    return this
  }

  boost(boost: number): NumericRangeSearchQuery {
    this._data.boost = boost
    return this
  }
}

/**
 * Represents a date-range search query.
 *
 * @category Full Text Search
 */
export class DateRangeSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor() {
    super({})
  }

  start(start: Date | string, inclusive?: boolean): DateRangeSearchQuery {
    if (inclusive === undefined) {
      inclusive = true
    }

    if (start instanceof Date) {
      this._data.start = start.toISOString()
    } else {
      this._data.start = start
    }

    this._data.inclusive_start = inclusive
    return this
  }

  end(end: Date | string, inclusive?: boolean): DateRangeSearchQuery {
    if (inclusive === undefined) {
      inclusive = false
    }

    if (end instanceof Date) {
      this._data.end = end.toISOString()
    } else {
      this._data.end = end
    }

    this._data.inclusive_end = inclusive
    return this
  }

  field(field: string): DateRangeSearchQuery {
    this._data.field = field
    return this
  }

  dateTimeParser(parser: string): DateRangeSearchQuery {
    this._data.datetime_parser = parser
    return this
  }

  boost(boost: number): DateRangeSearchQuery {
    this._data.boost = boost
    return this
  }
}

/**
 * Represents a conjunction search query.
 *
 * @category Full Text Search
 */
export class ConjunctionSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor(...queries: SearchQuery[]) {
    super({
      conjuncts: [],
    })

    this.and(...queries)
  }

  /**
   * Adds additional queries to this conjunction query.
   *
   * @deprecated Use the multi-argument overload instead.
   */
  and(queries: SearchQuery[]): ConjunctionSearchQuery

  /**
   * Adds additional queries to this conjunction query.
   */
  and(...queries: SearchQuery[]): ConjunctionSearchQuery

  /**
   * @internal
   */
  and(...args: SearchQuery[] | SearchQuery[][]): ConjunctionSearchQuery {
    const queries = _unpackListArgs(args)

    for (let i = 0; i < queries.length; ++i) {
      this._data.conjuncts.push(queries[i])
    }
    return this
  }

  boost(boost: number): ConjunctionSearchQuery {
    this._data.boost = boost
    return this
  }
}

/**
 * Represents a disjunction search query.
 *
 * @category Full Text Search
 */
export class DisjunctionSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor(...queries: SearchQuery[]) {
    super({
      disjuncts: [],
    })

    this.or(...queries)
  }

  /**
   * Adds additional queries to this disjunction query.
   *
   * @deprecated Use the multi-argument overload instead.
   */
  or(queries: SearchQuery[]): DisjunctionSearchQuery

  /**
   * Adds additional queries to this disjunction query.
   */
  or(...queries: SearchQuery[]): DisjunctionSearchQuery

  /**
   * @internal
   */
  or(...args: SearchQuery[] | SearchQuery[][]): DisjunctionSearchQuery {
    const queries = _unpackListArgs(args)

    for (let i = 0; i < queries.length; ++i) {
      this._data.disjuncts.push(queries[i])
    }
    return this
  }

  boost(boost: number): DisjunctionSearchQuery {
    this._data.boost = boost
    return this
  }
}

/**
 * Represents a boolean search query.
 *
 * @category Full Text Search
 */
export class BooleanSearchQuery extends SearchQuery {
  private _shouldMin: number | undefined

  /**
   * @internal
   */
  constructor() {
    super({})
    this._shouldMin = undefined
  }

  must(query: ConjunctionSearchQuery): BooleanSearchQuery {
    if (!SearchQuery.hasProp(query, 'conjuncts')) {
      query = new ConjunctionSearchQuery(query)
    }

    this._data.must = query
    return this
  }

  should(query: DisjunctionSearchQuery): BooleanSearchQuery {
    if (!SearchQuery.hasProp(query, 'disjuncts')) {
      query = new DisjunctionSearchQuery(query)
    }
    this._data.should = query
    return this
  }

  mustNot(query: DisjunctionSearchQuery): BooleanSearchQuery {
    if (!SearchQuery.hasProp(query, 'disjuncts')) {
      query = new DisjunctionSearchQuery(query)
    }
    this._data.must_not = query
    return this
  }

  shouldMin(shouldMin: number): BooleanSearchQuery {
    this._shouldMin = shouldMin
    return this
  }

  boost(boost: number): BooleanSearchQuery {
    this._data.boost = boost
    return this
  }

  toJSON(): any {
    const out: any = {}
    if (this._data.must) {
      out.must = SearchQuery.toJSON(this._data.must)
    }
    if (this._data.should) {
      out.should = SearchQuery.toJSON(this._data.should)

      if (this._shouldMin) {
        out.should.min = this._shouldMin
      }
    }
    if (this._data.must_not) {
      out.must_not = SearchQuery.toJSON(this._data.must_not)
    }
    return out
  }
}

/**
 * Represents a wildcard search query.
 *
 * @category Full Text Search
 */
export class WildcardSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor(wildcard: string) {
    super({
      wildcard: wildcard,
    })
  }

  field(field: string): WildcardSearchQuery {
    this._data.field = field
    return this
  }

  boost(boost: number): WildcardSearchQuery {
    this._data.boost = boost
    return this
  }
}

/**
 * Represents a document-id search query.
 *
 * @category Full Text Search
 */
export class DocIdSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor(...ids: string[]) {
    super({
      ids: [],
    })

    this.addDocIds(...ids)
  }

  /**
   * Adds additional document-id's to this query.
   *
   * @deprecated Use the multi-argument overload instead.
   */
  addDocIds(ids: string[]): DocIdSearchQuery

  /**
   * Adds additional document-id's to this query.
   */
  addDocIds(...ids: string[]): DocIdSearchQuery

  /**
   * @internal
   */
  addDocIds(...args: string[] | string[][]): DocIdSearchQuery {
    const ids = _unpackListArgs(args)

    for (let i = 0; i < ids.length; ++i) {
      this._data.ids.push(ids[i])
    }
    return this
  }

  field(field: string): DocIdSearchQuery {
    this._data.field = field
    return this
  }

  boost(boost: number): DocIdSearchQuery {
    this._data.boost = boost
    return this
  }
}

/**
 * Represents a boolean-field search query.
 *
 * @category Full Text Search
 */
export class BooleanFieldSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor(val: boolean) {
    super({
      bool: val,
    })
  }

  field(field: string): BooleanFieldSearchQuery {
    this._data.field = field
    return this
  }

  boost(boost: number): BooleanFieldSearchQuery {
    this._data.boost = boost
    return this
  }
}

/**
 * Represents a term search query.
 *
 * @category Full Text Search
 */
export class TermSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor(term: string) {
    super({
      term: term,
    })
  }

  field(field: string): TermSearchQuery {
    this._data.field = field
    return this
  }

  prefixLength(prefixLength: number): TermSearchQuery {
    this._data.prefix_length = prefixLength
    return this
  }

  fuzziness(fuzziness: number): TermSearchQuery {
    this._data.fuzziness = fuzziness
    return this
  }

  boost(boost: number): TermSearchQuery {
    this._data.boost = boost
    return this
  }
}

/**
 * Represents a phrase search query.
 *
 * @category Full Text Search
 */
export class PhraseSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor(terms: string[]) {
    super({
      terms: terms,
    })
  }

  field(field: string): PhraseSearchQuery {
    this._data.field = field
    return this
  }

  boost(boost: number): PhraseSearchQuery {
    this._data.boost = boost
    return this
  }
}

/**
 * Represents a prefix search query.
 *
 * @category Full Text Search
 */
export class PrefixSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor(prefix: string) {
    super({
      prefix: prefix,
    })
  }

  field(field: string): PrefixSearchQuery {
    this._data.field = field
    return this
  }

  boost(boost: number): PrefixSearchQuery {
    this._data.boost = boost
    return this
  }
}

/**
 * Represents a match-all search query.
 *
 * @category Full Text Search
 */
export class MatchAllSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor() {
    super({
      match_all: null,
    })
  }
}

/**
 * Represents a match-none search query.
 *
 * @category Full Text Search
 */
export class MatchNoneSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor() {
    super({
      match_none: true,
    })
  }
}

/**
 * Represents a geo-distance search query.
 *
 * @category Full Text Search
 */
export class GeoDistanceSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor(lon: number, lat: number, distance: number) {
    super({
      location: [lon, lat],
      distance: distance,
    })
  }

  field(field: string): GeoDistanceSearchQuery {
    this._data.field = field
    return this
  }

  boost(boost: number): GeoDistanceSearchQuery {
    this._data.boost = boost
    return this
  }
}

/**
 * Represents a geo-bounding-box search query.
 *
 * @category Full Text Search
 */
export class GeoBoundingBoxSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor(tl_lon: number, tl_lat: number, br_lon: number, br_lat: number) {
    super({
      top_left: [tl_lon, tl_lat],
      bottom_right: [br_lon, br_lat],
    })
  }

  field(field: string): GeoBoundingBoxSearchQuery {
    this._data.field = field
    return this
  }

  boost(boost: number): GeoBoundingBoxSearchQuery {
    this._data.boost = boost
    return this
  }
}

/**
 * Represents a geo-polygon search query.
 *
 * @category Full Text Search
 */
export class GeoPolygonSearchQuery extends SearchQuery {
  /**
   * @internal
   */
  constructor(points: GeoPoint[]) {
    const mappedPoints = points.map((v) => _parseGeoPoint(v))
    super({
      polygon_points: mappedPoints,
    })
  }

  field(field: string): GeoPolygonSearchQuery {
    this._data.field = field
    return this
  }

  boost(boost: number): GeoPolygonSearchQuery {
    this._data.boost = boost
    return this
  }
}
