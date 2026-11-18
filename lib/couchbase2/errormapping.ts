import * as grpc from '@grpc/grpc-js'

import { ErrorContext, GenericErrorContext } from '../errorcontexts'
import {
  AmbiguousTimeoutError,
  AuthenticationFailureError,
  AuthorizationFailureError,
  BucketExistsError,
  BucketNotFlushableError,
  BucketNotFoundError,
  CasMismatchError,
  CollectionExistsError,
  CollectionNotFoundError,
  CouchbaseError,
  DeltaInvalidError,
  DocumentExistsError,
  DocumentLockedError,
  DocumentNotFoundError,
  DocumentNotJsonError,
  DocumentNotLockedError,
  DocumentTooDeepError,
  DurabilityImpossibleError,
  FeatureNotAvailableError,
  IndexExistsError,
  IndexNotFoundError,
  InternalServerFailureError,
  InvalidArgumentError,
  NumberTooBigError,
  PathExistsError,
  PathMismatchError,
  PathNotFoundError,
  RequestCanceledError,
  ScopeExistsError,
  ScopeNotFoundError,
  ServiceNotAvailableError,
  UnambiguousTimeoutError,
  ValueInvalidError,
  ValueTooLargeError,
} from '../errors'
import { readStatusDetails, StatusDetails } from './statusdetails'

/**
 * Why a failed couchbase2 request may be sent again. The names are the ones
 * a classic connection records in an error context's `retry_reasons`.
 *
 * @internal
 */
export type RetryReason = 'service_not_available' | 'key_value_locked'

/**
 * An SDK error class whose constructor takes a cause and a context.
 *
 * @internal
 */
export type ErrorClass = new (
  cause?: Error,
  context?: ErrorContext
) => CouchbaseError

/**
 * What a failure says about itself, the part of its error context that does
 * not depend on the request's history.
 *
 * @internal
 */
export type GatewayErrorFields = Pick<
  GenericErrorContext,
  | 'message'
  | 'status_code'
  | 'precondition_violation'
  | 'resource_name'
  | 'resource_type'
  | 'reason'
  | 'debug_info'
  | 'request_info'
>

/**
 * What the request knows about its own history, the rest of the error
 * context.
 *
 * @internal
 */
export type RequestErrorFields = Pick<
  GenericErrorContext,
  | 'last_dispatched_to'
  | 'last_dispatched_from'
  | 'retry_attempts'
  | 'retry_reasons'
  | 'last_error'
>

/**
 * A failure resolved to plain values: the error to raise and whether to
 * retry first. It is built into an error only when the request gives up, so
 * that the context can carry the whole retry history.
 *
 * @internal
 */
export interface MappedError {
  /**
   * The class to raise, or undefined for a plain {@link CouchbaseError}
   * carrying the gateway's message, for a failure with no more specific
   * error.
   */
  errorClass: ErrorClass | undefined

  /**
   * The failure's own context fields.
   */
  fields: GatewayErrorFields

  /**
   * Set when the failure is worth retrying.
   */
  retryReason: RetryReason | undefined

  /**
   * A value from the gateway that has no mapping here, for the log.
   */
  unrecognized?: string
}

/**
 * The error classes for `NOT_FOUND`, by `ResourceInfo.resource_type`.
 *
 * @internal
 */
export const NOT_FOUND: Readonly<Record<string, ErrorClass>> = {
  document: DocumentNotFoundError,
  bucket: BucketNotFoundError,
  scope: ScopeNotFoundError,
  collection: CollectionNotFoundError,
  queryindex: IndexNotFoundError,
  searchindex: IndexNotFoundError,
  path: PathNotFoundError,
}

/**
 * The error classes for `ALREADY_EXISTS`, by `ResourceInfo.resource_type`.
 *
 * @internal
 */
export const ALREADY_EXISTS: Readonly<Record<string, ErrorClass>> = {
  document: DocumentExistsError,
  bucket: BucketExistsError,
  scope: ScopeExistsError,
  collection: CollectionExistsError,
  queryindex: IndexExistsError,
  searchindex: IndexExistsError,
  path: PathExistsError,
}

/**
 * The error classes for `FAILED_PRECONDITION`, by the first violation's
 * type. A type missing here has no SDK error of its own and is a plain
 * {@link CouchbaseError}.
 *
 * @internal
 */
