'use strict';

var cbutils = require('./utils');

/**
 * @constructor
 * @private
 * @ignore
 */
function QueryBase() {
  this.data = {};
}

QueryBase.prototype.field = function(field) {
  this.data.field = field;
  return this;
};

QueryBase.prototype.analyzer = function(analyzer) {
  this.data.analyzer = analyzer;
  return this;
};

QueryBase.prototype.prefixLength = function(prefixLength) {
  this.data.prefix_length = prefixLength;
  return this;
};

QueryBase.prototype.fuzziness = function(fuzziness) {
  this.data.fuzziness = fuzziness;
  return this;
};

QueryBase.prototype.boost = function(boost) {
  this.data.boost = boost;
  return this;
};

QueryBase.prototype.dateTimeParser = function(dateTimeParser) {
  this.data.datetime_parser = dateTimeParser;
  return this;
};

QueryBase.prototype.toJSON = function() {
  return this.data;
};

var SearchQuery = {};
module.exports = SearchQuery;

/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function MatchQuery(match) {
  this.data = {
    match: match
  };
}
SearchQuery.MatchQuery = MatchQuery;

/**
 * match creates a Query MatchQuery matching text.
 *
 * @param {string} match
 * @returns {SearchQuery.MatchQuery}
 */
SearchQuery.match = function(match) {
  return new MatchQuery(match);
};

/**
 * Specifies the field to query.
 *
 * @param {string} field
 * @returns {SearchQuery.MatchQuery}
 */
MatchQuery.prototype.field = QueryBase.prototype.field;

/**
 * Specifies the analyzer to use for the query.
 *
 * @param {string} analyzer
 * @returns {SearchQuery.MatchQuery}
 */
MatchQuery.prototype.analyzer = QueryBase.prototype.analyzer;

/**
 * Specifies the prefix length to consider for the query.
 *
 * @param {number} prefixLength
 * @returns {SearchQuery.MatchQuery}
 */
MatchQuery.prototype.prefixLength = QueryBase.prototype.prefixLength;

/**
 * fuzziness defines the level of fuzziness for the query.
 *
 * @param {number} fuzziness
 * @returns {SearchQuery.MatchQuery}
 */
MatchQuery.prototype.fuzziness = QueryBase.prototype.fuzziness;

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.MatchQuery}
 */
MatchQuery.prototype.boost = QueryBase.prototype.boost;

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {string}
 *
 * @private
 */
MatchQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function MatchPhraseQuery(phrase) {
  this.data = {
    match_phrase: phrase
  };
}
SearchQuery.MatchPhraseQuery = MatchPhraseQuery;

/**
 * matchPhase creates a new MatchPhraseQuery object for matching
 * phrases in the index.
 *
 * @param {string} phrase
 * @returns {SearchQuery.MatchPhraseQuery}
 */
SearchQuery.matchPhrase = function(phrase) {
  return new MatchPhraseQuery(phrase);
};


/**
 * Specifies the field to query.
 *
 * @param {string} field
 * @returns {SearchQuery.MatchPhraseQuery}
 */
MatchPhraseQuery.prototype.field = QueryBase.prototype.field;

/**
 * Specifies the analyzer to use for the query.
 *
 * @param {string} analyzer
 * @returns {SearchQuery.MatchPhraseQuery}
 */
MatchPhraseQuery.prototype.analyzer = QueryBase.prototype.analyzer;

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.MatchPhraseQuery}
 */
MatchPhraseQuery.prototype.boost = QueryBase.prototype.boost;

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {string}
 *
 * @private
 */
MatchPhraseQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function RegexpQuery(regexp) {
  this.data = {
    regexp: regexp
  };
}
SearchQuery.RegexpQuery = RegexpQuery;

/**
 * regexp creates a new RegexpQuery object for matching against a
 * regexp query in the index.
 *
 * @param {string} regexp
 * @returns {SearchQuery.RegexpQuery}
 */
