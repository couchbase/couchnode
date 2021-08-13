/* eslint jsdoc/require-jsdoc: off */
import bindings from 'bindings'

export enum CppReplicaMode {}
export enum CppDurabilityMode {}
export enum CppHttpType {}
export enum CppHttpMethod {}
export enum CppStoreOpType {}
export enum CppServiceType {}
export enum CppErrType {}
export enum CppLogSeverity {}
export enum CppSdCmdType {}
export enum CppSdOpFlag {}
export enum CppSdSpecFlag {}
export enum CppConnType {}
export enum CppViewQueryFlags {}
export enum CppQueryFlags {}
export enum CppSearchQueryFlags {}
export enum CppAnalyticsQueryFlags {}
export enum CppViewQueryRespFlags {}
export enum CppQueryRespFlags {}
export enum CppSearchQueryRespFlags {}
export enum CppAnalyticsQueryRespFlags {}

export interface CppLogData {
  severity: CppLogSeverity
  srcFile: string
  srcLine: number
  subsys: string
  message: string
}

export interface CppLogFunc {
  (data: CppLogData): void
}

export interface CppValueRecorder {
  recordValue(value: number): void
}

export interface CppMeter {
  valueRecorder(
    name: string,
    tags: { [key: string]: string }
  ): CppValueRecorder | null
}

export interface CppRequestSpan {
  addTag(key: string, value: string | number | boolean): void
  end(): void
}

export interface CppTracer {
  requestSpan(name: string, parent: CppRequestSpan | undefined): CppRequestSpan
}

export type CppBytes = string | Buffer
export type CppTranscoder = any
export type CppCas = any
export type CppMutationToken = any

export interface CppErrorBase extends Error {
  code: number
}

export interface CppGenericError extends CppErrorBase {
  ctxtype: undefined | null
}

export interface CppKeyValueError extends CppErrorBase {
  ctxtype: 'kv'
  status_code: number
  opaque: number
  cas: CppCas
  key: string
  bucket: string
  scope: string
  collection: string
  context: string
  ref: string
}

export interface CppViewError extends CppErrorBase {
  ctxtype: 'views'
  first_error_code: number
  first_error_message: string
  design_document: string
  view: string
  parameters: any
  http_response_code: number
  http_response_body: string
}

export interface CppQueryError extends CppErrorBase {
  ctxtype: 'query'
  first_error_code: number
  first_error_message: string
  statement: string
  client_context_id: string
  parameters: any
  http_response_code: number
  http_response_body: string
}

export interface CppSearchError extends CppErrorBase {
  ctxtype: 'search'
  error_message: string
  index_name: string
  query: any
  parameters: any
  http_response_code: number
  http_response_body: string
}

export interface CppAnalyticsError extends CppErrorBase {
  ctxtype: 'analytics'
  first_error_code: number
  first_error_message: string
  statement: string
  client_context_id: string
  parameters: any
  http_response_code: number
  http_response_body: string
}

export type CppError =
  | CppGenericError
  | CppKeyValueError
  | CppViewError
  | CppQueryError
  | CppSearchError
  | CppAnalyticsError

export interface CppConnection {
  new (
    connType: CppConnType,
    connStr: string,
    username: string | undefined,
    password: string | undefined,
    logFn: CppLogFunc,
    tracer: CppTracer | undefined,
    meter: CppMeter | undefined
  ): any

  connect(callback: (err: CppError | null) => void): void
  shutdown(): void
  selectBucket(
    bucketName: string,
    callback: (err: CppError | null) => void
  ): void

  get(
    scopeName: string,
    collectionName: string,
    key: CppBytes,
    transcoder: CppTranscoder,
    expiryTime: number | undefined,
    lockTime: number | undefined,
    parentSpan: CppRequestSpan | undefined,
    timeoutMs: number | undefined,
    callback: (err: CppError | null, cas: CppCas, value: any) => void
  ): void

