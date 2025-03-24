import { AnalyticsScanConsistency, AnalyticsStatus } from './analyticstypes'
import {
  AnalyticsEncryptionLevel,
  CouchbaseAnalyticsEncryptionSettings,
} from './analyticsindexmanager'
import binding, {
  CppAnalyticsResponseAnalyticsStatus,
  CppAnalyticsScanConsistency,
  CppDesignDocumentNamespace,
  CppDiagEndpointState,
  CppDiagPingState,
  CppDurabilityLevel,
  CppError,
  CppManagementAnalyticsCouchbaseLinkEncryptionLevel,
  CppManagementAnalyticsCouchbaseLinkEncryptionSettings,
  CppManagementClusterBucketCompression,
  CppManagementClusterBucketConflictResolution,
  CppManagementClusterBucketEvictionPolicy,
  CppManagementClusterBucketStorageBackend,
  CppManagementClusterBucketType,
  CppManagementEventingFunctionBucketAccess,
  CppManagementEventingFunctionDcpBoundary,
  CppManagementEventingFunctionDeploymentStatus,
  CppManagementEventingFunctionLanguageCompatibility,
  CppManagementEventingFunctionLogLevel,
  CppManagementEventingFunctionProcessingStatus,
  CppManagementEventingFunctionStatus,
  CppManagementRbacAuthDomain,
  CppMutationState,
  CppMutationToken,
  CppPersistTo,
  CppPrefixScan,
  CppQueryProfile,
  CppQueryScanConsistency,
  CppRangeScan,
  CppReadPreference,
  CppReplicateTo,
  CppRetryReason,
  CppSamplingScan,
  CppSearchHighlightStyle,
  CppSearchScanConsistency,
  CppServiceType,
  CppStoreSemantics,
  CppTransactionKeyspace,
  CppTxnExternalException,
  CppTxnOpException,
  CppVectorQueryCombination,
  CppViewScanConsistency,
  CppViewSortOrder,
} from './binding'
import {
  BucketType,
  CompressionMode,
  ConflictResolutionType,
  EvictionPolicy,
  StorageBackend,
} from './bucketmanager'
import { EndpointState, PingState } from './diagnosticstypes'
import * as errctxs from './errorcontexts'
import { ErrorContext } from './errorcontexts'
import * as errs from './errors'
import {
  DurabilityLevel,
  ReadPreference,
  ServiceType,
  StoreSemantics,
} from './generaltypes'
import { MutationState } from './mutationstate'
import { QueryProfileMode, QueryScanConsistency } from './querytypes'
import { PrefixScan, RangeScan, SamplingScan } from './rangeScan'
import { HighlightStyle, SearchScanConsistency } from './searchtypes'
import { TransactionKeyspace } from './transactions'
import { nsServerStrToDuraLevel } from './utilities'
import { VectorQueryCombination } from './vectorsearch'
import {
  DesignDocumentNamespace,
  ViewOrdering,
  ViewScanConsistency,
} from './viewtypes'
import {
  EventingFunctionBucketAccess,
  EventingFunctionDcpBoundary,
  EventingFunctionDeploymentStatus,
  EventingFunctionLanguageCompatibility,
  EventingFunctionLogLevel,
  EventingFunctionProcessingStatus,
  EventingFunctionStatus,
} from './eventingfunctionmanager'

/**
 * @internal
 */
export function durabilityToCpp(
  mode: DurabilityLevel | string | undefined
): CppDurabilityLevel {
  // Unspecified is allowed, and means no sync durability.
  if (mode === null || mode === undefined) {
    return binding.durability_level.none
  }

  if (typeof mode === 'string') {
    mode = nsServerStrToDuraLevel(mode)
  }

  if (mode === DurabilityLevel.None) {
    return binding.durability_level.none
  } else if (mode === DurabilityLevel.Majority) {
    return binding.durability_level.majority
  } else if (mode === DurabilityLevel.MajorityAndPersistOnMaster) {
    return binding.durability_level.majority_and_persist_to_active
  } else if (mode === DurabilityLevel.PersistToMajority) {
    return binding.durability_level.persist_to_majority
  }

  throw new errs.InvalidDurabilityLevel()
}

/**
 * @internal
 */
export function durabilityFromCpp(
  mode: CppDurabilityLevel | undefined
): DurabilityLevel | undefined {
  if (mode === null || mode === undefined) {
    return undefined
  }

  if (mode === binding.durability_level.none) {
    return DurabilityLevel.None
  } else if (mode === binding.durability_level.majority) {
    return DurabilityLevel.Majority
  } else if (mode === binding.durability_level.majority_and_persist_to_active) {
    return DurabilityLevel.MajorityAndPersistOnMaster
  } else if (mode === binding.durability_level.persist_to_majority) {
    return DurabilityLevel.PersistToMajority
  }

  throw new errs.InvalidDurabilityLevel()
}

/**
 * @internal
 */
export function persistToToCpp(persistTo: number | undefined): CppPersistTo {
  // Unspecified is allowed, and means no persistTo.
  if (persistTo === null || persistTo === undefined) {
    return binding.persist_to.none
  }

  if (persistTo === 0) {
    return binding.persist_to.none
  } else if (persistTo === 1) {
    return binding.persist_to.active
  } else if (persistTo === 2) {
    return binding.persist_to.one
  } else if (persistTo === 3) {
    return binding.persist_to.two
  } else if (persistTo === 4) {
    return binding.persist_to.three
  } else if (persistTo === 5) {
    return binding.persist_to.four
  }

  throw new errs.InvalidDurabilityPersistToLevel()
}

/**
 * @internal
 */
export function replicateToToCpp(
  replicateTo: number | undefined
): CppReplicateTo {
  // Unspecified is allowed, and means no persistTo.
  if (replicateTo === null || replicateTo === undefined) {
    return binding.replicate_to.none
  }

  if (replicateTo === 0) {
    return binding.replicate_to.none
  } else if (replicateTo === 1) {
    return binding.replicate_to.one
  } else if (replicateTo === 2) {
    return binding.replicate_to.two
  } else if (replicateTo === 3) {
    return binding.replicate_to.three
  }

  throw new errs.InvalidDurabilityReplicateToLevel()
}

/**
 * @internal
 */
