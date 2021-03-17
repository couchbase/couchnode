/* eslint jsdoc/require-jsdoc: off */
import { CppViewQueryFlags } from './binding'
import binding from './binding'
import { Connection } from './connection'
import { StreamableRowPromise } from './streamablepromises'
import { cbQsStringify } from './utilities'
import {
  ViewMetaData,
  ViewQueryOptions,
  ViewResult,
  ViewRow,
} from './viewtypes'

/**
 * @internal
 */
export class ViewExecutor {
  private _conn: Connection

  /**
   * @internal
   */
  constructor(conn: Connection) {
    this._conn = conn
  }

  query<TValue = any, TKey = any>(
    designDoc: string,
    viewName: string,
    options: ViewQueryOptions
  ): StreamableRowPromise<
    ViewResult<TValue, TKey>,
    ViewRow<TValue, TKey>,
    ViewMetaData
  > {
    // BUG(JSCBC-727): Due to an oversight, the 3.0.0 release of the SDK incorrectly
    // specified various options using underscores rather than camelCase as the
    // rest of our API does.  We accept the deprecated versions as well as the standard
    // versions below.

    // BUG(JSCBC-822): We inadvertently created the enumeration for view ordering incorrectly
    // when it was first introduced, we perform some compatibility handling to support this.

    const queryOpts: any = {}
    const queryFlags: CppViewQueryFlags = 0

    if (options.stale !== undefined) {
      queryOpts.stale = options.stale
    }
    if (options.scanConsistency !== undefined) {
      queryOpts.stale = options.scanConsistency
    }
    if (options.skip !== undefined) {
      queryOpts.skip = options.skip
    }
    if (options.limit !== undefined) {
      queryOpts.limit = options.limit
    }
    if (options.order !== undefined) {
      if (typeof options.order === 'string') {
        queryOpts.descending = options.order
      } else {
        if ((options.order as any) > 0) {
          queryOpts.descending = false
        } else if ((options.order as any) < 0) {
          queryOpts.descending = true
        }
      }
    }
    if (options.reduce !== undefined) {
      queryOpts.reduce = options.reduce
    }
    if (options.group !== undefined) {
      queryOpts.group = options.group
    }
    if (options.group_level) {
      queryOpts.group_level = options.group_level
    }
    if (options.groupLevel !== undefined) {
      queryOpts.group_level = options.groupLevel
    }
    if (options.key !== undefined) {
      queryOpts.key = JSON.stringify(options.key)
    }
    if (options.keys !== undefined) {
      queryOpts.keys = JSON.stringify(options.keys)
    }
    if (options.full_set !== undefined) {
      queryOpts.full_set = options.full_set
    }
    if (options.fullSet !== undefined) {
      queryOpts.full_set = options.fullSet
    }
    if (options.on_error !== undefined) {
      queryOpts.on_error = options.on_error
    }
    if (options.onError !== undefined) {
      queryOpts.on_error = options.onError
    }
    if (options.range !== undefined) {
      if (options.range.inclusive_end !== undefined) {
        queryOpts.inclusive_end = JSON.stringify(options.range.inclusive_end)
      }

      queryOpts.startkey = JSON.stringify(options.range.start)
      queryOpts.endkey = JSON.stringify(options.range.end)
      queryOpts.inclusive_end = JSON.stringify(options.range.inclusiveEnd)
    }
    if (options.id_range !== undefined) {
      queryOpts.startkey_docid = options.id_range.start
      queryOpts.endkey_docid = options.id_range.end
    }
    if (options.idRange !== undefined) {
      queryOpts.startkey_docid = options.idRange.start
      queryOpts.endkey_docid = options.idRange.end
    }

    const queryData = cbQsStringify(queryOpts)
    const cppTimeout = options.timeout ? options.timeout * 1000 : undefined

    const emitter = new StreamableRowPromise<
      ViewResult<TValue, TKey>,
      ViewRow<TValue, TKey>,
      ViewMetaData
    >((rows, meta) => {
      return new ViewResult<TValue, TKey>({
        rows: rows,
        meta: meta,
      })
    })

    this._conn.viewQuery(
      designDoc,
      viewName,
      queryData,
      undefined,
      queryFlags,
      cppTimeout,
      (err, flags, data, docId, key) => {
        if (!(flags & binding.LCBX_RESP_F_NONFINAL)) {
          if (err) {
            emitter.emit('error', err)
            emitter.emit('end')
            return
          }

          const metaInfo = JSON.parse(data)
          const meta = new ViewMetaData({
            totalRows: metaInfo.total_rows,
            debug: metaInfo.debug || undefined,
          })
          emitter.emit('meta', meta)
          emitter.emit('end')

          return
        }

        if (err) {
          emitter.emit('error', err)
          return
        }

        const row = new ViewRow<TValue, TKey>({
          value: JSON.parse(data),
          id: docId ? docId.toString() : undefined,
          key: key ? JSON.parse(key) : undefined,
        })
        emitter.emit('row', row)
      }
    )

    return emitter
  }
}
