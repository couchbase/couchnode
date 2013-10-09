'use strict';

var couchnode = require('bindings')('couchbase_impl');
var util = require('util');
var httpUtil = require('./http.js');
var viewQuery = require('./viewQuery');
var CBpp = couchnode.CouchbaseImpl;
var CONST = couchnode.Constants;
var HOSTKEY_COMPAT = ['hosts', 'hostname', 'hostnames'];
var fs = require('fs');
var path = require('path');
httpUtil._init(CONST);
viewQuery._init(CONST);

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
 * @param {object=} options A dictionary of options to use.
 * Additionally, other options may be passed in this object which correspond
 * to the various settings (see their documentation). For example, it may
 * be helpful to set timeout properties *before* connection.
 *   @param {string|array=} options.host
 *   a string or an array of strings indicating the hosts to
 *   connect to. If the value is an array, all the hosts in the array
 *   will be tried until one of them succeeds. Default is 'localhost'
 *   @param {string=} options.bucket
 *   The bucket to connect to. If not specified, the default is
 *   'default'.
 *   @param {string=} options.password
 *   Password for the bucket, if the bucket is password-protected
 * @param {Function} callback
 * A callback that will be invoked when the
 * instance is actually connected to the server. Note that this isn't
 * actually required - however if the connection fails, an exception
 * will be thrown if the callback is not provided.
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
    return callback(new Error('Options must be an object'));
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
      delete ourObjs[kCompat];
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

  // Ensure username is bucket name if passed.
  if (cbArgs[1] && cbArgs[1] != cbArgs[3]) {
    return callback(new Error('Username must match bucket name (see password in documentation for password protected buckets)'));
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
      this[prefOption] = prefValue;
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
 * Merge existing parameters into key-specific ones.
 *
 * @private
 * @ignore
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

function _endureError(innerError)
{
  var out_error = new Error('Durability requirements failed');
  out_error.code = CONST['ErrorCode::DURABILITY_FAILED'];
  out_error.innerError = innerError;
  return out_error;
}

/** Common callback interceptor for durability requirements
 *
 * @private
 * @ignore
 */
Connection.prototype._interceptEndure = function(key, options, globalOptions, is_delete, callback) {
  var endure_options;

  if (options === undefined) {
    options = {};
  }
  if (globalOptions === undefined) {
    globalOptions = {};
  }
  if (key && options !== null) {
    // if key is specified, this is a SINGLE call, so our globalOptions end up in the options
    globalOptions = options[key];
  }

  var needs_endure = false;
  if (!globalOptions.persist_to && !globalOptions.replicate_to) {
    // leave early if we can
    return callback;
  }

  // copy only the important options
  var endure_options = {
    persist_to: globalOptions.persist_to,
    replicate_to: globalOptions.replicate_to,
    spooled: globalOptions.spooled,
    is_delete: is_delete
  };

  // Return our interceptor
  var _this = this;
  return function(err, results) {
    if(globalOptions.spooled) {
      // returns object of results
      var endure_kv = {};
      var endure_count = 0;
      for(var result_key in results) {
        if (!results[result_key].error) {
          endure_kv[result_key] = {
            cas: results[result_key].cas
          };
          endure_count++;
        }
      }

      if (endure_count < 0) {
        callback(err, results);
        return;
      }

      _this._cb.endureMulti(endure_kv, endure_options, function(endure_err, endure_results) {
        for(var endure_key in endure_results) {
          if(endure_results[endure_key].error) {
            results[endure_key].error = endure_results[endure_key].error;
          }
        }
        callback(err||endure_err, results);
      });

    } else {
      // returns one result
      if (err) {
        callback(err, results);
        return;
      }

      var endure_kv = {};
      endure_kv[key] = results;
      _this._cb.endureMulti(endure_kv, endure_options, function(endure_err, endure_results) {
        if(endure_err) {
          callback(_endureError(endure_err), results);
          return;
        }

        callback(err, results);
      });
    }
  };
};

/** Common entry point for single-key storage functions.
 *
 * @private
 * @ignore
 */
Connection.prototype._invokeStorage = function(tgt, argList) {
  var options, callback;
  if (argList.length === 3) {
    options = {};
    options[argList[0]] = { value: argList[1] };
    callback = argList[2];
  } else {
    options = _mergeParams(argList[0], { value: argList[1] }, argList[2] );
    callback = argList[3];
  }
  tgt.call(this._cb, options, null,
      this._interceptEndure(argList[0], options, {}, false, callback));
};

/**
 * Helper to magically invoke a *multi method properly depending on
 * whether to pass the optional "middle" arg.
 *
 * @private
 * @ignore
 */
Connection.prototype._argHelper2 = function(target, argList) {
  if (argList.length === 2) {
    target.call(this._cb, [argList[0]], null, argList[1]);
  } else {
    target.call(this._cb, [argList[0]], argList[1], argList[2]);
  }
};

/** Like argHelper2, but also merges params if they exist.
 *
 * @private
 * @ignore
 */
Connection.prototype._argHelperMerge2 = function(target, argList) {
  if (argList.length === 2) {
    target.call(this._cb, [argList[0]], null, argList[1]);
  } else {
    target.call(this._cb, _mergeParams(argList[0], {}, argList[1]), argList[2]);
  }
};

/** Like argHelperMerge2, but specifically managed remove for endure interception
 *
 * @private
 * @ignore
 */
Connection.prototype._argHelperRemove = function(target, argList) {
  if (argList.length === 2) {
    target.call(this._cb, [argList[0]], null, argList[1]);
  } else {
    var options = _mergeParams(argList[0], {}, argList[1]);
    target.call(this._cb, options,
        this._interceptEndure(argList[0], options, {}, true, argList[2]));
  }
};

/** Invokes arithmetic functions.
 *
 * @private
 * @ignore
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
  this._cb.arithmeticMulti(kdict, null,
      this._interceptEndure(key, kdict, {}, false, callback));
};

/**
 * The <i>CAS</i> value is a special object which indicates the current state
 * of the item on the server. Each time an object is mutated on the server, the
 * value is changed. <i>CAS</i> objects can be used in conjunction with
 * mutation operations to ensure that the value on the server matches the local
 * value retrieved by the client.
 *
 * In Couchnode, this is an opaque value. As such, you cannot generate
 * <i>CAS</i> objects, but should rather use the values returned from a
 * {@link KeyCallback}.
 *
 * @typedef {object} CAS
 */

/**
 * Single-Key callbacks.
 * This callback is passed to all of the single key functions.
 *
 * A typical use pattern is to pass the <i>result></i> parameter from the
 * callback as the <i>options</i> parameter to one of the next operations.
 *
 * @callback KeyCallback
 * @param {undefined|Error} error
 *  The error for the operation. This can either be an Error object
 *  or a false value. The error contains the following fields:
 *  @param {integer} error.code The error code. This is one of the codes
 *   in <code>Couchbase.errors</code>
 *  While it is possible to place an object for the libcouchbase error code
 *  itself, some errors (for example, cache misses) would incur additional
 *  overhead in constructing said object; and as such are not converted into
 *  objects.
 * @param {object} result
 *  The result of the operation. Common fields follow:
 *  @config {string} result.value Value of the operation (only applicable
 *   for operations which retrieve data)
 *  @config {CAS} result.cas Opaque <i>CAS</i> value.
 *  @config {undefined|Error} the error object (same as the first parameter)
 */


/**
 * Get a key from the cluster.
 *
 * @param {string} key the key to retrieve
 * @param {object} [options] additional options for this operation
 *   @param {integer} options.expiry
 *   A new expiration time for the item. This makes the
 *   <i>Get</i> operation into a <i>Get-And-Touch</i> operation.
 *   @param {integer|string}options.format
 *   Instructs the library not to attempt conversion based on the flags,
 *   and to return the value in the format specified instead.
 * @param {KeyCallback} callback
 *  the callback to be invoked when complete.
 *  The second argument of the callback shall contain the following
 *  fields:
 *  @config {string|object|Buffer} value The value for the item
 *  @config {CAS} cas The CAS returned from the server
 *  @config {integer} flags The server-side 32 bit flags. See
 *    {@link Connection.set} for more information
 *
 * @see Connection#set
 * @see Connection#getMulti
 */
Connection.prototype.get = function(key, options, callback) {
  this._argHelper2(this._cb.getMulti, arguments);
};

/**
 * Update the item's expiration time in the cluster.
 *
 * @param {string} key the key to retrieve
 * @param {object=} options additional options for this operation
 *   @param {integer} options.expiry
 *   The expiration time to use. If no value is provided, then the
 *   current expiration time is cleared and the key is set to
 *   never expire. Otherwise, the key is updated to expire in the
 *   value provided, in seconds.
 *   @param {CAS} options.cas
 * @param {KeyCallback} callback.
 *
 * @see Connection#touchMulti
 */
Connection.prototype.touch = function(key, options, callback) {
  this._argHelper2(this._cb.touchMulti, arguments);
};

/**
 * Lock the object on the server and retrieve it. When an object is locked,
 * its CAS changes and subsequent operations on the object (without providing
 * the current CAS) will fail until the lock is no longer held.
 *
 * This function behaves identically to {@link get} in that it will return the
 * value. It differs in that the key is also locked. This ensures that
 * attempts by other client instances to access this item while the lock is
 * held will fail.
 *
 * Once locked, an item can be unlocked either by explicitly calling
 * {@linkcode Connection#unlock}
 * or by performing a storage operation (e.g. set, replace, append) with
 * the current CAS value.  Note that any retrieval operations will fail
 * while an item is locked.
 *
 * @param {string} key the item to lock
 * @param {object=} options options to use.
 *   @param {integer} options.expiry
 *   The duration of time the lock should be held for.
 *   If this value is not provided, it will use the default server-side lock
 *   duration which is 15 seconds. Note that the maximum duration for a lock
 *   is 30 seconds, and if a higher value is specified, it will be rounded to
 *   this number.
 * @param {KeyCallback} callback
 *  The result in this callback contains the same fields as a
 *  {@linkcode Connection#get} operation.
 */
Connection.prototype.lock = function(key, options, callback) {
  this._argHelper2(this._cb.lockMulti, arguments);
};

/**
 * Delete a key on the server.
 *
 * @param {string} key the key to remove
 * @param {object=} options the options to use.
 *   @param {CAS} options.cas
 *   The CAS value to check. If the item on the server contains a different
 *   CAS value, the operation will fail.
 *   @param {integer} options.persist_to
 *   Triggers couchnode to ensure this key is persisted to this many nodes
 *   @param {integer} options.replicate_to
 *   Triggers couchnode to ensure this key is replicated to this many nodes
 * @param {KeyCallback} callback
 *
 * @see Connection#removeMulti
 */
Connection.prototype.remove = function(key, options, callback) {
  this._argHelperRemove(this._cb.removeMulti, arguments);
};

/**
 * Unlock a previously locked item on the server.
 *
 * @param {string} key the key to unlock
 * @param {object} options the options to use.
 *   @param {CAS} options.cas <b>mandatory</b> parameter, which should contain
 *   the CAS provided by a previous {@link lock} operation
 *
 * @see Connection#lock
 * @see Connection#unlockMulti
 */
Connection.prototype.unlock = function(key, options, callback) {
  this._argHelperMerge2(this._cb.unlockMulti, arguments);
};

/**
 * Store a key on the server, setting its value.
 *
 * @param {string} key the key to store
 * @param {string|object|Buffer} value the value the key shall contain
 * Note that if the options already contain a 'value' field (e.g. from a callback
 * invoked after a get or getEx operation), this parameter is ignored.
 * @param {object=} options Options are:
 *   @param {CAS} options.cas value to use. If the CAS on the server
 *   does not match this value, it is assumed the object has been
 *   modified previously, and should be re-fetched
 *   (via {@linkcode ConnectionConnection#get} and re-transformed). Note that this
 *   check only happens if this option is set.
 *   @param {integer} options.expiry set initial expiration for the item
 *   @param {integer} options.flags 32 bit override value to use for the item.
 *   Conventionally this value is used for indicating the storage format of the
 *   value and is normally set automatically by couchnode based on the format
 *   specifier.  The only use case for setting this value should be intra-client
 *   compatibility.
 *   @param {integer|string} options.format Format specifier to use for storing this
 *   value.
 *   @param {integer} options.persist_to
 *   Ensures this operation is persisted to this many nodes
 *   @param {integer} options.replicate_to
 *   Ensures this operation is replicated to this many nodes
 * @param {KeyCallback} callback
 *
 * @see Connection#setMulti
 * @see Connection#add
 * @see Connection#replace
 * @see Connection#append
 * @see Connection#prepend
 */
Connection.prototype.set = function(key, value, options, callback) {
  this._invokeStorage(this._cb.setMulti, arguments);
};

/**
 * Like {@linkcode Connection#set} but will fail if the key already exists.
 *
 * @param {string} key
 * @param {string|object|Buffer} value
 * @param {object=} options
 *   @param {integer} options.expiry
 *   @param {integer} options.flags
 *   @param {string|integer} options.format
 *   @param {integer} options.persist_to
 *   @param {integer} options.replicate_to
 * @param {KeyCallback} callback
 *
 * @see Connection#set
 * @see Connection#addMulti
 */
Connection.prototype.add = function(key, value, options, callback) {
  this._invokeStorage(this._cb.addMulti, arguments);
};

/**
 * Like {@linkcode Connection#set}, but will only succeed if the key exists (i.e.
 * the inverse of add()).
 *
 * @param {string} key
 * @param {string|object|Buffer} value
 * @param {object=} options
 *   @param {integer} options.expiry
 *   @param {integer} options.flags
 *   @param {CAS} options.cas
 *   @param {string|integer} options.format
 *   @param {integer} options.persist_to
 *   @param {integer} options.replicate_to
 * @param {KeyCallback} callback
 *
 * @see Connection#set
 * @see Connection#replaceMulti
 */
Connection.prototype.replace = function(key, value, options, callback) {
  this._invokeStorage(this._cb.replaceMulti, arguments);
};

/**
 * Like {@linkcode Connection#set},
 * but instead of setting a new value, it appends data
 * to the existing value. Note that this function only makes sense when
 * the stored item is a string; 'appending' to JSON may result in parse
 * errors when the value is later retrieved.
 *
 * @param {string} key
 * @param {string|object} fragment The data to append
 * @param {object=} options
 *   @param {integer} options.expiry
 *   @param {integer} options.flags
 *   @param {CAS} options.cas
 *   @param {string|integer} options.format
 *   @param {integer} options.persist_to
 *   @param {integer} options.replicate_to
 * @param {KeyCallback} callback
 *
 * @see Connection#set
 * @see Connection#appendMulti
 */
Connection.prototype.append = function(key, fragment, options, callback) {
  this._invokeStorage(this._cb.appendMulti, arguments);
};

/**
 * Like {@linkcode Connection#append}, but prepends data to the existing value.
 *
 * @param {string} key
 * @param {string|Buffer} fragment The data to prepend
 * @param {object=} options
 *   @param {integer} options.expiry
 *   @param {integer} options.flags
 *   @param {CAS} options.cas
 *   @param {string|integer} options.format
 *   @param {integer} options.persist_to
 *   @param {integer} options.replicate_to
 * @param {KeyCallback} callback
 *
 * @see Connection#append
 * @see Connection#set
 * @see Connection#appendMulti
 */
Connection.prototype.prepend = function(key, fragment, options, callback) {
  this._invokeStorage(this._cb.prependMulti, arguments);
};

/**
 * Increments the key's numeric value. This is an atomic operation.
 *
 * Note that JavaScript does not support 64 bit integers (while libcouchbase
 * and the server does). You may end up receiving an invalid value if the
 * existing number is greater than 64 bits.
 *
 * Note that as this operation is atomic, no 'cas' parameter is provided.
 * If the key already exists but its value is not numeric, an error will be
 * provided to the callback
 *
 * @param {string} key the key to increment
 * @param value
 * @param {object=} options Options are:
 *   @param {integer} options.offset The amount by which to increment.
 *     @default 1
 *   @param {integer} options.initial The initial value to use if the key does
 *   not exist. If this is not supplied and the key does not exist, the
 *   operation will fail
 *   @param {integer} options.expiry the expiration time for the key
 *   @param {integer} options.persist_to
 *   @param {integer} options.replicate_to
 * @param {KeyCallback} callback
 * Invoked with the following fields in the response:
 *   @param {integer} callback.value the current value of the item
 *   @param {CAS} callback.cas
 *   @param {string|integer} callback.format
 *
 * @see Connection#decr
 * @see Connection#incrMulti
 */
Connection.prototype.incr = function(key, options, callback) {
  this._arithHelper(1, arguments);
};

/**
 * Decrements the key's numeric value. Follows same semantics as
 * {@linkcode Connection#incr}
 * with the exception that the <code>offset</code> parameter is the amount by
 * which to decrement the existing value.
 *
 * @param {string} key
 * @param {object=} options
 *   @param {integer} options.offset
 *   @param {integer} options.initial
 *   @param {integer} options.expiry
 *   @param {integer} options.persist_to
 *   @param {integer} options.replicate_to
 * @param {KeyCallback} callback
 *
 * @see Connection#incr
 * @see Connection#decrMulti
 */
Connection.prototype.decr = function(key, options, callback) {
  this._arithHelper(-1, arguments);
};

/**
 * Observes a key to retrieve its replication/persistence status
 *
 * @param {string} key
 * @param {KeyCallback} callback
 *
 * @see Connection#observeMulti
 */
Connection.prototype.observe = function(key, options, callback) {
  this._argHelperMerge2(this._cb.observeMulti, arguments);
};

Connection.prototype._multiHelper = function(target, argList) {
  var options = argList[1];
  if (!options) {
    options = { spooled: true };
  } else if (!('spooled' in options)) {
    options = { spooled: true };
    for (var k in argList[1]) {
      options[k] = argList[1][k];
    }
  }
  target.call(this._cb, argList[0], options,
      this._interceptEndure(null, argList[0], options, false, argList[2]));
}


/**
 * Multi-Key callbacks
 * This callback is invoked by the *Multi operations.
 * It differs from the in {@linkcode KeyCallback} that the
 * <i>response</i> object is an object of <code>{key: response}</code>
 * where each response object contains the response for that particular
 * key.
 *
 * @callback MultiCallback
 *
 * @param {undefined|Error} error
 *  An error indicator. Note that this error
 *  value may be ignored, but its absence is indicative that each
 *  response in the <code>results</code> parameter is ok. If it
 *  is set, then at least one of the result objects failed
 * @param {object} results
 *  The <code>response</code> is the same as the <code>response</code>
 *  object passed as the second parameter to the
 *  {@linkcode KeyCallback}, except that this is a dictionary of
 *  <code>{key: { cas: ..., value: ... } }</code> where all keys
 *  which were part of the original multi operation have their results
 *  returned here.
 */
;

/**
 * Set multiple items.
 * @param {object} kv a dictionary of <code>{ key: options }</code>
 *   where <code>options</code> is in the format of {@linkcode set}
 *   with the following differences:
 *   @param {object|string|Buffer} kv.value the value to use for this key.
 *   This <b>must</b> be present.
 *
 * @param {object=} options Options to use affecting <i>all</i>
 *   key-value pairs. This can be used to specify common options
 *   for all keys rather than applying them individually to each
 *   key's options.
 *   Note that if a key option conflicts with a global option,
 *   then the key option w *ins.
 *   Additionally, one extra global-only option may be specified:
 *   @param {boolean} options.spooled
 *   If this option is present <i>and</i> is set to <i>false</i>,
 *   then the <code>callback</code> parameter will be treated as
 *   a {@linkcode KeyCallback} which will be invoked once for
 *   each key.
 *   @param {integer} options.persist_to
 *   Ensures this operation is persisted to this many nodes
 *   @param {integer} options.replicate_to
 *   Ensures this operation is replicated to this many nodes
 *
 * @param {MultiCallback|KeyCallback} callback
 */
Connection.prototype.setMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.setMulti, arguments);
};

