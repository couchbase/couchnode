'use strict';

var couchnode = require('bindings')('couchbase_impl');
var util = require('util');
var httpUtil = require('./http.js');
var CBpp = couchnode.CouchbaseImpl;
var CONST = couchnode.Constants;
var HOSTKEY_COMPAT = ['hosts', 'hostname', 'hostnames'];

httpUtil._init(CONST);

/**
 * @class Connection
 *
 * @classdesc
 * An object representing a connection to a Couchbase cluster.
 * Normally, your application should only need to create one of these per
 * process and use it contiously. Operations are executed asynchronously
 * and pipelined when possible.

 * @constructor
 *
 * @param options a dictionary of options to use. Recognized options
 *  are:
 *      'host': a string or an array of strings indicating the hosts to
 *      connect to. If the value is an array, all the hosts in the array
 *      will be tried until one of them succeeds. Default is 'localhost'
 *
 *      'bucket': the bucket to connect to. If not specified, the default is
 *      'default'.
 *
 *      'username', 'password': The credentials for the bucket.
 *
 *
 * Additionally, other options may be passed in this object which correspond
 * to the various settings (see their documentation). For example, it may
 * be helpful to set timeout properties *before* connection.
 *
 * @param callback a callback that will be invoked when the instance is actually
 * connected to the server.
 *
 * Note that it is safe to perform operations on the Couchbase object before
 * the connect callback is invoked. In this case, the operations are queued
 * until the connection is ready (or an unrecoverable error has taken place).
 */
function Connection(options, callback) {
  if (!callback) {
    callback = function(err) {
      if (err) {
        throw err;
      }
    };
  }

  if (typeof options !== 'object') {
    callback(new Error('Options must be an object'));
  }

  var ourObjs = {};
  for (var kName in options) {
    if (options.hasOwnProperty(kName)) {
      ourObjs[kName] = options[kName];
    }
  }

  var hostKey = 'host';
  var hostParam;

  if (ourObjs.hasOwnProperty(hostKey)) {
    hostParam = ourObjs[hostKey];
  } else {
    for (var i in HOSTKEY_COMPAT) {
      var kCompat = HOSTKEY_COMPAT[i];
      if (!ourObjs[kCompat]) {
        continue;
      }
      hostParam = ourObjs[kCompat];
      console.warn(util.format('Using \'%s\' instead of \'host\' ' +
                               'is deprecated', kCompat));
      break;
    }
  }

  var cbArgs = [];
  if (hostParam === undefined) {
    cbArgs[0] = '127.0.0.1:8091';
  } else if (Array.isArray(hostParam)) {
    cbArgs[0] = hostParam.join(';');
  } else {
    cbArgs[0] = hostParam;
  }

  delete ourObjs[hostKey];

  // Bucket
  var argMap = {
    1: ['username', ''],
    2: ['password', ''],
    3: ['bucket', 'default']
  };

  for (var ix in argMap) {
    var spec = argMap[ix];
    var specName = spec[0];
    var specDefault = spec[1];
    var curValue = ourObjs[specName];

    if (!curValue) {
      curValue = specDefault;
    }
    cbArgs[ix] = curValue;

    delete ourObjs[specName];
  }

  try {
    this._cb = new CBpp(cbArgs[0], cbArgs[1], cbArgs[2], cbArgs[3]);
  } catch (e) {
    callback(e);
  }

  for (var prefOption in ourObjs) {
    // Check that it exists:
    var prefValue = ourObjs[prefOption];
    if (typeof this[prefOption] === 'undefined') {
      console.warn('Unknown option: ' + prefOption);
    } else {
      this[prefOption](prefValue);
    }
  }

  this._cb.on('connect', callback);

  try {
    this._cb._connect();
  } catch(e) {
    callback(e);
  }
}

/**
 * Merge existing parameters into key-specific ones
 * @private
 */
function _mergeParams(key, kParams, gParams) {
  var ret = {};
  ret[key] = kParams;
  for (var opt in gParams) {
    // ignore the value parameter as it conflicts with our current one
    if (opt !== 'value') {
      kParams[opt] = gParams[opt];
    }
  }
  return ret;
}

