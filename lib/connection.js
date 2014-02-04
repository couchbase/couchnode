'use strict';

var util = require('util');
var fs = require('fs');
var path = require('path');
var binding = require('./binding');
var ViewQuery = require('./viewQuery');
var qstring = require('./qstring');
var qs = require('querystring');
var request = require('request');

var CONST = binding.Constants;
var CBpp = binding.CouchbaseImpl;

/**
 * The *CAS* value is a special object which indicates the current state
 * of the item on the server. Each time an object is mutated on the server, the
 * value is changed. <i>CAS</i> objects can be used in conjunction with
 * mutation operations to ensure that the value on the server matches the local
 * value retrieved by the client.  This is useful when doing document updates
 * on the server as you can ensure no changes were applied by other clients
 * while you were in the process of mutating the document locally.
 *
 * In Couchnode, this is an opaque value. As such, you cannot generate
 * <i>CAS</i> objects, but should rather use the values returned from a
 * {@link KeyCallback}.
 *
 * @typedef {object} CAS
 */

/**
 * @class Error
 * @classdesc
 * The virtual class thrown for all Couchnode errors.
 * @private
 * @extends node#Error
 */
/**
 * The error code for this error.
 * @var {errors} Error#code
 */
/**
 * A reason string describing the reason this error occured.  This value is
 * almost exclusively used for REST request errors.
 * @var {string} Error#reason
 */
/**
 * The internal error that occured to cause this one.  This is used to wrap
 * low-level errors before throwing them from couchnode to simplify error
 * handling.
 * @var {(node#Error)} Error#innerError
 */

/**
 * @class Result
 * @classdesc
 * The virtual class used for results of various operations.
 * @private
 */
/**
 * The resulting document from the retrieval operation that was executed.
 * @var {Mixed} Result#value
 */
/**
 * The CAS value for the document that was affected by the operation.
 * @var {CAS} Result#cas
 */
/**
 * The flags associate with the document.
 * @var {integer} Result#flags
 */


/**
 * Connect callback
 * This callback is invoked when a connection is successfully established.
 *
 * @typedef {function} ConnectCallback
 *
 * @param {undefined|Error} error
 *  The error that occurred while trying to connect to the cluster.
 */

/**
 * Single-Key callbacks.
 * This callback is passed to all of the single key functions.
 *
 * A typical use pattern is to pass the <i>result></i> parameter from the
 * callback as the <i>options</i> parameter to one of the next operations.
 *
 * @typedef {function} KeyCallback
 *
 * @param {undefined|Error} error
 *  The error for the operation. This can either be an Error object
 *  or a false value. The error contains the following fields:
 * @param {Result} result
 *  The result of the operation that was executed.
 */

/**
 * Multi-Key callbacks
 * This callback is invoked by the *Multi operations.
 * It differs from the in {@linkcode KeyCallback} that the
 * <i>response</i> object is an object of <code>{key: response}</code>
 * where each response object contains the response for that particular
 * key.
 *
 * @typedef {function} MultiCallback
 *
 * @param {undefined|Error} error
 *  An error indicator. Note that this error
 *  value may be ignored, but its absence is indicative that each
 *  response in the <code>results</code> parameter is ok. If it
 *  is set, then at least one of the result objects failed
 * @param {Object.<string,Result>} results
 *  The results of the operation as a dictionary of keys mapped to Result
 *  objects.
 */

/**
 * @typedef {function} StatsCallback
 *
 * @param {Error} error
 * @param {Object.<string,Object>} results
 *  An object containing per-server, per key entries
 *
 * @see Connection#stats
 */

/**
 * Design Document Management callbacks
 * This callback is invoked by the *DesignDoc operations.
 *
 * @typedef {function} DDocCallback
 *
 * @param {undefined|Error} error
 *  An error indicator. Note that this error value may be ignored, but its
 *  absence is indicative that the response in the *result* parameter is ok.
 *  If it is set, then the request likely failed.
 * @param {object} result
 *  The result returned from the server
 */

