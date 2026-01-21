import {
  CppDocumentId,
  CppDurabilityLevel,
  CppWrapperSdkChildSpan,
  CppWrapperSdkSpan,
  HiResTime,
} from './binding'
import { NoOpMeter, NoOpTracer } from './observability'
import { Meter } from './metrics'
import { ObservabilityInstruments } from './observabilitytypes'
import {
  AttributeValue,
  CppOpAttributeName,
  CppOpAttributeNameToOpAttributeNameMap,
  DatastructureOp,
  HttpOpType,
  KeyValueOp,
  isCppAttribute,
  OpType,
  OpAttributeName,
  SpanStatus,
  SpanStatusCode,
  TimeInput,
  serviceNameFromOpType,
  ServiceName,
} from './observabilitytypes'
import {
  getAttributesForHttpOpType,
  getAttributesForKeyValueOpType,
  HttpOpAttributesOptions,
} from './observabilityutilities'
import { hiResTimeToMicros, getHiResTimeDelta } from './observabilityutilities'
import { RequestSpan, RequestTracer } from './tracing'
import { getErrorMessage } from './utilities'

/**
 * @internal
 */
class ObservableRequestHandlerTracerImpl {
  private readonly _tracer: RequestTracer
  private readonly _getClusterLabelsFn:
    | (() => Record<string, string | undefined>)
    | undefined
  private _opType: OpType
  private _serviceName: ServiceName
  private _startTime: HiResTime
  private _wrappedSpan: WrappedSpan
  private _processedCoreSpan: boolean
  private _endTime: HiResTime | undefined
  constructor(
    opType: OpType,
    observabilityInstruments: ObservabilityInstruments,
    parentSpan?: RequestSpan
  ) {
    this._startTime = process.hrtime()
    this._opType = opType
    this._serviceName = serviceNameFromOpType(opType)
    this._tracer = observabilityInstruments.tracer
    this._getClusterLabelsFn = observabilityInstruments.clusterLabelsFn
    this._wrappedSpan = new WrappedSpan(
      this._serviceName,
      this._opType,
      this._tracer,
      parentSpan,
      this._startTime
    )
    this._processedCoreSpan = false
  }

  /**
   * @internal
   */
  get clusterName(): string | undefined {
    return this._wrappedSpan.clusterName
  }

  /**
   * @internal
   */
  get clusterUUID(): string | undefined {
    return this._wrappedSpan.clusterUUID
  }

  /**
   * @internal
   */
  get wrapperSpanName(): string {
    return this._wrappedSpan.name
  }

  /**
   * @internal
   */
  get wrappedSpan(): WrappedSpan {
    return this._wrappedSpan
  }

  /**
   * @internal
   */
  maybeAddEncodingSpan(encodeFn: () => [Buffer, number]): [Buffer, number] {
    return this._wrappedSpan.maybeAddEncodingSpan(encodeFn)
  }

  /**
   * @internal
   */
  maybeCreateEncodingSpan(encodeFn: () => [Buffer, number]): [Buffer, number] {
    return this._wrappedSpan.maybeCreateEncodingSpan(encodeFn)
  }

  /**
   * @internal
   */
  end(): void {
    this._endTime = process.hrtime()
    this._wrappedSpan.end(this._endTime)
  }

  /**
   * @internal
   */
  endWithError(error?: any): void {
    if (!this._processedCoreSpan && this._getClusterLabelsFn) {
      const clusterLabels = this._getClusterLabelsFn()
      this._wrappedSpan.setClusterLabels(clusterLabels)
      this._wrappedSpan.setRetryAttribute(0)
    }
    if (error) {
      this._wrappedSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: getErrorMessage(error),
      })
    } else {
      this._wrappedSpan.setStatus({
        code: SpanStatusCode.ERROR,
      })
    }
    this.end()
  }

  /**
   * @internal
   */
  reset(
    opType: OpType,
    parentSpan?: RequestSpan,
    withError: boolean = false
  ): void {
    if (withError) {
      this.endWithError()
    }
    this._startTime = process.hrtime()
    this._opType = opType
    this._serviceName = serviceNameFromOpType(opType)
    this._endTime = undefined
    this._wrappedSpan = new WrappedSpan(
      this._serviceName,
      this._opType,
      this._tracer,
      parentSpan,
      this._startTime
    )
  }

  /**
   * @internal
   */
  processCoreSpan(coreSpan?: CppWrapperSdkSpan): void {
    if (!coreSpan) {
      return
    }
    this._wrappedSpan.processCoreSpan(coreSpan)
    this._processedCoreSpan = true
  }

  /**
   * @internal
   */
  setRequestHttpAttributes(options?: HttpOpAttributesOptions): void {
    const opAttrs = getAttributesForHttpOpType(
      this._opType as HttpOpType,
      options
    )
    for (const [k, v] of Object.entries(opAttrs)) {
      this._wrappedSpan.setAttribute(k, v)
    }
  }

  /**
   * @internal
   */
  setRequestKeyValueAttributes(
    cppDocId: CppDocumentId,
    durability?: CppDurabilityLevel
  ): void {
    const opAttrs = getAttributesForKeyValueOpType(
      this._opType as KeyValueOp,
      cppDocId,
      durability
    )
    for (const [k, v] of Object.entries(opAttrs)) {
      this._wrappedSpan.setAttribute(k, v)
    }
    // TODO: meter attrs
  }
}

