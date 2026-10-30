import * as grpc from '@grpc/grpc-js'
import * as os from 'os'
import { inspect } from 'util'

import type {
  DocumentId,
  EncodedMutateInSpec,
  KvAppendRequest,
  KvBackend,
  KvCounterRequest,
  KvDurability,
  KvGetAndLockRequest,
  KvGetAndTouchRequest,
  KvGetRequest,
  KvInsertRequest,
  KvLookupInReplicaRequest,
  KvLookupInRequest,
  KvMutateInRequest,
  KvPrependRequest,
  KvReadRequest,
  KvReplaceRequest,
  KvReplicaReadRequest,
  KvRemoveRequest,
  KvRequest,
  KvScanRequest,
  KvTouchRequest,
  KvUnlockRequest,
  KvUpsertRequest,
} from '../backends'
import type {
  GetReplicaResult,
  LookupInReplicaResult,
  ScanResult,
} from '../crudoptypes'
import {
  CounterResult,
  ExistsResult,
  GetResult,
  LookupInResult,
  LookupInResultEntry,
  MutateInResult,
  MutateInResultEntry,
  MutationResult,
} from '../crudoptypes'
import {
  CouchbaseError,
  DeltaInvalidError,
  DocumentNotJsonError,
  FeatureNotAvailableError,
  InternalServerFailureError,
  InvalidArgumentError,
  InvalidDurabilityLevel,
  NumberTooBigError,
  PathExistsError,
  PathMismatchError,
  PathNotFoundError,
  PathTooDeepError,
  ValueInvalidError,
} from '../errors'
import { DurabilityLevel, StoreSemantics } from '../generaltypes'
import type { MutationToken } from '../mutationstate'
import type { ObservableRequestHandler } from '../observabilityhandler'
import type { LookupInSpec } from '../sdspecs'
import { LookupInOp, MutateInOp, SubdocStatus } from '../sdutils'
import type {
  StreamableReplicasPromise,
  StreamableScanPromise,
} from '../streamablepromises'
import type { Cas, CasInput } from '../utilities'
import { ErrorClass, errorFromMapped, mapStatus } from './errormapping'
import type { AppendRequest as AppendRequestPb } from './generated/couchbase/kv/v1/AppendRequest'
import type { AppendResponse__Output as AppendResponsePb } from './generated/couchbase/kv/v1/AppendResponse'
import type { DecrementResponse__Output as DecrementResponsePb } from './generated/couchbase/kv/v1/DecrementResponse'
import type { DurabilityLevel as DurabilityLevelInputPb } from './generated/couchbase/kv/v1/DurabilityLevel'
import type { GetRequest as GetRequestPb } from './generated/couchbase/kv/v1/GetRequest'
import type { GetResponse__Output as GetResponsePb } from './generated/couchbase/kv/v1/GetResponse'
import type { InsertRequest as InsertRequestPb } from './generated/couchbase/kv/v1/InsertRequest'
import type { IncrementRequest as IncrementRequestPb } from './generated/couchbase/kv/v1/IncrementRequest'
import type { IncrementResponse__Output as IncrementResponsePb } from './generated/couchbase/kv/v1/IncrementResponse'
import type { InsertResponse__Output as InsertResponsePb } from './generated/couchbase/kv/v1/InsertResponse'
import type { ExistsRequest as ExistsRequestPb } from './generated/couchbase/kv/v1/ExistsRequest'
import type { ExistsResponse__Output as ExistsResponsePb } from './generated/couchbase/kv/v1/ExistsResponse'
import type { GetAndLockRequest as GetAndLockRequestPb } from './generated/couchbase/kv/v1/GetAndLockRequest'
import type { GetAndLockResponse__Output as GetAndLockResponsePb } from './generated/couchbase/kv/v1/GetAndLockResponse'
import type { GetAndTouchRequest as GetAndTouchRequestPb } from './generated/couchbase/kv/v1/GetAndTouchRequest'
import type { GetAndTouchResponse__Output as GetAndTouchResponsePb } from './generated/couchbase/kv/v1/GetAndTouchResponse'
import type { KvServiceClient } from './generated/couchbase/kv/v1/KvService'
import type {
  _couchbase_kv_v1_LookupInRequest_Spec as LookupInSpecInputPb,
  _couchbase_kv_v1_LookupInRequest_Spec_Operation as LookupInOperationInputPb,
  LookupInRequest as LookupInRequestPb,
} from './generated/couchbase/kv/v1/LookupInRequest'
import type {
  _couchbase_kv_v1_LookupInResponse_Spec__Output as LookupInSpecOutputPb,
  LookupInResponse__Output as LookupInResponsePb,
} from './generated/couchbase/kv/v1/LookupInResponse'
import type {
  _couchbase_kv_v1_MutateInRequest_Spec as MutateInSpecInputPb,
  _couchbase_kv_v1_MutateInRequest_Spec_Operation as MutateInOperationInputPb,
  _couchbase_kv_v1_MutateInRequest_StoreSemantic as StoreSemanticInputPb,
  MutateInRequest as MutateInRequestPb,
} from './generated/couchbase/kv/v1/MutateInRequest'
import type { MutateInResponse__Output as MutateInResponsePb } from './generated/couchbase/kv/v1/MutateInResponse'
import type { MutationToken__Output as MutationTokenOutputPb } from './generated/couchbase/kv/v1/MutationToken'
import type { PrependRequest as PrependRequestPb } from './generated/couchbase/kv/v1/PrependRequest'
import type { PrependResponse__Output as PrependResponsePb } from './generated/couchbase/kv/v1/PrependResponse'
import type { RemoveRequest as RemoveRequestPb } from './generated/couchbase/kv/v1/RemoveRequest'
import type { RemoveResponse__Output as RemoveResponsePb } from './generated/couchbase/kv/v1/RemoveResponse'
import type { ReplaceRequest as ReplaceRequestPb } from './generated/couchbase/kv/v1/ReplaceRequest'
import type { ReplaceResponse__Output as ReplaceResponsePb } from './generated/couchbase/kv/v1/ReplaceResponse'
import type { TouchRequest as TouchRequestPb } from './generated/couchbase/kv/v1/TouchRequest'
import type { TouchResponse__Output as TouchResponsePb } from './generated/couchbase/kv/v1/TouchResponse'
import type { UnlockRequest as UnlockRequestPb } from './generated/couchbase/kv/v1/UnlockRequest'
import type { UnlockResponse__Output as UnlockResponsePb } from './generated/couchbase/kv/v1/UnlockResponse'
import type { UpsertRequest as UpsertRequestPb } from './generated/couchbase/kv/v1/UpsertRequest'
import type { UpsertResponse__Output as UpsertResponsePb } from './generated/couchbase/kv/v1/UpsertResponse'
import type { Status__Output as StatusOutputPb } from './generated/google/rpc/Status'
import type { Couchbase2Op, RequestContext } from './requestcontext'
import { unary } from './retry'
import { statusDetailsFromProto } from './statusdetails'