/** Common entry point for single-key storage functions
 * @private
 */
Connection.prototype._invokeStorage = function(tgt, argList) {
  var meta, callback;
  if (argList.length === 3) {
    meta = {};
    meta[argList[0]] = { value: argList[1] };
    callback = argList[2];
  } else {
    meta = _mergeParams(argList[0], { value: argList[1] }, argList[2] );
    callback = argList[3];
  }
  tgt.call(this._cb, meta, null, callback);
};

/**
 * Helper to magically invoke a *multi method properly depending on
 * whether to pass the optional "middle" arg
 * @private
 */
Connection.prototype._argHelper2 = function(target, argList) {
  if (argList.length === 2) {
    target.call(this._cb, [argList[0]], null, argList[1]);
  } else {
    target.call(this._cb, [argList[0]], argList[1], argList[2]);
  }
};

/** like argHelper2, but also merges params if they exist
 * @private
 */
Connection.prototype._argHelperMerge2 = function(target, argList) {
  if (argList.length === 2) {
    target.call(this._cb, [argList[0]], null, argList[1]);
  } else {
    target.call(this._cb, _mergeParams(argList[0], {}, argList[1]), argList[2]);
  }
};

/** Invokes arithmetic functions
 * @private
 */
Connection.prototype._arithHelper = function(dfl, argList) {
  var tgt, kdict, callback, key;
  key = argList[0];

  if (argList.length === 2) {
    kdict = {};
    kdict[key] = { offset: dfl };
    callback = argList[1];

  } else {
    kdict = _mergeParams(key, {}, argList[1]);
    if (kdict[key].offset !== undefined) {
      kdict[key].offset *= dfl;
    } else {
      kdict[key].offset = dfl;
    }
    callback = argList[2];
  }
  this._cb.arithmeticMulti(kdict, null, callback);
}

/**
 * The <i>CAS</i> value is a special object which indicates the current state
 * of the item on the server. Each time an object is mutated on the server, the
 * value is changed. <i>CAS</i> objects can be used in conjunction with
 * mutation operations to ensure that the value on the server matches the local
 * value retrieved by the client.
 *
 * In Couchnode, this is an opaque value. As such, you cannot generate
 * <i>CAS</i> objects, but rather you must use them when they are returned
 * in a {@link KeyCallback}.
 *
 * @typedef {object} CAS
 */

/**
 * Single-Key callbacks.
 * This callback is passed to all of the single key functions.
 *
 * @callback KeyCallback
 * @param {number|object|undefined} error
 *  The error for the operation. This can either be a number or an object
 *  or a false value.
 *  <br>
 *  If an error occurred, the error is set either to the
 *  <i>libcouchbase</i> error code <i>or</i> an exception object; depending
 *  on when and where the error happened.
 *
 *  While it is possible to place an object for the libcouchbase error code
 *  itself, some errors (for example, cache misses) would incur additional
 *  overhead in constructing said object; and as such are not converted into
 *  objects.
 *
 * @param {object} result
 *  The result of the operation. Common fields follow:
 *  @param {string} result.value Value of the operation (only applicable
 *   for operations which retrieve data)
 *  @param {CAS} result.cas Opaque <i>CAS</i> value.
 *
 * A typical use pattern is to pass the <i>result></i> parameter from the
 * callback as the <i>options</i> parameter to one of the next operations.
 * This is useful in order to maintain "cas consistency"
 */


/**
 * Get a key from the cluster
 *
 * @param {string} key the key to retrieve
 * @param {object} [options] additional options for this operation
 *  @config expiry A new expiration time for the item. This makes the
 *  <i>Get</i> operation into a <i>Get-And-Touch</i> operation.
 *
 * @param {KeyCallback} callback
 *  the callback to be invoked when complete.
 *  The second argument of the callback shall contain the following
 *  fields:
 *  @config {string} value The value for the item
 *  @config {CAS} cas The CAS returned from the server
 *  @config {integer} flags The server-side 32 bit flags. See
 *    {@link Connection.set} for more information
 */
