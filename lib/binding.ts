/* eslint jsdoc/require-jsdoc: off */
import bindings from 'bindings'

export type CppMilliseconds = number
export type CppSeconds = number
export type CppBytes = string | Buffer
export type CppDocFlags = number
export type CppExpiry = number
export type CppMutationState = CppMutationToken[]

// enums
export enum CppServiceType {}
export enum CppDurabilityLevel {}
export enum CppSubdocStoreSemanticsType {}
export enum CppSubdocOpcode {}
export enum CppStatus {}
export enum CppErrorCode {}
export enum CppRetryReason {}
export enum CppViewScanConsistency {}
export enum CppViewNamespace {}
export enum CppViewSortOrder {}
export enum CppQueryScanConsistency {}
export enum CppQueryProfileMode {}
export enum CppAnalyticsScanConsistency {}
export enum CppSearchScanConsistency {}
export enum CppSearchHighlightStyle {}
export enum CppEndpointState {}
export enum CppPingState {}
export enum CppTxnFailureType {}
export enum CppTxnExternalException {}

// flags
export type CppLookupInPathFlag = number
export type CppMutateInPathFlag = number

// interfaces
export interface CppTranscoder {
  encode(value: any): [Buffer, number]
  decode(bytes: Buffer, flags: number): any
}
export interface CppCas {
  toString(): string
  toJSON(): any
}
export interface CppMutationToken {
  toString(): string
  toJSON(): any
}

export interface CppLookupInEntry {
  opcode: CppSubdocOpcode
  flags: CppLookupInPathFlag
  path: string
}
export interface CppLookupInResultEntry {
  error: CppError
  opcode: CppSubdocOpcode
  exists: boolean
  status: CppStatus
  path: string
  value: any
  original_index: number
}
export interface CppMutateInEntry {
  opcode: CppSubdocOpcode
  flags: CppMutateInPathFlag
  path: string
  param: Buffer
}
export interface CppMutateInResultEntry {
  error: CppError
  opcode: CppSubdocOpcode
  status: CppStatus
  path: string
  value: any
  original_index: number
}

export interface CppErrorBase extends Error {
  code: CppErrorCode
}

export interface CppGenericError extends CppErrorBase {
  ctxtype: undefined | null
}

export interface CppEnhancedErrorInfo {
  reference: string
  context: string
}

export interface CppKeyValueError extends CppErrorBase {
  ctxtype: 'key_value'
  id: CppDocumentId
  opaque: number
  cas: CppCas
  status_code: CppStatus
  enhanced_error_info: CppEnhancedErrorInfo
  last_dispatched_to: string
  last_dispatched_from: string
  retry_attempts: number
  retry_reasons: CppRetryReason[]
}

export interface CppViewError extends CppErrorBase {
  ctxtype: 'view'
  client_context_id: string
  design_document_name: string
  view_name: string
  query_string: string
  method: string
  path: string
  http_status: number
  http_body: string
  last_dispatched_to: string
  last_dispatched_from: string
  retry_attempts: number
  retry_reasons: CppRetryReason[]
}

export interface CppQueryError extends CppErrorBase {
  ctxtype: 'query'
  first_error_code: number
  first_error_message: string
  client_context_id: string
  statement: string
  parameters: string
  method: string
  path: string
  http_status: number
  http_body: string
  last_dispatched_to: string
  last_dispatched_from: string
  retry_attempts: number
  retry_reasons: CppRetryReason[]
}

export interface CppSearchError extends CppErrorBase {
  ctxtype: 'search'
  client_context_id: string
  index_name: string
  query: string
  parameters: string
  method: string
  path: string
  http_status: number
  http_body: string
  last_dispatched_to: string
  last_dispatched_from: string
  retry_attempts: number
  retry_reasons: CppRetryReason[]
}

export interface CppAnalyticsError extends CppErrorBase {
  ctxtype: 'analytics'
  first_error_code: number
  first_error_message: string
  client_context_id: string
  statement: string
  parameters: string
  method: string
  path: string
  http_status: number
  http_body: string
  last_dispatched_to: string
  last_dispatched_from: string
  retry_attempts: number
  retry_reasons: CppRetryReason[]
}