/**
 * @internal
 */
export const GET: Couchbase2Op = {
  name: 'get',
  readOnly: true,
  idempotent: true,
}

/**
 * @internal
 */
export const UPSERT: Couchbase2Op = {
  name: 'upsert',
  readOnly: false,
  idempotent: true,
}

/**
 * @internal
 */
export const INSERT: Couchbase2Op = {
  name: 'insert',
  readOnly: false,
  idempotent: false,
}

/**
 * @internal
 */
export const REPLACE: Couchbase2Op = {
  name: 'replace',
  readOnly: false,
  idempotent: false,
}

/**
 * @internal
 */
export const REMOVE: Couchbase2Op = {
  name: 'remove',
  readOnly: false,
  idempotent: false,
}

/**
 * @internal
 */
export const EXISTS: Couchbase2Op = {
  name: 'exists',
  readOnly: true,
  idempotent: true,
}

/**
 * @internal
 */
export const GET_AND_TOUCH: Couchbase2Op = {
  name: 'getAndTouch',
  readOnly: false,
  idempotent: true,
}

/**
 * @internal
 */
export const TOUCH: Couchbase2Op = {
  name: 'touch',
  readOnly: false,
  idempotent: true,
}

/**
 * @internal
 */
export const GET_AND_LOCK: Couchbase2Op = {
  name: 'getAndLock',
  readOnly: false,
  idempotent: false,
}

/**
 * @internal
 */
export const UNLOCK: Couchbase2Op = {
  name: 'unlock',
  readOnly: false,
  idempotent: false,
}

/**
 * @internal
 */
export const INCREMENT: Couchbase2Op = {
  name: 'increment',
  readOnly: false,
  idempotent: false,
}

/**
 * @internal
 */
export const DECREMENT: Couchbase2Op = {
  name: 'decrement',
  readOnly: false,
  idempotent: false,
}

/**
 * @internal
 */
export const APPEND: Couchbase2Op = {
  name: 'append',
  readOnly: false,
  idempotent: false,
}

/**
 * @internal
 */
export const PREPEND: Couchbase2Op = {
  name: 'prepend',
  readOnly: false,
  idempotent: false,
}

/**
 * @internal
 */
export const LOOKUP_IN: Couchbase2Op = {
  name: 'lookupIn',
  readOnly: true,
  idempotent: true,
}

/**
 * @internal
 */
export const MUTATE_IN: Couchbase2Op = {
  name: 'mutateIn',
  readOnly: false,
  idempotent: false,
}

/**
 * The largest relative expiry; a larger value is epoch seconds.
 */
const MAX_RELATIVE_EXPIRY_SECS = 30 * 24 * 60 * 60

/**
 * A CAS read from the gateway. Prints and serializes as its decimal value,
 * as a classic CAS does.
 *
 * @internal
 */
export class Couchbase2Cas implements Cas {
  private readonly _value: string

  constructor(value: string) {
    this._value = value
  }

  /**
   * The decimal value.
   */
  toString(): string {
    return this._value
  }

  /**
   * The decimal value, as a string.
   */
  toJSON(): any {
    return this._value
  }

  /**
   * @internal
   */
  [inspect.custom](): string {
    return `Cas<${this._value}>`
  }
}

/**
 * A mutation token read from the gateway. `toJSON` has the shape a classic
 * connection's token has, which `MutationState` reads.
 *
 * @internal
 */
export class Couchbase2MutationToken implements MutationToken {
  readonly bucket_name: string
  readonly partition_id: number
  readonly partition_uuid: string
  readonly sequence_number: string

  constructor(token: MutationTokenOutputPb) {
    this.bucket_name = token.bucket_name
    this.partition_id = token.vbucket_id
    this.partition_uuid = token.vbucket_uuid
    this.sequence_number = token.seq_no
  }

  /**
   * The token as `bucket:partition:uuid:sequence`.
   */
  toString(): string {
    return (
      `${this.bucket_name}:${this.partition_id}:` +
      `${this.partition_uuid}:${this.sequence_number}`
    )
  }

  /**
   * The token in the shape a classic connection serializes it to.
   */
  toJSON(): any {
    return {
      bucket_name: this.bucket_name,
      partition_id: this.partition_id,
      partition_uuid: this.partition_uuid,
      sequence_number: this.sequence_number,
    }
  }

  /**
   * @internal
   */
  [inspect.custom](): string {
    return `MutationToken<${this.toString()}>`
  }
}

