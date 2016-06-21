'use strict';

var util = require('util');
var cbutils = require('./utils');
var queryProtos = require('./searchquery_queries');

/**
 * Class for building of FTS search queries.  This class should never
 * be constructed directly, instead you should use the {@link SearchQuery.new}
 * static method to instantiate a {@link SearchQuery}.
 *
 * @constructor
 *
 * @since 2.1.7
 * @committed
 */
function SearchQuery(indexName, query) {
  this.data = {
    indexName: indexName,
    query: query
  };
}

/**
 * Enumeration for specifying FTS highlight styling.
 *
 * @readonly
 * @enum {number}
 */
SearchQuery.HighlightStyle = {
  /**
   * This causes hits to be highlighted using HTML tags.
   */
  HTML: 'html',

  /**
   * This causes hits to be highlighted with ANSI character codes.
   */
  ANSI: 'ansi'
};

/**
 * Specifies how many results to skip from the beginning of the result set.
 *
 * @param {number} skip
 * @returns {SearchQuery}
 *
 * @since 2.1.7
 * @committed
 */
SearchQuery.prototype.skip = function(skip) {
  this.data.from = skip;
  return this;
};

/**
 * Specifies the maximum number of results to return.
 *
 * @param {number} limit
 * @returns {SearchQuery}
 *
 * @since 2.1.7
 * @committed
 */
SearchQuery.prototype.limit = function(limit) {
  this.data.size = limit;
  return this;
};

/**
 * Includes information about the internal search semantics used
 * to execute your query.
 *
 * @param {boolean} explain
 * @returns {SearchQuery}
 *
 * @since 2.1.7
 * @committed
 */
SearchQuery.prototype.explain = function(explain) {
  this.data.explain = explain;
  return this;
};

/**
 * Requests a particular highlight style and field list for this query.
 *
 * @param {SearchQuery.HighlightStyle} style
 * @param {string[]} fields
 * @returns {SearchQuery}
 *
 * @since 2.1.7
 * @committed
 */
SearchQuery.prototype.highlight = function(style, fields) {
  fields = cbutils.unpackArgs(fields, arguments, 1);

  if (!this.data.highlight) {
    this.data.highlight = {};
  }

  this.data.highlight.style = style;
  this.data.highlight.fields = fields;
  return this;
};

/**
 * Specifies the fields you wish to receive in the result set.
 *
 * @param {string[]} fields
 * @returns {SearchQuery}
 *
 * @since 2.1.7
 * @committed
 */
SearchQuery.prototype.fields = function(fields) {
  fields = cbutils.unpackArgs(fields, arguments);

  this.data.fields = fields;
  return this;
};

/**
 * Adds a SearchFacet object to return information about as part
 * of the execution of this query.
 *
 * @param {string} name
 * @param {SeachFacet} facet
 * @returns {SearchQuery}
 *
 * @since 2.1.7
 * @committed
 */
SearchQuery.prototype.addFacet = function(name, facet) {
  if (!this.data.facets) {
    this.data.facets = {};
  }
  this.data.facets[name] = facet;
  return this;
};

/**
 * Specifies the maximum time to wait (in millseconds) for this
 * query to complete.
 *
 * @param {number} timeout
 * @returns {SearchQuery}
 *
 * @since 2.1.7
 * @committed
 */
SearchQuery.prototype.timeout = function(timeout) {
  if (!this.data.ctl) {
    this.data.ctl = {};
  }

  this.data.ctl.timeout = timeout;
  return this;
};

SearchQuery.prototype.toJSON = function() {
  return this.data;
};

/**
 * Creates a new search query from an index name and search query definition.
 *
 * @param {string} indexName
 * @param {SearchQuery.Query} query
 * @returns {SearchQuery}
 *
 * @since 2.1.7
 * @committed
 */
SearchQuery.new = function(indexName, query) {
  return new SearchQuery(indexName, query);
};

for (var i in queryProtos) {
  if (queryProtos.hasOwnProperty(i)) {
    SearchQuery[i] = queryProtos[i];
  }
}

module.exports = SearchQuery;
