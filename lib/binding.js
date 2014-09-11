'use strict';

var util = require('util');

/**
 * Represents the C/C++ binding layer that the Node.js SDK is built upon.
 * This library handles all network I/O along with most configuration and
 * bootstrapping requirements.
 * @external CouchbaseBinding
 */
/**
 * @class CouchbaseBinding.Error
 * @private
 * @ignore
 */
/**
 * @class CouchbaseBinding.CouchbaseImpl
 * @private
 * @ignore
 */
/** @name CouchbaseBinding.CouchbaseImpl#shutdown */
/** @name CouchbaseBinding.CouchbaseImpl#control */
/** @name CouchbaseBinding.CouchbaseImpl#connect */
/** @name CouchbaseBinding.CouchbaseImpl#getViewNode */
/** @name CouchbaseBinding.CouchbaseImpl#getMgmtNode */
/** @name CouchbaseBinding.CouchbaseImpl#setConnectCallback */
/** @name CouchbaseBinding.CouchbaseImpl#setTranscoder */
/** @name CouchbaseBinding.CouchbaseImpl#lcbVersion */
/** @name CouchbaseBinding.CouchbaseImpl#get */
/** @name CouchbaseBinding.CouchbaseImpl#getReplica */
/** @name CouchbaseBinding.CouchbaseImpl#touch */
/** @name CouchbaseBinding.CouchbaseImpl#unlock */
/** @name CouchbaseBinding.CouchbaseImpl#remove */
/** @name CouchbaseBinding.CouchbaseImpl#store */
/** @name CouchbaseBinding.CouchbaseImpl#arithmetic */
/** @name CouchbaseBinding.CouchbaseImpl#durability */
/** @name CouchbaseBinding.CouchbaseImpl#_errorTest */
/**
 * @namespace CouchbaseBinding.Constants
 * @ignore
 */
