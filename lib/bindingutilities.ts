import { AnalyticsScanConsistency } from './analyticstypes'
import binding, {
  CppAnalyticsScanConsistency,
  CppProtocolDurabilityLevel,
  CppDiagEndpointState,
  CppMutationState,
  CppMutationToken,
  CppDiagPingState,
  CppQueryProfileMode,
  CppQueryScanConsistency,
  CppSearchHighlightStyle,
  CppSearchScanConsistency,
  CppServiceType,
  CppProtocolMutateInRequestBodyStoreSemanticsType,
  CppTxnExternalException,
  CppViewScanConsistency,
  CppViewSortOrder,
} from './binding'
import { CppError } from './binding'
import { EndpointState, PingState } from './diagnosticstypes'
import { ErrorContext } from './errorcontexts'
import * as errctxs from './errorcontexts'
import * as errs from './errors'
import { DurabilityLevel, ServiceType, StoreSemantics } from './generaltypes'
import { MutationState } from './mutationstate'
import { QueryProfileMode, QueryScanConsistency } from './querytypes'
import { SearchScanConsistency, HighlightStyle } from './searchtypes'
import { ViewOrdering, ViewScanConsistency } from './viewtypes'

/**
 * @internal
 */
export function durabilityToCpp(
  mode: DurabilityLevel | undefined
): CppProtocolDurabilityLevel {
  // Unspecified is allowed, and means no sync durability.
  if (mode === null || mode === undefined) {
    return binding.protocol_durability_level.none
  }

  if (mode === DurabilityLevel.None) {
    return binding.protocol_durability_level.none
  } else if (mode === DurabilityLevel.Majority) {
    return binding.protocol_durability_level.majority
  } else if (mode === DurabilityLevel.MajorityAndPersistOnMaster) {
    return binding.protocol_durability_level.majority_and_persist_to_active
  } else if (mode === DurabilityLevel.PersistToMajority) {
    return binding.protocol_durability_level.persist_to_majority
  }

  throw new errs.InvalidDurabilityLevel()
}

/**
 * @internal
 */
export function storeSemanticToCpp(
  mode: StoreSemantics | undefined
): CppProtocolMutateInRequestBodyStoreSemanticsType {
  if (mode === null || mode === undefined) {
    return binding.protocol_mutate_in_request_body_store_semantics_type.replace
  }

  if (mode === StoreSemantics.Insert) {
    return binding.protocol_mutate_in_request_body_store_semantics_type.insert
  } else if (mode === StoreSemantics.Upsert) {
    return binding.protocol_mutate_in_request_body_store_semantics_type.upsert
  } else if (mode === StoreSemantics.Replace) {
    return binding.protocol_mutate_in_request_body_store_semantics_type.replace
  }

  throw new errs.InvalidArgumentError()
}

/**
 * @internal
 */
