import {
  AttributeValue,
  SpanStatus,
  TimeInput,
  SpanStatusCode,
} from './observabilitytypes'
import { SDK_VERSION } from './version'
import { RequestSpan, RequestTracer } from './tracing'

// This block is completely erased when compiled to JavaScript.
/* eslint-disable n/no-missing-import */
import type {
  Tracer as OTelTracer,
  TracerProvider as OTelTracerProvider,
  Span as OTelSpan,
  TimeInput as OTelTimeInput,
  AttributeValue as OTelAttributeValue,
  Context as OTelContext,
} from '@opentelemetry/api'
/* eslint-enable n/no-missing-import */

// Dynamic Runtime Require (Bundler-safe)
let otelApi: typeof import('@opentelemetry/api') | null = null
let HAS_OTEL = false

try {
  // Hiding the string prevents Webpack/Vite from throwing missing dependency errors
  const moduleName = '@opentelemetry/api'
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  otelApi = require(moduleName) as typeof import('@opentelemetry/api')
  HAS_OTEL = true
} catch (_err) {
  HAS_OTEL = false
}

/**
 * Wrapper class for OpenTelemetry Span that implements RequestSpan interface.
 */
export class OTelWrapperSpan implements RequestSpan {
  public readonly name: string
  public readonly _otelSpan: OTelSpan

  /**
   * Creates an instance of OTelWrapperSpan.
   *
   * @param otelSpan - OpenTelemetry Span to wrap.
   * @param name - The name of the span.
   */
  constructor(otelSpan: OTelSpan, name: string) {
    this._otelSpan = otelSpan
    this.name = name
  }

  /**
   * Sets an attribute on the span.
   *
   * @param key - The attribute key.
   * @param value - The attribute value.
   */
  setAttribute(key: string, value: AttributeValue): void {
    this._otelSpan.setAttribute(key, value as OTelAttributeValue)
  }

  /**
   * Adds an event to the span.
   *
   * @param key - The event key.
   * @param startTime - Optional timestamp for the event.
   */
  addEvent(key: string, startTime?: TimeInput): void {
    this._otelSpan.addEvent(key, startTime as OTelTimeInput)
  }

  /**
   * Sets the status of the span.
   *
   * @param status - The SpanStatus to set.
   */
  setStatus(status: SpanStatus): void {
    // We use the non-null assertion (!) because this class cannot be
    // instantiated unless otelApi successfully loaded.
    let otelCode = otelApi!.SpanStatusCode.UNSET

    if (status.code === SpanStatusCode.OK) {
      otelCode = otelApi!.SpanStatusCode.OK
    } else if (status.code === SpanStatusCode.ERROR) {
      otelCode = otelApi!.SpanStatusCode.ERROR
    }

    this._otelSpan.setStatus({
      code: otelCode,
      message: status.message,
    })
  }

  /**
   * Ends the span.
   *
   * @param endTime - Optional timestamp for when the span ended.
   */
  end(endTime?: TimeInput): void {
    this._otelSpan.end(endTime as OTelTimeInput)
  }
}

/**
 * Wrapper class for OpenTelemetry Tracer that implements RequestTracer interface.
 */
export class OTelWrapperTracer implements RequestTracer {
  private _tracer: OTelTracer

  /**
   * Creates an instance of OTelWrapperTracer.
   *
   * @param tracer - OpenTelemetry Tracer to wrap.
   */
  constructor(tracer: OTelTracer) {
    this._tracer = tracer
  }

  /**
   * Creates a new request span, optionally with a parent span.
   *
   * @param name - The name of the span.
   * @param parentSpan - Optional parent span for this request.
   * @param startTime - Optional timestamp for when the span started.
   * @returns A RequestSpan instance for the new span.
   */
  requestSpan(
    name: string,
    parentSpan?: RequestSpan,
    startTime?: TimeInput
  ): RequestSpan {
    // Grab the current active context from OTel
    let context: OTelContext | undefined = otelApi!.context.active()

    // If the user passed in a parent span, and it is one of our wrappers,
    // extract the raw OTel span and inject it into a new context.
    if (parentSpan && parentSpan instanceof OTelWrapperSpan) {
      context = otelApi!.trace.setSpan(context, parentSpan._otelSpan)
    }

    // Start the new span using the safely mapped inputs
    const span = this._tracer.startSpan(
      name,
      {
        startTime: startTime as OTelTimeInput,
        kind: otelApi!.SpanKind.CLIENT,
      },
      context
    )

    return new OTelWrapperSpan(span, name)
  }
}

/**
 * Creates an OpenTelemetry wrapper tracer.
 * Throws an Error if @opentelemetry/api is not installed.
 */
export function getOTelTracer(
  tracerProvider?: OTelTracerProvider
): RequestTracer {
  if (!HAS_OTEL || !otelApi) {
    throw new Error(
      'OpenTelemetry is not installed. Please install it with: ' +
        'npm install @opentelemetry/api'
    )
  }

  const pkgName = `com.couchbase.client/nodejs`
  const pkgVersion = SDK_VERSION

  let tracer: OTelTracer

  if (tracerProvider) {
    // Use the explicit provider they passed in
    tracer = tracerProvider.getTracer(pkgName, pkgVersion)
  } else {
    // Fallback to the global OpenTelemetry provider
    tracer = otelApi.trace.getTracer(pkgName, pkgVersion)
  }

  return new OTelWrapperTracer(tracer)
}
