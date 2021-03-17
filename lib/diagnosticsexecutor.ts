/* eslint jsdoc/require-jsdoc: off */
import binding, { CppServiceType } from './binding'
import { Connection } from './connection'
import {
  DiagnosticsOptions,
  DiagnosticsResult,
  PingOptions,
  PingResult,
} from './diagnosticstypes'
import { ServiceType } from './generaltypes'

/**
 * @internal
 */
export class DiagnoticsExecutor {
  private _conns: Connection[]

  /**
   * @internal
   */
  constructor(conns: Connection[]) {
    this._conns = conns
  }

  async singleDiagnostics(conn: Connection): Promise<DiagnosticsResult> {
    return new Promise((resolve, reject) => {
      conn.diag(undefined, (err, data) => {
        if (err) {
          return reject(err)
        }

        const parsedReport = JSON.parse(data)
        resolve(parsedReport)
      })
    })
  }

  async diagnostics(options: DiagnosticsOptions): Promise<DiagnosticsResult> {
    if (this._conns.length === 0) {
      throw new Error('found no connections to test')
    }

    const diagReses = await Promise.all(
      this._conns.map((conn) => this.singleDiagnostics(conn))
    )

    const baseConfig = diagReses[0] as any

    const report = {
      id: baseConfig.id,
      version: baseConfig.version,
      sdk: baseConfig.sdk,
      services: [] as any[],
    }

    if (options.reportId) {
      report.id = options.reportId
    }

    diagReses.forEach((diagRes: any) => {
      if (diagRes.config) {
        diagRes.config.forEach((svcDiagRes: any) => {
          report.services.push({
            id: svcDiagRes.id,
            type: svcDiagRes.type,
            local: svcDiagRes.local,
            remote: svcDiagRes.remote,
            lastActivity: svcDiagRes.last_activity_us,
            status: svcDiagRes.status,
          })
        })
      }
    })

    return report
  }
}

/**
 * @internal
 */
export class PingExecutor {
  private _conn: Connection

  /**
   * @internal
   */
  constructor(conn: Connection) {
    this._conn = conn
  }

  async ping(options: PingOptions): Promise<PingResult> {
    let serviceFlags: CppServiceType = 0

    if (Array.isArray(options.serviceTypes)) {
      options.serviceTypes.forEach((serviceType) => {
        if (serviceType === ServiceType.KeyValue) {
          serviceFlags |= binding.LCBX_SERVICETYPE_KEYVALUE
        } else if (serviceType === ServiceType.Views) {
          serviceFlags |= binding.LCBX_SERVICETYPE_VIEWS
        } else if (serviceType === ServiceType.Query) {
          serviceFlags |= binding.LCBX_SERVICETYPE_QUERY
        } else if (serviceType === ServiceType.Search) {
          serviceFlags |= binding.LCBX_SERVICETYPE_SEARCH
        } else if (serviceType === ServiceType.Analytics) {
          serviceFlags |= binding.LCBX_SERVICETYPE_ANALYTICS
        } else {
          throw new Error('invalid service type')
        }
      })
    }

    const reportId = options.reportId
    const timeout = options.timeout
    return new Promise((resolve, reject) => {
      this._conn.ping(reportId, serviceFlags, timeout, (err, data) => {
        if (err) {
          return reject(err)
        }

        const parsedReport = JSON.parse(data)
        resolve(parsedReport)
      })
    })
  }
}