export const PRECONDITION_FAILED: Readonly<Record<string, ErrorClass>> = {
  LOCKED: DocumentLockedError,
  NOT_LOCKED: DocumentNotLockedError,
  DOC_TOO_DEEP: DocumentTooDeepError,
  DOC_NOT_JSON: DocumentNotJsonError,
  PATH_MISMATCH: PathMismatchError,
  VALUE_OUT_OF_RANGE: ValueInvalidError,
  PATH_VALUE_OUT_OF_RANGE: NumberTooBigError,
  VALUE_TOO_LARGE: ValueTooLargeError,
  DOC_NOT_NUMERIC: DeltaInvalidError,
  FLUSH_DISABLED: BucketNotFlushableError,
  DURABILITY_IMPOSSIBLE: DurabilityImpossibleError,
}

/**
 * The error classes for codes no detail refines. `DEADLINE_EXCEEDED`
 * depends on the operation and is decided in {@link mapStatus}; a code
 * missing from both is a plain {@link CouchbaseError}.
 *
 * @internal
 */
export const BY_CODE: Readonly<Partial<Record<grpc.status, ErrorClass>>> = {
  [grpc.status.INVALID_ARGUMENT]: InvalidArgumentError,
  [grpc.status.OUT_OF_RANGE]: InvalidArgumentError,
  [grpc.status.UNIMPLEMENTED]: FeatureNotAvailableError,
  [grpc.status.UNAUTHENTICATED]: AuthenticationFailureError,
  [grpc.status.CANCELLED]: RequestCanceledError,
  [grpc.status.UNAVAILABLE]: ServiceNotAvailableError,
  [grpc.status.INTERNAL]: InternalServerFailureError,
}

/**
 * Looks up `key` in `table`, ignoring inherited properties such as `constructor`.
 *
 * @internal
 */
function lookup(
  table: Readonly<Record<string, ErrorClass>>,
  key: string
): ErrorClass | undefined {
  return Object.prototype.hasOwnProperty.call(table, key)
    ? table[key]
    : undefined
}

/**
 * Whether `err` is a failed call as grpc-js reports it.
 *
 * @internal
 */
export function isServiceError(err: unknown): err is grpc.ServiceError {
  return (
    err instanceof Error &&
    typeof (err as Partial<grpc.ServiceError>).code === 'number' &&
    (err as Partial<grpc.ServiceError>).metadata instanceof grpc.Metadata
  )
}

/**
 * `err`, thrown by a call, as the SDK sees it. `readOnly` decides whether a
 * deadline leaves the outcome ambiguous. Anything that is not a failed call,
 * such as a request that could not be serialized, is mapped as `UNKNOWN`.
 *
 * @internal
 */
export function mapServiceError(err: unknown, readOnly: boolean): MappedError {
  if (!isServiceError(err)) {
    const message = err instanceof Error ? err.message : String(err)
    return mapStatus(grpc.status.UNKNOWN, message, undefined, readOnly)
  }
  return mapStatus(
    err.code,
    err.details,
    readStatusDetails(err.code, err.metadata),
    readOnly
  )
}

/**
 * Maps a failure's `code` and `message`, refined by whatever `details` the
 * gateway sent. A missing detail falls back to the code alone. Every detail
 * the gateway sent goes into the context whatever the code, while the code
 * decides which of them choose the error class.
 *
 * @internal
 */
export function mapStatus(
  code: grpc.status,
  message: string,
  details: StatusDetails | undefined,
  readOnly: boolean
): MappedError {
  const resource = details?.resourceInfo
  const violation =
    details?.preconditionFailure?.violations[0]?.type || undefined
  const reason = details?.errorInfo?.reason || undefined

  const fields: GatewayErrorFields = {
    message: details?.message || message || `gRPC status ${statusName(code)}`,
    status_code: code,
  }
  if (violation !== undefined) {
    fields.precondition_violation = violation
  }
  if (resource) {
    fields.resource_name = resource.resource_name
    fields.resource_type = resource.resource_type
  }
  if (reason !== undefined) {
    fields.reason = reason
  }
  if (details?.debugInfo) {
    fields.debug_info = {
      detail: details.debugInfo.detail,
      stack_entries: [...details.debugInfo.stack_entries],
    }
  }
  if (details?.requestInfo) {
    fields.request_info = {
      request_id: details.requestInfo.request_id,
      serving_data: details.requestInfo.serving_data,
    }
  }

  const mapped: MappedError = {
    errorClass: errorClassFor(
      code,
      resource?.resource_type ?? '',
      violation,
      reason,
      readOnly
    ),
    fields,
    retryReason: retryReasonFor(code, violation),
  }
  const unrecognized = unrecognizedValue(
    code,
    resource?.resource_type ?? '',
    violation,
    reason
  )
  if (unrecognized !== undefined) {
    mapped.unrecognized = unrecognized
  }
  return mapped
}

