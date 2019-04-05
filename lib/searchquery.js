const Utils = require('./utils');

function queryHasProp(query, key) {
    if (query && query.toJSON) {
        var query = query.toJSON();
    }
    return query[key] !== undefined;
}

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
        this._data.fuziness = fuziness;
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

class MatchQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'match');
    }

    constructor(match) {
        super({
            match: match,
        });
    }

    field(field) {
        return this._field(field);
    }

    analyzer(analyzer) {
        return this._analyzer(analyzer);
    }

    prefixLength(prefixLength) {
        return this._prefixLength(prefixLength);
    }

    fuzziness(fuzziness) {
        return this._fuzziness(fuzziness);
    }

    boost(boost) {
        return this._boost(boost);
    }
}

class MatchPhraseQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'match_phrase');
    }

    constructor(phrase) {
        super({
            match_phrase: phrase,
        });
    }

    field(field) {
        return this._field(field);
    }

    analyzer(analyzer) {
        return this._analyzer(analyzer);
    }

    boost(boost) {
        return this._boost(boost);
    }
}

class RegexpQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'regexp');
    }

    constructor(regexp) {
        super({
            regexp: regexp,
        });
    }

    field(field) {
        return this._field(field);
    }

    boost(boost) {
        return this._boost(boost);
    }
}

class QueryStringQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'query');
    }

    constructor(query) {
        super({
            query: query,
        });
    }

    boost(boost) {
        return this._boost(boost);
    }
}

class NumericRangeQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'min') ||
            queryHasProp(query, 'max');
    }

    constructor() {
        super({});
    }

    min(min, inclusive) {
        if (inclusive === undefined) {
            inclusive = true;
        }

        this._data.min = min;
        this._data.inclusive_min = inclusive;
        return this;
    }

    max(max, inclusive) {
        if (inclusive === undefined) {
            inclusive = false;
        }

        this._data.max = max;
        this._data.inclusive_max = inclusive;
        return this;
    }

    field(field) {
        return this._field(field);
    }

    boost(boost) {
        return this._boost(boost);
    }
}

class DateRangeQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'start') ||
            queryHasProp(query, 'end');
    }

    constructor() {
        super({});
    }

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

    field(field) {
        return this._field(field);
    }

    dateTimeParser(parser) {
        return this._dateTimeParser(parser);
    }

    boost(boost) {
        return this._boost(boost);
    }
}

class ConjunctionQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'conjuncts');
    }

    constructor(queries) {
        queries = Utils.unpackArgs(queries, arguments);

        super({
            conjuncts: [],
        });

        this.and(queries);
    }

    and(queries) {
        queries = Utils.unpackArgs(queries, arguments);

        for (var i = 0; i < queries.length; ++i) {
            this._data.conjuncs.push(queries[i]);
        }
        return this;
    }

    boost(boost) {
        return this._boost(boost);
    }
}

class DisjunctionQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'disjuncts');
    }

    constructor() {
        queries = Utils.unpackArgs(queries, arguments);

        super({
            disjuncts: [],
        });

        this.or(queries);
    }

    or(queries) {
        queries = Utils.unpackArgs(queries, arguments);

        for (var i = 0; i < queries.length; ++i) {
            this._data.disjuncts.push(queries[i]);
        }
        return this;
    }

    boost(boost) {
        return this._boost(boost);
    }
}

class BooleanQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'must') ||
            queryHasProp(query, 'should') ||
            queryHasProp(query, 'must_not');
    }

    constructor() {
        super({});
        this._shouldMin = undefined;
    }

    must(query) {
        if (!ConjunctionQuery._isMyType(query)) {
            query = new ConjunctionQuery([query]);
        }
        this._data.must = query;
        return this;
    }

    should(query) {
        if (!DisjunctionQuery._isMyType(query)) {
            query = new DisjunctionQuery([query]);
        }
        this._data.should = query;
        return this;
    }

    mustNot(query) {
        if (!DisjunctionQuery._isMyType(query)) {
            query = new DisjunctionQuery([query]);
        }
        this._data.must_not = query;
        return this;
    }

    shouldMin(shouldMin) {
        this._shouldMin = shouldMin;
    }

    boost(boost) {
        return this._boost(boost);
    }

    toJSON() {
        var out = {};
        if (this._data.must) {
            out.must = this._data.must;
        }
        if (this._data.should) {
            var shouldData = this.data.should;
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

class WildcardQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'wildcard');
    }

    constructor(wildcard) {
        super({
            wildcard: wildcard,
        });
    }

    field(field) {
        return this._field(field);
    }

    boost(boost) {
        return this._boost(boost);
    }
}

class DocIdQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'ids');
    }

    constructor() {
        ids = Utils.unpackArgs(ids, arguments);

        super({
            ids: [],
        });
        this.addDocIds(ids);
    }

    addDocIds(ids) {
        ids = Utils.unpackArgs(ids, arguments);

        for (var i = 0; i < ids.length; ++i) {
            this._data.ids.push(ids[i]);
        }
        return this;
    }

    field(field) {
        return this._field(field);
    }

    boost(boost) {
        return this._boost(boost);
    }
}

class BooleanFieldQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'bool');
    }

    constructor(val) {
        super({
            bool: val,
        });
    }

    field(field) {
        return this._field(field);
    }

    boost(boost) {
        return this._boost(boost);
    }
}

class TermQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'term');
    }

    constructor(term) {
        super({
            term: term,
        });
    }

    field(field) {
        return this._field(field);
    }

    prefixLength(prefixLength) {
        return this._prefixLength(prefixLength);
    }

    fuzziness(fuzziness) {
        return this._fuzziness(fuzziness);
    }

    boost(boost) {
        return this._boost(boost);
    }
}

class PhraseQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'terms');
    }

    constructor(terms) {
        super({
            terms: terms,
        });
    }

    field(field) {
        return this._field(field);
    }

    boost(boost) {
        return this._boost(boost);
    }
}

class PrefixQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'prefix');
    }

    constructor(prefix) {
        super({
            prefix: prefix,
        });
    }

    field(field) {
        return this._field(field);
    }

    boost(boost) {
        return this._boost(boost);
    }
}

class MatchAllQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'match_all');
    }

    constructor() {
        super({
            match_all: null,
        });
    }
}

class MatchNoneQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'match_none');
    }

    constructor() {
        super({
            match_none: true,
        });
    }
}

class GeoDistanceQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'location') ||
            queryHasProp(query, 'distance');
    }

    constructor(lat, lon, distance) {
        super({
            location: [lat, lon],
            distance: distance,
        });
    }

    field(field) {
        return this._field(field);
    }

    boost(boost) {
        return this._boost(boost);
    }
}

class GeoBoundingBoxQuery extends SearchQueryBase {
    static _isMyType(query) {
        return queryHasProp(query, 'top_left') ||
            queryHasProp(query, 'bottom_right');
    }

    constructor(tl_lat, tl_lon, br_lat, br_lon) {
        super({
            top_left: [tl_lat, tl_lon],
            bottom_right: [br_lat, br_lon],
        });
    }

    field(field) {
        return this._field(field);
    }

    boost(boost) {
        return this._boost(boost);
    }
}

class SearchQuery {
    constructor() {
    }

    static match(match) {
        return new MatchQuery(match);
    }

    static matchPhrase(phrase) {
        return new MatchPhraseQuery(phrase);
    }

    static regexp(regexp) {
        return new RegexpQuery(regexp);
    }

    static queryString(query) {
        return new QueryStringQuery(query);
    }

    static numericRange() {
        return new NumericRangeQuery();
    }

    static dateRange() {
        return new DateRangeQuery();
    }

    static conjuncts(queries) {
        queries = Utils.unpackArgs(queries, arguments);
        return new ConjunctionQuery(queries);
    }

    static disjuncts(queries) {
        queries = Utils.unpackArgs(queries, arguments);
        return new DisjunctionQuery(queries);
    }

    static boolean() {
        return new BooleanQuery();
    }

    static wildcard(wildcard) {
        return new WildcardQuery(wildcard);
    }

    static docIds(ids) {
        ids = Utils.unpackArgs(ids, arguments);
        return new DocIdQuery(ids);
    }

    static booleanField(val) {
        return new BooleanFieldQuery(val);
    }

    static term(term) {
        return new TermQuery(term);
    }

    static phrase(terms) {
        return new PhraseQuery(terms);
    }

    static prefix(prefix) {
        return new PrefixQuery(prefix);
    }

    static matchAll() {
        return new MatchAllQuery();
    }

    static matchNone() {
        return new MatchNoneQuery();
    }

    static geoDistance(lat, lon, distance) {
        return new GeoDistanceQuery(lat, lon, distance);
    }

    static geoBoundingBox(tl_lat, tl_lon, br_lat, br_lon) {
        return new GeoBoundingBoxQuery(tl_lat, tl_lon, br_lat, br_lon);
    }
}

module.exports = SearchQuery;
