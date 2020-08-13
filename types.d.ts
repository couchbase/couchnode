/**
 * <p>AnalyticsIndexManager provides an interface for performing management
 * operations against the analytics indexes for the cluster.</p>
 */
declare class AnalyticsIndexManager {
    createDataverse(dataverseName: string, options?: {
        ignoreIfExists?: boolean;
        timeout?: integer;
    }, callback?: CreateDataverseCallback): Promise<boolean>;
    dropDataverse(dataverseName: string, options?: {
        ignoreIfNotExists?: boolean;
        timeout?: integer;
    }, callback?: DropDataverseCallback): Promise<boolean>;
    createDataset(datasetName: string, options?: {
        ignoreIfExists?: boolean;
        dataverseName?: string;
        condition?: string;
        timeout?: integer;
    }, callback?: CreateDatasetCallback): Promise<boolean>;
    dropDataset(datasetName: string, options?: {
        ignoreIfNotExists?: boolean;
        dataverseName?: string;
        timeout?: integer;
    }, callback?: DropDatasetCallback): Promise<boolean>;
    getAllDatasets(options?: {
        timeout?: integer;
    }, callback?: GetAllDatasetsCallback): Promise<AnalyticsDataset[]>;
    createIndex(datasetName: string, indexName: string, fields: string[], options?: {
        dataverseName?: string;
        ignoreIfExists?: boolean;
        timeout?: integer;
    }, callback?: CreateAnalyticsIndexCallback): Promise<boolean>;
    dropIndex(datasetName: string, indexName: string, options?: {
        dataverseName?: string;
        ignoreIfNotExists?: boolean;
        timeout?: integer;
    }, callback?: DropAnalyticsIndexCallback): Promise<boolean>;
    getAllIndexes(options?: {
        timeout?: integer;
    }, callback?: GetAllIndexesCallback): Promise<AnalyticsIndex[]>;
    connectLink(linkName: string, options?: {
        timeout?: integer;
    }, callback?: ConnectLinkCallback): Promise<boolean>;
    disconnectLink(linkName: string, options?: {
        timeout?: integer;
    }, callback?: DisconnectLinkCallback): Promise<boolean>;
    getPendingMutations(options?: {
        timeout?: integer;
    }, callback?: GetPendingMutationsCallback): Promise<{
        [key: string]: number;
    }>;
}

declare type CreateDataverseCallback = (err: Error, success: boolean) => void;

declare type DropDataverseCallback = () => void;

declare type CreateDatasetCallback = () => void;

declare type DropDatasetCallback = () => void;

declare type AnalyticsDataset = {
    name: string;
    dataverseName: string;
    linkName: string;
    bucketName: string;
};

declare type GetAllDatasetsCallback = () => void;

declare type CreateAnalyticsIndexCallback = () => void;

declare type DropAnalyticsIndexCallback = () => void;

declare type AnalyticsIndex = {
    name: string;
    datasetName: string;
    dataverseName: string;
    isPrimary: boolean;
};

declare type GetAllIndexesCallback = () => void;

declare type ConnectLinkCallback = () => void;

declare type DisconnectLinkCallback = () => void;

declare type GetPendingMutationsCallback = () => void;

/**
 * <p>BinaryCollection provides various binary operations which
 * are available to be performed against a collection.</p>
 */
declare class BinaryCollection {
    increment(key: string, value: integer, options?: {
        timeout?: integer;
    }, callback: IncrementCallback): Promise<IncrementResult>;
    decrement(key: string, value: integer, options?: {
        timeout?: integer;
    }, callback: DecrementCallback): Promise<DecrementResult>;
    append(key: string, value: Buffer, options?: {
        timeout?: integer;
    }, callback: AppendCallback): Promise<AppendResult>;
    prepend(key: string, value: Buffer, options?: {
        timeout?: integer;
    }, callback: PrependCallback): Promise<PrependResult>;
}