  exists(
    scopeName: string,
    collectionName: string,
    key: CppBytes,
    parentSpan: CppRequestSpan | undefined,
    timeoutMs: number | undefined,
    callback: (err: CppError | null, cas: CppCas, exists: boolean) => void
  ): void

  getReplica(
    scopeName: string,
    collectionName: string,
    key: CppBytes,
    transcoder: CppTranscoder,
    mode: CppReplicaMode,
    parentSpan: CppRequestSpan | undefined,
    timeoutMs: number | undefined,
    callback: (
      err: CppError | null,
      rflags: number,
      cas: CppCas,
      value: any
    ) => void
  ): void

  store(
    scopeName: string,
    collectionName: string,
    key: CppBytes,
    transcoder: CppTranscoder,
    value: any,
    expirySecs: number | undefined,
    cas: CppCas | undefined,
    duraMode: CppDurabilityMode | undefined,
    persistTo: number | undefined,
    replicateTo: number | undefined,
    parentSpan: CppRequestSpan | undefined,
    timeoutMs: number | undefined,
    opType: CppStoreOpType,
    callback: (
      err: CppError | null,
      cas: CppCas,
      token: CppMutationToken
    ) => void
  ): void

  remove(
    scopeName: string,
    collectionName: string,
    key: CppBytes,
    cas: CppCas | undefined,
    duraMode: CppDurabilityMode | undefined,
    persistTo: number | undefined,
    replicateTo: number | undefined,
    parentSpan: CppRequestSpan | undefined,
    timeoutMs: number | undefined,
    callback: (err: CppError | null, cas: CppCas) => void
  ): void

  touch(
    scopeName: string,
    collectionName: string,
    key: CppBytes,
    expirySecs: number,
    duraMode: CppDurabilityMode | undefined,
    persistTo: number | undefined,
    replicateTo: number | undefined,
    parentSpan: CppRequestSpan | undefined,
    timeoutMs: number | undefined,
    callback: (err: CppError | null, cas: CppCas) => void
  ): void

  unlock(
    scopeName: string,
    collectionName: string,
    key: CppBytes,
    cas: CppCas,
    parentSpan: CppRequestSpan | undefined,
    timeoutMs: number | undefined,
    callback: (err: CppError | null) => void
  ): void

  counter(
    scopeName: string,
    collectionName: string,
    key: CppBytes,
    delta: number | undefined,
    initial: number | undefined,
    expirySecs: number | undefined,
    duraMode: CppDurabilityMode | undefined,
    persistTo: number | undefined,
    replicateTo: number | undefined,
    parentSpan: CppRequestSpan | undefined,
    timeoutMs: number | undefined,
    callback: (
      err: CppError | null,
      cas: CppCas,
      token: CppMutationToken,
      value: number
    ) => void
  ): void

  lookupIn(
    scopeName: string,
    collectionName: string,
    key: CppBytes,
    flags: number,
    cmds: [
      optype: number,
      flags: number,
      path: string,
      ..._: any[] // More cmds
    ],
    parentSpan: CppRequestSpan | undefined,
    timeoutMs: number | undefined,
    callback: (err: CppError | null, res: any) => void
  ): void

  mutateIn(
    scopeName: string,
    collectionName: string,
    key: CppBytes,
    expirySecs: number | undefined,
    cas: CppCas | undefined,
    flags: number,
    cmds: [
      optype: number,
      flags: number,
      path: string,
      value: CppBytes,
      ..._: any[] // More cmds
    ],
    duraMode: CppDurabilityMode | undefined,
    persistTo: number | undefined,
    replicateTo: number | undefined,
    parentSpan: CppRequestSpan | undefined,
    timeoutMs: number | undefined,
    callback: (err: CppError | null, res: any) => void
  ): void

  viewQuery(
    designDoc: string,
    viewName: string,
    queryData: CppBytes,
    postData: CppBytes | undefined,
    flags: CppViewQueryFlags,
    parentSpan: CppRequestSpan | undefined,
    timeoutMs: number | undefined,
    callback: (
      err: CppError | null,
      flags: CppViewQueryRespFlags,
      data: any,
      docId: string,
      key: string
    ) => void
  ): void