SearchQuery.regexp = function(regexp) {
  return new RegexpQuery(regexp);
};

/**
 * Specifies the field to query.
 *
 * @param {string} field
 * @returns {SearchQuery.RegexpQuery}
 */
RegexpQuery.prototype.field = QueryBase.prototype.field;

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.RegexpQuery}
 */
RegexpQuery.prototype.boost = QueryBase.prototype.boost;

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {string}
 *
 * @private
 */
RegexpQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function QueryStringQuery(query) {
  this.data = {
    query: query
  };
}
SearchQuery.QueryStringQuery = QueryStringQuery;

/**
 * string creates a QueryStringQuery for matching strings.
 *
 * @param {string} query
 * @returns {SearchQuery.QueryStringQuery}
 */
SearchQuery.queryString = function(query) {
  return new QueryStringQuery(query);
};

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.QueryStringQuery}
 */
QueryStringQuery.prototype.boost = QueryBase.prototype.boost;

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {string}
 *
 * @private
 */
QueryStringQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function NumericRangeQuery() {
  this.data = {};
}
SearchQuery.NumericRangeQuery = NumericRangeQuery;

/**
 * numericRange creates a NumericRangeQuery for matching numeric
 * ranges in an index.
 *
 * @returns {SearchQuery.NumericRangeQuery}
 */
SearchQuery.numericRange = function() {
  return new NumericRangeQuery();
};

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.NumericRangeQuery}
 */
NumericRangeQuery.prototype.boost = QueryBase.prototype.boost;

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {string}
 *
 * @private
 */
NumericRangeQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function DateRangeQuery() {
  this.data = {};
}
SearchQuery.DateRangeQuery = DateRangeQuery;

/**
 * dateRange creates a DateRangeQuery for matching date ranges in an index.
 *
 * @returns {SearchQuery.DateRangeQuery}
 */
SearchQuery.dateRange = function() {
  return new DateRangeQuery();
};

/**
 * start defines the lower bound of this date range query.
 *
 * @param {string|Date} start
 * @param {boolean} inclusive
 * @returns {SearchQuery.DateRangeQuery}
 */
DateRangeQuery.prototype.start = function(start, inclusive) {
  if (inclusive === undefined) {
    inclusive = true;
  }

  if (start instanceof Date) {
    this.data.start = start.toISOString();
  } else {
    this.data.start = start;
  }
  this.data.inclusive_start = inclusive;
  return this;
};

/**
 * end defines the upper bound of this date range query.
 *
 * @param {string|Date} end
 * @param {boolean} inclusive
 * @returns {SearchQuery.DateRangeQuery}
 */
DateRangeQuery.prototype.end = function(end, inclusive) {
  if (inclusive === undefined) {
    inclusive = false;
  }

  if (end instanceof Date) {
    this.data.end = end.toISOString();
  } else {
    this.data.end = end;
  }
  this.data.inclusive_end = inclusive;
  return this;
};

/**
 * Specifies the field to query.
 *
 * @param {string} field
 * @returns {SearchQuery.DateRangeQuery}
 */
DateRangeQuery.prototype.field = QueryBase.prototype.field;

/**
 * dateTimeParser specifies the parser to use against dates in the query.
 *
 * @param {string} dateTimeParser
 * @returns {SearchQuery.DateRangeQuery}
 */
DateRangeQuery.prototype.dateTimeParser = QueryBase.prototype.dateTimeParser;

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.DateRangeQuery}
 */
DateRangeQuery.prototype.boost = QueryBase.prototype.boost;

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {string}
 *
 * @private
 */
DateRangeQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function ConjunctionQuery(queries) {
  queries = cbutils.unpackArgs(queries, arguments);
  this.data = {
    conjuncts: []
  };
  this.and(queries);
}
SearchQuery.ConjunctionQuery = ConjunctionQuery;

