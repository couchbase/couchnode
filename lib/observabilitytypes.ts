import { HiResTime } from './binding'
import { Meter } from './metrics'
import { RequestTracer } from './tracing'

/**
 * Represents the possible types of values that can be used as span attributes.
 *
 * Supports primitive types (string, number, boolean) and arrays of these types (allowing null/undefined elements).
 */
export type AttributeValue =
  | string
  | number
  | boolean
  | Array<null | undefined | string>
  | Array<null | undefined | number>
  | Array<null | undefined | boolean>

/**
 * Represents the possible input types for timestamps in the observability system.
 *
 * - `HiResTime`: High-resolution time.
 * - `number`: Unix timestamp in milliseconds.
 * - `Date`: JavaScript Date object.
 */
export type TimeInput = HiResTime | number | Date

/**
 * @internal
 */
export type OpType =
  | KeyValueOp
  | DatastructureOp
  | StreamingOp
  | AnalyticsMgmtOp
  | BucketMgmtOp
  | CollectionMgmtOp
  | EventingFunctionMgmtOp
  | QueryIndexMgmtOp
  | SearchIndexMgmtOp
  | UserMgmtOp
  | ViewIndexMgmtOp

/**
 * @internal
 */
export type HttpOpType =
  | StreamingOp
  | AnalyticsMgmtOp
  | BucketMgmtOp
  | CollectionMgmtOp
  | EventingFunctionMgmtOp
  | QueryIndexMgmtOp
  | SearchIndexMgmtOp
  | UserMgmtOp
  | ViewIndexMgmtOp

/* eslint-disable jsdoc/require-jsdoc */
/**
 * @internal
 */
export enum KeyValueOp {
  Append = 'append',
  Decrement = 'decrement',
  Exists = 'exists',
  Get = 'get',
  GetAllReplicas = 'get_all_replicas',
  GetAndLock = 'get_and_lock',
  GetAndTouch = 'get_and_touch',
  GetAnyReplica = 'get_any_replica',
  GetReplica = 'get_replica', // this is only for the C++ core replica ops
  Increment = 'increment',
  Insert = 'insert',
  LookupIn = 'lookup_in',
  LookupInAllReplicas = 'lookup_in_all_replicas',
  LookupInAnyReplica = 'lookup_in_any_replica',
  LookupInReplica = 'lookup_in_replica', // this is only for the C++ core replica ops
  MutateIn = 'mutate_in',
  Prepend = 'prepend',
  RangeScanCancel = 'range_scan_cancel',
  RangeScanContinue = 'range_scan_continue',
  RangeScanCreate = 'range_scan_create',
  Remove = 'remove',
  Replace = 'replace',
  Touch = 'touch',
  Unlock = 'unlock',
  Upsert = 'upsert',
}

/**
 * @internal
 */
export enum DatastructureOp {
  ListGetAll = 'list_get_all',
  ListGetAt = 'list_get_at',
  ListIndexOf = 'list_index_of',
  ListPush = 'list_push',
  ListRemoveAt = 'list_remove_at',
  ListSize = 'list_size',
  ListUnshift = 'list_unshift',
  MapExists = 'map_exists',
  MapGet = 'map_get',
  MapGetAll = 'map_get_all',
  MapKeys = 'map_keys',
  MapRemove = 'map_remove',
  MapSet = 'map_set',
  MapSize = 'map_size',
  MapValues = 'map_values',
  QueuePop = 'queue_pop',
  QueuePush = 'queue_push',
  QueueSize = 'queue_size',
  SetAdd = 'set_add',
  SetContains = 'set_contains',
  SetRemove = 'set_remove',
  SetSize = 'set_size',
  SetValues = 'set_values',
}

/**
 * @internal
 */
export enum StreamingOp {
  Analytics = 'analytics_query',
  Query = 'query',
  Search = 'search_query',
  View = 'view_query',
}

/**
 * @internal
 */
export enum AnalyticsMgmtOp {
  AnalyticsDatasetCreate = 'manager_analytics_create_dataset',
  AnalyticsDatasetDrop = 'manager_analytics_drop_dataset',
  AnalyticsDatasetGetAll = 'manager_analytics_get_all_datasets',
  AnalyticsDataverseCreate = 'manager_analytics_create_dataverse',
  AnalyticsDataverseDrop = 'manager_analytics_drop_dataverse',
  AnalyticsGetPendingMutations = 'manager_analytics_get_pending_mutations',
  AnalyticsIndexCreate = 'manager_analytics_create_index',
  AnalyticsIndexDrop = 'manager_analytics_drop_index',
  AnalyticsIndexGetAll = 'manager_analytics_get_all_indexes',
  AnalyticsLinkConnect = 'manager_analytics_connectlink',
  AnalyticsLinkCreate = 'manager_analytics_create_link',
  AnalyticsLinkDisconnect = 'manager_analytics_disconnect_link',
  AnalyticsLinkDrop = 'manager_analytics_drop_link',
  AnalyticsLinkGetAll = 'manager_analytics_get_all_links',
  AnalyticsLinkReplace = 'manager_analytics_replace_link',
}

