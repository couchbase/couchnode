import * as grpc from '@grpc/grpc-js'

import type { ObservableRequestHandler } from '../observabilityhandler'
import { DispatchAttributeName, OpAttributeName } from '../observabilitytypes'
import { OTelWrapperSpan } from '../oteltracer'

/**
 * The gateway's address, as each attempt's span reports it.
 *
 * @internal
 */
export interface GatewayAddress {
  /**
   * The host, an IPv6 literal without its brackets.
   */
  host: string

  /**
   * The port.
   */
  port: number
}

/**
 * The full name of the RPC a call makes, `<service>/<method>`, as the
 * gateway names its own span for the call.
 *
 * @internal
 */
export function rpcName(path: string): string {
  return path.startsWith('/') ? path.slice(1) : path
}

/**
 * The interceptor that traces each attempt of a request under its
 * operation's span, or undefined when the operation's span is not recording.
 *
 * Each attempt is one gRPC call, with a span named for the RPC. Under the
 * OpenTelemetry tracer the call carries the span's trace context, so the
 * gateway's span is its child. The span ends with the call's status (for a
 * stream, when the stream ends) and is marked failed on any status but
 * `OK`, unless the SDK canceled the call itself.
 *
 * @internal
 */
export function attemptInterceptor(
  obs: ObservableRequestHandler | null | undefined,
  address: GatewayAddress
): grpc.Interceptor | undefined {
  const wrapped = obs?.wrappedSpan
  if (!wrapped || !wrapped.isRecording()) {
    return undefined
  }

  return (options, nextCall) => {
    const span = wrapped.startDispatchSpan(
      rpcName(options.method_definition.path)
    )
    span.setAttribute(OpAttributeName.SystemName, 'couchbase')
    span.setAttribute(DispatchAttributeName.ServerAddress, address.host)
    span.setAttribute(DispatchAttributeName.ServerPort, address.port)

    let canceled = false
    let ended = false
    return new grpc.InterceptingCall(nextCall(options), {
      start(metadata, _listener, next) {
        let sent = metadata
        if (span instanceof OTelWrapperSpan) {
          const carrier: Record<string, string> = {}
          span._injectTraceContext(carrier)
          // The metadata is shared by every call on the channel.
          sent = metadata.clone()
          for (const [key, value] of Object.entries(carrier)) {
            sent.set(key, value)
          }
        }
        next(sent, {
          onReceiveStatus(status, nextStatus) {
            if (!ended) {
              ended = true
              wrapped.endDispatchSpan(
                span,
                status.code !== grpc.status.OK && !canceled
              )
            }
            nextStatus(status)
          },
        })
      },
      cancel(next) {
        canceled = true
        next()
      },
    })
  }
}
