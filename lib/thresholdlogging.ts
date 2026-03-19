import { HiResTime } from './binding'
import { TracingConfig } from './cluster'
import { ServiceType } from './generaltypes'
import { CouchbaseLogger } from './logger'
import {
  AttributeValue,
  DispatchAttributeName,
  OpAttributeName,
  SpanStatus,
  SpanStatusCode,
  TimeInput,
} from './observabilitytypes'
import {
  getHiResTimeDelta,
  hiResTimeToMicros,
  millisToHiResTime,
  timeInputToHiResTime,
} from './observabilityutilities'
import { RequestSpan, RequestTracer } from './tracing'

/* eslint-disable jsdoc/require-jsdoc */
/**
 * @internal
 */
enum ThresholdLoggingAttributeName {
  EncodeDuration = 'encode_duration_us',
  OperationName = 'operation_name',
  OperationId = 'operation_id',
  LastDispatchDuration = 'last_dispatch_duration_us',
  LastLocalId = 'last_local_id',
  LastLocalSocket = 'last_local_socket',
  LastRemoteSocket = 'last_remote_socket',
  LastServerDuration = 'last_server_duration_us',
  Timeout = 'timeout_ms',
  TotalDuration = 'total_duration_us',
  TotalDispatchDuration = 'total_dispatch_duration_us',
  TotalServerDuration = 'total_server_duration_us',
}

/**
 * @internal
 */
enum IgnoredParentSpan {
  ListGetAll = 'list_get_all',
  ListGetAt = 'list_get_at',
  ListIndexOf = 'list_index_of',
  ListPush = 'list_push',
  ListRemoveAt = 'list_remove_at',
  ListSize = 'list_size',
  ListUnshift = 'list_unshift',
  MapExists = 'map_exists',
  MapGet = 'map_get',
  MapGetAll = 'map_get_all',
  MapKeys = 'map_keys',
  MapRemove = 'map_remove',
  MapSet = 'map_set',
  MapSize = 'map_size',
  MapValues = 'map_values',
  QueuePop = 'queue_pop',
  QueuePush = 'queue_push',
  QueueSize = 'queue_size',
  SetAdd = 'set_add',
  SetContains = 'set_contains',
  SetRemove = 'set_remove',
  SetSize = 'set_size',
  SetValues = 'set_values',
}

const IGNORED_PARENT_SPAN_VALUES = new Set<string>(
  Object.values(IgnoredParentSpan)
)

class ThresholdLoggingSpanSnapshot {
  readonly name: string
  readonly serviceType: ServiceType | undefined
  readonly totalDuration: number
  readonly encodeDuration: number | undefined
  readonly dispatchDuration: number | undefined
  readonly totalDispatchDuration: number
  readonly serverDuration: number | undefined
  readonly totalServerDuration: number
  readonly localId: string | undefined
  readonly operationId: string | undefined
  readonly localSocket: string | undefined
  readonly remoteSocket: string | undefined

  constructor(span: ThresholdLoggingSpan) {
    this.name = span.name
    this.serviceType = span.serviceType
    this.totalDuration = span.totalDuration
    this.encodeDuration = span.encodeDuration
    this.dispatchDuration = span.dispatchDuration
    this.totalDispatchDuration = span.totalDispatchDuration
    this.serverDuration = span.serverDuration
    this.totalServerDuration = span.totalServerDuration
    this.localId = span.localId
    this.operationId = span.operationId
    this.localSocket = span.localSocket
    this.remoteSocket = span.remoteSocket
  }
}

/**
 * @internal
 */
class PriorityQueue<T> {
  private readonly _capacity: number
  private readonly _queue: Array<{ item: T; priority: number }>
  private _size: number
  private _droppedCount: number

  constructor(capacity?: number) {
    this._capacity = capacity ?? 10
    this._queue = new Array(this._capacity)
    this._size = 0
    this._droppedCount = 0
  }

  get droppedCount(): number {
    return this._droppedCount
  }

  _getInsertIndex(priority: number): number {
    let left = 0
    let right = this._size
    while (left < right) {
      const mid = (left + right) >>> 1 // Math.floor((left + right) / 2) but slightly better
      if (this._queue[mid].priority < priority) {
        left = mid + 1
      } else {
        right = mid
      }
    }
    return left
  }