/**
 * Names the value in a failure that {@link errorClassFor} has no mapping
 * for, or returns undefined when every value is mapped.
 */
function unrecognizedValue(
  code: grpc.status,
  resourceType: string,
  violation: string | undefined,
  reason: string | undefined
): string | undefined {
  switch (code) {
    case grpc.status.NOT_FOUND:
    case grpc.status.ALREADY_EXISTS: {
      const table = code === grpc.status.NOT_FOUND ? NOT_FOUND : ALREADY_EXISTS
      return resourceType === '' || lookup(table, resourceType)
        ? undefined
        : `${statusName(code)} resource type "${resourceType}"`
    }
    case grpc.status.FAILED_PRECONDITION:
      return violation === undefined || lookup(PRECONDITION_FAILED, violation)
        ? undefined
        : `precondition violation "${violation}"`
    case grpc.status.ABORTED:
      return reason === undefined || reason === 'CAS_MISMATCH'
        ? undefined
        : `ABORTED reason "${reason}"`
    case grpc.status.PERMISSION_DENIED:
    case grpc.status.DEADLINE_EXCEEDED:
    case grpc.status.UNKNOWN:
      return undefined
    default:
      return code in BY_CODE ? undefined : `gRPC status ${statusName(code)}`
  }
}

/**
 * The error to raise for `mapped`, its context completed by `request`. The
 * gRPC error is never the cause: what it says is in the context.
 *
 * @internal
 */
export function errorFromMapped(
  mapped: MappedError,
  request: RequestErrorFields
): CouchbaseError {
  const context = new GenericErrorContext({ ...mapped.fields, ...request })
  if (!mapped.errorClass) {
    return new CouchbaseError(mapped.fields.message, undefined, context)
  }
  return new mapped.errorClass(undefined, context)
}

/**
 * Runs `call`, raising `FeatureNotAvailableError` in place of an invalid
 * argument the server explains with `phrase`: a setting the server refuses
 * for what the cluster or the bucket is, rather than for its value.
 *
 * @internal
 */
export async function unavailableWhen<T>(
  phrase: string,
  call: () => Promise<T>
): Promise<T> {
  try {
    return await call()
  } catch (e) {
    if (
      e instanceof InvalidArgumentError &&
      e.context instanceof GenericErrorContext &&
      e.context.message.includes(phrase)
    ) {
      throw new FeatureNotAvailableError(undefined, e.context)
    }
    throw e
  }
}

/**
 * The SDK error class for a failure.
 *
 * @internal
 */
function errorClassFor(
  code: grpc.status,
  resourceType: string,
  violation: string | undefined,
  reason: string | undefined,
  readOnly: boolean
): ErrorClass | undefined {
  switch (code) {
    case grpc.status.NOT_FOUND:
      return lookup(NOT_FOUND, resourceType)
    case grpc.status.ALREADY_EXISTS:
      return lookup(ALREADY_EXISTS, resourceType)
    case grpc.status.FAILED_PRECONDITION:
      return lookup(PRECONDITION_FAILED, violation ?? '')
    case grpc.status.ABORTED:
      return reason === 'CAS_MISMATCH' ? CasMismatchError : undefined
    case grpc.status.PERMISSION_DENIED:
      // Being refused as a user is a failure to authenticate; being refused a
      // resource is not.
      return resourceType === '' || resourceType === 'user'
        ? AuthenticationFailureError
        : AuthorizationFailureError
    case grpc.status.DEADLINE_EXCEEDED:
      // A write that ran out of time may still have been applied; a read
      // changed nothing either way.
      return readOnly ? UnambiguousTimeoutError : AmbiguousTimeoutError
    default:
      return BY_CODE[code]
  }
}

/**
 * Why a failure may be retried, or undefined when it may not. Both reasons
 * allow a non-idempotent operation to be sent again, because the gateway did
 * not apply it.
 *
 * @internal
 */
function retryReasonFor(
  code: grpc.status,
  violation: string | undefined
): RetryReason | undefined {
  if (code === grpc.status.UNAVAILABLE) {
    return 'service_not_available'
  }
  if (code === grpc.status.FAILED_PRECONDITION && violation === 'LOCKED') {
    return 'key_value_locked'
  }
  return undefined
}

/**
 * The name of a gRPC status code, such as `NOT_FOUND`.
 *
 * @internal
 */
export function statusName(code: number): string {
  return grpc.status[code] ?? String(code)
}
