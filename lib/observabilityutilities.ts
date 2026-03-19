/*
eslint
jsdoc/require-jsdoc: off,
@typescript-eslint/no-empty-interface: off
*/
import { AnalyticsQueryOptions } from './analyticstypes'
import binding, {
  CppDocumentId,
  CppDurabilityLevel,
  HiResTime,
} from './binding'
import {
  AttributeValue,
  HttpOpType,
  KeyValueOp,
  OpAttributeName,
  serviceNameFromOpType,
  TimeInput,
} from './observabilitytypes'
import { QueryOptions } from './querytypes'

// Define standard time constants
const MILLIS_PER_SECOND = 1000
const NANOS_PER_SECOND = 1_000_000_000
const MICROS_PER_SECOND = 1_000_000
const NANOS_PER_MILLI = 1_000_000

// Take a snapshot the moment the SDK loads
const TIME_ORIGIN_MS = Date.now()
const HRTIME_ORIGIN = process.hrtime()

// Convert the absolute origin into [seconds, nanoseconds]
const ORIGIN_SECONDS = Math.floor(TIME_ORIGIN_MS / MILLIS_PER_SECOND)
const ORIGIN_NANOS = (TIME_ORIGIN_MS % MILLIS_PER_SECOND) * NANOS_PER_MILLI

/**
 * @internal
 */
export type StreamingOptions = AnalyticsQueryOptions | QueryOptions

/**
 * Generates an absolute Unix epoch time with nanosecond precision.
 * @internal
 */
export function getEpochHiResTime(): [number, number] {
  // Get the current monotonic time
  const nowHrTime = process.hrtime()

  // Calculate exactly how much time has passed since our anchor snapshot
  const [deltaSeconds, deltaNanos] = getHiResTimeDelta(HRTIME_ORIGIN, nowHrTime)

  // Add the high-res delta to our absolute epoch anchor
  let epochSeconds = ORIGIN_SECONDS + deltaSeconds
  let epochNanos = ORIGIN_NANOS + deltaNanos

  // Handle nanosecond overflow (if nanos exceed 1 second, carry it over)
  if (epochNanos >= NANOS_PER_SECOND) {
    epochSeconds += 1
    epochNanos -= NANOS_PER_SECOND
  }

  return [epochSeconds, epochNanos]
}

/**
 * @internal
 */
export function hiResTimeToMicros(hrTime: HiResTime): number {
  return hrTime[0] * MICROS_PER_SECOND + hrTime[1] / MILLIS_PER_SECOND
}

/**
 * @internal
 */
export function getHiResTimeDelta(start: HiResTime, end: HiResTime): HiResTime {
  let seconds = end[0] - start[0]
  let nanoseconds = end[1] - start[1]
  // Handle nanosecond underflow
  if (nanoseconds < 0) {
    seconds -= 1
    nanoseconds += NANOS_PER_SECOND
  }
  return [seconds, nanoseconds]
}

/**
 * @internal
 */
export function millisToHiResTime(millis: number): HiResTime {
  const seconds = Math.floor(millis / MILLIS_PER_SECOND)
  const remainingMillis = millis - seconds * MILLIS_PER_SECOND
  const nanoseconds = remainingMillis * MICROS_PER_SECOND
  return [seconds, nanoseconds]
}

/**
 * @internal
 */
export function getLatestTime(timeA: HiResTime, timeB: HiResTime): HiResTime {
  // first compare seconds
  if (timeA[0] > timeB[0]) {
    return timeA
  }
  if (timeA[0] < timeB[0]) {
    return timeB
  }

  // If seconds are exactly the same, compare the nanoseconds
  if (timeA[1] >= timeB[1]) {
    return timeA
  }

  return timeB
}

/**
 * @internal
 */
export function getCoreSpanEndTime(coreSpanEndTime: HiResTime): HiResTime {
  // Mitigate Node.js vs C++ clock skew. A parent span must fully encapsulate
  // its children, so we ensure the parent ends at or after the core child's end time.
  const currentTime = timeInputToHiResTime()
  return getLatestTime(currentTime, coreSpanEndTime)
}

/**
 * @internal
 */
export function timeInputToHiResTime(input?: TimeInput): HiResTime {
  if (typeof input === 'undefined') {
    return getEpochHiResTime()
  }
  // If a Date object is provided, extract the epoch milliseconds
  if (input instanceof Date) {
    return millisToHiResTime(input.getTime())
  }
  // If a number is provided, assume it is epoch milliseconds
  if (typeof input === 'number') {
    return millisToHiResTime(input)
  }

  return input
}

/**
 * @internal
 */
export function getAttributesForKeyValueOpType(
  opType: KeyValueOp,
  cppDocId: CppDocumentId,
  durability?: CppDurabilityLevel
): {
  [key: string]: AttributeValue
} {
  const attributes: { [key: string]: AttributeValue } = {
    [OpAttributeName.SystemName]: 'couchbase',
    [OpAttributeName.Service]: serviceNameFromOpType(opType),
    [OpAttributeName.OperationName]: opType,
    [OpAttributeName.BucketName]: cppDocId.bucket,
    [OpAttributeName.ScopeName]: cppDocId.scope,
    [OpAttributeName.CollectionName]: cppDocId.collection,
  }
  if (durability && durability != binding.durability_level.none) {
    if (durability === binding.durability_level.majority) {
      attributes[OpAttributeName.DurabilityLevel] = 'majority'
    } else if (
      durability === binding.durability_level.majority_and_persist_to_active
    ) {
      attributes[OpAttributeName.DurabilityLevel] =
        'majority_and_persist_to_active'
    } else if (durability === binding.durability_level.persist_to_majority) {
      attributes[OpAttributeName.DurabilityLevel] = 'persist_to_majority'
    }
  }
  return attributes
}

/**
 * @internal
 */
export interface HttpOpAttributesOptions {
  statement?: string
  queryOptions?: StreamingOptions
  queryContext?: string
  bucketName?: string
  scopeName?: string
  collectionName?: string
}

/**
 * @internal
 */
export function getAttributesForHttpOpType(
  opType: HttpOpType,
  options?: HttpOpAttributesOptions
): {
  [key: string]: AttributeValue
} {
  const attributes: { [key: string]: AttributeValue } = {
    [OpAttributeName.SystemName]: 'couchbase',
    [OpAttributeName.Service]: serviceNameFromOpType(opType),
    [OpAttributeName.OperationName]: opType,
  }

  if (options?.queryOptions?.parameters && options.statement) {
    attributes[OpAttributeName.QueryStatement] = options.statement
  }

  if (options?.bucketName) {
    attributes[OpAttributeName.BucketName] = options.bucketName
  }

  if (options?.scopeName) {
    attributes[OpAttributeName.ScopeName] = options.scopeName
  }

  if (options?.collectionName) {
    attributes[OpAttributeName.CollectionName] = options.collectionName
  }

  if (options?.queryContext) {
    const [bucketName, scopeName] = options.queryContext
      .split('.')
      .map((str) => str.replace(/`/g, ''))
    attributes[OpAttributeName.BucketName] = bucketName
    attributes[OpAttributeName.ScopeName] = scopeName
  }

  return attributes
}
