/* eslint jsdoc/require-jsdoc: off */
import {
  errorFromCpp,
  mutationStateToCpp,
  searchHighlightStyleToCpp,
  searchScanConsistencyToCpp,
} from './bindingutilities'
import { Cluster } from './cluster'
import { SearchQuery } from './searchquery'
import { SearchSort } from './searchsort'
import {
  SearchMetaData,
  SearchQueryOptions,
  SearchResult,
  SearchRow,
} from './searchtypes'
import { StreamableRowPromise } from './streamablepromises'

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
    query: SearchQuery,
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

    const timeout = options.timeout || this._cluster.searchTimeout

    this._cluster.conn.search(
      {
        timeout,
        index_name: indexName,
        query: JSON.stringify(query),
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
        mutation_state: mutationStateToCpp(options.consistentWith),
        sort_specs: options.sort
          ? options.sort.map((sort: string | SearchSort) =>
              JSON.stringify(sort)
            )
          : [],
        facets: options.facets
          ? Object.fromEntries(
              Object.entries(options.facets).map(([k, v]) => [
                k,
                JSON.stringify(v),
              ])
            )
          : {},
        raw: options.raw
          ? Object.fromEntries(
              Object.entries(options.raw).map(([k, v]) => [
                k,
                JSON.stringify(v),
              ])
            )
          : {},
        body_str: '',
      },
      (cppErr, resp) => {
        const err = errorFromCpp(cppErr)
        if (err) {
          emitter.emit('error', err)
          emitter.emit('end')
          return
        }

        resp.rows.forEach((row) => {
          emitter.emit('row', row)
        })

        {
          const metaData = resp.meta
          emitter.emit('meta', {
            facets: Object.fromEntries(Object.values(resp.facets).map((v) => [v.name, v])),
            ...metaData
          } as SearchMetaData)
        }

        emitter.emit('end')
        return
      }
    )

    return emitter
  }
}
