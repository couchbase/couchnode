'use strict';

var util = require('util');
var qs = require('querystring');

/**
 * Class for dynamically construction of N1QL queries.  This class should never
 * be constructed directly, instead you should use the
 * {@link N1qlQuery.fromString} static method to instantiate a
 * {@link N1qlStringQuery}.
 *
 * @constructor
 *
 * @since 2.0.0
 * @committed
 */
function N1qlQuery() {}

/**
 * Enumeration for specifying N1QL consistency semantics.
 *
 * @readonly
 * @enum {number}
 */
N1qlQuery.Consistency = {
  /**
   * This is the default (for single-statement requests).
   */
  NOT_BOUNDED: 1,

  /**
   * This implements strong consistency per request.
   */
  REQUEST_PLUS: 2,

  /**
   * This implements strong consistency per statement.
   */
  STATEMENT_PLUS: 3
};

/**
 * Enum representing the different query profiling modes.
 *
 * @readonly
 * @enum {string}
 *
 * @since 2.4.6
 * @committed
 */
N1qlQuery.ProfileType = {
  /**
   * Disables profiling. This is the default
   */
  PROFILE_NONE: 'off',

  /**
   * This enables phase profiling.
   */
  PROFILE_PHASES: 'phases',

  /**
   * This enables general timing profiling.
   */
  PROFILE_TIMINGS: 'timings'
};

/**
 * Returns the fully prepared string representation of this query.
 */
N1qlQuery.prototype.toString = function() {
  throw new Error('Must use N1qlQuery subclasses only.');
};

module.exports = N1qlQuery;

/**
 * Class for holding a explicitly defined N1QL query string.
 *
 * @constructor
 * @extends N1qlQuery
 *
 * @since 2.0.0
 * @committed
 */
function N1qlStringQuery(str) {
  this.options = {
    statement: str
  };
  this.isAdhoc = true;
}
util.inherits(N1qlStringQuery, N1qlQuery);
N1qlQuery.Direct = N1qlStringQuery;

/**
 * Specify the consistency level for this query.
 *
 * @param {N1qlQuery.Consistency} val
 * @returns {N1qlStringQuery}
 *
 * @since 2.0.10
 * @committed
 */
N1qlStringQuery.prototype.consistency = function(val) {
  if (this.options.scan_vectors !== undefined) {
    throw new Error('consistency and consistentWith must be use exclusively.');
  }

  if (val === N1qlQuery.Consistency.NOT_BOUNDED) {
    this.options.scan_consistency = 'not_bounded';
  } else if (val === N1qlQuery.Consistency.REQUEST_PLUS) {
    this.options.scan_consistency = 'request_plus';
  } else if (val === N1qlQuery.Consistency.STATEMENT_PLUS) {
    this.options.scan_consistency = 'statement_plus';
  } else {
    throw new TypeError('invalid option passed.');
  }
  return this;
};

/**
 * Specifies a MutationState object to ensure this query is
 * consistent with.
 *
 * @param state
 *
 * @since 2.1.7
 * @committed
 */
N1qlStringQuery.prototype.consistentWith = function(state) {
  if (this.options.scan_consistency !== undefined) {
    throw new Error('consistency and consistentWith must be use exclusively.');
  }

  this.options.scan_consistency = 'at_plus';
  this.options.scan_vectors = state;
};

/**
 * Specifies whether this query is adhoc or should
 * be prepared.
 *
 * @param {boolean} adhoc
 * @returns {N1qlStringQuery}
 *
 * @since 2.1.0
 * @committed
 */
N1qlStringQuery.prototype.adhoc = function(adhoc) {
  this.isAdhoc = !!adhoc;
  return this;
};

/**
 * Specifies enable/disable formatting a query result
 *
 * @param {boolean} pretty
 * @returns {N1qlStringQuery}
 *
 * @since 2.3.1
 * @committed
 */
N1qlStringQuery.prototype.pretty = function(pretty) {
  this.options.pretty = !!pretty;
  return this;
};

/**
 * Maximum buffered channel size between the indexer client and the query
 * service for index scans. This parameter controls when to use scan backfill.
 * Use 0 or a negative number to disable.
 *
 * @param {number} scanCap
 * @returns {N1qlStringQuery}
 *
 * @since 2.3.8
 * @committed
 */
N1qlStringQuery.prototype.scanCap = function(scanCap) {
  this.options.scan_cap = scanCap.toString();
  return this;
};

/**
 * Controls the number of items execution operators can batch for Fetch
 * from the KV node.
 *
 * @param {number} pipelineBatch
 * @returns {N1qlStringQuery}
 *
 * @since 2.3.8
 * @committed
 */
N1qlStringQuery.prototype.pipelineBatch = function(pipelineBatch) {
  this.options.pipeline_batch = pipelineBatch.toString();
  return this;
};

/**
 * Maximum number of items each execution operator can buffer between
 * various operators.
 *
 * @param {number} pipelineCap
 * @returns {N1qlStringQuery}
 *
 * @since 2.3.8
 * @committed
 */
N1qlStringQuery.prototype.pipelineCap = function(pipelineCap) {
  this.options.pipeline_cap = pipelineCap.toString();
  return this;
};

/**
 * Controls whether a query can change a resulting recordset.  If readonly is
 * true, then only SELECT statements are permitted.
 *
 * @param {boolean} readonly
 * @returns {N1qlStringQuery}
 *
 * @since 2.3.8
 * @committed
 */
N1qlStringQuery.prototype.readonly = function(readonly) {
  this.options.readonly = !!readonly;
  return this;
};

/**
 * Controls the profiling mode used during query execution.
 *
 * @param {N1qlQuery.ProfileType} profileType
 * @returns {N1qlStringQuery}
 *
 * @since 2.4.6
 * @committed
 */
N1qlStringQuery.prototype.profile = function(profileType) {
  this.options.profile = profileType;
  return this;
};

/**
 * Specifies a raw parameter to pass to the query engine.
 *
 * @param {string} name
 * @param {Object} value
 * @returns {N1qlStringQuery}
 *
 * @since 2.6.0
 * @committed
 */
N1qlStringQuery.prototype.rawParam = function(name, value) {
  this.options[name] = value;
  return this;
};

/**
 * Returns the fully prepared string representation of this query.
 */
N1qlStringQuery.prototype.toString = function(args) {
  return qs.stringify(this.toObject(args));
};

/**
 * Returns the fully prepared object representation of this query.
 */
N1qlStringQuery.prototype.toObject = function(args) {
  if (!args) {
    return this.options;
  }

  var out = {};
  for (var i in this.options) {
    if (this.options.hasOwnProperty(i)) {
      out[i] = this.options[i];
    }
  }

  if (Array.isArray(args)) {
    out.args = args;
  } else {
    for (var j in args) {
      if (args.hasOwnProperty(j)) {
        out['$' + j] = args[j];
      }
    }
  }

  return out;
};

/**
 * Creates a query object directly from the passed query string.
 *
 * @param {string} str The N1QL query string.
 * @returns {N1qlStringQuery}
 *
 * @since 2.0.0
 * @committed
 */
N1qlQuery.fromString = function(str) {
  return new N1qlStringQuery(str);
};