  enqueue(item: T, priority: number): boolean {
    if (this._size >= this._capacity) {
      const lowestPriority = this._queue[0].priority
      if (lowestPriority >= priority) {
        this._droppedCount++
        return false
      }
      // shift the queue left
      for (let i = 0; i < this._size - 1; i++) {
        this._queue[i] = this._queue[i + 1]
      }
      this._size--
      this._droppedCount++
    }
    const insertIdx = this._getInsertIndex(priority)
    // shift items > insertIdx right
    for (let i = this._size; i > insertIdx; i--) {
      this._queue[i] = this._queue[i - 1]
    }
    this._queue[insertIdx] = { item: item, priority: priority }
    this._size++
    return true
  }

  peek(): T | undefined {
    return this._size > 0 ? this._queue[0].item : undefined
  }

  drain(): [T[], number] {
    const items: T[] = []
    for (let i = 0; i < this._size; i++) {
      items.push(this._queue[i].item)
    }
    const droppedCount = this._droppedCount
    this._size = 0
    this._droppedCount = 0
    // Return items in descending priority order (highest duration first)
    items.reverse()
    return [items, droppedCount]
  }
}

/**
 * @internal
 */
class ThresholdLoggingReporter {
  private readonly _interval: number
  private readonly _thresholdQueues: Map<
    ServiceType,
    PriorityQueue<ThresholdLogRecord>
  >
  private readonly _logger: CouchbaseLogger
  private _timerId: NodeJS.Timeout | undefined
  private _stopped: boolean

  constructor(logger: CouchbaseLogger, interval: number, capacity?: number) {
    this._logger = logger
    this._interval = interval
    this._thresholdQueues = new Map<
      ServiceType,
      PriorityQueue<ThresholdLogRecord>
    >()
    this._thresholdQueues.set(
      ServiceType.KeyValue,
      new PriorityQueue<ThresholdLogRecord>(capacity)
    )
    this._thresholdQueues.set(
      ServiceType.Query,
      new PriorityQueue<ThresholdLogRecord>(capacity)
    )
    this._thresholdQueues.set(
      ServiceType.Search,
      new PriorityQueue<ThresholdLogRecord>(capacity)
    )
    this._thresholdQueues.set(
      ServiceType.Analytics,
      new PriorityQueue<ThresholdLogRecord>(capacity)
    )
    this._thresholdQueues.set(
      ServiceType.Views,
      new PriorityQueue<ThresholdLogRecord>(capacity)
    )
    this._thresholdQueues.set(
      ServiceType.Management,
      new PriorityQueue<ThresholdLogRecord>(capacity)
    )
    this._thresholdQueues.set(
      ServiceType.Eventing,
      new PriorityQueue<ThresholdLogRecord>(capacity)
    )
    this._stopped = false
  }

  addLogRecord(
    serviceType: ServiceType,
    item: ThresholdLogRecord,
    totalDuration: number
  ) {
    this._thresholdQueues.get(serviceType)?.enqueue(item, totalDuration)
  }

  start() {
    this._timerId = setInterval(this.report.bind(this), this._interval)
    // let the process exit even if the reporter has not been shutdown
    this._timerId.unref()
    this._stopped = false
  }

  stop() {
    if (this._stopped) {
      return
    }
    this._stopped = true
    clearInterval(this._timerId)
  }

  report(returnReport?: boolean): Record<string, any> | undefined {
    const report: Record<string, any> = {}
    for (const [serviceType, queue] of this._thresholdQueues) {
      const [items, droppedCount] = queue.drain()
      if (items.length > 0) {
        report[serviceType as string] = {
          total_count: items.length + droppedCount,
          top_requests: items.map((item) => Object.fromEntries(item)),
        }
      }
    }
    if (returnReport) {
      return report
    } else {
      if (Object.keys(report).length > 0) {
        this._logger.info(JSON.stringify(report))
      }
    }
  }
}

/* eslint-enable jsdoc/require-jsdoc */
/**
 * @internal
 */
type ThresholdLogRecord = Map<string, string | number>

/**
 * @internal
 */