export function storeSemanticToCpp(
  mode: StoreSemantics | undefined
): CppStoreSemantics {
  if (mode === null || mode === undefined) {
    return binding.store_semantics.replace
  }

  if (mode === StoreSemantics.Insert) {
    return binding.store_semantics.insert
  } else if (mode === StoreSemantics.Upsert) {
    return binding.store_semantics.upsert
  } else if (mode === StoreSemantics.Replace) {
    return binding.store_semantics.replace
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function viewScanConsistencyToCpp(
  mode: ViewScanConsistency | undefined
): CppViewScanConsistency | undefined {
  // Unspecified is allowed, and means no sync durability.
  if (mode === null || mode === undefined) {
    return undefined
  }

  if (mode === ViewScanConsistency.NotBounded) {
    return binding.view_scan_consistency.not_bounded
  } else if (mode === ViewScanConsistency.UpdateAfter) {
    return binding.view_scan_consistency.update_after
  } else if (mode === ViewScanConsistency.RequestPlus) {
    return binding.view_scan_consistency.request_plus
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function viewOrderingToCpp(
  ordering: ViewOrdering | undefined
): CppViewSortOrder | undefined {
  // Unspecified is allowed, and means default ordering.
  if (ordering === null || ordering === undefined) {
    return undefined
  }

  if (ordering === ViewOrdering.Ascending) {
    return binding.view_sort_order.ascending
  } else if (ordering === ViewOrdering.Descending) {
    return binding.view_sort_order.descending
  }

  throw new errs.InvalidArgumentError(new Error('Unrecognized view ordering.'))
}

/**
 * @internal
 */
export function queryScanConsistencyToCpp(
  mode: QueryScanConsistency | undefined
): CppQueryScanConsistency | undefined {
  // Unspecified is allowed, and means no sync durability.
  if (mode === null || mode === undefined) {
    return undefined
  }

  if (mode === QueryScanConsistency.NotBounded) {
    return binding.query_scan_consistency.not_bounded
  } else if (mode === QueryScanConsistency.RequestPlus) {
    return binding.query_scan_consistency.request_plus
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function queryScanConsistencyFromCpp(
  mode: CppQueryScanConsistency | undefined
): QueryScanConsistency | undefined {
  if (!mode) return undefined

  if (mode === binding.query_scan_consistency.not_bounded) {
    return QueryScanConsistency.NotBounded
  } else if (mode === binding.query_scan_consistency.request_plus) {
    return QueryScanConsistency.RequestPlus
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function queryProfileToCpp(
  mode: QueryProfileMode | undefined
): CppQueryProfile {
  // Unspecified is allowed, and means no sync durability.
  if (mode === null || mode === undefined) {
    return binding.query_profile.off
  }

  if (mode === QueryProfileMode.Off) {
    return binding.query_profile.off
  } else if (mode === QueryProfileMode.Phases) {
    return binding.query_profile.phases
  } else if (mode === QueryProfileMode.Timings) {
    return binding.query_profile.timings
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function analyticsScanConsistencyToCpp(
  mode: AnalyticsScanConsistency | undefined
): CppAnalyticsScanConsistency {
  // Unspecified is allowed, and means no sync durability.
  if (mode === null || mode === undefined) {
    return binding.analytics_scan_consistency.not_bounded
  }

  if (mode === AnalyticsScanConsistency.NotBounded) {
    return binding.analytics_scan_consistency.not_bounded
  } else if (mode === AnalyticsScanConsistency.RequestPlus) {
    return binding.analytics_scan_consistency.request_plus
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function analyticsStatusFromCpp(
  status: CppAnalyticsResponseAnalyticsStatus
): AnalyticsStatus {
  if (status === binding.analytics_response_analytics_status.running) {
    return AnalyticsStatus.Running
  } else if (status === binding.analytics_response_analytics_status.success) {
    return AnalyticsStatus.Success
  } else if (status === binding.analytics_response_analytics_status.errors) {
    return AnalyticsStatus.Errors
  } else if (status === binding.analytics_response_analytics_status.completed) {
    return AnalyticsStatus.Completed
  } else if (status === binding.analytics_response_analytics_status.stopped) {
    return AnalyticsStatus.Stopped
  } else if (status === binding.analytics_response_analytics_status.timedout) {
    return AnalyticsStatus.Timeout
  } else if (status === binding.analytics_response_analytics_status.closed) {
    return AnalyticsStatus.Closed
  } else if (status === binding.analytics_response_analytics_status.fatal) {
    return AnalyticsStatus.Fatal
  } else if (status === binding.analytics_response_analytics_status.aborted) {
    return AnalyticsStatus.Aborted
  } else if (status === binding.analytics_response_analytics_status.unknown) {
    return AnalyticsStatus.Unknown
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function searchScanConsistencyToCpp(
  mode: SearchScanConsistency | undefined
): CppSearchScanConsistency {
  // Unspecified is allowed, and means no sync durability.
  if (mode === null || mode === undefined) {
    return binding.search_scan_consistency.not_bounded
  }

  if (mode === SearchScanConsistency.NotBounded) {
    return binding.search_scan_consistency.not_bounded
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function searchHighlightStyleToCpp(
  mode: HighlightStyle | undefined
): CppSearchHighlightStyle | undefined {
  // Unspecified is allowed, and means no sync durability.
  if (mode === null || mode === undefined) {
    return undefined
  }

  if (mode === HighlightStyle.ANSI) {
    return binding.search_highlight_style.ansi
  } else if (mode === HighlightStyle.HTML) {
    return binding.search_highlight_style.html
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function mutationStateToCpp(
  state: MutationState | undefined
): CppMutationState {
  if (state === null || state === undefined) {
    return { tokens: [] }
  }

  const tokens: CppMutationToken[] = []
  for (const bucketName in state._data) {
    for (const vbId in state._data[bucketName]) {
      const token = state._data[bucketName][vbId]
      tokens.push(token)
    }
  }

  return { tokens: tokens }
}

/**
 * @internal
 */
export function serviceTypeToCpp(service: ServiceType): CppServiceType {
  if (service === ServiceType.KeyValue) {
    return binding.service_type.key_value
  } else if (service === ServiceType.Query) {
    return binding.service_type.query
  } else if (service === ServiceType.Analytics) {
    return binding.service_type.analytics
  } else if (service === ServiceType.Search) {
    return binding.service_type.search
  } else if (service === ServiceType.Views) {
    return binding.service_type.view
  } else if (service === ServiceType.Management) {
    return binding.service_type.management
  } else if (service === ServiceType.Eventing) {
    return binding.service_type.eventing
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function serviceTypeFromCpp(service: CppServiceType): ServiceType {
  if (service === binding.service_type.key_value) {
    return ServiceType.KeyValue
  } else if (service === binding.service_type.query) {
    return ServiceType.Query
  } else if (service === binding.service_type.analytics) {
    return ServiceType.Analytics
  } else if (service === binding.service_type.search) {
    return ServiceType.Search
  } else if (service === binding.service_type.view) {
    return ServiceType.Views
  } else if (service === binding.service_type.management) {
    return ServiceType.Management
  } else if (service === binding.service_type.eventing) {
    return ServiceType.Eventing
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function endpointStateFromCpp(
  service: CppDiagEndpointState
): EndpointState {
  if (service === binding.diag_endpoint_state.disconnected) {
    return EndpointState.Disconnected
  } else if (service === binding.diag_endpoint_state.connecting) {
    return EndpointState.Connecting
  } else if (service === binding.diag_endpoint_state.connected) {
    return EndpointState.Connected
  } else if (service === binding.diag_endpoint_state.disconnecting) {
    return EndpointState.Disconnecting
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function txnExternalExceptionStringFromCpp(
  cause: CppTxnExternalException
): string {
  if (cause === binding.txn_external_exception.unknown) {
    return 'unknown'
  } else if (
    cause ===
    binding.txn_external_exception.active_transaction_record_entry_not_found
  ) {
    return 'active_transaction_record_entry_not_found'
  } else if (
    cause === binding.txn_external_exception.active_transaction_record_full
  ) {
    return 'active_transaction_record_full'
  } else if (
    cause === binding.txn_external_exception.active_transaction_record_not_found
  ) {
    return 'active_transaction_record_not_found'
  } else if (
    cause === binding.txn_external_exception.document_already_in_transaction
  ) {
    return 'document_already_in_transaction'
  } else if (
    cause === binding.txn_external_exception.document_exists_exception
  ) {
    return 'document_exists_exception'
  } else if (
    cause === binding.txn_external_exception.document_not_found_exception
  ) {
    return 'document_not_found_exception'
  } else if (cause === binding.txn_external_exception.not_set) {
    return 'not_set'
  } else if (
    cause === binding.txn_external_exception.feature_not_available_exception
  ) {
    return 'feature_not_available_exception'
  } else if (
    cause === binding.txn_external_exception.transaction_aborted_externally
  ) {
    return 'transaction_aborted_externally'
  } else if (
    cause === binding.txn_external_exception.previous_operation_failed
  ) {
    return 'previous_operation_failed'
  } else if (
    cause === binding.txn_external_exception.forward_compatibility_failure
  ) {
    return 'forward_compatibility_failure'
  } else if (cause === binding.txn_external_exception.parsing_failure) {
    return 'parsing_failure'
  } else if (cause === binding.txn_external_exception.illegal_state_exception) {
    return 'illegal_state_exception'
  } else if (cause === binding.txn_external_exception.couchbase_exception) {
    return 'couchbase_exception'
  } else if (
    cause === binding.txn_external_exception.service_not_available_exception
  ) {
    return 'service_not_available_exception'
  } else if (
    cause === binding.txn_external_exception.request_canceled_exception
  ) {
    return 'request_canceled_exception'
  } else if (
    cause ===
    binding.txn_external_exception
      .concurrent_operations_detected_on_same_document
  ) {
    return 'concurrent_operations_detected_on_same_document'
  } else if (cause === binding.txn_external_exception.commit_not_permitted) {
    return 'commit_not_permitted'
  } else if (cause === binding.txn_external_exception.rollback_not_permitted) {
    return 'rollback_not_permitted'
  } else if (
    cause === binding.txn_external_exception.transaction_already_aborted
  ) {
    return 'transaction_already_aborted'
  } else if (
    cause === binding.txn_external_exception.transaction_already_committed
  ) {
    return 'transaction_already_committed'
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function txnOpExeptionFromCpp(
  err: CppTxnOpException | null,
  ctx: ErrorContext | null
): Error | null {
  if (!err) {
    return null
  }

  const context = ctx ? ctx : undefined
  if (err.cause === binding.txn_external_exception.document_exists_exception) {
    return new errs.DocumentExistsError(
      new Error(txnExternalExceptionStringFromCpp(err.cause)),
      context
    )
  } else if (
    err.cause === binding.txn_external_exception.document_not_found_exception
  ) {
    return new errs.DocumentNotFoundError(
      new Error(txnExternalExceptionStringFromCpp(err.cause)),
      context
    )
  } else if (err.cause === binding.txn_external_exception.parsing_failure) {
    return new errs.ParsingFailureError(
      new Error(txnExternalExceptionStringFromCpp(err.cause)),
      context
    )
  } else if (err.cause === binding.txn_external_exception.couchbase_exception) {
    const cause = txnExternalExceptionStringFromCpp(err.cause)
    return new errs.CouchbaseError(cause, new Error(cause), context)
  }

  return err as any as Error
}

/**
 * @internal
 */
export function pingStateFromCpp(service: CppDiagPingState): PingState {
  if (service === binding.diag_ping_state.ok) {
    return PingState.Ok
  } else if (service === binding.diag_ping_state.timeout) {
    return PingState.Timeout
  } else if (service === binding.diag_ping_state.error) {
    return PingState.Error
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function contextFromCpp(err: CppError | null): ErrorContext | null {
  if (!err) {
    return null
  }

  let context = null
  if (err.ctxtype === 'key_value') {
    context = new errctxs.KeyValueErrorContext({
      status_code: err.status_code,
      opaque: err.opaque,
      cas: err.cas,
      key: err.id ? err.id.key : '',
      bucket: err.id ? err.id.bucket : '',
      collection: err.id ? err.id.collection : '',
      scope: err.id ? err.id.scope : '',
      context: err.enhanced_error_info ? err.enhanced_error_info.context : '',
      ref: err.enhanced_error_info ? err.enhanced_error_info.reference : '',
    })
  } else if (err.ctxtype === 'view') {
    context = new errctxs.ViewErrorContext({
      design_document: err.design_document_name,
      view: err.view_name,
      parameters: err.query_string,
      http_response_code: err.http_status,
      http_response_body: err.http_body,
    })
  } else if (err.ctxtype === 'query') {
    context = new errctxs.QueryErrorContext({
      statement: err.statement,
      client_context_id: err.client_context_id,
      parameters: err.parameters,
      http_response_code: err.http_status,
      http_response_body: err.http_body,
    })
  } else if (err.ctxtype === 'search') {
    context = new errctxs.SearchErrorContext({
      index_name: err.index_name,
      query: err.query,
      parameters: err.parameters,
      http_response_code: err.http_status,
      http_response_body: err.http_body,
    })
  } else if (err.ctxtype === 'analytics') {
    context = new errctxs.AnalyticsErrorContext({
      statement: err.statement,
      client_context_id: err.client_context_id,
      parameters: err.parameters,
      http_response_code: err.http_status,
      http_response_body: err.http_body,
    })
  } else if (err.ctxtype === 'http') {
    context = new errctxs.HttpErrorContext({
      method: err.method,
      request_path: err.path,
      response_code: err.http_status,
      response_body: err.http_body,
    })
  }

  return context
}

/**
 * @internal
 */
function retryReasonFromCpp(
  reason: CppRetryReason | undefined
): string | undefined {
  if (!reason) return undefined

  if (reason === binding.retry_reason.do_not_retry) {
    return "do_not_retry"
  } else if (reason === binding.retry_reason.unknown) {
    return "unknown"
  } else if (reason === binding.retry_reason.socket_not_available) {
    return "socket_not_available"
  } else if (reason === binding.retry_reason.service_not_available) {
    return "service_not_available"
  } else if (reason === binding.retry_reason.node_not_available) {
    return "node_not_available"
  } else if (reason === binding.retry_reason.key_value_not_my_vbucket) {
    return "key_value_not_my_vbucket"
  } else if (reason === binding.retry_reason.key_value_collection_outdated) {
    return "key_value_collection_outdated"
  } else if (reason === binding.retry_reason.key_value_error_map_retry_indicated) {
    return "key_value_error_map_retry_indicated"
  } else if (reason === binding.retry_reason.key_value_locked) {
    return "key_value_locked"
  } else if (reason === binding.retry_reason.key_value_temporary_failure) {
    return "key_value_temporary_failure"
  } else if (reason === binding.retry_reason.key_value_sync_write_in_progress) {
    return "key_value_sync_write_in_progress"
  } else if (reason === binding.retry_reason.key_value_sync_write_re_commit_in_progress) {
    return "key_value_sync_write_re_commit_in_progress"
  } else if (reason === binding.retry_reason.service_response_code_indicated) {
    return "service_response_code_indicated"
  } else if (reason === binding.retry_reason.socket_closed_while_in_flight) {
    return "socket_closed_while_in_flight"
  } else if (reason === binding.retry_reason.circuit_breaker_open) {
    return "circuit_breaker_open"
  } else if (reason === binding.retry_reason.query_prepared_statement_failure) {
    return "query_prepared_statement_failure"
  } else if (reason === binding.retry_reason.query_index_not_found) {
    return "query_index_not_found"
  } else if (reason === binding.retry_reason.analytics_temporary_failure) {
    return "analytics_temporary_failure"
  } else if (reason === binding.retry_reason.search_too_many_requests) {
    return "search_too_many_requests"
  } else if (reason === binding.retry_reason.views_temporary_failure) {
    return "views_temporary_failure"
  } else if (reason === binding.retry_reason.views_no_active_partition) {
    return "views_no_active_partition"
  } else {
    return "unknown"
  }
}

/**
 * @internal
 */
export function errorFromCpp(err: CppError | null): Error | null {
  if (!err) {
    return null
  }

  // BUG(JSCBC-1010): We shouldn't need to special case these.
  if (err.ctxtype === 'transaction_operation_failed') {
    const cause = txnExternalExceptionStringFromCpp(err.cause)
    if (cause == 'feature_not_available_exception') {
      const msg =
        'Possibly attempting a binary transaction operation with a server version < 7.6.2'
      return new errs.TransactionOperationFailedError(
        new errs.FeatureNotAvailableError(new Error(msg))
      )
    }
    return new errs.TransactionOperationFailedError(
      new Error(txnExternalExceptionStringFromCpp(err.cause))
    )
  } else if (err.ctxtype === 'transaction_op_exception') {
    let txnContext: ErrorContext | null = null
    if (err.ctx?.cause) {
      txnContext = contextFromCpp(err.ctx.cause)
    }
    return txnOpExeptionFromCpp(err, txnContext)
  } else if (err.ctxtype === 'transaction_exception') {
    if (err.type === binding.txn_failure_type.fail) {
      return new errs.TransactionFailedError(
        new Error(txnExternalExceptionStringFromCpp(err.cause))
      )
    } else if (err.type === binding.txn_failure_type.expiry) {
      return new errs.TransactionExpiredError(
        new Error(txnExternalExceptionStringFromCpp(err.cause))
      )
    } else if (err.type === binding.txn_failure_type.commit_ambiguous) {
      return new errs.TransactionCommitAmbiguousError(
        new Error(txnExternalExceptionStringFromCpp(err.cause))
      )
    }

    throw new errs.InvalidArgumentError()
  }

  const baseErr = err as any as Error
  const contextOrNull = contextFromCpp(err)
  const context = contextOrNull ? contextOrNull : undefined

  if ('retry_reasons' in baseErr && Array.isArray(baseErr.retry_reasons)) {
    baseErr.retry_reasons = baseErr.retry_reasons.map(retryReasonFromCpp);
  }

  switch (err.code) {
    case binding.errc_common.request_canceled:
      return new errs.RequestCanceledError(baseErr, context)
    case binding.errc_common.invalid_argument:
      return new errs.InvalidArgumentError(baseErr, context)
    case binding.errc_common.service_not_available:
      return new errs.ServiceNotAvailableError(baseErr, context)
    case binding.errc_common.internal_server_failure:
      return new errs.InternalServerFailureError(baseErr, context)
    case binding.errc_common.authentication_failure:
      return new errs.AuthenticationFailureError(baseErr, context)
    case binding.errc_common.temporary_failure:
      return new errs.TemporaryFailureError(baseErr, context)
    case binding.errc_common.parsing_failure:
      return new errs.ParsingFailureError(baseErr, context)
    case binding.errc_common.cas_mismatch:
      return new errs.CasMismatchError(baseErr, context)
    case binding.errc_common.bucket_not_found:
      return new errs.BucketNotFoundError(baseErr, context)
    case binding.errc_common.collection_not_found:
      return new errs.CollectionNotFoundError(baseErr, context)
    case binding.errc_common.unsupported_operation:
      return new errs.UnsupportedOperationError(baseErr, context)
    case binding.errc_common.unambiguous_timeout:
      return new errs.UnambiguousTimeoutError(baseErr, context)
    case binding.errc_common.ambiguous_timeout:
      return new errs.AmbiguousTimeoutError(baseErr, context)
    case binding.errc_common.feature_not_available:
      return new errs.FeatureNotAvailableError(baseErr, context)
    case binding.errc_common.scope_not_found:
      return new errs.ScopeNotFoundError(baseErr, context)
    case binding.errc_common.index_not_found:
      return new errs.IndexNotFoundError(baseErr, context)
    case binding.errc_common.index_exists:
      return new errs.IndexExistsError(baseErr, context)
    case binding.errc_common.decoding_failure:
      return new errs.DecodingFailureError(baseErr, context)
    case binding.errc_common.rate_limited:
      return new errs.RateLimitedError(baseErr, context)
    case binding.errc_common.quota_limited:
      return new errs.QuotaLimitedError(baseErr, context)

    case binding.errc_key_value.document_not_found:
      return new errs.DocumentNotFoundError(baseErr, context)
    case binding.errc_key_value.document_irretrievable:
      return new errs.DocumentUnretrievableError(baseErr, context)
    case binding.errc_key_value.document_locked:
      return new errs.DocumentLockedError(baseErr, context)
    case binding.errc_key_value.document_not_locked:
      return new errs.DocumentNotLockedError(baseErr, context)
    case binding.errc_key_value.value_too_large:
      return new errs.ValueTooLargeError(baseErr, context)
    case binding.errc_key_value.document_exists:
      return new errs.DocumentExistsError(baseErr, context)
    case binding.errc_key_value.durability_level_not_available:
      return new errs.DurabilityLevelNotAvailableError(baseErr, context)
    case binding.errc_key_value.durability_impossible:
      return new errs.DurabilityImpossibleError(baseErr, context)
    case binding.errc_key_value.durability_ambiguous:
      return new errs.DurabilityAmbiguousError(baseErr, context)
    case binding.errc_key_value.durable_write_in_progress:
      return new errs.DurableWriteInProgressError(baseErr, context)
    case binding.errc_key_value.durable_write_re_commit_in_progress:
      return new errs.DurableWriteReCommitInProgressError(baseErr, context)
    case binding.errc_key_value.path_not_found:
      return new errs.PathNotFoundError(baseErr, context)
    case binding.errc_key_value.path_mismatch:
      return new errs.PathMismatchError(baseErr, context)
    case binding.errc_key_value.path_invalid:
      return new errs.PathInvalidError(baseErr, context)
    case binding.errc_key_value.path_too_big:
      return new errs.PathTooBigError(baseErr, context)
    case binding.errc_key_value.path_too_deep:
      return new errs.PathTooDeepError(baseErr, context)
    case binding.errc_key_value.value_too_deep:
      return new errs.ValueTooDeepError(baseErr, context)
    case binding.errc_key_value.value_invalid:
      return new errs.ValueInvalidError(baseErr, context)
    case binding.errc_key_value.document_not_json:
      return new errs.DocumentNotJsonError(baseErr, context)
    case binding.errc_key_value.number_too_big:
      return new errs.NumberTooBigError(baseErr, context)
    case binding.errc_key_value.delta_invalid:
      return new errs.DeltaInvalidError(baseErr, context)
    case binding.errc_key_value.path_exists:
      return new errs.PathExistsError(baseErr, context)
    case binding.errc_key_value.xattr_unknown_macro:
    case binding.errc_key_value.xattr_invalid_key_combo:
    case binding.errc_key_value.xattr_unknown_virtual_attribute:
    case binding.errc_key_value.xattr_cannot_modify_virtual_attribute:
    case binding.errc_key_value.xattr_no_access:
    case binding.errc_key_value.cannot_revive_living_document:
      // These error types are converted into generic ones instead.
      break

    case binding.errc_query.planning_failure:
      return new errs.PlanningFailureError(baseErr, context)
    case binding.errc_query.index_failure:
      return new errs.IndexFailureError(baseErr, context)
    case binding.errc_query.prepared_statement_failure:
      return new errs.PreparedStatementFailureError(baseErr, context)
    case binding.errc_query.dml_failure:
      return new errs.DmlFailureError(baseErr, context)

    case binding.errc_analytics.compilation_failure:
      return new errs.CompilationFailureError(baseErr, context)
    case binding.errc_analytics.job_queue_full:
      return new errs.JobQueueFullError(baseErr, context)
    case binding.errc_analytics.dataset_not_found:
      return new errs.DatasetNotFoundError(baseErr, context)
    case binding.errc_analytics.dataverse_not_found:
      return new errs.DataverseNotFoundError(baseErr, context)
    case binding.errc_analytics.dataset_exists:
      return new errs.DatasetExistsError(baseErr, context)
    case binding.errc_analytics.dataverse_exists:
      return new errs.DataverseExistsError(baseErr, context)
    case binding.errc_analytics.link_not_found:
      return new errs.LinkNotFoundError(baseErr, context)
    case binding.errc_analytics.link_exists:
      return new errs.LinkExistsError(baseErr, context)

    case binding.errc_search.index_not_ready:
      return new errs.IndexNotReadyError(baseErr, context)
    case binding.errc_search.consistency_mismatch:
      // These error types are converted into generic ones instead.
      break

    case binding.errc_view.view_not_found:
      return new errs.ViewNotFoundError(baseErr, context)
    case binding.errc_view.design_document_not_found:
      return new errs.DesignDocumentNotFoundError(baseErr, context)

    case binding.errc_management.collection_exists:
      return new errs.CollectionExistsError(baseErr, context)
    case binding.errc_management.scope_exists:
      return new errs.ScopeExistsError(baseErr, context)
    case binding.errc_management.user_not_found:
      return new errs.UserNotFoundError(baseErr, context)
    case binding.errc_management.group_not_found:
      return new errs.GroupNotFoundError(baseErr, context)
    case binding.errc_management.bucket_exists:
      return new errs.BucketExistsError(baseErr, context)
    case binding.errc_management.user_exists:
      return new errs.UserExistsError(baseErr, context)
    case binding.errc_management.bucket_not_flushable:
      return new errs.BucketNotFlushableError(baseErr, context)
    case binding.errc_management.eventing_function_not_found:
      return new errs.EventingFunctionNotFoundError(baseErr, context)
    case binding.errc_management.eventing_function_not_deployed:
      return new errs.EventingFunctionNotDeployedError(baseErr, context)
    case binding.errc_management.eventing_function_compilation_failure:
      return new errs.EventingFunctionCompilationFailureError(baseErr, context)
    case binding.errc_management.eventing_function_identical_keyspace:
      return new errs.EventingFunctionIdenticalKeyspaceError(baseErr, context)
    case binding.errc_management.eventing_function_not_bootstrapped:
      return new errs.EventingFunctionNotBootstrappedError(baseErr, context)
    case binding.errc_management.eventing_function_deployed:
      return new errs.EventingFunctionDeployedError(baseErr, context)
    case binding.errc_management.eventing_function_paused:
      return new errs.EventingFunctionPausedError(baseErr, context)
  }

  return baseErr
}

/**
 * @internal
 */
export function scanTypeToCpp(
  scanType: RangeScan | SamplingScan | PrefixScan
): CppRangeScan | CppSamplingScan | CppPrefixScan {
  if (scanType instanceof RangeScan) {
    return {
      from:
        scanType.start !== undefined
          ? {
              term: scanType.start.term,
              exclusive: scanType.start?.exclusive ?? false,
            }
          : undefined,
      to:
        scanType.end !== undefined
          ? {
              term: scanType.end.term,
              exclusive: scanType.end?.exclusive ?? false,
            }
          : undefined,
    }
  } else if (scanType instanceof SamplingScan) {
    return {
      limit: scanType.limit,
      seed: scanType.seed,
    }
  } else {
    return {
      prefix: scanType.prefix,
    }
  }
}

/**
 * @internal
 */
export function bucketTypeToCpp(
  type: BucketType | string | undefined
): CppManagementClusterBucketType {
  if (type === null || type === undefined) {
    return binding.management_cluster_bucket_type.couchbase
  }

  if (type === BucketType.Couchbase) {
    return binding.management_cluster_bucket_type.couchbase
  } else if (type === BucketType.Ephemeral) {
    return binding.management_cluster_bucket_type.ephemeral
  } else if (type === BucketType.Memcached) {
    return binding.management_cluster_bucket_type.memcached
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function bucketTypeFromCpp(
  type: CppManagementClusterBucketType
): BucketType | undefined {
  if (type === binding.management_cluster_bucket_type.couchbase) {
    return BucketType.Couchbase
  } else if (type === binding.management_cluster_bucket_type.ephemeral) {
    return BucketType.Ephemeral
  } else if (type === binding.management_cluster_bucket_type.memcached) {
    return BucketType.Memcached
  } else if (type === binding.management_cluster_bucket_type.unknown) {
    return undefined
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function bucketCompressionModeToCpp(
  mode: CompressionMode | string | undefined
): CppManagementClusterBucketCompression {
  if (mode === null || mode === undefined) {
    return binding.management_cluster_bucket_compression.unknown
  }

  if (mode === CompressionMode.Active) {
    return binding.management_cluster_bucket_compression.active
  } else if (mode === CompressionMode.Passive) {
    return binding.management_cluster_bucket_compression.passive
  } else if (mode === CompressionMode.Off) {
    return binding.management_cluster_bucket_compression.off
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function bucketCompressionModeFromCpp(
  mode: CppManagementClusterBucketCompression
): CompressionMode | undefined {
  if (mode === binding.management_cluster_bucket_compression.active) {
    return CompressionMode.Active
  } else if (mode === binding.management_cluster_bucket_compression.passive) {
    return CompressionMode.Passive
  } else if (mode === binding.management_cluster_bucket_compression.off) {
    return CompressionMode.Off
  } else if (mode === binding.management_cluster_bucket_compression.unknown) {
    return undefined
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function bucketEvictionPolicyToCpp(
  policy: EvictionPolicy | string | undefined
): CppManagementClusterBucketEvictionPolicy {
  if (policy === null || policy === undefined) {
    return binding.management_cluster_bucket_eviction_policy.unknown
  }

  if (policy === EvictionPolicy.FullEviction) {
    return binding.management_cluster_bucket_eviction_policy.full
  } else if (policy === EvictionPolicy.ValueOnly) {
    return binding.management_cluster_bucket_eviction_policy.value_only
  } else if (policy === EvictionPolicy.NotRecentlyUsed) {
    return binding.management_cluster_bucket_eviction_policy.not_recently_used
  } else if (policy === EvictionPolicy.NoEviction) {
    return binding.management_cluster_bucket_eviction_policy.no_eviction
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function bucketEvictionPolicyFromCpp(
  policy: CppManagementClusterBucketEvictionPolicy
): EvictionPolicy | undefined {
  if (policy === binding.management_cluster_bucket_eviction_policy.full) {
    return EvictionPolicy.FullEviction
  } else if (
    policy === binding.management_cluster_bucket_eviction_policy.value_only
  ) {
    return EvictionPolicy.ValueOnly
  } else if (
    policy ===
    binding.management_cluster_bucket_eviction_policy.not_recently_used
  ) {
    return EvictionPolicy.NotRecentlyUsed
  } else if (
    policy === binding.management_cluster_bucket_eviction_policy.no_eviction
  ) {
    return EvictionPolicy.NoEviction
  } else if (
    policy === binding.management_cluster_bucket_eviction_policy.unknown
  ) {
    return undefined
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function bucketStorageBackendToCpp(
  backend: StorageBackend | string | undefined
): CppManagementClusterBucketStorageBackend {
  if (backend === null || backend === undefined) {
    return binding.management_cluster_bucket_storage_backend.unknown
  }

  if (backend === StorageBackend.Couchstore) {
    return binding.management_cluster_bucket_storage_backend.couchstore
  } else if (backend === StorageBackend.Magma) {
    return binding.management_cluster_bucket_storage_backend.magma
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function bucketStorageBackendFromCpp(
  backend: CppManagementClusterBucketStorageBackend
): StorageBackend | undefined {
  if (
    backend === binding.management_cluster_bucket_storage_backend.couchstore
  ) {
    return StorageBackend.Couchstore
  } else if (
    backend === binding.management_cluster_bucket_storage_backend.magma
  ) {
    return StorageBackend.Magma
  } else if (
    backend === binding.management_cluster_bucket_storage_backend.unknown
  ) {
    return undefined
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function bucketConflictResolutionTypeToCpp(
  type: ConflictResolutionType | string | undefined
): CppManagementClusterBucketConflictResolution {
  if (type === null || type === undefined) {
    return binding.management_cluster_bucket_conflict_resolution.unknown
  }

  if (type === ConflictResolutionType.SequenceNumber) {
    return binding.management_cluster_bucket_conflict_resolution.sequence_number
  } else if (type === ConflictResolutionType.Timestamp) {
    return binding.management_cluster_bucket_conflict_resolution.timestamp
  } else if (type === ConflictResolutionType.Custom) {
    return binding.management_cluster_bucket_conflict_resolution.custom
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function bucketConflictResolutionTypeFromCpp(
  type: CppManagementClusterBucketConflictResolution
): ConflictResolutionType | undefined {
  if (
    type ===
    binding.management_cluster_bucket_conflict_resolution.sequence_number
  ) {
    return ConflictResolutionType.SequenceNumber
  } else if (
    type === binding.management_cluster_bucket_conflict_resolution.timestamp
  ) {
    return ConflictResolutionType.Timestamp
  } else if (
    type === binding.management_cluster_bucket_conflict_resolution.custom
  ) {
    return ConflictResolutionType.Custom
  } else if (
    type === binding.management_cluster_bucket_conflict_resolution.unknown
  ) {
    return undefined
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function vectorQueryCombinationToCpp(
  combination: VectorQueryCombination | undefined
): CppVectorQueryCombination {
  if (combination === VectorQueryCombination.AND) {
    return binding.vector_query_combination.combination_and
  } else if (combination === VectorQueryCombination.OR) {
    return binding.vector_query_combination.combination_or
  }

  throw new errs.InvalidArgumentError(
    new Error('Unrecognized VectorQueryCombination.')
  )
}

/**
 * @internal
 */
export function designDocumentNamespaceFromCpp(
  namespace: CppDesignDocumentNamespace
): DesignDocumentNamespace {
  if (namespace === binding.design_document_namespace.production) {
    return DesignDocumentNamespace.Production
  } else if (namespace === binding.design_document_namespace.development) {
    return DesignDocumentNamespace.Development
  }

  throw new errs.InvalidArgumentError(
    new Error('Unrecognized DesignDocumentNamespace.')
  )
}

/**
 * @internal
 */
export function designDocumentNamespaceToCpp(
  namespace: DesignDocumentNamespace
): CppDesignDocumentNamespace {
  if (namespace === DesignDocumentNamespace.Production) {
    return binding.design_document_namespace.production
  } else if (namespace === DesignDocumentNamespace.Development) {
    return binding.design_document_namespace.development
  }

  throw new errs.InvalidArgumentError(
    new Error('Unrecognized DesignDocumentNamespace.')
  )
}

/**
 * @internal
 */
export function transactionKeyspaceToCpp(
  keyspace?: TransactionKeyspace
): CppTransactionKeyspace | undefined {
  if (!keyspace) return undefined

  return {
    bucket_name: keyspace.bucket,
    scope_name: keyspace.scope ?? '_default',
    collection_name: keyspace.collection ?? '_default',
  }
}

/**
 * @internal
 */
export function eventingBucketBindingAccessToCpp(
  access: EventingFunctionBucketAccess
): CppManagementEventingFunctionBucketAccess {
  if (access === EventingFunctionBucketAccess.ReadOnly) {
    return binding.management_eventing_function_bucket_access.read_only
  }

  if (access === EventingFunctionBucketAccess.ReadWrite) {
    return binding.management_eventing_function_bucket_access.read_write
  }

  throw new errs.InvalidArgumentError(
    new Error('Unrecognized EventingFunctionBucketAccess')
  )
}

/**
 * @internal
 */
export function eventingBucketBindingAccessFromCpp(
  access: CppManagementEventingFunctionBucketAccess
): EventingFunctionBucketAccess {
  if (access === binding.management_eventing_function_bucket_access.read_only) {
    return EventingFunctionBucketAccess.ReadOnly
  }
  if (
    access === binding.management_eventing_function_bucket_access.read_write
  ) {
    return EventingFunctionBucketAccess.ReadWrite
  }

  throw new errs.InvalidArgumentError(
    new Error('Unrecognized EventingFunctionBucketAccess')
  )
}

/**
 * @internal
 */
export function eventingFunctionDcpBoundaryToCpp(
  boundary: EventingFunctionDcpBoundary | undefined
): CppManagementEventingFunctionDcpBoundary | undefined {
  if (!boundary) return undefined

  if (boundary === EventingFunctionDcpBoundary.Everything) {
    return binding.management_eventing_function_dcp_boundary.everything
  }

  if (boundary === EventingFunctionDcpBoundary.FromNow) {
    return binding.management_eventing_function_dcp_boundary.from_now
  }

  throw new errs.InvalidArgumentError(
    new Error('Unrecognized EventingFunctionDcpBoundary')
  )
}

/**
 * @internal
 */
export function eventingFunctionDcpBoundaryFromCpp(
  boundary: CppManagementEventingFunctionDcpBoundary | undefined
): EventingFunctionDcpBoundary | undefined {
  if (!boundary) return undefined

  if (
    boundary === binding.management_eventing_function_dcp_boundary.everything
  ) {
    return EventingFunctionDcpBoundary.Everything
  }

  if (boundary === binding.management_eventing_function_dcp_boundary.from_now) {
    return EventingFunctionDcpBoundary.FromNow
  }

  throw new errs.InvalidArgumentError(
    new Error('Unrecognized EventingFunctionDcpBoundary')
  )
}

/**
 * @internal
 */
export function eventingFunctionDeploymentStatusToCpp(
  status: EventingFunctionDeploymentStatus | undefined
): CppManagementEventingFunctionDeploymentStatus | undefined {
  if (!status) return undefined

  if (status === EventingFunctionDeploymentStatus.Deployed) {
    return binding.management_eventing_function_deployment_status.deployed
  }

  if (status === EventingFunctionDeploymentStatus.Undeployed) {
    return binding.management_eventing_function_deployment_status.undeployed
  }

  throw new errs.InvalidArgumentError(
    new Error('Unrecognized EventingFunctionDeploymentStatus')
  )
}

/**
 * @internal
 */
export function eventingFunctionDeploymentStatusFromCpp(
  status: CppManagementEventingFunctionDeploymentStatus | undefined
): EventingFunctionDeploymentStatus | undefined {
  if (!status) return undefined

  if (
    status === binding.management_eventing_function_deployment_status.deployed
  ) {
    return EventingFunctionDeploymentStatus.Deployed
  }

  if (
    status === binding.management_eventing_function_deployment_status.undeployed
  ) {
    return EventingFunctionDeploymentStatus.Undeployed
  }

  throw new errs.InvalidArgumentError(
    new Error('Unrecognized EventingFunctionDeploymentStatus')
  )
}

/**
 * @internal
 */
export function eventingFunctionProcessingStatusToCpp(
  status: EventingFunctionProcessingStatus | undefined
): CppManagementEventingFunctionProcessingStatus | undefined {
  if (!status) return undefined

  if (status === EventingFunctionProcessingStatus.Running) {
    return binding.management_eventing_function_processing_status.running
  }

  if (status === EventingFunctionProcessingStatus.Paused) {
    return binding.management_eventing_function_processing_status.paused
  }

  throw new errs.InvalidArgumentError(
    new Error('Unrecognized EventingFunctionProcessingStatus')
  )
}

/**
 * @internal
 */
export function eventingFunctionProcessingStatusFromCpp(
  status: CppManagementEventingFunctionProcessingStatus | undefined
): EventingFunctionProcessingStatus | undefined {
  if (!status) return undefined

  if (
    status === binding.management_eventing_function_processing_status.running
  ) {
    return EventingFunctionProcessingStatus.Running
  }

  if (
    status === binding.management_eventing_function_processing_status.paused
  ) {
    return EventingFunctionProcessingStatus.Paused
  }

  throw new errs.InvalidArgumentError(
    new Error('Unrecognized EventingFunctionProcessingStatus')
  )
}

/**
 * @internal
 */
export function eventingFunctionLogLevelToCpp(
  level: EventingFunctionLogLevel | undefined
): CppManagementEventingFunctionLogLevel | undefined {
  if (!level) return undefined

  if (level === EventingFunctionLogLevel.Debug) {
    return binding.management_eventing_function_log_level.debug
  }

  if (level === EventingFunctionLogLevel.Error) {
    return binding.management_eventing_function_log_level.error
  }

  if (level === EventingFunctionLogLevel.Info) {
    return binding.management_eventing_function_log_level.info
  }

  if (level === EventingFunctionLogLevel.Trace) {
    return binding.management_eventing_function_log_level.trace
  }

  if (level === EventingFunctionLogLevel.Warning) {
    return binding.management_eventing_function_log_level.warning
  }

  throw new errs.InvalidArgumentError(
    new Error('Unrecognized EventingFunctionLogLevel')
  )
}

/**
 * @internal
 */
export function eventingFunctionLogLevelFromCpp(
  level: CppManagementEventingFunctionLogLevel | undefined
): EventingFunctionLogLevel | undefined {
  if (!level) return undefined

  if (level === binding.management_eventing_function_log_level.debug) {
    return EventingFunctionLogLevel.Debug
  }

  if (level === binding.management_eventing_function_log_level.error) {
    return EventingFunctionLogLevel.Error
  }

  if (level === binding.management_eventing_function_log_level.info) {
    return EventingFunctionLogLevel.Info
  }

  if (level === binding.management_eventing_function_log_level.trace) {
    return EventingFunctionLogLevel.Trace
  }

  if (level === binding.management_eventing_function_log_level.warning) {
    return EventingFunctionLogLevel.Warning
  }

  throw new errs.InvalidArgumentError(
    new Error('Unrecognized EventingFunctionLogLevel')
  )
}

/**
 * @internal
 */
export function eventingFunctionLanguageCompatibilityToCpp(
  compatibility: EventingFunctionLanguageCompatibility | undefined
): CppManagementEventingFunctionLanguageCompatibility | undefined {
  if (!compatibility) return undefined

  if (compatibility === EventingFunctionLanguageCompatibility.Version_6_0_0) {
    return binding.management_eventing_function_language_compatibility
      .version_6_0_0
  }

  if (compatibility === EventingFunctionLanguageCompatibility.Version_6_5_0) {
    return binding.management_eventing_function_language_compatibility
      .version_6_5_0
  }

  if (compatibility === EventingFunctionLanguageCompatibility.Version_6_6_2) {
    return binding.management_eventing_function_language_compatibility
      .version_6_6_2
  }

  if (compatibility === EventingFunctionLanguageCompatibility.Version_7_2_0) {
    return binding.management_eventing_function_language_compatibility
      .version_7_2_0
  }

  throw new errs.InvalidArgumentError(
    new Error('Unrecognized EventingFunctionLanguageCompatibility')
  )
}

/**
 * @internal
 */
export function eventingFunctionLanguageCompatibilityFromCpp(
  compatibility: CppManagementEventingFunctionLanguageCompatibility | undefined
): EventingFunctionLanguageCompatibility | undefined {
  if (!compatibility) return undefined

  if (
    compatibility ===
    binding.management_eventing_function_language_compatibility.version_6_0_0
  ) {
    return EventingFunctionLanguageCompatibility.Version_6_0_0
  }

  if (
    compatibility ===
    binding.management_eventing_function_language_compatibility.version_6_5_0
  ) {
    return EventingFunctionLanguageCompatibility.Version_6_5_0
  }

  if (
    compatibility ===
    binding.management_eventing_function_language_compatibility.version_6_6_2
  ) {
    return EventingFunctionLanguageCompatibility.Version_6_6_2
  }

  if (
    compatibility ===
    binding.management_eventing_function_language_compatibility.version_7_2_0
  ) {
    return EventingFunctionLanguageCompatibility.Version_7_2_0
  }

  throw new errs.InvalidArgumentError(
    new Error('Unrecognized EventingFunctionLanguageCompatibility')
  )
}

/**
 * @internal
 */
export function eventingFunctionStatusFromCpp(
  status: CppManagementEventingFunctionStatus
): EventingFunctionStatus {
  if (status === binding.management_eventing_function_status.undeployed) {
    return EventingFunctionStatus.Undeployed
  }
  if (status === binding.management_eventing_function_status.deploying) {
    return EventingFunctionStatus.Deploying
  }
  if (status === binding.management_eventing_function_status.deployed) {
    return EventingFunctionStatus.Deployed
  }
  if (status === binding.management_eventing_function_status.undeploying) {
    return EventingFunctionStatus.Undeploying
  }
  if (status === binding.management_eventing_function_status.paused) {
    return EventingFunctionStatus.Paused
  }
  if (status === binding.management_eventing_function_status.pausing) {
    return EventingFunctionStatus.Pausing
  }

  throw new errs.InvalidArgumentError(
    new Error('Unrecognized EventingFunctionStatus')
  )
}

/**
 * @internal
 */
export function couchbaseLinkEncryptionLevelFromCpp(
  level: CppManagementAnalyticsCouchbaseLinkEncryptionLevel
): AnalyticsEncryptionLevel {
  if (
    level === binding.management_analytics_couchbase_link_encryption_level.none
  ) {
    return AnalyticsEncryptionLevel.None
  }
  if (
    level === binding.management_analytics_couchbase_link_encryption_level.half
  ) {
    return AnalyticsEncryptionLevel.Half
  }
  if (
    level === binding.management_analytics_couchbase_link_encryption_level.full
  ) {
    return AnalyticsEncryptionLevel.Full
  }
  throw new errs.InvalidArgumentError(
    new Error('Unrecognized CppManagementAnalyticsCouchbaseLinkEncryptionLevel')
  )
}
/**
 * @internal
 */
export function encryptionLevelToCpp(
  level: AnalyticsEncryptionLevel
): CppManagementAnalyticsCouchbaseLinkEncryptionLevel {
  if (level === AnalyticsEncryptionLevel.None) {
    return binding.management_analytics_couchbase_link_encryption_level.none
  }
  if (level === AnalyticsEncryptionLevel.Half) {
    return binding.management_analytics_couchbase_link_encryption_level.half
  }
  if (level === AnalyticsEncryptionLevel.Full) {
    return binding.management_analytics_couchbase_link_encryption_level.full
  }
  throw new errs.InvalidArgumentError(
    new Error('Unrecognized AnalyticsEncryptionLevel')
  )
}
/**
 * @internal
 */
export function encryptionSettingsToCpp(
  settings?: CouchbaseAnalyticsEncryptionSettings
): CppManagementAnalyticsCouchbaseLinkEncryptionSettings {
  if (!settings) {
    return {
      level: binding.management_analytics_couchbase_link_encryption_level.none,
    }
  }
  return {
    level: encryptionLevelToCpp(settings.encryptionLevel),
    certificate: settings.certificate
      ? settings.certificate.toString()
      : undefined,
    client_certificate: settings.clientCertificate
      ? settings.clientCertificate.toString()
      : undefined,
    client_key: settings.clientKey ? settings.clientKey.toString() : undefined,
  }
}
/**
 * @internal
 */
export function encryptionSettingsFromCpp(
  settings: CppManagementAnalyticsCouchbaseLinkEncryptionSettings
): CouchbaseAnalyticsEncryptionSettings {
  return new CouchbaseAnalyticsEncryptionSettings({
    encryptionLevel: couchbaseLinkEncryptionLevelFromCpp(settings.level),
    certificate: settings.certificate
      ? Buffer.from(settings.certificate)
      : undefined,
    clientCertificate: settings.client_certificate
      ? Buffer.from(settings.client_certificate)
      : undefined,
    clientKey: undefined,
  })
}

/**
 * @internal
 */
export function authDomainToCpp(domain: string): CppManagementRbacAuthDomain {
  if (domain === 'unknown') {
    return binding.management_rbac_auth_domain.unknown
  }
  if (domain === 'local') {
    return binding.management_rbac_auth_domain.local
  }
  if (domain === 'external') {
    return binding.management_rbac_auth_domain.external
  }
  throw new errs.InvalidArgumentError(new Error('Unrecognized auth domain.'))
}

/**
 * @internal
 */
export function authDomainFromCpp(domain: CppManagementRbacAuthDomain): string {
  if (domain === binding.management_rbac_auth_domain.unknown) {
    return 'unknown'
  }
  if (domain === binding.management_rbac_auth_domain.local) {
    return 'local'
  }
  if (domain === binding.management_rbac_auth_domain.external) {
    return 'external'
  }
  throw new errs.InvalidArgumentError(
    new Error('Unrecognized CppManagementRbacAuthDomain.')
  )
}

/**
 * @internal
 */
export function readPreferenceToCpp(
  preference: ReadPreference | undefined
): CppReadPreference {
  // Unspecified is allowed, and means no preference.
  if (preference === null || preference === undefined) {
    return binding.read_preference.no_preference
  }

  if (preference === ReadPreference.NoPreference) {
    return binding.read_preference.no_preference
  } else if (preference === ReadPreference.SelectedServerGroup) {
    return binding.read_preference.selected_server_group
  }

  throw new errs.InvalidArgumentError(new Error('Unrecognized ReadPreference.'))
}