/**
 * The fields that name a request's document.
 */
function documentIdToProto(id: DocumentId): {
  bucket_name: string
  scope_name: string
  collection_name: string
  key: string
} {
  return {
    bucket_name: id.bucket,
    scope_name: id.scope,
    collection_name: id.collection,
    key: id.key,
  }
}

/**
 * The proto durability level for a mutation's durability, or undefined for
 * none. The legacy observe based durability has no couchbase2 form.
 *
 * @internal
 */
export function durabilityToProto(
  durability: KvDurability
): DurabilityLevelInputPb | undefined {
  if (durability.persistTo || durability.replicateTo) {
    throw new FeatureNotAvailableError(
      new Error(
        'couchbase2 does not support persistTo and replicateTo; use ' +
          'durabilityLevel.'
      )
    )
  }
  switch (durability.durabilityLevel) {
    case DurabilityLevel.Majority:
      return 'DURABILITY_LEVEL_MAJORITY'
    case DurabilityLevel.MajorityAndPersistOnMaster:
      return 'DURABILITY_LEVEL_MAJORITY_AND_PERSIST_TO_ACTIVE'
    case DurabilityLevel.PersistToMajority:
      return 'DURABILITY_LEVEL_PERSIST_TO_MAJORITY'
    case DurabilityLevel.None:
    case undefined:
      return undefined
    default:
      throw new InvalidDurabilityLevel()
  }
}

const MAX_CAS = BigInt('18446744073709551615')

/**
 * The largest counter seed: the proto's `initial` is a signed 64 bit field.
 */
const MAX_COUNTER_INITIAL = BigInt('9223372036854775807')

/**
 * A CAS as the decimal string the proto takes, or undefined for none. Zero
 * is none, as on classic. A couchbase2 CAS prints as its decimal value; a
 * classic one, like a bare `Buffer`, carries its eight bytes in `raw` in the
 * platform's byte order.
 *
 * @internal
 */
export function casToProto(cas: CasInput | undefined): string | undefined {
  if (!cas) {
    return undefined
  }
  const raw = (cas as { raw?: unknown }).raw
  let value: string
  if (Buffer.isBuffer(cas)) {
    value = casFromBuffer(cas)
  } else if (typeof cas === 'string') {
    value = cas
  } else if (Buffer.isBuffer(raw)) {
    value = casFromBuffer(raw)
  } else {
    value = cas.toString()
  }
  const parsed = /^[0-9]+$/.test(value) ? BigInt(value) : undefined
  if (parsed === undefined || parsed > MAX_CAS) {
    throw new InvalidArgumentError(
      new Error(`The CAS ${value} is not an unsigned 64 bit integer.`)
    )
  }
  return parsed === BigInt(0) ? undefined : parsed.toString()
}

/**
 * A CAS's eight bytes as its decimal value.
 */
function casFromBuffer(buf: Buffer): string {
  if (buf.length !== 8) {
    throw new InvalidArgumentError(
      new Error(`A CAS buffer holds 8 bytes, not ${buf.length}.`)
    )
  }
  return (
    os.endianness() === 'LE' ? buf.readBigUInt64LE(0) : buf.readBigUInt64BE(0)
  ).toString()
}

/**
 * A mutation's expiry fields. `expiry` is in the server's form: up to 30
 * days is relative seconds, anything larger is epoch seconds.
 *
 * The gateway reads a missing expiry as "keep the existing one", so no
 * expiry is sent as zero and preserving is the field left out. Preserving
 * beside an expiry applies it to a new document only; the gateway refuses
 * that flag with no expiry.
 *
 * @internal
 */
export function expiryToProto(
  expiry: number,
  preserveExpiry: boolean
): Pick<
  UpsertRequestPb,
  'expiry_secs' | 'expiry_time' | 'preserve_expiry_on_existing'
> {
  if (expiry === 0) {
    return preserveExpiry ? {} : { expiry_secs: 0 }
  }
  const fields: Pick<
    UpsertRequestPb,
    'expiry_secs' | 'expiry_time' | 'preserve_expiry_on_existing'
  > = touchExpiryToProto(expiry)
  if (preserveExpiry) {
    fields.preserve_expiry_on_existing = true
  }
  return fields
}

/**
 * The expiry a touch sets, in the form `expiryToProto` takes. Zero is sent
 * as it is, since a touch to zero clears the expiry.
 *
 * @internal
 */
export function touchExpiryToProto(
  expiry: number
): Pick<TouchRequestPb, 'expiry_secs' | 'expiry_time'> {
  return expiry > MAX_RELATIVE_EXPIRY_SECS
    ? { expiry_time: { seconds: expiry } }
    : { expiry_secs: expiry }
}

/**
 * @internal
 */
export function getRequestToProto(req: KvGetRequest): GetRequestPb {
  return { ...documentIdToProto(req.id), project: req.project ?? [] }
}

/**
 * A get's result. The gateway always sends the expiry; the result carries
 * it only when asked for, as epoch seconds or 0 for none, as on classic.
 *
 * @internal
 */
export function getResultFromProto(
  resp: GetResponsePb,
  req: KvGetRequest
): GetResult {
  return new GetResult({
    content: contentFromProto(resp, req, 'get'),
    cas: new Couchbase2Cas(resp.cas),
    expiryTime: req.withExpiry ? Number(resp.expiry?.seconds ?? 0) : undefined,
  })
}

/**
 * A read's document content, decoded.
 */
