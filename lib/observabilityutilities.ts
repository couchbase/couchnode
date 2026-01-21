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

const MILLIS_PER_SECOND = 1e3
const MICROS_PER_SECOND = 1e6
const NANOS_PER_SECOND = 1e9

/**
 * @internal
 */
export type StreamingOptions = AnalyticsQueryOptions | QueryOptions

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

/**
 * @internal
 */
export function timeInputToHiResTime(input?: TimeInput): HiResTime {
  if (typeof input === 'undefined') {
    return process.hrtime()
  } else if (input instanceof Date) {
    return millisToHiResTime(input.getTime())
  } else if (typeof input === 'number') {
    // TODO:  is this accurate?
    return millisToHiResTime(input)
  }
  return input
}
