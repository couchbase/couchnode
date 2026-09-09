import { InvalidArgumentError } from './errors'
import { MutationState } from './mutationstate'
import { SearchFacet } from './searchfacet'
import { SearchQuery } from './searchquery'
import { SearchSort } from './searchsort'
import { VectorSearch } from './vectorsearch'
import { RequestSpan } from './tracing'

/**
 * SearchMetaData represents the meta-data available from a search query.
 * This class is currently incomplete and must be casted to `any` in
 * TypeScript to be used.
 *
 * @category Full Text Search
 */
export class SearchMetaData {}

/**
 * SearchRow represents the data available from a row of a search query.
 * This class is currently incomplete and must be casted to `any` in
 * TypeScript to be used.
 *
 * @category Full Text Search
 */
export class SearchRow {}

/**
 * Contains the results of a search query.
 *
 * @category Full Text Search
 */
export class SearchResult {
  /**
   * The rows which have been returned by the query.
   */
  rows: any[]

  /**
   * The meta-data which has been returned by the query.
   */
  meta: SearchMetaData

  /**
   * @internal
   */
  constructor(data: SearchResult) {
    this.rows = data.rows
    this.meta = data.meta
  }
}

/**
 * Specifies the highlight style that should be used for matches in the results.
 *
 * @category Full Text Search
 */
export enum HighlightStyle {
  /**
   * Indicates that matches should be highlighted using HTML tags in the result text.
   */
  HTML = 'html',

  /**
   * Indicates that matches should be highlighted using ASCII coding in the result test.
   */
  ANSI = 'ansi',
}

/**
 * Represents the various scan consistency options that are available when
 * querying against the query service.
 *
 * @category Full Text Search
 */
export enum SearchScanConsistency {
  /**
   * Indicates that no specific consistency is required, this is the fastest
   * options, but results may not include the most recent operations which have
   * been performed.
   */
  NotBounded = 'not_bounded',
}

/**
 * The discriminator identifying which {@link SearchScoring} implementation is in use.
 *
 * @category Full Text Search
 */
export type SearchScoringMode = 'none' | 'rrf' | 'rsf'

/**
 * Base class for the scoring mode of a search query.
 *
 * Score fusion controls how the FTS and vector result sets of a hybrid request are merged into a
 * single ranked list. It is only meaningful for a hybrid request (both an FTS query and a vector
 * search); when applied to a single result set the server re-scores the hits but leaves their
 * ordering unchanged.
 *
 * @see SearchScoringNone
 * @see SearchScoringReciprocalRankFusion
 * @see SearchScoringRelativeScoreFusion
 * @experimental Uncommitted: This API is subject to change in the future.
 * @category Full Text Search
 */
export abstract class SearchScoring {
  /**
   * @internal
   */
  protected abstract readonly _mode: SearchScoringMode

  /**
   * Returns the {@link SearchScoringMode} of a {@link SearchScoring} instance.
   *
   * @internal
   */
  static modeOf(scoring: SearchScoring): SearchScoringMode {
    return scoring._mode
  }

  /**
   * Creates a {@link SearchScoringNone}.
   */
  static none(): SearchScoringNone {
    return new SearchScoringNone()
  }

  /**
   * Creates a {@link SearchScoringReciprocalRankFusion}.
   */
  static reciprocalRankFusion(options?: {
    rankConstant?: number
    windowSize?: number
  }): SearchScoringReciprocalRankFusion {
    return new SearchScoringReciprocalRankFusion(options)
  }

  /**
   * Creates a {@link SearchScoringRelativeScoreFusion}.
   */
  static relativeScoreFusion(options?: {
    windowSize?: number
  }): SearchScoringRelativeScoreFusion {
    return new SearchScoringRelativeScoreFusion(options)
  }
}

/**
 * Disables scoring, so that the server does not perform any scoring on the hits.
 *
 * This sends the same `"none"` that the deprecated {@link SearchQueryOptions.disableScoring} sends. It
 * is not a fusion strategy: `"none"` predates score fusion, so it works on older server versions.
 *
 * @experimental Uncommitted: This API is subject to change in the future.
 * @category Full Text Search
 */
export class SearchScoringNone extends SearchScoring {
  /**
   * @internal
   */
  protected readonly _mode: SearchScoringMode = 'none'
}

/**
 * Merges the FTS and vector result sets by rank rather than by raw score.
 *
 * It works well with the server defaults, and is the recommended strategy.
 *
 * Available from Couchbase Server 8.5. Setting it makes the SDK check for the score fusion
 * cluster capability, and fail the operation if the cluster does not advertise it.
 *
 * @experimental Uncommitted: This API is subject to change in the future.
 * @category Full Text Search
 */
export class SearchScoringReciprocalRankFusion extends SearchScoring {
  /**
   * @internal
   */
  protected readonly _mode: SearchScoringMode = 'rrf'

  /**
   * The rank constant of the Reciprocal Rank Fusion formula.
   */
  rankConstant?: number

  /**
   * How many results per list are considered for fusion.
   */
  windowSize?: number

  constructor(options?: { rankConstant?: number; windowSize?: number }) {
    super()
    this.rankConstant = options?.rankConstant
    this.windowSize = options?.windowSize
  }
}

/**
 * Merges the FTS and vector result sets by normalized score rather than by rank.
 *
 * Available from Couchbase Server 8.5. Setting it makes the SDK check for the score fusion
 * cluster capability, and fail the operation if the cluster does not advertise it.
 *
 * @experimental Uncommitted: This API is subject to change in the future.
 * @category Full Text Search
 */
