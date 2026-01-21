import { CppError, CppQueryResponse } from './binding'
import {
  errorFromCpp,
  mutationStateToCpp,
  queryProfileToCpp,
  queryScanConsistencyToCpp,
} from './bindingutilities'
import { Cluster } from './cluster'
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
import { PromiseHelper } from './utilities'

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
  static _processQueryResponse<TRow>(
    emitter: StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData>,
    err: Error | null,
    resp: CppQueryResponse,
    obsReqHandler?: ObservableRequestHandler
  ): void {
    if (err) {
      obsReqHandler?.endWithError(err)
      emitter.emit('error', err)
      emitter.emit('end')
      return
    }

    resp.rows.forEach((row) => {
      emitter.emit('row', JSON.parse(row))
    })

    {
      const metaData = resp.meta

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

      const meta = new QueryMetaData({
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

      emitter.emit('meta', meta)
    }

    obsReqHandler?.end()
    emitter.emit('end')
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
    const emitter = new StreamableRowPromise<
      QueryResult<TRow>,
      TRow,
      QueryMetaData
    >((rows, meta) => {
      return new QueryResult({
        rows: rows,
        meta: meta,
      })
    })

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
    const emitter = new StreamableRowPromise<
      QueryResult<TRow>,
      TRow,
      QueryMetaData
    >((rows, meta) => {
      return new QueryResult({
        rows: rows,
        meta: meta,
      })
    })

    PromiseHelper.wrapAsync(async () => {
      const [err, resp] = await queryPromise
      QueryExecutor._processQueryResponse(emitter, err, resp, obsReqHandler)
    })

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

    obsReqHandler.setRequestHttpAttributes({
      statement: query,
      queryContext: options.queryContext,
      queryOptions: options,
    })

    return QueryExecutor.executePromise(
      wrapObservableBindingCall(
        this._cluster.conn.query.bind(this._cluster.conn),
        {
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
        },
        obsReqHandler
      ),
      obsReqHandler
    )
  }
}