function serviceTypeFromString(serviceType: string): ServiceType {
  switch (serviceType.toLocaleLowerCase()) {
    case 'kv':
    case 'keyValue':
      return ServiceType.KeyValue
    case 'query':
      return ServiceType.Query
    case 'search':
      return ServiceType.Search
    case 'analytics':
      return ServiceType.Analytics
    case 'views':
      return ServiceType.Views
    case 'management':
      return ServiceType.Management
    case 'eventing':
      return ServiceType.Eventing
    default:
      throw new Error('Unrecognized service type.')
  }
}

/**
 * A RequestSpan implementation that tracks operation timing for threshold logging.
 *
 * Works with {@link ThresholdLoggingTracer} to identify and log slow operations
 * that exceed configured thresholds.
 *
 */
export class ThresholdLoggingSpan implements RequestSpan {
  readonly _name: string
  readonly _tracer: ThresholdLoggingTracer
  _parentSpan: ThresholdLoggingSpan | undefined
  _startTime: HiResTime
  _endTime: HiResTime | undefined
  _attributes: { [key: string]: AttributeValue } = {}
  _status: SpanStatus = { code: SpanStatusCode.UNSET }
  _totalDuration: number
  _serverDuration: number | undefined
  _totalServerDuration: number
  _dispatchDuration: number | undefined
  _totalDispatchDuration: number
  _encodeDuration: number | undefined
  _totalEncodeDuration: number
  _localId: string | undefined
  _operationId: string | undefined
  _peerAddress: string | undefined
  _peerPort: number | undefined
  _remoteAddress: string | undefined
  _remotePort: number | undefined
  _serviceType: ServiceType | undefined
  _snapshot: ThresholdLoggingSpanSnapshot | undefined

  /**
   * Creates a new threshold logging span.
   *
   * @param name - The name of the operation being traced.
   * @param tracer - The span's tracer.
   * @param parentSpan - Optional parent span for hierarchical tracing.
   * @param startTime - Optional start time; defaults to current time if not provided.
   */
  constructor(
    name: string,
    tracer: ThresholdLoggingTracer,
    parentSpan?: ThresholdLoggingSpan,
    startTime?: TimeInput
  ) {
    this._name = name
    this._tracer = tracer
    this._parentSpan = parentSpan
    this._startTime = this._getTime(startTime)
    this._totalDuration = 0
    this._totalDispatchDuration = 0
    this._totalServerDuration = 0
    this._totalEncodeDuration = 0
  }

  /**
   * Gets the dispatch duration of the request, in microseconds.
   *
   * @internal
   */
  get dispatchDuration(): number | undefined {
    return this._dispatchDuration
  }

  /**
   * Sets the dispatch duration of the request, in microseconds.
   *
   * @internal
   */
  set dispatchDuration(duration: number) {
    this._dispatchDuration = duration
    this._totalDispatchDuration += this._dispatchDuration
    if (this._parentSpan) {
      this._parentSpan.dispatchDuration = duration
    }
  }

  /**
   * Gets the duration spent encoding the request, in microseconds.
   *
   * @internal
   */
  get encodeDuration(): number | undefined {
    return this._encodeDuration
  }

  /**
   * Sets the duration spent encoding the request, in microseconds.
   *
   * @internal
   */
  set encodeDuration(duration: number) {
    this._encodeDuration = duration
    this._totalEncodeDuration += this._encodeDuration
    if (this._parentSpan) {
      this._parentSpan.encodeDuration = duration
    }
  }

  /**
   * Gets the local ID of the request's dispatch span.
   *
   * @internal
   */
  get localId(): string | undefined {
    return this._localId
  }

  /**
   * Gets the local socket of the request's dispatch span.
   *
   * @internal
   */
  get localSocket(): string | undefined {
    if (this._peerAddress !== undefined || this._peerPort !== undefined) {
      const address = this._peerAddress ?? ''
      const port = this._peerPort ?? ''
      return `${address}:${port}`
    }
  }

  /**
   * Gets the name of the span.
   */
  get name(): string {
    return this._name
  }

  /**
   * Gets the operation ID of the request's dispatch span.
   *
   * @internal
   */
  get operationId(): string | undefined {
    return this._operationId
  }

