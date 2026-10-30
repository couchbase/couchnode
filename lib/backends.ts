/* eslint jsdoc/require-jsdoc: off */
import type { Authenticator } from './authenticators'
import type {
  BucketSettings,
  IBucketSettings,
  ICreateBucketSettings,
} from './bucketmanager'
import type { Collection } from './collection'
import type {
  CreateCollectionSettings,
  ScopeSpec,
  UpdateCollectionSettings,
} from './collectionmanager'
import type {
  CounterResult,
  ExistsResult,
  GetReplicaResult,
  GetResult,
  LookupInReplicaResult,
  LookupInResult,
  MutateInResult,
  MutationResult,
  ScanResult,
} from './crudoptypes'
import type { WaitUntilReadyOptions } from './diagnosticstypes'
import type {
  DurabilityLevel,
  ReadPreference,
  StoreSemantics,
} from './generaltypes'
import type { MutationState } from './mutationstate'
import type { ObservableRequestHandler } from './observabilityhandler'
import type { QueryIndex } from './queryindexmanager'
import type { QueryMetaData, QueryOptions, QueryResult } from './querytypes'
import type { PrefixScan, RangeScan, SamplingScan } from './rangeScan'
import type { LookupInSpec, MutateInSpec } from './sdspecs'
import type { ISearchIndex, SearchIndex } from './searchindexmanager'
import type { SearchQuery } from './searchquery'
import type {
  SearchMetaData,
  SearchQueryOptions,
  SearchRequest,
  SearchResult,
  SearchRow,
} from './searchtypes'
import type {
  StreamableReplicasPromise,
  StreamableRowPromise,
  StreamableScanPromise,
} from './streamablepromises'
import type { Transcoder } from './transcoders'
import type { CasInput } from './utilities'

// The contract between the public facade and a protocol backend. Every type
// here is the SDK's own, so the facade can hold a backend without loading the
// native addon or the generated protocol messages. Methods return promises
// only; callbacks stay in the facade's PromiseHelper.wrapAsync. A backend
// that cannot serve an operation still implements it and rejects with
// FeatureNotAvailableError, so the compiler lists what a backend is missing.
//
// Analytics, views, eventing, user management, transactions, ping and
// diagnostics have no interface. A cluster with a backend has no native
// connection, so those reach Cluster.conn and fail with
// FeatureNotAvailableError there.

/**
 * A scope that a query, a search or a search index is bound to.
 *
 * @internal
 */
export interface KeyspaceScope {
  bucketName: string
  scopeName: string
}

/**
 * What every request carries once the facade has resolved it: the timeout
 * to apply, already defaulted from the cluster, and the observability
 * handler, which is null when no tracer or meter is configured.
 *
 * @internal
 */
export interface BackendRequest {
  timeout: number
  obs: ObservableRequestHandler | null
}

/**
 * A document's full address, with the default scope and collection already
 * named.
 *
 * @internal
 */
export interface DocumentId {
  bucket: string
  scope: string
  collection: string
  key: string
}

/**
 * A key-value request, addressed to one document.
 *
 * @internal
 */
export interface KvRequest extends BackendRequest {
  id: DocumentId
}

/**
 * A key-value request that returns a document value, with the transcoder that
 * decodes it.
 *
 * @internal
 */
export interface KvReadRequest extends KvRequest {
  transcoder: Transcoder
}

/**
 * The durability a mutation asked for. `persistTo` and `replicateTo` are the
 * legacy observe based form, set only when the user passed them.
 *
 * @internal
 */
export interface KvDurability {
  durabilityLevel: DurabilityLevel
  persistTo?: number
  replicateTo?: number
}

/**
 * @internal
 */
export interface KvGetRequest extends KvReadRequest {
  project?: string[]
  withExpiry: boolean
}

/**
 * @internal
 */
export interface KvReplicaReadRequest extends KvReadRequest {
  readPreference?: ReadPreference
}

