import { Cluster } from './cluster'
import { DiagnoticsExecutor, PingExecutor } from './diagnosticsexecutor'
import {
  ClusterState,
  DiagnosticsEndpoint,
  EndpointState,
  PingResult,
  PingState,
  WaitUntilReadyOptions,
} from './diagnosticstypes'
import { InvalidArgumentError, UnambiguousTimeoutError } from './errors'
import { ServiceType } from './generaltypes'
import { CompoundTimeout } from './utilities'

const ALL_SERVICE_TYPES = Object.values(ServiceType)

const BACKOFF_BASE_MS = 50
const BACKOFF_CAP_MS = 500
const BACKOFF_MAX_EXP = 4

/**
 * @internal
 */
export class WaitUntilReadyExecutor {
  private _cluster: Cluster
  private _bucketName: string | undefined
  private _diagExec: DiagnoticsExecutor
  private _pingExec: PingExecutor

  /**
   * @internal
   */
  constructor(cluster: Cluster, bucketName?: string) {
    this._cluster = cluster
    this._bucketName = bucketName
    this._diagExec = new DiagnoticsExecutor(cluster)
    this._pingExec = new PingExecutor(cluster)
  }

  /**
   * Checks whether the endpoints for a single service satisfy the desired cluster state.
   *
   * @internal
   */
  private _meetsDesiredState(
    endpoints: DiagnosticsEndpoint[],
    desiredState: ClusterState
  ): boolean {
    if (endpoints.length === 0) {
      return false
    }

    const connected = endpoints.filter(
      (ep) => ep.state === EndpointState.Connected
    ).length

    if (desiredState === ClusterState.Online) {
      return connected === endpoints.length
    }
    if (desiredState === ClusterState.Degraded) {
      return connected > 0
    }
    return false
  }

  /**
   * Logs any ping endpoints that reported an error, at warn level.
   *
   * @internal
   */
  private _logPingErrors(pingResult: PingResult): void {
    for (const [serviceType, endpoints] of Object.entries(
      pingResult.services
    )) {
      for (const ep of endpoints) {
        if (ep.state === PingState.Error && ep.error) {
          this._cluster.logger.warn(
            `waitUntilReady: ping error on service ${serviceType}, remote ${ep.remote}: ${ep.error}`
          )
        }
      }
    }
  }

  /**
   * Builds the set of services to wait on, either from the user provided list or via discovery ping.
   *
   * @internal
   */
  private async _resolveWaitSet(
    serviceTypes: ServiceType[] | undefined,
    deadline: CompoundTimeout
  ): Promise<ServiceType[]> {
    let waitSet: ServiceType[]

    if (serviceTypes) {
      waitSet = [...serviceTypes]

      if (this._bucketName === undefined) {
        const filtered = waitSet.filter(
          (s) => s === ServiceType.KeyValue || s === ServiceType.Views
        )
        if (filtered.length > 0) {
          this._cluster.logger.warn(
            `waitUntilReady: ignoring [${filtered.join(', ')}] at cluster scope (no bucket context)`
          )
          waitSet = waitSet.filter(
            (s) => s !== ServiceType.KeyValue && s !== ServiceType.Views
          )
        }
      }
    } else {
      const discoveryResult = await this._pingExec.ping({
        bucket: this._bucketName,
        timeout: deadline.left(),
      })
      this._logPingErrors(discoveryResult)

      waitSet = []
      for (const [serviceType, endpoints] of Object.entries(discoveryResult.services)) {
        if (endpoints.length > 0) {
          waitSet.push(serviceType as ServiceType)
        }
      }
    }

    return waitSet
  }

  /**
   * @internal
   */
  async waitUntilReady(
    timeout: number,
    options: WaitUntilReadyOptions
  ): Promise<void> {
    if (typeof timeout !== 'number' || !isFinite(timeout) || timeout <= 0) {
      throw new InvalidArgumentError(
        new Error('timeout must be a positive finite number')
      )
    }

    const desiredState = options.desiredState ?? ClusterState.Online
    if (desiredState === ClusterState.Offline) {
      throw new InvalidArgumentError(
        new Error('ClusterState.Offline is not a valid desired state')
      )
    }

    if (options.serviceTypes) {
      for (const st of options.serviceTypes) {
        if (!ALL_SERVICE_TYPES.includes(st)) {
          throw new InvalidArgumentError(
            new Error(`Invalid service type: ${st}`)
          )
        }
      }
      if (options.serviceTypes.length === 0) {
        return
      }
    }

    const deadline = new CompoundTimeout(timeout)
    const waitSet = await this._resolveWaitSet(options.serviceTypes, deadline)
    if (waitSet.length === 0) {
      return
    }

    let iterations = 0
    let needPing: ServiceType[] = [...waitSet]

    while (true) {
      const diagResult = await this._diagExec.diagnostics({})

      needPing = []
      for (const svc of waitSet) {
        const endpoints = diagResult.services[svc] || []
        if (!this._meetsDesiredState(endpoints, desiredState)) {
          needPing.push(svc)
        }
      }

      if (needPing.length === 0) {
        return
      }

      if (deadline.expired()) {
        throw new UnambiguousTimeoutError(
          new Error(
            'Timed out prior to reaching desired state. ' +
            'Services not ready: ' + needPing.join(', ')
          )
        )
      }

      try {
        const pingResult = await this._pingExec.ping({
          serviceTypes: needPing,
          bucket: this._bucketName,
          timeout: deadline.left(),
        })
        this._logPingErrors(pingResult)
      } catch {
        // One failed ping isn't fatal, try again or eventually time out after deadline is reached.
      }

      const backoffMs = Math.min(
        BACKOFF_BASE_MS * Math.pow(2, Math.min(iterations, BACKOFF_MAX_EXP)),
        BACKOFF_CAP_MS
      )
      const timeLeft = deadline.left() ?? 0
      const sleepMs = Math.min(backoffMs, timeLeft)
      if (sleepMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, sleepMs))
      }

      iterations++
    }
  }
}