/**
 * @internal
 */
class ObservableRequestHandlerNoOpTracerImpl {
  private _opType: OpType
  private _wrappedSpan: WrappedSpan | undefined
  constructor(
    opType: OpType,
    _observabilityInstruments: ObservabilityInstruments,
    _parentSpan?: RequestSpan
  ) {
    this._opType = opType
  }

  /**
   * @internal
   */
  get clusterName(): string | undefined {
    return undefined
  }

  /**
   * @internal
   */
  get clusterUUID(): string | undefined {
    return undefined
  }

  /**
   * @internal
   */
  get wrapperSpanName(): string {
    return ''
  }

  /**
   * @internal
   */
  get wrappedSpan(): WrappedSpan | undefined {
    return this._wrappedSpan
  }

  /**
   * @internal
   */
  end(): void {}

  /**
   * @internal
   */
  endWithError(_error?: any): void {}

  /**
   * @internal
   */
  maybeAddEncodingSpan(encodeFn: () => [Buffer, number]): [Buffer, number] {
    return encodeFn()
  }

  /**
   * @internal
   */
  maybeCreateEncodingSpan(encodeFn: () => [Buffer, number]): [Buffer, number] {
    return encodeFn()
  }

  /**
   * @internal
   */
  processCoreSpan(_coreSpan?: CppWrapperSdkSpan): void {}

  /**
   * @internal
   */
  reset(
    _opType: OpType,
    _parentSpan?: RequestSpan,
    _withError: boolean = false
  ): void {}

  /**
   * @internal
   */
  setRequestHttpAttributes(_options?: HttpOpAttributesOptions): void {}

  /**
   * @internal
   */
  setRequestKeyValueAttributes(
    _cppDocId: CppDocumentId,
    _durability?: CppDurabilityLevel
  ): void {}
}

/**
 * @internal
 */
class ObservableRequestHandlerNoOpMeterImpl {
  private _opType: OpType
  constructor(
    opType: OpType,
    _observabilityInstruments: ObservabilityInstruments
  ) {
    this._opType = opType
  }

  /**
   * @internal
   */
  setRequestKeyValueAttributes(
    _cppDocId: CppDocumentId,
    _durability?: CppDurabilityLevel
  ): void {}

  /**
   * @internal
   */
  setRequestHttpAttributes(_options?: HttpOpAttributesOptions): void {}

  /**
   * @internal
   */
  processEnd(
    _clusterName?: string,
    _clusterUUID?: string,
    _error?: any
  ): void {}

  /**
   * @internal
   */
  reset(
    _opType: OpType,
    _clusterName?: string,
    _clusterUUID?: string,
    _error?: any
  ): void {}
}

/**
 * @internal
 */
class ObservableRequestHandlerMeterImpl {
  private _opType: OpType
  private _serviceName: ServiceName
  private readonly _meter: Meter
  private readonly _getClusterLabelsFn:
    | (() => Record<string, string | undefined>)
    | undefined
  private readonly _ignoreTopLevelOp: boolean
  private _startTime: HiResTime
  private _attrs: Record<string, AttributeValue> = {}

  constructor(
    opType: OpType,
    observabilityInstruments: ObservabilityInstruments
  ) {
    this._opType = opType
    this._serviceName = serviceNameFromOpType(opType)
    this._meter = observabilityInstruments.meter
    this._getClusterLabelsFn = observabilityInstruments.clusterLabelsFn
    this._startTime = process.hrtime()
    this._ignoreTopLevelOp = Object.values(DatastructureOp).includes(
      opType as DatastructureOp
    )
  }