/**
 * Multi version of {@linkcode add}.
 *
 * @param {object} kv
 * @param {object=} options
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#add
 * @see Connection#setMulti
 */
Connection.prototype.addMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.addMulti, arguments);
};

/**
 * Multi version of {@linkcode replace}.
 *
 * @param {object} kv
 * @param {object=} options
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#replace
 * @see Connection#setMulti
 */
Connection.prototype.replaceMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.replaceMulti, arguments);
};

/**
 * Multi version of {@linkcode append}.
 *
 * @param {object} kv
 * @param {object=} options
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#append
 * @see Connection#setMulti
 */
Connection.prototype.appendMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.appendMulti, arguments);
};

/**
 * Multi version of {@linkcode prepend}.
 *
 * @param {object} kv
 * @param {object=} options
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#prepend
 * @see Connection#setMulti
 */
Connection.prototype.prependMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.prependMulti, arguments);
};

/**
 * Get multiple keys at once.
 *
 * @param {object} kv
 * @param {object=} options
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#get
 * @see Connection#setMulti
 */
Connection.prototype.getMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.getMulti, arguments);
};

/**
 * Multi version of {@linkcode lock}.
 *
 * @param {object} kv
 * @param {object=} options
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#lock
 * @see Connection#unlockMulti
 */
