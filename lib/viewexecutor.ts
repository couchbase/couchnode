/* eslint jsdoc/require-jsdoc: off */
import {
  designDocumentNamespaceToCpp,
  errorFromCpp,
  viewOrderingToCpp,
  viewScanConsistencyToCpp,
} from './bindingutilities'
import { Bucket } from './bucket'
import { Cluster } from './cluster'
import { StreamableRowPromise } from './streamablepromises'
import {
  DesignDocumentNamespace,
  ViewMetaData,
  ViewQueryOptions,
  ViewResult,
  ViewRow,
} from './viewtypes'

/**
 * @internal
 */
export class ViewExecutor {
  private _bucket: Bucket

  /**
   * @internal
   */
  constructor(bucket: Bucket) {
    this._bucket = bucket
  }

  /**
  @internal
  */
  get _cluster(): Cluster {
    return this._bucket.cluster
  }

  /**
   * @internal
   */
  query<TValue = any, TKey = any>(
    designDoc: string,
    viewName: string,
    options: ViewQueryOptions
  ): StreamableRowPromise<
    ViewResult<TValue, TKey>,
    ViewRow<TValue, TKey>,
    ViewMetaData
  > {
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

    const timeout = options.timeout || this._cluster.viewTimeout
    const raw = options.raw || {}
    const ns = options.namespace ?? DesignDocumentNamespace.Production
    let fullSet = options.full_set
    if (typeof options.fullSet !== 'undefined') {
      fullSet = options.fullSet
    }

    this._cluster.conn.documentView(
      {
        timeout: timeout,
        bucket_name: this._bucket.name,
        document_name: designDoc,
        view_name: viewName,
        ns: designDocumentNamespaceToCpp(ns),
        limit: options.limit,
        skip: options.skip,
        consistency: viewScanConsistencyToCpp(options.scanConsistency),
        keys: options.keys ? options.keys.map((k) => JSON.stringify(k)) : [],
        key: JSON.stringify(options.key),
        start_key:
          options.range && options.range.start
            ? JSON.stringify(options.range.start)
            : undefined,
        end_key:
          options.range && options.range.end
            ? JSON.stringify(options.range.end)
            : undefined,
        inclusive_end: options.range ? options.range.inclusiveEnd : undefined,
        start_key_doc_id:
          options.idRange && options.idRange.start
            ? options.idRange.start
            : undefined,
        end_key_doc_id:
          options.idRange && options.idRange.end
            ? options.idRange.end
            : undefined,
        reduce: options.reduce,
        group: options.group,
        group_level: options.groupLevel,
        order: viewOrderingToCpp(options.order),
        debug: false,
        query_string: [],
        raw: raw,
        full_set: fullSet,
      },
      (cppErr, resp) => {
        const err = errorFromCpp(cppErr)
        if (err) {
          emitter.emit('error', err)
          emitter.emit('end')
          return
        }

        resp.rows.forEach((row) => {
          emitter.emit(
            'row',
            new ViewRow<TValue, TKey>({
              value: JSON.parse(row.value),
              id: row.id,
              key: JSON.parse(row.key),
            })
          )
        })

        {
          const metaData = resp.meta

          const meta = new ViewMetaData({
            totalRows: metaData.total_rows,
            debug: metaData.debug_info,
          })

          emitter.emit('meta', meta)
        }

        emitter.emit('end')
        return
      }
    )

    return emitter
  }
}