  /**
   * @internal
   */
  setRequestKeyValueAttributes(cppDocId: CppDocumentId): void {
    this._attrs = getAttributesForKeyValueOpType(
      this._opType as KeyValueOp,
      cppDocId
    )
  }

  /**
   * @internal
   */
  setRequestHttpAttributes(options?: HttpOpAttributesOptions): void {
    this._attrs = getAttributesForHttpOpType(this._opType as HttpOpType, options)
  }

  /**
   * @internal
   */
  processEnd(clusterName?: string, clusterUUID?: string, error?: any): void {
    const endTime = process.hrtime()
    const duration = hiResTimeToMicros(
      getHiResTimeDelta(this._startTime, endTime)
    )
    if (this._ignoreTopLevelOp) {
      return
    }

    // Get cluster labels if not provided
    if (
      this._getClusterLabelsFn &&
      (clusterName === undefined || clusterUUID === undefined)
    ) {
      const clusterLabels = this._getClusterLabelsFn()
      clusterName = clusterName || clusterLabels.clusterName
      clusterUUID = clusterUUID || clusterLabels.clusterUUID
    }

    // Build final tags
    const tags: Record<string, string> = {
      ...(this._attrs as Record<string, string>),
    }

    if (Object.keys(tags).length === 0) {
      tags[OpAttributeName.SystemName] = 'couchbase'
      tags[OpAttributeName.Service] = this._serviceName
      tags[OpAttributeName.OperationName] = this._getOpName()
      tags[OpAttributeName.ReservedUnit] = OpAttributeName.ReservedUnitSeconds
    } else {
      tags[OpAttributeName.ReservedUnit] = OpAttributeName.ReservedUnitSeconds
    }

    // Add cluster labels
    if (clusterName) {
      tags[OpAttributeName.ClusterName] = clusterName
    }
    if (clusterUUID) {
      tags[OpAttributeName.ClusterUUID] = clusterUUID
    }

    // Handle error
    if (error) {
      this._handleError(tags, error)
    }

    // Record the duration
    this._meter
      .valueRecorder(OpAttributeName.MeterNameOpDuration, tags)
      .recordValue(duration)
  }

  /**
   * @internal
   */
  reset(
    opType: OpType,
    clusterName?: string,
    clusterUUID?: string,
    error?: any
  ): void {
    this.processEnd(clusterName, clusterUUID, error)
    this._opType = opType
    this._serviceName = serviceNameFromOpType(opType)
    this._startTime = process.hrtime()
    this._attrs = {}
  }

  private _getOpName(): string {
    return this._opType.toString()
  }

  private _handleError(tags: Record<string, string>, error: any): void {
    const errorType = error?.constructor?.name || '_OTHER'
    tags[OpAttributeName.ErrorType] = errorType
  }
}

/**
 * @internal
 */
type TracerImpl =
  | ObservableRequestHandlerTracerImpl
  | ObservableRequestHandlerNoOpTracerImpl

/**
 * @internal
 */
type MeterImpl =
  | ObservableRequestHandlerMeterImpl
  | ObservableRequestHandlerNoOpMeterImpl

/**
 * @internal
 */
export class ObservableRequestHandler {
  private _opType: OpType
  private _requestHasEnded: boolean
  private readonly _tracerImpl: TracerImpl
  private readonly _meterImpl: MeterImpl

  constructor(
    opType: OpType,
    observabilityInstruments: ObservabilityInstruments,
    parentSpan?: RequestSpan
  ) {
    this._opType = opType
    this._requestHasEnded = false
    if (
      !observabilityInstruments.tracer ||
      observabilityInstruments.tracer instanceof NoOpTracer
    ) {
      this._tracerImpl = new ObservableRequestHandlerNoOpTracerImpl(
        opType,
        observabilityInstruments,
        parentSpan
      )
    } else {
      this._tracerImpl = new ObservableRequestHandlerTracerImpl(
        opType,
        observabilityInstruments,
        parentSpan
      )
    }
    if (observabilityInstruments.meter instanceof NoOpMeter) {
      this._meterImpl = new ObservableRequestHandlerNoOpMeterImpl(
        opType,
        observabilityInstruments
      )
    } else {
      this._meterImpl = new ObservableRequestHandlerMeterImpl(
        opType,
        observabilityInstruments
      )
    }
  }