/**
 * conjuncts creates a ConjunctionQuery for matching all of a list of
 * subqueries in an index.
 *
 * @param {SearchQuery.Query[]} queries
 * @returns {SearchQuery.ConjunctionQuery}
 */
SearchQuery.conjuncts = function(queries) {
  queries = cbutils.unpackArgs(queries, arguments);
  return new ConjunctionQuery(queries);
};

/**
 * and specifies additional predicate queries.
 *
 * @param {SearchQuery.Query} queries
 * @returns {SearchQuery.ConjunctionQuery}
 */
ConjunctionQuery.prototype.and = function(queries) {
  queries = cbutils.unpackArgs(queries, arguments);
  for (var i = 0; i < queries.length; ++i) {
    this.data.conjuncts.push(queries[i]);
  }
  return this;
};

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.ConjunctionQuery}
 */
ConjunctionQuery.prototype.boost = QueryBase.prototype.boost;

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {string}
 *
 * @private
 */
ConjunctionQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function DisjunctionQuery(queries) {
  queries = cbutils.unpackArgs(queries);
  this.data = {
    disjuncts: []
  };
  this.or(queries);
}
SearchQuery.DisjunctionQuery = DisjunctionQuery;

/**
 * disjuncts creates a DisjunctionQuery for matching any of a list of
 * subqueries in an index.
 *
 * @param {SearchQuery.Query[]} queries
 * @returns {SearchQuery.DisjunctionQuery}
 */
SearchQuery.disjuncts = function(queries) {
  queries = cbutils.unpackArgs(queries, arguments);
  return new DisjunctionQuery(queries);
};

/**
 * or specifies additional predicate queries.
 *
 * @param {SearchQuery.Query} queries
 * @returns {SearchQuery.DisjunctionQuery}
 */
DisjunctionQuery.prototype.or = function(queries) {
  queries = cbutils.unpackArgs(queries, arguments);
  for (var i = 0; i < queries.length; ++i) {
    this.data.disjuncts.push(queries[i]);
  }
  return this;
};

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.DisjunctionQuery}
 */
DisjunctionQuery.prototype.boost = QueryBase.prototype.boost;

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {string}
 *
 * @private
 */
DisjunctionQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function BooleanQuery() {
  this.data = {};
  this.shouldMin = undefined;
}
SearchQuery.BooleanQuery = BooleanQuery;

/**
 * boolean creates a compound BooleanQuery composed of several
 * other Query objects.
 *
 * @returns {SearchQuery.BooleanQuery}
 */
SearchQuery.boolean = function() {
  return new BooleanQuery();
};

/**
 * must specifies a predicate query which much match.
 *
 * @param {SearchQuery.ConjunctionQuery|SearchQuery.Query} query
 * @returns {SearchQuery.BooleanQuery}
 */
BooleanQuery.prototype.must = function(query) {
  if (!(query instanceof ConjunctionQuery)) {
    query = new ConjunctionQuery([query]);
  }
  this.data.must = query;
  return this;
};

/**
 * should specifies a predicate query which should match.
 * @param {SearchQuery.DisjunctionQuery|SearchQuery.Query} query
 * @returns {SearchQuery.BooleanQuery}
 */
BooleanQuery.prototype.should = function(query) {
  if (!(query instanceof DisjunctionQuery)) {
    query = new DisjunctionQuery([query]);
  }
  this.data.should = query;
  return this;
};

/**
 * mustNot specifies a predicate query which must not match.
 *
 * @param {SearchQuery.DisjunctionQuery|SearchQuery.Query} query
 * @returns {SearchQuery.BooleanQuery}
 */
BooleanQuery.prototype.mustNot = function(query) {
  if (!(query instanceof DisjunctionQuery)) {
    query = new DisjunctionQuery([query]);
  }
  this.data.must_not = query;
  return this;
};

/**
 * shouldMin specifies the minimum score for should predicate matches.
 *
 * @param {number} shouldMin
 * @returns {SearchQuery.BooleanQuery}
 */