/**
 * @class
 * A class representing a connection to a Couchbase cluster.
 * Normally, your application should only need to create one of these per
 * bucket and use it continuously.  Operations are executed asynchronously
 * and pipelined when possible.
 *
 * @desc
 * Instantiate a new Connection object.  Note that it is safe to perform
 * operations before the connect callback is invoked. In this case, the
 * operations are queued until the connection is ready (or an unrecoverable
 * error has taken place).
 *
 * @param {Object} [options]
 * A dictionary of options to use.  You may pass
 * other options than those defined below which correspond to the various
 * options available on the Connection object (see their documentation).
 * For example, it may be helpful to set timeout properties before connecting.
 *  @param {string|string[]} [options.host="localhost:8091"]
 *  A string or array of strings indicating the hosts to connect to. If the
 *  value is an array, all the hosts in the array will be tried until one of
 *  them succeeds.
 *  @param {string} [options.bucket="default"]
 *  The bucket to connect to. If not specified, the default is
 *  'default'.
 *  @param {string} [options.password=""]
 *  The password for a password protected bucket.
 *  @param {string|string[]} [options.queryhosts=""]
 *  The host or hosts of cbq_engine instances for executing N1QL queries.
 * @param {ConnectCallback} callback
 * A callback that will be invoked when the instance has completed connecting
 * to the server. Note that this isn't required - however if the connection
 * fails, an exception will be thrown if the callback is not provided.
 *
 * @example
 * var couchbase = require('couchbase');
 * var db = new couchbase.Connection({}, function(err) {
 *   if (err) {
 *     console.log('Connection Error', err);
 *   } else {
 *     console.log('Connected!');
 *   }
 * });
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
    return;
  }

  var ourObjs = {};
  for (var kName in options) {
    if (options.hasOwnProperty(kName)) {
      ourObjs[kName] = options[kName];
    }
  }

  if (ourObjs.queryhosts !== undefined) {
    this.queryhosts = ourObjs.queryhosts;
    if (!Array.isArray(this.queryhosts)) {
      this.queryhosts = [this.queryhosts];
    }
    delete ourObjs.queryhosts;
  } else {
    this.queryhosts = null;
  }

  var hostKey = 'host';
  var hostParam;

  if (ourObjs.hasOwnProperty(hostKey)) {
    hostParam = ourObjs[hostKey];
  } else {
    var hostKeyCompat = ['hosts', 'hostname', 'hostnames'];
    for (var i = 0; i < hostKeyCompat.length; ++i) {
      var kCompat = hostKeyCompat[i];
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
    3: ['bucket', 'default'],
    4: ['cachefile', '']
  };

  for (var ix = 1; ix <= 4; ++ix) {
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
  if (cbArgs[1] && cbArgs[1] !== cbArgs[3]) {
    callback(new Error('Username must match bucket name ' +
      '(see password in documentation for password protected buckets)'));
    return;
  }

  try {
    this._cb = new CBpp(cbArgs[0], cbArgs[1], cbArgs[2], cbArgs[3], cbArgs[4]);
  } catch (e) {
    callback(e);
  }

  for (var prefOption in ourObjs) {
    if (ourObjs.hasOwnProperty(prefOption)) {
      // Check that it exists:
      var prefValue = ourObjs[prefOption];
      if (typeof this[prefOption] === 'undefined') {
        console.warn('Unknown option: ' + prefOption);
      } else {
        this[prefOption] = prefValue;
      }
    }
  }

  // Internal Callbacks
  this._cb._handleRestResponse = this._handleRestResponse;

  this.connected = false;
  this._cb.on('connect', function() {
    this.connected = true;
  }.bind(this));
  this._cb.on('connect', callback);

  try {
    this._cb._connect.call(this._cb);
  } catch(e) {
    callback(e);
  }
}

/**
 * Adds an event listener.
 *
 * @param {string} event
 * The event name to add a listener for.
 * @param {callback} listener
 * The listener to attach.
 */
Connection.prototype.on = function(event, listener) {
  if (event === 'connect' && this.connected) {
    process.nextTick(listener);
  } else {
    this._cb.on.apply(this._cb, arguments);
  }
};

/**
 * Shuts down this connection.
 */
Connection.prototype.shutdown = function() {
  this._cb.shutdown();
};

/**
 * Executes a raw N1QL query
 *
 * @param {string} query
 * @param {Function} callback
 */
Connection.prototype.query = function(query, values, callback) {
  if (this.queryhosts === null) {
    return callback(new Error('no available query nodes'));
  }

  if (arguments.length < 3) {
    callback = values;
    values = null;
  }

  query = qstring.format(query, values);

  var qhosts = this.queryhosts;
  var host = qhosts[Math.floor(Math.random()*qhosts.length)];
  var uri = 'http://' + host + '/query';

  request.post({uri: uri, body: query}, function (err, resp, body) {
    if (err) {
      return callback(err);
    }

    var res = null;
    try {
      res = JSON.parse(body);
    } catch (e) {
      return callback(new Error('failed to parse query response as json'));
    }

    var errObj = null;
    if (res.error) {
      errObj = new Error('Query error: ' + res.error.cause);
      // TODO: CONST['ErrorCode::QUERY'];
      errObj.code = 999;
      if (body.inner) {
        errObj.inner = res.error;
      }
    }

    if (res.resultset) {
      return callback(errObj, res.resultset);
    } else {
      return callback(errObj, null);
    }
  });
};

/**
 * Executes a view http request.
 *
 * @param {string} ddoc
 * @param {string} name
 * @param {Object} q
 * @param {Function} callback
 *
 * @private
 * @ignore
 */
Connection.prototype._view = function(ddoc, name, q, callback) {
  this._cb.httpRequest.call(this._cb, null, {
    path: '_design/' + ddoc + '/_view/' + name + '?' +
      qs.stringify(q),
    lcb_http_type: CONST.LCB_HTTP_TYPE_VIEW,
    method: CONST.LCB_HTTP_METHOD_GET
  }, callback);
};

/**
 * Handles the parsing of HTTP raw response data into an end-user operable
 * format.  Handlers parsing of errors within the body as well as invalid
 * responses.
 *
 * @param {Error} error
 * The error that occured.
 * @param {Object} response
 * The raw response data from the request.
 * @param {Function} callback
 * The user specified callback to execute.
 *
 * @private
 * @ignore
 */
Connection.prototype._handleRestResponse = function(error, response, callback) {
  var body, misc = {};

  if (error && response.status < 200 || response.status > 299) {
    error = new Error('HTTP error ' + response.status);
  }

  try {
    body = JSON.parse(response.data);
  } catch (parseError) {
  }

  if (!body) {
    callback(new Error('Unknown REST Error'), null);
    return;
  }

  if (body.debug_info) {
    // if debug information is returned, log it for the user
    console.log('View Debugging Information Returned: ', body.debug_info);
  }

  // This should probably be updated to act differently
  var errObj = null;
  if (body.error) {
    errObj = new Error('REST error: ' + body.error);
    errObj.code = CONST['ErrorCode::REST'];
    if (body.reason) {
      errObj.reason = body.reason;
    }
  }
  if (body.errors) {
    errObj = [];
    for (var i = 0; i < body.errors.length; ++i) {
      var tmpErrObj = new Error('REST error ' + body.errors[i]);
      tmpErrObj.code = CONST['ErrorCode::REST'];
      if (body.errors[i].reason) {
        tmpErrObj.reason = body.errors[i].reason;
      }
      errObj.push(tmpErrObj);
    }
  }

  if (body.total_rows !== undefined) {
    misc.total_rows = body.total_rows;
  }

  if (body.rows) {
    callback(errObj, body.rows, misc);
  } else if (body.results) {
    callback(errObj, body.results, misc);
  } else if (body.views) {
    callback(errObj, body);
  } else {
    callback(errObj, null);
  }
};

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
    if (gParams.hasOwnProperty(opt) && opt !== 'value') {
      kParams[opt] = gParams[opt];
    }
  }
  return ret;
}