export interface CppHttpError extends CppErrorBase {
  ctxtype: 'http'
  client_context_id: string
  method: string
  path: string
  http_status: number
  http_body: string
  last_dispatched_to: string
  last_dispatched_from: string
  retry_attempts: number
  retry_reasons: CppRetryReason[]
}

export interface CppTxnOperationFailed extends CppErrorBase {
  ctxtype: 'transaction_operation_failed'
  should_not_retry: boolean
  should_not_rollback: boolean
  cause: CppTxnExternalException
}

export interface CppTxnError extends CppErrorBase {
  ctxtype: 'transaction_exception'
  result: CppTransactionResult
  cause: CppTxnExternalException
  type: CppTxnFailureType
}

export type CppError =
  | CppGenericError
  | CppKeyValueError
  | CppViewError
  | CppQueryError
  | CppSearchError
  | CppAnalyticsError
  | CppHttpError
  | CppTxnOperationFailed
  | CppTxnError

export interface CppDocumentId {
  bucket: string
  scope: string
  collection: string
  key: string
}

export interface CppViewResult {
  meta: {
    total_rows?: number
    debug_info?: string
  }
  rows: {
    id?: string
    key: string
    value: string
  }[]
}

export interface CppQueryResult {
  meta: {
    request_id: string
    client_context_id: string
    status: string
    metrics: {
      elapsed_time: CppMilliseconds
      execution_time: CppMilliseconds
      result_count: number
      result_size: number
      sort_count: number
      mutation_count: number
      error_count: number
      warning_count: number
    }
    signature?: string
    profile?: string
    warnings: {
      code: number
      message: string
    }[]
  }
  prepared?: string
  rows: string[]
}

export interface CppAnalyticsResult {
  meta: {
    request_id: string
    client_context_id: string
    status: string
    metrics: {
      elapsed_time: CppMilliseconds
      execution_time: CppMilliseconds
      result_count: number
      result_size: number
      error_count: number
      processed_objects: number
      warning_count: number
    }
    signature?: string
    warnings: {
      code: number
      message: string
    }[]
  }
  rows: string[]
}

export interface CppSearchResult {
  status: string
  meta: {
    client_context_id: string
    metrics: {
      took: number
      max_score: number
      success_partition_count: number
      error_partition_count: number
    }
  }
  rows: {
    index: string
    id: string
    score: number
    locations: {
      field: string
      term: string
      position: number
      start_offset: number
      end_offset: number
      array_positions?: number[]
    }[]
    fragments: { [key: string]: string[] }
    fields: string[]
    explanation: string
  }[]
  facets: {
    name: string
    field: string
    total: number
    missing: number
    other: number
    terms: {
      term: string
      count: number
    }[]
    date_ranges: {
      name: string
      count: number
      start: string
      end: string
    }[]
    numeric_ranges: {
      name: string
      count: number
      min?: number
      max?: number
    }[]
  }[]
}

export interface CppConnection {
  connect(
    connStr: string,
    credentials: {
      username?: string
      password?: string
      certificate_path?: string
      key_path?: string
      allowed_sasl_mechanisms?: string[]
    },
    callback: (err: CppError | null) => void
  ): void
  shutdown(callback: (err: CppError | null) => void): void

  openBucket(bucketName: string, callback: (err: CppError | null) => void): void

  get(
    options: {
      id: CppDocumentId
      transcoder?: CppTranscoder
      timeout?: CppMilliseconds
    },
    callback: (
      err: CppError | null,
      result: {
        cas: CppCas
        content: any
      }
    ) => void
  ): void

  exists(
    options: {
      id: CppDocumentId
      timeout?: CppMilliseconds
    },
    callback: (
      err: CppError | null,
      result: {
        deleted: boolean
        cas: CppCas
        flags: CppDocFlags
        expiry: CppExpiry
        sequence_number: number
        datatype: number
        exists: boolean
      }
    ) => void
  ): void

