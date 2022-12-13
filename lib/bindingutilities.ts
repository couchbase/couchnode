import { AnalyticsScanConsistency, AnalyticsStatus } from './analyticstypes'
import binding, {
  CppAnalyticsScanConsistency,
  CppAnalyticsResponseAnalyticsStatus,
  CppDurabilityLevel,
  CppDiagEndpointState,
  CppMutationState,
  CppMutationToken,
  CppDiagPingState,
  CppQueryProfile,
  CppQueryScanConsistency,
  CppSearchHighlightStyle,
  CppSearchScanConsistency,
  CppServiceType,
  CppStoreSemantics,
  CppTxnExternalException,
  CppViewScanConsistency,
  CppViewSortOrder,
  CppPersistTo,
  CppReplicateTo,
  CppTxnOpException,
  CppRangeScan,
  CppSamplingScan,
  CppPrefixScan,
} from './binding'
import { CppError } from './binding'
import { EndpointState, PingState } from './diagnosticstypes'
import { ErrorContext } from './errorcontexts'
import * as errctxs from './errorcontexts'
import * as errs from './errors'
import { DurabilityLevel, ServiceType, StoreSemantics } from './generaltypes'
import { MutationState } from './mutationstate'
import { QueryProfileMode, QueryScanConsistency } from './querytypes'
import { RangeScan, SamplingScan, PrefixScan } from './rangeScan'
import { SearchScanConsistency, HighlightStyle } from './searchtypes'
import { ViewOrdering, ViewScanConsistency } from './viewtypes'

/**
 * @internal
 */
export function durabilityToCpp(
  mode: DurabilityLevel | undefined
): CppDurabilityLevel {
  // Unspecified is allowed, and means no sync durability.
  if (mode === null || mode === undefined) {
    return binding.durability_level.none
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
  mode: ViewOrdering | undefined
): CppViewSortOrder | undefined {
  // Unspecified is allowed, and means no sync durability.
  if (mode === null || mode === undefined) {
    return undefined
  }

  if (mode === ViewOrdering.Ascending) {
    return binding.view_sort_order.ascending
  } else if (mode === ViewOrdering.Descending) {
    return binding.view_sort_order.descending
  }

  throw new errs.InvalidArgumentError()
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
export function errorFromCpp(err: CppError | null): Error | null {
  if (!err) {
    return null
  }

  // BUG(JSCBC-1010): We shouldn't need to special case these.
  if (err.ctxtype === 'transaction_operation_failed') {
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