function contentFromProto(
  resp: Pick<
    GetResponsePb,
    'content' | 'content_uncompressed' | 'content_flags'
  >,
  req: KvReadRequest,
  op: string
): any {
  // The SDK never asks for compression, so compressed content is as wrong
  // as none.
  if (resp.content !== 'content_uncompressed' || !resp.content_uncompressed) {
    throw new InternalServerFailureError(
      new Error(`The gateway answered ${op} without uncompressed content.`)
    )
  }
  return req.transcoder.decode(resp.content_uncompressed, resp.content_flags)
}

/**
 * @internal
 */
export function existsRequestToProto(req: KvRequest): ExistsRequestPb {
  return documentIdToProto(req.id)
}

/**
 * An exists result. A missing document has a CAS of zero, as on a classic
 * connection.
 *
 * @internal
 */
export function existsResultFromProto(resp: ExistsResponsePb): ExistsResult {
  return new ExistsResult({
    exists: resp.result,
    cas: new Couchbase2Cas(resp.cas || '0'),
  })
}

/**
 * @internal
 */
export function getAndTouchRequestToProto(
  req: KvGetAndTouchRequest
): GetAndTouchRequestPb {
  return { ...documentIdToProto(req.id), ...touchExpiryToProto(req.expiry) }
}

/**
 * @internal
 */
export function touchRequestToProto(req: KvTouchRequest): TouchRequestPb {
  return { ...documentIdToProto(req.id), ...touchExpiryToProto(req.expiry) }
}

/**
 * @internal
 */
export function getAndLockRequestToProto(
  req: KvGetAndLockRequest
): GetAndLockRequestPb {
  return { ...documentIdToProto(req.id), lock_time_secs: req.lockTime }
}

/**
 * A getAndTouch or getAndLock result. Like a classic connection's, it
 * carries no expiry.
 *
 * @internal
 */
export function lockedOrTouchedResultFromProto(
  resp: GetAndTouchResponsePb | GetAndLockResponsePb,
  req: KvReadRequest,
  op: string
): GetResult {
  return new GetResult({
    content: contentFromProto(resp, req, op),
    cas: new Couchbase2Cas(resp.cas),
  })
}

/**
 * An unlock's request. The CAS is the one the lock returned, so none is
 * refused rather than sent as zero.
 *
 * @internal
 */
export function unlockRequestToProto(req: KvUnlockRequest): UnlockRequestPb {
  const cas = casToProto(req.cas)
  if (cas === undefined) {
    throw new InvalidArgumentError(
      new Error('unlock needs the CAS that getAndLock returned.')
    )
  }
  return { ...documentIdToProto(req.id), cas }
}

/**
 * @internal
 */
export function upsertRequestToProto(req: KvUpsertRequest): UpsertRequestPb {
  const message: UpsertRequestPb = {
    ...documentIdToProto(req.id),
    content_uncompressed: req.value,
    content_flags: req.flags,
    ...expiryToProto(req.expiry, req.preserveExpiry),
  }
  const durabilityLevel = durabilityToProto(req)
  if (durabilityLevel !== undefined) {
    message.durability_level = durabilityLevel
  }
  return message
}

/**
 * @internal
 */
export function insertRequestToProto(req: KvInsertRequest): InsertRequestPb {
  const message: InsertRequestPb = {
    ...documentIdToProto(req.id),
    content_uncompressed: req.value,
    content_flags: req.flags,
    ...expiryToProto(req.expiry, false),
  }
  const durabilityLevel = durabilityToProto(req)
  if (durabilityLevel !== undefined) {
    message.durability_level = durabilityLevel
  }
  return message
}

/**
 * A replace's request. `ReplaceRequest` has no preserve flag; leaving the
 * expiry out preserves it, so preserving drops any expiry given beside it.
 *
 * @internal
 */
export function replaceRequestToProto(req: KvReplaceRequest): ReplaceRequestPb {
  const message: ReplaceRequestPb = {
    ...documentIdToProto(req.id),
    content_uncompressed: req.value,
    content_flags: req.flags,
    ...(req.preserveExpiry ? {} : expiryToProto(req.expiry, false)),
  }
  const cas = casToProto(req.cas)
  if (cas !== undefined) {
    message.cas = cas
  }
  const durabilityLevel = durabilityToProto(req)
  if (durabilityLevel !== undefined) {
    message.durability_level = durabilityLevel
  }
  return message
}

/**
 * @internal
 */
export function removeRequestToProto(req: KvRemoveRequest): RemoveRequestPb {
  const message: RemoveRequestPb = documentIdToProto(req.id)
  const cas = casToProto(req.cas)
  if (cas !== undefined) {
    message.cas = cas
  }
  const durabilityLevel = durabilityToProto(req)
  if (durabilityLevel !== undefined) {
    message.durability_level = durabilityLevel
  }
  return message
}

/**
 * A counter's delta or initial value as the decimal string the proto takes.
 * Anything but a whole number from zero to `max` is refused, where classic
 * would wrap it. A `number` past the safe integer range may already be
 * rounded, so it is refused too; use a `bigint`.
 */
function counterValueToProto(
  name: string,
  value: number | bigint,
  max: bigint
): string {
  const parsed =
    typeof value === 'bigint' || Number.isSafeInteger(value)
      ? BigInt(value)
      : undefined
  if (parsed === undefined || parsed < BigInt(0) || parsed > max) {
    throw new InvalidArgumentError(
      new Error(
        `The counter ${name} ${value} is not an integer from 0 to ${max}.`
      )
    )
  }
  return parsed.toString()
}

/**
 * An increment's or a decrement's request (the messages share fields). The
 * expiry applies only to a counter the call creates, and is sent as is, zero
 * included.
 *
 * @internal
 */
