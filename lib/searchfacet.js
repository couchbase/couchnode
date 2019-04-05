class SearchFacetBase {
    constructor(data) {
        if (!data) {
            data = {};
        }

        this._data = data;
    }

    toJSON() {
        return this._data;
    }
}

class TermFacet extends SearchFacetBase {
    constructor(field, size) {
        super({
            field: field,
            size: size,
        });
    }


}

class NumericFacet extends SearchFacetBase {
    constructor(field, size) {
        super({
            field: field,
            size: size,
            numeric_ranges: [],
        });
    }

    addRange(name, min, max) {
        this._data.numeric_ranges.push({
            name: name,
            min: min,
            max: max,
        });
        return this;
    }
}

class DateFacet extends SearchFacetBase {
    constructor(field, size) {
        super({
            field: field,
            size: size,
            date_ranges: [],
        });
    }

    addRange(name, start, end) {
        this._data.date_ranges.push({
            name: name,
            start: start,
            end: end,
        });
        return this;
    }
}

class SearchFacet {
    static term(field, size) {
        return new TermFacet(field, size);
    }

    static numeric(field, size) {
        return new NumericFacet(field, size);
    }

    static date(field, size) {
        return new DateFacet(field, size);
    }
}

module.exports = SearchFacet;
