/* eslint jsdoc/require-jsdoc: off */
import {
  AnalyticsQueryOptions,
  AnalyticsResult,
  AnalyticsMetaData,
  AnalyticsWarning,
  AnalyticsMetrics,
} from './analyticstypes'
import binding, { CppAnalyticsQueryFlags } from './binding'
import { Connection } from './connection'
import { StreamableRowPromise } from './streamablepromises'
import { goDurationStrToMs } from './utilities'

/**
 * @internal
 */
export class AnalyticsExecutor {
  private _conn: Connection

  /**
   * @internal
   */
  constructor(conn: Connection) {
    this._conn = conn
  }

  query<TRow = any>(
    query: string,
    options: AnalyticsQueryOptions
  ): StreamableRowPromise<AnalyticsResult<TRow>, TRow, AnalyticsMetaData> {
    const queryObj: any = {}
    let queryFlags: CppAnalyticsQueryFlags = 0

    queryObj.statement = query.toString()

    if (options.scanConsistency) {
      queryObj.scan_consistency = options.scanConsistency
    }
    if (options.clientContextId) {
      queryObj.client_context_id = options.clientContextId
    }
    if (options.priority === true) {
      queryFlags |= binding.LCBX_ANALYTICSFLAG_PRIORITY
    }
    if (options.readOnly) {
      queryObj.readonly = !!options.readOnly
    }
    if (options.queryContext) {
      queryObj.query_context = options.queryContext
    }

    if (options.parameters) {
      const params = options.parameters
      if (Array.isArray(params)) {
        queryObj.args = params
      } else {
        Object.entries(params).forEach(([key, value]) => {
          queryObj['$' + key] = value
        })
      }
    }

    if (options.raw) {
      for (const i in options.raw) {
        queryObj[i] = options.raw[i]
      }
    }

    const queryData = JSON.stringify(queryObj)
    const lcbTimeout = options.timeout ? options.timeout * 1000 : undefined

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

    this._conn.analyticsQuery(
      queryData,
      queryFlags,
      lcbTimeout,
      (err, flags, data) => {
        if (!(flags & binding.LCBX_RESP_F_NONFINAL)) {
          if (err) {
            emitter.emit('error', err)
            emitter.emit('end')
            return
          }

          const metaData = JSON.parse(data)

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

          const metricsData = metaData.metrics || {}
          const metrics = new AnalyticsMetrics({
            elapsedTime: goDurationStrToMs(metricsData.elapsedTime) || 0,
            executionTime: goDurationStrToMs(metricsData.executionTime) || 0,
            resultCount: metricsData.resultCount || 0,
            resultSize: metricsData.resultSize || 0,
            errorCount: metricsData.errorCount || 0,
            processedObjects: metricsData.processedObjects || 0,
            warningCount: metricsData.warningCount || 0,
          })

          const meta = new AnalyticsMetaData({
            requestId: metaData.requestID,
            clientContextId: metaData.clientContextID,
            status: metaData.status,
            signature: metaData.signature,
            warnings: warnings,
            metrics: metrics,
          })

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