  query(
    queryData: CppBytes,
    flags: CppQueryFlags,
    parentSpan: CppRequestSpan | undefined,
    timeoutMs: number | undefined,
    callback: (
      err: CppError | null,
      flags: CppQueryRespFlags,
      data: any
    ) => void
  ): void

  analyticsQuery(
    queryData: CppBytes,
    flags: CppAnalyticsQueryFlags,
    parentSpan: CppRequestSpan | undefined,
    timeoutMs: number | undefined,
    callback: (
      err: CppError | null,
      flags: CppAnalyticsQueryRespFlags,
      data: any
    ) => void
  ): void

  searchQuery(
    queryData: CppBytes,
    flags: CppSearchQueryFlags,
    parentSpan: CppRequestSpan | undefined,
    timeoutMs: number | undefined,
    callback: (
      err: CppError | null,
      flags: CppSearchQueryRespFlags,
      data: any
    ) => void
  ): void

  httpRequest(
    httpType: CppHttpType,
    httpMethod: CppHttpMethod,
    path: string,
    contentType: string | undefined,
    body: CppBytes | undefined,
    parentSpan: CppRequestSpan | undefined,
    timeoutMs: number | undefined,
    callback: (err: CppError | null, flags: number, data: any) => void
  ): void

  ping(
    reportId: string | undefined,
    services: CppServiceType | undefined,
    parentSpan: CppRequestSpan | undefined,
    timeoutMs: number | undefined,
    callback: (err: CppError | null, data: string) => void
  ): void

  diag(
    reportId: string | undefined,
    callback: (err: CppError | null, data: string) => void
  ): void
}

export interface CppBinding {
  lcbVersion: string

  Connection: CppConnection

