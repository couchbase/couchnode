'use strict';

var util = require('util');
var fs = require('fs');
var path = require('path');
var qs = require('querystring');
var request = require('request');
var dns = require('dns');
var events = require('events');
var http = require('http');
var url = require('url');

var binding = require('./binding');
var connStr = require('./connstr');
var errors = require('./errors');
var ViewQuery = require('./viewquery');
var SpatialQuery = require('./spatialquery');
var N1qlQuery = require('./n1qlquery');
var SearchQuery = require('./searchquery');
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
 * It returns a result object containing a combination of a CAS and a value,
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
 * @param {Object.<Object, Object>} results
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
 * @volatile
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
      return this.emit('error', err);
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
 * @ignore
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
 * Clears the N1QL query cache of all prepared queries.
 *
 * @since 2.3.3
 * @committed
 */
Bucket.prototype.invalidateQueryCache = function() {
  this._cb.invalidateQueryCache();
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

Bucket.prototype._execAndUriParse = function(fn) {
  var uri = fn.call(this._cb);
  if (uri.substr(0, 7) === 'http://' ||
      uri.substr(0, 8) === 'https://') {
    return url.parse(uri);
  } else {
    return url.parse('http://' + uri);
  }
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
  var nodeUri = this._execAndUriParse(this._cb.getViewNode);
  var reqOpts = {
    agent: this.httpAgent,
    hostname: nodeUri.hostname,
    port: nodeUri.port,
    path: '/' + this._name + '/' + path,
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
  var nodeUri = this._execAndUriParse(this._cb.getMgmtNode);
  var reqOpts = {
    hostname: nodeUri.hostname,
    port: nodeUri.port,
    path: '/' + path,
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
 * @param {Object} popts
 * @param {ViewQueryResponse} emitter
 *
 * @private
 * @ignore
 */
Bucket.prototype._viewReq = function(viewtype, ddoc, name, q, popts, emitter) {
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
      JSON.stringify(popts),
      includeDocs,
  function(errCode, val) {
    if (errCode === -1) {
      var row = val;
      if (rows) {
        if (events.EventEmitter.listenerCount(emitter, 'rows') > 0) {
          rows.push(row);
        } else {
          rows = null;
        }
      }
      emitter.emit('row', row);
    } else if (errCode === 0) {
      var meta = val;
      if (rows) {
        emitter.emit('rows', rows, meta);
      }
      emitter.emit('end', meta);
    } else {
      var errStr = val;
      var jsonError = JSON.parse(errStr);
      var errorMessage = 'unknown error : error parsing failed';
      if (jsonError) {
        errorMessage = jsonError.message;
        if (jsonError.error || jsonError.reason) {
          var subError = jsonError.error + ': ' + jsonError.reason;
          if (!errorMessage) {
            errorMessage = subError;
          } else {
            errorMessage += ' (' + subError + ')';
          }
        }
      }

      var err = new Error(errorMessage);
      err.responseBody = errStr;
      emitter.emit('error', err);
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
 * @param {Object} popts
 * @param {function(err,res,meta)} callback
 *
 * @private
 * @ignore
 */
Bucket.prototype._view = function(viewtype, ddoc, name, q, popts, callback) {
  var req = new ViewQueryResponse();

  var invokeCb = callback;
  if (!invokeCb) {
    invokeCb = function(err) {
      req.emit('error', err);
    };
  }

  this._maybeInvoke(this._viewReq.bind(this),
      [viewtype, ddoc, name, q, popts, req, invokeCb]);

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
Bucket.N1qlQueryResponse = N1qlQueryResponse;

/**
 * Executes a N1QL http request.
 *
 * @param {string|undefined} host
 * @param {string} q
 * @param {boolean} adhoc
 * @param {N1qlQueryResponse} emitter
 *
 * @private
 * @ignore
 */
Bucket.prototype._n1qlReq = function(host, q, adhoc, emitter) {
  var rows = [];
  this._cb.n1qlQuery(
      host, q, adhoc,
  function(errCode, val) {
    if (errCode === -1) { // Row
      var row = val;
      if (rows) {
        if (events.EventEmitter.listenerCount(emitter, 'rows') > 0) {
          rows.push(row);
        } else {
          rows = null;
        }
      }
      emitter.emit('row', row);
    } else if (errCode === 0) { // Success
      var meta = val;
      var err;
      if (meta.errors && meta.errors.length > 0) {
        var firstErr = meta.errors[0];
        err = new Error(firstErr.msg);
        err.requestID = meta.requestID;
        err.code = firstErr.code;
        err.otherErrors = [];

        for (var i = 1; i < meta.errors.length; ++i) {
          var nextErr = meta.errors[i];
          var otherErr = new Error(nextErr.msg);
          otherErr.code = nextErr.code;
          err.otherErrors.push(otherErr);
        }

        delete meta.errors;
        emitter.emit('error', err, meta, rows);
      } else {
        if (rows) {
          emitter.emit('rows', rows, meta);
        }
        emitter.emit('end', meta);
      }
    } else { // Error
      var errStr = val;
      var jsonError = null;
      try {
        jsonError = JSON.parse(errStr);
      } catch(e) { }
      var err;
      if (jsonError && jsonError.errors && jsonError.errors.length > 0) {
        var firstErr = jsonError.errors[0];
        err = new Error(firstErr.msg);
        err.requestID = jsonError.requestID;
        err.code = firstErr.code;
        err.otherErrors = [];

        for (var i = 1; i < jsonError.errors.length; ++i) {
          var nextErr = jsonError.errors[i];
          var otherErr = new Error(nextErr.msg);
          otherErr.code = nextErr.code;
          err.otherErrors.push(otherErr);
        }
      } else {
        err = new Error('An unknown N1QL error occured.' +
            ' This is usually related to an out-of-memory condition.');
      }

      err.responseBody = errStr;

      var meta = jsonError;
      if (meta) {
        delete meta.errors;
      }
      emitter.emit('error', err, meta);
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

  var invokeCb = callback;
  if (!invokeCb) {
    invokeCb = function(err) {
      req.emit('error', err);
    };
  }

  this._maybeInvoke(this._n1qlReq.bind(this),
      [host, query.toObject(params), query.isAdhoc, req, invokeCb]);

  if (callback) {
    req.on('rows', function(rows, meta) {
      callback(null, rows, meta);
    });
    req.on('error', function(err, meta, rows) {
      callback(err, rows, meta);
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
 * The status information for this query, includes properties
 * such as total, failed and successful.
 *
 * @var {number} Bucket.FtsQueryResponse.Meta#status
 * @since 2.1.7
 * @uncommitted
 */
/**
 * Any non-fatal errors that occured during query processing.
 *
 * @var {number} Bucket.FtsQueryResponse.Meta#errors
 * @since 2.1.7
 * @uncommitted
 */
/**
 * The total number of hits that were available for this seach query.
 *
 * @var {number} Bucket.FtsQueryResponse.Meta#totalHits
 * @since 2.1.7
 * @uncommitted
 */
/**
 * The resulting facet information for any facets that were specified
 * in the search query.
 *
 * @var {number} Bucket.FtsQueryResponse.Meta#facets
 * @since 2.1.7
 * @uncommitted
 */
/**
 * The time spent processing this query.
 *
 * @var {number} Bucket.FtsQueryResponse.Meta#took
 * @since 2.1.7
 * @uncommitted
 */
/**
 * The maximum score out of all the results in this query.
 *
 * @var {number} Bucket.FtsQueryResponse.Meta#maxScore
 * @since 2.1.7
 * @uncommitted
 */

/**
 * Emitted whenever a new row is available from a queries result set.
 *
 * @event Bucket.FtsQueryResponse#row
 * @param {Object} row
 * @param {Bucket.FtsQueryResponse.Meta} meta
 *
 * @since 2.1.7
 * @uncommitted
 */
/**
 * Emitted whenever all rows are available from a queries result set.
 *
 * @event Bucket.FtsQueryResponse#rows
 * @param {Object[]} rows
 * @param {Bucket.FtsQueryResponse.Meta} meta
 *
 * @since 2.1.7
 * @uncommitted
 */
/**
 * Emitted once a query has completed executing and emitting all rows.
 *
 * @event Bucket.FtsQueryResponse#end
 * @param {Bucket.FtsQueryResponse.Meta} meta
 *
 * @since 2.1.7
 * @uncommitted
 */
/**
 * Emitted if an error occurs while executing a query.
 *
 * @event Bucket.FtsQueryResponse#error
 * @param {Error} error
 *
 * @since 2.1.7
 * @uncommitted
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
 * @since 2.1.7
 * @uncommitted
 */
function FtsQueryResponse() {
}
util.inherits(FtsQueryResponse, events.EventEmitter);
Bucket.FtsQueryResponse = FtsQueryResponse;

/**
 * Executes a FTS http request.
 *
 * @param {SearchQuery} q
 * @param {FtsQueryResponse} emitter
 *
 * @private
 * @ignore
 */
Bucket.prototype._ftsReq = function(q, emitter) {
  var rows = [];
  this._cb.ftsQuery(
      q,
      function(errCode, val) {
        if (errCode === -1) { // Row
          var row = val;
          if (rows) {
            if (events.EventEmitter.listenerCount(emitter, 'rows') > 0) {
              rows.push(row);
            } else {
              rows = null;
            }
          }
          emitter.emit('row', row);
        } else if (errCode === 0) { // Success
          var meta = val;
          if (meta instanceof Object) {
            meta.totalHits = meta.total_hits;
            meta.maxScore = meta.max_score;
            delete meta.total_hits;
            delete meta.max_score;
          }
          if (rows) {
            emitter.emit('rows', rows, meta);
          }
          emitter.emit('end', meta);
        } else { // Error
          var err = new Error('An FTS error occured: ' + val);
          emitter.emit('error', err);
        }
      });
};

/**
 * Executes a FTS query from a SearchQuery.
 *
 * @param {SearchQuery} query
 * @param {function} callback

 * @private
 * @ignore
 */
Bucket.prototype._fts = function(query, callback) {
  var req = new FtsQueryResponse();

  var invokeCb = callback;
  if (!invokeCb) {
    invokeCb = function(err) {
      req.emit('error', err);
    };
  }

  this._maybeInvoke(this._ftsReq.bind(this),
      [query, req, invokeCb]);

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
 * {@link ViewQuery}, {@link N1qlQuery} or a {@link SearchQuery}.
 *
 * Note: SearchQuery queries are currently an uncommitted interface and may be
 * subject to change in a future release.
 *
 * @param {ViewQuery|N1qlQuery|SearchQuery} query
 * The query to execute.
 * @param {Object|Array} [params]
 * A list or map to do replacements on a N1QL query.
 * @param {Bucket.QueryCallback} callback
 * @returns
 * {Bucket.ViewQueryResponse|Bucket.N1qlQueryResponse|Bucket.FtsQueryResponse}
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
        '_view', query.ddoc, query.name, query.options, query.postoptions, callback);
  } else if (query instanceof SpatialQuery) {
    return this._view(
        '_spatial', query.ddoc, query.name, query.options, query.postoptions, callback);
  } else if (query instanceof N1qlQuery) {
    return this._n1ql(
        query, params, callback
    );
  } else if (query instanceof SearchQuery) {
    return this._fts(
        query, callback
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
 * Deduces if the C++ binding layer will accept the passed value
 * as an appropriately typed path.
 *
 * @param {string|Buffer} path The path
 * @returns {boolean}
 *
 * @private
 * @ignore
 */
Bucket.prototype._isValidPath = function(path) {
  return typeof path === 'string';
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
    if (typeof options.expiry !== 'number') {
      throw new TypeError('expiry option needs to be a number.');
    }
    if (options.expiry < 0 || options.expiry > 2147483647) {
      throw new TypeError('expiry option needs to between 0 and 2147483647.');
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
 * @param {Object} [options]
 *  @param {number} [options.batch_size=0]
 *  The size of each batch that is used to fetch the specified keys.  A
 *  batch size of zero indicates to perform all operations simultanously.
 * @param {Bucket.MultiGetCallback} callback
 *
 * @see Bucket#get
 *
 * @since 2.0.0
 * @committed
 */
Bucket.prototype.getMulti = function(keys, options, callback) {
  if (options instanceof Function) {
    callback = arguments[1];
    options = {};
  }

  if (!Array.isArray(keys) || keys.length === 0) {
    throw new TypeError('First argument needs to be an array of length > 0.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Second argument needs to be an object or callback.');
  }
  if (typeof callback !== 'function') {
    throw new TypeError('Third argument needs to be a callback.');
  }

  if (!options.batch_size) {
    options.batch_size = keys.length;
  }

  var self = this;
  var outMap = {};
  var sentCount = 0;
  var resCount = 0;
  var errCount = 0;
  function getOne() {
    var key = keys[sentCount++];
    self.get(key, function(err, res) {
      resCount++;
      if (err) {
        errCount++;
        outMap[key] = { error: err };
      } else {
        outMap[key] = res;
      }
      if (sentCount < keys.length) {
        getOne();
        return;
      } else if (resCount === keys.length) {
        callback(errCount, outMap);
        return;
      }
    });
  }
  for (var i = 0; i < options.batch_size; ++i) {
    getOne();
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
 * (e.g. {@link Bucket#upsert}, {@link Bucket#replace}, {@link Bucket::append})
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
 * time provided (in seconds).  Values larger than 30*24*60*60 seconds
 * (30 days) are interpreted as absolute times (from the epoch).
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
    throw new TypeError('Second argument needs to be 0 or a positive integer.');
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
 * Identical to {@link Bucket#upsert}, but will only succeed if the document
 * exists already (i.e. the inverse of {@link Bucket#insert}).
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
 * Similar to {@link Bucket#upsert}, but instead of setting a new key,
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
 * Retrieves a single item from a map document by its key.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {string} path
 * The key within the map.
 * @param {Object} [options]
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.2.3
 * @committed
 */
Bucket.prototype.mapGet = function(key, path, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  this.lookupIn(key, options).get(path).execute(function(err, res) {
    if (err) {
      callback(err, null);
      return;
    }

    try {
      res.value = res.contentByIndex(0);
    } catch (e) {
      callback(e, null);
      return;
    }

    callback(null, res);
  });
};

/**
 * Removes a specified key from the specified map document.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {string} path
 * The key within the map.
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
 * @since 2.2.3
 * @committed
 */
Bucket.prototype.mapRemove = function(key, path, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  this.mutateIn(key, options).remove(path).execute(function(err, res) {
    if (err) {
      callback(err, null);
      return;
    }

    callback(null, res);
  });
};

/**
 * Returns the current number of items in a map document.
 * PERFORMANCE NOTICE: This currently performs a full document fetch...
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {Object} [options]
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.2.3
 * @committed
 */
Bucket.prototype.mapSize = function(key, options, callback) {
  if (options instanceof Function) {
    callback = arguments[1];
    options = {};
  }

  this.get(key, options, function(err, res) {
    if (err) {
      callback(err, null);
      return;
    }

    var mapValues = res.value;
    res.value = 0;

    for (var i in mapValues) {
      if (mapValues.hasOwnProperty(i)) {
        res.value++;
      }
    }

    callback(null, res);
  });
};

/**
 * Inserts an item to a map document.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {string} path
 * The key within the map.
 * @param value
 * The value to store within the map.
 * @param {Object} [options]
 *  @param {boolean} [options.createMap=false]
 *  Creates the document if it does not already exist.
 *  @param {number} [options.expiry=0]
 *  Set the initial expiration time for the document.  A value of 0 represents
 *  never expiring.
 *  @param {number} [options.persist_to=0]
 *  Ensures this operation is persisted to this many nodes
 *  @param {number} [options.replicate_to=0]
 *  Ensures this operation is replicated to this many nodes
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.2.3
 * @committed
 */
Bucket.prototype.mapAdd = function(key, path, value, options, callback) {
  if (options instanceof Function) {
    callback = arguments[3];
    options = {};
  }

  var self = this;
  this.mutateIn(key, options).insert(path, value, false)
      .execute(function(err, res) {
    if (err) {
      if (err.code === errors.keyNotFound && options.createMap) {
        var data = {};
        data[path] = value;

        self.insert(key, data, options, function(err, insertRes) {
          if (err) {
            if (err.code === errors.keyAlreadyExists) {
              self.mapAdd(key, path, value, options, callback);
              return;
            }

            callback(err, null);
            return;
          }

          callback(null, insertRes);
        });
        return;
      }

      callback(err, null);
      return;
    }

    callback(null, res);
  });
};

/**
 * Retrieves an item from a list document by index.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {number} index
 * The index to retrieve within the list.
 * @param {Object} [options]
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.2.3
 * @committed
 */
Bucket.prototype.listGet = function(key, index, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  this.lookupIn(key, options).get('[' + index + ']')
      .execute(function(err, res) {
    if (err) {
      callback(err, null);
      return;
    }

    try {
      res.value = res.contentByIndex(0);
    } catch (e) {
      callback(e, null);
      return;
    }


    callback(null, res);
  });
};

/**
 * Inserts an item to the end of a list document.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param value
 * The value to store within the list.
 * @param {Object} [options]
 *  @param {boolean} [options.createList=false]
 *  Creates the document if it does not already exist.
 *  @param {number} [options.expiry=0]
 *  Set the initial expiration time for the document.  A value of 0 represents
 *  never expiring.
 *  @param {number} [options.persist_to=0]
 *  Ensures this operation is persisted to this many nodes
 *  @param {number} [options.replicate_to=0]
 *  Ensures this operation is replicated to this many nodes
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.2.3
 * @committed
 */
Bucket.prototype.listAppend = function(key, value, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  var self = this;
  this.mutateIn(key, options).arrayAppend('', value, false)
      .execute(function(err, res) {
    if (err) {
      if (err.code === errors.keyNotFound && options.createList) {
        var data = [];
        data.push(value);

        self.insert(key, data, options, function(err, insertRes) {
          if (err) {
            if (err.code === errors.keyAlreadyExists) {
              self.listAppend(key, value, options, callback);
              return;
            }

            callback(err, null);
            return;
          }

          callback(null, insertRes);
        });
        return;
      }

      callback(err, null);
      return;
    }

    callback(null, res);
  });
};

/**
 * @deprecated
 * Alias for listAppend
 */
Bucket.prototype.listPush = Bucket.prototype.listAppend;

/**
 * Inserts an item to the beginning of a list document.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param value
 * The value to store within the list.
 * @param {Object} [options]
 *  @param {boolean} [options.createList=false]
 *  Creates the document if it does not already exist.
 *  @param {number} [options.expiry=0]
 *  Set the initial expiration time for the document.  A value of 0 represents
 *  never expiring.
 *  @param {number} [options.persist_to=0]
 *  Ensures this operation is persisted to this many nodes
 *  @param {number} [options.replicate_to=0]
 *  Ensures this operation is replicated to this many nodes
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.2.3
 * @committed
 */
Bucket.prototype.listPrepend = function(key, value, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  var self = this;
  this.mutateIn(key, options).arrayPrepend('', value, false)
      .execute(function(err, res) {
    if (err) {
      if (err.code === errors.keyNotFound && options.createList) {
        var data = [value];

        self.insert(key, data, options, function(err, insertRes) {
          if (err) {
            if (err.code === errors.keyAlreadyExists) {
              self.listPrepend(key, value, options, callback);
              return;
            }

            callback(err, null);
            return;
          }

          callback(null, insertRes);
        });
        return;
      }

      callback(err, null);
      return;
    }

    callback(null, res);
  });
};

/**
 * @deprecated
 * Alias for listPrepend
 */
Bucket.prototype.listShift = Bucket.prototype.listPrepend;

    /**
 * Removes an item from a list document by its index.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {number} index
 * The index to retrieve within the list.
 * @param {Object} [options]
 *  @param {number} [options.persist_to=0]
 *  Ensures this operation is persisted to this many nodes
 *  @param {number} [options.replicate_to=0]
 *  Ensures this operation is replicated to this many nodes
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.2.3
 * @committed
 */
Bucket.prototype.listRemove = function(key, index, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  this.mutateIn(key, options).remove('[' + index + ']')
      .execute(function(err, res) {
    if (err) {
      callback(err, null);
      return;
    }

    callback(null, res);
  });
};

/**
 * Replaces the item at a particular index of a list document.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {number} index
 * The index to retrieve within the list.
 * @param value
 * The value to store within the list.
 * @param {Object} [options]
 *  @param {number} [options.persist_to=0]
 *  Ensures this operation is persisted to this many nodes
 *  @param {number} [options.replicate_to=0]
 *  Ensures this operation is replicated to this many nodes
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.2.3
 * @committed
 */
Bucket.prototype.listSet = function(key, index, value, options, callback) {
  if (options instanceof Function) {
    callback = arguments[3];
    options = {};
  }

  this.mutateIn(key, options).replace('[' + index + ']', value)
      .execute(function(err, res) {
    if (err) {
      callback(err, null);
      return;
    }

    callback(null, res);
  });
};

/**
 * Returns the current number of items in a list.
 * PERFORMANCE NOTICE: This currently performs a full document fetch...
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {Object} [options]
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.2.3
 * @committed
 */
Bucket.prototype.listSize = function(key, options, callback) {
  if (options instanceof Function) {
    callback = arguments[1];
    options = {};
  }

  this.get(key, options, function(err, res) {
    if (err) {
      callback(err, null);
      return;
    }

    res.value = res.value.length;
    callback(null, res);
  });
};

/**
 * Adds a new value to a set document.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param value
 * The value to store within the list.
 * @param {Object} [options]
 *  @param {boolean} [options.createSet=false]
 *  Creates the document if it does not already exist.
 *  @param {number} [options.expiry=0]
 *  Set the initial expiration time for the document.  A value of 0 represents
 *  never expiring.
 *  @param {number} [options.persist_to=0]
 *  Ensures this operation is persisted to this many nodes
 *  @param {number} [options.replicate_to=0]
 *  Ensures this operation is replicated to this many nodes
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.2.3
 * @committed
 */
Bucket.prototype.setAdd = function(key, value, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  var self = this;
  this.mutateIn(key, options).arrayAddUnique('', value, false)
      .execute(function(err, res) {
    if (err) {
      if (err.code === errors.keyNotFound && options.createSet) {
        var data = [value];

        self.insert(key, data, options, function(err, insertRes) {
          if (err) {
            if (err.code === errors.keyAlreadyExists) {
              self.setAdd(key, value, options, callback);
              return;
            }

            callback(err, null);
            return;
          }

          callback(null, insertRes);
        });
        return;
      }

      callback(err, null);
      return;
    }

    callback(null, res);
  });
};

/**
 * Checks if a particular value exists within the specified set document.
 * PERFORMANCE WARNING: This performs a full set fetch and compare.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param value
 * The value to look for in the set.
 * @param {Object} [options]
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.2.3
 * @committed
 */
Bucket.prototype.setExists = function(key, value, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  this.get(key, options, function(err, res) {
    if (err) {
      callback(err, null);
      return;
    }

    var setValues = res.value;
    res.value = false;

    for(var i in setValues) {
      if (setValues.hasOwnProperty(i)) {
        if (setValues[i] === value) {
          res.value = true;
        }
      }
    }

    callback(null, res);
  });
};

/**
 * Returns the current number of values in a set.
 * PERFORMANCE NOTICE: This currently performs a full document fetch...
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {Object} [options]
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.2.3
 * @committed
 */
Bucket.prototype.setSize = function(key, options, callback) {
  if (options instanceof Function) {
    callback = arguments[1];
    options = {};
  }

  this.get(key, options, function(err, res) {
    if (err) {
      callback(err, null);
      return;
    }

    res.value = res.value.length;
    callback(null, res);
  });
};

/**
 * Removes a specified value from the specified set document.
 * WARNING: This relies on Javascripts's equality comparison behaviour!
 * PERFORMANCE WARNING: This performs full set fetch, modify, store cycles.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param value
 * The value to remove from the set.
 * @param {Object} [options]
 *  @param {number} [options.persist_to=0]
 *  Ensures this operation is persisted to this many nodes
 *  @param {number} [options.replicate_to=0]
 *  Ensures this operation is replicated to this many nodes
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.2.3
 * @committed
 */
Bucket.prototype.setRemove = function(key, value, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  var self = this;
  this.get(key, options, function(err, res) {
    if (err) {
      callback(err, null);
      return;
    }

    var newValues = [];

    for (var i = 0; i < res.value.length; ++i) {
      if (res.value[i] !== value) {
        newValues.push(res.value[i]);
      }
    }

    var replaceOpts = {};
    for (var j in options) {
      if (options.hasOwnProperty(j)) {
        replaceOpts[j] = options[j];
      }
    }

    if (replaceOpts.cas === undefined) {
      replaceOpts.cas = res.cas;
    }

    self.replace(key, newValues, options, function(err, replaceRes) {
      if (err) {
        if (err.code === errors.keyAlreadyExists && options.cas === undefined) {
          self.setRemove(key, value, options, callback);
          return;
        }

        callback(err, null);
        return;
      }

      callback(null, replaceRes);
    });
  });
};

/**
 * Inserts an item to the beginning of a queue document.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param value
 * The value to store within the list.
 * @param {Object} [options]
 *  @param {boolean} [options.createQueue=false]
 *  Creates the document if it does not already exist.
 *  @param {number} [options.expiry=0]
 *  Set the initial expiration time for the document.  A value of 0 represents
 *  never expiring.
 *  @param {number} [options.persist_to=0]
 *  Ensures this operation is persisted to this many nodes
 *  @param {number} [options.replicate_to=0]
 *  Ensures this operation is replicated to this many nodes
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.2.3
 * @committed
 */
Bucket.prototype.queuePush = function(key, value, options, callback) {
  if (options instanceof Function) {
    callback = arguments[2];
    options = {};
  }

  var listOptions = {};
  for (var i in options) {
    if (options.hasOwnProperty(i)) {
      listOptions[i] = options[i];
    }
  }
  listOptions.createList = listOptions.createQueue;

  return this.listPrepend(key, value, options, callback);
};

/**
 * Removes the next item from a queue and returns it.
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {Object} [options]
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.2.5
 * @committed
 */
Bucket.prototype.queuePop = function(key, options, callback) {
  if (options instanceof Function) {
    callback = arguments[1];
    options = {};
  }

  var self = this;

  self.lookupIn(key, options).get('[-1]').execute(function(err, res) {
    if (err) {
      callback(err, null);
      return;
    }

    var removeOpts = {};
    for (var j in options) {
      if (options.hasOwnProperty(j)) {
        removeOpts[j] = options[j];
      }
    }

    if (removeOpts.cas === undefined) {
      removeOpts.cas = res.cas;
    }

    var poppedValue = res.contentByIndex(0);

    self.mutateIn(key, removeOpts).remove('[-1]').execute(function(err, res) {
      if (err) {
        if (err.code === errors.keyAlreadyExists && options.cas === undefined) {
          self.queuePop(key, options, callback);
          return;
        }

        callback(err, null);
        return;
      }

      callback(null, {
        cas: res.cas,
        value: poppedValue,
        token: res.token
      });
    });
  });
};

/**
 * Returns the current number of items in a queue.
 * PERFORMANCE NOTICE: This currently performs a full document fetch...
 *
 * @param {string|Buffer} key
 * The target document key.
 * @param {Object} [options]
 * @param {Bucket.OpCallback} callback
 *
 * @since 2.2.3
 * @committed
 */
Bucket.prototype.queueSize = function(key, options, callback) {
  if (options instanceof Function) {
    callback = arguments[1];
    options = {};
  }

  this.get(key, options, function(err, res) {
    if (err) {
      callback(err, null);
      return;
    }

    res.value = res.value.length;
    callback(null, res);
  });
};

/**
 * @class
 * Represents multiple chunks of a full Document.
 *
 * @private
 *
 * @since 2.1.4
 * @committed
 */
function DocumentFragment(data, paths) {
  if (data) {
    this.cas = data.cas;
    this.contents = data.results;
  } else {
    this.cas = null;
    this.contents = [];
  }
  this.pathMap = null;
  this.indexMap = null;

  for (var i = 0; i < this.contents.length; ++i) {
    this.contents[i].path = paths[this.contents[i].id];
  }
}

DocumentFragment.prototype._contentByIndex = function(index) {
  if (!(index >= 0 && index < this.contents.length)) {
    throw new Error('Referenced item does not exist in result.');
  }

  var item = this.contents[index];
  if (item.error) {
    throw item.error;
  }
  return item.value;
};

/**
 * Retrieve the value of the operation by its index. The index is the position
 * of the operation as it was added to the builder.
 *
 * @param {number} index
 *
 * @since 2.1.4
 * @committed
 */
DocumentFragment.prototype.contentByIndex = function(index) {
  if (!this.indexMap) {
    this.indexMap = {};
    for (var i = 0; i < this.contents.length; ++i) {
      this.indexMap[this.contents[i].id] = i;
    }
  }

  return this._contentByIndex(this.indexMap[index]);
};

/**
 * Retrieve the value of the operation by its path. The path is the path
 * provided to the operation
 *
 * @param {string} path
 *
 * @since 2.1.4
 * @committed
 */
DocumentFragment.prototype.content = function(path) {
  if (!this.pathMap) {
    this.pathMap = {};
    for (var i = 0; i < this.contents.length; ++i) {
      this.pathMap[this.contents[i].path] = i;
    }
  }

  return this._contentByIndex(this.pathMap[path]);
};

/**
 * Checks whether the indicated path exists in this DocumentFragment and no
 * errors were returned from the server.
 *
 * @param {string} path
 *
 * @since 2.1.4
 * @committed
 */
DocumentFragment.prototype.exists = function(path) {
  try {
    this.content(path);
    return true;
  } catch(e) {
    return false;
  }
};

function _parseSdOpts(options) {
  // Backwards compatibility to old 'createParents' option.
  if (options === true || options === false) {
    options = {
      createParents: options
    };
  }

  if (!options) {
    options = {};
  }

  var flags = 0;

  if (options.createParents) {
    flags |= binding.Constants.SDSPEC_F_MKINTERMEDIATES;
  }

  if (options.xattr) {
    flags |= binding.Constants.SDSPEC_F_XATTRPATH;
  }

  if (options.xattrMacro) {
    flags |= binding.Constants.SDSPEC_F_XATTR_MACROVALUES;
  }

  return flags;
};

/**
 * @class
 * Builder used to create a set of sub-document lookup operations.
 *
 * @private
 *
 * @since 2.1.4
 * @committed
 */
function LookupInBuilder(bucket, data) {
  this.bucket = bucket;
  this.data = data;
  this.opPaths = [];
}

LookupInBuilder.prototype._addOp = function() {
  this.data.push.apply(this.data, arguments);
  this.opPaths.push(arguments[1]);
  return this;
};

/**
 * Indicate a path to be retrieved from the document.  The value of the path
 * can later be retrieved (after .execute()) using the content or contentByIndex
 * method. The path syntax follows N1QL's path syntax (e.g. `foo.bar.baz`).
 *
 * @param {string} path
 * @param {Object} [options]
 * @param {boolean} [options.xattr]
 * @param {boolean} [options.xattrMacro]
 * @returns {LookupInBuilder}
 *
 * @since 2.1.4
 * @committed
 */
LookupInBuilder.prototype.get = function(path, options) {
  return this._addOp(binding.Constants.SDCMD_GET,
      path, _parseSdOpts(options));
};

/**
 * Indicate a path to have its element count retrieved from the document.  The
 * value of the path can later be retrieved (after .execute()) using the content
 * or contentByIndex method. The path syntax follows N1QL's path syntax
 * (e.g. `foo.bar.baz`).
 *
 * @param {string} path
 * @param {Object} [options]
 * @param {boolean} [options.xattr]
 * @param {boolean} [options.xattrMacro]
 * @returns {LookupInBuilder}
 *
 * @since 2.3.4
 * @committed
 */
LookupInBuilder.prototype.getCount = function(path, options) {
  return this._addOp(binding.Constants.SDCMD_GET_COUNT,
      path, _parseSdOpts(options));
};

/**
 * Similar to get(), but does not actually retrieve the value from the server.
 * This may save bandwidth if you only need to check for the existence of a
 * path (without caring for its content). You can check the status of this
 * operation by using .content (and ignoring the value) or .exists()
 *
 * @param {string} path
 * @param {Object} [options]
 * @param {boolean} [options.xattr]
 * @param {boolean} [options.xattrMacro]
 * @returns {LookupInBuilder}
 *
 * @since 2.1.4
 * @committed
 */
LookupInBuilder.prototype.exists = function(path, options) {
  return this._addOp(binding.Constants.SDCMD_EXISTS,
      path, _parseSdOpts(options));
};

/**
 * Executes this set of lookup operations on the bucket.
 *
 * @param callback
 *
 * @since 2.1.4
 * @committed
 */
LookupInBuilder.prototype.execute = function(callback) {
  return this.bucket._lookupIn(this, callback);
};

/**
 * Creates a sub-document lookup operation builder.
 *
 * @param {string} key
 * @param {Object} [options]
 *
 * @returns {LookupInBuilder}
 *
 * @since 2.1.4
 * @committed
 */
Bucket.prototype.lookupIn = function(key, options) {
  if (!options) {
    options = {};
  }

  if (!this._isValidKey(key)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Second argument needs to be an object if set.');
  }
  this._checkHashkeyOption(options);

  return new LookupInBuilder(this, [key, options.hashkey]);
};

Bucket.prototype._lookupIn = function(builder, callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('Execute argument needs to be a callback.');
  }

  var data = builder.data.concat([function(err, res) {
    callback(err, new DocumentFragment(res, builder.opPaths));
  }]);
  this._maybeInvoke(this._cb.lookupIn, data);
};

/**
 * @class
 * Builder used to create a set of sub-document mutation operations.
 *
 * @private
 *
 * @since 2.1.4
 * @committed
 */
function MutateInBuilder(bucket, data) {
  this.bucket = bucket;
  this.data = data;
  this.opPaths = [];
}

MutateInBuilder.prototype._addOp = function() {
  this.data.push.apply(this.data, arguments);
  this.opPaths.push(arguments[1]);
  return this;
};

/**
 * Adds an insert operation to this mutation operation set.
 *
 * @param {string} path
 * @param {Object} value
 * @param {Object} [options]
 * @param {boolean} [options.createParents]
 * @param {boolean} [options.xattr]
 * @param {boolean} [options.xattrMacro]
 * @returns {MutateInBuilder}
 *
 * @since 2.1.4
 * @committed
 */
MutateInBuilder.prototype.insert = function(path, value, options) {
  return this._addOp(binding.Constants.SDCMD_DICT_ADD,
      path, _parseSdOpts(options), value);
};

/**
 * Adds an upsert operation to this mutation operation set.
 *
 * @param {string} path
 * @param {Object} value
 * @param {Object} [options]
 * @param {boolean} [options.createParents]
 * @param {boolean} [options.xattr]
 * @param {boolean} [options.xattrMacro]
 * @returns {MutateInBuilder}
 *
 * @since 2.1.4
 * @committed
 */
MutateInBuilder.prototype.upsert = function(path, value, options) {
  return this._addOp(binding.Constants.SDCMD_DICT_UPSERT,
      path, _parseSdOpts(options), value);
};

/**
 * Adds an replace operation to this mutation operation set.
 *
 * @param {string} path
 * @param {Object} value
 * @param {Object} [options]
 * @param {boolean} [options.xattr]
 * @param {boolean} [options.xattrMacro]
 * @returns {MutateInBuilder}
 *
 * @since 2.1.4
 * @committed
 */
MutateInBuilder.prototype.replace = function(path, value, options) {
  return this._addOp(binding.Constants.SDCMD_REPLACE,
      path, _parseSdOpts(options), value);
};

/**
 * Adds an remove operation to this mutation operation set.
 *
 * @param {string} path
 * @param {Object} [options]
 * @param {boolean} [options.xattr]
 * @param {boolean} [options.xattrMacro]
 * @returns {MutateInBuilder}
 *
 * @since 2.1.4
 * @committed
 */
MutateInBuilder.prototype.remove = function(path, options) {
  return this._addOp(binding.Constants.SDCMD_REMOVE,
      path, _parseSdOpts(options));
};

/**
 * Adds an array push front operation to this mutation operation set.
 *
 * @param {string} path
 * @param {Object} value
 * @param {Object} [options]
 * @param {boolean} [options.createParents]
 * @param {boolean} [options.xattr]
 * @param {boolean} [options.xattrMacro]
 * @returns {MutateInBuilder}
 *
 * @since 2.1.4
 * @committed
 */
MutateInBuilder.prototype.arrayPrepend = function(path, value, options) {
  return this._addOp(binding.Constants.SDCMD_ARRAY_ADD_FIRST,
      path, _parseSdOpts(options), value);
};

/**
 * @deprecated
 * Alias for arrayPrepend
 */
MutateInBuilder.prototype.pushFront = MutateInBuilder.prototype.arrayPrepend;

/**
 * Adds an array push back operation to this mutation operation set.
 *
 * @param {string} path
 * @param {Object} value
 * @param {Object} [options]
 * @param {boolean} [options.createParents]
 * @param {boolean} [options.xattr]
 * @param {boolean} [options.xattrMacro]
 * @returns {MutateInBuilder}
 *
 * @since 2.2.1
 * @committed
 */
MutateInBuilder.prototype.arrayAppend = function(path, value, options) {
  return this._addOp(binding.Constants.SDCMD_ARRAY_ADD_LAST,
      path, _parseSdOpts(options), value);
};

/**
 * @deprecated
 * Alias for arrayAppend
 */
MutateInBuilder.prototype.pushBack = MutateInBuilder.prototype.arrayAppend;

/**
 * Adds an array insert operation to this mutation operation set.
 *
 * @param {string} path
 * @param {Object} value
 * @param {Object} [options]
 * @param {boolean} [options.xattr]
 * @param {boolean} [options.xattrMacro]
 * @returns {MutateInBuilder}
 *
 * @since 2.1.4
 * @committed
 */
MutateInBuilder.prototype.arrayInsert = function(path, value, options) {
  return this._addOp(binding.Constants.SDCMD_ARRAY_INSERT,
      path, _parseSdOpts(options), value);
};

/**
 * Adds an array add unique operation to this mutation operation set.
 *
 * @param {string} path
 * @param {Object} value
 * @param {Object} [options]
 * @param {boolean} [options.createParents]
 * @param {boolean} [options.xattr]
 * @param {boolean} [options.xattrMacro]
 * @returns {MutateInBuilder}
 *
 * @since 2.2.1
 * @committed
 */
MutateInBuilder.prototype.arrayAddUnique =
    function(path, value, options) {
  return this._addOp(binding.Constants.SDCMD_ARRAY_ADD_UNIQUE,
      path, _parseSdOpts(options), value);
};

/**
 * @deprecated
 * Alias for arrayAddUnique
 */
MutateInBuilder.prototype.addUnique = MutateInBuilder.prototype.arrayAddUnique;

/**
 * Adds a count operation to this mutation operation set.
 *
 * @param {string} path
 * @param {number} delta
 * @param {Object} [options]
 * @param {boolean} [options.createParents]
 * @param {boolean} [options.xattr]
 * @param {boolean} [options.xattrMacro]
 * @returns {MutateInBuilder}
 *
 * @since 2.1.4
 * @committed
 */
MutateInBuilder.prototype.counter = function(path, delta, options) {
  return this._addOp(binding.Constants.SDCMD_COUNTER,
      path, _parseSdOpts(options), delta);
};

/**
 * Executes this set of mutation operations on the bucket.
 *
 * @param callback
 *
 * @since 2.1.4
 * @committed
 */
MutateInBuilder.prototype.execute = function(callback) {
  return this.bucket._mutateIn(this, callback);
};

/**
 * Creates a sub-document mutation operation builder.
 *
 * @param {string} key
 * @param {Object} [options]
 *
 * @returns {MutateInBuilder}
 *
 * @since 2.1.4
 * @committed
 */
Bucket.prototype.mutateIn = function(key, options) {
  if (!options) {
    options = {};
  }

  if (!this._isValidKey(key)) {
    throw new TypeError('First argument needs to be a string or buffer.');
  }
  if (typeof options !== 'object') {
    throw new TypeError('Second argument needs to be an object if set.');
  }
  this._checkHashkeyOption(options);
  this._checkExpiryOption(options);
  this._checkCasOption(options);

  var flags = 0;
  if (options.upsert) {
    flags |= binding.Constants.CMDSUBDOC_F_UPSERT_DOC;
  }
  if (options.insert) {
    flags |= binding.Constants.CMDSUBDOC_F_INSERT_DOC;
  }

  return new MutateInBuilder(this,
      [key, options.hashkey, options.expiry, options.cas, flags]);
};

Bucket.prototype._mutateIn = function(builder, callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('Execute argument needs to be a callback.');
  }

  var data = builder.data.concat([function(err, res) {
    callback(err, new DocumentFragment(res, builder.opPaths));
  }]);
  this._maybeInvoke(this._cb.mutateIn, data);
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
 * Gets or sets the n1ql timeout in milliseconds. The n1ql timeout is the
 * time that Bucket will wait for a response from the server for a n1ql request.
 * If the response is not received within this time frame, the request fails
 * with an error.
 *
 * @member {number} Bucket#n1qlTimeout
 *
 * @since 2.1.5
 * @committed
 */
Object.defineProperty(Bucket.prototype, 'n1qlTimeout', {
  get: function() {
    return this._ctl(CONST.CNTL_N1QL_TIMEOUT);
  },
  set: function(val) {
    this._ctl(CONST.CNTL_N1QL_TIMEOUT, val);
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
