import {
  CppError,
  CppQueryRequest,
  CppQueryResponse,
  CppQueryResponseQueryMetaData,
  CppQueryStreamIterator,
} from './binding'
import {
  errorFromCpp,
  mutationStateToCpp,
  queryProfileToCpp,
  queryScanConsistencyToCpp,
} from './bindingutilities'
import { Cluster } from './cluster'
import { RequestCanceledError } from './errors'
import { wrapObservableBindingCall } from './observability'
import { ObservableRequestHandler } from './observabilityhandler'
import { ObservabilityInstruments, StreamingOp } from './observabilitytypes'
import {
  QueryMetaData,
  QueryMetrics,
  QueryOptions,
  QueryResult,
  QueryStatus,
  QueryWarning,
} from './querytypes'
import { StreamableRowPromise } from './streamablepromises'

/**
 * @internal
 *
 * Tracks a live native query stream so that the cluster can cancel it and
 * wait for it to settle before tearing the connection down.  Once close() has
 * started, nothing may post new work to the io context, so every stream must
 * deliver a terminal result before the connection is shut down.
 */
export class OpenQueryStream {
  /**
   * @internal
   */
  readonly iterator: CppQueryStreamIterator

  /**
   * @internal
   *
   * Resolves once the stream has delivered a terminal result.
   */
  readonly ended: Promise<void>

  private _cluster: Cluster
  private _finished: boolean
  private _resolveEnded!: () => void

  /**
   * @internal
   */
  constructor(cluster: Cluster, iterator: CppQueryStreamIterator) {
    this._cluster = cluster
    this.iterator = iterator
    this._finished = false
    this.ended = new Promise((resolve) => {
      this._resolveEnded = resolve
    })
    this._cluster.openQueryStreams.add(this)
  }

  /**
   * @internal
   */
  get closing(): boolean {
    return this._cluster.closing
  }

  /**
   * @internal
   */
  cancel(): void {
    this.iterator.cancel()
  }

  /**
   * @internal
   */
  finish(): void {
    if (this._finished) {
      return
    }
    this._finished = true
    this._cluster.openQueryStreams.delete(this)
    this._resolveEnded()
  }
}

/**
 * @internal
 */
export class QueryExecutor {
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
  get observabilityInstruments(): ObservabilityInstruments {
    return this._cluster.observabilityInstruments
  }

  /**
   * @internal
   */
  static _buildMetaData(
    metaData: CppQueryResponseQueryMetaData
  ): QueryMetaData {
    let warnings: QueryWarning[]
    if (metaData.warnings) {
      warnings = metaData.warnings.map(
        (warningData: any) =>
          new QueryWarning({
            code: warningData.code,
            message: warningData.message,
          })
      )
    } else {
      warnings = []
    }

    let metrics: QueryMetrics | undefined
    if (metaData.metrics) {
      const metricsData = metaData.metrics

      metrics = new QueryMetrics({
        elapsedTime: metricsData.elapsed_time,
        executionTime: metricsData.execution_time,
        sortCount: metricsData.sort_count || 0,
        resultCount: metricsData.result_count || 0,
        resultSize: metricsData.result_size || 0,
        mutationCount: metricsData.mutation_count || 0,
        errorCount: metricsData.error_count || 0,
        warningCount: metricsData.warning_count || 0,
      })
    } else {
      metrics = undefined
    }

    return new QueryMetaData({
      requestId: metaData.request_id,
      clientContextId: metaData.client_context_id,
      status: metaData.status as QueryStatus,
      signature: metaData.signature
        ? JSON.parse(metaData.signature)
        : undefined,
      warnings: warnings,
      metrics: metrics,
      profile: metaData.profile ? JSON.parse(metaData.profile) : undefined,
    })
  }

