/* eslint jsdoc/require-jsdoc: off */
import {
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

    this._cluster.conn.searchQuery(
      {
        timeout,
        index_name: indexName,
        query: query,
        limit: options.limit,
        skip: options.skip,
        explain: options.explain,
        disable_scoring: options.disableScoring,
        include_locations: options.includeLocations,
        highlight_style: options.highlight
          ? searchHighlightStyleToCpp(options.highlight.style)
          : undefined,
        highlight_fields: options.highlight
          ? options.highlight.fields
          : undefined,
        fields: options.fields,
        collections: options.collections,
        scan_consistency: searchScanConsistencyToCpp(options.consistency),
        mutation_state: mutationStateToCpp(options.consistentWith),
        sort_specs: options.sort
          ? options.sort.map((sort: string | SearchSort) =>
              JSON.stringify(sort)
            )
          : undefined,
        facets: options.facets
          ? Object.fromEntries(
              Object.entries(options.facets).map(([k, v]) => [
                k,
                JSON.stringify(v),
              ])
            )
          : undefined,
        raw: options.raw
          ? Object.fromEntries(
              Object.entries(options.raw).map(([k, v]) => [
                k,
                JSON.stringify(v),
              ])
            )
          : undefined,
      },
      (err, resp) => {
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
          emitter.emit('meta', metaData)
        }

        emitter.emit('end')
        return
      }
    )

    return emitter
  }
}
