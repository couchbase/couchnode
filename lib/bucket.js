'use strict';

var util = require('util');
var fs = require('fs');
var path = require('path');
var JsonParser = require('jsonparse');
var qs = require('querystring');
var request = require('request');
var dns = require('dns');
var events = require('events');
var http = require('http');
var url = require('url');

var binding = require('./binding');
var connStr = require('./connstr');
var ViewQuery = require('./viewquery');
var SpatialQuery = require('./spatialquery');
var N1qlQuery = require('./n1qlquery');
var BucketManager = require('./bucketmgr');

var CONST = binding.Constants;
var CBpp = binding.CouchbaseImpl;

/**
 * The *CAS* value is a special object that indicates the current state
 * of the item on the server. Each time an object is mutated on the server, the
 * value is changed. <i>CAS</i> objects can be used in conjunction with
 * mutation operations to ensure that the value on the server matches the local
 * value retrieved by the client.  This is useful when doing document updates
 * on the server as you can ensure no changes were applied by other clients
 * while you were in the process of mutating the document locally.
 *
 * In the Node.js SDK, the CAS is represented as an opaque value. As such,y
 * ou cannot generate CAS objects, but should rather use the values returned
 * from a {@link Bucket.OpCallback}.
 *
 * @typedef {Object} Bucket.CAS
 */

/**
 * @class CouchbaseError
 * @classdesc
 * The virtual class thrown for all Couchnode errors.
 * @private
 * @extends Error
 */
/**
 * The error code for this error.
 * @var {errors} CouchbaseError#code
 */

/**
 * Single-Key callbacks.
 *
 * This callback is passed to all of the single key functions.
 *
 * It returns a result objcet containing a combination of a CAS and a value,
 * depending on which operation was invoked.
 *
 * @typedef {function} Bucket.OpCallback
 *
 * @param {undefined|Error} error
 *  The error for the operation. This can either be an Error object
 *  or a value which evaluates to false (null, undefined, 0 or false).
 * @param {Object} result
 *  The result of the operation that was executed.  This usually contains
 *  at least a <i>cas</i> property, and on some operations will contain a
 *  <i>value</i> property as well.
 */

/**
 * Multi-Get Callback.
 *
 * This callback is used to return results from a getMulti operation.
 *
 * @typedef {function} Bucket.MultiGetCallback
 *
 * @param {undefined|number} error
 *  The number of keys that failed to be retrieved.  The precise errors
 *  are available by checking the error property of the individual documents.
 * @param {Array.<Object>} results
 *  This is a map of keys to results.  The result for each key will optionally
 *  contain an error if one occured, or if no error occured will contain
 *  the CAS and value of the document.
 */

/**
 * This is used as a callback from executed queries.  It is a shortcut method
 * that automatically subscribes to the rows and error events of the
 * {@link Bucket.ViewQueryResponse}.
 *
 * @typedef {function} Bucket.QueryCallback
 *
 * @param {undefined|Error} error
 *  The error for the operation. This can either be an Error object
 *  or a falsy value.
 * @param {Array.<Object>} rows
 *  The rows returned from the query
 * @param {Bucket.ViewQueryResponse.Meta} meta
 *  The metadata returned by the query.
 */

/**
 * @class Bucket.TranscoderDoc
 * @classdesc
 * A class used in relation to transcoders
 *
 * @property {Buffer} value
 * @property {number} flags
 *
 * @since 2.0.0
 * @uncommitted
 */
/**
 * Transcoder Encoding Function.
 *
 * This function will receive a value when a storage operation is invoked
 * that needs to encode user-provided data for storage into Couchbase.  It
 * expects to be returned a `Buffer` object to store along with an integer
 * representing any flag metadata relating to how to decode the key later
 * using the matching {@link DecoderFunction}.
 *
 * @typedef {function} Bucket.EncoderFunction
 *
 * @param {*} value The value needing encoding.
 * @returns {!Bucket.TranscoderDoc} The data to store to Couchbase.
 */
/**
 * Transcoder Decoding Function.
 *
 * This function will receive an object containing a `Buffer` value and an
 * integer value representing any flags metadata whenever a retrieval
 * operation is executed.  It is expected that this function will return a
 * value representing the original value stored and encoded with its
 * matching {@link EncoderFunction}.
 *
 * @typedef {function} Bucket.DecoderFunction
 *
 * @param {!Bucket.TranscoderDoc} doc The data from Couchbase to decode.
 * @returns {*} The resulting value.
 */

/**
 * @class
 * The Bucket class represents a connection to a Couchbase bucket.  Never
 * instantiate this class directly.  Instead use the {@link Cluster#openBucket}
 * method instead.
 *
 * @private
 *
 * @since 2.0.0
 * @committed
 */