  /**
   * @internal
   */
  static _buildQueryRequest(
    query: string,
    options: QueryOptions,
    timeout: number,
    obsReqHandler: ObservableRequestHandler
  ): CppQueryRequest {
    return {
      statement: query,
      client_context_id: options.clientContextId,
      adhoc: options.adhoc === false ? false : true,
      metrics: options.metrics || false,
      readonly: options.readOnly || false,
      flex_index: options.flexIndex || false,
      preserve_expiry: options.preserveExpiry || false,
      use_replica: options.useReplica,
      max_parallelism: options.maxParallelism,
      scan_cap: options.scanCap,
      scan_wait: options.scanWait,
      pipeline_batch: options.pipelineBatch,
      pipeline_cap: options.pipelineCap,
      scan_consistency: queryScanConsistencyToCpp(options.scanConsistency),
      mutation_state: mutationStateToCpp(options.consistentWith).tokens,
      timeout: timeout,
      query_context: options.queryContext,
      profile: queryProfileToCpp(options.profile),
      raw: options.raw
        ? Object.fromEntries(
            Object.entries(options.raw)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => [k, JSON.stringify(v)])
          )
        : {},
      positional_parameters:
        options.parameters && Array.isArray(options.parameters)
          ? options.parameters.map((v) => JSON.stringify(v ?? null))
          : [],
      named_parameters:
        options.parameters && !Array.isArray(options.parameters)
          ? Object.fromEntries(
              Object.entries(options.parameters as { [key: string]: any })
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, JSON.stringify(v)])
            )
          : {},
      body_str: '',
      wrapper_span_name: obsReqHandler.wrapperSpanName,
    }
  }

  /**
   * @internal
   */
  static _newQueryEmitter<TRow>(): StreamableRowPromise<
    QueryResult<TRow>,
    TRow,
    QueryMetaData
  > {
    return new StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData>(
      (rows, meta) => {
        return new QueryResult({
          rows: rows,
          meta: meta,
        })
      }
    )
  }

  /**
   * @internal
   */
  static _endWithError<TRow>(
    emitter: StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData>,
    err: Error,
    obsReqHandler?: ObservableRequestHandler
  ): void {
    obsReqHandler?.endWithError(err)
    emitter.emit('error', err)
    emitter.emit('end')
  }

  /**
   * @internal
   *
   * Returns an emitter which fails on a later tick, so that the caller has a
   * chance to attach its listeners (or await it) before the error is emitted.
   */
  static _failedQuery<TRow>(
    err: Error,
    obsReqHandler?: ObservableRequestHandler
  ): StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData> {
    const emitter = QueryExecutor._newQueryEmitter<TRow>()
    process.nextTick(() => {
      QueryExecutor._rethrowListenerErrors(() => {
        QueryExecutor._endWithError(emitter, err, obsReqHandler)
      })
    })
    return emitter
  }

  /**
   * @internal
   *
   * Native callbacks swallow anything thrown out of them, so anything still
   * thrown by the callback body (an 'error' emitted with no listener, or a
   * throwing 'end' listener) is rethrown on a later tick, where it surfaces as
   * an uncaught exception.
   */
  static _rethrowListenerErrors(fn: () => void): void {
    try {
      fn()
    } catch (err) {
      process.nextTick(() => {
        throw err
      })
    }
  }

  /**
   * @internal
   */
  static _processQueryResponse<TRow>(
    emitter: StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData>,
    err: Error | null,
    resp: CppQueryResponse,
    obsReqHandler?: ObservableRequestHandler
  ): void {
    if (err) {
      QueryExecutor._endWithError(emitter, err, obsReqHandler)
      return
    }

    try {
      resp.rows.forEach((row) => {
        emitter.emit('row', JSON.parse(row))
      })

      emitter.emit('meta', QueryExecutor._buildMetaData(resp.meta))
    } catch (err) {
      QueryExecutor._endWithError(emitter, err as Error, obsReqHandler)
      return
    }

    obsReqHandler?.end()
    emitter.emit('end')
  }

  /**
   * @internal
   *
   * Pulls rows off a native query stream one at a time, emitting each as it
   * arrives off the socket rather than waiting for the full response to
   * buffer.
   */
  static _continueQueryStream<TRow>(
    stream: OpenQueryStream,
    emitter: StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData>,
    obsReqHandler?: ObservableRequestHandler
  ): void {
    stream.iterator.next((cppErr, resp) => {
      QueryExecutor._rethrowListenerErrors(() => {
        // The stream is finished before anything is emitted, so that a
        // throwing listener cannot leave close() waiting on it.
        if (cppErr) {
          stream.finish()
          obsReqHandler?.processCoreSpan(cppErr.cpp_core_span)
          QueryExecutor._endWithError(
            emitter,
            errorFromCpp(cppErr) as Error,
            obsReqHandler
          )
          return
        }

        if (resp && typeof resp.row !== 'undefined') {
          try {
            emitter.emit('row', JSON.parse(resp.row))
          } catch (err) {
            stream.cancel()
            stream.finish()
            QueryExecutor._endWithError(emitter, err as Error, obsReqHandler)
            return
          }

          if (stream.closing) {
            stream.cancel()
            stream.finish()
            QueryExecutor._endWithError(
              emitter,
              new RequestCanceledError(),
              obsReqHandler
            )
            return
          }

          QueryExecutor._continueQueryStream(stream, emitter, obsReqHandler)
          return
        }

        stream.finish()

        if (resp && resp.meta) {
          obsReqHandler?.processCoreSpan(resp.cpp_core_span)
          try {
            emitter.emit('meta', QueryExecutor._buildMetaData(resp.meta))
          } catch (err) {
            QueryExecutor._endWithError(emitter, err as Error, obsReqHandler)
            return
          }
        }

        obsReqHandler?.end()
        emitter.emit('end')
      })
    })
  }

  /**
   * @internal
   *
   * Used by transactions (observability currently not available for transactions)
   */
  static execute<TRow = any>(
    exec: (
      callback: (err: CppError | null, resp: CppQueryResponse) => void
    ) => void
  ): StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData> {
    const emitter = QueryExecutor._newQueryEmitter<TRow>()

    exec((cppErr, resp) => {
      let err = null
      if (cppErr) {
        err = errorFromCpp(cppErr)
      }
      QueryExecutor._processQueryResponse(emitter, err, resp)
    })

    return emitter
  }

  /**
   * @internal
   */
  static executePromise<TRow = any>(
    queryPromise: Promise<[Error | null, CppQueryResponse]>,
    obsReqHandler: ObservableRequestHandler
  ): StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData> {
    const emitter = QueryExecutor._newQueryEmitter<TRow>()

    queryPromise.then(
      ([err, resp]) => {
        QueryExecutor._rethrowListenerErrors(() => {
          QueryExecutor._processQueryResponse(emitter, err, resp, obsReqHandler)
        })
      },
      (err) => {
        QueryExecutor._rethrowListenerErrors(() => {
          QueryExecutor._endWithError(emitter, err, obsReqHandler)
        })
      }
    )

    return emitter
  }

  /**
   * @internal
   */
  _streamQuery<TRow = any>(
    request: CppQueryRequest,
    obsReqHandler: ObservableRequestHandler
  ): StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData> {
    const emitter = QueryExecutor._newQueryEmitter<TRow>()

    try {
      this._cluster.conn.queryStream(request, (cppErr, iterator) => {
        QueryExecutor._rethrowListenerErrors(() => {
          if (cppErr) {
            obsReqHandler.processCoreSpan(cppErr.cpp_core_span)
            QueryExecutor._endWithError(
              emitter,
              errorFromCpp(cppErr) as Error,
              obsReqHandler
            )
            return
          }

          const stream = new OpenQueryStream(
            this._cluster,
            iterator as CppQueryStreamIterator
          )

          // The headers can arrive after close() has started, in which case
          // no further rows may be pulled.
          if (stream.closing) {
            stream.cancel()
            stream.finish()
            QueryExecutor._endWithError(
              emitter,
              new RequestCanceledError(),
              obsReqHandler
            )
            return
          }

          QueryExecutor._continueQueryStream(stream, emitter, obsReqHandler)
        })
      })
    } catch (err) {
      return QueryExecutor._failedQuery(err as Error, obsReqHandler)
    }

    return emitter
  }

  /**
   * @internal
   */
  query<TRow = any>(
    query: string,
    options: QueryOptions
  ): StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData> {
    const timeout = options.timeout || this._cluster.queryTimeout

    const obsReqHandler = new ObservableRequestHandler(
      StreamingOp.Query,
      this.observabilityInstruments,
      options?.parentSpan
    )

    let request: CppQueryRequest
    try {
      obsReqHandler.setRequestHttpAttributes({
        statement: query,
        queryContext: options.queryContext,
        queryOptions: options,
      })

      request = QueryExecutor._buildQueryRequest(
        query,
        options,
        timeout,
        obsReqHandler
      )
    } catch (err) {
      return QueryExecutor._failedQuery(err as Error, obsReqHandler)
    }

    // The core only streams adhoc queries; prepared statements rely on the
    // buffered path for their retry and prepared-statement caching.
    if (!request.adhoc) {
      return QueryExecutor.executePromise(
        wrapObservableBindingCall(
          this._cluster.conn.query.bind(this._cluster.conn),
          request,
          obsReqHandler
        ),
        obsReqHandler
      )
    }

    return this._streamQuery(request, obsReqHandler)
  }
}
