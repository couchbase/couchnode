/* eslint jsdoc/require-jsdoc: off */
import {
  designDocumentNamespaceToCpp,
  viewOrderingToCpp,
  viewScanConsistencyToCpp,
} from './bindingutilities'
import { CppDocumentViewResponse } from './binding'
import { Bucket } from './bucket'
import { Cluster } from './cluster'
import { wrapObservableBindingCall } from './observability'
import { ObservableRequestHandler } from './observabilityhandler'
import { ObservabilityInstruments, StreamingOp } from './observabilitytypes'
import { StreamableRowPromise } from './streamablepromises'
import { PromiseHelper } from './utilities'
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
  get observabilityInstruments(): ObservabilityInstruments {
    return this._cluster.observabilityInstruments
  }

  /**
   * @internal
   */
  static _processViewResponse<TValue = any, TKey = any>(
    emitter: StreamableRowPromise<
      ViewResult<TValue, TKey>,
      ViewRow<TValue, TKey>,
      ViewMetaData
    >,
    err: Error | null,
    resp: CppDocumentViewResponse,
    obsReqHandler?: ObservableRequestHandler
  ): void {
    if (err) {
      obsReqHandler?.endWithError(err)
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

    obsReqHandler?.end()
    emitter.emit('end')
  }

  /**
   * @internal
   */
  static executePromise<TValue = any, TKey = any>(
    viewPromise: Promise<[Error | null, CppDocumentViewResponse]>,
    obsReqHandler: ObservableRequestHandler
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

    PromiseHelper.wrapAsync(async () => {
      const [err, resp] = await viewPromise
      ViewExecutor._processViewResponse(emitter, err, resp, obsReqHandler)
    })

    return emitter
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
    const obsReqHandler = new ObservableRequestHandler(
      StreamingOp.View,
      this.observabilityInstruments,
      options?.parentSpan
    )

    obsReqHandler.setRequestHttpAttributes({ bucketName: this._bucket.name })

    const timeout = options.timeout || this._cluster.viewTimeout
    const raw = options.raw || {}
    const ns = options.namespace ?? DesignDocumentNamespace.Production
    let fullSet = options.full_set
    if (typeof options.fullSet !== 'undefined') {
      fullSet = options.fullSet
    }

    return ViewExecutor.executePromise(
      wrapObservableBindingCall(
        this._cluster.conn.documentView.bind(this._cluster.conn),
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
        obsReqHandler
      ),
      obsReqHandler
    )
  }
}
