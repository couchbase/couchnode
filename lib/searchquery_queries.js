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
  return ths;
};

QueryBase.prototype.toJSON = function() {
  return this.data;
};

var SearchQuery = {};
module.exports = SearchQuery;

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
 * @returns {MatchQuery}
 */
SearchQuery.match = function(match) {
  return new MatchQuery(match);
};

MatchQuery.prototype.field = QueryBase.prototype.field;
MatchQuery.prototype.analyzer = QueryBase.prototype.analyzer;
MatchQuery.prototype.prefixLength = QueryBase.prototype.prefixLength;
MatchQuery.prototype.fuzziness = QueryBase.prototype.fuzziness;
MatchQuery.prototype.boost = QueryBase.prototype.boost;
MatchQuery.prototype.toJSON = QueryBase.prototype.toJSON;


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
 * @returns {MatchPhraseQuery}
 */
SearchQuery.matchPhrase = function(phrase) {
  return new MatchPhraseQuery(phrase);
};

MatchPhraseQuery.prototype.field = QueryBase.prototype.field;
MatchPhraseQuery.prototype.analyzer = QueryBase.prototype.analyzer;
MatchPhraseQuery.prototype.boost = QueryBase.prototype.boost;
MatchPhraseQuery.prototype.toJSON = QueryBase.prototype.toJSON;


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
 * @returns {RegexpQuery}
 */
SearchQuery.regexp = function(regexp) {
  return new RegexpQuery(regexp);
};

RegexpQuery.prototype.field = QueryBase.prototype.field;
RegexpQuery.prototype.boost = QueryBase.prototype.boost;
RegexpQuery.prototype.toJSON = QueryBase.prototype.toJSON;


function StringQuery(query) {
  this.data = {
    query: query
  };
}
SearchQuery.StringQuery = StringQuery;

/**
 * string creates a StringQuery for matching strings.
 *
 * @param {string} query
 * @returns {StringQuery}
 */
SearchQuery.string = function(query) {
  return new StringQuery(query);
};

StringQuery.prototype.boost = QueryBase.prototype.boost;
StringQuery.prototype.toJSON = QueryBase.prototype.toJSON;


function NumericRangeQuery() {
  this.data = {};
}
SearchQuery.NumericRangeQuery = NumericRangeQuery;

/**
 * numericRange creates a NumericRangeQuery for matching numeric
 * ranges in an index.
 *
 * @returns {NumericRangeQuery}
 */
SearchQuery.numericRange = function() {
  return new NumericRangeQuery();
};

NumericRangeQuery.prototype.boost = QueryBase.prototype.boost;
NumericRangeQuery.prototype.toJSON = QueryBase.prototype.toJSON;


function DateRangeQuery() {
  this.data = {};
}
SearchQuery.DateRangeQuery = DateRangeQuery;

/**
 * dateRange creates a DateRangeQuery for matching date ranges in an index.
 *
 * @returns {DateRangeQuery}
 */
SearchQuery.dateRange = function() {
  return new DateRangeQuery();
};

DateRangeQuery.prototype.dateTimeParser = QueryBase.prototype.dateTimeParser;
DateRangeQuery.prototype.boost = QueryBase.prototype.boost;
DateRangeQuery.prototype.toJSON = QueryBase.prototype.toJSON;


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
 * @returns {ConjunctionQuery}
 */
SearchQuery.conjuncts = function(queries) {
  queries = cbutils.unpackArgs(queries, arguments);
  return new ConjunctionQuery(queries);
};

ConjunctionQuery.prototype.and = function(queries) {
  queries = cbutils.unpackArgs(queries, arguments);
  for (var i = 0; i < queries.length; ++i) {
    this.data.conjuncts.push(queries[i]);
  }
};
ConjunctionQuery.prototype.boost = QueryBase.prototype.boost;
ConjunctionQuery.prototype.toJSON = QueryBase.prototype.toJSON;


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
 * @returns {ConjunctionQuery}
 */
SearchQuery.disjuncts = function(queries) {
  queries = cbutils.unpackArgs(queries, arguments);
  return new DisjunctionQuery(queries);
};

DisjunctionQuery.prototype.or = function(queries) {
  queries = cbutils.unpackArgs(queries, arguments);
  for (var i = 0; i < queries.length; ++i) {
    this.data.disjuncts.push(queries[i]);
  }
};
DisjunctionQuery.prototype.boost = QueryBase.prototype.boost;
DisjunctionQuery.prototype.toJSON = QueryBase.prototype.toJSON;


function BooleanQuery() {
  this.data = {};
  this.shouldMin = undefined;
}
SearchQuery.BooleanQuery = BooleanQuery;

/**
 * boolean creates a compound BooleanQuery composed of several
 * other Query objects.
 *
 * @returns {BooleanQuery}
 */