  /**
   * Gets the peer address of the request's dispatch span.
   *
   * @internal
   */
  get peerAddress(): string | undefined {
    return this._peerAddress
  }

  /**
   * Gets the peer port of the request's dispatch span.
   *
   * @internal
   */
  get peerPort(): number | undefined {
    return this._peerPort
  }

  /**
   * Gets the remote socket of the request's dispatch span.
   *
   * @internal
   */
  get remoteSocket(): string | undefined {
    if (this._remoteAddress !== undefined || this._remotePort !== undefined) {
      const address = this._remoteAddress ?? ''
      const port = this._remotePort ?? ''
      return `${address}:${port}`
    }
  }

  /**
   * Gets the server duration of the request, in microseconds.
   *
   * @internal
   */
  get serverDuration(): number | undefined {
    return this._serverDuration
  }

  /**
   * Gets the Couchbase service type handling this operation.
   *
   * @internal
   */
  get serviceType(): ServiceType | undefined {
    return this._serviceType
  }

  /**
   * Gets the snapshot of the span containing all relevant information for threshold logging.
   *
   * @internal
   */
  get snapshot(): ThresholdLoggingSpanSnapshot | undefined {
    return this._snapshot
  }

  /**
   * Gets the total dispatch duration of the request, in microseconds.
   *
   * @internal
   */
  get totalDispatchDuration(): number {
    return this._totalDispatchDuration
  }

  /**
   * Gets the total encoding duration of the request, in microseconds.
   *
   * @internal
   */
  get totalEncodeDuration(): number {
    return this._totalEncodeDuration
  }

  /**
   * Gets the total duration of the request, in microseconds.
   *
   * @internal
   */
  get totalDuration(): number {
    return this._totalDuration
  }

  /**
   * Gets the total server duration of the request, in microseconds.
   *
   * @internal
   */
  get totalServerDuration(): number {
    return this._totalServerDuration
  }

  /**
   * Sets a single attribute on the span.
   *
   * @param key - The attribute key.
   * @param value - The attribute value.
   */
  setAttribute(key: string, value: AttributeValue): void {
    let propagatedToParent = true
    if (key === (OpAttributeName.Service as string)) {
      this._serviceType = serviceTypeFromString(value as string)
    } else if (key === (DispatchAttributeName.ServerDuration as string)) {
      this._serverDuration = value as number
      this._totalServerDuration += this._serverDuration
    } else if (key === (DispatchAttributeName.LocalId as string)) {
      this._localId = value as string
    } else if (key === (DispatchAttributeName.OperationId as string)) {
      this._operationId = value as string
    } else if (key === (DispatchAttributeName.PeerAddress as string)) {
      this._peerAddress = value as string
    } else if (key === (DispatchAttributeName.PeerPort as string)) {
      this._peerPort = value as number
    } else if (key === (DispatchAttributeName.ServerAddress as string)) {
      this._remoteAddress = value as string
    } else if (key === (DispatchAttributeName.ServerPort as string)) {
      this._remotePort = value as number
    } else {
      this._attributes[key] = value
      propagatedToParent = false
    }

    if (propagatedToParent && this._parentSpan) {
      this._parentSpan.setAttribute(key, value)
    }
  }

  /**
   * Adds a timestamped event to the span.
   */
  addEvent(): void {}

  /**
   * Sets the status of the span.
   *
   * @param status - The span status containing code and optional message.
   */
  setStatus(status: SpanStatus): void {
    this._status = status
  }

  /**
   * Marks the span as complete and calculates the total duration.
   *
   * The total duration is computed from the start time to the end time
   * and stored in microseconds.
   *
   * @param endTime - Optional end time; defaults to current time if not provided.
   */
  end(endTime?: TimeInput): void {
    if (this._endTime) {
      // prevent ending the span multiple times
      return
    }
    this._endTime = this._getTime(endTime)
    this._totalDuration = hiResTimeToMicros(
      getHiResTimeDelta(this._startTime, this._endTime)
    )

    this._snapshot = new ThresholdLoggingSpanSnapshot(this)

    if (this._name == OpAttributeName.EncodingSpanName) {
      this.encodeDuration = this._totalDuration
    } else if (this._name == OpAttributeName.DispatchSpanName) {
      this.dispatchDuration = this._totalDuration
    } else if (
      this._parentSpan &&
      IGNORED_PARENT_SPAN_VALUES.has(this._parentSpan.name)
    ) {
      this._tracer.checkThreshold(this._snapshot)
    } else if (
      !this._parentSpan &&
      !IGNORED_PARENT_SPAN_VALUES.has(this._name)
    ) {
      this._tracer.checkThreshold(this._snapshot)
    }
  }