export class SearchScoringRelativeScoreFusion extends SearchScoring {
  /**
   * @internal
   */
  protected readonly _mode: SearchScoringMode = 'rsf'

  /**
   * How many results per list are considered for fusion.
   */
  windowSize?: number

  constructor(options?: { windowSize?: number }) {
    super()
    this.windowSize = options?.windowSize
  }
}

/**
 * @category Full Text Search
 */
export interface SearchQueryOptions {
  /**
   * Specifies the number of results to skip from the index before returning
   * results.
   */
  skip?: number

  /**
   * Specifies the limit to the number of results that should be returned.
   */
  limit?: number

  /**
   * Configures whether the result should contain the execution plan for the query.
   */
  explain?: boolean

  /**
   * Specifies how the highlighting should behave.  Specifically which mode should be
   * used for highlighting as well as which fields should be highlighted.
   */
  highlight?: {
    style?: HighlightStyle
    fields?: string[]
  }

  /**
   * Specifies the collections which should be searched as part of the query.
   */
  collections?: string[]

  /**
   * Specifies the list of fields which should be searched.
   */
  fields?: string[]

  /**
   * Specifies any facets that should be included in the query.
   */
  facets?: { [name: string]: SearchFacet }

  /**
   * Specifies a list of fields or SearchSort's to use when sorting the result sets.
   */
  sort?: string[] | SearchSort[]

  /**
   * Specifies that scoring should be disabled.  This improves performance but makes it
   * impossible to sort based on how well a particular result scored.
   *
   * Deprecated in favor of {@link SearchQueryOptions.scoring} with a {@link SearchScoringNone},
   * which sends the same thing. Cannot be used together with `scoring`.
   *
   * @deprecated Use {@link SearchQueryOptions.scoring} instead.
   */
  disableScoring?: boolean

  /**
   * Specifies the scoring mode for the query, including the score fusion strategy used to merge
   * the FTS and vector result sets of a hybrid request. Cannot be used together with the
   * deprecated `disableScoring`.
   *
   * @see SearchScoringNone
   * @see SearchScoringReciprocalRankFusion
   * @see SearchScoringRelativeScoreFusion
   * @experimental This API is subject to change without notice.
   */
  scoring?: SearchScoring

  /**
   * If set to true, will include the locations in the search result.
   *
   * @experimental This API is subject to change without notice.
   */
  includeLocations?: boolean

  /**
   * Specifies the consistency requirements when executing the query.
   *
   * @see SearchScanConsistency
   */
  consistency?: SearchScanConsistency

  /**
   * Specifies a MutationState which the query should be consistent with.
   *
   * @see {@link MutationState}
   */
  consistentWith?: MutationState

  /**
   * Specifies any additional parameters which should be passed to the query engine
   * when executing the query.
   */
  raw?: { [key: string]: any }

  /**
   * The timeout for this operation, represented in milliseconds.
   */
  timeout?: number

  /**
   * Specifies that the search response should include the request JSON.
   */
  showRequest?: boolean

  /**
   * Uncommitted: This API is subject to change in the future.
   * Specifies that the search request should appear in the log.
   */
  logRequest?: boolean

  /**
   * Uncommitted: This API is subject to change in the future.
   * Specifies that the search response should appear in the log.
   */
  logResponse?: boolean

  /**
   * Specifies the parent span for this specific operation.
   */
  parentSpan?: RequestSpan
}

/**
 *  Represents a search query and/or vector search to execute via the Couchbase Full Text Search (FTS) service.
 *
 * @category Full Text Search
 */
export class SearchRequest {
  private _searchQuery: SearchQuery | undefined
  private _vectorSearch: VectorSearch | undefined

  constructor(query: SearchQuery | VectorSearch) {
    if (query instanceof SearchQuery) {
      this._searchQuery = query
    } else if (query instanceof VectorSearch) {
      this._vectorSearch = query
    } else {
      throw new InvalidArgumentError(
        new Error(
          'Must provide either a SearchQuery or VectorSearch when creating SearchRequest.'
        )
      )
    }
  }

  /**
   * @internal
   */
  get searchQuery(): SearchQuery | undefined {
    return this._searchQuery
  }

  /**
   * @internal
   */
  get vectorSearch(): VectorSearch | undefined {
    return this._vectorSearch
  }

  /**
   * Adds a search query to the request if the request does not already have a search query.
   *
   * @param query A SearchQuery to add to the request.
   */
  withSearchQuery(query: SearchQuery): SearchRequest {
    if (!(query instanceof SearchQuery)) {
      throw new InvalidArgumentError(new Error('Must provide a SearchQuery.'))
    }
    if (this._searchQuery) {
      throw new InvalidArgumentError(
        new Error('Request already has a SearchQuery.')
      )
    }
    this._searchQuery = query
    return this
  }

  /**
   * Adds a vector search to the request if the request does not already have a vector search.
   *
   * @param search A VectorSearch to add to the request.
   */
  withVectorSearch(search: VectorSearch): SearchRequest {
    if (!(search instanceof VectorSearch)) {
      throw new InvalidArgumentError(new Error('Must provide a VectorSearch.'))
    }
    if (this._vectorSearch) {
      throw new InvalidArgumentError(
        new Error('Request already has a VectorSearch.')
      )
    }
    this._vectorSearch = search
    return this
  }

  /**
   * Creates a search request.
   *
   * @param query Either a SearchQuery or VectorSearch to add to the search request.
   */
  static create(query: SearchQuery | VectorSearch): SearchRequest {
    return new SearchRequest(query)
  }
}