SearchQuery.boolean = function() {
  return new BooleanQuery();
};

BooleanQuery.prototype.must = function(query) {
  if (!(query instanceof ConjunctionQuery)) {
    query = new ConjunctionQuery([query]);
  }
  this.data.must = query;
  return this;
};
BooleanQuery.prototype.should = function(query) {
  if (!(query instanceof DisjunctionQuery)) {
    query = new DisjunctionQuery([query]);
  }
  this.data.should = query;
  return this;
};
BooleanQuery.prototype.mustNot = function(query) {
  if (!(query instanceof DisjunctionQuery)) {
    query = new DisjunctionQuery([query]);
  }
  this.data.must_not = query;
  return this;
};
BooleanQuery.prototype.shouldMin = function(shouldMin) {
  this.shouldMin = shouldMin;
  return this;
};
BooleanQuery.prototype.boost = QueryBase.prototype.boost;

BooleanQuery.prototype.toJSON = function() {
  var out = {};
  if (this.data.must) {
    out.must = this.data.must;
  }
  if (this.data.should) {
    var shouldData = this.data.should.toJSON();
    shouldData.min = this.shouldMin;
    out.should = shouldData;
    out.should = {};
  }
  if (this.data.must_not) {
    out.must_not = this.data.must_not;
  }
  return out;
};


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
 * @returns {WildcardQuery}
 */
SearchQuery.wildcard = function(wildcard) {
  return new WildcardQuery(wildcard);
};

WildcardQuery.prototype.field = QueryBase.prototype.field;
WildcardQuery.prototype.boost = QueryBase.prototype.boost;
WildcardQuery.prototype.toJSON = QueryBase.prototype.toJSON;


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
 * @returns {DocIdQuery}
 */
SearchQuery.docIds = function(ids) {
  ids = cbutils.unpackArgs(ids, arguments);
  return new DocIdQuery(ids);
};

DocIdQuery.prototype.addDocIds = function(ids) {
  ids = cbutils.unpackArgs(ids, arguments);
  for (var i = 0; i < ids.length; ++i) {
    this.data.ids.push(ids);
  }
};
DocIdQuery.prototype.field = QueryBase.prototype.field;
DocIdQuery.prototype.boost = QueryBase.prototype.boost;
DocIdQuery.prototype.toJSON = QueryBase.prototype.toJSON;


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
 * @returns {BooleanFieldQuery}
 */
SearchQuery.booleanField = function(val) {
  return new BooleanFieldQuery(val);
};

DocIdQuery.prototype.field = QueryBase.prototype.field;
DocIdQuery.prototype.boost = QueryBase.prototype.boost;
DocIdQuery.prototype.toJSON = QueryBase.prototype.toJSON;


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
 * @returns {TermQuery}
 */
SearchQuery.term = function(term) {
  return new TermQuery(term);
};

TermQuery.prototype.field = QueryBase.prototype.field;
TermQuery.prototype.prefixLength = QueryBase.prototype.prefixLength;
TermQuery.prototype.fuzziness = QueryBase.prototype.fuzziness;
TermQuery.prototype.boost = QueryBase.prototype.boost;
TermQuery.prototype.toJSON = QueryBase.prototype.toJSON;


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
 * @returns {PhraseQuery}
 */
SearchQuery.phrase = function(terms) {
  return new PhraseQuery(terms);
};

PhraseQuery.prototype.field = QueryBase.prototype.field;
PhraseQuery.prototype.boost = QueryBase.prototype.boost;
PhraseQuery.prototype.toJSON = QueryBase.prototype.toJSON;


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
 * @returns {PrefixQuery}
 */
SearchQuery.prefix = function(prefix) {
  return new PrefixQuery(prefix);
};

PrefixQuery.prototype.field = QueryBase.prototype.field;
PrefixQuery.prototype.boost = QueryBase.prototype.boost;
PrefixQuery.prototype.toJSON = QueryBase.prototype.toJSON;


function MatchAllQuery() {
  this.data = {};
}
SearchQuery.MatchAllQuery = MatchAllQuery;

/**
 * matchAll creates a MatchAllQuery which matches anything.
 *
 * @returns {MatchAllQuery}
 */
SearchQuery.matchAll = function() {
  return new MatchAllQuery();
};

MatchAllQuery.prototype.toJSON = QueryBase.prototype.toJSON;


function MatchNoneQuery() {
  this.data = {};
}
SearchQuery.MatchNoneQuery = MatchNoneQuery;

/**
 * matchNone creates a MatchNoneQuery which matches nothing.
 *
 * @returns {MatchNoneQuery}
 */
SearchQuery.matchNone = function() {
  return new MatchNoneQuery();
};

MatchNoneQuery.prototype.toJSON = QueryBase.prototype.toJSON;