/**
 * A document value, already encoded by the transcoder, and the expiry
 * already parsed to the server's form.
 *
 * @internal
 */
export interface KvInsertRequest extends KvRequest, KvDurability {
  value: Buffer
  flags: number
  expiry: number
}

/**
 * @internal
 */
export interface KvUpsertRequest extends KvInsertRequest {
  preserveExpiry: boolean
}

/**
 * @internal
 */
export interface KvReplaceRequest extends KvUpsertRequest {
  cas?: CasInput
}

/**
 * @internal
 */
export interface KvRemoveRequest extends KvRequest, KvDurability {
  cas?: CasInput
}

/**
 * @internal
 */
export interface KvGetAndTouchRequest extends KvReadRequest {
  expiry: number
}

/**
 * @internal
 */
export interface KvTouchRequest extends KvRequest {
  expiry: number
}

/**
 * @internal
 */
export interface KvGetAndLockRequest extends KvReadRequest {
  lockTime: number
}

/**
 * @internal
 */
export interface KvUnlockRequest extends KvRequest {
  cas: CasInput
}

/**
 * @internal
 */
export interface KvLookupInRequest extends KvRequest {
  specs: LookupInSpec[]
  accessDeleted: boolean
}

/**
 * @internal
 */
export interface KvLookupInReplicaRequest extends KvRequest {
  specs: LookupInSpec[]
  readPreference?: ReadPreference
}

/**
 * A mutate-in spec with its value, already encoded when the spec has one.
 *
 * @internal
 */
export interface EncodedMutateInSpec {
  spec: MutateInSpec
  value?: Buffer
}

/**
 * @internal
 */
export interface KvMutateInRequest extends KvRequest, KvDurability {
  specs: EncodedMutateInSpec[]
  storeSemantics?: StoreSemantics
  expiry: number
  preserveExpiry: boolean
  cas?: CasInput
}

/**
 * An increment or a decrement. `delta` is the magnitude; the method says
 * which way it moves.
 *
 * @internal
 */
export interface KvCounterRequest extends KvRequest, KvDurability {
  delta: number | bigint
  initial?: number | bigint
  expiry: number
}

/**
 * An append, with the bytes to add to the end of the document.
 *
 * @internal
 */
export interface KvAppendRequest extends KvRequest, KvDurability {
  value: Buffer
  cas?: CasInput
}

/**
 * A prepend, with the bytes to add to the start of the document. It
 * carries the same fields as an append.
 *
 * @internal
 */
export type KvPrependRequest = KvAppendRequest

/**
 * A range, prefix or sampling scan over a collection, with its limits
 * already defaulted.
 *
 * @internal
 */
export interface KvScanRequest {
  collection: Collection
  scanType: RangeScan | SamplingScan | PrefixScan
  transcoder: Transcoder
  timeout: number
  idsOnly: boolean
  consistentWith?: MutationState
  batchByteLimit: number
  batchItemLimit: number
  concurrency: number
}

/**
 * Key-value, sub-document and range scan operations. The facade resolves
 * the timeout, transcoder, encoded value, expiry, durability and span first,
 * so each method only maps the request and the response.
 *
 * @internal
 */
