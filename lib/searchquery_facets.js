'use strict';

/**
 * Represents a Couchbase FTS term facet.
 *
 * @constructor
 *
 * @private
 * @memberof SearchFacet
 */
function TermFacet(field, size) {
  this.field = field;
  this.size = size;
}
module.exports.TermFacet = TermFacet;

/**
 * term creates a Couchbase FTS term facet.
 *
 * @param {string} field
 * @param {number} size
 * @returns {TermFacet}
 */
module.exports.term = function(field, size) {
  return new TermFacet(field, size);
};

/**
 * Represents a Couchbase Search numeric facet.
 *
 * @constructor
 *
 * @private
 * @memberof SearchFacet
 */
function NumericFacet(field, size) {
  this.field = field;
  this.size = size;
  this.numeric_ranges = [];
}
module.exports.NumericFacet = NumericFacet;

/**
 * numeric creates a Couchbase Search numeric facet.
 *
 * @param {string} field
 * @param {number} size
 * @returns {NumericFacet}
 */
module.exports.numeric = function(field, size) {
  return new NumericFacet(field, size);
};

/**
 * Adds a numeric range to this numeric facet.
 *
 * @param {string} name
 * @param {number} min
 * @param {number} max
 * @returns {NumericFacet}
 */
NumericFacet.prototype.addRange = function(name, min, max) {
  this.numeric_ranges.push({
    name: name,
    min: min,
    max: max
  });
  return this;
};

/**
 * Represents a Couchbase Search date facet.
 *
 * @constructor
 *
 * @private
 * @memberof SearchFacet
 */
function DateFacet(field, size) {
  this.field = field;
  this.size = size;
  this.date_ranges = [];
}
module.exports.DateFacet = DateFacet;

/**
 * date creates a Couchbase Search date facet.
 *
 * @param {string} field
 * @param {number} size
 * @returns {DateFacet}
 */
module.exports.date = function(field, size) {
  return new DateFacet(field, size);
};

/**
 * Adds a date range to this numeric facet.
 *
 * @param {string} name
 * @param {string} start
 * @param {string} end
 * @returns {DateFacet}
 */
DateFacet.prototype.addRange = function(name, start, end) {
  this.date_ranges.push({
    name: name,
    start: start,
    end: end
  });
  return this;
};

