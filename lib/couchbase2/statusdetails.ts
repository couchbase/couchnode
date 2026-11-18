import type * as grpc from '@grpc/grpc-js'

import type { Any__Output as AnyOutputPb } from './generated/google/protobuf/Any'
import type { DebugInfo__Output as DebugInfoOutputPb } from './generated/google/rpc/DebugInfo'
import type { ErrorInfo__Output as ErrorInfoOutputPb } from './generated/google/rpc/ErrorInfo'
import type { PreconditionFailure__Output as PreconditionFailureOutputPb } from './generated/google/rpc/PreconditionFailure'
import type { RequestInfo__Output as RequestInfoOutputPb } from './generated/google/rpc/RequestInfo'
import type { ResourceInfo__Output as ResourceInfoOutputPb } from './generated/google/rpc/ResourceInfo'
import type { Status__Output as StatusOutputPb } from './generated/google/rpc/Status'
import { loadSchema } from './schema'

/**
 * The trailer the gateway explains a failure in, a serialized
 * `google.rpc.Status`.
 *
 * @internal
 */
export const STATUS_DETAILS_KEY = 'grpc-status-details-bin'

/**
 * What the gateway said about a failure, beyond its status code. Each detail
 * is the first of its type in the status; one that is missing, or that does
 * not decode, is undefined.
 *
 * @internal
 */
export interface StatusDetails {
  /**
   * The status's own message, which may be empty.
   */
  message: string

  /**
   * The resource the failure concerns.
   */
  resourceInfo?: ResourceInfoOutputPb

  /**
   * The machine-readable reason for the failure.
   */
  errorInfo?: ErrorInfoOutputPb

  /**
   * The preconditions that failed.
   */
  preconditionFailure?: PreconditionFailureOutputPb

  /**
   * Debugging information from the gateway.
   */
  debugInfo?: DebugInfoOutputPb

  /**
   * The gateway's identifier for the request.
   */
  requestInfo?: RequestInfoOutputPb
}

/**
 * The details the gateway sent with a failure that ended with `code`, or
 * undefined when there is no trailer, it does not decode, or it describes a
 * status other than `code`. A failure raised on the client side, such as a
 * deadline, carries no trailer.
 *
 * @internal
 */
export function readStatusDetails(
  code: number,
  metadata: grpc.Metadata | undefined
): StatusDetails | undefined {
  const payload = metadata?.get(STATUS_DETAILS_KEY)[0]
  if (!Buffer.isBuffer(payload)) {
    return undefined
  }

  const rpc = loadSchema().google.rpc
  let status
  try {
    status = rpc.Status.deserialize(payload)
  } catch {
    return undefined
  }
  if (status.code !== code) {
    return undefined
  }
  return statusDetailsFromProto(status)
}

/**
 * The details of a status already decoded, such as the one the gateway
 * sends for each spec of a lookup-in.
 *
 * @internal
 */
export function statusDetailsFromProto(
  status: Pick<StatusOutputPb, 'message' | 'details'>
): StatusDetails {
  const rpc = loadSchema().google.rpc
  const details = status.details ?? []
  return {
    message: status.message ?? '',
    resourceInfo: unpackFirst(details, 'ResourceInfo', rpc.ResourceInfo),
    errorInfo: unpackFirst(details, 'ErrorInfo', rpc.ErrorInfo),
    preconditionFailure: unpackFirst(
      details,
      'PreconditionFailure',
      rpc.PreconditionFailure
    ),
    debugInfo: unpackFirst(details, 'DebugInfo', rpc.DebugInfo),
    requestInfo: unpackFirst(details, 'RequestInfo', rpc.RequestInfo),
  }
}

/**
 * The first detail whose type URL names `google.rpc.<name>`, decoded, or
 * undefined when there is none or it does not decode.
 *
 * @internal
 */
function unpackFirst<T>(
  details: AnyOutputPb[],
  name: string,
  type: { deserialize: (data: Buffer) => T }
): T | undefined {
  const typeName = `google.rpc.${name}`
  const detail = details.find(
    (d) => d.type_url.slice(d.type_url.lastIndexOf('/') + 1) === typeName
  )
  if (!detail) {
    return undefined
  }
  try {
    return type.deserialize(detail.value)
  } catch {
    return undefined
  }
}
