/**
 * @private
 */
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

/**
 * @memberof SearchFacet
 * @category Full Text Search
 */
class TermFacet extends SearchFacetBase {
  /**
   * @hideconstructor
   */
  constructor(field, size) {
    super({
      field: field,
      size: size,
    });
  }

}

/**
 * @memberof SearchFacet
 * @category Full Text Search
 */
class NumericFacet extends SearchFacetBase {
  /**
   * @hideconstructor
   */
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

/**
 * @memberof SearchFacet
 * @category Full Text Search
 */
class DateFacet extends SearchFacetBase {
  /**
   * @hideconstructor
   */
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

/**
 *
 * @category Full Text Search
 */
class SearchFacet {
  /**
   *
   * @param {*} field
   * @param {*} size
   */
  static term(field, size) {
    return new TermFacet(field, size);
  }

  /**
   *
   * @param {*} field
   * @param {*} size
   */
  static numeric(field, size) {
    return new NumericFacet(field, size);
  }

  /**
   *
   * @param {*} field
   * @param {*} size
   */
  static date(field, size) {
    return new DateFacet(field, size);
  }
}

module.exports = SearchFacet;
