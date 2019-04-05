'use strict';

var util = require('util');

/**
 * Represents the C/C++ binding layer that the Node.js SDK is built upon.
 * This library handles all network I/O along with most configuration and
 * bootstrapping requirements.
 * @external CouchbaseBinding
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
/** @name CouchbaseBinding.Connection#n1qlQuery */
/** @name CouchbaseBinding.Connection#cbasQuery */
/** @name CouchbaseBinding.Connection#ftsQuery */
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
/** @name CouchbaseBinding.LCB_CNTL_N1QL_TIMEOUT */
/** @name CouchbaseBinding.LCB_CNTL_VIEW_TIMEOUT */
/** @name CouchbaseBinding.LCB_CNTL_RBUFSIZE */
/** @name CouchbaseBinding.LCB_CNTL_WBUFSIZE */
/** @name CouchbaseBinding.LCB_CNTL_CONFIGURATION_TIMEOUT */
/** @name CouchbaseBinding.LCB_CNTL_VBMAP */
/** @name CouchbaseBinding.LCB_CNTL_CONFIG_HTTP_NODES */
/** @name CouchbaseBinding.LCB_CNTL_CONFIG_CCCP_NODES */
/** @name CouchbaseBinding.LCB_CNTL_CHANGESET */
/** @name CouchbaseBinding.LCB_CNTL_CONFIG_ALL_NODES */
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
/** @name CouchbaseBinding.LCB_STORE_ADD */
/** @name CouchbaseBinding.LCB_STORE_REPLACE */
/** @name CouchbaseBinding.LCB_STORE_SET */
/** @name CouchbaseBinding.LCB_STORE_APPEND */
/** @name CouchbaseBinding.LCB_STORE_PREPEND */
/** @name CouchbaseBinding.LCB_SUCCESS */
/** @name CouchbaseBinding.LCB_AUTH_CONTINUE */
/** @name CouchbaseBinding.LCB_AUTH_ERROR */
/** @name CouchbaseBinding.LCB_DELTA_BADVAL */
/** @name CouchbaseBinding.LCB_E2BIG */
/** @name CouchbaseBinding.LCB_EBUSY */
/** @name CouchbaseBinding.LCB_ENOMEM */
/** @name CouchbaseBinding.LCB_ERANGE */
/** @name CouchbaseBinding.LCB_ERROR */
/** @name CouchbaseBinding.LCB_ETMPFAIL */
/** @name CouchbaseBinding.LCB_EINVAL */
/** @name CouchbaseBinding.LCB_CLIENT_ETMPFAIL */
/** @name CouchbaseBinding.LCB_KEY_EEXISTS */
/** @name CouchbaseBinding.LCB_KEY_ENOENT */
/** @name CouchbaseBinding.LCB_DLOPEN_FAILED */
/** @name CouchbaseBinding.LCB_DLSYM_FAILED */
/** @name CouchbaseBinding.LCB_NETWORK_ERROR */
/** @name CouchbaseBinding.LCB_NOT_MY_VBUCKET */
/** @name CouchbaseBinding.LCB_NOT_STORED */
/** @name CouchbaseBinding.LCB_NOT_SUPPORTED */
/** @name CouchbaseBinding.LCB_UNKNOWN_COMMAND */
/** @name CouchbaseBinding.LCB_UNKNOWN_HOST */
/** @name CouchbaseBinding.LCB_PROTOCOL_ERROR */
/** @name CouchbaseBinding.LCB_ETIMEDOUT */
/** @name CouchbaseBinding.LCB_BUCKET_ENOENT */
/** @name CouchbaseBinding.LCB_CLIENT_ENOMEM */
/** @name CouchbaseBinding.LCB_CONNECT_ERROR */
/** @name CouchbaseBinding.LCB_EBADHANDLE */
/** @name CouchbaseBinding.LCB_SERVER_BUG */
/** @name CouchbaseBinding.LCB_PLUGIN_VERSION_MISMATCH */
/** @name CouchbaseBinding.LCB_INVALID_HOST_FORMAT */
/** @name CouchbaseBinding.LCB_INVALID_CHAR */
/** @name CouchbaseBinding.LCB_DURABILITY_ETOOMANY */
/** @name CouchbaseBinding.LCB_DUPLICATE_COMMANDS */
/** @name CouchbaseBinding.LCB_EINTERNAL */
/** @name CouchbaseBinding.LCB_NO_MATCHING_SERVER */
/** @name CouchbaseBinding.LCB_BAD_ENVIRONMENT */
/** @name CouchbaseBinding.LCB_BUSY */
/** @name CouchbaseBinding.LCB_INVALID_USERNAME */
/** @name CouchbaseBinding.LCB_CONFIG_CACHE_INVALID */
/** @name CouchbaseBinding.LCB_SASLMECH_UNAVAILABLE */
/** @name CouchbaseBinding.LCB_TOO_MANY_REDIRECTS */
/** @name CouchbaseBinding.LCB_MAP_CHANGED */
/** @name CouchbaseBinding.LCB_INCOMPLETE_PACKET */
/** @name CouchbaseBinding.LCB_ECONNREFUSED */
/** @name CouchbaseBinding.LCB_ESOCKSHUTDOWN */
/** @name CouchbaseBinding.LCB_ECONNRESET */
/** @name CouchbaseBinding.LCB_ECANTGETPORT */
/** @name CouchbaseBinding.LCB_EFDLIMITREACHED */
/** @name CouchbaseBinding.LCB_ENETUNREACH */
/** @name CouchbaseBinding.LCB_ECTL_UNKNOWN */
/** @name CouchbaseBinding.LCB_ECTL_UNSUPPMODE */
/** @name CouchbaseBinding.LCB_ECTL_BADARG */
/** @name CouchbaseBinding.LCB_EMPTY_KEY */
/** @name CouchbaseBinding.LCB_SSL_ERROR */
/** @name CouchbaseBinding.LCB_SSL_CANTVERIFY */
/** @name CouchbaseBinding.LCB_SCHEDFAIL_INTERNAL */
/** @name CouchbaseBinding.LCB_CLIENT_FEATURE_UNAVAILABLE */
/** @name CouchbaseBinding.LCB_OPTIONS_CONFLICT */
/** @name CouchbaseBinding.LCB_HTTP_ERROR */
/** @name CouchbaseBinding.LCB_DURABILITY_NO_MUTATION_TOKENS */
/** @name CouchbaseBinding.LCB_UNKNOWN_MEMCACHED_ERROR */
/** @name CouchbaseBinding.LCB_MUTATION_LOST */
/** @name CouchbaseBinding.LCB_SUBDOC_PATH_ENOENT */
/** @name CouchbaseBinding.LCB_SUBDOC_PATH_MISMATCH */
/** @name CouchbaseBinding.LCB_SUBDOC_PATH_EINVAL */
/** @name CouchbaseBinding.LCB_SUBDOC_PATH_E2BIG */
/** @name CouchbaseBinding.LCB_SUBDOC_DOC_E2DEEP */
/** @name CouchbaseBinding.LCB_SUBDOC_VALUE_CANTINSERT */
/** @name CouchbaseBinding.LCB_SUBDOC_DOC_NOTJSON */
/** @name CouchbaseBinding.LCB_SUBDOC_NUM_ERANGE */
/** @name CouchbaseBinding.LCB_SUBDOC_BAD_DELTA */
/** @name CouchbaseBinding.LCB_SUBDOC_PATH_EEXISTS */
/** @name CouchbaseBinding.LCB_SUBDOC_MULTI_FAILURE */
/** @name CouchbaseBinding.LCB_SUBDOC_VALUE_E2DEEP */
/** @name CouchbaseBinding.LCB_EINVAL_MCD */
/** @name CouchbaseBinding.LCB_EMPTY_PATH */
/** @name CouchbaseBinding.LCB_UNKNOWN_SDCMD */
/** @name CouchbaseBinding.LCB_ENO_COMMANDS */
/** @name CouchbaseBinding.LCB_QUERY_ERROR */
/** @name CouchbaseBinding.LCB_GENERIC_TMPERR */
/** @name CouchbaseBinding.LCB_GENERIC_SUBDOCERR */
/** @name CouchbaseBinding.LCB_GENERIC_CONSTRAINT_ERR */
/** @name CouchbaseBinding.LCB_HTTP_TYPE_VIEW */
/** @name CouchbaseBinding.LCB_HTTP_TYPE_MANAGEMENT */
/** @name CouchbaseBinding.LCB_HTTP_TYPE_RAW */
/** @name CouchbaseBinding.LCB_HTTP_TYPE_N1QL */
/** @name CouchbaseBinding.LCB_HTTP_TYPE_FTS */
/** @name CouchbaseBinding.LCB_HTTP_TYPE_CBAS */
/** @name CouchbaseBinding.LCB_HTTP_METHOD_GET */
/** @name CouchbaseBinding.LCB_HTTP_METHOD_POST */
/** @name CouchbaseBinding.LCB_HTTP_METHOD_PUT */
/** @name CouchbaseBinding.LCB_HTTP_METHOD_DELETE */
/** @name CouchbaseBinding.LCB_STORE_SET */
/** @name CouchbaseBinding.LCB_STORE_ADD */
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
/** @name CouchbaseBinding.LCB_DURABILITYLEVEL_MAJORITY_AND_PERSIST_ON_MASTER */
/** @name CouchbaseBinding.LCB_DURABILITYLEVEL_PERSIST_TO_MAJORITY */
/** @name CouchbaseBinding.LCBX_SDFLAG_UPSERT_DOC */
/** @name CouchbaseBinding.LCBX_SDFLAG_INSERT_DOC */
/** @name CouchbaseBinding.LCBX_SDFLAG_ACCESS_DELETED */
/** @name CouchbaseBinding.LCB_SUBDOCOPS_F_MKINTERMEDIATES */
/** @name CouchbaseBinding.LCB_SUBDOCOPS_F_XATTRPATH */
/** @name CouchbaseBinding.LCB_SUBDOCOPS_F_XATTR_MACROVALUES */
/** @name CouchbaseBinding.LCB_SUBDOCOPS_F_XATTR_DELETED_OK */
/** @name CouchbaseBinding.LCB_RESP_F_FINAL */
/** @name CouchbaseBinding.LCB_RESP_F_CLIENTGEN */
/** @name CouchbaseBinding.LCB_RESP_F_NMVGEN */
/** @name CouchbaseBinding.LCB_RESP_F_EXTDATA */
/** @name CouchbaseBinding.LCB_RESP_F_SDSINGLE */
/** @name CouchbaseBinding.LCB_RESP_F_ERRINFO */
/** @name CouchbaseBinding.LCBX_VIEWFLAG_INCLUDEDOCS */
/** @name CouchbaseBinding.LCBX_N1QLFLAG_PREPCACHE */
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