export function viewScanConsistencyToCpp(
  mode: ViewScanConsistency | undefined
): CppViewScanConsistency {
  // Unspecified is allowed, and means no sync durability.
  if (mode === null || mode === undefined) {
    return binding.view_scan_consistency.not_bounded
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
): CppQueryScanConsistency {
  // Unspecified is allowed, and means no sync durability.
  if (mode === null || mode === undefined) {
    return binding.query_scan_consistency.not_bounded
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
export function queryProfileModeToCpp(
  mode: QueryProfileMode | undefined
): CppQueryProfileMode {
  // Unspecified is allowed, and means no sync durability.
  if (mode === null || mode === undefined) {
    return binding.query_profile_mode.off
  }

  if (mode === QueryProfileMode.Off) {
    return binding.query_profile_mode.off
  } else if (mode === QueryProfileMode.Phases) {
    return binding.query_profile_mode.phases
  } else if (mode === QueryProfileMode.Timings) {
    return binding.query_profile_mode.timings
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
export function searchScanConsistencyToCpp(
  mode: SearchScanConsistency | undefined
): CppSearchScanConsistency {
  // Unspecified is allowed, and means no sync durability.
  if (mode === null || mode === undefined) {
    return binding.search_scan_consistency.not_bounded
  }

  if (mode === SearchScanConsistency.NotBounded) {
    return binding.search_scan_consistency.not_bounded
    throw new errs.InvalidArgumentError()
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
    return []
  }

  const tokens: CppMutationToken[] = []
  for (const bucketName in state._data) {
    for (const vbId in state._data[bucketName]) {
      const token = state._data[bucketName][vbId]
      tokens.push(token)
    }
  }

  return tokens
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
export function txnExternalExeptionFromCpp(
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
  }

  throw new errs.InvalidArgumentError()
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
      new Error(txnExternalExeptionFromCpp(err.cause))
    )
  } else if (err.ctxtype === 'transaction_exception') {
    if (err.type === binding.txn_failure_type.fail) {
      return new errs.TransactionFailedError(
        new Error(txnExternalExeptionFromCpp(err.cause))
      )
    } else if (err.type === binding.txn_failure_type.expiry) {
      return new errs.TransactionExpiredError(
        new Error(txnExternalExeptionFromCpp(err.cause))
      )
    } else if (err.type === binding.txn_failure_type.commit_ambiguous) {
      return new errs.TransactionCommitAmbiguousError(
        new Error(txnExternalExeptionFromCpp(err.cause))
      )
    }

    throw new errs.InvalidArgumentError()
  }

  const baseErr = err as any as Error
  const contextOrNull = contextFromCpp(err)
  const context = contextOrNull ? contextOrNull : undefined

  switch (err.code) {
    case binding.error_common_errc.request_canceled:
      return new errs.RequestCanceledError(baseErr, context)
    case binding.error_common_errc.invalid_argument:
      return new errs.InvalidArgumentError(baseErr, context)
    case binding.error_common_errc.service_not_available:
      return new errs.ServiceNotAvailableError(baseErr, context)
    case binding.error_common_errc.internal_server_failure:
      return new errs.InternalServerFailureError(baseErr, context)
    case binding.error_common_errc.authentication_failure:
      return new errs.AuthenticationFailureError(baseErr, context)
    case binding.error_common_errc.temporary_failure:
      return new errs.TemporaryFailureError(baseErr, context)
    case binding.error_common_errc.parsing_failure:
      return new errs.ParsingFailureError(baseErr, context)
    case binding.error_common_errc.cas_mismatch:
      return new errs.CasMismatchError(baseErr, context)
    case binding.error_common_errc.bucket_not_found:
      return new errs.BucketNotFoundError(baseErr, context)
    case binding.error_common_errc.collection_not_found:
      return new errs.CollectionNotFoundError(baseErr, context)
    case binding.error_common_errc.unsupported_operation:
      return new errs.UnsupportedOperationError(baseErr, context)
    case binding.error_common_errc.unambiguous_timeout:
      return new errs.UnambiguousTimeoutError(baseErr, context)
    case binding.error_common_errc.ambiguous_timeout:
      return new errs.AmbiguousTimeoutError(baseErr, context)
    case binding.error_common_errc.feature_not_available:
      return new errs.FeatureNotAvailableError(baseErr, context)
    case binding.error_common_errc.scope_not_found:
      return new errs.ScopeNotFoundError(baseErr, context)
    case binding.error_common_errc.index_not_found:
      return new errs.IndexNotFoundError(baseErr, context)
    case binding.error_common_errc.index_exists:
      return new errs.IndexExistsError(baseErr, context)
    case binding.error_common_errc.decoding_failure:
      return new errs.DecodingFailureError(baseErr, context)
    case binding.error_common_errc.rate_limited:
      return new errs.RateLimitedError(baseErr, context)
    case binding.error_common_errc.quota_limited:
      return new errs.QuotaLimitedError(baseErr, context)

    case binding.error_key_value_errc.document_not_found:
      return new errs.DocumentNotFoundError(baseErr, context)
    case binding.error_key_value_errc.document_irretrievable:
      return new errs.DocumentUnretrievableError(baseErr, context)
    case binding.error_key_value_errc.document_locked:
      return new errs.DocumentLockedError(baseErr, context)
    case binding.error_key_value_errc.value_too_large:
      return new errs.ValueTooLargeError(baseErr, context)
    case binding.error_key_value_errc.document_exists:
      return new errs.DocumentExistsError(baseErr, context)
    case binding.error_key_value_errc.durability_level_not_available:
      return new errs.DurabilityLevelNotAvailableError(baseErr, context)
    case binding.error_key_value_errc.durability_impossible:
      return new errs.DurabilityImpossibleError(baseErr, context)
    case binding.error_key_value_errc.durability_ambiguous:
      return new errs.DurabilityAmbiguousError(baseErr, context)
    case binding.error_key_value_errc.durable_write_in_progress:
      return new errs.DurableWriteInProgressError(baseErr, context)
    case binding.error_key_value_errc.durable_write_re_commit_in_progress:
      return new errs.DurableWriteReCommitInProgressError(baseErr, context)
    case binding.error_key_value_errc.path_not_found:
      return new errs.PathNotFoundError(baseErr, context)
    case binding.error_key_value_errc.path_mismatch:
      return new errs.PathMismatchError(baseErr, context)
    case binding.error_key_value_errc.path_invalid:
      return new errs.PathInvalidError(baseErr, context)
    case binding.error_key_value_errc.path_too_big:
      return new errs.PathTooBigError(baseErr, context)
    case binding.error_key_value_errc.path_too_deep:
      return new errs.PathTooDeepError(baseErr, context)
    case binding.error_key_value_errc.value_too_deep:
      return new errs.ValueTooDeepError(baseErr, context)
    case binding.error_key_value_errc.value_invalid:
      return new errs.ValueInvalidError(baseErr, context)
    case binding.error_key_value_errc.document_not_json:
      return new errs.DocumentNotJsonError(baseErr, context)
    case binding.error_key_value_errc.number_too_big:
      return new errs.NumberTooBigError(baseErr, context)
    case binding.error_key_value_errc.delta_invalid:
      return new errs.DeltaInvalidError(baseErr, context)
    case binding.error_key_value_errc.path_exists:
      return new errs.PathExistsError(baseErr, context)
    case binding.error_key_value_errc.xattr_unknown_macro:
    case binding.error_key_value_errc.xattr_invalid_key_combo:
    case binding.error_key_value_errc.xattr_unknown_virtual_attribute:
    case binding.error_key_value_errc.xattr_cannot_modify_virtual_attribute:
    case binding.error_key_value_errc.xattr_no_access:
    case binding.error_key_value_errc.cannot_revive_living_document:
      // These error types are converted into generic ones instead.
      break

    case binding.error_query_errc.planning_failure:
      return new errs.PlanningFailureError(baseErr, context)
    case binding.error_query_errc.index_failure:
      return new errs.IndexFailureError(baseErr, context)
    case binding.error_query_errc.prepared_statement_failure:
      return new errs.PreparedStatementFailureError(baseErr, context)
    case binding.error_query_errc.dml_failure:
      return new errs.DmlFailureError(baseErr, context)

    case binding.error_analytics_errc.compilation_failure:
      return new errs.CompilationFailureError(baseErr, context)
    case binding.error_analytics_errc.job_queue_full:
      return new errs.JobQueueFullError(baseErr, context)
    case binding.error_analytics_errc.dataset_not_found:
      return new errs.DatasetNotFoundError(baseErr, context)
    case binding.error_analytics_errc.dataverse_not_found:
      return new errs.DataverseNotFoundError(baseErr, context)
    case binding.error_analytics_errc.dataset_exists:
      return new errs.DatasetExistsError(baseErr, context)
    case binding.error_analytics_errc.dataverse_exists:
      return new errs.DataverseExistsError(baseErr, context)
    case binding.error_analytics_errc.link_not_found:
      return new errs.LinkNotFoundError(baseErr, context)
    case binding.error_analytics_errc.link_exists:
      return new errs.LinkExistsError(baseErr, context)

    case binding.error_search_errc.index_not_ready:
      return new errs.IndexNotReadyError(baseErr, context)
    case binding.error_search_errc.consistency_mismatch:
      // These error types are converted into generic ones instead.
      break

    case binding.error_view_errc.view_not_found:
      return new errs.ViewNotFoundError(baseErr, context)
    case binding.error_view_errc.design_document_not_found:
      return new errs.DesignDocumentNotFoundError(baseErr, context)

    case binding.error_management_errc.collection_exists:
      return new errs.CollectionExistsError(baseErr, context)
    case binding.error_management_errc.scope_exists:
      return new errs.ScopeExistsError(baseErr, context)
    case binding.error_management_errc.user_not_found:
      return new errs.UserNotFoundError(baseErr, context)
    case binding.error_management_errc.group_not_found:
      return new errs.GroupNotFoundError(baseErr, context)
    case binding.error_management_errc.bucket_exists:
      return new errs.BucketExistsError(baseErr, context)
    case binding.error_management_errc.user_exists:
      return new errs.UserExistsError(baseErr, context)
    case binding.error_management_errc.bucket_not_flushable:
      return new errs.BucketNotFlushableError(baseErr, context)
    case binding.error_management_errc.eventing_function_not_found:
      return new errs.EventingFunctionNotFoundError(baseErr, context)
    case binding.error_management_errc.eventing_function_not_deployed:
      return new errs.EventingFunctionNotDeployedError(baseErr, context)
    case binding.error_management_errc.eventing_function_compilation_failure:
      return new errs.EventingFunctionCompilationFailureError(baseErr, context)
    case binding.error_management_errc.eventing_function_identical_keyspace:
      return new errs.EventingFunctionIdenticalKeyspaceError(baseErr, context)
    case binding.error_management_errc.eventing_function_not_bootstrapped:
      return new errs.EventingFunctionNotBootstrappedError(baseErr, context)
    case binding.error_management_errc.eventing_function_deployed:
      return new errs.EventingFunctionDeployedError(baseErr, context)
    case binding.error_management_errc.eventing_function_paused:
      return new errs.EventingFunctionPausedError(baseErr, context)
  }

  return baseErr
}