  getAndLock(
    options: {
      id: CppDocumentId
      lock_time: CppSeconds
      transcoder?: CppTranscoder
      timeout?: CppMilliseconds
    },
    callback: (
      err: CppError | null,
      result: {
        cas: CppCas
        content: any
      }
    ) => void
  ): void

  getAndTouch(
    options: {
      id: CppDocumentId
      expiry: CppExpiry
      transcoder?: CppTranscoder
      timeout?: CppMilliseconds
    },
    callback: (
      err: CppError | null,
      result: {
        cas: CppCas
        content: any
      }
    ) => void
  ): void

  insert(
    options: {
      id: CppDocumentId
      content: any
      transcoder: CppTranscoder
      expiry?: CppExpiry
      durability_level?: CppDurabilityLevel
      durability_timeout?: CppMilliseconds
      timeout?: CppMilliseconds
    },
    callback: (
      err: CppError | null,
      result: {
        cas: CppCas
        token: CppMutationToken
      }
    ) => void
  ): void

  upsert(
    options: {
      id: CppDocumentId
      content: any
      transcoder: CppTranscoder
      expiry?: CppExpiry
      durability_level?: CppDurabilityLevel
      durability_timeout?: CppMilliseconds
      timeout?: CppMilliseconds
      preserve_expiry?: boolean
    },
    callback: (
      err: CppError | null,
      result: {
        cas: CppCas
        token: CppMutationToken
      }
    ) => void
  ): void

  replace(
    options: {
      id: CppDocumentId
      content: any
      transcoder: CppTranscoder
      expiry: CppExpiry
      cas?: CppCas
      durability_level?: CppDurabilityLevel
      durability_timeout?: CppMilliseconds
      timeout?: CppMilliseconds
      preserve_expiry?: boolean
    },
    callback: (
      err: CppError | null,
      result: {
        cas: CppCas
        token: CppMutationToken
      }
    ) => void
  ): void

  remove(
    options: {
      id: CppDocumentId
      cas?: CppCas
      durability_level?: CppDurabilityLevel
      durability_timeout?: CppMilliseconds
      timeout?: CppMilliseconds
    },
    callback: (
      err: CppError | null,
      result: {
        cas: CppCas
        token: CppMutationToken
      }
    ) => void
  ): void

  touch(
    options: {
      id: CppDocumentId
      expiry?: CppExpiry
      timeout?: CppMilliseconds
    },
    callback: (
      err: CppError | null,
      result: {
        cas: CppCas
      }
    ) => void
  ): void

  unlock(
    options: {
      id: CppDocumentId
      cas: CppCas
      timeout?: CppMilliseconds
    },
    callback: (
      err: CppError | null,
      result: {
        cas: CppCas
      }
    ) => void
  ): void

  append(
    options: {
      id: CppDocumentId
      value: Buffer
      durability_level?: CppDurabilityLevel
      durability_timeout?: CppMilliseconds
      timeout?: CppMilliseconds
    },
    callback: (
      err: CppError | null,
      result: {
        cas: CppCas
        token: CppMutationToken
      }
    ) => void
  ): void

  prepend(
    options: {
      id: CppDocumentId
      value: Buffer
      durability_level?: CppDurabilityLevel
      durability_timeout?: CppMilliseconds
      timeout?: CppMilliseconds
    },
    callback: (
      err: CppError | null,
      result: {
        cas: CppCas
        token: CppMutationToken
      }
    ) => void
  ): void

  increment(
    options: {
      id: CppDocumentId
      delta: number
      expiry?: CppExpiry
      initial_value?: number
      durability_level?: CppDurabilityLevel
      durability_timeout?: CppMilliseconds
      timeout?: CppMilliseconds
    },
    callback: (
      err: CppError | null,
      result: {
        content: number
        cas: CppCas
        token: CppMutationToken
      }
    ) => void
  ): void

  decrement(
    options: {
      id: CppDocumentId
      delta: number
      expiry?: CppExpiry
      initial_value?: number
      durability_level?: CppDurabilityLevel
      durability_timeout?: CppMilliseconds
      timeout?: CppMilliseconds
    },
    callback: (
      err: CppError | null,
      result: {
        content: number
        cas: CppCas
        token: CppMutationToken
      }
    ) => void
  ): void