/**
 * Creates an durability failure Error object.
 *
 * @param {node#Error} innerError
 * The internal error that occured that caused the durability requirements to
 * fail to succeed.
 * @returns {Error}
 *
 * @private
 * @ignore
 */
function _endureError(innerError)
{
  var out_error = new Error('Durability requirements failed');
  out_error.code = CONST['ErrorCode::DURABILITY_FAILED'];
  out_error.innerError = innerError;
  return out_error;
}

/**
 * Creates a Design Document json string based on the input, which can either
 * be an already encoded document, or an Object which will then be automatically
 * converted.
 *
 * @param {Object|string} doc
 * The document to process into a json string.
 * @returns {string}
 *
 * @private
 * @ignore
 */
function _makeDDoc(doc) {
  if (typeof doc === 'string') {
    return doc;
  } else {
    return JSON.stringify(doc);
  }
}

/**
 * Common callback interceptor for durability requirements.  This function
 * will wrap user-provided callbacks in a handler which will ensure all
 * durability requirements are met prior to invoking the user-provided callback.
 *
 * @private
 * @ignore
 */
Connection.prototype._interceptEndure =
    function(key, options, globalOptions, is_delete, callback) {
  if (options === undefined) {
    options = {};
  }
  if (globalOptions === undefined) {
    globalOptions = {};
  }
  if (key && options !== null) {
    // if key is specified, this is a *single* call, so our globalOptions end
    //  up in the options.
    globalOptions = options[key];
  }

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
    var endure_kv = {};

    if(globalOptions.spooled) {
      // returns object of results
      var endure_count = 0;
      for(var result_key in results) {
        if (results.hasOwnProperty(result_key)) {
          if (!results[result_key].error) {
            endure_kv[result_key] = {
              cas: results[result_key].cas
            };
            endure_count++;
          }
        }
      }

      if (endure_count < 0) {
        callback(err, results);
        return;
      }

      _this._cb.endureMulti.call(_this._cb, endure_kv, endure_options,
                            function(endure_err, endure_results) {
        for (var endure_key in endure_results) {
          if (endure_results.hasOwnProperty(endure_key)) {
            if(endure_results[endure_key].error) {
              results[endure_key].error = endure_results[endure_key].error;
            }
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

      endure_kv[key] = results;
      _this._cb.endureMulti.call(_this._cb, endure_kv, endure_options,
                            function(endure_err) {
        if(endure_err) {
          callback(_endureError(endure_err), results);
          return;
        }

        callback(err, results);
      });
    }
  };
};

/**
 * Common entry point for single-key storage functions.
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
 * Helper to magically invoke a *Multi method properly depending on
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

/**
 * Like argHelper2, but also merges params if they exist.
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

/**
 * Like argHelperMerge2, but specifically for remove to allow endure
 * interception to be applied.
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

/**
 * Performs an arithmetic operation against the server.  This is used as a
 * common call path for the incr/decr operations.
 *
 * @private
 * @ignore
 */
Connection.prototype._arithHelper = function(dfl, argList) {
  var kdict, callback, key;
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
  this._cb.arithmeticMulti.call(this._cb, kdict, null,
    this._interceptEndure(key, kdict, {}, false, callback));
};

/**
 * Performs a *Multi operation, while wrapping the user callback in
 * an endure intercept at the same time.  It additionally will ensure the
 * options object is well formed.
 *
 * @private
 * @ignore
 */
Connection.prototype._multiHelper = function(target, argList) {
  var options = argList[1];
  if (!options) {
    options = { spooled: true };
  } else if (!('spooled' in options)) {
    options = { spooled: true };
    for (var k in argList[1]) {
      if (argList[1].hasOwnProperty(k)) {
        options[k] = argList[1][k];
      }
    }
  }
  target.call(this._cb, argList[0], options,
    this._interceptEndure(null, argList[0], options, false, argList[2]));
};

/**
 * Get a document.
 *
 * @param {string} key
 * The key of the document to retrieve.
 * @param {object} [options]
 *  @param {integer} [options.expiry]
 *  A new expiration time for the document. This makes the *Get* operation into
 *  a *Get-And-Touch* operation.
 *  @param {format} [options.format]
 *  Instructs the library not to attempt conversion based on the flags,
 *  and to return the value in the format specified instead.
 * @param {KeyCallback} callback
 *
 * @see Connection#set
 * @see Connection#getMulti
 *
 * @example
 * // Retrieve the 'test-key' document
 * db.get('test-key', function(err, result) {
 *   console.log(result.value);
 * });
 * @example
 * // Retrieve the 'test-key' document and set it to expire in 2 seconds.
 * db.get('test-key', {expiry: 2}, function(err, result) {
 *   if (err) throw err;
 *
 *   console.log('Doc Value: ', result.value);
 * });
 */
Connection.prototype.get = function(key, options, callback) {
  this._argHelper2(this._cb.getMulti, arguments);
};

/**
 * Get a document from a replica server in your cluster.
 *
 * @param {string} key
 * The key of the document to retrieve.
 * @param {object} [options]
 *  @param {integer} [options.index=-1]
 *  The index for which replica you wish to retrieve this value from, an index
 *  of -1 is a special value meaning to use the value of the first server to
 *  reply.
 *  @param {format} [options.format]
 *  Instructs the library not to attempt conversion based on the flags,
 *  and to return the value in the format specified instead.
 * @param {KeyCallback} callback
 *
 * @see Connection#get
 * @see Connection#getReplicaMulti
 *
 * @example
 * // Retrieve the 'test-key' document from the fastest replying replica.
 * db.getReplica('test-key', function(err, result) {
 *   if (err) throw err;
 *
 *   console.log(result.value);
 * });
 * @example
 * // Retrieve the 'test-key' document from the 1st replica.
 * db.getReplica('test-key', {index:0}, function(err, result) {
 *   if (err) throw err;
 *
 *   console.log('Doc Value: ', result.value);
 * });
 */
Connection.prototype.getReplica = function(key, options, callback) {
  this._argHelper2(this._cb.getReplicaMulti, arguments);
};

/**
 * Update the document expiration time.
 *
 * @param {string} key
 * The key of the document to update.
 * @param {object} [options]
 *  @param {integer} [options.expiry]
 *  The expiration time to use. If no value is provided, then the
 *  current expiration time is cleared and the key is set to
 *  never expire. Otherwise, the key is updated to expire in the
 *  value provided, in seconds.
 *  @param {CAS} [options.cas]
 *  The CAS value to compare prior to executing the operation.
 *  @param {integer} [options.persist_to]
 *  Ensures this operation is persisted to this many nodes
 *  @param {integer} [options.replicate_to]
 *  Ensures this operation is replicated to this many nodes
 * @param {KeyCallback} callback.
 *
 * @see Connection#touchMulti
 *
 * @example
 * // Set the 'test-key' document to expire expire in 20 seconds.
 * db.touch('test-key', {expiry: 20}, function(err, result) {
 *   if (err) throw err;
 *
 *   console.log('Successfully Updated!');
 * });
 */
Connection.prototype.touch = function(key, options, callback) {
  this._argHelper2(this._cb.touchMulti, arguments);
};

/**
 * Lock the document on the server and retrieve it. When an document is locked,
 * its CAS changes and subsequent operations on the document (without providing
 * the current CAS) will fail until the lock is no longer held.
 *
 * This function behaves identically to {@link Connection#get} in that it will
 * return the value. It differs in that the document is also locked. This
 * ensures that attempts by other client instances to access this document
 * while the lock is held will fail.
 *
 * Once locked, a document can be unlocked either by explicitly calling
 * {@link Connection#unlock} or by performing a storage operation
 * (e.g. set, replace, append) with the current CAS value.  Note that any
 * other lock operations on this key will fail while a document is locked.
 *
 * @param {string} key
 * The key of the document to lock.
 * @param {object} [options]
 *  @param {integer} [options.lockTime]
 *  The duration of time the lock should be held for. If this value is not
 *  provided, it will use the default server-side lock duration which is
 *  15 seconds. Note that the maximum duration for a lock is 30 seconds, and
 *  if a higher value is specified, it will be rounded to this number.
 * @param {KeyCallback} callback
 *
 * @see Connection#unlock
 * @see Connection#lockMulti
 *
 * @example
 * db.lock('test-key', function(err, result) {
 *   if (err) throw err;
 *
 *   // Do some work
 *
 *   db.unlock('test-key', {cas: result.cas}, function(err, result) {
 *     if (err) throw err;
 *
 *     console.log('Success!');
 *   });
 * });
 */
Connection.prototype.lock = function(key, options, callback) {
  this._argHelper2(this._cb.lockMulti, arguments);
};

/**
 * Unlock a previously locked document on the server.  See the
 * {@link Connection#lock} method for more details on locking.
 *
 * @param {string} key
 * The key of the document to unlock.
 * @param {object} options
 *  @param {CAS} options.cas
 *  The CAS value returned by the previously invoked {@link Connection#lock}
 *  operation.
 * @param {KeyCallback} callback
 *
 * @see Connection#lock
 * @see Connection#unlockMulti
 */
Connection.prototype.unlock = function(key, options, callback) {
  this._argHelperMerge2(this._cb.unlockMulti, arguments);
};

/**
 * Deletes a document on the server.
 *
 * @param {string} key
 * The key of the document to delete.
 * @param {object} [options]
 *  @param {CAS} [options.cas]
 *  The CAS value to check. If the item on the server contains a different
 *  CAS value, the operation will fail.
 *  @param {integer} [options.persist_to]
 *  Triggers couchnode to ensure this key is persisted to this many nodes
 *  @param {integer} [options.replicate_to]
 *  Triggers couchnode to ensure this key is replicated to this many nodes
 * @param {KeyCallback} callback
 *
 * @see Connection#removeMulti
 *
 * @example
 * // Delete a document from the bucket and wait till this change
 * //  is written to disk before proceeding.
 * db.remove('test-key', {persist_to: 1}, function(err, result) {
 *   if (err) throw err;
 *
 *   console.log('Successfully Deleted!');
 * });
 */
Connection.prototype.remove = function(key, options, callback) {
  this._argHelperRemove(this._cb.removeMulti, arguments);
};

/**
 * Stores a document to the bucket.
 *
 * @param {string} key
 * The key of the document to be stored.
 * @param {Mixed} value
 * The document's contents.
 * Note that if the options object contains a 'value' field (e.g. from directly
 * passing the Result object of another operation), this parameter is ignored.
 * @param {object} [options]
 *  @param {CAS} [options.cas]
 *  If the CAS on the server does not match this value, this operation will
 *  fail.  Note that this check only happens if this option is set.
 *  @param {integer} [options.expiry]
 *  Set the initial expiration time for the document.
 *  @param {integer} [options.flags]
 *  32 bit override value to use for the item. Conventionally this value is
 *  used for indicating the storage format of the value and is normally set
 *  automatically by couchnode based on the format specifier.  The only use
 *  case for setting this value should be intra-client compatibility.
 *  @param {format} [options.format]
 *  Format specifier to use for storing this value.
 *  @param {integer} [options.persist_to]
 *  Ensures this operation is persisted to this many nodes
 *  @param {integer} [options.replicate_to]
 *  Ensures this operation is replicated to this many nodes
 * @param {KeyCallback} callback
 *
 * @see Connection#add
 * @see Connection#replace
 * @see Connection#append
 * @see Connection#prepend
 * @see Connection#setMulti
 *
 * @example
 * // Store a document in the bucket
 * db.set('test-key', {name:'Frank'}, function(err, result) {
 *   if (err) throw err;
 *
 *   db.get('test-key', function(err, result) {
 *     if (err) throw err;
 *
 *     console.log('Doc Value: ', result.value);
 *     // Doc Value: {name: Frank}
 *   });
 * });
 * @example
 * // Store a document in the bucket and set it to expiry in 5 seconds
 * db.set('test-key', {name: 'Bart'}, {expiry: 5}, function(err, result) {
 *   if (err) throw err;
 *
 *   console.log('Successfully Stored!');
 * });
 * @example
 * // Doing a concurrency safe document update using CAS
 * (function tryUpdate() {
 *   db.get('test-key', function(err, result) {
 *     if (err) throw err;
 *     var user = result.value;
 *
 *     user.name += 'Dog';
 *
 *     db.set('test-key', user, {cas: result.cas}, function(err, result) {
 *       if (err && err.code == couchbase.errors.keyAlreadyExists) {
 *         // Document was updated by another client between the get and set.
 *         return tryUpdate();
 *       }
 *       if (err) throw err;
 *
 *       console.log('Successfully Updated!');
 *     });
 *   });
 * })();
 */
Connection.prototype.set = function(key, value, options, callback) {
  this._invokeStorage(this._cb.setMulti, arguments);
};

/**
 * Identical to {@link Connection#set} but will fail if the document already
 * exists.
 *
 * @param {string} key
 * @param {Mixed} value
 * @param {Object} [options]
 *  @param {integer} [options.expiry]
 *  @param {integer} [options.flags]
 *  @param {format} [options.format]
 *  @param {integer} [options.persist_to]
 *  @param {integer} [options.replicate_to]
 * @param {KeyCallback} callback
 *
 * @see Connection#set
 * @see Connection#addMulti
 */
Connection.prototype.add = function(key, value, options, callback) {
  this._invokeStorage(this._cb.addMulti, arguments);
};

/**
 * Identical to {@link Connection#set}, but will only succeed if the document
 * exists already (i.e. the inverse of add()).
 *
 * @param {string} key
 * @param {Mixed} value
 * @param {object} [options]
 *  @param {integer} [options.expiry]
 *  @param {integer} [options.flags]
 *  @param {CAS} [options.cas]
 *  @param {format} [options.format]
 *  @param {integer} [options.persist_to]
 *  @param {integer} [options.replicate_to]
 * @param {KeyCallback} callback
 *
 * @see Connection#set
 * @see Connection#replaceMulti
 */
Connection.prototype.replace = function(key, value, options, callback) {
  this._invokeStorage(this._cb.replaceMulti, arguments);
};

/**
 * Similar to {@link Connection#set}, but instead of setting a new key,
 * it appends data to the existing key. Note that this function only makes
 * sense when the stored data is a string; 'appending' to a JSON document may
 * result in parse errors when the document is later retrieved.
 *
 * @param {string} key
 * The key of the document to append data to.
 * @param {string|Buffer} fragment
 * The data to append to the document contents.
 * @param {object} [options]
 *  @param {integer} [options.expiry]
 *  @param {integer} [options.flags]
 *  @param {CAS} [options.cas]
 *  @param {format} [options.format]
 *  @param {integer} [options.persist_to]
 *  @param {integer} [options.replicate_to]
 * @param {KeyCallback} callback
 *
 * @see Connection#set
 * @see Connection#appendMulti
 *
 * @example
 * // Build a string in the database.
 * db.set('test-key', 'Hello ', function(err, result) {
 *   if (err) throw err;
 *
 *   db.append('test-key', 'World!', function(err, result) {
 *     if (err) throw err;
 *
 *     db.get('test-key', function(err, result) {
 *       if (err) throw err;
 *
 *       console.log('Doc Value: ', result.value);
 *       // Doc Value: Hello World!
 *     });
 *   }
 * });
 */
Connection.prototype.append = function(key, fragment, options, callback) {
  this._invokeStorage(this._cb.appendMulti, arguments);
};

/**
 * Like {@linkcode Connection#append}, but prepends data to the existing value.
 *
 * @param {string} key
 * The key of the document to prepend data to.
 * @param {string|Buffer} fragment
 * The data to prepend to the document contents.
 * @param {object} [options]
 *  @param {integer} [options.expiry]
 *  @param {integer} [options.flags]
 *  @param {CAS} [options.cas]
 *  @param {format} [options.format]
 *  @param {integer} [options.persist_to]
 *  @param {integer} [options.replicate_to]
 * @param {KeyCallback} callback
 *
 * @see Connection#append
 * @see Connection#set
 * @see Connection#appendMulti
 *
 * @example
 * // Build a string in the database.
 * db.set('test-key', 'World!', function(err, result) {
 *   if (err) throw err;
 *
 *   db.prepend('test-key', 'Hello ', function(err, result) {
 *     if (err) throw err;
 *
 *     db.get('test-key', function(err, result) {
 *       if (err) throw err;
 *
 *       console.log('Doc Value: ', result.value);
 *       // Doc Value: Hello World!
 *     });
 *   }
 * });
 */
Connection.prototype.prepend = function(key, fragment, options, callback) {
  this._invokeStorage(this._cb.prependMulti, arguments);
};

/**
 * Increments a keys's numeric value. This is an atomic operation and thus
 * no cas option is provided.  If the key already exists but is not a numeric
 * value
 *
 * Note that JavaScript does not support 64 bit integers (while libcouchbase
 * and the server does). You may end up receiving an inaccurate value if the
 * number will is greater than 53-bit (JavaScripts maximum integer precision).
 *
 * @param {string} key
 * The key for the value to increment.
 * @param {object} [options]
 *  @param {integer} [options.offset=1]
 *  The amount you which to increment the value.
 *  @param {integer} [options.initial]
 *  The initial value to use if the key does not already exist. If this is not
 *  supplied and the key does not exist, the operation will fail.
 *  @param {integer} [options.expiry]
 *  @param {integer} [options.persist_to]
 *  @param {integer} [options.replicate_to]
 * @param {KeyCallback} callback
 *
 * @see Connection#decr
 * @see Connection#arithmeticMulti
 *
 * @example
 * // Increment a page counter.
 * db.incr('page-views', {initial: 0, offset: 1}, function(err, result) {
 *   if (err) throw err;
 *
 *   console.log('Page view counted');
 * });
 */
Connection.prototype.incr = function(key, options, callback) {
  this._arithHelper(1, arguments);
};

/**
 * Decrements a key's numeric value. Follows the same semantics as
 * {@link Connection#incr} with the exception that the *offset* parameter is
 * the amount by which to decrement the existing value.
 *
 * @param {string} key
 * @param {object} [options]
 *   @param {integer} [options.offset]
 *   @param {integer} [options.initial]
 *   @param {integer} [options.expiry]
 *   @param {integer} [options.persist_to]
 *   @param {integer} [options.replicate_to]
 * @param {KeyCallback} callback
 *
 * @see Connection#incr
 * @see Connection#arithmeticMulti
 */
Connection.prototype.decr = function(key, options, callback) {
  this._arithHelper(-1, arguments);
};

/**
 * Retrieves the replication/persistence status of a key.
 *
 * @param {string} key
 * The key you wish to observe for changes.
 * @param {Object} options
 *  @param {CAS} options.cas
 *  The CAS value of the item.  This value will be used to identify if the
 *  document has changed.
 * @param {KeyCallback} callback
 *
 * @see Connection#observeMulti
 */
Connection.prototype.observe = function(key, options, callback) {
  this._argHelperMerge2(this._cb.observeMulti, arguments);
};


/**
 * Multi variant of {@link Connection#set}.
 *
 * @param {Object.<string,Object>} kv
 *  @param {Mixed} kv.value
 *  @param {CAS} [kv.cas]
 *  @param {integer} [kv.expiry]
 *  @param {integer} [kv.flags]
 *  @param {format} [kv.format]
 * @param {Object.<string,Object>} options
 *  @param {boolean} [options.spooled]
 *  @param {integer} [options.expiry]
 *  @param {integer} [options.flags]
 *  @param {format} [options.format]
 *  @param {integer} [options.persist_to]
 *  @param {integer} [options.replicate_to]
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#set
 *
 * @example
 * // Set three documents to the server at once.
 * var docs = {
 *   'test-doc1': {value: {name: 'Frank'}},
 *   'test-doc2': {value: {name: 'Bob'}},
 *   'test-doc3': {value: {name: 'Jones'}}
 * };
 * db.setMulti(docs, {}, function(err, results) {
 *   if (err) throw err;
 *
 *   db.getMulti(['test-doc1', 'test-doc2', 'test-doc3'], {},
 *               function(err, results) {
 *     if (err) throw err;
 *
 *     console.log(results);
 *     // {
 *     //   'test-doc1': {value: {name: 'Frank'}, cas: [Object object]},
 *     //   'test-doc2': {value: {name: 'Bob'}, cas: [Object object]},
 *     //   'test-doc3': {value: {name: 'Jones'}, cas: [Object object]}
 *     // }
 *   });
 * });
 */
Connection.prototype.setMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.setMulti, arguments);
};

/**
 * Multi variant of {@link Connection#add}.
 *
 * @param {Object.<string,Object>} kv
 *  @param {Mixed} kv.value
 *  @param {integer} [kv.expiry]
 *  @param {integer} [kv.flags]
 *  @param {format} [kv.format]
 * @param {Object.<string,Object>} options
 *  @param {boolean} [options.spooled]
 *  @param {integer} [options.expiry]
 *  @param {integer} [options.flags]
 *  @param {format} [options.format]
 *  @param {integer} [options.persist_to]
 *  @param {integer} [options.replicate_to]
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#add
 */
Connection.prototype.addMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.addMulti, arguments);
};