function Bucket(options) {
  // We normalize both for consistency as well as to
  //  create a duplicate object to use
  options.dsnObj = connStr.normalize(options.dsnObj);

  var bucketDsn = connStr.stringify(options.dsnObj);
  var bucketUser = options.username;
  var bucketPass = options.password;

  this._name = options.dsnObj.bucket;
  this._username = options.username;
  this._password = options.password;

  this._cb = new CBpp(bucketDsn, bucketUser, bucketPass);

  this.connected = null;
  this._cb.setConnectCallback(function(err) {
    if (err) {
      this.connected = false;
      var errObj = new Error('failed to connect to bucket');
      errObj.code = err;
      return this.emit('error', errObj);
    }
    this.connected = true;
    this.emit('connect');
  }.bind(this));

  this.waitQueue = [];
  this.on('connect', function() {
    for (var i = 0; i < this.waitQueue.length; ++i) {
      var itm = this.waitQueue[i];
      this._invoke(itm[0], itm[1]);
    }
    this.waitQueue = [];
  });
  this.on('error', function(err) {
    for (var i = 0; i < this.waitQueue.length; ++i) {
      var itm = this.waitQueue[i];
      itm[1][itm[1].length-1](err, null);
    }
    this.waitQueue = [];
  });

  this.httpAgent = new http.Agent();
  this.httpAgent.maxSockets = 250;

  /* istanbul ignore else  */
  if (options.dsnObj.hosts.length !== 1 ||
      options.dsnObj.hosts[0][1] ||
      (options.dsnObj.scheme !== 'couchbase' &&
        options.dsnObj.scheme !== 'couchbases')) {
    // We perform the connect on the next tick to ensure
    //   consistent behaviour between SRV and non-SRV.
    process.nextTick(function() {
      this._cb.connect();
    }.bind(this));
  } else {
    var srvHost = options.dsnObj.hosts[0][0];
    var srvPrefix = '_' + options.dsnObj.scheme;

    dns.resolveSrv(srvPrefix + '.' + srvHost, function(err, addrs) {
      if (!err) {
        options.dsnObj.hosts = [];
        for (var i = 0; i < addrs.length; ++i) {
          options.dsnObj.hosts.push([addrs[i].name, addrs[i].port]);
        }
        var srvDsn = connStr.stringify(options.dsnObj);
        this._cb.control(CONST.CNTL_REINIT_DSN, CONST.CNTL_SET, srvDsn);
      }

      this._cb.connect();
    }.bind(this));
  }
}
util.inherits(Bucket, events.EventEmitter);

/**
 * Connected Event.
 * Invoked once the connection has been established successfully.
 *
 * @event Bucket#connect
 *
 * @since 2.0.0
 * @committed
 */

/**
 * Error Event.
 * Invoked if the connection encounters any errors without having an
 * operation context available to handle the error.
 *
 * @event Bucket#error
 * @param {Error} err
 * The error that occured while attempting to connect to the cluster.
 *
 * @since 2.0.0
 * @committed
 */

/**
 * Enables N1QL support on the client.  A cbq-server URI must be passed.  This
 * method will be deprecated in the future in favor of automatic configuration
 * through the connected cluster.
 *
 * @param {string|string[]} hosts
 * An array of host/port combinations which are N1QL servers attached to
 * this cluster.
 *
 * @example
 * bucket.enableN1ql(['http://1.1.1.1:8093/','http://1.1.1.2:8093']);
 *
 * @since 2.0.0
 * @volatile
 */
/* istanbul ignore next */
Bucket.prototype.enableN1ql = function(hosts) {
  if (Array.isArray(hosts)) {
    this.queryhosts = hosts;
  } else {
    this.queryhosts = [hosts];
  }
};

/**
 * Returns an instance of a {@link BuckerManager} for performing management
 * operations against a bucket.
 *
 * @returns {BucketManager}
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.manager = function() {
  return new BucketManager(this);
};

/**
 * Shuts down this connection.
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.disconnect = function() {
  if (this.connected !== false) {
    this.connected = false;
    this._cb.shutdown();
  }
};

/**
 * Configures a custom set of transcoder functions for encoding and decoding
 * values that are being stored or retreived from the server.
 *
 * @param {EncoderFunction} encoder The function for encoding.
 * @param {DecoderFunction} decoder The function for decoding.
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.setTranscoder = function(encoder, decoder) {
  this._cb.setTranscoder(encoder, decoder);
};

/**
 * Picks a random CAPI node and builds an http or https request against
 * it using the passed path.
 *
 * @param path
 * @param method
 * @returns {http.ClientRequest}
 *
 * @private
 * @ignore
 */
