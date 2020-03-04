'use strict';

/**
 * Represents the C/C++ binding layer that the Node.js SDK is built upon.
 * This library handles all network I/O along with most configuration and
 * bootstrapping requirements.
 * @external CouchbaseBinding
 * @private
 */
/**
 * @name CouchbaseBinding._setErrorClass
 */
/**
 * @class CouchbaseBinding.Error
 * @private
 * @ignore
 */
/**
 * @class CouchbaseBinding.Connection
 * @private
 * @ignore
 */
/** @name CouchbaseBinding.Connection#connect */
/** @name CouchbaseBinding.Connection#shutdown */
/** @name CouchbaseBinding.Connection#cntl */
/** @name CouchbaseBinding.Connection#get */
/** @name CouchbaseBinding.Connection#getReplica */
/** @name CouchbaseBinding.Connection#store */
/** @name CouchbaseBinding.Connection#remove */
/** @name CouchbaseBinding.Connection#touch */
/** @name CouchbaseBinding.Connection#unlock */
/** @name CouchbaseBinding.Connection#counter */
/** @name CouchbaseBinding.Connection#lookupIn */
/** @name CouchbaseBinding.Connection#mutateIn */
/** @name CouchbaseBinding.Connection#viewQuery */
/** @name CouchbaseBinding.Connection#query */
/** @name CouchbaseBinding.Connection#analyticsQuery */
/** @name CouchbaseBinding.Connection#searchQuery */
/** @name CouchbaseBinding.Connection#ping */
/** @name CouchbaseBinding.Connection#diag */

/**
 * @namespace CouchbaseBinding
 * @ignore
 */