/**
 * Multi variant of {@link Connection#replace}.
 *
 * @param {Object.<string,Object>} kv
 *  @param {Mixed} kv.value
 *  @param {CAS} [kv.cas]
 *  @param {integer} [kv.expiry]
 *  @param {integer} [kv.flags]
 *  @param {format} [kv.format]
 * @param {Object.<string,Object>} options
 *  @param {boolean} [options.spooled]
 *  @param {integer} [options.expiry]
 *  @param {integer} [options.flags]
 *  @param {format} [options.format]
 *  @param {integer} [options.persist_to]
 *  @param {integer} [options.replicate_to]
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#replace
 */
Connection.prototype.replaceMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.replaceMulti, arguments);
};

/**
 * Multi variant of {@link Conncetion#append}.
 *
 * @param {Object.<string,Object>} kv
 *  @param {Mixed} kv.value
 *  @param {CAS} [kv.cas]
 *  @param {integer} [kv.expiry]
 * @param {Object.<string,Object>} options
 *  @param {boolean} [options.spooled]
 *  @param {integer} [options.expiry]
 *  @param {integer} [options.persist_to]
 *  @param {integer} [options.replicate_to]
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#append
 */
Connection.prototype.appendMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.appendMulti, arguments);
};

/**
 * Multi variant of {@link Connection#prepend}.
 *
 * @param {Object.<string,Object>} kv
 *  @param {Mixed} kv.value
 *  @param {CAS} [kv.cas]
 *  @param {integer} [kv.expiry]
 * @param {Object.<string,Object>} options
 *  @param {boolean} [options.spooled]
 *  @param {integer} [options.expiry]
 *  @param {integer} [options.persist_to]
 *  @param {integer} [options.replicate_to]
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#prepend
 */
