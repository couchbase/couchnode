'use strict';

/**
 * @constructor
 * @private
 * @ignore
 */
function SearchSortBase() {
  this.data = {};
}

SearchSortBase.prototype.toJSON = function() {
  return this.data;
};

var SearchSort = {};
module.exports = SearchSort;

/**
 * @constructor
 *
 * @private
 * @memberof SearchSort
 */
function ScoreSort() {
  this.data = {
    by: 'score'
  };
}
SearchSort.ScoreSort = ScoreSort;

/**
 * score creates a score based sorting for search results.
 *
 * @returns {SearchSort.ScoreSort}
 */
SearchSort.score = function() {
  return new ScoreSort();
};

/**
 * Specifies whether to sort descending or not
 *
 * @param {boolean} descending
 * @returns {SearchSort.ScoreSort}
 */
ScoreSort.prototype.descending = function(descending) {
  this.data.descending = descending;
  return this;
};

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {string}
 *
 * @private
 */
ScoreSort.prototype.toJSON = SearchSortBase.prototype.toJSON;

/**
 * @constructor
 *
 * @private
 * @memberof SearchSort
 */
function IdSort() {
  this.data = {
    by: 'id'
  };
}
SearchSort.IdSort = IdSort;

/**
 * id creates a id based sorting for search results.
 *
 * @returns {SearchSort.IdSort}
 */
SearchSort.id = function() {
  return new IdSort();
};

/**
 * Specifies whether to sort descending or not
 *
 * @param {boolean} descending
 * @returns {SearchSort.IdSort}
 */
IdSort.prototype.descending = function(descending) {
  this.data.descending = descending;
  return this;
};

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {string}
 *
 * @private
 */
IdSort.prototype.toJSON = SearchSortBase.prototype.toJSON;

/**
 * @constructor
 *
 * @private
 * @memberof SearchSort
 */
function FieldSort(field) {
  this.data = {
    by: 'field',
    field: field
  };
}
SearchSort.FieldSort = FieldSort;

/**
 * field creates a field based sorting for search results.
 *
 * @param {string} field
 * @returns {SearchSort.FieldSort}
 */
SearchSort.field = function(field) {
  return new FieldSort(field);
};

/**
 * Specifies the type for the field sort.
 *
 * @param {string} descending
 * @returns {SearchSort.FieldSort}
 */
FieldSort.prototype.type = function(type) {
  this.data.type = type;
  return this;
};

/**
 * Specifies the mode for the field sort.
 *
 * @param {string} mode
 * @returns {SearchSort.FieldSort}
 */
FieldSort.prototype.mode = function(mode) {
  this.data.mode = mode;
  return this;
};

/**
 * Specifies the missing behaviour for the field sort.
 *
 * @param {string} missing
 * @returns {SearchSort.FieldSort}
 */
FieldSort.prototype.missing = function(missing) {
  this.data.missing = missing;
  return this;
};

/**
 * Specifies whether to sort descending or not
 *
 * @param {boolean} descending
 * @returns {SearchSort.FieldSort}
 */
FieldSort.prototype.descending = function(descending) {
  this.data.descending = descending;
  return this;
};

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {string}
 *
 * @private
 */
FieldSort.prototype.toJSON = SearchSortBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchSort
 */
function GeoDistanceSort(field, lat, lon) {
  this.data = {
    by: 'geo_distance',
    field: field,
    location: [lon, lat]
  };
}
SearchSort.GeoDistanceSort = GeoDistanceSort;

/**
 * id creates a id based sorting for search results.
 *
 * @param {string} field
 * @param {number} lat latitude
 * @param {number} lon longitude
 * @returns {SearchSort.GeoDistanceSort}
 */
SearchSort.geoDistance = function(field, lat, lon) {
  return new GeoDistanceSort(field, lat, lon);
};

/**
 * Specifies the unit to calculate distances in
 *
 * @param {string} unit
 * @returns {SearchSort.GeoDistanceSort}
 */
GeoDistanceSort.prototype.unit = function(unit) {
  this.data.unit = unit;
  return this;
};

/**
 * Specifies whether to sort descending or not
 *
 * @param {boolean} descending
 * @returns {SearchSort.GeoDistanceSort}
 */
GeoDistanceSort.prototype.descending = function(descending) {
  this.data.descending = descending;
  return this;
};

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {string}
 *
 * @private
 */
GeoDistanceSort.prototype.toJSON = SearchSortBase.prototype.toJSON;
