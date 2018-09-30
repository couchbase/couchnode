'use strict';

var util = require('util');
var qs = require('querystring');

/**
 * Class for dynamically construction of Analytics queries.  This class should
 * never be constructed directly, instead you should use the
 * {@link AnalyticsQuery.fromString} static method to instantiate a
 * {@link AnalyticsStringQuery} instead.
 *
 * @constructor
 *
 * @since 2.6.0
 * @uncommitted
 */
function AnalyticsQuery() {}

/**
 * Returns the fully prepared string representation of this query.
 *
 * @since 2.6.0
 * @uncommitted
 */
AnalyticsQuery.prototype.toString = function() {
  throw new Error('Must use AnalyticsQuery subclasses only.');
};

module.exports = AnalyticsQuery;

/**
 * Class for holding a explicitly defined an analytics query string.
 *
 * @constructor
 * @extends AnalyticsQuery
 *
 * @since 2.6.0
 * @committed
 */
function AnalyticsStringQuery(str) {
  this.options = {
    statement: str
  };
}
util.inherits(AnalyticsStringQuery, AnalyticsQuery);
AnalyticsQuery.Direct = AnalyticsStringQuery;

/**
 * Specifies enable/disable formatting a query result
 *
 * @param {boolean} pretty
 * @returns {AnalyticsStringQuery}
 *
 * @since 2.6.0
 * @committed
 */
AnalyticsStringQuery.prototype.pretty = function(pretty) {
  this.options.pretty = !!pretty;
  return this;
};

/**
 * Specifies enable/disable of priority mode
 *
 * @param {boolean} priority
 * @returns {AnalyticsStringQuery}
 *
 * @since 2.6.0
 * @committed
 */
AnalyticsStringQuery.prototype.priority = function(priority) {
  this.options.priority = !!priority;
  return this;
};

/**
 * Specifies a raw parameter to pass to analytics
 *
 * @param {string} name
 * @param {Object} value
 * @returns {AnalyticsStringQuery}
 *
 * @since 2.6.0
 * @committed
 */
AnalyticsStringQuery.prototype.rawParam = function(name, value) {
  this.options[name] = value;
  return this;
};

/**
 * Returns the fully prepared string representation of this query.
 *
 * @since 2.6.0
 * @committed
 */
AnalyticsStringQuery.prototype.toString = function(args) {
  return qs.stringify(this.toObject(args));
};

/**
 * Returns the fully prepared object representation of this query.
 *
 * @since 2.6.0
 * @committed
 */
AnalyticsStringQuery.prototype.toObject = function(args) {
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
 * @param {string} str The analytics query string.
 * @returns {AnalyticsStringQuery}
 *
 * @since 2.6.0
 * @committed
 */
AnalyticsQuery.fromString = function(str) {
  return new AnalyticsStringQuery(str);
};