/**
 * @internal
 */
export enum BucketMgmtOp {
  BucketCreate = 'manager_buckets_create_bucket',
  BucketDescribe = 'manager_buckets_describe_bucket',
  BucketDrop = 'manager_buckets_drop_bucket',
  BucketFlush = 'manager_buckets_flush_bucket',
  BucketGet = 'manager_buckets_get_bucket',
  BucketGetAll = 'manager_buckets_get_all_buckets',
  BucketUpdate = 'manager_buckets_update_bucket',
}

/**
 * @internal
 */
export enum CollectionMgmtOp {
  CollectionCreate = 'manager_collections_create_collection',
  CollectionsManifestGet = 'manager_collections_get_collections_manifest',
  CollectionDrop = 'manager_collections_drop_collection',
  CollectionUpdate = 'manager_collections_update_collection',
  ScopeCreate = 'manager_collections_create_scope',
  ScopeDrop = 'manager_collections_drop_scope',
  ScopeGetAll = 'manager_collections_get_all_scopes',
}

/**
 * @internal
 */
export enum EventingFunctionMgmtOp {
  EventingDeployFunction = 'manager_eventing_deploy_function',
  EventingDropFunction = 'manager_eventing_drop_function',
  EventingGetAllFunctions = 'manager_eventing_get_all_functions',
  EventingGetFunction = 'manager_eventing_get_function',
  EventingGetStatus = 'manager_eventing_functions_status',
  EventingPauseFunction = 'manager_eventing_pause_function',
  EventingResumeFunction = 'manager_eventing_resume_function',
  EventingUndeployFunction = 'manager_eventing_undeploy_function',
  EventingUpsertFunction = 'manager_eventing_upsert_function',
}

/**
 * @internal
 */
export enum QueryIndexMgmtOp {
  QueryIndexBuild = 'manager_query_build_indexes',
  QueryIndexBuildDeferred = 'manager_query_build_deferred_indexes',
  QueryIndexCreate = 'manager_query_create_index',
  QueryIndexDrop = 'manager_query_drop_index',
  QueryIndexGetAll = 'manager_query_get_all_indexes',
  QueryIndexGetAllDeferred = 'manager_query_get_all_deferred_indexes',
  QueryIndexWatchIndexes = 'manager_query_watch_indexes',
}

/**
 * @internal
 */
export enum SearchIndexMgmtOp {
  SearchGetStats = 'manager_search_get_stats',
  SearchIndexAllowQuerying = 'manager_search_allow_querying',
  SearchIndexAnalyzeDocument = 'manager_search_analyze_document',
  SearchIndexDisallowQuerying = 'manager_search_disallow_querying',
  SearchIndexDrop = 'manager_search_drop_index',
  SearchIndexFreezePlan = 'manager_search_freeze_plan',
  SearchIndexGet = 'manager_search_get_index',
  SearchIndexGetAll = 'manager_search_get_all_indexes',
  SearchIndexGetDocumentsCount = 'manager_search_get_indexed_documents_count',
  SearchIndexGetStats = 'manager_search_get_index_stats',
  SearchIndexPauseIngest = 'manager_search_pause_ingest',
  SearchIndexResumeIngest = 'manager_search_resume_ingest',
  SearchIndexUnfreezePlan = 'manager_search_unfreeze_plan',
  SearchIndexUpsert = 'manager_search_upsert_index',
}

/**
 * @internal
 */
export enum UserMgmtOp {
  ChangePassword = 'manager_users_change_password',
  GroupDrop = 'manager_users_drop_group',
  GroupGet = 'manager_users_get_group',
  GroupGetAll = 'manager_users_get_all_groups',
  GroupUpsert = 'manager_users_upsert_group',
  RoleGetAll = 'manager_users_get_all_roles',
  UserDrop = 'manager_users_drop_user',
  UserGet = 'manager_users_get_user',
  UserGetAll = 'manager_users_get_all_users',
  UserUpsert = 'manager_users_upsert_user',
}

/**
 * @internal
 */
export enum ViewIndexMgmtOp {
  ViewIndexDrop = 'manager_views_drop_design_document',
  ViewIndexGet = 'manager_views_get_design_document',
  ViewIndexGetAll = 'manager_views_get_all_design_documents',
  ViewIndexPublish = 'manager_views_publish_design_document',
  ViewIndexUpsert = 'manager_views_upsert_design_document',
}

/**
 * @internal
 */
export enum CppOpAttributeName {
  ClusterName = 'cluster_name',
  ClusterUUID = 'cluster_uuid',
  RetryCount = 'retries',
}

/**
 * @internal
 */
export enum OpAttributeName {
  BucketName = 'db.namespace',
  ClusterName = 'couchbase.cluster.name',
  ClusterUUID = 'couchbase.cluster.uuid',
  CollectionName = 'couchbase.collection.name',
  DispatchSpanName = 'dispatch_to_server',
  DurabilityLevel = 'couchbase.durability',
  EncodingSpanName = 'request_encoding',
  ErrorType = 'error.type',
  MeterNameOpDuration = 'db.client.operation.duration',
  OperationName = 'db.operation.name',
  QueryStatement = 'db.query.text',
  ReservedUnit = '__unit',
  ReservedUnitSeconds = 's',
  RetryCount = 'couchbase.retries',
  ScopeName = 'couchbase.scope.name',
  Service = 'couchbase.service',
  SystemName = 'db.system.name',
}