Bucket.prototype._capiRequest = function(path, method, callback) {
  var nodeUri = url.parse(this._cb.getViewNode.call(this._cb));
  var reqOpts = {
    agent: this.httpAgent,
    hostname: nodeUri.hostname,
    port: nodeUri.port,
    path: (nodeUri.path!=='/'?nodeUri.path:'') + '/' + path,
    method: method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (this._password) {
    reqOpts.auth = this._username + ':' + this._password;
  }
  callback(null, http.request(reqOpts));
};

/**
 * Picks a random management node and builds an http or https request against
 * it using the passsed path.
 *
 * @param path
 * @returns {http.ClientRequest}
 *
 * @private
 * @ignore
 */
Bucket.prototype._mgmtRequest = function(path, method, callback) {
  var nodeUri = url.parse('http://'+this._cb.getMgmtNode.call(this._cb));
  var reqOpts = {
    hostname: nodeUri.hostname,
    port: nodeUri.port,
    path: (nodeUri.path!=='/'?nodeUri.path:'') + '/' + path,
    method: method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (this._password) {
    reqOpts.auth = this._username + ':' + this._password;
  }
  callback(null, http.request(reqOpts));
};

/**
 * @class Meta
 * @classdesc
 * The meta-information available from a view query response.
 * @private
 * @memberof Bucket.ViewQueryResponse
 */
/**
 * The total number of rows available in the index of the view
 * that was queried.
 *
 * @var {number} Bucket.ViewQueryResponse.Meta#total_rows
 * @since 2.0.0
 * @committed
 */

/**
 * Emitted whenever a new row is available from a queries result set.
 *
 * @event Bucket.ViewQueryResponse#row
 * @param {Object} row
 * @param {Bucket.ViewQueryResponse.Meta} meta
 *
 * @since 2.0.0
 * @committed
 */
/**
 * Emitted whenever all rows are available from a queries result set.
 *
 * @event Bucket.ViewQueryResponse#rows
 * @param {Object[]} rows
 * @param {Bucket.ViewQueryResponse.Meta} meta
 *
 * @since 2.0.0
 * @committed
 */
/**
 * Emitted once a query has completed executing and emitting all rows.
 *
 * @event Bucket.ViewQueryResponse#end
 * @param {Bucket.ViewQueryResponse.Meta} meta
 *
 * @since 2.0.0
 * @committed
 */
/**
 * Emitted if an error occurs while executing a query.
 *
 * @event Bucket.ViewQueryResponse#error
 * @param {Error} error
 *
 * @since 2.0.0
 * @committed
 */

/**
 * An event emitter allowing you to bind to various query result set
 * events.
 *
 * @constructor
 *
 * @private
 * @memberof Bucket
 * @extends events.EventEmitter
 *
 * @since 2.0.0
 * @committed
 */
function ViewQueryResponse() {
}
util.inherits(ViewQueryResponse, events.EventEmitter);

/**
 * Executes a view http request.
 *
 * @param {string} viewtype
 * @param {string} ddoc
 * @param {string} name
 * @param {Object} q
 * @param {ViewQueryResponse} emitter
 *
 * @private
 * @ignore
 */
Bucket.prototype._viewReq = function(viewtype, ddoc, name, q, emitter) {
  var isSpatial = false;
  if (viewtype === '_spatial') {
    isSpatial = true;
  }

  var includeDocs = false;
  var opts = {};
  for (var i in q) {
    if (q.hasOwnProperty(i)) {
      if (i === 'include_docs') {
        if (q[i] && q[i] === 'true') {
          includeDocs = true;
        } else {
          includeDocs = false;
        }
      } else {
        opts[i] = q[i];
      }
    }
  }

  var rows = [];
  this._cb.viewQuery(
      isSpatial,
      ddoc, name,
      qs.stringify(opts),
      includeDocs,
  function(errCode, val) {
    if (errCode === -1) {
      var row = val;
      rows.push(row);
      emitter.emit('row', row);
    } else if (errCode === 0) {
      var meta = val;
      emitter.emit('rows', rows, meta);
      emitter.emit('end', meta);
    } else {
      var errStr = val;
      var jsonError = JSON.parse(errStr);
      var errorMessage = jsonError.message;
      if (jsonError.error || jsonError.reason) {
        var subError = jsonError.error + ': ' + jsonError.reason;
        if (!errorMessage) {
          errorMessage = subError;
        } else {
          errorMessage += ' (' + subError + ')';
        }
      }
      emitter.emit('error', new Error(errorMessage));
    }
  });
};

/**
 * Performs a view request.
 *
 * @param {string} viewtype
 * @param {string} ddoc
 * @param {string} name
 * @param {Object} q
 * @param {function(err,res,meta)} callback
 *
 * @private
 * @ignore
 */
Bucket.prototype._view = function(viewtype, ddoc, name, q, callback) {
  var path = '_design/' + ddoc + '/' + viewtype + '/' +
      name + '?' + qs.stringify(q);

  var req = new ViewQueryResponse();
  this._maybeInvoke(this._viewReq.bind(this),
      [viewtype, ddoc, name, q, req, callback]);

  if (callback) {
    req.on('rows', function(rows, meta) {
      callback(null, rows, meta);
    });
    req.on('error', function(err) {
      callback(err, null, null);
    });
  }

  return req;
};

/**
 * @class Meta
 * @classdesc
 * The meta-information available from a view query response.
 * @private
 * @memberof Bucket.N1qlQueryResponse
 */
/**
 * The identifier for this query request.
 *
 * @var {number} Bucket.N1qlQueryResponse.Meta#requestID
 * @since 2.0.8
 * @committed
 */

/**
 * Emitted whenever a new row is available from a queries result set.
 *
 * @event Bucket.N1qlQueryResponse#row
 * @param {Object} row
 * @param {Bucket.N1qlQueryResponse.Meta} meta
 *
 * @since 2.0.8
 * @committed
 */
/**
 * Emitted whenever all rows are available from a queries result set.
 *
 * @event Bucket.N1qlQueryResponse#rows
 * @param {Object[]} rows
 * @param {Bucket.N1qlQueryResponse.Meta} meta
 *
 * @since 2.0.8
 * @committed
 */
/**
 * Emitted once a query has completed executing and emitting all rows.
 *
 * @event Bucket.N1qlQueryResponse#end
 * @param {Bucket.N1qlQueryResponse.Meta} meta
 *
 * @since 2.0.8
 * @committed
 */
/**
 * Emitted if an error occurs while executing a query.
 *
 * @event Bucket.N1qlQueryResponse#error
 * @param {Error} error
 *
 * @since 2.0.8
 * @committed
 */

/**
 * An event emitter allowing you to bind to various query result set
 * events.
 *
 * @constructor
 *
 * @private
 * @memberof Bucket
 * @extends events.EventEmitter
 *
 * @since 2.0.8
 * @committed
 */
function N1qlQueryResponse() {
}
util.inherits(N1qlQueryResponse, events.EventEmitter);

/**
 * Executes a N1QL http request.
 *
 * @param {string} queryStr
 * @param {N1qlQueryResponse} emitter
 *
 * @private
 * @ignore
 */
Bucket.prototype._n1qlReq = function(host, q, emitter) {
  var rows = [];
  this._cb.n1qlQuery(
      host, q,
  function(errCode, val) {
    if (errCode === -1) { // Row
      var row = val;
      rows.push(row);
      emitter.emit('row', row);
    } else if (errCode === 0) { // Success
      var meta = val;
      emitter.emit('rows', rows, meta);
      emitter.emit('end', meta);
    } else { // Error
      var errStr = val;
      var jsonError = JSON.parse(errStr);
      var err;
      if (jsonError.errors.length > 0) {
        var firstErr = jsonError.errors[0];
        err = new Error(firstErr.msg);
        err.code = firstErr.code;
        err.otherErrors = [];

        for (var i = 1; i < jsonError.errors.length; ++i) {
          var nextErr = jsonError.errors[i];
          var otherErr = new Error(nextErr.msg);
          otherErr.code = nextErr.code;
          err.otherErrors.push(otherErr);
        }
      } else {
        err = new Error('An unknown error occured');
      }
      err.requestID = jsonError.requestID;

      emitter.emit('error', err);
    }
  });
};

/**
 * Executes a N1QL query from a N1QL query string.
 *
 * @param {string} query
 * @param {function} callback

 * @private
 * @ignore
 */
Bucket.prototype._n1ql = function(query, params, callback) {
  var host;
  if (this.queryhosts) {
    var qhosts = this.queryhosts;
    host = qhosts[Math.floor(Math.random() * qhosts.length)];
    if (host.indexOf(':') === -1) {
      host = host + ':8093';
    }
  }

  var req = new N1qlQueryResponse();
  this._maybeInvoke(this._n1qlReq.bind(this),
      [host, query.toObject(params), req, callback]);

  if (callback) {
    req.on('rows', function(rows, meta) {
      callback(null, rows, meta);
    });
    req.on('error', function(err) {
      callback(err, null, null);
    });
  }

  return req;
};

/**
 * Executes a previously prepared query object.  This could be a
 * {@link ViewQuery} or a {@link N1qlQuery}.
 *
 * Note: N1qlQuery queries are currently an uncommitted interface and may be
 * subject to change in 2.0.0's final release.
 *
 * @param {ViewQuery|N1qlQuery} query
 * The query to execute.
 * @param {Object|Array} [params]
 * A list or map to do replacements on a N1QL query.
 * @param {Bucket.QueryCallback} callback
 * @returns {Bucket.ViewQueryResponse|Bucket.N1qlQueryResponse}
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.query = function(query, params, callback) {
  if (params instanceof Function) {
    callback = arguments[1];
    params = undefined;
  }

  if (query instanceof ViewQuery) {
    return this._view(
        '_view', query.ddoc, query.name, query.options, callback);
  } else if (query instanceof SpatialQuery) {
    return this._view(
        '_spatial', query.ddoc, query.name, query.options, callback);
  } else if (query instanceof N1qlQuery) {
    return this._n1ql(
        query, params, callback
    );
  } else {
    throw new TypeError(
        'First argument needs to be a ViewQuery, SpatialQuery or N1qlQuery.');
  }
};

/**
 * Gets or sets a libcouchbase instance setting.
 *
 * @private
 * @ignore
 */
Bucket.prototype._ctl = function(cc, value) {
  if (value !== undefined) {
    return this._cb.control.call(this._cb, cc, CONST.CNTL_SET, value);
  } else {
    return this._cb.control.call(this._cb, cc, CONST.CNTL_GET);
  }
};


/**
 * Creates an durability failure Error object.
 *
 * @param {Error} innerError
 * The internal error that occured that caused the durability requirements to
 * fail to succeed.
 * @returns {CouchbaseError}
 *
 * @private
 * @ignore
 */
function _endureError(innerError)
{
  var out_error = new binding.Error('Durability requirements failed');
  out_error.code = CONST['ErrorCode::DURABILITY_FAILED'];
  out_error.innerError = innerError;
  return out_error;
}

/**
 * Common callback interceptor for durability requirements.  This function
 * will wrap user-provided callbacks in a handler which will ensure all
 * durability requirements are met prior to invoking the user-provided callback.
 *
 * @private
 * @ignore
 */
Bucket.prototype._interceptEndure =
    function(key, options, is_delete, callback) {
  if (!options.persist_to && !options.replicate_to) {
    // leave early if we can
    return callback;
  }

  // Return our interceptor
  var _this = this;
  return function(err, res) {
    if (err) {
      callback(err, res);
      return;
    }

    _this._cb.durability.call(_this._cb, key, options.hashkey, res.cas,
        options.persist_to, options.replicate_to, is_delete,
        function(endure_err) {
      if(endure_err) {
        callback(_endureError(endure_err), res);
        return;
      }

      callback(err, res);
    });
  };
};

/**
 * Invokes an operation and dispatches a callback error if one occurs.
 *
 * @param {Function} fn The operation callback to invoke.
 * @param {Array.<*>} args An array of arguments to pass to the function.
 *
 * @private
 * @ignore
 */
Bucket.prototype._invoke = function(fn, args) {
  try {
    fn.apply(this._cb, args);
  } catch(e) {
    args[args.length-1](e, null);
  }
};

/**
 * Will either invoke the binding method specified by fn, or alternatively
 * push the operation to a queue which is flushed once a connection
 * has been established or failed.
 *
 * @param {Function} fn The binding method to invoke.
 * @param {Array} args A list of arguments for the method.
 *
 * @private
 * @ignore
 */
Bucket.prototype._maybeInvoke = function(fn, args) {
  if (this.connected === true) {
    this._invoke(fn, args);
  } else if (this.connected === false) {
    throw new Error('cannot perform operations on a shutdown bucket');
  } else {
    this.waitQueue.push([fn, args]);
  }
};

/**
 * Deduces if the C++ binding layer will accept the passed value
 * as an appropriately typed key.
 *
 * @param {string|Buffer} key The key
 * @returns {boolean}
 *
 * @private
 * @ignore
 */
Bucket.prototype._isValidKey = function(key) {
  return typeof key === 'string' || key instanceof Buffer;
};

/**
 * Checks that the passed options have a valid hashkey specified.
 * Note that hashkey/groupid is not a supported feature of Couchbase Server
 * and this client. It should be considered volatile and experimental. Using
 * this could lead to an unbalanced cluster, inability to interoperate with the
 * data from other languages, not being able to use the Couchbase Server UI to
 * look up documents and other possible future upgrade/migration concerns.
 *
 * @param {Object} options The options objects to check.
 *
 * @private
 * @ignore
 */
Bucket.prototype._checkHashkeyOption = function(options) {
  if (options.hashkey !== undefined) {
    if (!this._isValidKey(options.hashkey)) {
      throw new TypeError('hashkey option needs to be a string or buffer.');
    }
  }
};

/**
 * Checks that the passed options have a valid expiry specified.
 *
 * @param {Object} options The options objects to check.
 *
 * @private
 * @ignore
 */
Bucket.prototype._checkExpiryOption = function(options) {
  if (options.expiry !== undefined) {
    if (typeof options.expiry !== 'number' || options.expiry < 0) {
      throw new TypeError('expiry option needs to be 0 or a positive integer.');
    }
  }
};

/**
 * Checks that the passed options have a valid cas specified.
 *
 * @param {Object} options The options objects to check.
 *
 * @private
 * @ignore
 */
Bucket.prototype._checkCasOption = function(options) {
  if (options.cas !== undefined) {
    if (typeof options.cas !== 'object' && typeof options.cas !== 'string') {
      throw new TypeError('cas option needs to be a CAS object or string.');
    }
  }
};

/**
 * Checks that the passed options have a valid persist_to
 * and replicate_to specified.
 *
 * @param {Object} options The options objects to check.
 *
 * @private
 * @ignore
 */
Bucket.prototype._checkDuraOptions = function(options) {
  if (options.persist_to !== undefined) {
    if (typeof options.persist_to !== 'number' ||
      options.persist_to < 0 || options.persist_to > 8) {
      throw new TypeError(
        'persist_to option needs to be an integer between 0 and 8.');
    }
  }
  if (options.replicate_to !== undefined) {
    if (typeof options.replicate_to !== 'number' ||
      options.replicate_to < 0 || options.replicate_to > 8) {
      throw new TypeError(
        'replicate_to option needs to be an integer between 0 and 8.');
    }
  }
};

/**
 * Retrieves a document.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {Object} [options]
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.get = function(key, options, callback) {
  if (options instanceof Function) {
    callback = arguments[1];
    options = {};
  }

  if (!this._isValidKey(key)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Second argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Third argument needs to be a callback.');
  }
  this._checkHashkeyOption(options);

  this._maybeInvoke(this._cb.get, [key, options.hashkey, 0, 0, callback]);
};

/**
 * Retrieves a list of keys
 *
 * @param {Array.<Buffer|string>} keys
 * The target document keys.
 * @param {Bucket.MultiGetCallback} callback
 *
 * @see Bucket#get
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.getMulti = function(keys, callback) {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new TypeError('First argument needs to be an array of length > 0.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Second argument needs to be a callback.');
  }

  var self = this;
  var outMap = {};
  var resCount = 0;
  var errCount = 0;
  function getSingle(key) {
    self.get(key, function(err, res) {
      resCount++;
      if (err) {
        errCount++;
        outMap[key] = { error: err };
      } else {
        outMap[key] = res;
      }
      if (resCount === keys.length) {
        return callback(errCount, outMap);
      }
    });
  }
  for (var i = 0; i < keys.length; ++i) {
    getSingle(keys[i]);
  }
};

/**
 * Retrieves a document and updates the expiry of the item at the same time.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {number} expiry
 * The expiration time to use. If a value of 0 is provided, then the
 * current expiration time is cleared and the key is set to
 * never expire. Otherwise, the key is updated to expire in the
 * time provided (in seconds).
 * @param {Object} [options]
 * @param {Bucket.OpCallback} callback
 *
 * @see Bucket#get
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.getAndTouch = function(key, expiry, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  if (typeof key !== 'string' && !(key instanceof Buffer)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof expiry !== 'number' || expiry < 0) {
    throw new TypeError('Second argument needs to be 0 or a positive integer.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Third argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Fourth argument needs to be a callback.');
  }
  this._checkHashkeyOption(options);
  this._checkDuraOptions(options);

  this._maybeInvoke(this._cb.get, [key, options.hashkey, expiry, 0, callback]);
};

/**
 * Lock the document on the server and retrieve it. When an document is locked,
 * its CAS changes and subsequent operations on the document (without providing
 * the current CAS) will fail until the lock is no longer held.
 *
 * This function behaves identically to {@link Bucket#get} in that it will
 * return the value. It differs in that the document is also locked. This
 * ensures that attempts by other client instances to access this document
 * while the lock is held will fail.
 *
 * Once locked, a document can be unlocked either by explicitly calling
 * {@link Bucket#unlock} or by performing a storage operation
 * (e.g. {@link Bucket#set}, {@link Bucket#replace}, {@link Bucket::append})
 * with the current CAS value.  Note that any other lock operations on this
 * key will fail while a document is locked.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {Object} [options]
 *  @param {number} [options.lockTime=15]
 *  The duration of time the lock should be held for. Note that the maximum
 *  duration for a lock is 30 seconds, and if a higher value is specified,
 *  it will be rounded to this number.
 * @param {Bucket.OpCallback} callback
 *
 * @see Bucket#get
 * @see Bucekt#unlock
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.getAndLock = function(key, options, callback) {
  if (options instanceof Function) {
    callback = arguments[1];
    options = {};
  }

  if (!this._isValidKey(key)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Second argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Third argument needs to be a callback.');
  }
  if (options.lockTime !== undefined) {
    if (typeof options.lockTime !== 'number' || options.lockTime < 1) {
      throw new TypeError('lockTime option needs to be a positive integer.');
    }
  }
  this._checkHashkeyOption(options);

  this._maybeInvoke(this._cb.get,
    [key, options.hashkey, options.lockTime, 1, callback]);
};

/**
 * Get a document from a replica server in your cluster.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {Object} [options]
 *  @param {number} [options.index=undefined]
 *  The index for which replica you wish to retrieve this value from, or
 *  if undefined, use the value from the first server that replies.
 * @param {Bucket.OpCallback} callback
 *
 * @see Bucket#get
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.getReplica = function(key, options, callback) {
  if (options instanceof Function) {
    callback = arguments[1];
    options = {};
  }
  if (typeof key !== 'string' && !(key instanceof Buffer)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Second argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Third argument needs to be a callback.');
  }
  if (options.hashkey !== undefined) {
    if (!this._isValidKey(options.hashkey)) {
      throw new TypeError('hashkey option needs to be a string or buffer.');
    }
  }
  this._checkHashkeyOption(options);

  this._maybeInvoke(this._cb.getReplica,
    [key, options.hashkey, options.index, callback]);
};

/**
 * Update the document expiration time.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {number} expiry
 * The expiration time to use. If a value of 0 is provided, then the
 * current expiration time is cleared and the key is set to
 * never expire. Otherwise, the key is updated to expire in the
 * time provided (in seconds).
 * @param {Object} [options]
 *  @param {number} [options.persist_to=0]
 *  Ensures this operation is persisted to this many nodes
 *  @param {number} [options.replicate_to=0]
 *  Ensures this operation is replicated to this many nodes
 * @param {Bucket.OpCallback} callback.
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.touch = function(key, expiry, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  if (!this._isValidKey(key)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof expiry !== 'number' || expiry < 0) {
    throw new TypeError('Second argument needs to be 0 or a positive integer..');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Third argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Fourth argument needs to be a callback.');
  }
  this._checkHashkeyOption(options);
  this._checkCasOption(options);
  this._checkDuraOptions(options);

  this._maybeInvoke(this._cb.get, [key, options.hashkey, expiry, 0, callback]);
};

/**
 * Unlock a previously locked document on the server.  See the
 * {@link Bucket#lock} method for more details on locking.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {Bucket.CAS} cas
 * The CAS value returned when the key was locked.  This operation will fail
 * if the CAS value provided does not match that which was the result of the
 * original lock operation.
 * @param {Object} [options]
 * @param {Bucket.OpCallback} callback
 *
 * @see Bucket#getAndLock
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.unlock = function(key, cas, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }
  if (typeof key !== 'string' && !(key instanceof Buffer)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof cas !== 'object') {
    throw new TypeError('Second argument needs to be a CAS object.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Third argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Fourth argument needs to be a callback.');
  }
  this._checkHashkeyOption(options);

  this._maybeInvoke(this._cb.unlock, [key, options.hashkey, cas, callback]);
};

/**
 * Deletes a document on the server.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {Object} [options]
 *  @param {Bucket.CAS} [options.cas=undefined]
 *  The CAS value to check. If the item on the server contains a different
 *  CAS value, the operation will fail.  Note that if this option is undefined,
 *  no comparison will be performed.
 *  @param {number} [options.persist_to=0]
 *  Ensures this operation is persisted to this many nodes
 *  @param {number} [options.replicate_to=0]
 *  Ensures this operation is replicated to this many nodes
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.remove = function(key, options, callback) {
  if (options instanceof Function) {
    callback = arguments[1];
    options = {};
  }

  if (!this._isValidKey(key)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Second argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Third argument needs to be a callback.');
  }
  this._checkHashkeyOption(options);
  this._checkCasOption(options);
  this._checkDuraOptions(options);

  this._maybeInvoke(this._cb.remove,
      [key, options.hashkey, options.cas,
        this._interceptEndure(key, options, 1, callback)]);
};

/**
 * Performs a storage operation.  This is a single handler function for all
 * possible storage operations.  This is thanks to libcouchbase handling them
 * all as a single entity as well.
 *
 * @param {string|Buffer} key
 * @param {*} value
 * @param {Object} [options]
 * @param {Bucket.OpCallback} callback
 * @param {number} opType
 *
 * @private
 * @ignore
 */
Bucket.prototype._store = function(key, value, options, callback, opType) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  if (!this._isValidKey(key)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (value === undefined) {
    throw new TypeError('Second argument must not be undefined.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Third argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Fourth argument needs to be a callback.');
  }
  this._checkHashkeyOption(options);
  this._checkExpiryOption(options);
  this._checkCasOption(options);
  this._checkDuraOptions(options);

  this._maybeInvoke(this._cb.store,
    [key, options.hashkey, value, options.expiry, options.cas, opType,
      this._interceptEndure(key, options, 0, callback)]);
};

/**
 * Stores a document to the bucket.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {!*} value
 * The document's contents.
 * @param {Object} [options]
 *  @param {Bucket.CAS} [options.cas=undefined]
 *  The CAS value to check. If the item on the server contains a different
 *  CAS value, the operation will fail.  Note that if this option is undefined,
 *  no comparison will be performed.
 *  @param {number} [options.expiry=0]
 *  Set the initial expiration time for the document.  A value of 0 represents
 *  never expiring.
 *  @param {number} [options.persist_to=0]
 *  Ensures this operation is persisted to this many nodes
 *  @param {number} [options.replicate_to=0]
 *  Ensures this operation is replicated to this many nodes
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.upsert = function(key, value, options, callback) {
  this._store(key, value, options, callback, CONST.SET);
};

/**
 * Identical to {@link Bucket#upsert} but will fail if the document already
 * exists.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {!*} value
 * The document's contents.
 * @param {Object} [options]
 *  @param {number} [options.expiry=0]
 *  Set the initial expiration time for the document.  A value of 0 represents
 *  never expiring.
 *  @param {number} [options.persist_to=0]
 *  Ensures this operation is persisted to this many nodes
 *  @param {number} [options.replicate_to=0]
 *  Ensures this operation is replicated to this many nodes
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.insert = function(key, value, options, callback) {
  this._store(key, value, options, callback, CONST.ADD);
};

/**
 * Identical to {@link Bucket#set}, but will only succeed if the document
 * exists already (i.e. the inverse of {@link Bucket#add}).
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {!*} value
 * The document's contents.
 * @param {Object} [options]
 *  @param {Bucket.CAS} [options.cas=undefined]
 *  The CAS value to check. If the item on the server contains a different
 *  CAS value, the operation will fail.  Note that if this option is undefined,
 *  no comparison will be performed.
 *  @param {number} [options.expiry=0]
 *  Set the initial expiration time for the document.  A value of 0 represents
 *  never expiring.
 *  @param {number} [options.persist_to=0]
 *  Ensures this operation is persisted to this many nodes
 *  @param {number} [options.replicate_to=0]
 *  Ensures this operation is replicated to this many nodes
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.replace = function(key, value, options, callback) {
  this._store(key, value, options, callback, CONST.REPLACE);
};

/**
 * Similar to {@link Bucket#set}, but instead of setting a new key,
 * it appends data to the existing key. Note that this function only makes
 * sense when the stored data is a string; 'appending' to a JSON document may
 * result in parse errors when the document is later retrieved.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {!*} fragment
 * The document's contents to append.
 * @param {Object} [options]
 *  @param {Bucket.CAS} [options.cas=undefined]
 *  The CAS value to check. If the item on the server contains a different
 *  CAS value, the operation will fail.  Note that if this option is undefined,
 *  no comparison will be performed.
 *  @param {number} [options.persist_to=0]
 *  Ensures this operation is persisted to this many nodes
 *  @param {number} [options.replicate_to=0]
 *  Ensures this operation is replicated to this many nodes
 * @param {Bucket.OpCallback} callback
 *
 * @see Bucket#prepend
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.append = function(key, fragment, options, callback) {
  this._store(key, fragment, options, callback, CONST.APPEND);
};

/**
 * Like {@linkcode Bucket#append}, but prepends data to the existing value.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {!*} fragment
 * The document's contents to prepend.
 * @param {Object} [options]
 *  @param {Bucket.CAS} [options.cas=undefined]
 *  The CAS value to check. If the item on the server contains a different
 *  CAS value, the operation will fail.  Note that if this option is undefined,
 *  no comparison will be performed.
 *  @param {number} [options.persist_to=0]
 *  Ensures this operation is persisted to this many nodes
 *  @param {number} [options.replicate_to=0]
 *  Ensures this operation is replicated to this many nodes
 * @param {Bucket.OpCallback} callback
 *
 * @see Bucket#append
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.prepend = function(key, fragment, options, callback) {
  this._store(key, fragment, options, callback, CONST.PREPEND);
};

/**
 * Increments or decrements a key's numeric value.
 *
 * Note that JavaScript does not support 64-bit integers (while libcouchbase
 * and the server do). You might receive an inaccurate value if the
 * number is greater than 53-bits (JavaScript's maximum integer precision).
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {number} delta
 * The amount to add or subtract from the counter value.  This value may be
 * any non-zero integer.
 * @param {Object} [options]
 *  @param {number} [options.initial=undefined]
 *  Sets the initial value for the document if it does not exist.  Specifying
 *  a value of undefined will cause the operation to fail if the document
 *  does not exist, otherwise this value must be equal to or greater than 0.
 *  @param {number} [options.expiry=0]
 *  Set the initial expiration time for the document.  A value of 0 represents
 *  never expiring.
 *  @param {number} [options.persist_to=0]
 *  Ensures this operation is persisted to this many nodes
 *  @param {number} [options.replicate_to=0]
 *  Ensures this operation is replicated to this many nodes
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.counter = function(key, delta, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  if (!this._isValidKey(key)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof delta !== 'number' || delta === 0) {
    throw new TypeError('Second argument must be a non-zero integer.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Third argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Fourth argument needs to be a callback.');
  }
  if (options.initial) {
    if (typeof options.initial !== 'number' || options.initial < 0) {
      throw new TypeError('initial option must be 0 or a positive integer.');
    }
  }
  this._checkHashkeyOption(options);
  this._checkExpiryOption(options);
  this._checkDuraOptions(options);

  this._maybeInvoke(this._cb.arithmetic,
    [key, options.hashkey, options.expiry, delta, options.initial,
      this._interceptEndure(key, options, 0, callback)]);
};

/**
 * Gets or sets the operation timeout in milliseconds. The operation timeout
 * is the time that Bucket will wait for a response from the server for a CRUD
 * operation. If the response is not received within this time frame, the
 * operation is failed with an error.
 *
 * @member {number} Bucket#operationTimeout
 * @default 2500
 *
 * @since 2.0.0
 * @committed
 */
Object.defineProperty(Bucket.prototype, 'operationTimeout', {
  get: function() {
    return this._ctl(CONST.CNTL_OP_TIMEOUT);
  },
  set: function(val) {
    this._ctl(CONST.CNTL_OP_TIMEOUT, val);
  }
});

/**
 * Gets or sets the view timeout in milliseconds. The view timeout is the
 * time that Bucket will wait for a response from the server for a view request.
 * If the response is not received within this time frame, the request fails
 * with an error.
 *
 * @member {number} Bucket#viewTimeout
 *
 * @since 2.0.0
 * @committed
 */
Object.defineProperty(Bucket.prototype, 'viewTimeout', {
  get: function() {
    return this._ctl(CONST.CNTL_VIEW_TIMEOUT);
  },
  set: function(val) {
    this._ctl(CONST.CNTL_VIEW_TIMEOUT, val);
  }
});

/**
 * Gets or sets the durability timeout in milliseconds. The durability timeout
 * is the time that Bucket will wait for a response from the server in regards
 * to a durability request.  If there are no responses received within this time
 * frame, the request fails with an error.
 *
 * @member {number} Bucket#durabilityTimeout
 *
 * @since 2.0.0
 * @committed
 */
Object.defineProperty(Bucket.prototype, 'durabilityTimeout', {
  get: function() {
    return this._ctl(CONST.CNTL_DURABILITY_TIMEOUT);
  },
  set: function(val) {
    this._ctl(CONST.CNTL_DURABILITY_TIMEOUT, val);
  }
});

/**
 * Gets or sets the durability interval in milliseconds. The durability
 * interval is the time that Bucket will wait between requesting new durability
 * information during a durability poll.
 *
 * @member {number} Bucket#durabilityInterval
 *
 * @since 2.0.0
 * @committed
 */
Object.defineProperty(Bucket.prototype, 'durabilityInterval', {
  get: function() {
    return this._ctl(CONST.CNTL_DURABILITY_INTERVAL);
  },
  set: function(val) {
    this._ctl(CONST.CNTL_DURABILITY_INTERVAL, val);
  }
});

/**
 * Gets or sets the management timeout in milliseconds. The management timeout
 * is the time that Bucket will wait for a response from the server for a
 * management request.  If the response is not received within this time frame,
 * the request is failed out with an error.
 *
 * @member {number} Bucket#managementTimeout
 *
 * @since 2.0.0
 * @committed
 */
Object.defineProperty(Bucket.prototype, 'managementTimeout', {
  get: function() {
    return this._ctl(CONST.CNTL_HTTP_TIMEOUT);
  },
  set: function(val) {
    this._ctl(CONST.CNTL_HTTP_TIMEOUT, val);
  }
});

/**
 * Gets or sets the config throttling in milliseconds. The config throttling is
 * the time that Bucket will wait before forcing a configuration refresh.  If no
 * refresh occurs before this period while a configuration is marked invalid,
 * an update will be triggered.
 *
 * @member {number} Bucket#configThrottle
 *
 * @since 2.0.0
 * @committed
 */
Object.defineProperty(Bucket.prototype, 'configThrottle', {
  get: function() {
    return this._ctl(CONST.CNTL_CONFDELAY_THRESH);
  },
  set: function(val) {
    this._ctl(CONST.CNTL_CONFDELAY_THRESH, val);
  }
});

/**
 * Sets or gets the connection timeout in milliseconds. This is the timeout
 * value used when connecting to the configuration port during the initial
 * connection (in this case, use this as a key in the 'options' parameter in
 * the constructor) and/or when Bucket attempts to reconnect in-situ (if the
 * current connection has failed).
 *
 * @member {number} Bucket#connectionTimeout
 * @default 5000
 *
 * @since 2.0.0
 * @committed
 */
Object.defineProperty(Bucket.prototype, 'connectionTimeout', {
  get: function() {
    return this._ctl(CONST.CNTL_CONFIGURATION_TIMEOUT );
  },
  set: function(val) {
    this._ctl(CONST.CNTL_CONFIGURATION_TIMEOUT, val);
  }
});

/**
 * Sets or gets the node connection timeout in msecs. This value is similar to
 * {@link Bucket#connectionTimeout}, but defines the time to wait for a
 * particular node to respond before trying the next one.
 *
 * @member {number} Bucket#nodeConnectionTimeout
 *
 * @since 2.0.0
 * @committed
 */
Object.defineProperty(Bucket.prototype, 'nodeConnectionTimeout', {
  get: function() {
    return this._ctl(CONST.CNTL_CONFIG_NODE_TIMEOUT );
  },
  set: function(val) {
    this._ctl(CONST.CNTL_CONFIG_NODE_TIMEOUT, val);
  }
});

/**
 * Returns the libcouchbase version as a string.  This information will usually
 * be in the format of 2.4.0-fffffff representing the major, minor, patch and
 * git-commit that the built libcouchbase is based upon.
 *
 * @member {string} Bucket#lcbVersion
 *
 * @example
 * "2.4.0-beta.adbf222"
 *
 * @since 2.0.0
 * @committed
 */
Object.defineProperty(Bucket.prototype, 'lcbVersion', {
  get: function() {
    return this._cb.lcbVersion();
  },
  writeable: false
});

/**
 * Returns the version of the Node.js library as a string.
 *
 * @member {string} Bucket#clientVersion
 *
 * @example
 * "2.0.0-beta.fa123bd"
 *
 * @since 2.0.0
 * @committed
 */
Object.defineProperty(Bucket.prototype, 'clientVersion', {
  get: function() {
    var pkgJson = fs.readFileSync(
      path.resolve(__dirname, '../package.json'));
    return JSON.parse(pkgJson).version;
  },
  writeable: false
});

module.exports = Bucket;