  /**
   * Converts various time input formats to HiResTime.
   *
   * @param input - Time input (Date, number, HiResTime, or undefined for current time).
   * @returns {HiResTime} High-resolution time value.
   */
  private _getTime(input?: TimeInput): HiResTime {
    if (typeof input === 'undefined') {
      return timeInputToHiResTime()
    } else if (input instanceof Date) {
      return millisToHiResTime(input.getTime())
    } else if (typeof input === 'number') {
      // TODO:  is this accurate?
      return millisToHiResTime(input)
    }
    return input
  }
}
/**
 * A RequestTracer implementation that identifies and logs slow operations.
 */
export class ThresholdLoggingTracer implements RequestTracer {
  readonly _emitInterval: number
  readonly _sampleSize: number
  readonly _serviceThresholds: Map<ServiceType, number>
  readonly _reporter: ThresholdLoggingReporter
  /**
   * Creates a new threshold logging tracer.
   *
   * @param logger - The logger to be used by the ThresholdLoggingReporter.
   * @param config - Tracing configuration with thresholds and reporting settings.
   *                 If null, default values are used for all settings.
   */
  constructor(logger: CouchbaseLogger, config: TracingConfig | null) {
    this._emitInterval = config?.emitInterval ?? 10000
    this._sampleSize = config?.sampleSize ?? 10
    this._serviceThresholds = new Map<ServiceType, number>()
    this._serviceThresholds.set(
      ServiceType.KeyValue,
      config?.kvThreshold ?? 500
    )
    this._serviceThresholds.set(
      ServiceType.Query,
      config?.queryThreshold ?? 1000
    )
    this._serviceThresholds.set(
      ServiceType.Search,
      config?.searchThreshold ?? 1000
    )
    this._serviceThresholds.set(
      ServiceType.Analytics,
      config?.analyticsThreshold ?? 1000
    )
    this._serviceThresholds.set(
      ServiceType.Views,
      config?.viewsThreshold ?? 1000
    )
    this._serviceThresholds.set(
      ServiceType.Management,
      config?.managementThreshold ?? 1000
    )
    this._serviceThresholds.set(
      ServiceType.Eventing,
      config?.eventingThreshold ?? 1000
    )
    this._reporter = new ThresholdLoggingReporter(
      logger,
      this._emitInterval,
      this._sampleSize
    )
    this._reporter.start()
  }

  /**
   * Gets the tracer's ThresholdLoggingReporter.
   *
   * @internal
   */
  get reporter(): ThresholdLoggingReporter {
    return this._reporter
  }

  /**
   * Gets the tracer's service thresholds.
   *
   * @internal
   */
  get serviceThresholds(): Map<ServiceType, number> {
    return this._serviceThresholds
  }

  /**
   * Stops the threshold logging reporter and cleans up resources.
   *
   * This method should be called when shutting down the application or when
   * the tracer is no longer needed to ensure the periodic reporting timer
   * is properly cleared.
   */
  cleanup(): void {
    this._reporter.stop()
  }

  /**
   * Creates a new threshold logging span to trace an operation.
   *
   * @param name - The name of the operation being traced.
   * @param parentSpan - Optional parent span for hierarchical tracing.
   * @param startTime - Optional start time; defaults to current time if not provided.
   * @returns {ThresholdLoggingSpan} A new ThresholdLoggingSpan instance.
   */
  requestSpan(
    name: string,
    parentSpan?: ThresholdLoggingSpan,
    startTime?: TimeInput
  ): RequestSpan {
    return new ThresholdLoggingSpan(name, this, parentSpan, startTime)
  }

