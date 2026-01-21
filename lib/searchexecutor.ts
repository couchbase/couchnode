/* eslint jsdoc/require-jsdoc: off */
import {
  mutationStateToCpp,
  searchHighlightStyleToCpp,
  searchScanConsistencyToCpp,
  vectorQueryCombinationToCpp,
} from './bindingutilities'
import { Cluster } from './cluster'
import { wrapObservableBindingCall } from './observability'
import { ObservableRequestHandler } from './observabilityhandler'
import { ObservabilityInstruments, StreamingOp } from './observabilitytypes'
import { MatchNoneSearchQuery, SearchQuery } from './searchquery'
import { SearchSort } from './searchsort'
import {
  SearchMetaData,
  SearchQueryOptions,
  SearchRequest,
  SearchResult,
  SearchRow,
} from './searchtypes'
import { StreamableRowPromise } from './streamablepromises'
import { CppSearchRequest, CppSearchResponse } from './binding'
import { PromiseHelper } from './utilities'

/**
 * @internal
 */
export class SearchExecutor {
  private _cluster: Cluster
  private _bucketName: string | undefined
  private _scopeName: string | undefined

  /**
   * @internal
   */
  constructor(cluster: Cluster, bucketName?: string, scopeName?: string) {
    this._cluster = cluster
    this._bucketName = bucketName
    this._scopeName = scopeName
  }

  /**
   * @internal
   */
  get observabilityInstruments(): ObservabilityInstruments {
    return this._cluster.observabilityInstruments
  }

  /**
   * @internal
   */
  static _processSearchResponse(
    emitter: StreamableRowPromise<SearchResult, SearchRow, SearchMetaData>,
    err: Error | null,
    resp: CppSearchResponse,
    obsReqHandler?: ObservableRequestHandler
  ): void {
    if (err) {
      obsReqHandler?.endWithError(err)
      emitter.emit('error', err)
      emitter.emit('end')
      return
    }

    resp.rows.forEach((row) => {
      row.fields = row.fields ? JSON.parse(row.fields) : undefined
      row.explanation = row.explanation
        ? JSON.parse(row.explanation)
        : undefined
      emitter.emit('row', row)
    })

    {
      const metaData = resp.meta
      emitter.emit('meta', {
        facets: Object.fromEntries(
          Object.values(resp.facets).map((v) => [v.name, v])
        ),
        ...metaData,
      } as SearchMetaData)
    }

    obsReqHandler?.end()
    emitter.emit('end')
  }

  /**
   * @internal
   */
  static executePromise(
    searchPromise: Promise<[Error | null, CppSearchResponse]>,
    obsReqHandler: ObservableRequestHandler
  ): StreamableRowPromise<SearchResult, SearchRow, SearchMetaData> {
    const emitter = new StreamableRowPromise<
      SearchResult,
      SearchRow,
      SearchMetaData
    >((rows, meta) => {
      return new SearchResult({
        rows: rows,
        meta: meta,
      })
    })

    PromiseHelper.wrapAsync(async () => {
      const [err, resp] = await searchPromise
      SearchExecutor._processSearchResponse(emitter, err, resp, obsReqHandler)
    })

    return emitter
  }

  /**
   * @internal
   */
  query(
    indexName: string,
    query: SearchQuery | SearchRequest,
    options: SearchQueryOptions
  ): StreamableRowPromise<SearchResult, SearchRow, SearchMetaData> {
    const obsReqHandler = new ObservableRequestHandler(
      StreamingOp.Search,
      this.observabilityInstruments,
      options?.parentSpan
    )

    obsReqHandler.setRequestHttpAttributes({
      bucketName: this._bucketName,
      scopeName: this._scopeName,
    })

    const searchQuery =
      query instanceof SearchQuery
        ? JSON.stringify(query)
        : query.searchQuery
          ? JSON.stringify(query.searchQuery)
          : JSON.stringify(new MatchNoneSearchQuery())
    const timeout = options.timeout || this._cluster.searchTimeout
    const request: CppSearchRequest = {
      timeout,
      index_name: indexName,
      query: searchQuery,
      limit: options.limit,
      skip: options.skip,
      explain: options.explain || false,
      disable_scoring: options.disableScoring || false,
      include_locations: options.includeLocations || false,
      highlight_style: options.highlight
        ? searchHighlightStyleToCpp(options.highlight.style)
        : undefined,
      highlight_fields:
        options.highlight && options.highlight.fields
          ? options.highlight.fields
          : [],
      fields: options.fields || [],
      collections: options.collections || [],
      scan_consistency: searchScanConsistencyToCpp(options.consistency),
      mutation_state: mutationStateToCpp(options.consistentWith).tokens,
      sort_specs: options.sort
        ? options.sort.map((sort: string | SearchSort) => JSON.stringify(sort))
        : [],
      facets: options.facets
        ? Object.fromEntries(
            Object.entries(options.facets)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => [k, JSON.stringify(v)])
          )
        : {},
      raw: options.raw
        ? Object.fromEntries(
            Object.entries(options.raw)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => [k, JSON.stringify(v)])
          )
        : {},
      body_str: '',
      show_request: options.showRequest || false,
      log_request: options.logRequest || false,
      log_response: options.logResponse || false,
    }

    if (query instanceof SearchRequest) {
      if (query.vectorSearch) {
        request.vector_search = JSON.stringify(query.vectorSearch.queries)
        if (
          query.vectorSearch.options &&
          query.vectorSearch.options.vectorQueryCombination
        ) {
          request.vector_query_combination = vectorQueryCombinationToCpp(
            query.vectorSearch.options.vectorQueryCombination
          )
        }
      }
    }

    if (this._bucketName && this._scopeName) {
      request.bucket_name = this._bucketName
      request.scope_name = this._scopeName
    }

    return SearchExecutor.executePromise(
      wrapObservableBindingCall(
        this._cluster.conn.search.bind(this._cluster.conn),
        request,
        obsReqHandler
      ),
      obsReqHandler
    )
  }
}