BooleanQuery.prototype.shouldMin = function(shouldMin) {
  this.shouldMin = shouldMin;
  return this;
};

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.BooleanQuery}
 */
BooleanQuery.prototype.boost = QueryBase.prototype.boost;


/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {Object}
 *
 * @private
 */
BooleanQuery.prototype.toJSON = function() {
  var out = {};
  if (this.data.must) {
    out.must = this.data.must;
  }
  if (this.data.should) {
    var shouldData = this.data.should.toJSON();
    shouldData.min = this.shouldMin;
    out.should = shouldData;
  }
  if (this.data.must_not) {
    out.must_not = this.data.must_not;
  }
  return out;
};


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function WildcardQuery(wildcard) {
  this.data = {
    wildcard: wildcard
  };
}
SearchQuery.WildcardQuery = WildcardQuery;

/**
 * wildcard creates a WildcardQuery which allows you to match a
 * string with wildcards in an index.
 *
 * @param {string} wildcard
 * @returns {SearchQuery.WildcardQuery}
 */
SearchQuery.wildcard = function(wildcard) {
  return new WildcardQuery(wildcard);
};

/**
 * Specifies the field to query.
 *
 * @param {string} field
 * @returns {SearchQuery.WildcardQuery}
 */
WildcardQuery.prototype.field = QueryBase.prototype.field;

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.WildcardQuery}
 */
WildcardQuery.prototype.boost = QueryBase.prototype.boost;

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {Object}
 *
 * @private
 */
WildcardQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function DocIdQuery(ids) {
  ids = cbutils.unpackArgs(ids, arguments);
  this.data = {
    ids: []
  };
  this.addDocIds(ids);
}
SearchQuery.DocIdQuery = DocIdQuery;

/**
 * docIds creates a DocIdQuery which allows you to match a list of
 * document ids in an index.
 *
 * @param {string[]} ids
 * @returns {SearchQuery.DocIdQuery}
 */
SearchQuery.docIds = function(ids) {
  ids = cbutils.unpackArgs(ids, arguments);
  return new DocIdQuery(ids);
};

DocIdQuery.prototype.addDocIds = function(ids) {
  ids = cbutils.unpackArgs(ids, arguments);
  for (var i = 0; i < ids.length; ++i) {
    this.data.ids.push(ids[i]);
  }
};

/**
 * Specifies the field to query.
 *
 * @param {string} field
 * @returns {SearchQuery.DocIdQuery}
 */
DocIdQuery.prototype.field = QueryBase.prototype.field;

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.DocIdQuery}
 */
DocIdQuery.prototype.boost = QueryBase.prototype.boost;

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {Object}
 *
 * @private
 */
DocIdQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function BooleanFieldQuery(val) {
  this.data = {
    bool: val
  };
}
SearchQuery.BooleanFieldQuery = BooleanFieldQuery;

/**
 * booleanField creates a BooleanFieldQuery for searching boolean fields
 * in an index.
 *
 * @param {boolean} val
 * @returns {SearchQuery.BooleanFieldQuery}
 */
SearchQuery.booleanField = function(val) {
  return new BooleanFieldQuery(val);
};

/**
 * Specifies the field to query.
 *
 * @param {string} field
 * @returns {SearchQuery.BooleanFieldQuery}
 */
BooleanFieldQuery.prototype.field = QueryBase.prototype.field;

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.BooleanFieldQuery}
 */
BooleanFieldQuery.prototype.boost = QueryBase.prototype.boost;

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {Object}
 *
 * @private
 */
BooleanFieldQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function TermQuery(term) {
  this.data = {
    term: term
  };
}
SearchQuery.TermQuery = TermQuery;

/**
 * term creates a TermQuery for searching terms in an index.
 *
 * @param {string} term
 * @returns {SearchQuery.TermQuery}
 */
