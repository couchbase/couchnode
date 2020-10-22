'use strict';

const Utils = require('./utils');

function _queryHasProp(query, key) {
  if (query && query.toJSON) {
    query = query.toJSON();
  }
  return query[key] !== undefined;
}

/**
 * @private
 */
class SearchQueryBase {
  constructor(data) {
    if (!data) {
      data = {};
    }

    this._data = data;
  }

  toJSON() {
    return this._data;
  }

  _field(field) {
    this._data.field = field;
    return this;
  }

  _analyzer(analyzer) {
    this._data.analyzer = analyzer;
    return this;
  }

  _prefixLength(prefixLength) {
    this._data.prefix_length = prefixLength;
    return this;
  }

  _fuzziness(fuzziness) {
    this._data.fuzziness = fuzziness;
    return this;
  }

  _boost(boost) {
    this._data.boost = boost;
    return this;
  }

  _dateTimeParser(parser) {
    this._data.datetime_parser = parser;
    return this;
  }
}

/**
 * @category Full Text Search
 */
class MatchQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'match');
  }

  /**
   * @hideconstructor
   */
  constructor(match) {
    super({
      match: match,
    });
  }

  /**
   *
   * @param {string} field
   *
   * @returns {MatchQuery}
   */
  field(field) {
    return this._field(field);
  }

  /**
   *
   * @param {string} analyzer
   *
   * @returns {MatchQuery}
   */
  analyzer(analyzer) {
    return this._analyzer(analyzer);
  }

  /**
   *
   * @param {number} prefixLength
   *
   * @returns {MatchQuery}
   */
  prefixLength(prefixLength) {
    return this._prefixLength(prefixLength);
  }

  /**
   *
   * @param {number} fuzziness
   *
   * @returns {MatchQuery}
   */
  fuzziness(fuzziness) {
    return this._fuzziness(fuzziness);
  }

  /**
   *
   * @param {number} boost
   *
   * @returns {MatchQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }
}

/**
 * @category Full Text Search
 */
class MatchPhraseQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'match_phrase');
  }

  /**
   * @hideconstructor
   */
  constructor(phrase) {
    super({
      match_phrase: phrase,
    });
  }

  /**
   *
   * @param {string} field
   *
   * @returns {MatchPhraseQuery}
   */
  field(field) {
    return this._field(field);
  }

  /**
   *
   * @param {string} analyzer
   *
   * @returns {MatchPhraseQuery}
   */
  analyzer(analyzer) {
    return this._analyzer(analyzer);
  }

  /**
   *
   * @param {number} boost
   *
   * @returns {MatchPhraseQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }
}

/**
 * @category Full Text Search
 */
class RegexpQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'regexp');
  }

  /**
   * @hideconstructor
   */
  constructor(regexp) {
    super({
      regexp: regexp,
    });
  }

  /**
   *
   * @param {string} field
   *
   * @returns {RegexpQuery}
   */
  field(field) {
    return this._field(field);
  }

  /**
   *
   * @param {number} boost
   *
   * @returns {RegexpQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }
}

/**
 * @category Full Text Search
 */
class QueryStringQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'query');
  }

  /**
   * @hideconstructor
   */
  constructor(query) {
    super({
      query: query,
    });
  }

  /**
   *
   * @param {number} boost
   *
   * @returns {QueryStringQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }
}

/**
 * @category Full Text Search
 */
class NumericRangeQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'min') || _queryHasProp(query, 'max');
  }

  /**
   * @hideconstructor
   */
  constructor() {
    super({});
  }

  /**
   *
   * @param {number} min
   * @param {boolean} inclusive
   *
   * @returns {NumericRangeQuery}
   */
  min(min, inclusive) {
    if (inclusive === undefined) {
      inclusive = true;
    }

    this._data.min = min;
    this._data.inclusive_min = inclusive;
    return this;
  }

  /**
   *
   * @param {number} max
   * @param {boolean} inclusive
   *
   * @returns {NumericRangeQuery}
   */
  max(max, inclusive) {
    if (inclusive === undefined) {
      inclusive = false;
    }

    this._data.max = max;
    this._data.inclusive_max = inclusive;
    return this;
  }

  /**
   *
   * @param {string} field
   *
   * @returns {NumericRangeQuery}
   */
  field(field) {
    return this._field(field);
  }

  /**
   *
   * @param {number} boost
   *
   * @returns {NumericRangeQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }
}

/**
 * @category Full Text Search
 */
class DateRangeQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'start') || _queryHasProp(query, 'end');
  }

  /**
   * @hideconstructor
   */
  constructor() {
    super({});
  }

  /**
   *
   * @param {Date} start
   * @param {boolean} inclusive
   *
   * @returns {DateRangeQuery}
   */
  start(start, inclusive) {
    if (inclusive === undefined) {
      inclusive = true;
    }

    if (start instanceof Date) {
      this._data.start = start.toISOString();
    } else {
      this._data.start = start;
    }
    this._data.inclusive_start = inclusive;
    return this;
  }

  /**
   *
   * @param {Date} end
   * @param {boolean} inclusive
   *
   * @returns {DateRangeQuery}
   */
  end(end, inclusive) {
    if (inclusive === undefined) {
      inclusive = false;
    }

    if (end instanceof Date) {
      this._data.end = end.toISOString();
    } else {
      this._data.end = end;
    }
    this._data.inclusive_end = inclusive;
    return this;
  }

  /**
   *
   * @param {string} field
   *
   * @returns {DateRangeQuery}
   */
  field(field) {
    return this._field(field);
  }

  /**
   *
   * @param {string} parser
   *
   * @returns {DateRangeQuery}
   */
  dateTimeParser(parser) {
    return this._dateTimeParser(parser);
  }

  /**
   *
   * @param {string} field
   *
   * @returns {DateRangeQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }
}

/**
 * @category Full Text Search
 */
class ConjunctionQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'conjuncts');
  }

  /**
   * @hideconstructor
   */
  constructor(queries) {
    queries = Utils.unpackArgs(queries, arguments);

    super({
      conjuncts: [],
    });

    this.and(queries);
  }

  /**
   *
   * @param {SearchQuery} ...queries
   *
   * @returns {ConjunctionQuery}
   */
  and(queries) {
    queries = Utils.unpackArgs(queries, arguments);

    for (var i = 0; i < queries.length; ++i) {
      this._data.conjuncts.push(queries[i]);
    }
    return this;
  }

  /**
   *
   * @param {number} boost
   *
   * @returns {ConjunctionQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }
}

/**
 * @category Full Text Search
 */
class DisjunctionQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'disjuncts');
  }

  /**
   * @hideconstructor
   */
  constructor(queries) {
    queries = Utils.unpackArgs(queries, arguments);

    super({
      disjuncts: [],
    });

    this.or(queries);
  }

  /**
   *
   * @param {SearchQuery} ...queries
   *
   * @returns {DisjunctionQuery}
   */
  or(queries) {
    queries = Utils.unpackArgs(queries, arguments);

    for (var i = 0; i < queries.length; ++i) {
      this._data.disjuncts.push(queries[i]);
    }
    return this;
  }

  /**
   *
   * @param {number} boost
   *
   * @returns {DisjunctionQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }
}

/**
 * @category Full Text Search
 */
class BooleanQuery extends SearchQueryBase {
  static _isMyType(query) {
    return (
      _queryHasProp(query, 'must') ||
      _queryHasProp(query, 'should') ||
      _queryHasProp(query, 'must_not')
    );
  }

  /**
   * @hideconstructor
   */
  constructor() {
    super({});
    this._shouldMin = undefined;
  }

  /**
   *
   * @param {SearchQuery} query
   *
   * @returns {BooleanQuery}
   */
  must(query) {
    if (!ConjunctionQuery._isMyType(query)) {
      query = new ConjunctionQuery([query]);
    }
    this._data.must = query;
    return this;
  }

  /**
   *
   * @param {SearchQuery} query
   *
   * @returns {BooleanQuery}
   */
  should(query) {
    if (!DisjunctionQuery._isMyType(query)) {
      query = new DisjunctionQuery([query]);
    }
    this._data.should = query;
    return this;
  }

  /**
   *
   * @param {SearchQuery} query
   *
   * @returns {BooleanQuery}
   */
  mustNot(query) {
    if (!DisjunctionQuery._isMyType(query)) {
      query = new DisjunctionQuery([query]);
    }
    this._data.must_not = query;
    return this;
  }

  /**
   *
   * @param {boolean} shouldMin
   *
   * @returns {BooleanQuery}
   */
  shouldMin(shouldMin) {
    this._shouldMin = shouldMin;
  }

  /**
   *
   * @param {number} boost
   *
   * @returns {BooleanQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }

  toJSON() {
    var out = {};
    if (this._data.must) {
      out.must = this._data.must;
    }
    if (this._data.should) {
      var shouldData = this._data.should;
      if (shouldData.toJSON) {
        shouldData = shouldData.toJSON();
      }
      shouldData.min = this._shouldMin;
      out.should = shouldData;
    }
    if (this._data.must_not) {
      out.must_not = this._data.must_not;
    }
    return out;
  }
}

/**
 * @category Full Text Search
 */
class WildcardQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'wildcard');
  }

  /**
   * @hideconstructor
   */
  constructor(wildcard) {
    super({
      wildcard: wildcard,
    });
  }

  /**
   *
   * @param {string} field
   *
   * @returns {WildcardQuery}
   */
  field(field) {
    return this._field(field);
  }

  /**
   *
   * @param {number} boost
   *
   * @returns {WildcardQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }
}

/**
 * @category Full Text Search
 */
class DocIdQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'ids');
  }

  /**
   * @hideconstructor
   */
  constructor(ids) {
    ids = Utils.unpackArgs(ids, arguments);

    super({
      ids: [],
    });
    this.addDocIds(ids);
  }

  /**
   *
   * @param {string} ...ids
   *
   * @returns {DocIdQuery}
   */
  addDocIds(ids) {
    ids = Utils.unpackArgs(ids, arguments);

    for (var i = 0; i < ids.length; ++i) {
      this._data.ids.push(ids[i]);
    }
    return this;
  }

  /**
   *
   * @param {string} field
   *
   * @returns {DocIdQuery}
   */
  field(field) {
    return this._field(field);
  }

  /**
   *
   * @param {number} boost
   *
   * @returns {DocIdQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }
}

/**
 * @category Full Text Search
 */
class BooleanFieldQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'bool');
  }

  /**
   * @hideconstructor
   */
  constructor(val) {
    super({
      bool: val,
    });
  }

  /**
   *
   * @param {string} field
   *
   * @returns {BooleanFieldQuery}
   */
  field(field) {
    return this._field(field);
  }

  /**
   *
   * @param {number} boost
   *
   * @returns {BooleanFieldQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }
}

/**
 * @category Full Text Search
 */
class TermQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'term');
  }

  /**
   * @hideconstructor
   */
  constructor(term) {
    super({
      term: term,
    });
  }

  /**
   *
   * @param {string} field
   *
   * @returns {TermQuery}
   */
  field(field) {
    return this._field(field);
  }

  /**
   *
   * @param {number} prefixLength
   *
   * @returns {TermQuery}
   */
  prefixLength(prefixLength) {
    return this._prefixLength(prefixLength);
  }

  /**
   *
   * @param {number} fuzziness
   *
   * @returns {TermQuery}
   */
  fuzziness(fuzziness) {
    return this._fuzziness(fuzziness);
  }

  /**
   *
   * @param {number} boost
   *
   * @returns {TermQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }
}

/**
 * @category Full Text Search
 */
class PhraseQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'terms');
  }

  /**
   * @hideconstructor
   */
  constructor(terms) {
    super({
      terms: terms,
    });
  }

  /**
   *
   * @param {string} field
   *
   * @returns {PhraseQuery}
   */
  field(field) {
    return this._field(field);
  }

  /**
   *
   * @param {number} boost
   *
   * @returns {PhraseQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }
}

/**
 * @category Full Text Search
 */
class PrefixQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'prefix');
  }

  /**
   * @hideconstructor
   */
  constructor(prefix) {
    super({
      prefix: prefix,
    });
  }

  /**
   *
   * @param {string} field
   *
   * @returns {PrefixQuery}
   */
  field(field) {
    return this._field(field);
  }

  /**
   *
   * @param {number} boost
   *
   * @returns {PrefixQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }
}

/**
 * @category Full Text Search
 */
class MatchAllQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'match_all');
  }

  /**
   * @hideconstructor
   */
  constructor() {
    super({
      match_all: null,
    });
  }
}

/**
 * @category Full Text Search
 */
class MatchNoneQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'match_none');
  }

  /**
   * @hideconstructor
   */
  constructor() {
    super({
      match_none: true,
    });
  }
}

/**
 * @category Full Text Search
 */
class GeoDistanceQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'location') || _queryHasProp(query, 'distance');
  }

  /**
   * @hideconstructor
   */
  constructor(lon, lat, distance) {
    super({
      location: [lon, lat],
      distance: distance,
    });
  }

  /**
   *
   * @param {string} field
   *
   * @returns {GeoDistanceQuery}
   */
  field(field) {
    return this._field(field);
  }

  /**
   *
   * @param {number} boost
   *
   * @returns {GeoDistanceQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }
}

/**
 * @category Full Text Search
 */
class GeoBoundingBoxQuery extends SearchQueryBase {
  static _isMyType(query) {
    return (
      _queryHasProp(query, 'top_left') || _queryHasProp(query, 'bottom_right')
    );
  }

  /**
   * @hideconstructor
   */
  constructor(tl_lon, tl_lat, br_lon, br_lat) {
    super({
      top_left: [tl_lon, tl_lat],
      bottom_right: [br_lon, br_lat],
    });
  }

  /**
   *
   * @param {string} field
   *
   * @returns {GeoBoundingBoxQuery}
   */
  field(field) {
    return this._field(field);
  }

  /**
   *
   * @param {number} boost
   *
   * @returns {GeoBoundingBoxQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }
}

/**
 * @category Full Text Search
 */
class GeoPolygonQuery extends SearchQueryBase {
  static _isMyType(query) {
    return _queryHasProp(query, 'polygon_points');
  }