Connection.prototype.lockMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.lockMulti, arguments);
};

/**
 * Unlock multiple keys at once. Multi variant of {@linkcode unlock}
 *
 * @param {object} kv Typically this will be the result of a previous
 *  call to {@linkcode Connection#lockMulti} - as the CAS is already in
 *  the result.
 * @param {object=} options
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#lock
 * @see Connection#unlock
 * @see Connection#setMulti
 */
Connection.prototype.unlockMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.unlockMulti, arguments);
};

/**
 * Remove multiple keys at once.
 *
 * @param {object} kv
 * @param {object=} options
 * @param {MultiCallback|KeyCallback} callback
 */
Connection.prototype.removeMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.deleteMulti, arguments);
};

/**
 * Increment multiple keys. Multi variant of
 * {@linkcode Connection#incr}.
 *
 * @param {object} kv
 * @param {object=} options
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#setMulti
 */
Connection.prototype.incrMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.incrMulti, arguments);
};

/**
 * Decrement multiple keys. Multi variant of
 * {@linkcode Connection#decr}.
 *
 * @param {object} kv
 * @param {object=} options
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#decr
 * @see Connection#set
 */
Connection.prototype.decrMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.decrMulti, arguments);
};

/**
 * Observes multiple keys. Multi variant of
 * {@linkcode Connection#observe}.
 *
 * @param {object} kv
 * @param {MultiCallback|KeyCallback} callback
 */