  /**
   * Checks if an operation exceeded its threshold and collects diagnostic information.
   *
   * If the operation's duration exceeds the configured threshold for its service type,
   * detailed timing and connection information is extracted from the span and its
   * associated core spans (network dispatch spans) and added to the reporter's queue.
   *
   * @param span - The completed threshold logging span to check.
   * @param coreSpans - Optional array of low-level network dispatch spans containing.
   *                    detailed timing and connection information.
   *
   * @internal
   */
  checkThreshold(spanSnapshot: ThresholdLoggingSpanSnapshot): void {
    if (typeof spanSnapshot.serviceType === 'undefined') {
      return
    }
    const serviceThreshold = this._getServiceTypeThreshold(
      spanSnapshot.serviceType
    )
    const spanTotalDuration = spanSnapshot.totalDuration ?? 0
    if (!serviceThreshold || spanTotalDuration <= serviceThreshold) {
      return
    }
    const thresholdLogRecord = this._buildThresholdLogRecord(
      spanSnapshot,
      spanTotalDuration
    )
    this._reporter.addLogRecord(
      spanSnapshot.serviceType,
      thresholdLogRecord,
      spanTotalDuration
    )
  }

  /**
   * Converts the request span and all child spans into single ThresholdLogRecord.
   *
   * @param requestSpan - The request span.
   * @param spanTotalDuration - The request spans duration.
   * @returns {ThresholdLogRecord} The converted spans to a single ThresholdLogRecord.
   *
   * @internal
   */
  _buildThresholdLogRecord(
    spanSnapshot: ThresholdLoggingSpanSnapshot,
    spanTotalDuration: number
  ): ThresholdLogRecord {
    const thresholdLogRecord: ThresholdLogRecord = new Map()
    thresholdLogRecord.set(
      ThresholdLoggingAttributeName.OperationName,
      spanSnapshot.name
    )
    thresholdLogRecord.set(
      ThresholdLoggingAttributeName.TotalDuration,
      spanTotalDuration
    )
    if (spanSnapshot.encodeDuration) {
      thresholdLogRecord.set(
        ThresholdLoggingAttributeName.EncodeDuration,
        spanSnapshot.encodeDuration
      )
    }
    const isKeyValueOp = spanSnapshot.serviceType == ServiceType.KeyValue
    if (spanSnapshot.totalDispatchDuration) {
      thresholdLogRecord.set(
        ThresholdLoggingAttributeName.TotalDispatchDuration,
        spanSnapshot.totalDispatchDuration
      )
    }
    if (isKeyValueOp && spanSnapshot.totalServerDuration) {
      thresholdLogRecord.set(
        ThresholdLoggingAttributeName.TotalServerDuration,
        spanSnapshot.totalServerDuration
      )
    }
    if (spanSnapshot.dispatchDuration) {
      thresholdLogRecord.set(
        ThresholdLoggingAttributeName.LastDispatchDuration,
        spanSnapshot.dispatchDuration
      )
    }
    if (isKeyValueOp && spanSnapshot.serverDuration) {
      thresholdLogRecord.set(
        ThresholdLoggingAttributeName.LastServerDuration,
        spanSnapshot.serverDuration
      )
    }
    if (spanSnapshot.localId) {
      thresholdLogRecord.set(
        ThresholdLoggingAttributeName.LastLocalId,
        spanSnapshot.localId
      )
    }
    if (spanSnapshot.operationId) {
      thresholdLogRecord.set(
        ThresholdLoggingAttributeName.OperationId,
        spanSnapshot.operationId
      )
    }
    if (spanSnapshot.localSocket) {
      thresholdLogRecord.set(
        ThresholdLoggingAttributeName.LastLocalSocket,
        spanSnapshot.localSocket
      )
    }
    if (spanSnapshot.remoteSocket) {
      thresholdLogRecord.set(
        ThresholdLoggingAttributeName.LastRemoteSocket,
        spanSnapshot.remoteSocket
      )
    }
    return thresholdLogRecord
  }

  /**
   * Gets the configured threshold for a specific service type.
   *
   * @param serviceType - The Couchbase service type.
   * @returns The threshold in microseconds (millisecond config value * 1000).
   *
   * @internal
   */
  _getServiceTypeThreshold(serviceType: ServiceType): number {
    const baseThreshold = this._serviceThresholds.get(serviceType) ?? 0
    // convert to micros
    return baseThreshold * 1000
  }
}