/** @name CouchbaseBinding.Constants.CNTL_SET */
/** @name CouchbaseBinding.Constants.CNTL_GET */
/** @name CouchbaseBinding.Constants.CNTL_OP_TIMEOUT */
/** @name CouchbaseBinding.Constants.CNTL_DURABILITY_INTERVAL */
/** @name CouchbaseBinding.Constants.CNTL_DURABILITY_TIMEOUT */
/** @name CouchbaseBinding.Constants.CNTL_HTTP_TIMEOUT */
/** @name CouchbaseBinding.Constants.CNTL_VIEW_TIMEOUT */
/** @name CouchbaseBinding.Constants.CNTL_RBUFSIZE */
/** @name CouchbaseBinding.Constants.CNTL_WBUFSIZE */
/** @name CouchbaseBinding.Constants.CNTL_CONFIGURATION_TIMEOUT */
/** @name CouchbaseBinding.Constants.CNTL_VBMAP */
/** @name CouchbaseBinding.Constants.CNTL_CONFIG_HTTP_NODES */
/** @name CouchbaseBinding.Constants.CNTL_CONFIG_CCCP_NODES */
/** @name CouchbaseBinding.Constants.CNTL_CHANGESET */
/** @name CouchbaseBinding.Constants.CNTL_CONFIG_ALL_NODES */
/** @name CouchbaseBinding.Constants.CNTL_CONFIGCACHE */
/** @name CouchbaseBinding.Constants.CNTL_SSL_MODE */
/** @name CouchbaseBinding.Constants.CNTL_SSL_CACERT */
/** @name CouchbaseBinding.Constants.CNTL_RETRYMODE */
/** @name CouchbaseBinding.Constants.CNTL_HTCONFIG_URLTYPE */
/** @name CouchbaseBinding.Constants.CNTL_COMPRESSION_OPTS */
/** @name CouchbaseBinding.Constants.CNTL_RDBALLOCFACTORY */
/** @name CouchbaseBinding.Constants.CNTL_SYNCDESTROY */
/** @name CouchbaseBinding.Constants.CNTL_CONLOGGER_LEVEL */
/** @name CouchbaseBinding.Constants.CNTL_DETAILED_ERRCODES */
/** @name CouchbaseBinding.Constants.CNTL_REINIT_DSN */
/** @name CouchbaseBinding.Constants.CNTL_CONFDELAY_THRESH */
/** @name CouchbaseBinding.Constants.CNTL_CONFIG_NODE_TIMEOUT */
/** @name CouchbaseBinding.Constants.ADD */
/** @name CouchbaseBinding.Constants.REPLACE */
/** @name CouchbaseBinding.Constants.SET */
/** @name CouchbaseBinding.Constants.APPEND */
/** @name CouchbaseBinding.Constants.PREPEND */
/** @name CouchbaseBinding.Constants.SUCCESS */
/** @name CouchbaseBinding.Constants.AUTH_CONTINUE */
/** @name CouchbaseBinding.Constants.AUTH_ERROR */
/** @name CouchbaseBinding.Constants.DELTA_BADVAL */
/** @name CouchbaseBinding.Constants.E2BIG */
/** @name CouchbaseBinding.Constants.EBUSY */
/** @name CouchbaseBinding.Constants.ENOMEM */
/** @name CouchbaseBinding.Constants.ERANGE */
/** @name CouchbaseBinding.Constants.ERROR */
/** @name CouchbaseBinding.Constants.ETMPFAIL */
/** @name CouchbaseBinding.Constants.EINVAL */
/** @name CouchbaseBinding.Constants.CLIENT_ETMPFAIL */
/** @name CouchbaseBinding.Constants.KEY_EEXISTS */
/** @name CouchbaseBinding.Constants.KEY_ENOENT */
/** @name CouchbaseBinding.Constants.DLOPEN_FAILED */
/** @name CouchbaseBinding.Constants.DLSYM_FAILED */
/** @name CouchbaseBinding.Constants.NETWORK_ERROR */
/** @name CouchbaseBinding.Constants.NOT_MY_VBUCKET */
/** @name CouchbaseBinding.Constants.NOT_STORED */
/** @name CouchbaseBinding.Constants.NOT_SUPPORTED */
/** @name CouchbaseBinding.Constants.UNKNOWN_COMMAND */
/** @name CouchbaseBinding.Constants.UNKNOWN_HOST */
/** @name CouchbaseBinding.Constants.PROTOCOL_ERROR */
/** @name CouchbaseBinding.Constants.ETIMEDOUT */
/** @name CouchbaseBinding.Constants.BUCKET_ENOENT */
/** @name CouchbaseBinding.Constants.CLIENT_ENOMEM */
/** @name CouchbaseBinding.Constants.CONNECT_ERROR */
/** @name CouchbaseBinding.Constants.EBADHANDLE */
/** @name CouchbaseBinding.Constants.SERVER_BUG */
/** @name CouchbaseBinding.Constants.PLUGIN_VERSION_MISMATCH */
/** @name CouchbaseBinding.Constants.INVALID_HOST_FORMAT */
/** @name CouchbaseBinding.Constants.INVALID_CHAR */
/** @name CouchbaseBinding.Constants.DURABILITY_ETOOMANY */
/** @name CouchbaseBinding.Constants.DUPLICATE_COMMANDS */
/** @name CouchbaseBinding.Constants.EINTERNAL */
/** @name CouchbaseBinding.Constants.NO_MATCHING_SERVER */
/** @name CouchbaseBinding.Constants.BAD_ENVIRONMENT */
/** @name CouchbaseBinding.Constants.HTTP_TYPE_VIEW */
/** @name CouchbaseBinding.Constants.HTTP_TYPE_MANAGEMENT */
/** @name CouchbaseBinding.Constants.HTTP_METHOD_GET */
/** @name CouchbaseBinding.Constants.HTTP_METHOD_POST */
/** @name CouchbaseBinding.Constants.HTTP_METHOD_PUT */
/** @name CouchbaseBinding.Constants.HTTP_METHOD_DELETE)

/**
 * Attempts to load a binding by path ignoring not-found errors.
 *
 * @param {string} path The path to the binding to attempt loading.
 * @returns {CouchbaseBinding}
 *
 * @ignore
 */
function tryLoadBinding(path) {
  try {
    return require('bindings')(path);
  } catch(e) {
    if (!e.message.match(/Could not load the bindings file/) &&
        !e.message.match(/invalid ELF/)) {
      throw e;
    }
  }
  return null;
}

/**
 * @type {CouchbaseBinding}
 * @ignore
 */
var couchnode = tryLoadBinding('couchbase_impl');
if (!couchnode) {
  // Try to load prebuilt windows binaries
  if (process.arch === 'x64') {
    couchnode = tryLoadBinding('../prebuilt/win/x64/couchbase_impl');
  } else if (process.arch === 'ia32') {
    couchnode = tryLoadBinding('../prebuilt/win/ia32/couchbase_impl');
  }
}
if (!couchnode) {
  throw new Error('Failed to locate couchnode native binding' +
    ' (maybe check builderror.log!)');
}

module.exports = couchnode;