Connection.prototype.observeMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.observeMulti, arguments);
};



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
 * Retrieves various server statistics.
 *
 * @param {string=} key An optional stats key to specify which groups of
 *  statistics are returned. If not specified, returns the "default" statistics.
 *  Consult the server documentation for more information on which statistic
 *  groups are available.
 * @param {StatsCallback} callback a callback to be invoked.
 */
Connection.prototype.stats = function(key, callback) {
  if (arguments.length == 1) {
    key = "";
    callback = arguments[0];
  }
  this._cb.stats(key, null, callback);
};

/**
 * Make an HTTP request. This is a thin wrapper around Libcouchbase'
 * <code>lcb_make_http_request</code>
 *
 * @param params parameters for the request
 *   @param {integer} params.method the request method. This is one of the
 *   <code>LCB_HTTP_METHOD_*</code> constants, found in the
 *   <code>CONST</code> namespace
 *   @param {integer} params.lcb_http_type
 *   The "type" for this request. This indicates which server and port
 *   the request is routed to. Options are either
 *   <code>LCB_HTTP_TYPE_VIEW</code> for a view request or
 *   <code>LCB_HTTP_TYPE_MANAGEMENT</code> for a management request
 *   @param {string} params.path
 *   The path to use for this request. This includes any query
 *   string.
 *   @param {string=} params.data Data to be passed along to the server.
 *   Only valid if <code>method</code> is one of POST or PUT
 *   @param {string=} params.content_type Content-Type header
 * @param callback A callback to be invoked with
 *  <code>(error, result)</code>. Result contains a
 *  <code>data</code> field if the response has content.
 *
 * @private
 * @ignore
 */