  /**
   * @hideconstructor
   */
  constructor(points) {
    const mappedPoints = points.map((v) => {
      if (Array.isArray(v)) {
        return v;
      } else if (v instanceof Object) {
        if (v.lon || v.lat) {
          return [v.lon, v.lat];
        } else if (v.longitude || v.latitude) {
          return [v.longitude, v.latitude];
        } else {
          return [undefined, undefined];
        }
      }
    });
    super({
      polygon_points: mappedPoints,
    });
  }

  /**
   *
   * @param {string} field
   *
   * @returns {GeoPolygonQuery}
   */
  field(field) {
    return this._field(field);
  }

  /**
   *
   * @param {number} boost
   *
   * @returns {GeoPolygonQuery}
   */
  boost(boost) {
    return this._boost(boost);
  }
}

/**
 *
 * @category Full Text Search
 */
class SearchQuery {
  constructor() {}

  /**
   *
   * @param {*} match
   *
   * @returns {MatchQuery}
   */
  static match(match) {
    return new MatchQuery(match);
  }

  /**
   *
   * @param {string} phrase
   *
   * @returns {MatchPhraseQuery}
   */
  static matchPhrase(phrase) {
    return new MatchPhraseQuery(phrase);
  }

  /**
   *
   * @param {string} regexp
   *
   * @returns {RegexpQuery}
   */
  static regexp(regexp) {
    return new RegexpQuery(regexp);
  }

  /**
   *
   * @param {string} query
   *
   * @returns {QueryStringQuery}
   */
  static queryString(query) {
    return new QueryStringQuery(query);
  }

  /**
   *
   * @returns {NumericRangeQuery}
   */
  static numericRange() {
    return new NumericRangeQuery();
  }

  /**
   *
   * @returns {DateRangeQuery}
   */
  static dateRange() {
    return new DateRangeQuery();
  }

  /**
   *
   * @param {SearchQuery} ...queries
   *
   * @returns {ConjunctionQuery}
   */
  static conjuncts(queries) {
    queries = Utils.unpackArgs(queries, arguments);
    return new ConjunctionQuery(queries);
  }

  /**
   *
   * @param {SearchQuery} ...queries
   *
   * @returns {DisjunctionQuery}
   */
  static disjuncts(queries) {
    queries = Utils.unpackArgs(queries, arguments);
    return new DisjunctionQuery(queries);
  }

  /**
   *
   * @returns {BooleanQuery}
   */
  static boolean() {
    return new BooleanQuery();
  }

  /**
   *
   * @param {string} wildcard
   *
   * @returns {WildcardQuery}
   */
  static wildcard(wildcard) {
    return new WildcardQuery(wildcard);
  }

  /**
   *
   * @param {string} ...ids
   *
   * @returns {DocIdQuery}
   */
  static docIds(ids) {
    ids = Utils.unpackArgs(ids, arguments);
    return new DocIdQuery(ids);
  }

  /**
   *
   * @param {boolean} val
   *
   * @returns {BooleanFieldQuery}
   */
  static booleanField(val) {
    return new BooleanFieldQuery(val);
  }

  /**
   *
   * @param {string} term
   *
   * @returns {TermQuery}
   */
  static term(term) {
    return new TermQuery(term);
  }

  /**
   *
   * @param {string} terms
   *
   * @returns {PhraseQuery}
   */
  static phrase(terms) {
    return new PhraseQuery(terms);
  }

  /**
   *
   * @param {string} prefix
   *
   * @returns {PrefixQuery}
   */
  static prefix(prefix) {
    return new PrefixQuery(prefix);
  }

  /**
   *
   * @returns {MatchAllQuery}
   */
  static matchAll() {
    return new MatchAllQuery();
  }

  /**
   *
   * @returns {MatchNoneQuery}
   */
  static matchNone() {
    return new MatchNoneQuery();
  }

  /**
   *
   * @param {number} lon
   * @param {number} lat
   * @param {string} distance
   *
   * @returns {GeoDistanceQuery}
   */
  static geoDistance(lon, lat, distance) {
    return new GeoDistanceQuery(lon, lat, distance);
  }

  /**
   *
   * @param {number} tl_lon
   * @param {number} tl_lat
   * @param {number} br_lon
   * @param {number} br_lat
   *
   * @returns {GeoBoundingBoxQuery}
   */
  static geoBoundingBox(tl_lon, tl_lat, br_lon, br_lat) {
    return new GeoBoundingBoxQuery(tl_lon, tl_lat, br_lon, br_lat);
  }

  /**
   *
   * @param {Array} points
   *
   * @returns {GeoPolygonQuery}
   */
  static geoPolygon(points) {
    return new GeoPolygonQuery(points);
  }
}

module.exports = SearchQuery;