Connection.prototype.get = function(key, options, callback) {
  this._argHelper2(this._cb.getMulti, arguments);
};

/**
 * Update the item's expiration time in the cluster.
 *
 * @param {string} key the key to retrieve
 *
 * @param {object=} options additional options for this operation:
 *  @config {integer} expiry the expiration time to use. If no
 *  value is provided, then the current expiration time is cleared
 *  and the key is set to never expire. Otherwise, the key is
 *  updated to expire in the value provided, in seconds.
 *  @config
 *
 * @param {KeyCallback} callback.
 *  @config {CAS} cas
 */
Connection.prototype.touch = function(key, options, callback) {
  this._argHelper2(this._cb.touchMulti, arguments);
};

/**
 * Lock the object on the server and retrieve it. When an object is locked,
 * its CAS changes and subsequent operations on the object (without providing
 * the current CAS) will fail until the lock is no longer held.
 *
 * This function behaves identically to {@link get}
 *
 * @param {string} key the item to lock
 * @param {object=} options options to use.
 *  @config {integer} expiry the duration of time the lock should be held for.
 *  If this value is not provided, it will use the default server-side lock
 *  duration which is 15 seconds. Note that the maximum duration for a lock
 *  is 30 seconds, and if a higher value is specified, it will be rounded to
 *  this number
 *
 * @param {KeyCallback} callback
 *  The result in this callback contains the same fields as a
 *  {@linkcode Connection#get} operation.
 *
 * Once locked, an item can be unlocked either by explicitly calling
 * {@linkcode #unlock}
 * or by performing a storage operation (e.g. set, replace, append) with
 * the current CAS value.
 */
Connection.prototype.lock = function(key, options, callback) {
  this._argHelper2(this._cb.lockMulti, arguments);
};

/**
 * Delete a key on the server.
 *
 * @param {string} key the key to remove
 * @param {object=} options the options to use.
 *  @config {CAS} cas
 *  the CAS value to check. If the item on the server contains a different
 *  CAS value, the operation will fail.
 * @param {KeyCallback} callback
 */
Connection.prototype.delete = function(key, options, callback) {
  this._argHelperMerge2(this._cb.deleteMulti, arguments);
};

Connection.prototype.remove = Connection.prototype.delete;

/**
 * Unlock a previously locked item on the server
 * @param {string} key the key to unlock
 * @param {object}
 *  @param {CAS} cas. <b>mandatory</b> parameter, which should contain
 *  the CAS provided by a previous {@link lock} operation
 */
Connection.prototype.unlock = function(key, meta, callback) {
  this._argHelperMerge2(this._cb.unlockMulti, arguments);
};

/**
 * Store a key on the server, setting its value
 * @param {string} key the key to store
 * @param {string} value the value the key shall contain
 * @param {object=} options. Options are:
 *  @config {CAS} cas value to use. If the CAS on the server
 *   does not match this value, it is assumed the object has been
 *   modified previously, and should be re-fetched
 *   (via {@linkcode Connection#get} and re-transformed). Note that this
 *   check only happens if this option is set.
 *
 *   @config {integer} expiry set initial expiration for the item
 *   @config {integer} flags 32 bit value to use for the item. Note that this
 *    value is not currently used by couchnode, but is used by other clients and
 *    may be used by Couchnode in the future. The only use case for setting
 *    this value should be intra-client compatibility. Conventionally this
 *    value is used for indicating the storage format of the value.
 *
 * @param {KeyCallback} callback
 *
 * Note that if the meta already contains a 'value' field (e.g. from a callback
 * invoked after a get or getEx operation), it is ignored.
 */
Connection.prototype.set = function(key, value, options, callback) {
  this._invokeStorage(this._cb.setMulti, arguments);
};

/**
 * Like {@linkcode Connection#set} but will fail if the key already exists
 * @param {string} key
 * @param {string} value
 * @param {object=} options
 *  @config {integer} expiry
 *  @config {integer} flags
 * @param {KeyCallback} callback
 */