SearchQuery.term = function(term) {
  return new TermQuery(term);
};

/**
 * Specifies the field to query.
 *
 * @param {string} field
 * @returns {SearchQuery.TermQuery}
 */
TermQuery.prototype.field = QueryBase.prototype.field;

/**
 * Specifies the prefix length to consider for the query.
 *
 * @param {number} prefixLength
 * @returns {SearchQuery.TermQuery}
 */
TermQuery.prototype.prefixLength = QueryBase.prototype.prefixLength;

/**
 * fuzziness defines the level of fuzziness for the query.
 *
 * @param {number} fuzziness
 * @returns {SearchQuery.TermQuery}
 */
TermQuery.prototype.fuzziness = QueryBase.prototype.fuzziness;

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.TermQuery}
 */
TermQuery.prototype.boost = QueryBase.prototype.boost;

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {Object}
 *
 * @private
 */
TermQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function PhraseQuery(terms) {
  this.data = {
    terms: terms
  };
}
SearchQuery.PhraseQuery = PhraseQuery;

/**
 * phrase creates a new PhraseQuery for searching a phrase in an index.
 *
 * @param {string[]} terms
 * @returns {SearchQuery.PhraseQuery}
 */
SearchQuery.phrase = function(terms) {
  return new PhraseQuery(terms);
};

/**
 * Specifies the field to query.
 *
 * @param {string} field
 * @returns {SearchQuery.PhraseQuery}
 */
PhraseQuery.prototype.field = QueryBase.prototype.field;

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.PhraseQuery}
 */
PhraseQuery.prototype.boost = QueryBase.prototype.boost;

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {Object}
 *
 * @private
 */
PhraseQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function PrefixQuery(prefix) {
  this.data = {
    prefix: prefix
  };
}
SearchQuery.PrefixQuery = PrefixQuery;

/**
 * prefix creates a new MatchQuery for searching for a prefix in an index.
 *
 * @param {string} prefix
 * @returns {SearchQuery.PrefixQuery}
 */
SearchQuery.prefix = function(prefix) {
  return new PrefixQuery(prefix);
};

/**
 * Specifies the field to query.
 *
 * @param {string} field
 * @returns {SearchQuery.PrefixQuery}
 */
PrefixQuery.prototype.field = QueryBase.prototype.field;

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.PrefixQuery}
 */
PrefixQuery.prototype.boost = QueryBase.prototype.boost;

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {Object}
 *
 * @private
 */
PrefixQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function MatchAllQuery() {
  this.data = {
    match_all: null
  };
}
SearchQuery.MatchAllQuery = MatchAllQuery;

/**
 * matchAll creates a MatchAllQuery which matches anything.
 *
 * @returns {SearchQuery.MatchAllQuery}
 */
SearchQuery.matchAll = function() {
  return new MatchAllQuery();
};

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {Object}
 *
 * @private
 */
MatchAllQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function MatchNoneQuery() {
  this.data = {
    match_none: null
  };
}
SearchQuery.MatchNoneQuery = MatchNoneQuery;

/**
 * matchNone creates a MatchNoneQuery which matches nothing.
 *
 * @returns {SearchQuery.MatchNoneQuery}
 */
SearchQuery.matchNone = function() {
  return new MatchNoneQuery();
};

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {Object}
 *
 * @private
 */
MatchNoneQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function TermRangeQuery() {
  this.data = {};
}
SearchQuery.TermRangeQuery = TermRangeQuery;

/**
 * termRange creates a TermRangeQuery for matching term
 * ranges in an index.
 *
 * @returns {SearchQuery.TermRangeQuery}
 */
SearchQuery.termRange = function() {
  return new TermRangeQuery();
};

/**
 * min defines the lower bound of this term range query.
 *
 * @param {string} min
 * @param {boolean} inclusive
 * @returns {SearchQuery.TermRangeQuery}
 */