export function counterRequestToProto(
  req: KvCounterRequest
): IncrementRequestPb {
  const message: IncrementRequestPb = {
    ...documentIdToProto(req.id),
    delta: counterValueToProto('delta', req.delta, MAX_CAS),
    ...touchExpiryToProto(req.expiry),
  }
  if (req.initial !== undefined) {
    message.initial = counterValueToProto(
      'initial',
      req.initial,
      MAX_COUNTER_INITIAL
    )
  }
  const durabilityLevel = durabilityToProto(req)
  if (durabilityLevel !== undefined) {
    message.durability_level = durabilityLevel
  }
  return message
}

/**
 * A counter's result. The proto's `content` is signed and the counter is
 * not, so the value is read back as unsigned.
 *
 * @internal
 */
export function counterResultFromProto(
  resp: IncrementResponsePb | DecrementResponsePb
): CounterResult {
  const value64 = BigInt.asUintN(64, BigInt(resp.content))
  return new CounterResult({
    cas: new Couchbase2Cas(resp.cas),
    token: resp.mutation_token
      ? new Couchbase2MutationToken(resp.mutation_token)
      : undefined,
    value: Number(value64),
    value64,
  })
}

/**
 * An append's request.
 *
 * @internal
 */
export function appendRequestToProto(req: KvAppendRequest): AppendRequestPb {
  const message: AppendRequestPb = {
    ...documentIdToProto(req.id),
    content: req.value,
  }
  const cas = casToProto(req.cas)
  if (cas !== undefined) {
    message.cas = cas
  }
  const durabilityLevel = durabilityToProto(req)
  if (durabilityLevel !== undefined) {
    message.durability_level = durabilityLevel
  }
  return message
}

/**
 * A prepend's request. `PrependRequest` has the same fields as
 * `AppendRequest`.
 *
 * @internal
 */
export function prependRequestToProto(req: KvPrependRequest): PrependRequestPb {
  return appendRequestToProto(req)
}

/**
 * A mutation's result.
 *
 * @internal
 */
export function mutationResultFromProto(
  resp: Pick<UpsertResponsePb, 'cas' | 'mutation_token'>
): MutationResult {
  return new MutationResult({
    cas: new Couchbase2Cas(resp.cas),
    token: resp.mutation_token
      ? new Couchbase2MutationToken(resp.mutation_token)
      : undefined,
  })
}

/**
 * The lookup-in operations. The gateway reads an empty path as the whole
 * document, which is what `GetDoc` is.
 */
const LOOKUP_IN_OPS: Readonly<Record<LookupInOp, LookupInOperationInputPb>> = {
  [LookupInOp.Get]: 'OPERATION_GET',
  [LookupInOp.GetDoc]: 'OPERATION_GET',
  [LookupInOp.Exists]: 'OPERATION_EXISTS',
  [LookupInOp.Count]: 'OPERATION_COUNT',
}

/**
 * The mutate-in operations. The gateway reads an empty path as the whole
 * document, which is what `SetDoc` and `RemoveDoc` are.
 */
const MUTATE_IN_OPS: Readonly<Record<MutateInOp, MutateInOperationInputPb>> = {
  [MutateInOp.Insert]: 'OPERATION_INSERT',
  [MutateInOp.Upsert]: 'OPERATION_UPSERT',
  [MutateInOp.Replace]: 'OPERATION_REPLACE',
  [MutateInOp.Remove]: 'OPERATION_REMOVE',
  [MutateInOp.ArrayAppend]: 'OPERATION_ARRAY_APPEND',
  [MutateInOp.ArrayPrepend]: 'OPERATION_ARRAY_PREPEND',
  [MutateInOp.ArrayInsert]: 'OPERATION_ARRAY_INSERT',
  [MutateInOp.ArrayAddUnique]: 'OPERATION_ARRAY_ADD_UNIQUE',
  [MutateInOp.Counter]: 'OPERATION_COUNTER',
  [MutateInOp.SetDoc]: 'OPERATION_REPLACE',
  [MutateInOp.RemoveDoc]: 'OPERATION_REMOVE',
}

const STORE_SEMANTICS: Readonly<Record<StoreSemantics, StoreSemanticInputPb>> =
  {
    [StoreSemantics.Replace]: 'STORE_SEMANTIC_REPLACE',
    [StoreSemantics.Upsert]: 'STORE_SEMANTIC_UPSERT',
    [StoreSemantics.Insert]: 'STORE_SEMANTIC_INSERT',
  }

/**
 * The sub-document status of each error a spec's status can map to. Any
 * other error is `unknown`, and the entry's error says what it is.
 */
const SUBDOC_STATUSES: ReadonlyArray<[ErrorClass, SubdocStatus]> = [
  [PathNotFoundError, 'path_not_found'],
  [PathExistsError, 'path_exists'],
  [PathMismatchError, 'path_mismatch'],
  [PathTooDeepError, 'doc_too_deep'],
  [DocumentNotJsonError, 'doc_not_json'],
  [NumberTooBigError, 'num_range_error'],
  [ValueInvalidError, 'value_cannot_insert'],
  [DeltaInvalidError, 'delta_invalid'],
]

/**
 * The order to send a request's specs in: the xattr specs, then the rest,
 * each group as written.
 *
 * The server needs xattr specs first. The gateway reorders them itself but
 * then matches answers to specs in the sent order, so an xattr spec after a
 * body spec gets another spec's answer. Sending them first avoids that; the
 * SDK restores the caller's order on the way back.
 *
 * @internal
 */
export function xattrsFirst(xattr: boolean[]): number[] {
  const indexes = xattr.map((_, i) => i)
  return [
    ...indexes.filter((i) => xattr[i]),
    ...indexes.filter((i) => !xattr[i]),
  ]
}

/**
 * A lookup-in's request, its specs sent in `order`.
 *
 * @internal
 */