Connection.prototype.add = function(key, value, options, callback) {
  this._invokeStorage(this._cb.addMulti, arguments);
};

/**
 * Like {@linkcode Connection#set}, but will only succeed if the key exists (i.e.
 * the inverse of add())
 * @param {string} key
 * @param {string} value
 * @param {object=} options
 *  @config {integer} expiry
 *  @config {integer} flags
 *  @config {CAS} cas
 * @param {KeyCallback} callback
 */
Connection.prototype.replace = function(key, options, callback) {
  this._invokeStorage(this._cb.replaceMulti, arguments);
};

/**
 * Like {@linkcode Connection#set},
 * but instead of setting a new value, it appends data
 * to the existing value. Note that this function only makes sense when
 * the stored item is a string; 'appending' JSON may result in parse
 * errors when the value is later retrieved
 *
 * @param {string} key
 * @param {string} value
 * @param {object=} options
 *  @config {integer} expiry
 *  @config {integer} flags
 *  @config {CAS} cas
 * @param {KeyCallback} callback
 */
Connection.prototype.append = function(key, meta, callback) {
  this._invokeStorage(this._cb.appendMulti, arguments);
};

/**
 * Like {@linkcode Connection#append}, but prepends data to the existing value.
 * @param {string} key
 * @param {string} value
 * @param {object=} options
 *  @config {integer} expiry
 *  @config {integer} flags
 *  @config {CAS} cas
 * @param {KeyCallback} callback
 */
Connection.prototype.prepend = function(key, meta, callback) {
  this._invokeStorage(this._cb.prependMulti, arguments);
};

/**
 * Increments the key's numeric value. This is an atomic operation
 * and more efficient than set() if the value is a number.
 *
 * Note that JavaScript does not support 64 bit integers (while libcouchbase
 * and the server does). You may end up receiving an invalid value if the
 * existing number is greater than 64 bits
 *
 * @param {string} key the key to increment
 * @param {object=} meta options. Options are:
 *  @config {integer} offset The amount by which to increment.
 *    @default 1
 *  @config {integer} initial The initial value to use if the key does
 *    not exist. If this is not supplied and the key does not exist, the
 *    operation will fail
 *
 *  @config {integer} expiry the expiration time for the key
 *
 * @param {KeyCallback} callback
 *  Invoked with the following fields in the response:
 *  @config {integer} value the current value of the item
 *  @config {CAS} cas
 * Note that as this operation is atomic, no 'cas' parameter is provided.
 * If the key already exists but its value is not numeric, an error will be
 * provided to the callback
 */
Connection.prototype.incr = function(key, options, callback) {
  this._arithHelper(1, arguments);
};

/**
 * Decrements the key's numeric value. Follows same semantics as
 * {@linkcode Connection#incr}
 * with the exception that the <code>offset</code> parameter is the amount by
 * which to decrement the existing value
 *
 * @param {string} key
 * @param {object=} options
 *  @config {integer} offset
 *  @config {integer} initial
 *  @config {integer} expiry
 * @param {KeyCallback} callback.
 */
Connection.prototype.decr = function(key, options, callback) {
  this._arithHelper(-1, arguments);
};


Connection.prototype._multiHelper = function(target, argList) {
  var options = argList[1];
  if (!options) {
    options = { spooled: true };
  } else if (! 'spooled' in options) {
    options = { spooled: true };
    for (var k in argList[1]) {
      options[k] = argList[1][k];
    }
  }
  target.call(this._cb, argList[0], options, argList[2]);
}

Connection.prototype.setMulti = function(kv, meta, callback) {
  this._multiHelper(this._cb.setMulti, arguments);
};

Connection.prototype.addMulti = function(kv, meta, callback) {
  this._multiHelper(this._cb.addMulti, arguments)
};

Connection.prototype.replaceMulti = function(kv, meta, callback) {
  this._multiHelper(this._cb.replaceMulti, arguments);
};

Connection.prototype.appendMulti = function(kv, meta, callback) {
  this._multiHelper(this._cb.appendMulti, arguments);
};