Connection.prototype.prependMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.prependMulti, arguments);
};

/**
 * Multi variant of {@link Connection#get}.
 *
 * @param {string[]} kv
 * @param {Object.<string,Object>} options
 *  @param {boolean} [options.spooled]
 *  @param {format} [options.format]
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#get
 */
Connection.prototype.getMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.getMulti, arguments);
};

/**
 * Multi variant of {@link Connection#getReplica}.
 *
 * @param {string[]} kv
 * @param {Object.<string,Object>} options
 *  @param {boolean} [options.spooled]
 *  @param {format} [options.format]
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#getReplica
 */
Connection.prototype.getReplicaMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.getReplicaMulti, arguments);
};

/**
 * Multi variant of {@link Connection#touch}.
 *
 * @param {Object.<string,Object>} kv
 *  @param {CAS} [kv.cas]
 *  @param {integer} [kv.expiry]
 * @param {Object.<string,Object>} options
 *  @param {boolean} [options.spooled]
 *  @param {integer} [options.expiry]
 *  @param {integer} [options.persist_to]
 *  @param {integer} [options.replicate_to]
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#touch
 */
Connection.prototype.touchMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.touchMulti, arguments);
};

/**
 * Multi variant of {@link Connection#lock}.
 *
 * @param {string[]} kv
 * @param {Object.<string,Object>} options
 *  @param {boolean} [options.spooled]
 *  @param {format} [options.format]
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#lock
 */
