/* eslint jsdoc/require-jsdoc: off */
import {
  AnalyticsQueryOptions,
  AnalyticsResult,
  AnalyticsMetaData,
  AnalyticsWarning,
  AnalyticsMetrics,
} from './analyticstypes'
import {
  analyticsScanConsistencyToCpp,
  analyticsStatusFromCpp,
  errorFromCpp,
} from './bindingutilities'
import { Cluster } from './cluster'
import { StreamableRowPromise } from './streamablepromises'

/**
 * @internal
 */
export class AnalyticsExecutor {
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
  query<TRow = any>(
    query: string,
    options: AnalyticsQueryOptions
  ): StreamableRowPromise<AnalyticsResult<TRow>, TRow, AnalyticsMetaData> {
    const emitter = new StreamableRowPromise<
      AnalyticsResult<TRow>,
      TRow,
      AnalyticsMetaData
    >((rows, meta) => {
      return new AnalyticsResult({
        rows: rows,
        meta: meta,
      })
    })

    const timeout = options.timeout || this._cluster.analyticsTimeout

    this._cluster.conn.analytics(
      {
        statement: query,
        timeout,
        client_context_id: options.clientContextId,
        readonly: options.readOnly || false,
        priority: options.priority || false,
        scope_qualifier: options.queryContext,
        scan_consistency: analyticsScanConsistencyToCpp(
          options.scanConsistency
        ),
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
      (cppErr, resp) => {
        const err = errorFromCpp(cppErr)
        if (err) {
          emitter.emit('error', err)
          emitter.emit('end')
          return
        }

        resp.rows.forEach((row) => {
          emitter.emit('row', JSON.parse(row))
        })

        {
          const metaData = resp.meta

          let warnings: AnalyticsWarning[]
          if (metaData.warnings) {
            warnings = metaData.warnings.map(
              (warningData: any) =>
                new AnalyticsWarning({
                  code: warningData.code,
                  message: warningData.message,
                })
            )
          } else {
            warnings = []
          }

          const metricsData = metaData.metrics
          const metrics = new AnalyticsMetrics({
            elapsedTime: metricsData.elapsed_time,
            executionTime: metricsData.execution_time,
            resultCount: metricsData.result_count,
            resultSize: metricsData.result_size,
            errorCount: metricsData.error_count,
            processedObjects: metricsData.processed_objects,
            warningCount: metricsData.warning_count,
          })

          const meta = new AnalyticsMetaData({
            requestId: metaData.request_id,
            clientContextId: metaData.client_context_id,
            status: analyticsStatusFromCpp(metaData.status),
            signature: metaData.signature
              ? JSON.parse(metaData.signature)
              : undefined,
            warnings: warnings,
            metrics: metrics,
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