Connection.prototype._httpRequest = function(params, callback) {
  this._cb.httpRequest(params, null, callback);
};

// Initialize

Connection.prototype.on = function() {
  this._cb.on.apply(this._cb, arguments);
};

/**
 * Shuts down this connection.
 */
Connection.prototype.shutdown = function() {
  this._cb.shutdown();
};

/**
 * Sets or gets a libcouchbase instance setting.
 *
 * @private
 * @ignore
 */
Connection.prototype._ctl = function(cc, value) {
  if (value !== undefined) {
    return this._cb._control(cc, CONST.LCB_CNTL_SET, value);
  } else {
    return this._cb._control(cc, CONST.LCB_CNTL_GET);
  }
};

/**
 * Sets or gets the operation timeout in msecs. The operation timeout is the
 * time that Connection will wait for a response from the server. If the
 * response is not received within this time frame, the operation is bailed out
 * with an error.
 *
 * @default 2500
 *
 * @member {number} operationTimeout
 * @memberOf Connection#
 */
Object.defineProperty(Connection.prototype, 'operationTimeout', {
  get: function() {
    return this._ctl(CONST.LCB_CNTL_OP_TIMEOUT);
  },
  set: function(val) {
    this._ctl(CONST.LCB_CNTL_OP_TIMEOUT, val);
  }
});