  lookupIn(
    options: {
      id: CppDocumentId
      specs: CppLookupInEntry[]
      access_deleted?: boolean
      transcoder?: CppTranscoder
      timeout?: CppMilliseconds
    },
    callback: (
      err: CppError | null,
      result: {
        cas: CppCas
        fields: CppLookupInResultEntry[]
        deleted: boolean
      }
    ) => void
  ): void

  mutateIn(
    options: {
      id: CppDocumentId
      specs: CppMutateInEntry[]
      store_semantics: CppSubdocStoreSemanticsType
      cas?: CppCas
      access_deleted?: boolean
      expiry?: CppExpiry
      durability_level?: CppDurabilityLevel
      durability_timeout?: CppMilliseconds
      timeout?: CppMilliseconds
      preserve_expiry?: boolean
    },
    callback: (
      err: CppError | null,
      result: {
        cas: CppCas
        token: CppMutationToken
        fields: CppMutateInResultEntry[]
        first_error_index: number
        deleted: boolean
      }
    ) => void
  ): void

  viewQuery(
    options: {
      client_context_id?: string
      timeout: CppMilliseconds
      bucket_name: string
      document_name: string
      view_name: string
      name_space: CppViewNamespace
      limit?: number
      skip?: number
      consistency?: CppViewScanConsistency
      keys?: string[]
      key?: string
      start_key?: string
      end_key?: string
      start_key_doc_id?: string
      end_key_doc_id?: string
      inclusive_end?: boolean
      reduce?: boolean
      group?: boolean
      group_level?: number
      debug?: boolean
      order?: CppViewSortOrder
      query_string?: string[]
    },
    callback: (err: CppError | null, result: CppViewResult) => void
  ): void

  query(
    options: {
      statement: string
      client_context_id?: string
      adhoc?: boolean
      metrics?: boolean
      readonly?: boolean
      flex_index?: boolean
      preserve_expiry?: boolean
      max_parallelism?: number
      scan_cap?: number
      scan_wait?: CppMilliseconds
      pipeline_batch?: number
      pipeline_cap?: number
      scan_consistency?: CppQueryScanConsistency
      mutation_state?: CppMutationState
      timeout: CppMilliseconds
      bucket_name?: string
      scope_name?: string
      scope_qualifier?: string
      profile?: CppQueryProfileMode
      raw?: { [key: string]: string }
      positional_parameters?: string[]
      named_parameters?: { [key: string]: string }
    },
    callback: (err: CppError | null, result: CppQueryResult) => void
  ): void

  analyticsQuery(
    options: {
      statement: string
      timeout: CppMilliseconds
      client_context_id?: string
      readonly?: boolean
      priority?: boolean
      bucket_name?: string
      scope_name?: string
      scope_qualifier?: string
      scan_consistency?: CppAnalyticsScanConsistency
      raw?: { [key: string]: string }
      positional_parameters?: string[]
      named_parameters?: { [key: string]: string }
    },
    callback: (err: CppError | null, result: CppAnalyticsResult) => void
  ): void

  searchQuery(
    options: {
      client_context_id?: string
      timeout: CppMilliseconds
      index_name: string
      query: any
      limit?: number
      skip?: number
      explain?: boolean
      disable_scoring?: boolean
      include_locations?: boolean
      highlight_style?: CppSearchHighlightStyle
      highlight_fields?: string[]
      fields?: string[]
      scope_name?: string
      collections?: string[]
      scan_consistency?: CppSearchScanConsistency
      mutation_state?: CppMutationState
      sort_specs?: string[]
      facets?: { [key: string]: string }
      raw?: { [key: string]: string }
    },
    callback: (err: CppError | null, result: CppSearchResult) => void
  ): void

  httpRequest(
    options: {
      type: CppServiceType
      method: string
      path: string
      headers: {
        [key: string]: string
      }
      body: string
      timeout: CppMilliseconds
      client_context_id?: string
    },
    callback: (
      err: CppError | null,
      result: {
        status: number
        headers: {
          [key: string]: string
        }
        body: string
      }
    ) => void
  ): void