  /**
   * @internal
   */
  get opType(): OpType {
    return this._opType
  }

  /**
   * @internal
   */
  get requestHasEnded(): boolean {
    return this._requestHasEnded
  }

  /**
   * @internal
   */
  get wrapperSpanName(): string {
    return this._tracerImpl.wrapperSpanName
  }

  /**
   * @internal
   */
  get wrappedSpan(): WrappedSpan | undefined {
    return this._tracerImpl.wrappedSpan
  }

  /**
   * @internal
   */
  get clusterName(): string | undefined {
    return this._tracerImpl.clusterName
  }

  /**
   * @internal
   */
  get clusterUUID(): string | undefined {
    return this._tracerImpl.clusterUUID
  }

  /**
   * @internal
   */
  end(): void {
    this._requestHasEnded = true
    this._tracerImpl.end()
    this._meterImpl.processEnd(this.clusterName, this.clusterUUID)
  }

  /**
   * @internal
   */
  endWithError(error?: any): void {
    this._requestHasEnded = true
    this._tracerImpl.endWithError(error)
    this._meterImpl.processEnd(this.clusterName, this.clusterUUID, error)
  }

  /**
   * @internal
   */
  maybeAddEncodingSpan(encodeFn: () => [Buffer, number]): [Buffer, number] {
    return this._tracerImpl.maybeAddEncodingSpan(encodeFn)
  }

  /**
   * @internal
   */
  maybeCreateEncodingSpan(encodeFn: () => [Buffer, number]): [Buffer, number] {
    return this._tracerImpl.maybeCreateEncodingSpan(encodeFn)
  }

  /**
   * @internal
   */
  reset(
    opType: OpType,
    parentSpan?: RequestSpan,
    withError: boolean = false
  ): void {
    this._opType = opType
    this._tracerImpl.reset(opType, parentSpan, withError)
    this._meterImpl.reset(
      opType,
      this.clusterName,
      this.clusterUUID,
      withError ? undefined : undefined
    )
  }

  /**
   * @internal
   */
  processCoreSpan(coreSpan?: CppWrapperSdkSpan): void {
    this._tracerImpl.processCoreSpan(coreSpan)
  }

  /**
   * @internal
   */
  setRequestHttpAttributes(options?: HttpOpAttributesOptions): void {
    this._tracerImpl.setRequestHttpAttributes(options)
    this._meterImpl.setRequestHttpAttributes(options)
  }

  /**
   * @internal
   */
  setRequestKeyValueAttributes(
    cppDocId: CppDocumentId,
    durability?: CppDurabilityLevel
  ): void {
    this._tracerImpl.setRequestKeyValueAttributes(cppDocId, durability)
    this._meterImpl.setRequestKeyValueAttributes(cppDocId, durability)
  }
}

/**
 * @internal
 */
class WrappedEncodingSpan {
  constructor(
    public span: RequestSpan,
    public endTime: HiResTime
  ) {}
}

/**
 * @internal
 */
export class WrappedSpan implements RequestSpan {
  private readonly _serviceName: ServiceName
  private readonly _opType: OpType
  private readonly _tracer: RequestTracer
  private readonly _hasMultipleEncodingSpans: boolean
  readonly _requestSpan: RequestSpan
  private _parentSpan: RequestSpan | WrappedSpan | undefined
  private _endedEncodingSpans: boolean
  private _encodingSpan: WrappedEncodingSpan | undefined
  private _encodingSpans: WrappedEncodingSpan[] | undefined
  private _clusterName: string | undefined
  private _clusterUUID: string | undefined

  constructor(
    serviceName: ServiceName,
    opType: OpType,
    tracer: RequestTracer,
    parentSpan?: RequestSpan | WrappedSpan,
    startTime?: HiResTime
  ) {
    this._serviceName = serviceName
    this._opType = opType
    this._tracer = tracer
    this._parentSpan = parentSpan
    // requestSpan's parent needs to be a RequestSpan
    const pSpan =
      this._parentSpan instanceof WrappedSpan
        ? this._parentSpan._requestSpan
        : this._parentSpan
    this._hasMultipleEncodingSpans = this._opType == KeyValueOp.MutateIn
    this._requestSpan = this._createRequestSpan(this._opType, pSpan, startTime)
    this._endedEncodingSpans = false
  }