  LCB_SUCCESS: CppErrType
  LCB_ERR_GENERIC: CppErrType
  LCB_ERR_TIMEOUT: CppErrType
  LCB_ERR_REQUEST_CANCELED: CppErrType
  LCB_ERR_INVALID_ARGUMENT: CppErrType
  LCB_ERR_SERVICE_NOT_AVAILABLE: CppErrType
  LCB_ERR_INTERNAL_SERVER_FAILURE: CppErrType
  LCB_ERR_AUTHENTICATION_FAILURE: CppErrType
  LCB_ERR_TEMPORARY_FAILURE: CppErrType
  LCB_ERR_PARSING_FAILURE: CppErrType
  LCB_ERR_CAS_MISMATCH: CppErrType
  LCB_ERR_BUCKET_NOT_FOUND: CppErrType
  LCB_ERR_COLLECTION_NOT_FOUND: CppErrType
  LCB_ERR_ENCODING_FAILURE: CppErrType
  LCB_ERR_DECODING_FAILURE: CppErrType
  LCB_ERR_UNSUPPORTED_OPERATION: CppErrType
  LCB_ERR_AMBIGUOUS_TIMEOUT: CppErrType
  LCB_ERR_UNAMBIGUOUS_TIMEOUT: CppErrType
  LCB_ERR_SCOPE_NOT_FOUND: CppErrType
  LCB_ERR_INDEX_NOT_FOUND: CppErrType
  LCB_ERR_INDEX_EXISTS: CppErrType
  LCB_ERR_DOCUMENT_NOT_FOUND: CppErrType
  LCB_ERR_DOCUMENT_UNRETRIEVABLE: CppErrType
  LCB_ERR_DOCUMENT_LOCKED: CppErrType
  LCB_ERR_VALUE_TOO_LARGE: CppErrType
  LCB_ERR_DOCUMENT_EXISTS: CppErrType
  LCB_ERR_VALUE_NOT_JSON: CppErrType
  LCB_ERR_DURABILITY_LEVEL_NOT_AVAILABLE: CppErrType
  LCB_ERR_DURABILITY_IMPOSSIBLE: CppErrType
  LCB_ERR_DURABILITY_AMBIGUOUS: CppErrType
  LCB_ERR_DURABLE_WRITE_IN_PROGRESS: CppErrType
  LCB_ERR_DURABLE_WRITE_RE_COMMIT_IN_PROGRESS: CppErrType
  LCB_ERR_MUTATION_LOST: CppErrType
  LCB_ERR_SUBDOC_PATH_NOT_FOUND: CppErrType
  LCB_ERR_SUBDOC_PATH_MISMATCH: CppErrType
  LCB_ERR_SUBDOC_PATH_INVALID: CppErrType
  LCB_ERR_SUBDOC_PATH_TOO_BIG: CppErrType
  LCB_ERR_SUBDOC_PATH_TOO_DEEP: CppErrType
  LCB_ERR_SUBDOC_VALUE_TOO_DEEP: CppErrType
  LCB_ERR_SUBDOC_VALUE_INVALID: CppErrType
  LCB_ERR_SUBDOC_DOCUMENT_NOT_JSON: CppErrType
  LCB_ERR_SUBDOC_NUMBER_TOO_BIG: CppErrType
  LCB_ERR_SUBDOC_DELTA_INVALID: CppErrType
  LCB_ERR_SUBDOC_PATH_EXISTS: CppErrType
  LCB_ERR_SUBDOC_XATTR_UNKNOWN_MACRO: CppErrType
  LCB_ERR_SUBDOC_XATTR_INVALID_FLAG_COMBO: CppErrType
  LCB_ERR_SUBDOC_XATTR_INVALID_KEY_COMBO: CppErrType
  LCB_ERR_SUBDOC_XATTR_UNKNOWN_VIRTUAL_ATTRIBUTE: CppErrType
  LCB_ERR_SUBDOC_XATTR_CANNOT_MODIFY_VIRTUAL_ATTRIBUTE: CppErrType
  LCB_ERR_SUBDOC_XATTR_INVALID_ORDER: CppErrType
  LCB_ERR_PLANNING_FAILURE: CppErrType
  LCB_ERR_INDEX_FAILURE: CppErrType
  LCB_ERR_PREPARED_STATEMENT_FAILURE: CppErrType
  LCB_ERR_COMPILATION_FAILED: CppErrType
  LCB_ERR_JOB_QUEUE_FULL: CppErrType
  LCB_ERR_DATASET_NOT_FOUND: CppErrType
  LCB_ERR_DATAVERSE_NOT_FOUND: CppErrType
  LCB_ERR_DATASET_EXISTS: CppErrType
  LCB_ERR_DATAVERSE_EXISTS: CppErrType
  LCB_ERR_ANALYTICS_LINK_NOT_FOUND: CppErrType
  LCB_ERR_VIEW_NOT_FOUND: CppErrType
  LCB_ERR_DESIGN_DOCUMENT_NOT_FOUND: CppErrType
  LCB_ERR_COLLECTION_ALREADY_EXISTS: CppErrType
  LCB_ERR_SCOPE_EXISTS: CppErrType
  LCB_ERR_USER_NOT_FOUND: CppErrType
  LCB_ERR_GROUP_NOT_FOUND: CppErrType
  LCB_ERR_BUCKET_ALREADY_EXISTS: CppErrType
  LCB_ERR_SSL_INVALID_CIPHERSUITES: CppErrType
  LCB_ERR_SSL_NO_CIPHERS: CppErrType
  LCB_ERR_SSL_ERROR: CppErrType
  LCB_ERR_SSL_CANTVERIFY: CppErrType
  LCB_ERR_FD_LIMIT_REACHED: CppErrType
  LCB_ERR_NODE_UNREACHABLE: CppErrType
  LCB_ERR_CONTROL_UNKNOWN_CODE: CppErrType
  LCB_ERR_CONTROL_UNSUPPORTED_MODE: CppErrType
  LCB_ERR_CONTROL_INVALID_ARGUMENT: CppErrType
  LCB_ERR_DUPLICATE_COMMANDS: CppErrType
  LCB_ERR_NO_MATCHING_SERVER: CppErrType
  LCB_ERR_PLUGIN_VERSION_MISMATCH: CppErrType
  LCB_ERR_INVALID_HOST_FORMAT: CppErrType
  LCB_ERR_INVALID_CHAR: CppErrType
  LCB_ERR_BAD_ENVIRONMENT: CppErrType
  LCB_ERR_NO_MEMORY: CppErrType
  LCB_ERR_NO_CONFIGURATION: CppErrType
  LCB_ERR_DLOPEN_FAILED: CppErrType
  LCB_ERR_DLSYM_FAILED: CppErrType
  LCB_ERR_CONFIG_CACHE_INVALID: CppErrType
  LCB_ERR_COLLECTION_MANIFEST_IS_AHEAD: CppErrType
  LCB_ERR_COLLECTION_NO_MANIFEST: CppErrType
  LCB_ERR_COLLECTION_CANNOT_APPLY_MANIFEST: CppErrType
  LCB_ERR_AUTH_CONTINUE: CppErrType
  LCB_ERR_CONNECTION_REFUSED: CppErrType
  LCB_ERR_SOCKET_SHUTDOWN: CppErrType
  LCB_ERR_CONNECTION_RESET: CppErrType
  LCB_ERR_CANNOT_GET_PORT: CppErrType
  LCB_ERR_INCOMPLETE_PACKET: CppErrType
  LCB_ERR_SDK_FEATURE_UNAVAILABLE: CppErrType
  LCB_ERR_OPTIONS_CONFLICT: CppErrType
  LCB_ERR_KVENGINE_INVALID_PACKET: CppErrType
  LCB_ERR_DURABILITY_TOO_MANY: CppErrType
  LCB_ERR_SHEDULE_FAILURE: CppErrType
  LCB_ERR_DURABILITY_NO_MUTATION_TOKENS: CppErrType
  LCB_ERR_SASLMECH_UNAVAILABLE: CppErrType
  LCB_ERR_TOO_MANY_REDIRECTS: CppErrType
  LCB_ERR_MAP_CHANGED: CppErrType
  LCB_ERR_NOT_MY_VBUCKET: CppErrType
  LCB_ERR_UNKNOWN_SUBDOC_COMMAND: CppErrType
  LCB_ERR_KVENGINE_UNKNOWN_ERROR: CppErrType
  LCB_ERR_NAMESERVER: CppErrType
  LCB_ERR_INVALID_RANGE: CppErrType
  LCB_ERR_NOT_STORED: CppErrType
  LCB_ERR_BUSY: CppErrType
  LCB_ERR_SDK_INTERNAL: CppErrType
  LCB_ERR_INVALID_DELTA: CppErrType
  LCB_ERR_NO_COMMANDS: CppErrType
  LCB_ERR_NETWORK: CppErrType
  LCB_ERR_UNKNOWN_HOST: CppErrType
  LCB_ERR_PROTOCOL_ERROR: CppErrType
  LCB_ERR_CONNECT_ERROR: CppErrType
  LCB_ERR_EMPTY_KEY: CppErrType
  LCB_ERR_HTTP: CppErrType
  LCB_ERR_QUERY: CppErrType
  LCB_ERR_TOPOLOGY_CHANGE: CppErrType