  diagnostics(
    options: {
      report_id?: string
    },
    callback: (
      err: CppError | null,
      result: {
        version: number
        id: string
        sdk: string
        services: {
          [serviceType: number]: {
            type: CppServiceType
            id: string
            last_activity: number
            remote: string
            local: string
            state: CppEndpointState
            bucket?: string
            details?: string
          }[]
        }
      }
    ) => void
  ): void

  ping(
    options: {
      report_id?: string
      bucket_name?: string
      services?: CppServiceType[]
    },
    callback: (
      err: CppError | null,
      result: {
        version: number
        id: string
        sdk: string
        services: {
          [serviceType: number]: {
            type: CppServiceType
            id: string
            latency: number
            remote: string
            local: string
            state: CppPingState
            bucket?: string
            error?: string
          }[]
        }
      }
    ) => void
  ): void
}

export interface CppTransactionsConfig {
  durability_level?: CppDurabilityLevel
  kv_timeout?: CppMilliseconds
  expiration_time?: CppMilliseconds
  query_scan_consistency?: CppQueryScanConsistency
  cleanup_window?: CppMilliseconds
  cleanup_lost_attempts?: boolean
  cleanup_client_attempts?: boolean
}

export interface CppTransactionOptions {
  durability_level?: CppDurabilityLevel
  kv_timeout?: CppMilliseconds
  expiration_time?: CppMilliseconds
  query_scan_consistency?: CppQueryScanConsistency
}

export interface CppTransactionLinks {
  atr_id: string
  atr_bucket_name: string
  atr_scope_name: string
  atr_collection_name: string
  staged_transaction_id: string
  staged_attempt_id: string
  staged_content: string
  cas_pre_txn: string
  revid_pre_txn: string
  exptime_pre_txn: number
  crc32_of_staging: string
  op: string
  forward_compat: string
  is_deleted: boolean
}

export interface CppTransactionGetMetaData {
  cas: string
  revid: string
  exptime: number
  crc32: string
}

export interface CppTransactionGetResult {
  id: CppDocumentId
  cas: CppCas
  content: any
  links: CppTransactionLinks
  metadata: CppTransactionGetMetaData
}

export interface CppTransactionResult {
  transaction_id: string
  unstaging_complete: boolean
}

export interface CppTransactions {
  new (conn: CppConnection): any

  close(callback: (err: CppError | null) => void): void
}

export interface CppTransaction {
  newAttempt(callback: (err: CppError | null) => void): void

  get(
    options: {
      id: CppDocumentId
    },
    callback: (
      err: CppError | null,
      result: CppTransactionGetResult | null
    ) => void
  ): void

  insert(
    options: {
      id: CppDocumentId
      content: any
    },
    callback: (
      err: CppError | null,
      result: CppTransactionGetResult | null
    ) => void
  ): void

  replace(
    options: {
      doc: CppTransactionGetResult
      content: any
    },
    callback: (
      err: CppError | null,
      result: CppTransactionGetResult | null
    ) => void
  ): void

  remove(
    options: {
      doc: CppTransactionGetResult
    },
    callback: (err: CppError | null) => void
  ): void

  query(
    statement: string,
    options: {
      raw?: { [key: string]: string }
      ad_hoc?: boolean
      scan_consistency?: CppQueryScanConsistency
      profile?: CppQueryProfileMode
      metrics?: boolean
      client_context_id?: string
      scan_wait?: CppMilliseconds
      readonly?: boolean
      scan_cap?: number
      pipeline_batch?: number
      pipeline_cap?: number
      max_parallelism?: number
      positional_parameters?: string[]
      named_parameters?: { [key: string]: string }
      bucket_name?: string
      scope_name?: string
    },
    callback: (err: CppError | null, resp: CppQueryResult | null) => void
  ): void

  commit(
    callback: (err: CppError | null, resp: CppTransactionResult) => void
  ): void

  rollback(callback: (err: CppError | null) => void): void
}

export interface CppBinding {
  cbppVersion: string

