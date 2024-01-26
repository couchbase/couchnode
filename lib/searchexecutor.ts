/* eslint jsdoc/require-jsdoc: off */
import {
  errorFromCpp,
  mutationStateToCpp,
  searchHighlightStyleToCpp,
  searchScanConsistencyToCpp,
  vectorQueryCombinationToCpp,
} from './bindingutilities'
import { Cluster } from './cluster'
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
import { CppSearchRequest } from './binding'

/**
 * @internal
 */
export class SearchExecutor {
  private _cluster: Cluster

  /**
   * @internal
   */
  constructor(cluster: Cluster) {
    this._cluster = cluster
  }

  /**
   * @internal
   */
  query(
    indexName: string,
    query: SearchQuery | SearchRequest,
    options: SearchQueryOptions
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
    }

    if (query instanceof SearchRequest) {
      request.show_request = false
      if (query.vectorSearch) {
        request.vector_search = JSON.stringify(query.vectorSearch.queries)
        if (query.vectorSearch.options && query.vectorSearch.options.vectorQueryCombination) {
          request.vector_query_combination = vectorQueryCombinationToCpp(
            query.vectorSearch.options.vectorQueryCombination
          )
        }
      }
    }

    this._cluster.conn.search(request, (cppErr, resp) => {
      const err = errorFromCpp(cppErr)
      if (err) {
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

      emitter.emit('end')
      return
    })

    return emitter
  }
}