export interface KvBackend {
  get(req: KvGetRequest): Promise<GetResult>
  exists(req: KvRequest): Promise<ExistsResult>
  getAnyReplica(req: KvReplicaReadRequest): Promise<GetReplicaResult>
  getAllReplicas(
    req: KvReplicaReadRequest
  ): StreamableReplicasPromise<GetReplicaResult[], GetReplicaResult>
  insert(req: KvInsertRequest): Promise<MutationResult>
  upsert(req: KvUpsertRequest): Promise<MutationResult>
  replace(req: KvReplaceRequest): Promise<MutationResult>
  remove(req: KvRemoveRequest): Promise<MutationResult>
  getAndTouch(req: KvGetAndTouchRequest): Promise<GetResult>
  touch(req: KvTouchRequest): Promise<MutationResult>
  getAndLock(req: KvGetAndLockRequest): Promise<GetResult>
  unlock(req: KvUnlockRequest): Promise<void>
  lookupIn(req: KvLookupInRequest): Promise<LookupInResult>
  lookupInAnyReplica(
    req: KvLookupInReplicaRequest
  ): Promise<LookupInReplicaResult>
  lookupInAllReplicas(
    req: KvLookupInReplicaRequest
  ): StreamableReplicasPromise<LookupInReplicaResult[], LookupInReplicaResult>
  mutateIn(req: KvMutateInRequest): Promise<MutateInResult>
  increment(req: KvCounterRequest): Promise<CounterResult>
  decrement(req: KvCounterRequest): Promise<CounterResult>
  append(req: KvAppendRequest): Promise<MutationResult>
  prepend(req: KvPrependRequest): Promise<MutationResult>
  scan(req: KvScanRequest): StreamableScanPromise<ScanResult[], ScanResult>
}

/**
 * SQL++ queries. Most of the work in a query is turning its options into a
 * request, so the facade passes the options as the user gave them and the
 * backend resolves the timeout itself. The facade opens the span, and the
 * backend ends it when the stream ends.
 *
 * @internal
 */
export interface QueryBackend {
  query<TRow = any>(
    statement: string,
    options: QueryOptions,
    scope?: KeyspaceScope,
    obs?: ObservableRequestHandler | null
  ): StreamableRowPromise<QueryResult<TRow>, TRow, QueryMetaData>
}

/**
 * Search queries, passed through as {@link QueryBackend} passes a query.
 *
 * @internal
 */
export interface SearchBackend {
  search(
    indexName: string,
    request: SearchQuery | SearchRequest,
    options: SearchQueryOptions,
    scope?: KeyspaceScope,
    obs?: ObservableRequestHandler | null
  ): StreamableRowPromise<SearchResult, SearchRow, SearchMetaData>
}

/**
 * @internal
 */
export interface BucketManagementBackend {
  createBucket(
    settings: ICreateBucketSettings,
    req: BackendRequest
  ): Promise<void>
  updateBucket(
    settings: Partial<IBucketSettings> & Pick<IBucketSettings, 'name'>,
    req: BackendRequest
  ): Promise<void>
  dropBucket(bucketName: string, req: BackendRequest): Promise<void>
  getBucket(bucketName: string, req: BackendRequest): Promise<BucketSettings>
  getAllBuckets(req: BackendRequest): Promise<BucketSettings[]>
  flushBucket(bucketName: string, req: BackendRequest): Promise<void>
}

/**
 * @internal
 */
export interface CollectionManagementBackend {
  getAllScopes(bucketName: string, req: BackendRequest): Promise<ScopeSpec[]>
  createScope(
    bucketName: string,
    scopeName: string,
    req: BackendRequest
  ): Promise<void>
  dropScope(
    bucketName: string,
    scopeName: string,
    req: BackendRequest
  ): Promise<void>
  createCollection(
    bucketName: string,
    scopeName: string,
    collectionName: string,
    settings: CreateCollectionSettings,
    req: BackendRequest
  ): Promise<void>
  updateCollection(
    bucketName: string,
    scopeName: string,
    collectionName: string,
    settings: UpdateCollectionSettings,
    req: BackendRequest
  ): Promise<void>
  dropCollection(
    bucketName: string,
    scopeName: string,
    collectionName: string,
    req: BackendRequest
  ): Promise<void>
}

/**
 * The keyspace a query index belongs to: a bucket, or a collection within
 * one.
 *
 * @internal
 */
export interface QueryIndexKeyspace {
  bucketName: string
  scopeName?: string
  collectionName?: string
}

/**
 * @internal
 */
export interface QueryIndexCreateSettings {
  ignoreIfExists: boolean
  numReplicas?: number
  deferred?: boolean
}

