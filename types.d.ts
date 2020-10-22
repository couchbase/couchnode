/**
 * <p>AnalyticsIndexManager provides an interface for performing management
 * operations against the analytics indexes for the cluster.</p>
 */
declare class AnalyticsIndexManager {
    createDataverse(dataverseName: string, options?: {
        ignoreIfExists?: boolean;
        timeout?: number;
    }, callback?: CreateDataverseCallback): Promise<boolean>;
    dropDataverse(dataverseName: string, options?: {
        ignoreIfNotExists?: boolean;
        timeout?: number;
    }, callback?: DropDataverseCallback): Promise<boolean>;
    createDataset(datasetName: string, options?: {
        ignoreIfExists?: boolean;
        dataverseName?: string;
        condition?: string;
        timeout?: number;
    }, callback?: CreateDatasetCallback): Promise<boolean>;
    dropDataset(datasetName: string, options?: {
        ignoreIfNotExists?: boolean;
        dataverseName?: string;
        timeout?: number;
    }, callback?: DropDatasetCallback): Promise<boolean>;
    getAllDatasets(options?: {
        timeout?: number;
    }, callback?: GetAllDatasetsCallback): Promise<AnalyticsDataset[]>;
    createIndex(datasetName: string, indexName: string, fields: string[], options?: {
        dataverseName?: string;
        ignoreIfExists?: boolean;
        timeout?: number;
    }, callback?: CreateAnalyticsIndexCallback): Promise<boolean>;
    dropIndex(datasetName: string, indexName: string, options?: {
        dataverseName?: string;
        ignoreIfNotExists?: boolean;
        timeout?: number;
    }, callback?: DropAnalyticsIndexCallback): Promise<boolean>;
    getAllIndexes(options?: {
        timeout?: number;
    }, callback?: GetAllAnalyticsIndexesCallback): Promise<AnalyticsIndex[]>;
    connectLink(linkName: string, options?: {
        timeout?: number;
    }, callback?: ConnectLinkCallback): Promise<boolean>;
    disconnectLink(linkName: string, options?: {
        timeout?: number;
    }, callback?: DisconnectLinkCallback): Promise<boolean>;
    getPendingMutations(options?: {
        timeout?: number;
    }, callback?: GetPendingMutationsCallback): Promise<{
        [key: string]: number;
    }>;
}

declare type CreateDataverseCallback = (err: Error, success: boolean) => void;

declare type DropDataverseCallback = (err: Error, success: boolean) => void;

declare type CreateDatasetCallback = (err: Error, success: boolean) => void;

declare type DropDatasetCallback = (err: Error, success: boolean) => void;

declare type AnalyticsDataset = {
    name: string;
    dataverseName: string;
    linkName: string;
    bucketName: string;
};

declare type GetAllDatasetsCallback = (err: Error, datasets: AnalyticsDataset[]) => void;

declare type CreateAnalyticsIndexCallback = (err: Error, success: boolean) => void;

declare type DropAnalyticsIndexCallback = (err: Error, success: boolean) => void;

declare type AnalyticsIndex = {
    name: string;
    datasetName: string;
    dataverseName: string;
    isPrimary: boolean;
};

declare type GetAllAnalyticsIndexesCallback = (err: Error, indexes: AnalyticsIndex[]) => void;

declare type ConnectLinkCallback = (err: Error, success: boolean) => void;

declare type DisconnectLinkCallback = (err: Error, success: boolean) => void;

declare type GetPendingMutationsCallback = (err: Error, pendingMutations: {
    [key: string]: number;
}) => void;

/**
 * <p>BinaryCollection provides various binary operations which
 * are available to be performed against a collection.</p>
 */
declare class BinaryCollection {
    increment(key: string, value: number, options?: {
        timeout?: number;
    }, callback?: IncrementCallback): Promise<IncrementResult>;
    decrement(key: string, value: number, options?: {
        timeout?: number;
    }, callback?: DecrementCallback): Promise<DecrementResult>;
    append(key: string, value: Buffer, options?: {
        timeout?: number;
    }, callback?: AppendCallback): Promise<AppendResult>;
    prepend(key: string, value: Buffer, options?: {
        timeout?: number;
    }, callback?: PrependCallback): Promise<PrependResult>;
}