Connection.prototype.lockMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.lockMulti, arguments);
};

/**
 * Multi variant of {@link Connection#unlock}.
 *
 * @param {Object.<string,Object>} kv
 *  @param {CAS} kv.cas
 * @param {Object.<string,Object>} options
 *  @param {boolean} [options.spooled]
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#unlock
 */
Connection.prototype.unlockMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.unlockMulti, arguments);
};

/**
 * Multi variant of {@link Connection#remove}.
 *
 * @param {Object.<string,Object>|string[]} kv
 *  @param {CAS} [kv.cas]
 * @param {Object.<string,Object>} options
 *  @param {boolean} [options.spooled]
 *  @param {integer} [options.persist_to]
 *  @param {integer} [options.replicate_to]
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#remove
 */
Connection.prototype.removeMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.deleteMulti, arguments);
};

/**
 * Multi variant of {@link Connection#incr} and {@link Connection #decr}.
 *
 * Use positive offsets to do incr's and negative offets for decr's.
 *
 * @param {Object.<string,Object>|string[]} kv
 *  @param {integer} [kv.offset=1]
 *  @param {integer} [kv.initial]
 *  @param {integer} [kv.expiry]
 * @param {Object.<string,Object>} options
 *  @param {boolean} [options.spooled]
 *  @param {integer} [kv.offset]
 *  @param {integer} [kv.initial]
 *  @param {integer} [options.expiry]
 *  @param {integer} [options.persist_to]
 *  @param {integer} [options.replicate_to]
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#incr
 * @see Connection#decr
 */
