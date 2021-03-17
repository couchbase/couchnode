/* eslint jsdoc/require-jsdoc: off */
import binding, { CppQueryFlags } from './binding'
import { Connection } from './connection'
import {
  QueryMetaData,
  QueryMetrics,
  QueryOptions,
  QueryResult,
  QueryWarning,
} from './querytypes'
import { StreamableRowPromise } from './streamablepromises'
import { msToGoDurationStr, goDurationStrToMs } from './utilities'

/**
 * @internal
 */
export class QueryExecutor {
  private _conn: Connection

  /**
   * @internal
   */
  constructor(conn: Connection) {
    this._conn = conn
  }

  query<TRow = any>(
    query: string,
    options: QueryOptions
  ): StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData> {
    const queryObj: any = {}
    let queryFlags: CppQueryFlags = 0

    queryObj.statement = query.toString()

    if (options.scanConsistency) {
      queryObj.scan_consistency = options.scanConsistency
    }
    if (options.consistentWith) {
      if (queryObj.scan_consistency) {
        throw new Error(
          'cannot specify consistency and consistentWith together'
        )
      }

      queryObj.scan_consistency = 'at_plus'
      queryObj.scan_vectors = options.consistentWith.toJSON()
    }
    if (options.adhoc === false) {
      queryFlags |= binding.LCBX_QUERYFLAG_PREPCACHE
    }
    if (options.flexIndex) {
      queryObj.use_fts = true
    }
    if (options.clientContextId) {
      queryObj.client_context_id = options.clientContextId
    }
    if (options.maxParallelism) {
      queryObj.max_parallelism = options.maxParallelism.toString()
    }
    if (options.pipelineBatch) {
      queryObj.pipeline_batch = options.pipelineBatch.toString()
    }
    if (options.pipelineCap) {
      queryObj.pipeline_cap = options.pipelineCap.toString()
    }
    if (options.scanWait) {
      queryObj.scan_wait = msToGoDurationStr(options.scanWait)
    }
    if (options.scanCap) {
      queryObj.scan_cap = options.scanCap.toString()
    }
    if (options.readOnly) {
      queryObj.readonly = !!options.readOnly
    }
    if (options.profile) {
      queryObj.profile = options.profile
    }
    if (options.metrics) {
      queryObj.metrics = options.metrics
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
    const cppTimeout = options.timeout ? options.timeout * 1000 : undefined

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

    this._conn.query(queryData, queryFlags, cppTimeout, (err, flags, data) => {
      if (!(flags & binding.LCBX_RESP_F_NONFINAL)) {
        if (err) {
          emitter.emit('error', err)
          emitter.emit('end')
          return
        }

        const metaData = JSON.parse(data)

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
            elapsedTime: goDurationStrToMs(metricsData.elapsedTime) || 0,
            executionTime: goDurationStrToMs(metricsData.executionTime) || 0,
            sortCount: metricsData.sortCount || 0,
            resultCount: metricsData.resultCount || 0,
            resultSize: metricsData.resultSize || 0,
            mutationCount: metricsData.mutationCount || 0,
            errorCount: metricsData.errorCount || 0,
            warningCount: metricsData.warningCount || 0,
          })
        } else {
          metrics = undefined
        }

        const meta = new QueryMetaData({
          requestId: metaData.requestID,
          clientContextId: metaData.clientContextID,
          status: metaData.status,
          signature: metaData.signature,
          warnings: warnings,
          metrics: metrics,
          profile: metaData.profile,
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
    })

    return emitter
  }
}