/**
 * Sets or gets the connection timeout in msecs. This is the timeout value used when
 * connecting to the configuration port during the initial connection (in this
 * case, use this as a key in the 'options' parameter in the constructor) and/or
 * when Connection attempts to reconnect in-situ (if the current connection
 * has failed).
 *
 * @default 5000
 *
 * @member {number} connectionTimeout
 * @memberOf Connection#
 */
Object.defineProperty(Connection.prototype, 'connectionTimeout', {
  get: function() {
    return this._ctl(CONST.LCB_CNTL_CONFIGURATION_TIMEOUT );
  },
  set: function(val) {
    this._ctl(CONST.LCB_CNTL_CONFIGURATION_TIMEOUT, val);
  }
});

/**
 * Get information about the libcouchbase version being used.
 * @return an array of [versionNumber, versionstring], where
 * @c versionNumber is a hexadecimal number of 0x021002 - in this
 * case indicating version 2.1.2.
 *
 * Depending on the build type, this might include some other information
 * not listed here.
 *
 * @member {Array} lcbVersion
 * @memberOf Connection#
 */
Object.defineProperty(Connection.prototype, 'lcbVersion', {
  get: function() {
    return this._ctl(CONST.CNTL_LIBCOUCHBASE_VERSION);
  },
  writeable: false
});