Connection.prototype.prependMulti = function(kv, meta, callback) {
  this._multiHelper(this._cb.prependMulti, arguments);
};

Connection.prototype.getMulti = function(kv, meta, callback) {
  this._multiHelper(this._cb.getMulti, arguments);
};

Connection.prototype.lockMulti = function(kv, meta, callback) {
  this._multiHelper(this._cb.lockMulti, arguments);
};

Connection.prototype.unlockMulti = function(kv, meta, callback) {
  this._multiHelper(this._cb.unlockMulti, arguments);
};

Connection.prototype.deleteMulti = function(kv, meta, callback) {
  this._multiHelper(this._cb.deleteMulti, arguments);
};

Connection.prototype.removeMulti = Connection.prototype.deleteMulti;


/**
 * @callback StatsCallback
 * @param {Error} error
 * @param {object} results an object containing per-server, per key entries
 *
 * @example:
 *  {
 *    '127.0.0.1:11210': { mem_used: 12345, mem_available: 44 },
 *    '10.0.0.99:11210': { mem_used: 1224, mem_available: 42 }
 *  }
 */

/**
 * Retrieves various server statistics
 * @param {string=} key An optional stats key to specify which groups of
 *  statistics are returned. If not specified, returns the "default" statistics.
 *  Consult the server documentation for more information on which statistic
 *  groups are available
 *
 * @param {StatsCallback} callback a callback to be invoked.
 */
Connection.prototype.stats = function(key, callback) {
  if (arguments.length == 1) {
    key = "";
    callback = arguments[0];
  }
  this._cb.stats(key, null, callback);
}


Connection.prototype._httpRequest = function(params, callback) {
  this._cb.httpRequest(params, null, callback);
}

// Initialize

Connection.prototype.on = function() {
  this._cb.on.apply(this._cb, arguments);
};

/** Handy and Informational Functions */
Connection.prototype.shutdown = function() {
  this._cb.shutdown();
};

Connection.prototype._ctl = function(cc, argList) {
  if (argList.length === 1) {
    return this._cb._control(cc, CONST.LCB_CNTL_SET, argList[0]);
  } else if (argList.length === 0) {
    return this._cb._control(cc, CONST.LCB_CNTL_GET);
  } else {
    throw new Error('Function takes 0 or 1 arguments');
  }
};

/**
 * Sets or gets the operation timeout. The operation timeout is the time
 * that Connection will wait for a response from the server. If the response
 * is not received within this time frame, the operation is bailed out with
 * an error.
 *
 * If called with no arguments, returns the current value. If called with
 * a single argument, the value is updated
 * @param msecs the timeout in milliseconds
 */
Connection.prototype.operationTimeout = function(msecs) {
  return this._ctl(CONST.LCB_CNTL_OP_TIMEOUT, arguments);
};

/**
 * Sets or gets the connection timeout. This is the timeout value used when
 * connecting to the configuration port during the initial connection (in this
 * case, use this as a key in the 'options' parameter in the constructor) and/or
 * when Connection attempts to reconnect in-situ (if the current connection
 * has failed)
 *
 * @param msecs the timeout in milliseconds
 */
Connection.prototype.connectionTimeout = function(msecs) {
  return this._ctl(CONST.LCB_CNTL_OP_TIMEOUT, arguments);
};

/**
 * Get information about the libcouchbase version being used.
 * @return an array of [versionNumber, versionstring], where
 * @c versionNumber is a hexadecimal number of 0x021002 - in this
 * case indicating version 2.1.2.
 *
 * Depending on the build type, this might include some other information
 * not listed here.
 */
Connection.prototype.lcbVersion = function() {
  return this._ctl(CONST.CNTL_LIBCOUCHBASE_VERSION, arguments);
};

/**
 * Get information about the Couchnode version (i.e. this library)
 * @return an array of [versionNumber, versionstring]
 */
Connection.prototype.clientVersion = function() {
  return this._ctl(CONST.CNTL_COUCHNODE_VERSION, arguments);
};