Connection.prototype.arithmeticMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.arithmeticMulti, arguments);
};

/**
 * Multi variant of {@link Connection#observe}.
 *
 * @param {Object.<string,Object>} kv
 *  @param {CAS} kv.cas
 * @param {Object.<string,Object>} options
 *  @param {boolean} [options.spooled]
 * @param {MultiCallback|KeyCallback} callback
 *
 * @see Connection#observe
 */
Connection.prototype.observeMulti = function(kv, options, callback) {
  this._multiHelper(this._cb.observeMulti, arguments);
};


/**
 * Retrieves various server statistics.
 *
 * @param {string} [key]
 * An optional stats key to specify which groups of statistics should be
 * returned. If not specified, returns the "default" statistics. Consult the
 * server documentation for more information on which statistic groups are
 * available.
 * @param {StatsCallback} callback
 *
 * @example
 * db.stats(function(err, results) {
 *   console.log(results);
 *   // {
 *   //   '127.0.0.1:11210': { mem_used: 12345, mem_available: 44 },
 *   //   '10.0.0.99:11210': { mem_used: 1224, mem_available: 42 }
 *   // }
 * });
 */
Connection.prototype.stats = function(key, callback) {
  if (arguments.length === 1) {
    key = '';
    callback = arguments[0];
  }
  this._cb.stats(key, null, callback);
};

/**
 * Return an array of <code>(server index, vbucket id)</code> for the
 * provided key.
 *
 * @param {string} key
 * The key you wish to map to a bucket index.
 * @return integer[]
 *
 * @private
 * @ignore
 */
Connection.prototype.vbMappingInfo = function(key) {
  return this._ctl(CONST.LCB_CNTL_VBMAP, key);
};