  Connection: {
    new (): CppConnection
  }

  Transactions: {
    new (conn: CppConnection, config: CppTransactionsConfig): CppTransactions
  }

  Transaction: {
    new (txns: CppTransactions, options: CppTransactionOptions): CppTransaction
  }

  service_type: {
    key_value: CppServiceType
    query: CppServiceType
    analytics: CppServiceType
    search: CppServiceType
    view: CppServiceType
    management: CppServiceType
    eventing: CppServiceType
  }
  endpoint_state: {
    disconnected: CppEndpointState
    connecting: CppEndpointState
    connected: CppEndpointState
    disconnecting: CppEndpointState
  }
  ping_state: {
    ok: CppPingState
    timeout: CppPingState
    error: CppPingState
  }
  durability_level: {
    none: CppDurabilityLevel
    majority: CppDurabilityLevel
    majority_and_persist_to_active: CppDurabilityLevel
    persist_to_majority: CppDurabilityLevel
  }
  subdoc_store_semantics_type: {
    replace: CppSubdocStoreSemanticsType
    upsert: CppSubdocStoreSemanticsType
    insert: CppSubdocStoreSemanticsType
  }
  subdoc_opcode: {
    get_doc: CppSubdocOpcode
    set_doc: CppSubdocOpcode
    remove_doc: CppSubdocOpcode
    get: CppSubdocOpcode
    exists: CppSubdocOpcode
    dict_add: CppSubdocOpcode
    dict_upsert: CppSubdocOpcode
    remove: CppSubdocOpcode
    replace: CppSubdocOpcode
    array_push_last: CppSubdocOpcode
    array_push_first: CppSubdocOpcode
    array_insert: CppSubdocOpcode
    array_add_unique: CppSubdocOpcode
    counter: CppSubdocOpcode
    get_count: CppSubdocOpcode
    replace_body_with_xattr: CppSubdocOpcode
  }
  lookup_in_path_flag: {
    xattr: CppLookupInPathFlag
  }
  mutate_in_path_flag: {
    create_parents: CppMutateInPathFlag
    xattr: CppMutateInPathFlag
    expand_macros: CppMutateInPathFlag
  }
  view_name_space: {
    development: CppViewNamespace
    production: CppViewNamespace
  }
  view_scan_consistency: {
    not_bounded: CppViewScanConsistency
    update_after: CppViewScanConsistency
    request_plus: CppViewScanConsistency
  }
  view_sort_order: {
    ascending: CppViewSortOrder
    descending: CppViewSortOrder
  }
  query_scan_consistency: {
    not_bounded: CppQueryScanConsistency
    request_plus: CppQueryScanConsistency
  }
  query_profile_mode: {
    off: CppQueryProfileMode
    phases: CppQueryProfileMode
    timings: CppQueryProfileMode
  }
  analytics_scan_consistency: {
    not_bounded: CppAnalyticsScanConsistency
    request_plus: CppAnalyticsScanConsistency
  }
  search_scan_consistency: {
    not_bounded: CppSearchScanConsistency
  }
  search_highlight_style: {
    html: CppSearchHighlightStyle
    ansi: CppSearchHighlightStyle
  }

