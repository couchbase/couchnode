'use strict';

var DEFAULT_LIMIT = 10;

function extend(dest, src) {
  for (var k in src) {
    if (src.hasOwnProperty(k)) {
      dest[k] = src[k];
    }
  }
  return dest;
}

var ViewFields = ['descending', 'endkey', 'endkey_docid',
  'full_set', 'group', 'group_level', 'inclusive_end',
  'include_docs',
  'key', 'keys', 'limit', 'on_error', 'reduce', 'skip',
  'stale', 'startkey', 'startkey_docid'];
var JsonFields = ['endkey', 'key', 'keys', 'startkey'];

function normalizeQuery(query) {
  var queryOut = {};
  for (var q in query) {
    if (query.hasOwnProperty(q)) {
      if (JsonFields.indexOf(q) >= 0) {
        queryOut[q] = JSON.stringify(query[q]);
      } else if (ViewFields.indexOf(q) >= 0) {
        queryOut[q] = query[q];
      }
    }
  }
  return queryOut;
}

/**
 * @class Paginator
 * @classdesc
 * A class used to handle pagination of view result sets.  This class is
 * instantiated by using the {@link ViewQuery#firstPage} method.
 *
 * @private
 */

/**
 * @constructor
 *
 * @param {object} qobj
 * The ViewQuery instance this paginator should operate on.
 * @param {object} cb
 * The Couchbase object to use to execute operations.
 *
 * @private
 * @ignore
 */
function Paginator(qobj, cb) {
  this._prevkey = null;
  this._nextkey = null;
  this._prevkey_docid = null;
  this._nextkey_docid = null;
  this._prevpages = [];
  this._qobj = qobj;
  this._cb = cb;
}

/**
 * local callback, that will adjust startkey_docid and endkey_docid before
 * supplying the results to the application callback.
 *
 * @private
 * @ignore
 */