export function lookupInRequestToProto(
  req: KvLookupInRequest,
  order: number[]
): LookupInRequestPb {
  const message: LookupInRequestPb = {
    ...documentIdToProto(req.id),
    specs: order.map((i) => lookupInSpecToProto(req.specs[i])),
  }
  if (req.accessDeleted) {
    message.flags = { access_deleted: true }
  }
  return message
}

/**
 * A lookup-in spec as the proto takes it.
 */
function lookupInSpecToProto(spec: LookupInSpec): LookupInSpecInputPb {
  const message: LookupInSpecInputPb = {
    operation: LOOKUP_IN_OPS[spec._op],
    path: spec._path,
  }
  if (spec._xattr) {
    message.flags = { xattr: true }
  }
  return message
}

/**
 * A lookup-in's result, its entries in the order the caller wrote the specs.
 *
 * The gateway answers `exists` with content `true` or `false` and no
 * status; as on classic, `false` becomes `path_not_found` with no error. The
 * gateway does not report tombstones.
 *
 * @internal
 */
export function lookupInResultFromProto(
  resp: LookupInResponsePb,
  req: KvLookupInRequest,
  order: number[]
): LookupInResult {
  checkSpecCount('lookupIn', order.length, resp.specs.length)
  const content: LookupInResultEntry[] = new Array(order.length)
  resp.specs.forEach((answer, sent) => {
    const index = order[sent]
    content[index] = lookupInEntryFromProto(answer, req.specs[index])
  })
  return new LookupInResult({ content, cas: new Couchbase2Cas(resp.cas) })
}

/**
 * The result entry for one lookup-in spec's answer.
 */
function lookupInEntryFromProto(
  answer: LookupInSpecOutputPb,
  spec: LookupInSpec
): LookupInResultEntry {
  if (answer.status && answer.status.code !== grpc.status.OK) {
    const error = specErrorFromProto(answer.status)
    const status =
      SUBDOC_STATUSES.find(
        ([errorClass]) => error instanceof errorClass
      )?.[1] ?? 'unknown'
    return new LookupInResultEntry({ error, value: undefined, status })
  }
  if (spec._op === LookupInOp.Exists) {
    const exists = subdocDecode(answer.content) === true
    return new LookupInResultEntry({
      error: null,
      value: exists,
      status: exists ? 'success' : 'path_not_found',
    })
  }
  return new LookupInResultEntry({
    error: null,
    value: subdocValueFromProto(answer.content),
    status: 'success',
  })
}

/**
 * The error a spec's status maps to. The spec failed on a call that
 * succeeded, so its context has no retry history.
 */
function specErrorFromProto(status: StatusOutputPb): CouchbaseError {
  const mapped = mapStatus(
    status.code,
    status.message,
    statusDetailsFromProto(status),
    true
  )
  return errorFromMapped(mapped, {
    last_dispatched_to: '',
    last_dispatched_from: '',
    retry_attempts: 0,
    retry_reasons: [],
  })
}

/**
 * A mutate-in's request, its specs sent in `order`.
 *
 * `MutateInRequest` has no preserve flag (leaving the expiry out preserves
 * it), so preserving beside an expiry is refused. The gateway would store a
 * mutation macro as written rather than expand it, so macros are refused.
 *
 * @internal
 */
export function mutateInRequestToProto(
  req: KvMutateInRequest,
  order: number[]
): MutateInRequestPb {
  if (req.preserveExpiry && req.expiry !== 0) {
    throw new FeatureNotAvailableError(
      new Error(
        'couchbase2 cannot apply an expiry to a new document only, so ' +
          'mutateIn does not take an expiry with preserveExpiry.'
      )
    )
  }
  const message: MutateInRequestPb = {
    ...documentIdToProto(req.id),
    specs: order.map((i) => mutateInSpecToProto(req.specs[i])),
    ...(req.preserveExpiry ? {} : touchExpiryToProto(req.expiry)),
  }
  if (req.storeSemantics !== undefined) {
    const storeSemantic = STORE_SEMANTICS[req.storeSemantics]
    if (storeSemantic === undefined) {
      throw new InvalidArgumentError(
        new Error(`Unknown store semantics ${req.storeSemantics}.`)
      )
    }
    message.store_semantic = storeSemantic
  }
  const cas = casToProto(req.cas)
  if (cas !== undefined) {
    message.cas = cas
  }
  const durabilityLevel = durabilityToProto(req)
  if (durabilityLevel !== undefined) {
    message.durability_level = durabilityLevel
  }
  return message
}

/**
 * A mutate-in spec as the proto takes it, its value already encoded.
 */
function mutateInSpecToProto({
  spec,
  value,
}: EncodedMutateInSpec): MutateInSpecInputPb {
  if (spec._expandMacros) {
    throw new FeatureNotAvailableError(
      new Error(
        'couchbase2 cannot expand a mutation macro; the gateway would store ' +
          'the macro as written.'
      )
    )
  }
  const message: MutateInSpecInputPb = {
    operation: MUTATE_IN_OPS[spec._op],
    path: spec._path,
  }
  if (value !== undefined) {
    message.content = value
  }
  if (spec._xattr || spec._createPath) {
    message.flags = {}
    if (spec._xattr) {
      message.flags.xattr = true
    }
    if (spec._createPath) {
      message.flags.create_path = true
    }
  }
  return message
}

/**
 * A mutate-in's result, its entries in the order the caller wrote the specs.
 * Only a counter's answer carries content, the counter's new value.
 *
 * @internal
 */