/** @name CouchbaseBinding.lcbVersion */
/** @name CouchbaseBinding.LCB_CNTL_SET */
/** @name CouchbaseBinding.LCB_CNTL_GET */
/** @name CouchbaseBinding.LCB_CNTL_OP_TIMEOUT */
/** @name CouchbaseBinding.LCB_CNTL_DURABILITY_INTERVAL */
/** @name CouchbaseBinding.LCB_CNTL_DURABILITY_TIMEOUT */
/** @name CouchbaseBinding.LCB_CNTL_HTTP_TIMEOUT */
/** @name CouchbaseBinding.LCB_CNTL_QUERY_TIMEOUT */
/** @name CouchbaseBinding.LCB_CNTL_VIEW_TIMEOUT */
/** @name CouchbaseBinding.LCB_CNTL_CONFIGURATION_TIMEOUT */
/** @name CouchbaseBinding.LCB_CNTL_VBMAP */
/** @name CouchbaseBinding.LCB_CNTL_CONFIG_HTTP_NODES */
/** @name CouchbaseBinding.LCB_CNTL_CONFIG_CCCP_NODES */
/** @name CouchbaseBinding.LCB_CNTL_CHANGESET */
/** @name CouchbaseBinding.LCB_CNTL_CONFIGCACHE */
/** @name CouchbaseBinding.LCB_CNTL_SSL_MODE */
/** @name CouchbaseBinding.LCB_CNTL_SSL_CACERT */
/** @name CouchbaseBinding.LCB_CNTL_RETRYMODE */
/** @name CouchbaseBinding.LCB_CNTL_HTCONFIG_URLTYPE */
/** @name CouchbaseBinding.LCB_CNTL_COMPRESSION_OPTS */
/** @name CouchbaseBinding.LCB_CNTL_RDBALLOCFACTORY */
/** @name CouchbaseBinding.LCB_CNTL_SYNCDESTROY */
/** @name CouchbaseBinding.LCB_CNTL_CONLOGGER_LEVEL */
/** @name CouchbaseBinding.LCB_CNTL_DETAILED_ERRCODES */
/** @name CouchbaseBinding.LCB_CNTL_REINIT_DSN */
/** @name CouchbaseBinding.LCB_CNTL_CONFDELAY_THRESH */
/** @name CouchbaseBinding.LCB_CNTL_CONFIG_NODE_TIMEOUT */
/** @name CouchbaseBinding.LCB_SUCCESS */
/** @name CouchbaseBinding.LCB_ERR_GENERIC */
/** @name CouchbaseBinding.LCB_ERR_TIMEOUT */
/** @name CouchbaseBinding.LCB_ERR_REQUEST_CANCELED */
/** @name CouchbaseBinding.LCB_ERR_INVALID_ARGUMENT */
/** @name CouchbaseBinding.LCB_ERR_SERVICE_NOT_AVAILABLE */
/** @name CouchbaseBinding.LCB_ERR_INTERNAL_SERVER_FAILURE */
/** @name CouchbaseBinding.LCB_ERR_AUTHENTICATION_FAILURE */
/** @name CouchbaseBinding.LCB_ERR_TEMPORARY_FAILURE */
/** @name CouchbaseBinding.LCB_ERR_PARSING_FAILURE */
/** @name CouchbaseBinding.LCB_ERR_CAS_MISMATCH */
/** @name CouchbaseBinding.LCB_ERR_BUCKET_NOT_FOUND */
/** @name CouchbaseBinding.LCB_ERR_COLLECTION_NOT_FOUND */
/** @name CouchbaseBinding.LCB_ERR_ENCODING_FAILURE */
/** @name CouchbaseBinding.LCB_ERR_DECODING_FAILURE */
/** @name CouchbaseBinding.LCB_ERR_UNSUPPORTED_OPERATION */
/** @name CouchbaseBinding.LCB_ERR_AMBIGUOUS_TIMEOUT */
/** @name CouchbaseBinding.LCB_ERR_UNAMBIGUOUS_TIMEOUT */
/** @name CouchbaseBinding.LCB_ERR_SCOPE_NOT_FOUND */
/** @name CouchbaseBinding.LCB_ERR_INDEX_NOT_FOUND */
/** @name CouchbaseBinding.LCB_ERR_INDEX_EXISTS */
/** @name CouchbaseBinding.LCB_ERR_DOCUMENT_NOT_FOUND */
/** @name CouchbaseBinding.LCB_ERR_DOCUMENT_UNRETRIEVABLE */
/** @name CouchbaseBinding.LCB_ERR_DOCUMENT_LOCKED */
/** @name CouchbaseBinding.LCB_ERR_VALUE_TOO_LARGE */
/** @name CouchbaseBinding.LCB_ERR_DOCUMENT_EXISTS */
/** @name CouchbaseBinding.LCB_ERR_VALUE_NOT_JSON */
/** @name CouchbaseBinding.LCB_ERR_DURABILITY_LEVEL_NOT_AVAILABLE */
/** @name CouchbaseBinding.LCB_ERR_DURABILITY_IMPOSSIBLE */
/** @name CouchbaseBinding.LCB_ERR_DURABILITY_AMBIGUOUS */
/** @name CouchbaseBinding.LCB_ERR_DURABLE_WRITE_IN_PROGRESS */
/** @name CouchbaseBinding.LCB_ERR_DURABLE_WRITE_RE_COMMIT_IN_PROGRESS */
/** @name CouchbaseBinding.LCB_ERR_MUTATION_LOST */
/** @name CouchbaseBinding.LCB_ERR_SUBDOC_PATH_NOT_FOUND */
/** @name CouchbaseBinding.LCB_ERR_SUBDOC_PATH_MISMATCH */
/** @name CouchbaseBinding.LCB_ERR_SUBDOC_PATH_INVALID */
/** @name CouchbaseBinding.LCB_ERR_SUBDOC_PATH_TOO_BIG */
/** @name CouchbaseBinding.LCB_ERR_SUBDOC_PATH_TOO_DEEP */
/** @name CouchbaseBinding.LCB_ERR_SUBDOC_VALUE_TOO_DEEP */
/** @name CouchbaseBinding.LCB_ERR_SUBDOC_VALUE_INVALID */
/** @name CouchbaseBinding.LCB_ERR_SUBDOC_DOCUMENT_NOT_JSON */
/** @name CouchbaseBinding.LCB_ERR_SUBDOC_NUMBER_TOO_BIG */
/** @name CouchbaseBinding.LCB_ERR_SUBDOC_DELTA_INVALID */
/** @name CouchbaseBinding.LCB_ERR_SUBDOC_PATH_EXISTS */
/** @name CouchbaseBinding.LCB_ERR_SUBDOC_XATTR_UNKNOWN_MACRO */
/** @name CouchbaseBinding.LCB_ERR_SUBDOC_XATTR_INVALID_FLAG_COMBO */
/** @name CouchbaseBinding.LCB_ERR_SUBDOC_XATTR_INVALID_KEY_COMBO */
/** @name CouchbaseBinding.LCB_ERR_SUBDOC_XATTR_UNKNOWN_VIRTUAL_ATTRIBUTE */
/** @name CouchbaseBinding.LCB_ERR_SUBDOC_XATTR_CANNOT_MODIFY_VIRTUAL_ATTRIBUTE */
/** @name CouchbaseBinding.LCB_ERR_SUBDOC_XATTR_INVALID_ORDER */
/** @name CouchbaseBinding.LCB_ERR_PLANNING_FAILURE */
/** @name CouchbaseBinding.LCB_ERR_INDEX_FAILURE */
/** @name CouchbaseBinding.LCB_ERR_PREPARED_STATEMENT_FAILURE */
/** @name CouchbaseBinding.LCB_ERR_COMPILATION_FAILED */
/** @name CouchbaseBinding.LCB_ERR_JOB_QUEUE_FULL */
/** @name CouchbaseBinding.LCB_ERR_DATASET_NOT_FOUND */
/** @name CouchbaseBinding.LCB_ERR_DATAVERSE_NOT_FOUND */
/** @name CouchbaseBinding.LCB_ERR_DATASET_EXISTS */
/** @name CouchbaseBinding.LCB_ERR_DATAVERSE_EXISTS */
/** @name CouchbaseBinding.LCB_ERR_ANALYTICS_LINK_NOT_FOUND */
/** @name CouchbaseBinding.LCB_ERR_VIEW_NOT_FOUND */
/** @name CouchbaseBinding.LCB_ERR_DESIGN_DOCUMENT_NOT_FOUND */
/** @name CouchbaseBinding.LCB_ERR_COLLECTION_ALREADY_EXISTS */
/** @name CouchbaseBinding.LCB_ERR_SCOPE_EXISTS */
/** @name CouchbaseBinding.LCB_ERR_USER_NOT_FOUND */
/** @name CouchbaseBinding.LCB_ERR_GROUP_NOT_FOUND */
/** @name CouchbaseBinding.LCB_ERR_BUCKET_ALREADY_EXISTS */
/** @name CouchbaseBinding.LCB_ERR_SSL_INVALID_CIPHERSUITES */
/** @name CouchbaseBinding.LCB_ERR_SSL_NO_CIPHERS */
/** @name CouchbaseBinding.LCB_ERR_SSL_ERROR */
/** @name CouchbaseBinding.LCB_ERR_SSL_CANTVERIFY */
/** @name CouchbaseBinding.LCB_ERR_FD_LIMIT_REACHED */
/** @name CouchbaseBinding.LCB_ERR_NODE_UNREACHABLE */
/** @name CouchbaseBinding.LCB_ERR_CONTROL_UNKNOWN_CODE */
/** @name CouchbaseBinding.LCB_ERR_CONTROL_UNSUPPORTED_MODE */
/** @name CouchbaseBinding.LCB_ERR_CONTROL_INVALID_ARGUMENT */
/** @name CouchbaseBinding.LCB_ERR_DUPLICATE_COMMANDS */
/** @name CouchbaseBinding.LCB_ERR_NO_MATCHING_SERVER */
/** @name CouchbaseBinding.LCB_ERR_PLUGIN_VERSION_MISMATCH */
/** @name CouchbaseBinding.LCB_ERR_INVALID_HOST_FORMAT */
/** @name CouchbaseBinding.LCB_ERR_INVALID_CHAR */
/** @name CouchbaseBinding.LCB_ERR_BAD_ENVIRONMENT */
/** @name CouchbaseBinding.LCB_ERR_NO_MEMORY */
/** @name CouchbaseBinding.LCB_ERR_NO_CONFIGURATION */
/** @name CouchbaseBinding.LCB_ERR_DLOPEN_FAILED */
/** @name CouchbaseBinding.LCB_ERR_DLSYM_FAILED */
/** @name CouchbaseBinding.LCB_ERR_CONFIG_CACHE_INVALID */
/** @name CouchbaseBinding.LCB_ERR_COLLECTION_MANIFEST_IS_AHEAD */
/** @name CouchbaseBinding.LCB_ERR_COLLECTION_NO_MANIFEST */
/** @name CouchbaseBinding.LCB_ERR_COLLECTION_CANNOT_APPLY_MANIFEST */
/** @name CouchbaseBinding.LCB_ERR_AUTH_CONTINUE */
/** @name CouchbaseBinding.LCB_ERR_CONNECTION_REFUSED */
/** @name CouchbaseBinding.LCB_ERR_SOCKET_SHUTDOWN */
/** @name CouchbaseBinding.LCB_ERR_CONNECTION_RESET */
/** @name CouchbaseBinding.LCB_ERR_CANNOT_GET_PORT */
/** @name CouchbaseBinding.LCB_ERR_INCOMPLETE_PACKET */
/** @name CouchbaseBinding.LCB_ERR_SDK_FEATURE_UNAVAILABLE */
/** @name CouchbaseBinding.LCB_ERR_OPTIONS_CONFLICT */
/** @name CouchbaseBinding.LCB_ERR_KVENGINE_INVALID_PACKET */
/** @name CouchbaseBinding.LCB_ERR_DURABILITY_TOO_MANY */
/** @name CouchbaseBinding.LCB_ERR_SHEDULE_FAILURE */
/** @name CouchbaseBinding.LCB_ERR_DURABILITY_NO_MUTATION_TOKENS */
/** @name CouchbaseBinding.LCB_ERR_SASLMECH_UNAVAILABLE */
/** @name CouchbaseBinding.LCB_ERR_TOO_MANY_REDIRECTS */
/** @name CouchbaseBinding.LCB_ERR_MAP_CHANGED */
/** @name CouchbaseBinding.LCB_ERR_NOT_MY_VBUCKET */
/** @name CouchbaseBinding.LCB_ERR_UNKNOWN_SUBDOC_COMMAND */
/** @name CouchbaseBinding.LCB_ERR_KVENGINE_UNKNOWN_ERROR */
/** @name CouchbaseBinding.LCB_ERR_NAMESERVER */
/** @name CouchbaseBinding.LCB_ERR_INVALID_RANGE */
/** @name CouchbaseBinding.LCB_ERR_NOT_STORED */
/** @name CouchbaseBinding.LCB_ERR_BUSY */
/** @name CouchbaseBinding.LCB_ERR_SDK_INTERNAL */
/** @name CouchbaseBinding.LCB_ERR_INVALID_DELTA */
/** @name CouchbaseBinding.LCB_ERR_NO_COMMANDS */
/** @name CouchbaseBinding.LCB_ERR_NETWORK */
/** @name CouchbaseBinding.LCB_ERR_UNKNOWN_HOST */
/** @name CouchbaseBinding.LCB_ERR_PROTOCOL_ERROR */
/** @name CouchbaseBinding.LCB_ERR_CONNECT_ERROR */
/** @name CouchbaseBinding.LCB_ERR_EMPTY_KEY */
/** @name CouchbaseBinding.LCB_ERR_HTTP */
/** @name CouchbaseBinding.LCB_ERR_QUERY */
/** @name CouchbaseBinding.LCB_ERR_TOPOLOGY_CHANGE */
/** @name CouchbaseBinding.LCB_LOG_TRACE */
/** @name CouchbaseBinding.LCB_LOG_DEBUG */
/** @name CouchbaseBinding.LCB_LOG_INFO */
/** @name CouchbaseBinding.LCB_LOG_WARN */
/** @name CouchbaseBinding.LCB_LOG_ERROR */
/** @name CouchbaseBinding.LCB_LOG_FATAL */
/** @name CouchbaseBinding.LCB_HTTP_TYPE_VIEW */
/** @name CouchbaseBinding.LCB_HTTP_TYPE_MANAGEMENT */
/** @name CouchbaseBinding.LCB_HTTP_TYPE_RAW */
/** @name CouchbaseBinding.LCB_HTTP_TYPE_QUERY */
/** @name CouchbaseBinding.LCB_HTTP_TYPE_SEARCH */
/** @name CouchbaseBinding.LCB_HTTP_TYPE_ANALYTICS */
/** @name CouchbaseBinding.LCB_HTTP_METHOD_GET */
/** @name CouchbaseBinding.LCB_HTTP_METHOD_POST */
/** @name CouchbaseBinding.LCB_HTTP_METHOD_PUT */
/** @name CouchbaseBinding.LCB_HTTP_METHOD_DELETE */
/** @name CouchbaseBinding.LCB_STORE_UPSERT */
/** @name CouchbaseBinding.LCB_STORE_INSERT */
/** @name CouchbaseBinding.LCB_STORE_REPLACE */
/** @name CouchbaseBinding.LCB_STORE_APPEND */
/** @name CouchbaseBinding.LCB_STORE_PREPEND */
/** @name CouchbaseBinding.LCBX_SDCMD_GET */
/** @name CouchbaseBinding.LCBX_SDCMD_EXISTS */
/** @name CouchbaseBinding.LCBX_SDCMD_REPLACE */
/** @name CouchbaseBinding.LCBX_SDCMD_DICT_ADD */
/** @name CouchbaseBinding.LCBX_SDCMD_DICT_UPSERT */
/** @name CouchbaseBinding.LCBX_SDCMD_ARRAY_ADD_FIRST */
/** @name CouchbaseBinding.LCBX_SDCMD_ARRAY_ADD_LAST */
/** @name CouchbaseBinding.LCBX_SDCMD_ARRAY_ADD_UNIQUE */
/** @name CouchbaseBinding.LCBX_SDCMD_ARRAY_INSERT */
/** @name CouchbaseBinding.LCBX_SDCMD_REMOVE */
/** @name CouchbaseBinding.LCBX_SDCMD_COUNTER */
/** @name CouchbaseBinding.LCBX_SDCMD_GET_COUNT */
/** @name CouchbaseBinding.LCB_REPLICA_MODE_ANY */
/** @name CouchbaseBinding.LCB_REPLICA_MODE_ALL */
/** @name CouchbaseBinding.LCB_REPLICA_MODE_IDX0 */
/** @name CouchbaseBinding.LCB_REPLICA_MODE_IDX1 */
/** @name CouchbaseBinding.LCB_REPLICA_MODE_IDX2 */
/** @name CouchbaseBinding.LCB_DURABILITYLEVEL_NONE */
/** @name CouchbaseBinding.LCB_DURABILITYLEVEL_MAJORITY */
/** @name CouchbaseBinding.LCB_DURABILITYLEVEL_MAJORITY_AND_PERSIST_TO_ACTIVE */
/** @name CouchbaseBinding.LCB_DURABILITYLEVEL_PERSIST_TO_MAJORITY */
/** @name CouchbaseBinding.LCBX_SDFLAG_UPSERT_DOC */
/** @name CouchbaseBinding.LCBX_SDFLAG_INSERT_DOC */
/** @name CouchbaseBinding.LCBX_SDFLAG_ACCESS_DELETED */
/** @name CouchbaseBinding.LCB_SUBDOCSPECS_F_MKINTERMEDIATES */
/** @name CouchbaseBinding.LCB_SUBDOCSPECS_F_XATTRPATH */
/** @name CouchbaseBinding.LCB_SUBDOCSPECS_F_XATTR_MACROVALUES */
/** @name CouchbaseBinding.LCB_SUBDOCSPECS_F_XATTR_DELETED_OK */
/** @name CouchbaseBinding.LCB_RESP_F_FINAL */
/** @name CouchbaseBinding.LCB_RESP_F_CLIENTGEN */
/** @name CouchbaseBinding.LCB_RESP_F_NMVGEN */
/** @name CouchbaseBinding.LCB_RESP_F_EXTDATA */
/** @name CouchbaseBinding.LCB_RESP_F_SDSINGLE */
/** @name CouchbaseBinding.LCB_RESP_F_ERRINFO */
/** @name CouchbaseBinding.LCBX_VIEWFLAG_INCLUDEDOCS */
/** @name CouchbaseBinding.LCBX_QUERYFLAG_PREPCACHE */
/** @name CouchbaseBinding.LCBX_ANALYTICSFLAG_PRIORITY */
/** @name CouchbaseBinding.LCB_LOG_TRACE */
/** @name CouchbaseBinding.LCB_LOG_DEBUG */
/** @name CouchbaseBinding.LCB_LOG_INFO */
/** @name CouchbaseBinding.LCB_LOG_WARN */
/** @name CouchbaseBinding.LCB_LOG_ERROR */
/** @name CouchbaseBinding.LCB_LOG_FATAL */

/**
 * @type {CouchbaseBinding}
 * @ignore
 */
var couchnode = require('bindings')('couchbase_impl');

module.exports = couchnode;
