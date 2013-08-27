var qs = require("querystring");
var httpUtil = require('./http');

var DEFAULT_LIMIT = 10;
var MAX_PAGES = 10;
var CONST;

module.exports._init = function(c) {
  CONST = c;
}

/**
 * Query constructor.
 * @private
 *
 * @param {object} connection object.
 * @param {string} name of design-document containing the view.
 * @param {string} view name on which to apply this query.
 * @param {object} key,value pairs supplying the initial set of query
 *    parameters to be used for subsequent queries. This can be
 *    overriden while calling clone() and query() on this instance.
 */
function Query(cb, ddoc, name, params, makeRestHandler) {
  this._cb = cb;
  this.ddoc = ddoc;
  this.name = name;
  this.q = normalizeQuery( params == undefined ? {} : params );
  this.makeRestHandler = makeRestHandler;
}

/**
 * Query for result set.
 *
 * @param {object} key,value pairs supplying additional set of query
 *    parameters to be used for this queries.
 * @param {Callback} 
 *    the callback to be invoked when complete.
 *    callback signature,
 *    function callback(err, results) {
 *      // ....
 *    }
 */
Query.prototype.query = function(q, callback) {
  if (typeof q == "function") {
    callback = q;
    q = {}
  }
  var q = extend( extend({}, this.q), normalizeQuery(q) );
  this._request( q, callback );
  return this
}

/**
 * Clone this query instance, with a new set of initial parameters overriding
 * current set.
 *
 * @param {object} key,value pairs supplying a new set of query
 *    parameters, to be used for subsequent queries.
 */
Query.prototype.clone = function( cparams ) {
  var newq = new Query( this._cb, this.ddoc, this.name, {} );
  newq.q = extend( extend({}, this.q), normalizeQuery(cparams) );
  newq.makeRestHandler = this.makeRestHandler;
  return newq;
}

/**
 * Get the first page of query's result set, along with a paginator instance.
 * subsequently paginator.next(), and paginator.prev() can be used to navigate
 * within result set.
 *
 * Maximum number of entries in each page is determined by query's `limit`
 * parameter or `DEFAULT_LIMIT`.
 *
 * @param {object} key,value pairs supplying additional set of query
 *    parameters to be used for this query.
 * @param {Callback} 
 *    the callback to be invoked when complete.
 *    callback signature,
 *    
 *    function callback(err, results, pageinator) {
 *      // ...
 *      paginator.next(nextcallback);
 *      paginator.prev(prevcallback);
 *      // ...
 *    }
 */
Query.prototype.firstPage = function(q, callback) {
  var p = new Paginator(this, this._cb);
  if (typeof q == "function") {
    callback = q;
    q = {}
  }
  var q = extend( extend({}, this.q), normalizeQuery(q) );
  if (q.limit == undefined) {
    this.q.limit = q.limit = DEFAULT_LIMIT;
  }
  q.limit += 1;

  function startPage(err, results) {
    if (results) {
      if (results.length > 0) {
        p._prevkey = results[0].key;
        p._prevkey_docid = results[0].id;
      }
      if (results.length >= q.limit) {
        var x = results.pop();
        p._nextkey = x.key;
        p._nextkey_docid = x.id;
      } else {
        p._nextkey = null;
        p._nextkey_docid = null;
      }
    }
    callback.call(this._cb, err, results, p);
  }

  this._request(q, startPage);
}

/**
 * HTTP query request.
 * @private
 */
Query.prototype._request = function(q, callback) {
  this._cb.httpRequest(null, {
    path: "_design/" + this.ddoc + "/_view/" + this.name + "?" 
          + qs.stringify(q),
    lcb_http_type: CONST.LCB_HTTP_TYPE_VIEW,
    method: CONST.LCB_HTTP_METHOD_GET
  }, this.makeRestHandler(callback));
}

/**
 * Paginator constructor.
 * @private
 *
 * @param {object} instance of Query().
 * @param {object} connection object.
 */
function Paginator(qobj, cb) {
  this._prevkey = null;
  this._nextkey = null;
  this._prevkey_docid = null;
  this._nextkey_docid = null;
  this._prevpages = [];
  this._qobj = qobj
  this._cb = cb;
}

/**
 * local callback, that will adjust startkey_docid and endkey_docid before
 * supplying the results to the application callback.
 * @private
 */
Paginator.prototype._paginate = function(err, results, callback) {
  if (results) {
    if (results.length > 0) {
      if (this._prevkey != null && this._prevkey_docid != null ) {
        this._prevpages.push([this._prevkey, this._prevkey_docid]);
      }
      this._prevkey = results[0].key;
      this._prevkey_docid = results[0].id;
    }
    if (results.length > this._qobj.q.limit) {
      var x = results.pop();
      this._nextkey = x.key;
      this._nextkey_docid = x.id;
    } else {
      this._nextkey = null;
      this._nextkey_docid = null;
    }
  }
  callback.call( this._cb, err, results == null ? [] : results );
}

/**
 * Check whether a next page for result set is available. Returns a boolean.
 */
Paginator.prototype.isNext = function() {
    return this._nextkey != null;
}

/**
 * to get next set of results.
 *
 * @param {Callback}
 *    callback to call when complete.
 *    callback signature,
 *    function callback(err, results) {
 *        // ....
 *    }
 */
Paginator.prototype.next = function(callback) {
  if (this._nextkey && this._nextkey_docid) {
    var q = extend(
      extend({}, this._qobj.q),
      {startkey: this._nextkey, startkey_docid: this._nextkey_docid}
    );
    var p = this;
    var paginate_ = function(err, results) {
      p._paginate.call(p, err, results, callback)
    }
    q.limit += 1;
    this._qobj._request(q, paginate_);

  } else {
    this._paginate.call(this, null, [], callback);
  }
  return this;
}

/**
 * to get previous set of results.
 *
 * @param {Callback}
 *    callback to call when complete.
 *    callback signature,
 *    function callback(err, results) {
 *        // ....
 *    }
 */
Paginator.prototype.prev = function(callback) {
  if( this._prevpages.length == 0 ) {
    this._paginate.call(this, null, null, callback);
  } else {
    var nk = this._prevpages.pop();
    var p = this;
    var paginate_ = function(err, results) {
      p._prevkey = null;
      p._prevkey_docid = null;
      p._paginate.call(p, err, results, callback)
    }
    var q = extend(
      extend({}, this._qobj.q), { startkey: nk[0], startkey_docid: nk[1] }
    );
    q.limit += 1;
    this._qobj._request(q, paginate_)
  }
  return this;
}

function extend(dest, src) {
  for (var k in src) {
    if (src.hasOwnProperty(k)) {
      dest[k] = src[k];
    }
  }
  return dest; 
}

var ViewFields = ["descending", "endkey", "endkey_docid",
                  "full_set", "group", "group_level", "inclusive_end",
                  "include_docs",
                  "key", "keys", "limit", "on_error", "reduce", "skip",
                  "stale", "startkey", "startkey_docid"];
var JsonFields = ["endkey", "key", "keys", "startkey"];

function normalizeQuery(query) {
  for (var q in query) {
    if (ViewFields.indexOf(q) == -1) {
      delete query[q];
    } else if (JsonFields.indexOf(q) != -1) {
      query[q] = JSON.stringify(query[q]);
    }
  }
  return query
}


module.exports.Query = Query;