/**
 * Gets or sets the operation timeout in msecs. The operation timeout is the
 * time that Connection will wait for a response from the server. If the
 * response is not received within this time frame, the operation is bailed out
 * with an error.
 *
 * @member {integer} Connection#operationTimeout
 * @default 2500
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
 * Sets or gets the connection timeout in msecs. This is the timeout value used
 * when connecting to the configuration port during the initial connection (in
 * this case, use this as a key in the 'options' parameter in the constructor)
 * and/or when Connection attempts to reconnect in-situ (if the current
 * connection has failed).
 *
 * @member {integer} Connection#connectionTimeout
 * @default 5000
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
 * Get information about the libcouchbase version being used as an array of
 * [versionNumber, versionString], where versionNumber is a hexadecimal number
 * such as 0x021002 - in this case indicating version 2.1.2. Depending on the
 * build type, this might include some other information not listed here.
 * @member {Mixed[]} Connection#lcbVersion
 */
Object.defineProperty(Connection.prototype, 'lcbVersion', {
  get: function() {
    return this._ctl(CONST.CNTL_LIBCOUCHBASE_VERSION);
  },
  writeable: false
});

/**
 * Get information about the Couchnode version (i.e. this library) as an array
 * of [versionNumber, versionString].
 *
 * @member {Mixed[]} Connection#clientVersion
 */
Object.defineProperty(Connection.prototype, 'clientVersion', {
  get: function() {
    var pkgJson = fs.readFileSync(
      path.resolve(__dirname, '../package.json'));
    var jsVersion = JSON.parse(pkgJson).version;

    var components = jsVersion.split('.');

    var hexValue = (components[0] << 16) |
      components[1] << 8 |
      components[2];
    return [hexValue, jsVersion];
  },
  writeable: false
});

/**
 * Get an array of active nodes in the cluster.
 *
 * @member {string[]} Connection#serverNodes
 */
Object.defineProperty(Connection.prototype, 'serverNodes', {
  get: function() {
    return this._ctl(CONST.CNTL_CLNODES);
  },
  writeable: false
});

/**
 * Gets or sets a libcouchbase instance setting.
 *
 * @private
 * @ignore
 */
Connection.prototype._ctl = function(cc, value) {
  if (value !== undefined) {
    return this._cb._control.call(this._cb, cc, CONST.LCB_CNTL_SET, value);
  } else {
    return this._cb._control.call(this._cb, cc, CONST.LCB_CNTL_GET);
  }
};

/**
 * Return the string representation of an error code.
 *
 * @param {errors} code
 * An error code as thrown by this library.
 * @returns {string}
 * The description of the passed error code.
 */
Connection.prototype.strError = function(code) {
  return this._cb.strError(code);
};

/**
 * Returns a ViewQuery object representing the requested view.
 * See the views chapter of the
 * [Couchbase Documentation](http://www.couchbase.com/documentation) for more
 * information.
 *
 * @param {string} ddoc
 * The name of the design document to query.
 * @param {string} name
 * The name of the view to query.
 * @param {object} [query]
 * Query options.
 * @returns {ViewQuery}
 * A ViewQuery representing the requested view.
 *
 * @example
 * // Retrieve the first 20 results from a view called 'test' in
 * //  the 'fake' design doc.
 * db.view('fake', 'test').query({limit: 10}, function(err, results) {
 *   if (err) throw err;
 *
 *   var keys = [];
 *   for (var i = 0; i < results.length; ++i) {
 *     keys.push(results[i].key);
 *   }
 *
 *   db.getMulti(keys, function(err, results) {
 *     if (err) throw err;
 *
 *     console.log(results);
 *     // {
 *     //   'key1': {value: ..., cas: [Object object]},
 *     //   'key2': {value: ..., cas: [Object object]},
 *     //   ...
 *     //   'key20': {value: ..., cas: [Object object]},
 *     // }
 *   });
 * });
 */
Connection.prototype.view = function(ddoc, name, query) {
  var vq = query === undefined ? {} : query;
  return new ViewQuery(this, ddoc, name, vq);
};

/**
 * Sets a design document to the server.  The document data passed to this
 * function is expected to be a key,value pair of view names and objects
 * containing the map and reduce functions for the view. See the views chapter
 * of the
 * [Couchbase Documentation](http://www.couchbase.com/documentation) for more
 * information.
 *
 * @param {string} name
 * The name of the design document to set.
 * @param {object} data
 * An object representing the views to be included in this design document.
 * @param {DDocCallback} callback
 */
Connection.prototype.setDesignDoc = function(name, data, callback) {
  this._cb.httpRequest.call(this._cb, null, {
    path: '_design/' + name,
    data: _makeDDoc(data),
    method: CONST.LCB_HTTP_METHOD_PUT,
    content_type: 'application/json',
    lcb_http_type: CONST.LCB_HTTP_TYPE_VIEW
  }, callback);
};

/**
 * Gets a design document from the server.
 *
 * @param {string} name
 * The name of the design document to retrieve.
 * @param {DDocCallback} callback
 */
Connection.prototype.getDesignDoc = function(name, callback) {
  this._cb.httpRequest.call(this._cb, null, {
    path: '_design/' + name,
    method: CONST.LCB_HTTP_METHOD_GET,
    lcb_http_type: CONST.LCB_HTTP_TYPE_VIEW
  }, callback);
};

/**
 * Deletes a design document from the server.
 *
 * @param {string} name
 * The name of the design document to delete.
 * @param {DDocCallback} callback
 */
Connection.prototype.removeDesignDoc = function(name, callback) {
  this._cb.httpRequest.call(this._cb, null, {
    path: '_design/' + name,
    method: CONST.LCB_HTTP_METHOD_DELETE,
    lcb_http_type: CONST.LCB_HTTP_TYPE_VIEW
  }, callback);
};

/**
 * Connected Event.
 * Invoked once the connection has been established successfully.
 *
 * @event Connection#connect
 * @param {undefined|Error} err
 * The error that occured while attempting to connect to the cluster.
 */

/**
 * Error Event.
 * Invoked if the connection encounters any errors without having an
 * operation context available to handle the error.
 *
 * @event Connection#error
 * @param {Error} err
 * The error that occured.
 */

module.exports = Connection;