/**
 * Query index management. `watchIndexes` is given the watch's own timeout,
 * which bounds every request it makes.
 *
 * @internal
 */
export interface QueryIndexManagementBackend {
  createIndex(
    keyspace: QueryIndexKeyspace,
    indexName: string,
    keys: string[],
    settings: QueryIndexCreateSettings,
    req: BackendRequest
  ): Promise<void>
  createPrimaryIndex(
    keyspace: QueryIndexKeyspace,
    indexName: string | undefined,
    settings: QueryIndexCreateSettings,
    req: BackendRequest
  ): Promise<void>
  dropIndex(
    keyspace: QueryIndexKeyspace,
    indexName: string,
    ignoreIfNotExists: boolean,
    req: BackendRequest
  ): Promise<void>
  dropPrimaryIndex(
    keyspace: QueryIndexKeyspace,
    indexName: string | undefined,
    ignoreIfNotExists: boolean,
    req: BackendRequest
  ): Promise<void>
  getAllIndexes(
    keyspace: QueryIndexKeyspace,
    req: BackendRequest
  ): Promise<QueryIndex[]>
  buildDeferredIndexes(
    keyspace: QueryIndexKeyspace,
    req: BackendRequest
  ): Promise<string[]>
  watchIndexes(
    keyspace: QueryIndexKeyspace,
    indexNames: string[],
    watchPrimary: boolean,
    timeout: number,
    req: BackendRequest
  ): Promise<void>
}

/**
 * A search index management request, bound to a scope for the scope level
 * manager and to the cluster otherwise.
 *
 * @internal
 */
export interface SearchIndexRequest extends BackendRequest {
  scope?: KeyspaceScope
}

/**
 * @internal
 */
export interface SearchIndexManagementBackend {
  getIndex(indexName: string, req: SearchIndexRequest): Promise<SearchIndex>
  getAllIndexes(req: SearchIndexRequest): Promise<SearchIndex[]>
  upsertIndex(index: ISearchIndex, req: SearchIndexRequest): Promise<void>
  dropIndex(indexName: string, req: SearchIndexRequest): Promise<void>
  getIndexedDocumentsCount(
    indexName: string,
    req: SearchIndexRequest
  ): Promise<number>
  pauseIngest(indexName: string, req: SearchIndexRequest): Promise<void>
  resumeIngest(indexName: string, req: SearchIndexRequest): Promise<void>
  allowQuerying(indexName: string, req: SearchIndexRequest): Promise<void>
  disallowQuerying(indexName: string, req: SearchIndexRequest): Promise<void>
  freezePlan(indexName: string, req: SearchIndexRequest): Promise<void>
  unfreezePlan(indexName: string, req: SearchIndexRequest): Promise<void>
  analyzeDocument(
    indexName: string,
    document: any,
    req: SearchIndexRequest
  ): Promise<any>
}

/**
 * A protocol backend for a cluster: one member per area, and the cluster
 * level readiness check and shutdown.
 *
 * @internal
 */
export interface Backend {
  readonly kv: KvBackend
  readonly query: QueryBackend
  readonly search: SearchBackend
  readonly buckets: BucketManagementBackend
  readonly collections: CollectionManagementBackend
  readonly queryIndexes: QueryIndexManagementBackend
  readonly searchIndexes: SearchIndexManagementBackend
  waitUntilReady(timeout: number, options: WaitUntilReadyOptions): Promise<void>
  updateCredentials(auth: Authenticator): void
  close(): Promise<void>
}

/**
 * The part of {@link Backend} the couchbase2 backend implements so far, the
 * one list both that backend and `Cluster` read. It grows until it is
 * `Backend`, and is then removed.
 *
 * @internal
 */
export type ImplementedBackend = Pick<
  Backend,
  | 'buckets'
  | 'collections'
  | 'waitUntilReady'
  | 'updateCredentials'
  | 'close'
>