/**
 * Get information about the Couchnode version (i.e. this library).
 *
 * @return an array of [versionNumber, versionstring]
 *
 * @member {Array} clientVersion
 * @memberOf Connection#
 */
Object.defineProperty(Connection.prototype, 'clientVersion', {
  get: function() {
    var pkgJson = fs.readFileSync(
                                  path.resolve(__dirname, '../package.json'));
    var jsVersion = JSON.parse(pkgJson).version;
    var components = jsVersion.split('.');

    var hexValue = components[0] << 16 |
                   components[1] << 8 |
                   components[2];
    return [hexValue, jsVersion];
  },
  writeable: false
});

/**
 * Get an array of active nodes in the cluster.
 *
 * @member {Array<String>} serverNodes
 * @memberOf Connection#
 */
Object.defineProperty(Connection.prototype, 'serverNodes', {
  get: function() {
    return this._ctl(CONST.CNTL_CLNODES);
  },
  writeable: false
});

/**
 * @static
 * Return the string representation of an error code.
 *
 * @param {integer} code a code of an error thrown by the library
 * @returns {string} The string description
 */
Connection.prototype.strError = function(code) {
  return this._cb.strError(code);
};

/**
 * Return an array of <code>(server index, vbucket id)</code> for the
 * provided key.
 *
 * @param {string} key the key to map
 * @return array
 *
 * @private
 * @ignore
 */