  LCB_LOG_TRACE: CppLogSeverity
  LCB_LOG_DEBUG: CppLogSeverity
  LCB_LOG_INFO: CppLogSeverity
  LCB_LOG_WARN: CppLogSeverity
  LCB_LOG_ERROR: CppLogSeverity
  LCB_LOG_FATAL: CppLogSeverity

  LCB_HTTP_TYPE_VIEW: CppHttpType
  LCB_HTTP_TYPE_MANAGEMENT: CppHttpType
  LCB_HTTP_TYPE_RAW: CppHttpType
  LCB_HTTP_TYPE_QUERY: CppHttpType
  LCB_HTTP_TYPE_SEARCH: CppHttpType
  LCB_HTTP_TYPE_ANALYTICS: CppHttpType
  LCB_HTTP_TYPE_EVENTING: CppHttpType
  LCB_HTTP_METHOD_GET: CppHttpMethod
  LCB_HTTP_METHOD_POST: CppHttpMethod
  LCB_HTTP_METHOD_PUT: CppHttpMethod
  LCB_HTTP_METHOD_DELETE: CppHttpMethod

  LCB_STORE_UPSERT: CppStoreOpType
  LCB_STORE_REPLACE: CppStoreOpType
  LCB_STORE_INSERT: CppStoreOpType
  LCB_STORE_APPEND: CppStoreOpType
  LCB_STORE_PREPEND: CppStoreOpType