TermRangeQuery.prototype.min = function(min, inclusive) {
  if (inclusive === undefined) {
    inclusive = true;
  }

  this.data.min = min;
  this.data.inclusive_min = inclusive;
  return this;
};

/**
 * max defines the upper bound of this term range query.
 *
 * @param {string} max
 * @param {boolean} inclusive
 * @returns {SearchQuery.TermRangeQuery}
 */
TermRangeQuery.prototype.max = function(max, inclusive) {
  if (inclusive === undefined) {
    inclusive = false;
  }

  this.data.max = max;
  this.data.inclusive_max = inclusive;
  return this;
};

/**
 * Specifies the field to query.
 *
 * @param {string} field
 * @returns {SearchQuery.TermRangeQuery}
 */
TermRangeQuery.prototype.field = QueryBase.prototype.field;

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.TermRangeQuery}
 */
TermRangeQuery.prototype.boost = QueryBase.prototype.boost;

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {string}
 *
 * @private
 */
TermRangeQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @private
 * @memberof SearchQuery
 */
function GeoDistanceQuery(lat, lon, distance) {
  this.data = {
    location: [lat, lon],
    distance: [distance]
  };
}
SearchQuery.GeoDistanceQuery = GeoDistanceQuery;

/**
 * geoDistanceQuery creates a geographical distance based query.
 *
 * @returns {SearchQuery.GeoDistanceQuery}
 */
SearchQuery.geoDistanceQuery = function(lat, lon, distance) {
  return new GeoDistanceQuery(lat, lon, distance);
};

/**
 * Specifies the field to query.
 *
 * @param {string} field
 * @returns {SearchQuery.GeoDistanceQuery}
 */
GeoDistanceQuery.prototype.field = QueryBase.prototype.field;

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.GeoDistanceQuery}
 */
GeoDistanceQuery.prototype.boost = QueryBase.prototype.boost;

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {string}
 *
 * @private
 */
GeoDistanceQuery.prototype.toJSON = QueryBase.prototype.toJSON;


/**
 * @constructor
 *
 * @param {number} tl_lat Top-left latitude
 * @param {number} tl_lon Top-left longitude
 * @param {number} br_lat Bottom-right latitude
 * @param {number} br_lon Bottom-right longitude
 * @private
 * @memberof SearchQuery
 */
function GeoBoundingBoxQuery(tl_lat, tl_lon, br_lat, br_lon) {
  this.data = {
    top_left: [tl_lat, tl_lon],
    bottom_right: [br_lat, br_lon]
  };
}
SearchQuery.GeoBoundingBoxQuery = GeoBoundingBoxQuery;

/**
 * geoBoundingBoxQuery creates a geographical bounding-box based query.
 *
 * @param {number} tl_lat Top-left latitude
 * @param {number} tl_lon Top-left longitude
 * @param {number} br_lat Bottom-right latitude
 * @param {number} br_lon Bottom-right longitude
 * @returns {SearchQuery.GeoBoundingBoxQuery}
 */
SearchQuery.geoBoundingBoxQuery = function(tl_lat, tl_lon, br_lat, br_lon) {
  return new GeoBoundingBoxQuery(tl_lat, tl_lon, br_lat, br_lon);
};

/**
 * Specifies the field to query.
 *
 * @param {string} field
 * @returns {SearchQuery.GeoBoundingBoxQuery}
 */
GeoBoundingBoxQuery.prototype.field = QueryBase.prototype.field;

/**
 * boost defines the amount to boost this query.
 *
 * @param {number} boost
 * @returns {SearchQuery.GeoBoundingBoxQuery}
 */
GeoBoundingBoxQuery.prototype.boost = QueryBase.prototype.boost;

/**
 * Serializes this query to JSON for network dispatch.
 *
 * @returns {string}
 *
 * @private
 */
GeoBoundingBoxQuery.prototype.toJSON = QueryBase.prototype.toJSON;