export function mutateInResultFromProto(
  resp: MutateInResponsePb,
  order: number[]
): MutateInResult {
  checkSpecCount('mutateIn', order.length, resp.specs.length)
  const content: MutateInResultEntry[] = new Array(order.length)
  resp.specs.forEach((answer, sent) => {
    content[order[sent]] = new MutateInResultEntry({
      value: subdocValueFromProto(answer.content),
    })
  })
  const { cas, token } = mutationResultFromProto(resp)
  return new MutateInResult({ content, cas, token })
}

/**
 * Raises when the gateway answered a different number of specs than were
 * sent, since the answers cannot be matched.
 */
function checkSpecCount(op: string, sent: number, answered: number): void {
  if (sent !== answered) {
    throw new InternalServerFailureError(
      new Error(
        `The gateway answered ${sent} ${op} specs with ${answered} results.`
      )
    )
  }
}

/**
 * A spec's content, decoded, or undefined for none.
 */
function subdocValueFromProto(content: Buffer | undefined): any {
  return content && content.length > 0 ? subdocDecode(content) : undefined
}

/**
 * A sub-document value decoded as `Collection` decodes one: JSON when it
 * parses, the bytes otherwise.
 */
function subdocDecode(bytes: Buffer): any {
  try {
    return JSON.parse(bytes.toString('utf8'))
  } catch (_e) {
    return bytes
  }
}

/**
 * What the key-value operations need from the backend.
 *
 * @internal
 */
export interface Couchbase2KvChannel {
  /**
   * The metadata every call carries.
   */
  readonly metadata: grpc.Metadata

  /**
   * A new request's context, traced under `obs` when it is given.
   */
  context(
    op: Couchbase2Op,
    timeoutMs: number,
    obs?: ObservableRequestHandler | null
  ): RequestContext
}

/**
 * An operation couchbase2 does not carry, and is not planned to.
 */
function notSupported(op: string): never {
  throw new FeatureNotAvailableError(
    new Error(`${op} is not supported over couchbase2.`)
  )
}

/**
 * Key-value operations over the gateway's `KvService`.
 *
 * @internal
 */
export class Couchbase2Kv implements KvBackend {
  private readonly _channel: Couchbase2KvChannel
  private readonly _client: KvServiceClient

  constructor(channel: Couchbase2KvChannel, client: KvServiceClient) {
    this._channel = channel
    this._client = client
  }

  /**
   * Reads a document with `KvService.Get`.
   */
  async get(req: KvGetRequest): Promise<GetResult> {
    const message = getRequestToProto(req)
    const ctx = this._channel.context(GET, req.timeout, req.obs)
    const resp = await unary<GetResponsePb>(ctx, (options, callback) =>
      this._client.Get(message, this._channel.metadata, options, callback)
    )
    return getResultFromProto(resp, req)
  }

  /**
   * Writes a document with `KvService.Upsert`.
   */
  async upsert(req: KvUpsertRequest): Promise<MutationResult> {
    const message = upsertRequestToProto(req)
    const ctx = this._channel.context(UPSERT, req.timeout, req.obs)
    const resp = await unary<UpsertResponsePb>(ctx, (options, callback) =>
      this._client.Upsert(message, this._channel.metadata, options, callback)
    )
    return mutationResultFromProto(resp)
  }

  /**
   * Checks for a document with `KvService.Exists`.
   */
  async exists(req: KvRequest): Promise<ExistsResult> {
    const message = existsRequestToProto(req)
    const ctx = this._channel.context(EXISTS, req.timeout, req.obs)
    const resp = await unary<ExistsResponsePb>(ctx, (options, callback) =>
      this._client.Exists(message, this._channel.metadata, options, callback)
    )
    return existsResultFromProto(resp)
  }

  /**
   * Not supported over couchbase2. Throws `FeatureNotAvailableError`.
   */
  getAnyReplica(_req: KvReplicaReadRequest): Promise<GetReplicaResult> {
    return notSupported('getAnyReplica')
  }

  /**
   * Not supported over couchbase2. Throws `FeatureNotAvailableError`.
   */
  getAllReplicas(
    _req: KvReplicaReadRequest
  ): StreamableReplicasPromise<GetReplicaResult[], GetReplicaResult> {
    return notSupported('getAllReplicas')
  }

  /**
   * Creates a document with `KvService.Insert`.
   */
  async insert(req: KvInsertRequest): Promise<MutationResult> {
    const message = insertRequestToProto(req)
    const ctx = this._channel.context(INSERT, req.timeout, req.obs)
    const resp = await unary<InsertResponsePb>(ctx, (options, callback) =>
      this._client.Insert(message, this._channel.metadata, options, callback)
    )
    return mutationResultFromProto(resp)
  }

  /**
   * Replaces a document with `KvService.Replace`.
   */
  async replace(req: KvReplaceRequest): Promise<MutationResult> {
    const message = replaceRequestToProto(req)
    const ctx = this._channel.context(REPLACE, req.timeout, req.obs)
    const resp = await unary<ReplaceResponsePb>(ctx, (options, callback) =>
      this._client.Replace(message, this._channel.metadata, options, callback)
    )
    return mutationResultFromProto(resp)
  }

  /**
   * Removes a document with `KvService.Remove`.
   */
  async remove(req: KvRemoveRequest): Promise<MutationResult> {
    const message = removeRequestToProto(req)
    const ctx = this._channel.context(REMOVE, req.timeout, req.obs)
    const resp = await unary<RemoveResponsePb>(ctx, (options, callback) =>
      this._client.Remove(message, this._channel.metadata, options, callback)
    )
    return mutationResultFromProto(resp)
  }