  /**
   * @internal
   */
  get clusterName(): string | undefined {
    return this._clusterName
  }

  /**
   * @internal
   */
  get clusterUUID(): string | undefined {
    return this._clusterUUID
  }

  /**
   * @internal
   */
  get name(): string {
    return this._opType
  }

  /**
   * @internal
   */
  get requestSpan(): RequestSpan {
    return this._requestSpan
  }

  /**
   * @internal
   */
  maybeAddEncodingSpan(encodeFn: () => [Buffer, number]): [Buffer, number] {
    if (!this._hasMultipleEncodingSpans) {
      return encodeFn()
    }

    if (!this._encodingSpans) {
      this._encodingSpans = []
    }
    const encodingSpan = this._tracer.requestSpan(
      OpAttributeName.EncodingSpanName,
      this._requestSpan
    )
    encodingSpan.setAttribute(OpAttributeName.SystemName, 'couchbase')
    try {
      const encodedOutput = encodeFn()
      return encodedOutput
    } catch (e) {
      encodingSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: getErrorMessage(e),
      })
      throw e
    } finally {
      // we wait to set the end time until we process the underylying
      // core span so that we can add the cluster_[name|uuid] attributes
      this._encodingSpans.push(
        new WrappedEncodingSpan(encodingSpan, process.hrtime())
      )
    }
  }

  /**
   * @internal
   */
  maybeCreateEncodingSpan(encodeFn: () => [Buffer, number]): [Buffer, number] {
    // mutateIn can have multiple encoding spans, should use maybeAddEncodingSpan instead
    if (this._hasMultipleEncodingSpans) {
      return encodeFn()
    }
    const encodingSpan = this._tracer.requestSpan(
      OpAttributeName.EncodingSpanName,
      this._requestSpan
    )
    encodingSpan.setAttribute(OpAttributeName.SystemName, 'couchbase')
    try {
      const encodedOutput = encodeFn()
      return encodedOutput
    } catch (e) {
      encodingSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: getErrorMessage(e),
      })
      throw e
    } finally {
      // we wait to set the end time until we process the underylying
      // core span so that we can add the cluster_[name|uuid] attributes
      this._encodingSpan = new WrappedEncodingSpan(
        encodingSpan,
        process.hrtime()
      )
    }
  }

  /**
   * @internal
   */
  _setAttributeOnAllSpans(
    attrName: OpAttributeName,
    attrValue: AttributeValue,
    skip_encoding_span?: boolean
  ): void {
    this.setAttribute(attrName, attrValue)
    if (this._parentSpan instanceof WrappedSpan) {
      this._parentSpan._setAttributeOnAllSpans(attrName, attrValue)
    }
    if (skip_encoding_span) {
      return
    }
    if (this._encodingSpans instanceof Array) {
      for (const span of this._encodingSpans) {
        span.span.setAttribute(attrName, attrValue)
      }
    } else if (this._encodingSpan) {
      this._encodingSpan.span.setAttribute(attrName, attrValue)
    }
  }

  /**
   * @internal
   */
  _maybeSetAttributeFromCoreSpan(
    coreSpan: CppWrapperSdkSpan,
    attrName: CppOpAttributeName | OpAttributeName,
    skip_encoding_span?: boolean
  ): void {
    let attrVal: AttributeValue | undefined
    const coreSpanAttr = coreSpan.attributes?.[attrName as string]
    if (coreSpanAttr) {
      attrVal = coreSpanAttr
    }

    if (typeof attrVal === 'undefined' && (attrName as string) == 'retries') {
      attrVal = 0
    }

    if (typeof attrVal !== 'undefined') {
      let filteredAttrName
      if (isCppAttribute(attrName)) {
        filteredAttrName = CppOpAttributeNameToOpAttributeNameMap[attrName]
      } else {
        filteredAttrName = attrName
      }
      this._setAttributeOnAllSpans(
        filteredAttrName,
        attrVal,
        skip_encoding_span
      )
    }
  }

  /**
   * @internal
   */
  _buildCoreSpans(
    coreSpans: CppWrapperSdkChildSpan[],
    parentSpan?: RequestSpan | WrappedSpan
  ): void {
    for (const span of coreSpans) {
      if (span.name === OpAttributeName.DispatchSpanName) {
        this._buildDispatchCoreSpan(span, parentSpan)
      } else {
        this._buildNonDispatchCoreSpan(span, parentSpan)
      }
    }
  }

  /**
   * @internal
   */
  _buildDispatchCoreSpan(
    coreSpan: CppWrapperSdkChildSpan,
    parentSpan?: RequestSpan | WrappedSpan
  ): void {
    const pSpan =
      parentSpan instanceof WrappedSpan ? parentSpan.requestSpan : parentSpan
    const newSpan = this._createRequestSpan(
      coreSpan.name,
      pSpan,
      coreSpan.start
    )
    const children = coreSpan.children
    if (children) {
      this._buildCoreSpans(children, newSpan)
    }
    for (const [attrName, attrVal] of Object.entries(
      coreSpan.attributes ?? {}
    )) {
      newSpan.setAttribute(attrName, attrVal)
    }
    newSpan.end(coreSpan.end)
  }

  /**
   * @internal
   */
  _buildNonDispatchCoreSpan(
    coreSpan: CppWrapperSdkChildSpan,
    parentSpan?: RequestSpan | WrappedSpan
  ): void {
    const pSpan =
      parentSpan instanceof WrappedSpan ? parentSpan.requestSpan : parentSpan
    const newSpan = new WrappedSpan(
      this._serviceName,
      coreSpan.name as OpType,
      this._tracer,
      pSpan,
      coreSpan.start
    )
    const children = coreSpan.children
    if (children) {
      this._buildCoreSpans(children, newSpan)
    }
    for (const [attrName, attrVal] of Object.entries(
      coreSpan.attributes ?? {}
    )) {
      newSpan.setAttribute(attrName, attrVal)
    }
    newSpan.end(coreSpan.end)
  }

  /**
   * @internal
   */
  _endEncodingSpans(): void {
    if (this._endedEncodingSpans) {
      return
    }
    this._endedEncodingSpans = true
    if (this._encodingSpans instanceof Array) {
      for (const span of this._encodingSpans) {
        span.span.end(span.endTime)
      }
    } else if (this._encodingSpan) {
      this._encodingSpan.span.end(this._encodingSpan.endTime)
    }
  }

  /**
   * @internal
   */
  processCoreSpan(coreSpan: CppWrapperSdkSpan): void {
    this._maybeSetAttributeFromCoreSpan(
      coreSpan,
      CppOpAttributeName.ClusterName
    )
    this._maybeSetAttributeFromCoreSpan(
      coreSpan,
      CppOpAttributeName.ClusterUUID
    )
    this._maybeSetAttributeFromCoreSpan(
      coreSpan,
      CppOpAttributeName.RetryCount,
      true
    )
    // we can now end encoding spans since we have added (or atleast attempted) the cluster_[name|uuid] attributes
    this._endEncodingSpans()
    if (coreSpan.children) {
      this._buildCoreSpans(coreSpan.children, this)
    }
  }

  /**
   * @internal
   */
  setClusterLabels(clusterLabels: Record<string, string | undefined>): void {
    if (clusterLabels.clusterName) {
      this._setAttributeOnAllSpans(
        OpAttributeName.ClusterName,
        clusterLabels.clusterName
      )
    }
    if (clusterLabels.clusterUUID) {
      this._setAttributeOnAllSpans(
        OpAttributeName.ClusterUUID,
        clusterLabels.clusterUUID
      )
    }
  }

  /**
   * @internal
   */
  setRetryAttribute(retrCount: number = 0): void {
    this._setAttributeOnAllSpans(OpAttributeName.RetryCount, retrCount, true)
  }

  /**
   * @internal
   */
  addEvent(): void {}

  /**
   * @internal
   */
  end(endTime?: TimeInput): void {
    this._requestSpan.end(endTime)
    this._endEncodingSpans()
  }

  /**
   * @internal
   */
  setAttribute(key: string, value: AttributeValue): void {
    if (key === OpAttributeName.ClusterName) {
      this._clusterName = value as string
    } else if (key === OpAttributeName.ClusterUUID) {
      this._clusterUUID = value as string
    }
    this._requestSpan.setAttribute(key, value)
  }

  /**
   * @internal
   */
  setStatus(status: SpanStatus): void {
    this._requestSpan?.setStatus(status)
  }

  /**
   * @internal
   */
  _createRequestSpan(
    spanName: string,
    parentSpan?: RequestSpan,
    startTime?: HiResTime
  ): RequestSpan {
    return this._tracer.requestSpan(spanName, parentSpan, startTime)
  }
}
