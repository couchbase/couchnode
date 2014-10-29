'use strict';

var util = require('util');

/**
 * Class for dynamically construction of spatial queries.  This class should
 * never be constructed directly, instead you should use
 * {@link SpatialQuery.from} to construct this object.
 *
 * @constructor
 *
 * @since 2.0.1
 * @committed
 *
 * @private
 */
function SpatialQuery() {
  this.ddoc = null;
  this.name = null;
  this.options = {};
}

/**
 * Enumeration for specifying view update semantics.
 *
 * @readonly
 * @enum {number}
 */
SpatialQuery.Update = {
  /**
   * Causes the view to be fully indexed before results are retrieved.
   */
  BEFORE: 1,

  /**
   * Allows the index to stay in whatever state it is already in prior
   * retrieval of the query results.
   */
  NONE: 2,

  /**
   * Forces the view to be indexed after the results of this query has
   * been fetched.
   */
  AFTER: 3
};

/**
 * Specifies the design document and view name to use for this query.
 *
 * @param {string} ddoc The design document to use.
 * @param {string} name The view to use.
 * @returns {SpatialQuery}
 *
 * @since 2.0.0
 * @committed
 */
SpatialQuery.prototype.from = function(ddoc, name) {
  this.ddoc = ddoc;
  this.name = name;
  return this;
};

/**
 * Specifies how this query will affect view indexing, both before and
 * after the query is executed.
 *
 * @param {SpatialQuery.Update} stale How to update the index.
 * @default SpatialQuery.Update.NONE
 * @returns {SpatialQuery}
 *
 * @since 2.0.0
 * @committed
 */
SpatialQuery.prototype.stale = function(stale) {
  if (stale === SpatialQuery.Update.BEFORE) {
    this.options.stale = 'false';
  } else if (stale === SpatialQuery.Update.NONE) {
    this.options.stale = 'ok';
  } else if (stale === SpatialQuery.Update.AFTER) {
    this.options.stale = 'update_after';
  } else {
    throw new TypeError('invalid option passed.');
  }
  return this;
};

/**
 * Specifies how many results to skip from the beginning of the result set.
 *
 * @param {number} skip
 * @returns {SpatialQuery}
 *
 * @since 2.0.0
 * @committed
 */
SpatialQuery.prototype.skip = function(skip) {
  this.options.skip = skip;
  return this;
};

/**
 * Specifies the maximum number of results to return.
 *
 * @param {number} limit
 * @returns {SpatialQuery}
 *
 * @since 2.0.0
 * @committed
 */
SpatialQuery.prototype.limit = function(limit) {
  this.options.limit = limit;
  return this;
};

/**
 * Specifies a bounding box to query the index for.  This value must be an
 * array of exactly 4 numbers which represents the left, top, right and
 * bottom edges of the bounding box (in that order).
 *
 * @param {Array.<number>} bbox
 * @returns {SpatialQuery}
 *
 * @since 2.0.0
 * @committed
 */
SpatialQuery.prototype.bbox = function(bbox) {
  this.options.bbox = bbox.join(',');
  return this;
};

/**
 * Allows you to specify custom view options that may not be available
 * though the fluent interface defined by this class.
 *
 * @param {Object} opts
 * @returns {SpatialQuery}
 *
 * @since 2.0.0
 * @committed
 */
SpatialQuery.prototype.custom = function(opts) {
  for (var i in opts) {
    /* istanbul ignore else */
    if (opts.hasOwnProperty(i)) {
      this.options[i] = opts[i];
    }
  }
  return this;
};

/**
 * Instantiates a {@link SpatialQuery} object for the specified design
 * document and view name.
 *
 * @param {string} ddoc The design document to use.
 * @param {string} name The view to use.
 * @returns {SpatialQuery}
 *
 * @since 2.0.0
 * @committed
 */
SpatialQuery.from = function(ddoc, name) {
  return (new SpatialQuery()).from(ddoc, name);
};

module.exports = SpatialQuery;