Connection.prototype.vbMappingInfo = function(key) {
  return this._ctl(CONST.LCB_CNTL_VBMAP, key);
};


/**
 * Returns a ViewQuery object representing the requested view.
 * See the views chapter of the
 * <a href="http://www.couchbase.com/documentation">Couchbase Documentation</a>
 * for more information.
 *
 * @param {string} ddoc The name of the design document to query
 * @param {string} name The name of the view to query
 * @param {object} query Query options
 * @returns {ViewQuery} A ViewQuery representing the requested view
 */
Connection.prototype.view = function(ddoc, name, query) {
  return httpUtil.view(this._cb, ddoc, name, query);
};

/**
 * Design Document Management callbacks
 * This callback is invoked by the *DesignDoc operations.
 *
 * @callback DDocCallback
 *
 * @param {undefined|Error} error
 *  An error indicator. Note that this error
 *  value may be ignored, but its absence is indicative that the
 *  response in the <code>result</code> parameter is ok. If it
 *  is set, then the request failed.
 * @param {object} result
 *  The result returned from the server
 */
;

/**
 * Sets a design document to the server.  The document data passed
 * to this function is expected to be a key,value pair of view names
 * and objects containing the map and reduce functions for the view.
 * See the views chapter of the
 * <a href="http://www.couchbase.com/documentation">Couchbase Documentation</a>
 * for more information.
 * @param {string} name The name of the design document to set
 * @param {object} data An object representing the views to be included in this design document
 * @param {DDocCallback} callback
 */
Connection.prototype.setDesignDoc = function(name, data, callback) {
  httpUtil.setDesignDoc(this._cb, name, data, callback);
};

/**
 * Gets a design document from the server.
 *
 * @param {string} name The name of the design document to retrieve
 * @param {DDocCallback} callback
 */
Connection.prototype.getDesignDoc = function(name, callback) {
  httpUtil.getDesignDoc(this._cb, name, callback);
};

/**
 * Deletes a design document from the server.
 *
 * @param {string} name The name of the design document to delete
 * @param {DDocCallback} callback
 */
Connection.prototype.removeDesignDoc = function(name, callback) {
  httpUtil.removeDesignDoc(this._cb, name, callback);
};

module.exports.Connection = Connection;

/**
 * Enumeration of all error codes.  See libcouchbase documentation
 * for more details on what these errors represent.
 *
 * @global
 * @readonly
 * @enum {number}
 */
module.exports.errors = {
  // Libcouchbase codes:
  success: CONST.LCB_SUCCESS,
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
  invalidArguments: CONST['ErrorCode::ARGUMENTS'],
  schedulingError: CONST['ErrorCode::SCHEDULING'],
  checkResults: CONST['ErrorCode::CHECK_RESULTS'],
  genericError: CONST['ErrorCode::GENERIC'],
  durabilityFailed: CONST['ErrorCode::DURABILITY_FAILED']
};

/**
 * Enumeration of all value encoding formats.
 *
 * @global
 * @readonly
 * @enum {number}
 */
module.exports.format = {
  raw: CONST['ValueFormat::RAW'],
  json: CONST['ValueFormat::JSON'],
  utf8: CONST['ValueFormat::UTF8'],
  auto: CONST['ValueFormat::AUTO']
};