declare type IncrementResult = {
    value: number;
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type IncrementCallback = (err: Error, res: IncrementResult) => void;

declare type DecrementResult = {
    value: number;
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type DecrementCallback = (err: Error, res: DecrementResult) => void;

declare type AppendResult = {
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type AppendCallback = (err: Error, res: AppendResult) => void;

declare type PrependResult = {
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type PrependCallback = (err: Error, res: PrependResult) => void;

declare type Cas = any;

declare type MutationToken = any;

/**
 * <p>Bucket represents a storage grouping of data within a Couchbase Server cluster.</p>
 */
declare class Bucket {
    /**
     * @param designDoc - <p>The design document containing the view to query</p>
     * @param viewName - <p>The name of the view to query</p>
     */
    viewQuery(designDoc: string, viewName: string, options?: {
        scanConsistency?: ViewScanConsistency;
        skip?: number;
        limit?: number;
        order?: ViewOrdering;
        reduce?: string;
        group?: boolean;
        groupLevel?: number;
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
        timeout?: number;
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
    name: string;
}

declare type ViewQueryResult = {
    rows: object[];
    meta: any;
};

declare type ViewQueryCallback = (err: Error, res: ViewQueryResult) => void;

/**
 * <p>BucketManager provides an interface for adding/removing/updating
 * buckets within the cluster.</p>
 */
declare class BucketManager {
    createBucket(settings: CreateBucketSettings, options?: {
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

declare type CreateBucketCallback = (err: Error, res: boolean) => void;

declare type UpdateBucketCallback = (err: Error, res: boolean) => void;

declare type DropBucketCallback = (err: Error, res: boolean) => void;

declare type GetBucketCallback = (err: Error, res: BucketSettings) => void;

declare type GetAllBucketsCallback = (err: Error, res: BucketSettings[]) => void;

declare type FlushBucketCallback = (err: Error, res: boolean) => void;

/**
 * <p>CertificateAuthenticator provides an authenticator implementation
 * which uses TLS Certificate Authentication.</p>
 */
declare class CertificateAuthenticator {
    constructor(certificatePath: string, keyPath: string);
}

/**
 * <p>Cluster represents an entire Couchbase Server cluster.</p>
 */
declare class Cluster {
    /**
     * <p>Connect establishes a connection to the cluster and is the entry
     * point for all SDK operations.</p>
     */
    static connect(connStr: string, options?: {
        username?: string;
        password?: string;
        authenticator?: string;
        trustStorePath?: string;
        kvTimeout?: number;
        kvDurableTimeout?: number;
        viewTimeout?: number;
        queryTimeout?: number;
        analyticsTimeout?: number;
        searchTimeout?: number;
        managementTimeout?: number;
        transcoder?: Transcoder;
        logFunc?: LoggingCallback;
    }, callback?: ConnectCallback): Promise<Cluster>;
    /**
     * <p>Diagnostics returns stateful data about the current SDK connections.</p>
     */
    diagnostics(options?: {
        reportId?: string;
    }, callback?: DiagnosticsCallback): Promise<DiagnosticsResult>;
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
     * @param [options.flexIndex] - <p>flexIndex specifies to enable the use of FTS indexes when selecting
     * indexes to use for the query.</p>
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
        flexIndex?: boolean;
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
        timeout?: number;
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
        timeout?: number;
    }, callback?: AnalyticsQueryCallback): Promise<AnalyticsResult>;
    /**
     * @param indexName - <p>The name of the index to execute the query against.</p>
     * @param query - <p>The search query object describing the requested search.</p>
     */
    searchQuery(indexName: string, query: SearchQuery, options?: {
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
        consistency?: SearchScanConsistency;
        consistentWith?: MutationState;
        timeout?: number;
    }, callback?: SearchQueryCallback): Promise<SearchQueryResult>;
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

declare type DiagnosticsCallback = (err: Error, res: DiagnosticsResult) => void;

declare type QueryResult = {
    rows: object[];
    meta: any;
};

declare type QueryCallback = (err: Error, res: QueryResult) => void;

declare type AnalyticsResult = {
    rows: object[];
    meta: any;
};

declare type AnalyticsQueryCallback = (err: Error, res: AnalyticsResult) => void;

declare type SearchQueryResult = {
    rows: object[];
    meta: any;
};

declare type SearchQueryCallback = (err: Error, res: SearchQueryResult) => void;

/**
 * <p>Collection provides an interface for performing operations against
 * a collection within the cluster.</p>
 */
declare class Collection {
    get(key: string, options?: {
        project?: string[];
        withExpiry?: boolean;
        transcoder?: Transcoder;
        timeout?: number;
    }, callback?: GetCallback): Promise<GetResult>;
    exists(key: string, options?: {
        timeout?: number;
    }, callback?: ExistsCallback): Promise<ExistsResult>;
    getAnyReplica(key: string, options?: {
        transcoder?: Transcoder;
        timeout?: number;
    }, callback?: GetAnyReplicaCallback): Promise<GetReplicaResult>;
    getAllReplicas(key: string, options?: {
        transcoder?: Transcoder;
        timeout?: number;
    }, callback?: GetAllReplicasCallback): Promise<GetReplicaResult[]>;
    insert(key: string, value: any, options?: {
        transcoder?: Transcoder;
        timeout?: number;
    }, callback?: MutateCallback): Promise<MutationResult>;
    upsert(key: string, value: any, options?: {
        transcoder?: Transcoder;
        timeout?: number;
    }, callback?: MutateCallback): Promise<MutationResult>;
    replace(key: string, value: any, options?: {
        transcoder?: Transcoder;
        timeout?: number;
        cas?: Cas;
    }, callback?: MutateCallback): Promise<MutationResult>;
    remove(key: string, options?: {
        timeout?: number;
    }, callback?: RemoveCallback): Promise<RemoveResult>;
    getAndTouch(key: string, expiry: number, options?: {
        transcoder?: Transcoder;
        timeout?: number;
    }, callback?: GetAndTouchCallback): Promise<GetAndTouchResult>;
    touch(key: string, expiry: number, options?: {
        timeout?: number;
    }, callback?: TouchCallback): Promise<TouchResult>;
    getAndLock(key: string, lockTime: number, options?: {
        transcoder?: Transcoder;
        timeout?: number;
    }, callback?: GetAndLockCallback): Promise<GetAndLockCallback>;
    unlock(key: string, cas: Cas, options?: {
        timeout?: number;
    }, callback?: UnlockCallback): Promise<UnlockResult>;
    lookupIn(key: string, spec: LookupInSpec[], options?: {
        timeout?: number;
    }, callback?: LookupInCallback): Promise<LookupInResult>;
    mutateIn(key: string, spec: MutateInSpec, options?: {
        cas?: Cas;
        timeout?: number;
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
    content: any;
    cas: Cas;
    expiry?: number;
};

declare type GetCallback = (err: Error, res: GetResult) => void;

/**
 * <p>Contains the results from a previously execute Get operation.</p>
 */
declare type ExistsResult = {
    exists: boolean;
    cas: Cas;
};

declare type ExistsCallback = (err: Error, res: ExistsResult) => void;

/**
 * <p>Contains the results from a previously executed replica get operation.</p>
 */
declare type GetReplicaResult = {
    value: any;
    cas: Cas;
    isReplica: boolean;
};

declare type GetAnyReplicaCallback = (err: Error, res: GetReplicaResult) => void;

declare type GetAllReplicasCallback = (err: Error, res: GetReplicaResult[]) => void;

/**
 * <p>Contains the results from a previously executed mutation operation.</p>
 */
declare type MutationResult = {
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type MutateCallback = (err: Error, res: MutationResult) => void;

declare type RemoveResult = {
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type RemoveCallback = (err: Error, res: RemoveResult) => void;

declare type GetAndTouchResult = {
    content: any;
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type GetAndTouchCallback = (err: Error, res: GetAndTouchResult) => void;

declare type TouchResult = {
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type TouchCallback = (err: Error, res: TouchResult) => void;

declare type GetAndLockResult = {
    content: any;
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type GetAndLockCallback = (err: Error, res: GetAndLockResult[]) => void;

declare type UnlockResult = {
    content: any;
    cas: Cas;
    mutationToken?: MutationToken;
};

declare type UnlockCallback = (err: Error, res: UnlockResult) => void;

declare type LookupInResult = {
    content: any;
    cas: Cas;
};

declare type LookupInCallback = (err: Error, res: LookupInResult) => void;

declare type MutateInResult = {
    content: any;
};

declare type MutateInCallback = (err: Error, res: MutateInResult) => void;

/**
 * <p>CollectionManager allows the management of collections within a Bucket.</p>
 */
declare class CollectionManager {
    /**
     * <p>createCollection creates a collection within a scope in a bucket.</p>
     * @param collectionSpec - <p>The details of the collection to create.</p>
     * @param [options.timeout] - <p>Timeout for the operation in milliseconds.</p>
     */
    createCollection(collectionSpec: CollectionSpec, options?: {
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

/**
 * @property name - <p>The name of the collection to create.</p>
 * @property scopeName - <p>The name of the scope to create the collection in.</p>
 * @property maxExpiry - <p>The maximum expiry for documents in this bucket.</p>
 */
declare type CollectionSpec = {
    name: string;
    scopeName: string;
    maxExpiry: number;
};

declare type CreateCollectionCallback = (err: Error, res: boolean) => void;

declare type DropCollectionCallback = (err: Error, res: boolean) => void;

declare type CreateScopeCallback = (err: Error, res: boolean) => void;

declare type DropScopeCallback = (err: Error, res: boolean) => void;

declare type LoggingEntry = {
    severity: number;
    srcFile: string;
    srcLine: number;
    subsys: string;
    message: string;
};

declare type LoggingCallback = (entry: LoggingEntry) => void;

declare type ConnectCallback = (err: Error, cluster: Cluster) => void;

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
declare function connect(connStr: string, options?: {
    username?: number;
    password?: string;
    clientCertificate?: string;
    certificateChain?: string;
}, callback?: ConnectCallback): Promise<Cluster>;

/**
 * <p>Expose the LCB version that is in use.</p>
 */
declare var lcbVersion: string;

/**
 * <p>CouchbaseList provides a simplified interface
 * for storing lists within a Couchbase document.</p>
 */
declare class CouchbaseList {
    getAll(callback: (...params: any[]) => any): void;
    getAt(index: any, callback: (...params: any[]) => any): void;
    removeAt(index: any, callback: (...params: any[]) => any): void;
    indexOf(value: any, callback: (...params: any[]) => any): void;
    size(callback: (...params: any[]) => any): void;
    push(value: any, callback: (...params: any[]) => any): void;
    unshift(value: any, callback: (...params: any[]) => any): void;
}

/**
 * <p>CouchbaseMap provides a simplified interface
 * for storing a map within a Couchbase document.</p>
 */
declare class CouchbaseMap {
    getAll(callback: (...params: any[]) => any): void;
    forEach(rowCallback: (...params: any[]) => any, callback: (...params: any[]) => any): void;
    set(item: any, value: any, callback: (...params: any[]) => any): void;
    get(item: any, callback: (...params: any[]) => any): void;
    remove(item: any, callback: (...params: any[]) => any): void;
    exists(item: any, callback: (...params: any[]) => any): void;
    keys(callback: (...params: any[]) => any): void;
    values(callback: (...params: any[]) => any): void;
    size(callback: (...params: any[]) => any): void;
}

/**
 * <p>CouchbaseQueue provides a simplified interface
 * for storing a queue within a Couchbase document.</p>
 */
declare class CouchbaseQueue {
    size(callback: (...params: any[]) => any): void;
    push(value: any, callback: (...params: any[]) => any): void;
    pop(callback: (...params: any[]) => any): void;
}

/**
 * <p>CouchbaseSet provides a simplified interface
 * for storing a set within a Couchbase document.</p>
 */
declare class CouchbaseSet {
    add(item: any, callback: (...params: any[]) => any): void;
    contains(item: any, callback: (...params: any[]) => any): void;
    remove(item: any, callback: (...params: any[]) => any): void;
    values(callback: (...params: any[]) => any): void;
    size(callback: (...params: any[]) => any): void;
}

/**
 * <p>Transcoder provides an interface for performing custom transcoding
 * of document contents being retrieved and stored to the cluster.</p>
 */
declare interface Transcoder {
    /**
     * <p>Encodes a value.  Must return an array of two values, containing
     * a {@link Buffer} and {@link number}.</p>
     */
    encode(value: any): any[];
    decode(bytes: Buffer, flags: number): any;
}

declare class DesignDocumentView {
    map: string;
    reduce: string;
}

declare class DesignDocument {
    constructor(name: string, views: {
        [key: string]: DesignDocumentView;
    });
    /**
     * <p>Returns the View class ({@link DesignDocumentView}).</p>
     */
    static View: (...params: any[]) => any;
    name: string;
    views: {
        [key: string]: DesignDocumentView;
    };
}

declare const enum DurabilityLevel {
    None = 0,
    Majority = 1,
    MajorityAndPersistOnMaster = 2,
    PersistToMajority = 3
}

declare const enum BucketType {
    Couchbase = "membase",
    Memcached = "memcached",
    Ephemeral = "ephemeral"
}

declare const enum EvictionPolicy {
    FullEviction = "fullEviction",
    ValueOnly = "valueOnly",
    NotRecentlyUsed = "nruEviction",
    NoEviction = "noEviction"
}

declare const enum CompressionMode {
    Off = "off",
    Passive = "passive",
    Active = "active"
}

declare const enum ConflictResolutionType {
    Timestamp = "lww",
    SequenceNumber = "seqno"
}

declare const enum QueryProfileMode {
    Off = "off",
    Phases = "phases",
    Timings = "timings"
}

declare const enum QueryScanConsistency {
    NotBounded = "not_bounded",
    RequestPlus = "request_plus"
}

declare const enum QueryStatus {
    Running = "running",
    Success = "success",
    Errors = "errors",
    Completed = "completed",
    Stopped = "stopped",
    Timeout = "timeout",
    Closed = "closed",
    Fatal = "fatal",
    Aborted = "aborted",
    Unknown = "unknown"
}

declare const enum AnalyticsScanConsistency {
    NotBounded = "not_bounded",
    RequestPlus = "request_plus"
}

declare const enum AnalyticsStatus {
    Running = "running",
    Success = "success",
    Errors = "errors",
    Completed = "completed",
    Stopped = "stopped",
    Timeout = "timeout",
    Closed = "closed",
    Fatal = "fatal",
    Aborted = "aborted",
    Unknown = "unknown"
}

declare const enum IndexType {
    Gsi = "gsi",
    View = "view",
    Unknown = ""
}

declare const enum HighlightStyle {
    HTML = "html",
    ANSI = "ansi"
}

declare const enum ViewScanConsistency {
    RequestPlus = "false",
    UpdateAfter = "update_after",
    NotBounded = "ok"
}

declare const enum ViewOrdering {
    Ascending = "false",
    Descending = "true"
}

declare const enum ViewErrorMode {
    Continue = "continue",
    Stop = "stop"
}

declare const enum SearchScanConsistency {
    NotBounded = ""
}

declare const enum LookupInMacro {
    Document = "{}",
    Expiry = "{}",
    Cas = "{}",
    SeqNo = "{}",
    LastModified = "{}",
    IsDeleted = "{}",
    ValueSizeBytes = "{}",
    RevId = "{}"
}

declare const enum MutateInMacro {
    Cas = "{}",
    SeqNo = "{}",
    ValueCrc32c = "{}"
}

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
    static increment(path: string, value: number, options?: {
        createPath?: boolean;
    }): MutateInSpec;
    static decrement(path: string, value: number, options?: {
        createPath?: boolean;
    }): MutateInSpec;
}

/**
 * <p>Implements mutation token aggregation for performing consistentWith
 * on queries.  Accepts any number of arguments (one per document/tokens).</p>
 */
declare class MutationState {
    constructor();
    /**
     * <p>Adds an additional token to this MutationState
     * Accepts any number of arguments (one per document/tokens).</p>
     */
    add(): void;
}

/**
 * <p>PasswordAuthenticator provides an authenticator implementation
 * which uses a Role Based Access Control Username and Password.</p>
 */
declare class PasswordAuthenticator {
    constructor(username: string, password: string);
}

/**
 * <p>QueryIndexManager provides an interface for managing the
 * query indexes on the cluster.</p>
 */
declare class QueryIndexManager {
    createIndex(bucketName: string, indexName: string, fields: string[], options?: {
        ignoreIfExists?: boolean;
        deferred?: boolean;
        timeout?: number;
    }, callback?: CreateQueryIndexCallback): Promise<boolean>;
    createPrimaryIndex(bucketName: string, options?: {
        ignoreIfExists?: boolean;
        deferred?: boolean;
        timeout?: number;
    }, callback?: CreatePrimaryIndexCallback): Promise<boolean>;
    dropIndex(bucketName: string, indexName: string, options?: {
        ignoreIfNotExists?: boolean;
        timeout?: number;
    }, callback?: DropQueryIndexCallback): Promise<boolean>;
    dropPrimaryIndex(bucketName: string, options?: {
        ignoreIfNotExists?: boolean;
        timeout?: number;
    }, callback?: DropPrimaryIndexCallback): Promise<boolean>;
    getAllIndexes(bucketName: string, options?: {
        timeout?: number;
    }, callback?: GetAllQueryIndexesCallback): Promise<QueryIndex[]>;
    buildDeferredIndexes(bucketName: string, options?: {
        timeout?: number;
    }, callback?: BuildDeferredIndexesCallback): Promise<string[]>;
    watchIndexes(bucketName: string, indexNames: string[], duration: number, options?: {
        watchPrimary?: number;
    }, callback?: WatchIndexesCallback): Promise<boolean>;
}

declare type CreateQueryIndexCallback = (err: Error, res: boolean) => void;

declare type CreatePrimaryIndexCallback = (err: Error, res: boolean) => void;

declare type DropQueryIndexCallback = (err: Error, res: boolean) => void;

declare type DropPrimaryIndexCallback = (err: Error, res: boolean) => void;

declare type QueryIndex = {
    name: string;
    isPrimary: boolean;
    type: string;
    state: string;
    keyspace: string;
    indexKey: string;
};

declare type GetAllQueryIndexesCallback = (err: Error, res: QueryIndex[]) => void;

declare type BuildDeferredIndexesCallback = (err: Error, res: string[]) => void;

declare type WatchIndexesCallback = (err: Error, res: boolean) => void;

declare class Scope {
    /**
     * <p>Gets a reference to a specific collection.</p>
     */
    collection(collectionName: string): Collection;
}

declare class TermFacet {
}

declare class NumericFacet {
    addRange(name: string, min: number, max: number): void;
}

declare class DateFacet {
    addRange(name: string, start: Date, end: Date): void;
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
        timeout?: number;
    }, callback?: GetSearchIndexCallback): Promise<SearchIndex>;
    getAllIndexes(options?: {
        timeout?: number;
    }, callback?: GetAllSearchIndexesCallback): Promise<SearchIndex[]>;
    upsertIndex(indexDefinition: SearchIndex, options?: {
        timeout?: number;
    }, callback?: UpsertSearchIndexCallback): Promise<boolean>;
    dropIndex(indexName: string, options?: {
        timeout?: number;
    }, callback?: DropSearchIndexCallback): Promise<boolean>;
    getIndexedDocumentsCount(indexName: string, options?: {
        timeout?: number;
    }, callback?: GetIndexedDocumentsCountCallback): Promise<number>;
    pauseIngest(indexName: string, options?: {
        timeout?: number;
    }, callback?: PauseIngestCallback): Promise<boolean>;
    resumeIngest(indexName: string, options?: {
        timeout?: number;
    }, callback?: ResumeIngestCallback): Promise<boolean>;
    allowQuerying(indexName: string, options?: {
        timeout?: number;
    }, callback?: AllowQueryingCallback): Promise<boolean>;
    disallowQuerying(indexName: string, options?: {
        timeout?: number;
    }, callback?: DisallowQueryingCallback): Promise<boolean>;
    freezePlan(indexName: string, options?: {
        timeout?: number;
    }, callback?: FreezePlanCallback): Promise<boolean>;
    analyzeDocument(indexName: string, document: any, options?: {
        timeout?: number;
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

declare type GetSearchIndexCallback = (err: Error, res: SearchIndex) => void;

declare type GetAllSearchIndexesCallback = (err: Error, res: SearchIndex[]) => void;

declare type UpsertSearchIndexCallback = (err: Error, res: boolean) => void;

declare type DropSearchIndexCallback = (err: Error, res: boolean) => void;

declare type GetIndexedDocumentsCountCallback = (err: Error, res: number) => void;

declare type PauseIngestCallback = (err: Error, res: boolean) => void;

declare type ResumeIngestCallback = (err: Error, res: boolean) => void;

declare type AllowQueryingCallback = (err: Error, res: boolean) => void;

declare type DisallowQueryingCallback = (err: Error, res: boolean) => void;

declare type FreezePlanCallback = (err: Error, res: boolean) => void;

declare type AnalyzeDocumentCallback = (err: Error, res: object[]) => void;

declare class MatchQuery {
    field(field: string): MatchQuery;
    analyzer(analyzer: string): MatchQuery;
    prefixLength(prefixLength: number): MatchQuery;
    fuzziness(fuzziness: number): MatchQuery;
    boost(boost: number): MatchQuery;
}

declare class MatchPhraseQuery {
    field(field: string): MatchPhraseQuery;
    analyzer(analyzer: string): MatchPhraseQuery;
    boost(boost: number): MatchPhraseQuery;
}

declare class RegexpQuery {
    field(field: string): RegexpQuery;
    boost(boost: number): RegexpQuery;
}

declare class QueryStringQuery {
    boost(boost: number): QueryStringQuery;
}

declare class NumericRangeQuery {
    min(min: number, inclusive: boolean): NumericRangeQuery;
    max(max: number, inclusive: boolean): NumericRangeQuery;
    field(field: string): NumericRangeQuery;
    boost(boost: number): NumericRangeQuery;
}

declare class DateRangeQuery {
    start(start: Date, inclusive: boolean): DateRangeQuery;
    end(end: Date, inclusive: boolean): DateRangeQuery;
    field(field: string): DateRangeQuery;
    dateTimeParser(parser: string): DateRangeQuery;
    boost(field: string): DateRangeQuery;
}

declare class ConjunctionQuery {
    and(): ConjunctionQuery;
    boost(boost: number): ConjunctionQuery;
}

declare class DisjunctionQuery {
    or(): DisjunctionQuery;
    boost(boost: number): DisjunctionQuery;
}

declare class BooleanQuery {
    must(query: SearchQuery): BooleanQuery;
    should(query: SearchQuery): BooleanQuery;
    mustNot(query: SearchQuery): BooleanQuery;
    shouldMin(shouldMin: boolean): BooleanQuery;
    boost(boost: number): BooleanQuery;
}

declare class WildcardQuery {
    field(field: string): WildcardQuery;
    boost(boost: number): WildcardQuery;
}

declare class DocIdQuery {
    addDocIds(): DocIdQuery;
    field(field: string): DocIdQuery;
    boost(boost: number): DocIdQuery;
}

declare class BooleanFieldQuery {
    field(field: string): BooleanFieldQuery;
    boost(boost: number): BooleanFieldQuery;
}

declare class TermQuery {
    field(field: string): TermQuery;
    prefixLength(prefixLength: number): TermQuery;
    fuzziness(fuzziness: number): TermQuery;
    boost(boost: number): TermQuery;
}

declare class PhraseQuery {
    field(field: string): PhraseQuery;
    boost(boost: number): PhraseQuery;
}

declare class PrefixQuery {
    field(field: string): PrefixQuery;
    boost(boost: number): PrefixQuery;
}

declare class MatchAllQuery {
}

declare class MatchNoneQuery {
}

declare class GeoDistanceQuery {
    field(field: string): GeoDistanceQuery;
    boost(boost: number): GeoDistanceQuery;
}

declare class GeoBoundingBoxQuery {
    field(field: string): GeoBoundingBoxQuery;
    boost(boost: number): GeoBoundingBoxQuery;
}

declare class GeoPolygonQuery {
    field(field: string): GeoPolygonQuery;
    boost(boost: number): GeoPolygonQuery;
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
    static geoPolygon(points: any[]): GeoPolygonQuery;
}

declare class ScoreSort {
    descending(descending: boolean): ScoreSort;
}

declare class IdSort {
    descending(descending: boolean): IdSort;
}

declare class FieldSort {
    type(type: string): FieldSort;
    mode(mode: string): FieldSort;
    missing(missing: boolean): FieldSort;
    descending(descending: boolean): FieldSort;
}

declare class GeoDistanceSort {
    unit(unit: string): GeoDistanceSort;
    descending(descending: boolean): GeoDistanceSort;
}

declare class SearchSort {
    static score(): ScoreSort;
    static id(): IdSort;
    static field(): FieldSort;
    static geoDistance(): GeoDistanceSort;
}

declare class Origin {
    /**
     * <p>The type of this origin.</p>
     */
    type: string;
    /**
     * <p>The name of this origin.</p>
     */
    name: string;
}

declare class Role {
    /**
     * <p>The name of the role (eg. data_access).</p>
     */
    name: string;
    /**
     * <p>The bucket this role is scoped to.</p>
     */
    bucket: string;
    /**
     * <p>The scope this role is scoped to.</p>
     */
    scope: string;
    /**
     * <p>The collection this role is scoped to.</p>
     */
    collection: string;
}

declare class RoleAndDescription {
    /**
     * <p>The displayed name for this role.</p>
     */
    displayName: string;
    /**
     * <p>The description of this role.</p>
     */
    description: string;
}

declare class RoleAndOrigin {
    /**
     * <p>The list of the origins associated with this role.</p>
     */
    origins: Origin[];
}

declare class User {
    /**
     * <p>The username of the user.</p>
     */
    username: string;
    /**
     * <p>The display-friendly name of the user.</p>
     */
    displayName: string;
    /**
     * <p>The groups this user is a part of.</p>
     */
    groups: Group[];
    /**
     * <p>The roles this user has.</p>
     */
    roles: Role[];
    /**
     * <p>The password for this user.  Used only during creates/updates.</p>
     */
    password: string;
}

declare class UserAndMetadata {
    /**
     * <p>The domain this user is within.</p>
     */
    domain: string;
    /**
     * <p>The effective roles of this user.</p>
     */
    effectiveRoles: Role[];
    /**
     * <p>The effective roles with their origins for this user.</p>
     */
    effectiveRolesAndOrigins: RoleAndOrigin[];
    /**
     * <p>Indicates the last time the users password was changed.</p>
     */
    passwordChanged: number;
    /**
     * <p>Groups assigned to this user from outside the system.</p>
     */
    externalGroups: string[];
}

declare class Group {
    /**
     * <p>The name of the group.</p>
     */
    name: string;
    /**
     * <p>The description of this group.</p>
     */
    description: string;
    /**
     * <p>The roles associated with this group.</p>
     */
    roles: Role[];
    /**
     * <p>The reference this group has to an external LDAP group.</p>
     */
    ldapGroupReference: string;
}

/**
 * <p>UserManager is an interface which enables the management of users
 * within a cluster.</p>
 */
declare class UserManager {
    getUser(username: string, options?: {
        domainName?: string;
        timeout?: number;
    }, callback?: GetUserCallback): Promise<User>;
    getAllUsers(options?: {
        domainName?: string;
        timeout?: number;
    }, callback?: GetAllUsersCallback): Promise<User[]>;
    upsertUser(user: User, options?: {
        domainName?: string;
        timeout?: number;
    }, callback?: UpsertUserCallback): Promise<boolean>;
    dropUser(username: string, options?: {
        domainName?: string;
        timeout?: number;
    }, callback?: DropUserCallback): Promise<boolean>;
    getRoles(options?: {
        timeout?: number;
    }, callback?: GetRolesCallback): Promise<RoleAndDescription[]>;
    getGroup(groupName: string, options?: {
        timeout?: number;
    }, callback?: GetGroupCallback): Promise<Group>;
    getAllGroups(options?: {
        timeout?: number;
    }, callback?: GetAllGroupsCallback): Promise<Group[]>;
    upsertGroup(group: Group, options?: {
        timeout?: number;
    }, callback?: UpsertGroupCallback): Promise<boolean>;
    dropGroup(username: string, options?: {
        timeout?: number;
    }, callback?: DropGroupCallback): Promise<boolean>;
}

declare type GetUserCallback = (err: Error, res: User) => void;

declare type GetAllUsersCallback = (err: Error, res: User[]) => void;

declare type UpsertUserCallback = (err: Error, res: boolean) => void;

declare type DropUserCallback = (err: Error, res: boolean) => void;

declare type GetRolesCallback = (err: Error, res: RoleAndDescription[]) => void;

declare type GetGroupCallback = (err: Error, res: Group) => void;

declare type GetAllGroupsCallback = (err: Error, res: Group[]) => void;

declare type UpsertGroupCallback = (err: Error, res: boolean) => void;

declare type DropGroupCallback = (err: Error, res: boolean) => void;

/**
 * <p>ViewIndexManager is an interface which enables the management
 * of view indexes on the cluster.</p>
 */
declare class ViewIndexManager {
    getAllDesignDocuments(options?: {
        timeout?: number;
    }, callback?: GetAllDesignDocumentsCallback): Promise<DesignDocument[]>;
    getDesignDocument(designDocName: string, options?: {
        timeout?: number;
    }, callback?: GetDesignDocumentCallback): Promise<DesignDocument>;
    upsertDesignDocument(designDoc: DesignDocument, options?: {
        timeout?: number;
    }, callback?: UpsertDesignDocumentCallback): Promise<DesignDocument>;
    dropDesignDocument(designDocName: string, options?: {
        timeout?: number;
    }, callback?: DropDesignDocumentCallback): Promise<DesignDocument>;
    publishDesignDocument(designDocName: string, options?: {
        timeout?: number;
    }, callback?: PublishDesignDocumentCallback): Promise<boolean>;
}

declare type GetAllDesignDocumentsCallback = (err: Error, res: DesignDocument[]) => void;

declare type GetDesignDocumentCallback = (err: Error, res: DesignDocument) => void;

declare type UpsertDesignDocumentCallback = (err: Error, res: boolean) => void;

declare type DropDesignDocumentCallback = (err: Error, res: boolean) => void;

declare type PublishDesignDocumentCallback = (err: Error, res: boolean) => void;