export const CppOpAttributeNameToOpAttributeNameMap: Record<
  CppOpAttributeName,
  OpAttributeName
> = {
  [CppOpAttributeName.ClusterName]: OpAttributeName.ClusterName,
  [CppOpAttributeName.ClusterUUID]: OpAttributeName.ClusterUUID,
  [CppOpAttributeName.RetryCount]: OpAttributeName.RetryCount,
}

export const isCppAttribute = (attr: any): attr is CppOpAttributeName => {
  return attr in CppOpAttributeNameToOpAttributeNameMap
}

/**
 * @internal
 */
export enum DispatchAttributeName {
  LocalId = 'couchbase.local_id',
  NetworkTransport = 'network.transport',
  OperationId = 'couchbase.operation_id',
  PeerAddress = 'network.peer.address',
  PeerPort = 'network.peer.port',
  ServerAddress = 'server.address',
  ServerDuration = 'couchbase.server_duration',
  ServerPort = 'server.port',
}

/**
 * @internal
 */
export enum ServiceName {
  Analytics = 'analytics',
  Eventing = 'eventing',
  KeyValue = 'kv',
  Management = 'management',
  Query = 'query',
  Search = 'search',
  Transactions = 'transactions',
  Views = 'views',
}

/**
 * @internal
 */
export function serviceNameFromOpType(opType: OpType): ServiceName {
  if (Object.values(KeyValueOp).includes(opType as KeyValueOp)) {
    return ServiceName.KeyValue
  } else if (
    Object.values(DatastructureOp).includes(opType as DatastructureOp)
  ) {
    return ServiceName.KeyValue
  } else if (Object.values(StreamingOp).includes(opType as StreamingOp)) {
    switch (opType) {
      case StreamingOp.Analytics:
        return ServiceName.Analytics
      case StreamingOp.Query:
        return ServiceName.Query
      case StreamingOp.Search:
        return ServiceName.Search
      case StreamingOp.View:
        return ServiceName.Views
    }
  } else if (
    Object.values(AnalyticsMgmtOp).includes(opType as AnalyticsMgmtOp)
  ) {
    return ServiceName.Analytics
  } else if (Object.values(BucketMgmtOp).includes(opType as BucketMgmtOp)) {
    return ServiceName.Management
  } else if (
    Object.values(CollectionMgmtOp).includes(opType as CollectionMgmtOp)
  ) {
    return ServiceName.Management
  } else if (
    Object.values(EventingFunctionMgmtOp).includes(
      opType as EventingFunctionMgmtOp
    )
  ) {
    return ServiceName.Eventing
  } else if (
    Object.values(QueryIndexMgmtOp).includes(opType as QueryIndexMgmtOp)
  ) {
    return ServiceName.Query
  } else if (
    Object.values(SearchIndexMgmtOp).includes(opType as SearchIndexMgmtOp)
  ) {
    return ServiceName.Search
  } else if (Object.values(UserMgmtOp).includes(opType as UserMgmtOp)) {
    return ServiceName.Management
  } else if (
    Object.values(ViewIndexMgmtOp).includes(opType as ViewIndexMgmtOp)
  ) {
    return ServiceName.Views
  }
  throw new Error(`Unknown OpType: ${opType}`)
}

/* eslint-enable jsdoc/require-jsdoc */
/**
 * Represents the status of a span in distributed tracing.
 */
export interface SpanStatus {
  /**
   * The status code indicating the outcome of the span.
   */
  code: SpanStatusCode
  /**
   * An optional developer-facing error message providing additional context.
   */
  message?: string
}

/**
 * An enumeration of status codes.
 */
export enum SpanStatusCode {
  /**
   * The default status.
   */
  UNSET = 0,
  /**
   * The operation has been validated by an Application developer or
   * Operator to have completed successfully.
   */
  OK = 1,
  /**
   * The operation contains an error.
   */
  ERROR = 2,
}

/**
 * @internal
 */
export class ObservabilityInstruments {
  private readonly _tracer: RequestTracer
  private readonly _meter: Meter
  private readonly _getClusterLabelsFn:
    | (() => Record<string, string | undefined>)
    | undefined

  constructor(
    tracer: RequestTracer,
    meter: any,
    getClusterLabelsFn?: () => Record<string, string | undefined>
  ) {
    this._tracer = tracer
    this._meter = meter
    this._getClusterLabelsFn = getClusterLabelsFn
  }

  /**
   * @internal
   */
  get tracer(): RequestTracer {
    return this._tracer
  }

  /**
   * @internal
   */
  get meter(): Meter {
    return this._meter
  }

  /**
   * @internal
   */
  get clusterLabelsFn():
    | (() => Record<string, string | undefined>)
    | undefined {
    return this._getClusterLabelsFn
  }
}