  LCBX_SDCMD_GET: CppSdCmdType
  LCBX_SDCMD_EXISTS: CppSdCmdType
  LCBX_SDCMD_REPLACE: CppSdCmdType
  LCBX_SDCMD_DICT_ADD: CppSdCmdType
  LCBX_SDCMD_DICT_UPSERT: CppSdCmdType
  LCBX_SDCMD_ARRAY_ADD_FIRST: CppSdCmdType
  LCBX_SDCMD_ARRAY_ADD_LAST: CppSdCmdType
  LCBX_SDCMD_ARRAY_ADD_UNIQUE: CppSdCmdType
  LCBX_SDCMD_ARRAY_INSERT: CppSdCmdType
  LCBX_SDCMD_REMOVE: CppSdCmdType
  LCBX_SDCMD_COUNTER: CppSdCmdType
  LCBX_SDCMD_GET_COUNT: CppSdCmdType

  LCB_REPLICA_MODE_ANY: CppReplicaMode
  LCB_REPLICA_MODE_ALL: CppReplicaMode
  LCB_REPLICA_MODE_IDX0: CppReplicaMode
  LCB_REPLICA_MODE_IDX1: CppReplicaMode
  LCB_REPLICA_MODE_IDX2: CppReplicaMode

  LCB_DURABILITYLEVEL_NONE: CppDurabilityMode
  LCB_DURABILITYLEVEL_MAJORITY: CppDurabilityMode
  LCB_DURABILITYLEVEL_MAJORITY_AND_PERSIST_TO_ACTIVE: CppDurabilityMode
  LCB_DURABILITYLEVEL_PERSIST_TO_MAJORITY: CppDurabilityMode

  LCBX_SDFLAG_UPSERT_DOC: CppSdOpFlag
  LCBX_SDFLAG_INSERT_DOC: CppSdOpFlag
  LCBX_SDFLAG_ACCESS_DELETED: CppSdOpFlag

  LCB_SUBDOCSPECS_F_MKINTERMEDIATES: CppSdSpecFlag
  LCB_SUBDOCSPECS_F_XATTRPATH: CppSdSpecFlag
  LCB_SUBDOCSPECS_F_XATTR_MACROVALUES: CppSdSpecFlag
  LCB_SUBDOCSPECS_F_XATTR_DELETED_OK: CppSdSpecFlag

  LCBX_SERVICETYPE_KEYVALUE: CppServiceType
  LCBX_SERVICETYPE_MANAGEMENT: CppServiceType
  LCBX_SERVICETYPE_VIEWS: CppServiceType
  LCBX_SERVICETYPE_QUERY: CppServiceType
  LCBX_SERVICETYPE_SEARCH: CppServiceType
  LCBX_SERVICETYPE_ANALYTICS: CppServiceType

  LCBX_VIEWFLAG_INCLUDEDOCS: CppViewQueryFlags

  LCBX_QUERYFLAG_PREPCACHE: CppQueryFlags

  LCBX_ANALYTICSFLAG_PRIORITY: CppAnalyticsQueryFlags

  LCB_TYPE_BUCKET: CppConnType
  LCB_TYPE_CLUSTER: CppConnType

  LCBX_RESP_F_NONFINAL:
    | CppViewQueryRespFlags
    | CppQueryRespFlags
    | CppSearchQueryRespFlags
    | CppAnalyticsQueryRespFlags
}
// Load it with require
const binding: CppBinding = bindings('couchbase_impl')
export default binding