  common_errc: {
    request_canceled: CppErrorCode
    invalid_argument: CppErrorCode
    service_not_available: CppErrorCode
    internal_server_failure: CppErrorCode
    authentication_failure: CppErrorCode
    temporary_failure: CppErrorCode
    parsing_failure: CppErrorCode
    cas_mismatch: CppErrorCode
    bucket_not_found: CppErrorCode
    collection_not_found: CppErrorCode
    unsupported_operation: CppErrorCode
    ambiguous_timeout: CppErrorCode
    unambiguous_timeout: CppErrorCode
    feature_not_available: CppErrorCode
    scope_not_found: CppErrorCode
    index_not_found: CppErrorCode
    index_exists: CppErrorCode
    decoding_failure: CppErrorCode
    rate_limited: CppErrorCode
    quota_limited: CppErrorCode
  }
  key_value_errc: {
    document_not_found: CppErrorCode
    document_irretrievable: CppErrorCode
    document_locked: CppErrorCode
    value_too_large: CppErrorCode
    document_exists: CppErrorCode
    durability_level_not_available: CppErrorCode
    durability_impossible: CppErrorCode
    durability_ambiguous: CppErrorCode
    durable_write_in_progress: CppErrorCode
    durable_write_re_commit_in_progress: CppErrorCode
    path_not_found: CppErrorCode
    path_mismatch: CppErrorCode
    path_invalid: CppErrorCode
    path_too_big: CppErrorCode
    path_too_deep: CppErrorCode
    value_too_deep: CppErrorCode
    value_invalid: CppErrorCode
    document_not_json: CppErrorCode
    number_too_big: CppErrorCode
    delta_invalid: CppErrorCode
    path_exists: CppErrorCode
    xattr_unknown_macro: CppErrorCode
    xattr_invalid_key_combo: CppErrorCode
    xattr_unknown_virtual_attribute: CppErrorCode
    xattr_cannot_modify_virtual_attribute: CppErrorCode
    xattr_no_access: CppErrorCode
    cannot_revive_living_document: CppErrorCode
  }
  query_errc: {
    planning_failure: CppErrorCode
    index_failure: CppErrorCode
    prepared_statement_failure: CppErrorCode
    dml_failure: CppErrorCode
  }
  analytics_errc: {
    compilation_failure: CppErrorCode
    job_queue_full: CppErrorCode
    dataset_not_found: CppErrorCode
    dataverse_not_found: CppErrorCode
    dataset_exists: CppErrorCode
    dataverse_exists: CppErrorCode
    link_not_found: CppErrorCode
    link_exists: CppErrorCode
  }
  search_errc: {
    index_not_ready: CppErrorCode
    consistency_mismatch: CppErrorCode
  }
  view_errc: {
    view_not_found: CppErrorCode
    design_document_not_found: CppErrorCode
  }
  management_errc: {
    collection_exists: CppErrorCode
    scope_exists: CppErrorCode
    user_not_found: CppErrorCode
    group_not_found: CppErrorCode
    bucket_exists: CppErrorCode
    user_exists: CppErrorCode
    bucket_not_flushable: CppErrorCode
    eventing_function_not_found: CppErrorCode
    eventing_function_not_deployed: CppErrorCode
    eventing_function_compilation_failure: CppErrorCode
    eventing_function_identical_keyspace: CppErrorCode
    eventing_function_not_bootstrapped: CppErrorCode
    eventing_function_deployed: CppErrorCode
    eventing_function_paused: CppErrorCode
  }
  field_level_encryption_errc: {
    generic_cryptography_failure: CppErrorCode
    encryption_failure: CppErrorCode
    decryption_failure: CppErrorCode
    crypto_key_not_found: CppErrorCode
    invalid_crypto_key: CppErrorCode
    decrypter_not_found: CppErrorCode
    encrypter_not_found: CppErrorCode
    invalid_ciphertext: CppErrorCode
  }
  network_errc: {
    resolve_failure: CppErrorCode
    no_endpoints_left: CppErrorCode
    handshake_failure: CppErrorCode
    protocol_error: CppErrorCode
    configuration_not_available: CppErrorCode
  }

  txn_failure_type: {
    fail: CppTxnFailureType
    expiry: CppTxnFailureType
    commit_ambiguous: CppTxnFailureType
  }
  txn_external_exception: {
    unknown: CppTxnExternalException
    active_transaction_record_entry_not_found: CppTxnExternalException
    active_transaction_record_full: CppTxnExternalException
    active_transaction_record_not_found: CppTxnExternalException
    document_already_in_transaction: CppTxnExternalException
    document_exists_exception: CppTxnExternalException
    document_not_found_exception: CppTxnExternalException
    not_set: CppTxnExternalException
    feature_not_available_exception: CppTxnExternalException
    transaction_aborted_externally: CppTxnExternalException
    previous_operation_failed: CppTxnExternalException
    forward_compatibility_failure: CppTxnExternalException
  }
}

// Load it with require
const binding: CppBinding = bindings('couchbase_impl')
export default binding