  /**
   * Reads a document and sets its expiry with `KvService.GetAndTouch`.
   */
  async getAndTouch(req: KvGetAndTouchRequest): Promise<GetResult> {
    const message = getAndTouchRequestToProto(req)
    const ctx = this._channel.context(GET_AND_TOUCH, req.timeout, req.obs)
    const resp = await unary<GetAndTouchResponsePb>(ctx, (options, callback) =>
      this._client.GetAndTouch(
        message,
        this._channel.metadata,
        options,
        callback
      )
    )
    return lockedOrTouchedResultFromProto(resp, req, 'getAndTouch')
  }

  /**
   * Sets a document's expiry with `KvService.Touch`.
   */
  async touch(req: KvTouchRequest): Promise<MutationResult> {
    const message = touchRequestToProto(req)
    const ctx = this._channel.context(TOUCH, req.timeout, req.obs)
    const resp = await unary<TouchResponsePb>(ctx, (options, callback) =>
      this._client.Touch(message, this._channel.metadata, options, callback)
    )
    return mutationResultFromProto(resp)
  }

  /**
   * Reads and locks a document with `KvService.GetAndLock`.
   */
  async getAndLock(req: KvGetAndLockRequest): Promise<GetResult> {
    const message = getAndLockRequestToProto(req)
    const ctx = this._channel.context(GET_AND_LOCK, req.timeout, req.obs)
    const resp = await unary<GetAndLockResponsePb>(ctx, (options, callback) =>
      this._client.GetAndLock(
        message,
        this._channel.metadata,
        options,
        callback
      )
    )
    return lockedOrTouchedResultFromProto(resp, req, 'getAndLock')
  }

  /**
   * Releases a lock with `KvService.Unlock`.
   */
  async unlock(req: KvUnlockRequest): Promise<void> {
    const message = unlockRequestToProto(req)
    const ctx = this._channel.context(UNLOCK, req.timeout, req.obs)
    await unary<UnlockResponsePb>(ctx, (options, callback) =>
      this._client.Unlock(message, this._channel.metadata, options, callback)
    )
  }

  /**
   * Reads paths in a document with `KvService.LookupIn`.
   */
  async lookupIn(req: KvLookupInRequest): Promise<LookupInResult> {
    const order = xattrsFirst(req.specs.map((spec) => spec._xattr))
    const message = lookupInRequestToProto(req, order)
    const ctx = this._channel.context(LOOKUP_IN, req.timeout, req.obs)
    const resp = await unary<LookupInResponsePb>(ctx, (options, callback) =>
      this._client.LookupIn(message, this._channel.metadata, options, callback)
    )
    return lookupInResultFromProto(resp, req, order)
  }

  /**
   * Not supported over couchbase2. Throws `FeatureNotAvailableError`.
   */
  lookupInAnyReplica(
    _req: KvLookupInReplicaRequest
  ): Promise<LookupInReplicaResult> {
    return notSupported('lookupInAnyReplica')
  }

  /**
   * Not supported over couchbase2. Throws `FeatureNotAvailableError`.
   */
  lookupInAllReplicas(
    _req: KvLookupInReplicaRequest
  ): StreamableReplicasPromise<LookupInReplicaResult[], LookupInReplicaResult> {
    return notSupported('lookupInAllReplicas')
  }

  /**
   * Changes paths in a document with `KvService.MutateIn`.
   */
  async mutateIn(req: KvMutateInRequest): Promise<MutateInResult> {
    const order = xattrsFirst(req.specs.map(({ spec }) => spec._xattr))
    const message = mutateInRequestToProto(req, order)
    const ctx = this._channel.context(MUTATE_IN, req.timeout, req.obs)
    const resp = await unary<MutateInResponsePb>(ctx, (options, callback) =>
      this._client.MutateIn(message, this._channel.metadata, options, callback)
    )
    return mutateInResultFromProto(resp, order)
  }

  /**
   * Increments a counter with `KvService.Increment`.
   */
  async increment(req: KvCounterRequest): Promise<CounterResult> {
    const message = counterRequestToProto(req)
    const ctx = this._channel.context(INCREMENT, req.timeout, req.obs)
    const resp = await unary<IncrementResponsePb>(ctx, (options, callback) =>
      this._client.Increment(message, this._channel.metadata, options, callback)
    )
    return counterResultFromProto(resp)
  }

  /**
   * Decrements a counter with `KvService.Decrement`.
   */
  async decrement(req: KvCounterRequest): Promise<CounterResult> {
    const message = counterRequestToProto(req)
    const ctx = this._channel.context(DECREMENT, req.timeout, req.obs)
    const resp = await unary<DecrementResponsePb>(ctx, (options, callback) =>
      this._client.Decrement(message, this._channel.metadata, options, callback)
    )
    return counterResultFromProto(resp)
  }

  /**
   * Adds bytes to the end of a document with `KvService.Append`.
   */
  async append(req: KvAppendRequest): Promise<MutationResult> {
    const message = appendRequestToProto(req)
    const ctx = this._channel.context(APPEND, req.timeout, req.obs)
    const resp = await unary<AppendResponsePb>(ctx, (options, callback) =>
      this._client.Append(message, this._channel.metadata, options, callback)
    )
    return mutationResultFromProto(resp)
  }

  /**
   * Adds bytes to the start of a document with `KvService.Prepend`.
   */
  async prepend(req: KvPrependRequest): Promise<MutationResult> {
    const message = prependRequestToProto(req)
    const ctx = this._channel.context(PREPEND, req.timeout, req.obs)
    const resp = await unary<PrependResponsePb>(ctx, (options, callback) =>
      this._client.Prepend(message, this._channel.metadata, options, callback)
    )
    return mutationResultFromProto(resp)
  }

  /**
   * Not supported over couchbase2. Throws `FeatureNotAvailableError`.
   */
  scan(_req: KvScanRequest): StreamableScanPromise<ScanResult[], ScanResult> {
    return notSupported('scan')
  }
}
