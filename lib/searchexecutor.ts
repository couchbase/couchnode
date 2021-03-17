/* eslint jsdoc/require-jsdoc: off */
import { CppSearchQueryFlags } from './binding'
import binding from './binding'
import { Connection } from './connection'
import { SearchQuery } from './searchquery'
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
  private _conn: Connection

  /**
   * @internal
   */
  constructor(conn: Connection) {
    this._conn = conn
  }

  query(
    indexName: string,
    query: SearchQuery,
    options: SearchQueryOptions
  ): StreamableRowPromise<SearchResult, SearchRow, SearchMetaData> {
    const queryObj: any = {}
    const queryObjCtl: any = {}
    const queryFlags: CppSearchQueryFlags = 0

    queryObj.indexName = indexName
    queryObj.query = query

    if (options.skip !== undefined) {
      queryObj.from = options.skip
    }
    if (options.limit !== undefined) {
      queryObj.size = options.limit
    }
    if (options.explain) {
      queryObj.explain = !!options.explain
    }
    if (options.highlight) {
      queryObj.highlight = options.highlight
    }
    if (options.fields) {
      queryObj.fields = options.fields
    }
    if (options.facets) {
      queryObj.facets = options.facets
    }
    if (options.sort) {
      queryObj.sort = options.sort
    }
    if (options.disableScoring) {
      queryObj.score = 'none'
    }
    if (options.consistency) {
      queryObjCtl.consistency = {
        level: options.consistency,
      }
    }
    if (options.consistentWith) {
      if (queryObjCtl.consistency) {
        throw new Error(
          'cannot specify consistency and consistentWith together'
        )
      }

      queryObjCtl.consistency = {
        level: 'at_plus',
        vectors: options.consistentWith.toJSON(),
      }
    }
    if (options.timeout) {
      queryObjCtl.timeout = options.timeout
    }

    // Only inject the `ctl` component if there are ctl's.
    if (Object.keys(queryObjCtl).length > 0) {
      queryObj.ctl = queryObjCtl
    }

    const queryData = JSON.stringify(queryObj)
    const cppTimeout = options.timeout ? options.timeout * 1000 : undefined

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

    this._conn.searchQuery(
      queryData,
      queryFlags,
      cppTimeout,
      (err, flags, data) => {
        if (!(flags & binding.LCBX_RESP_F_NONFINAL)) {
          if (err) {
            emitter.emit('error', err)
            emitter.emit('end')
            return
          }

          const meta = JSON.parse(data)
          emitter.emit('meta', meta)
          emitter.emit('end')

          return
        }

        if (err) {
          emitter.emit('error', err)
          return
        }

        const row = JSON.parse(data)
        emitter.emit('row', row)
      }
    )

    return emitter
  }
}