Paginator.prototype._paginate = function(err, results, callback) {
  if (results) {
    if (results.length > 0) {
      if (this._prevkey !== null && this._prevkey_docid !== null ) {
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
  callback.call( this._cb, err, results === null ? [] : results );
};

/**
 * Check whether a next page for result set is available.
 *
 * @returns {boolean} Whether another page is available
 */
Paginator.prototype.hasNext = function() {
  return this._nextkey !== null;
};

/**
 * Retrieves the next set of results.
 *
 * @param {QueryCallback} callback
 * The callback to invoke once the page of results is available.
 */
Paginator.prototype.next = function(callback) {
  if (this._nextkey && this._nextkey_docid) {
    var q = extend(extend({}, this._qobj.q),{
      startkey: JSON.stringify(this._nextkey),
      startkey_docid: JSON.stringify(this._nextkey_docid)
    });
    var p = this;
    var paginate_ = function(err, results) {
      p._paginate.call(p, err, results, callback);
    };
    q.limit += 1;
    this._qobj._request(q, paginate_);

  } else {
    this._paginate.call(this, null, [], callback);
  }
  return this;
};

/**
 * Retrieves the previous set of results.
 *
 * @param {QueryCallback} callback
 * The callback to invoke once the page of results is available.
 */
Paginator.prototype.prev = function(callback) {
  if( this._prevpages.length === 0 ) {
    this._paginate.call(this, null, null, callback);
  } else {
    var nk = this._prevpages.pop();
    var p = this;
    var paginate_ = function(err, results) {
      p._prevkey = null;
      p._prevkey_docid = null;
      p._paginate.call(p, err, results, callback);
    };
    var q = extend(extend({}, this._qobj.q), {
      startkey: JSON.stringify(nk[0]),
      startkey_docid: JSON.stringify(nk[1])
    });
    q.limit += 1;
    this._qobj._request(q, paginate_);
  }
  return this;
};

/**
 * @class ViewQuery
 * @classdesc
 * A class used to execute view queries.  This class is instantiated by using
 * the {@link Connection#view} method.
 *
 * @private
 */

/**
 * @constructor
 *
 * @param {object} cb connection object.
 * @param {string} ddoc name of design-document containing the view.
 * @param {string} name view name on which to apply this query.
 * @param {object} params key,value pairs supplying the initial set of query
 *    parameters to be used for subsequent queries. This can be
 *    overriden while calling clone() and query() on this instance.
 *
 * @private

 */
function ViewQuery(cb, ddoc, name, params) {
  this._cb = cb;
  this.ddoc = ddoc;
  this.name = name;
  this.q = normalizeQuery( params === undefined ? {} : params );
}

/**
 * Query callback.
 * This callback is invoked by the query operations.
 *
 * @typedef {function} QueryCallback
 *
 * @param {undefined|Error} error
 *  An error indicator. Note that this error
 *  value may be ignored, but its absence is indicative that the
 *  response in the <code>results</code> parameter is ok. If it
 *  is set, then the request failed.
 * @param {object} results
 *  The results returned from the server
 * @param {object} misc
 *  @param {integer} misc.total_rows
 *  The total number of rows available in the view.
 */

/**
 * FirstPage query callback.
 * This callback is invoked by the firstPage query operation.
 *
 * @typedef {function} FirstPageCallback
 *
 * @param {undefined|Error} error
 *  An error indicator. Note that this error
 *  value may be ignored, but its absence is indicative that the
 *  response in the <code>results</code> parameter is ok. If it
 *  is set, then the request failed.
 * @param {object} results
 *  The results returned from the server
 * @param {Paginator} paginator
 *   The paginator for paged iteration through the view
 */

/**
 * Query for result set.
 *
 * @param {object} q key,value pairs supplying additional set of query
 *    parameters to be used for this queries.
 * @param {QueryCallback} callback
 */
ViewQuery.prototype.query = function(q, callback) {
  if (typeof q === 'function') {
    callback = arguments[0];
    q = {};
  }
  var qe = extend( extend({}, this.q), normalizeQuery(q) );
  this._request(qe, callback);
  return this;
};

/**
 * Clone this query instance, with a new set of initial parameters overriding
 * current set.
 *
 * @private
 * @ignore
 *
 * @param {object} cparams key,value pairs supplying a new set of query
 *    parameters, to be used for subsequent queries.
 */
ViewQuery.prototype.clone = function( cparams ) {
  var newq = new ViewQuery( this._cb, this.ddoc, this.name, {} );
  newq.q = extend( extend({}, this.q), normalizeQuery(cparams) );
  return newq;
};

/**
 * Get the first page of query's result set, along with a paginator instance.
 * subsequently paginator.next(), and paginator.prev() can be used to navigate
 * within result set.
 *
 * Maximum number of entries in each page is determined by query's `limit`
 * parameter or `DEFAULT_LIMIT`.
 *
 * @param {object} q key,value pairs supplying additional set of query
 *    parameters to be used for this query.
 * @param {FirstPageCallback} callback
 */
ViewQuery.prototype.firstPage = function(q, callback) {
  var self = this;

  var p = new Paginator(this, this._cb);
  if (typeof q === 'function') {
    callback = arguments[0];
    q = {};
  }
  var qn = extend( extend({}, this.q), normalizeQuery(q) );
  if (qn.limit === undefined) {
    this.q.limit = qn.limit = DEFAULT_LIMIT;
  }
  qn.limit += 1;

  function startPage(err, results) {
    if (results) {
      if (results.length > 0) {
        p._prevkey = results[0].key;
        p._prevkey_docid = results[0].id;
      }
      if (results.length >= qn.limit) {
        var x = results.pop();
        p._nextkey = x.key;
        p._nextkey_docid = x.id;
      } else {
        p._nextkey = null;
        p._nextkey_docid = null;
      }
    }
    callback.call(self._cb, err, results, p);
  }

  this._request(qn, startPage);
};

/**
 * HTTP query request.
 *
 * @private
 * @ignore
 */
ViewQuery.prototype._request = function(q, callback) {
  this._cb._view(this.ddoc, this.name, q, callback);
};

module.exports = ViewQuery;
