import { MutationToken } from './mutationstate'
import { Cas } from './utilities'
import { SdUtils, SubdocStatus } from './sdutils'

/**
 * Contains the results of a Get operation.
 *
 * @category Key-Value
 */
export class GetResult {
  /**
   * The content of the document.
   */
  content: any

  /**
   * The CAS of the document.
   */
  cas: Cas

  /**
   * The expiry of the document, if it was requested.
   *
   * @see {@link GetOptions.withExpiry}
   */
  expiryTime?: number

  /**
   * @internal
   */
  constructor(data: { content: any; cas: Cas; expiryTime?: number }) {
    this.content = data.content
    this.cas = data.cas
    this.expiryTime = data.expiryTime
  }

  /**
   * BUG(JSCBC-784): This previously held the content of the document.
   *
   * @deprecated Use {@link GetResult.content} instead.
   */
  get value(): any {
    return this.content
  }
  set value(v: any) {
    this.content = v
  }

  /**
   * BUG(JSCBC-873): This was incorrectly named at release.
   *
   * @deprecated Use {@link GetResult.expiryTime} instead.
   */
  get expiry(): number | undefined {
    return this.expiryTime
  }
}

/**
 * Contains the results of a Range or Sampling Scan operation.
 *
 * @category Key-Value
 */
export class ScanResult {
  /**
   * The content of the document.
   */
  id: string

  /**
   * The content of the document.
   */
  content?: any

  /**
   * The CAS of the document.
   */
  cas?: Cas

  /**
   * The expiry of the document, if it was requested.
   *
   * @see {@link GetOptions.withExpiry}
   */
  expiryTime?: number

  /**
   * @internal
   */
  constructor(data: {
    id: string
    content?: any
    cas?: Cas
    expiryTime?: number
  }) {
    this.id = data.id
    this.content = data.content
    this.cas = data.cas
    this.expiryTime = data.expiryTime
  }
}

/**
 * Contains the results of an exists operation.
 *
 * @category Key-Value
 */
export class ExistsResult {
  /**
   * Indicates whether the document existed or not.
   */
  exists: boolean

  /**
   * The CAS of the document.
   */
  cas: Cas | undefined

  /**
   * @internal
   */
  constructor(data: ExistsResult) {
    this.exists = data.exists
    this.cas = data.cas
  }
}

/**
 * Contains the results of a mutate-in operation.
 *
 * @category Key-Value
 */
export class MutationResult {
  /**
   * The updated CAS for the document.
   */
  cas: Cas

  /**
   * The token representing the mutation performed.
   */
  token?: MutationToken

  /**
   * @internal
   */
  constructor(data: MutationResult) {
    this.cas = data.cas
    this.token = data.token
  }
}

/**
 * Contains the results of a get from replica operation.
 *
 * @category Key-Value
 */
export class GetReplicaResult {
  /**
   * The content of the document, as it existed on the replica.
   */
  content: any

  /**
   * The cas of the document, as it is known by the replica.
   */
  cas: Cas

  /**
   * Indicates whether this result came from a replica or the primary.
   */
  isReplica: boolean

  /**
   * @internal
   */
  constructor(data: { content: any; cas: Cas; isReplica: boolean }) {
    this.content = data.content
    this.cas = data.cas
    this.isReplica = data.isReplica
  }
}

/**
 * Contains the results of a specific sub-operation within a lookup-in operation.
 *
 * @category Key-Value
 */
export class LookupInResultEntry {
  /**
   * The error, if any, which occured when attempting to perform this sub-operation.
   */
  error: Error | null

  /**
   * The value returned by the sub-operation.
   */
  value?: any

  /**
   * @internal
   */
  status: SubdocStatus

  /**
   * @internal
   */
  constructor(data: LookupInResultEntry) {
    this.error = data.error
    this.value = data.value
    this.status = data.status
  }
}

/**
 * Contains the results of a lookup-in operation.
 *
 * @category Key-Value
 */
export class LookupInResult {
  /**
   * A list of result entries for each sub-operation performed.
   */
  content: LookupInResultEntry[]
  /**
   * The cas of the document.
   */
  cas: Cas

  /**
   * @internal
   */
  constructor(data: { content: LookupInResultEntry[]; cas: Cas }) {
    this.content = data.content
    this.cas = data.cas
  }

