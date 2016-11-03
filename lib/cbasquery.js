'use strict';

var util = require('util');
var qs = require('querystring');

/**
 * Class for dynamically construction of CBAS queries.  This class should never
 * be constructed directly, instead you should use the
 * {@link CbasQuery.fromString} static method to instantiate a
 * {@link CbasStringQuery}.
 *
 * @constructor
 *
 * @since 2.2.4
 * @uncommitted
 */
function CbasQuery() {
}

/**
 * Returns the fully prepared string representation of this query.
 *
 * @since 2.2.4
 * @uncommitted
 */
CbasQuery.prototype.toString = function() {
  throw new Error('Must use CbasQuery subclasses only.');
};

module.exports = CbasQuery;

/**
 * Class for holding a explicitly defined CBAS query string.
 *
 * @constructor
 * @extends CbasQuery
 *
 * @since 2.2.4
 * @uncommitted
 */
function CbasStringQuery(str) {
  this.options = {
    statement: str
  };
}
util.inherits(CbasStringQuery, CbasQuery);
CbasQuery.Direct = CbasStringQuery;

/**
 * Returns the fully prepared string representation of this query.
 *
 * @since 2.2.4
 * @uncommitted
 */
CbasStringQuery.prototype.toString = function(args) {
  return qs.stringify(this.toObject(args));
};


/**
 * Returns the fully prepared object representation of this query.
 *
 * @since 2.2.4
 * @uncommitted
 */
CbasStringQuery.prototype.toObject = function(args) {
  if (args) {
    throw new Error('CBAS queries do not yet support parameterization');
  }

  return this.options;
};


/**
 * Creates a query object directly from the passed query string.
 *
 * @param {string} str The N1QL query string.
 * @returns {CbasStringQuery}
 *
 * @since 2.2.4
 * @uncommitted
 */
CbasQuery.fromString = function(str) {
  return new CbasStringQuery(str);
};