/**
 * Get an array of active nodes in the cluster
 */
Connection.prototype.serverNodes = function() {
  return this._ctl(CONST.CNTL_CLNODES, arguments);
};

/**
 * @static
 * Return the string representation of an error code
 * @param {integer} code a code of an error thrown by the library
 * @returns {string} The string description
 */
Connection.prototype.strError = function(code) {
  return this._cb.strError(code);
}


// View stuff
Connection.prototype.view = function(ddoc, name, query, callback) {
  httpUtil.view(this._cb, ddoc, name, query, callback);
};

Connection.prototype.setDesignDoc = function(name, data, callback) {
  httpUtil.setDesignDoc(this._cb, name, data, callback);
};

Connection.prototype.getDesignDoc = function(name, callback) {
  httpUtil.getDesignDoc(this._cb, name, callback);
};

Connection.prototype.deleteDesignDoc = function(name, callback) {
  httpUtil.deleteDesignDoc(this._cb, name, callback);
};

module.exports.Connection = Connection;

/**
 * Error Definititons
 */
module.exports.errors = {
  // Libcouchbase codes:
  success: 0,
  authContinue: CONST.LCB_AUTH_CONTINUE,
  authError: CONST.LCB_AUTH_ERROR,
  deltaBadVal: CONST.LCB_DELTA_BADVAL,
  objectTooBig: CONST.LCB_E2BIG,
  serverBusy: CONST.LCB_EBUSY,

  cLibInternal: CONST.LCB_EINTERNAL,
  cLibInvalidArgument: CONST.LCB_EINVAL,
  cLibOutOfMemory: CONST.LCB_ENOMEM,

  invalidRange: CONST.LCB_ERANGE,
  cLibGenericError: CONST.LCB_ERROR,

  // key-related errors
  temporaryError: CONST.LCB_ETMPFAIL,
  keyAlreadyExists: CONST.LCB_KEY_EEXISTS,
  keyNotFound: CONST.LCB_KEY_ENOENT,

  // dlopen errors
  failedToOpenLibrary: CONST.LCB_DLOPEN_FAILED,
  failedToFindSymbol: CONST.LCB_DLSYM_FAILED,

  networkError: CONST.LCB_NETWORK_ERROR,
  wrongServer: CONST.LCB_NOT_MY_VBUCKET,
  notMyVBucket: CONST.LCB_NOT_MY_VBUCKET,
  notStored: CONST.LCB_NOT_STORED,
  notSupported: CONST.LCB_NOT_SUPPORTED,
  unknownCommand: CONST.LCB_UNKNOWN_COMMAND,
  unknownHost: CONST.LCB_UNKNOWN_HOST,
  protocolError: CONST.LCB_PROTOCOL_ERROR,
  timedOut: CONST.LCB_ETIMEDOUT,
  connectError: CONST.LCB_CONNECT_ERROR,
  bucketNotFound: CONST.LCB_BUCKET_ENOENT,
  clientOutOfMemory: CONST.LCB_CLIENT_ENOMEM,
  clientTemporaryError: CONST.LCB_CLIENT_ETMPFAIL,
  badHandle: CONST.LCB_EBADHANDLE,
  serverBug: CONST.LCB_SERVER_BUG,
  invalidHostFormat: CONST.LCB_INVALID_HOST_FORMAT,
  notEnoughNodes: CONST.LCB_DURABILITY_ETOOMANY,
  duplicateItems: CONST.LCB_DUPLICATE_COMMANDS,
  noMatchingServerForKey: CONST.LCB_NO_MATCHING_SERVER,
  badEnvironmentVariable: CONST.LCB_BAD_ENVIRONMENT,

  // Other client errors:
  outOfMemory: CONST['ErrorCode::MEMORY'],
  invaldiArguments: CONST['ErrorCode::ARGUMENTS'],
  schedulingError: CONST['ErrorCode::SCHEDULING'],
  checkResults: CONST['ErrorCode::CHECK_RESULTS'],
  genericError: CONST['ErrorCode::GENERIC']

};