  /**
   * BUG(JSCBC-730): Previously held the content of the document.
   *
   * @deprecated Use {@link LookupInResult.content} instead.
   */
  get results(): LookupInResultEntry[] {
    return this.content
  }
  set results(v: LookupInResultEntry[]) {
    this.content = v
  }

  /**
   * Indicates whether the subdocument path exists.
   *
   * @param index The result index to check.
   */
  exists(index: number): boolean {
    if (index < 0 || index >= this.content.length) {
      throw new Error('Index out of bounds')
    }
    const entry = this.content[index]
    if (entry.status === 'success') {
      return true
    }
    if (entry.status === 'path_not_found') {
      return false
    }
    // The entry carries the per field error the core sent, already mapped by
    // errorFromCpp(), so it is the same class parseSubdocStatus() would
    // synthesize but with the server's context attached. Prefer it, and fall
    // back to the status when the entry has none.
    if (entry.error) {
      throw entry.error
    }
    return SdUtils.parseSubdocStatus(entry.status)
  }
}

/**
 * Contains the results of a lookup-in replica operation.
 *
 * @category Key-Value
 */
export class LookupInReplicaResult {
  /**
   * A list of result entries for each sub-operation performed.
   */
  content: LookupInResultEntry[]
  /**
   * The cas of the document.
   */
  cas: Cas

  /**
   * Indicates whether this result came from a replica or the primary.
   */
  isReplica: boolean

  constructor(data: {
    content: LookupInResultEntry[]
    cas: Cas
    isReplica: boolean
  }) {
    this.content = data.content
    this.cas = data.cas
    this.isReplica = data.isReplica
  }

  /**
   * Indicates whether the subdocument path exists.
   *
   * @param index The result index to check.
   */
  exists(index: number): boolean {
    if (index < 0 || index >= this.content.length) {
      throw new Error('Index out of bounds')
    }
    const entry = this.content[index]
    if (entry.status === 'success') {
      return true
    }
    if (entry.status === 'path_not_found') {
      return false
    }
    // The entry carries the per field error the core sent, already mapped by
    // errorFromCpp(), so it is the same class parseSubdocStatus() would
    // synthesize but with the server's context attached. Prefer it, and fall
    // back to the status when the entry has none.
    if (entry.error) {
      throw entry.error
    }
    return SdUtils.parseSubdocStatus(entry.status)
  }
}

/**
 * Contains the results of a specific sub-operation within a mutate-in operation.
 *
 * @category Key-Value
 */
export class MutateInResultEntry {
  /**
   * The resulting value after the completion of the sub-operation.  This namely
   * returned in the case of a counter operation (increment/decrement) and is not
   * included for general operations.
   */
  value: any | undefined

  /**
   * @internal
   */
  constructor(data: MutateInResultEntry) {
    this.value = data.value
  }
}

/**
 * Contains the results of a mutate-in operation.
 *
 * @category Key-Value
 */
export class MutateInResult {
  /**
   * A list of result entries for each sub-operation performed.
   */
  content: MutateInResultEntry[]

  /**
   * The updated CAS for the document.
   */
  cas: Cas

  /**
   * The token representing the mutation performed.
   */
  token?: MutationToken

  /**
   * @internal
   */
  constructor(data: MutateInResult) {
    this.content = data.content
    this.cas = data.cas
    this.token = data.token
  }
}

/**
 * Contains the results of a counter operation (binary increment/decrement).
 *
 * @category Key-Value
 */
export class CounterResult {
  /**
   * The new value of the document after the operation completed.
   *
   * **NOTE:** This is a JavaScript `number` and loses precision for counter
   * values above `Number.MAX_SAFE_INTEGER` (2^53 - 1).  Use `value64` to read
   * the exact value across the full 64-bit unsigned range.
   */
  value: number

  /**
   * The new value of the document after the operation completed, as an exact
   * `bigint`.  Unlike `value`, this preserves the full 64-bit unsigned range
   * without loss of precision.
   */
  value64: bigint

  /**
   * The updated CAS for the document.
   */
  cas: Cas

  /**
   * The token representing the mutation performed.
   */
  token?: MutationToken

  /**
   * @internal
   */
  constructor(data: CounterResult) {
    this.value = data.value
    this.value64 = data.value64
    this.cas = data.cas
    this.token = data.token
  }
}