declare type IncrementResult = {
    value: integer;
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type IncrementCallback = () => void;

declare type DecrementResult = {
    value: integer;
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type DecrementCallback = () => void;

declare type AppendResult = {
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type AppendCallback = () => void;

declare type PrependResult = {
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type PrependCallback = () => void;

/**
 * <p>Bucket represents a storage grouping of data within a Couchbase Server cluster.</p>
 */
declare class Bucket {
    /**
     * @param designDoc - <p>The design document containing the view to query</p>
     * @param viewName - <p>The name of the view to query</p>
     */
    viewQuery(designDoc: string, viewName: string, options: {
        scanConsistency?: ViewScanConsistency;
        skip?: integer;
        limit?: integer;
        order?: ViewOrderMode;
        reduce?: string;
        group?: boolean;
        groupLevel?: integer;
        key?: string;
        keys?: string[];
        range?: {
            start?: string | string[];
            end?: string | string[];
            inclusiveEnd?: boolean;
        };
        idRange?: {
            start?: string;
            end?: string;
        };
        fullSet?: boolean;
        onError?: ViewErrorMode;
        timeout?: integer;
    }, callback?: ViewQueryCallback): Promise<ViewQueryResult>;
    /**
     * <p>Gets a reference to a specific scope.</p>
     */
    scope(scopeName: string): Scope;
    /**
     * <p>Gets a reference to the default scope.</p>
     */
    defaultScope(): Scope;
    /**
     * <p>Gets a reference to a specific collection.</p>
     */
    collection(collectionName: string): Collection;
    /**
     * <p>Gets a reference to the default collection.</p>
     */
    defaultCollection(): Collection;
    /**
     * <p>Gets a view index manager for this bucket</p>
     */
    viewIndexes(): ViewIndexManager;
    /**
     * <p>Gets a collection manager for this bucket</p>
     */
    collections(): CollectionManager;
    /**
     * <p>Returns the name of this bucket.</p>
     */
    name: any;
}

declare type ViewQueryResult = {
    rows: object[];
    meta: any;
};

declare type ViewQueryCallback = () => void;

/**
 * <p>BucketManager provides an interface for adding/removing/updating
 * buckets within the cluster.</p>
 */
declare class BucketManager {
    createBucket(settings: BucketSettings, options?: {
        timeout?: number;
    }, callback?: CreateBucketCallback): Promise<boolean>;
    updateBucket(settings: BucketSettings, options?: {
        timeout?: number;
    }, callback?: UpdateBucketCallback): Promise<boolean>;
    dropBucket(bucketName: string, options?: {
        timeout?: number;
    }, callback?: DropBucketCallback): Promise<boolean>;
    getBucket(bucketName: string, options?: {
        timeout?: number;
    }, callback?: GetBucketCallback): Promise<BucketSettings>;
    getAllBuckets(bucketName: string, options?: {
        timeout?: number;
    }, callback?: GetAllBucketsCallback): Promise<BucketSettings[]>;
    flushBucket(bucketName: string, options?: {
        timeout?: number;
    }, callback?: FlushBucketCallback): Promise<boolean>;
}

/**
 * <p>BucketSettings provides information about a specific bucket.</p>
 */
declare type BucketSettings = {
    name: string;
    flushEnabled: boolean;
    ramQuotaMB: number;
    numReplicas: number;
    replicaIndexes: boolean;
    bucketType: BucketType;
    ejectionMethod: EvictionPolicy;
    maxTTL: number;
    compressionMode: CompressionMode;
};

/**
 * <p>CreateBucketSettings provides information for creating a bucket.</p>
 */
declare type CreateBucketSettings = {
    conflictResolutionType: ConflictResolutionType;
};

declare type CreateBucketCallback = () => void;

declare type UpdateBucketCallback = () => void;

declare type DropBucketCallback = () => void;

declare type GetBucketCallback = () => void;

declare type GetAllBucketsCallback = () => void;

declare type FlushBucketCallback = () => void;

/**
 * <p>Cluster represents an entire Couchbase Server cluster.</p>
 */
declare class Cluster {
    /**
     * <p>Connect establishes a connection to the cluster and is the entry
     * point for all SDK operations.</p>
     * @returns <p>Promise<Cluster></p>
     */
    static connect(connStr: string, options?: {
        username?: string;
        password?: string;
        clientCertificate?: string;
        certificateChain?: string;
        transcoder?: Transcoder;
        logFunc?: LoggingCallback;
    }, callback?: any): any;
    /**
     * <p>Diagnostics returns stateful data about the current SDK connections.</p>
     */
    diagnostics(options?: {
        reportId?: string;
    }, callback: DiagnosticsCallback): Promise<DiagnosticsResult>;
    /**
     * @param query - <p>The query string to execute.</p>
     * @param [options.parameters] - <p>parameters specifies a list of values to substitute within the query
     * statement during execution.</p>
     * @param [options.scanConsistency] - <p>scanConsistency specifies the level of consistency that is required for
     * the results of the query.</p>
     * @param [options.consistentWith] - <p>consistentWith specifies a MutationState object to use when determining
     * the level of consistency needed for the results of the query.</p>
     * @param [options.adhoc] - <p>adhoc specifies that the query is an adhoc query and should not be
     * prepared and cached within the SDK.</p>
     * @param [options.clientContextId] - <p>clientContextId specifies a unique identifier for the execution of this
     * query to enable various tools to correlate the query.</p>
     * @param [options.readOnly] - <p>readOnly specifies that query should not be permitted to mutate any data.
     * This option also enables a few minor performance improvements and the
     * ability to automatically retry the query on failure.</p>
     * @param [options.profile] - <p>profile enables the return of profiling data from the server.</p>
     * @param [options.metrics] - <p>metrics enables the return of metrics data from the server</p>
     * @param [options.raw] - <p>raw specifies an object represent raw key value pairs that should be
     * included with the query.</p>
     * @param [options.timeout] - <p>timeout specifies the number of ms to wait for completion before
     * cancelling the operation and returning control to the application.</p>
     */
    query(query: string, options?: {
        parameters?: any | any[];
        scanConsistency?: QueryScanConsistency;
        consistentWith?: MutationState;
        adhoc?: boolean;
        clientContextId?: string;
        maxParallelism?: number;
        pipelineBatch?: number;
        pipelineCap?: number;
        scanWait?: number;
        scanCap?: number;
        readOnly?: boolean;
        profile?: QueryProfileMode;
        metrics?: boolean;
        raw?: any;
        timeout?: integer;
    }, callback?: QueryCallback): Promise<QueryResult>;
    /**
     * @param query - <p>The query string to execute.</p>
     * @param [options.parameters] - <p>parameters specifies a list of values to substitute within the query
     * statement during execution.</p>
     * @param [options.scanConsistency] - <p>scanConsistency specifies the level of consistency that is required for
     * the results of the query.</p>
     * @param [options.clientContextId] - <p>clientContextId specifies a unique identifier for the execution of this
     * query to enable various tools to correlate the query.</p>
     * @param [options.priority] - <p>priority specifies that this query should be executed with a higher
     * priority than others, causing it to receive extra resources.</p>
     * @param [options.readOnly] - <p>readOnly specifies that query should not be permitted to mutate any data.
     * This option also enables a few minor performance improvements and the
     * ability to automatically retry the query on failure.</p>
     * @param [options.raw] - <p>raw specifies an object represent raw key value pairs that should be
     * included with the query.</p>
     * @param [options.timeout] - <p>timeout specifies the number of ms to wait for completion before
     * cancelling the operation and returning control to the application.</p>
     */
    analyticsQuery(query: string, options?: {
        parameters?: any | any[];
        scanConsistency?: AnalyticsScanConsistency;
        clientContextId?: string;
        priority?: boolean;
        readOnly?: boolean;
        raw?: any;
        timeout?: integer;
    }, callback?: AnalyticsQueryCallback): Promise<AnalyticsResult>;
    /**
     * @param indexName - <p>The name of the index to execute the query against.</p>
     * @param query - <p>The search query object describing the requested search.</p>
     */
    searchQuery(indexName: string, query: SearchQuery, options: {
        skip?: number;
        limit?: number;
        explain?: boolean;
        highlight?: {
            style?: HighlightStyle;
            fields?: string[];
        };
        fields?: string[];
        facets?: SearchFacet[];
        sort?: SearchSort;
        consistency?: SearchConsistency;
        consistentWith?: MutationState;
        timeout?: number;
    }, callback: SearchQueryCallback): Promise<SearchQueryResult>;
    /**
     * <p>Gets a reference to a bucket.</p>
     */
    bucket(bucketName: string): Bucket;
    /**
     * <p>Closes all connections associated with this cluster.  Any
     * running operations will be cancelled.  Further operations
     * will cause new connections to be established.</p>
     */
    close(): void;
    /**
     * <p>Gets a user manager for this cluster</p>
     */
    users(): UserManager;
    /**
     * <p>Gets a bucket manager for this cluster</p>
     */
    buckets(): BucketManager;
    /**
     * <p>Gets a query index manager for this cluster</p>
     */
    queryIndexes(): QueryIndexManager;
    /**
     * <p>Gets an analytics index manager for this cluster</p>
     */
    analyticsIndexes(): AnalyticsIndexManager;
    /**
     * <p>Gets a search index manager for this cluster</p>
     */
    searchIndexes(): SearchIndexManager;
}

/**
 * <p>Contains the results from a previously executed Diagnostics operation.</p>
 */
declare type DiagnosticsResult = {
    id: string;
    version: number;
    sdk: string;
    services: any;
};

declare type DiagnosticsCallback = () => void;

declare type QueryResult = {
    rows: object[];
    meta: any;
};

declare type QueryCallback = () => void;

declare type AnalyticsResult = {
    rows: object[];
    meta: any;
};

declare type AnalyticsQueryCallback = () => void;

declare type SearchQueryResult = {
    rows: object[];
    meta: any;
};

declare type SearchQueryCallback = () => void;

/**
 * <p>Collection provides an interface for performing operations against
 * a collection within the cluster.</p>
 */
declare class Collection {
    get(key: string, options?: {
        project?: string[];
        withExpiry?: boolean;
        transcoder?: Transcoder;
        timeout?: integer;
    }, callback?: GetCallback): Promise<GetResult>;
    exists(key: string, options?: {
        timeout?: integer;
    }, callback?: ExistsCallback): Promise<ExistsResult>;
    getAnyReplica(key: string, options?: {
        transcoder?: Transcoder;
        timeout?: integer;
    }, callback?: GetAnyReplicaCallback): Promise<GetReplicaResult>;
    getAllReplicas(key: string, options?: {
        transcoder?: Transcoder;
        timeout?: integer;
    }, callback?: GetAllReplicasCallback): Promise<GetReplicaResult[]>;
    insert(key: string, value: any, options: {
        transcoder?: Transcoder;
        timeout?: integer;
    }, callback: MutationCallback): Promise<MutationResult>;
    upsert(key: string, value: any, options?: {
        transcoder?: Transcoder;
        timeout?: integer;
    }, callback: MutationCallback): Promise<MutationResult>;
    replace(key: string, value: any, options: {
        transcoder?: Transcoder;
        timeout?: integer;
        cas?: Cas;
    }, callback: MutationCallback): Promise<MutationResult>;
    remove(key: string, options: {
        timeout?: integer;
    }, callback?: RemoveCallback): Promise<RemoveResult>;
    getAndTouch(key: string, expiry: integer, options?: {
        transcoder?: Transcoder;
        timeout?: integer;
    }, callback?: GetAndTouchCallback): Promise<GetAndTouchResult>;
    touch(key: string, expiry: integer, options?: {
        timeout?: integer;
    }, callback?: TouchCallback): Promise<TouchResult>;
    getAndLock(key: string, lockTime: integer, options?: {
        transcoder?: Transcoder;
        timeout?: integer;
    }, callback?: GetAndLockCallback): Promise<GetAndLockCallback>;
    unlock(key: string, cas: Cas, options?: {
        timeout?: integer;
    }, callback?: UnlockCallback): Promise<UnlockResult>;
    lookupIn(key: string, spec: LookupInSpec[], options?: {
        timeout?: integer;
    }, callback?: LookupInCallback): Promise<LookupInResult>;
    mutateIn(key: string, spec: MutateInSpec, options?: {
        cas?: Cas;
        timeout?: integer;
    }, callback?: MutateInCallback): Promise<MutateInResult>;
    list(key: string): CouchbaseList;
    queue(key: string): CouchbaseQueue;
    map(key: string): CouchbaseMap;
    set(key: string): CouchbaseSet;
    binary(): BinaryCollection;
}

/**
 * <p>Contains the results from a previously execute Get operation.</p>
 */
declare type GetResult = {
    value: any;
    cas: Cas;
    expiry?: integer;
};

declare type GetCallback = () => void;

/**
 * <p>Contains the results from a previously execute Get operation.</p>
 */
declare type ExistsResult = {
    exists: boolean;
    cas: Cas;
};

declare type ExistsCallback = () => void;

/**
 * <p>Contains the results from a previously executed replica get operation.</p>
 */
declare type GetReplicaResult = {
    value: any;
    cas: Cas;
    isReplica: boolean;
};

declare type GetAnyReplicaCallback = () => void;

declare type GetAllReplicasCallback = () => void;

/**
 * <p>Contains the results from a previously executed mutation operation.</p>
 */
declare type MutationResult = {
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type MutationCallback = () => void;

declare type RemoveResult = {
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type RemoveCallback = () => void;

declare type GetAndTouchResult = {
    content: any;
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type GetAndTouchCallback = () => void;

declare type TouchResult = {
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type TouchCallback = () => void;

declare type GetAndLockResult = {
    content: any;
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type GetAndLockCallback = () => void;

declare type UnlockResult = {
    content: any;
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type UnlockCallback = () => void;

declare type LookupInResult = {
    content: any;
    cas: Cas;
};

declare type LookupInCallback = () => void;

declare type MutateInResult = {
    content: any;
};

declare type MutateInCallback = () => void;

/**
 * <p>CollectionManager allows the management of collections within a Bucket.</p>
 */
declare class CollectionManager {
    /**
     * <p>createCollection creates a collection within a scope in a bucket.</p>
     * @param collectionSpec - <p>The details of the collection to create.</p>
     * @param collectionSpec.name - <p>The name of the collection to create.</p>
     * @param collectionSpec.scopeName - <p>The name of the scope to create the collection in.</p>
     * @param collectionSpec.maxExpiry - <p>The maximum expiry for documents in this bucket.</p>
     * @param [options.timeout] - <p>Timeout for the operation in milliseconds.</p>
     */
    createCollection(collectionSpec: {
        name: string;
        scopeName: string;
        maxExpiry: string;
    }, options?: {
        timeout?: number;
    }, callback?: CreateCollectionCallback): Promise<boolean>;
    /**
     * <p>dropCollection drops a collection from a scope in a bucket.</p>
     * @param collectionName - <p>The name of the collection to drop.</p>
     * @param scopeName - <p>The name of the scope containing the collection to drop.</p>
     * @param [options.timeout] - <p>Timeout for the operation in milliseconds.</p>
     */
    dropCollection(collectionName: string, scopeName: string, options?: {
        timeout?: number;
    }, callback?: DropCollectionCallback): Promise<boolean>;
    /**
     * <p>createScope creates a scope within a bucket.</p>
     * @param scopeName - <p>The name of the scope to create.</p>
     * @param [options.timeout] - <p>Timeout for the operation in milliseconds.</p>
     */
    createScope(scopeName: string, options?: {
        timeout?: number;
    }, callback?: CreateScopeCallback): Promise<boolean>;
    /**
     * <p>dropScope drops a scope from a bucket.</p>
     * @param scopeName - <p>The name of the scope to drop.</p>
     * @param [options.timeout] - <p>Timeout for the operation in milliseconds.</p>
     */
    dropScope(scopeName: string, options?: {
        timeout?: number;
    }, callback?: DropScopeCallback): Promise<boolean>;
}

declare type CreateCollectionCallback = () => void;

declare type DropCollectionCallback = () => void;

declare type CreateScopeCallback = () => void;

declare type DropScopeCallback = () => void;

declare type LoggingEntry = {
    severity: number;
    srcFile: string;
    srcLine: number;
    subsys: string;
    message: string;
};

declare type LoggingCallback = () => void;

declare type ConnectCallback = () => void;

/**
 * <p>Creates a new Cluster object for interacting with a Couchbase
 * cluster and performing operations.</p>
 * @param connStr - <p>The connection string of your cluster</p>
 * @param [options.username] - <p>The RBAC username to use when connecting to the cluster.</p>
 * @param [options.password] - <p>The RBAC password to use when connecting to the cluster</p>
 * @param [options.clientCertificate] - <p>A client certificate to use for authentication with the server.  Specifying
 * this certificate along with any other authentication method (such as username
 * and password) is an error.</p>
 * @param [options.certificateChain] - <p>A certificate chain to use for validating the clusters certificates.</p>
 */
declare function connect(connStr: any, options?: {
    username?: number;
    password?: string;
    clientCertificate?: string;
    certificateChain?: string;
}, callback?: ConnectCallback): Promise<Cluster>;

/**
 * <p>Expose the LCB version that is in use.</p>
 */
declare var lcbVersion: any;

/**
 * <p>CouchbaseList provides a simplified interface
 * for storing lists within a Couchbase document.</p>
 */
declare class CouchbaseList {
    getAll(callback: any): void;
    getAt(index: any, callback: any): void;
    removeAt(index: any, callback: any): void;
    indexOf(value: any, callback: any): void;
    size(callback: any): void;
    push(value: any, callback: any): void;
    unshift(value: any, callback: any): void;
}

/**
 * <p>CouchbaseMap provides a simplified interface
 * for storing a map within a Couchbase document.</p>
 */
declare class CouchbaseMap {
    getAll(callback: any): void;
    forEach(rowCallback: any, callback: any): void;
    set(item: any, value: any, callback: any): void;
    get(item: any, callback: any): void;
    remove(item: any, callback: any): void;
    exists(item: any, callback: any): void;
    keys(callback: any): void;
    values(callback: any): void;
    size(callback: any): void;
}

/**
 * <p>CouchbaseQueue provides a simplified interface
 * for storing a queue within a Couchbase document.</p>
 */
declare class CouchbaseQueue {
    size(callback: any): void;
    push(value: any, callback: any): void;
    pop(callback: any): void;
}

/**
 * <p>CouchbaseSet provides a simplified interface
 * for storing a set within a Couchbase document.</p>
 */
declare class CouchbaseSet {
    add(item: any, callback: any): void;
    contains(item: any, callback: any): void;
    remove(item: any, callback: any): void;
    values(callback: any): void;
    size(callback: any): void;
}

/**
 * <p>Transcoder provides an interface for performing custom transcoding
 * of document contents being retrieved and stored to the cluster.</p>
 */
declare interface Transcoder {
    encode(value: any): Pair<Buffer, number>;
    decode(bytes: Buffer, flags: number): any;
}

declare namespace DesignDocument {
    class DesignDocumentView {
    }
}

declare class DesignDocument {
    constructor(name: string, views: {
        [key: string]: DesignDocumentView;
    });
}

declare const DurabilityLevel: any;

declare const BucketType: any;

declare const EvictionPolicy: any;

declare const CompressionMode: any;

declare const ConflictResolutionType: any;

declare const QueryProfileMode: any;

declare const QueryScanConsistency: any;

declare const QueryStatus: any;

declare const AnalyticsScanConsistency: any;

declare const AnalyticsStatus: any;

declare const IndexType: any;

declare const HighlightStyle: any;

declare const ViewScanConsistency: any;

declare class CouchbaseError {
}

declare class TimeoutError {
}

declare class RequestCanceledError {
}

declare class InvalidArgumentError {
}

declare class ServiceNotAvailableError {
}

declare class InternalServerFailureError {
}

declare class AuthenticationFailureError {
}

declare class TemporaryFailureError {
}

declare class ParsingFailureError {
}

declare class CasMismatchError {
}

declare class BucketNotFoundError {
}

declare class CollectionNotFoundError {
}

declare class EncodingFailureError {
}

declare class DecodingFailureError {
}

declare class UnsupportedOperationError {
}

declare class AmbiguousTimeoutError {
}

declare class UnambiguousTimeoutError {
}

declare class FeatureNotAvailableError {
}

declare class ScopeNotFoundError {
}

declare class IndexNotFoundError {
}

declare class IndexExistsError {
}

declare class DocumentNotFoundError {
}

declare class DocumentUnretrievableError {
}

declare class DocumentLockedError {
}

declare class ValueTooLargeError {
}

declare class DocumentExistsError {
}

declare class ValueNotJsonError {
}

declare class DurabilityLevelNotAvailableError {
}

declare class DurabilityImpossibleError {
}

declare class DurabilityAmbiguousError {
}

declare class DurableWriteInProgressError {
}

declare class DurableWriteReCommitInProgressError {
}

declare class MutationLostError {
}

declare class PathNotFoundError {
}

declare class PathMismatchError {
}

declare class PathInvalidError {
}

declare class PathTooBigError {
}

declare class PathTooDeepError {
}

declare class ValueTooDeepError {
}

declare class ValueInvalidError {
}

declare class DocumentNotJsonError {
}

declare class NumberTooBigError {
}

declare class DeltaInvalidError {
}

declare class PathExistsError {
}

declare class PlanningFailureError {
}

declare class IndexFailureError {
}

declare class PreparedStatementFailure {
}

declare class CompilationFailureError {
}

declare class JobQueueFullError {
}

declare class DatasetNotFoundError {
}

declare class DataverseNotFoundError {
}

declare class DatasetExistsError {
}

declare class DataverseExistsError {
}

declare class LinkNotFoundError {
}

declare class ViewNotFoundError {
}

declare class DesignDocumentNotFoundError {
}

declare class CollectionExistsError {
}

declare class ScopeExistsError {
}

declare class UserNotFoundError {
}

declare class GroupNotFoundError {
}

declare class BucketExistsError {
}

declare class UserExistsError {
}

declare class BucketNotFlushableError {
}

declare class ErrorContext {
}

declare class KeyValueErrorContext {
}

declare class ViewErrorContext {
}

declare class QueryErrorContext {
}

declare class SearchErrorContext {
}

declare class AnalyticsErrorContext {
}

declare class LookupInSpec {
    static Expiry: any;
    static get(path: string, options?: any): LookupInSpec;
    static exists(path: string, options?: any): LookupInSpec;
    static count(path: string, options?: any): LookupInSpec;
}

declare class MutateInSpec {
    static insert(path: string, value: any, options?: {
        createPath?: boolean;
    }): MutateInSpec;
    static upsert(path: string, value: any, options?: {
        createPath?: boolean;
    }): MutateInSpec;
    static replace(path: string, value: any, options?: {
        createPath?: boolean;
    }): MutateInSpec;
    static remove(path: string, options?: any): MutateInSpec;
    static arrayAppend(path: string, value: any, options?: {
        createPath?: boolean;
    }): MutateInSpec;
    static arrayPrepend(path: string, value: any, options?: {
        createPath?: boolean;
    }): MutateInSpec;
    static arrayInsert(path: string, value: any, options?: {
        createPath?: boolean;
    }): MutateInSpec;
    static arrayAddUnique(path: string, value: any, options?: {
        createPath?: boolean;
    }): MutateInSpec;
    static increment(path: string, value: integer, options?: {
        createPath?: boolean;
    }): MutateInSpec;
    static decrement(path: string, value: integer, options?: {
        createPath?: boolean;
    }): MutateInSpec;
}

/**
 * <p>QueryIndexManager provides an interface for managing the
 * query indexes on the cluster.</p>
 */
declare class QueryIndexManager {
    createIndex(bucketName: string, indexName: string, fields: string[], options?: {
        ignoreIfExists?: boolean;
        deferred?: boolean;
        timeout?: integer;
    }, callback?: CreateQueryIndexCallback): Promise<boolean>;
    createPrimaryIndex(bucketName: string, options?: {
        ignoreIfExists?: boolean;
        deferred?: boolean;
        timeout?: integer;
    }, callback?: CreatePrimaryIndexCallback): Promise<boolean>;
    dropIndex(bucketName: string, indexName: string, options?: {
        ignoreIfNotExists?: boolean;
        timeout?: integer;
    }, callback?: DropQueryIndexCallback): Promise<boolean>;
    dropPrimaryIndex(bucketName: string, options?: {
        ignoreIfNotExists?: boolean;
        timeout?: integer;
    }, callback?: DropPrimaryIndexCallback): Promise<boolean>;
    getAllIndexes(bucketName: string, options?: {
        timeout?: integer;
    }, callback?: GetAllIndexesCallback): Promise<QueryIndex[]>;
    buildDeferredIndexes(bucketName: string, options?: {
        timeout?: integer;
    }, callback?: BuildDeferredIndexesCallback): Promise<string[]>;
    watchIndexes(bucketName: string, indexNames: string[], duration: number, options?: {
        watchPrimary?: integer;
    }, callback?: WatchIndexesCallback): Promise<boolean>;
}

declare type CreateQueryIndexCallback = () => void;

declare type CreatePrimaryIndexCallback = () => void;

declare type DropQueryIndexCallback = () => void;

declare type DropPrimaryIndexCallback = () => void;

declare type QueryIndex = {
    name: string;
    isPrimary: boolean;
    type: string;
    state: string;
    keyspace: string;
    indexKey: string;
};

declare type GetAllIndexesCallback = () => void;

declare type BuildDeferredIndexesCallback = () => void;

declare type WatchIndexesCallback = () => void;

declare class Scope {
    /**
     * <p>Gets a reference to a specific collection.</p>
     */
    collection(collectionName: string): Collection;
}

declare namespace SearchFacet {
    class TermFacet {
    }
    class NumericFacet {
        addRange(name: string, min: number, max: number): void;
    }
    class DateFacet {
        addRange(name: string, start: Date, end: Date): void;
    }
}

declare class SearchFacet {
    static term(field: string, size: number): void;
    static numeric(field: string, size: number): void;
    static date(field: string, size: number): void;
}

/**
 * <p>SearchIndexManager provides an interface for managing the
 * search indexes on the cluster.</p>
 */
declare class SearchIndexManager {
    getIndex(indexName: string, options?: {
        timeout?: integer;
    }, callback?: GetSearchIndexCallback): Promise<SearchIndex>;
    getAllIndexes(options?: {
        timeout?: integer;
    }, callback?: GetAllSearchIndexesCallback): Promise<SearchIndex[]>;
    upsertIndex(indexDefinition: SearchIndex, options?: {
        timeout?: integer;
    }, callback?: UpsertSearchIndexCallback): Promise<boolean>;
    dropIndex(indexName: string, options?: {
        timeout?: integer;
    }, callback?: DropSearchIndexCallback): Promise<boolean>;
    getIndexedDocumentsCount(indexName: string, options?: {
        timeout?: integer;
    }, callback?: GetIndexedDocumentsCountCallback): Promise<number>;
    pauseIngest(indexName: string, options?: {
        timeout?: integer;
    }, callback?: PauseIngestCallback): Promise<boolean>;
    resumeIngest(indexName: string, options?: {
        timeout?: integer;
    }, callback?: ResumeIngestCallback): Promise<boolean>;
    allowQuerying(indexName: string, options?: {
        timeout?: integer;
    }, callback?: AllowQueryingCallback): Promise<boolean>;
    disallowQuerying(indexName: string, options?: {
        timeout?: integer;
    }, callback?: DisallowQueryingCallback): Promise<boolean>;
    freezePlan(indexName: string, options?: {
        timeout?: integer;
    }, callback?: FreezePlanCallback): Promise<boolean>;
    analyzeDocument(indexName: string, document: any, options?: {
        timeout?: integer;
    }, callback?: AnalyzeDocumentCallback): Promise<object[]>;
}

/**
 * <p>SearchIndex provides information about a search index.</p>
 */
declare type SearchIndex = {
    uuid: string;
    name: string;
    sourceName: string;
    type: string;
    params: {
        [key: string]: object;
    };
    sourceUuid: string;
    sourceParams: {
        [key: string]: object;
    };
    sourceType: string;
    planParams: {
        [key: string]: object;
    };
};

declare type GetSearchIndexCallback = () => void;

declare type GetAllSearchIndexesCallback = () => void;

declare type UpsertSearchIndexCallback = () => void;

declare type DropSearchIndexCallback = () => void;

declare type GetIndexedDocumentsCountCallback = () => void;

declare type PauseIngestCallback = () => void;

declare type ResumeIngestCallback = () => void;

declare type AllowQueryingCallback = () => void;

declare type DisallowQueryingCallback = () => void;

declare type FreezePlanCallback = () => void;

declare type AnalyzeDocumentCallback = () => void;

declare namespace SearchQuery {
    class MatchQuery {
        field(field: string): MatchQuery;
        analyzer(analyzer: string): MatchQuery;
        prefixLength(prefixLength: number): MatchQuery;
        fuzziness(fuzziness: number): MatchQuery;
        boost(boost: number): MatchQuery;
    }
    class MatchPhraseQuery {
        field(field: string): MatchPhraseQuery;
        analyzer(analyzer: string): MatchPhraseQuery;
        boost(boost: number): MatchPhraseQuery;
    }
    class RegexpQuery {
        field(field: string): RegexpQuery;
        boost(boost: number): RegexpQuery;
    }
    class QueryStringQuery {
        boost(boost: number): QueryStringQuery;
    }
    class NumericRangeQuery {
        min(min: number, inclusive: boolean): NumericRangeQuery;
        max(max: number, inclusive: boolean): NumericRangeQuery;
        field(field: string): NumericRangeQuery;
        boost(boost: number): NumericRangeQuery;
    }
    class DateRangeQuery {
        start(start: Date, inclusive: boolean): DateRangeQuery;
        end(end: Date, inclusive: boolean): DateRangeQuery;
        field(field: string): DateRangeQuery;
        dateTimeParser(parser: string): DateRangeQuery;
        boost(field: string): DateRangeQuery;
    }
    class ConjunctionQuery {
        and(): ConjunctionQuery;
        boost(boost: number): ConjunctionQuery;
    }
    class DisjunctionQuery {
        or(): DisjunctionQuery;
        boost(boost: number): DisjunctionQuery;
    }
    class BooleanQuery {
        must(query: SearchQuery): BooleanQuery;
        should(query: SearchQuery): BooleanQuery;
        mustNot(query: SearchQuery): BooleanQuery;
        shouldMin(shouldMin: boolean): BooleanQuery;
        boost(boost: number): BooleanQuery;
    }
    class WildcardQuery {
        field(field: string): WildcardQuery;
        boost(boost: number): WildcardQuery;
    }
    class DocIdQuery {
        addDocIds(): DocIdQuery;
        field(field: string): DocIdQuery;
        boost(boost: number): DocIdQuery;
    }
    class BooleanFieldQuery {
        field(field: string): BooleanFieldQuery;
        boost(boost: number): BooleanFieldQuery;
    }
    class TermQuery {
        field(field: string): TermQuery;
        prefixLength(prefixLength: number): TermQuery;
        fuzziness(fuzziness: number): TermQuery;
        boost(boost: number): TermQuery;
    }
    class PhraseQuery {
        field(field: string): PhraseQuery;
        boost(boost: number): PhraseQuery;
    }
    class PrefixQuery {
        field(field: string): PrefixQuery;
        boost(boost: number): PrefixQuery;
    }
    class MatchAllQuery {
    }
    class MatchNoneQuery {
    }
    class GeoDistanceQuery {
        field(field: string): GeoDistanceQuery;
        boost(boost: number): GeoDistanceQuery;
    }
    class GeoBoundingBoxQuery {
        field(field: string): GeoBoundingBoxQuery;
        boost(boost: number): GeoBoundingBoxQuery;
    }
}

declare class SearchQuery {
    static match(match: any): MatchQuery;
    static matchPhrase(phrase: string): MatchPhraseQuery;
    static regexp(regexp: string): RegexpQuery;
    static queryString(query: string): QueryStringQuery;
    static numericRange(): NumericRangeQuery;
    static dateRange(): DateRangeQuery;
    static conjuncts(): ConjunctionQuery;
    static disjuncts(): DisjunctionQuery;
    static boolean(): BooleanQuery;
    static wildcard(wildcard: string): WildcardQuery;
    static docIds(): DocIdQuery;
    static booleanField(val: boolean): BooleanFieldQuery;
    static term(term: string): TermQuery;
    static phrase(terms: string): PhraseQuery;
    static prefix(prefix: string): PrefixQuery;
    static matchAll(): MatchAllQuery;
    static matchNone(): MatchNoneQuery;
    static geoDistance(lon: number, lat: number, distance: string): GeoDistanceQuery;
    static geoBoundingBox(tl_lon: number, tl_lat: number, br_lon: number, br_lat: number): GeoBoundingBoxQuery;
}

declare namespace SearchSort {
    class ScoreSort {
        descending(descending: boolean): ScoreSort;
    }
    class IdSort {
        descending(descending: boolean): IdSort;
    }
    class FieldSort {
        type(type: string): FieldSort;
        mode(mode: string): FieldSort;
        missing(missing: boolean): FieldSort;
        descending(descending: boolean): FieldSort;
    }
    class GeoDistanceSort {
        unit(unit: string): GeoDistanceSort;
        descending(descending: boolean): GeoDistanceSort;
    }
}

declare class SearchSort {
    static score(): ScoreSort;
    static id(): IdSort;
    static field(): FieldSort;
    static geoDistance(): GeoDistanceSort;
}

declare class Origin {
}

declare class Role {
}

declare class RoleAndDescription {
}

declare class RoleAndOrigin {
}

declare class User {
}

declare class UserAndMetadata {
}

declare class Group {
}

/**
 * <p>UserManager is an interface which enables the management of users
 * within a cluster.</p>
 */
declare class UserManager {
    getUser(username: string, options?: {
        domainName?: string;
        timeout?: integer;
    }, callback?: GetUserCallback): Promise<User>;
    getAllUsers(options?: {
        domainName?: string;
        timeout?: integer;
    }, callback?: GetAllUsersCallback): Promise<User[]>;
    upsertUser(user: User, options?: {
        domainName?: string;
        timeout?: integer;
    }, callback?: UpsertUserCallback): Promise<boolean>;
    dropUser(username: string, options?: {
        domainName?: string;
        timeout?: integer;
    }, callback?: DropUserCallback): Promise<boolean>;
    getRoles(options?: {
        timeout?: integer;
    }, callback?: GetRolesCallback): Promise<RoleAndDescription[]>;
    getGroup(groupName: string, options?: {
        timeout?: integer;
    }, callback?: GetGroupCallback): Promise<Group>;
    getAllGroups(options?: {
        timeout?: integer;
    }, callback?: GetAllGroupsCallback): Promise<Group[]>;
    upsertGroup(group: Group, options?: {
        timeout?: integer;
    }, callback?: UpsertGroupCallback): Promise<boolean>;
    dropGroup(username: string, options?: {
        timeout?: integer;
    }, callback?: DropGroupCallback): Promise<boolean>;
}

declare type GetUserCallback = () => void;

declare type GetAllUsersCallback = () => void;

declare type UpsertUserCallback = () => void;

declare type DropUserCallback = () => void;

declare type GetRolesCallback = () => void;

declare type GetGroupCallback = () => void;

declare type GetAllGroupsCallback = () => void;

declare type UpsertGroupCallback = () => void;

declare type DropGroupCallback = () => void;

/**
 * <p>ViewIndexManager is an interface which enables the management
 * of view indexes on the cluster.</p>
 */
declare class ViewIndexManager {
    getAllDesignDocuments(options?: {
        timeout?: integer;
    }, callback?: GetAllDesignDocumentsCallback): Promise<DesignDocument[]>;
    getDesignDocument(designDocName: string, options?: {
        timeout?: integer;
    }, callback?: GetDesignDocumentCallback): Promise<DesignDocument>;
    upsertDesignDocument(designDoc: DesignDocument, options?: {
        timeout?: integer;
    }, callback?: UpsertDesignDocumentCallback): Promise<DesignDocument>;
    dropDesignDocument(designDocName: string, options?: {
        timeout?: integer;
    }, callback?: DropDesignDocumentCallback): Promise<DesignDocument>;
    publishDesignDocument(designDocName: string, options?: {
        timeout?: number;
    }, callback?: PublishDesignDocumentCallback): Promise<boolean>;
}

declare type GetAllDesignDocumentsCallback = () => void;

declare type GetDesignDocumentCallback = () => void;

declare type UpsertDesignDocumentCallback = () => void;

declare type DropDesignDocumentCallback = () => void;

declare type PublishDesignDocumentCallback = () => void;

