/**
 * @private
 */
class SearchSortBase {
  constructor(data) {
    if (!data) {
      data = {};
    }

    this._data = data;
  }

  _descending(descending) {
    this._data.desc = descending;
    return this;
  }

  toJSON() {
    return this._data;
  }
}

/**
 * @memberof SearchSort
 * @category Full Text Search
 */
class ScoreSort extends SearchSortBase {
  /**
   * @hideconstructor
   */
  constructor() {
    super({
      by: 'score',
    });
  }

  descending(descending) {
    return this._descending(descending);
  }
}

/**
 * @memberof SearchSort
 * @category Full Text Search
 */
class IdSort extends SearchSortBase {
  /**
   * @hideconstructor
   */
  constructor() {
    super({
      by: 'id',
    });
  }

  descending(descending) {
    return this._descending(descending);
  }
}

/**
 * @memberof SearchSort
 * @category Full Text Search
 */
class FieldSort extends SearchSortBase {
  /**
   * @hideconstructor
   */
  constructor(field) {
    super({
      by: 'field',
      field: field,
    });
  }

  type(type) {
    this._data.type = type;
    return this;
  }

  mode(mode) {
    this._data.mode = mode;
    return this;
  }

  missing(missing) {
    this._data.missing = missing;
    return this;
  }

  descending(descending) {
    return this._descending(descending);
  }
}

/**
 * @memberof SearchSort
 * @category Full Text Search
 */
class GeoDistanceSort extends SearchSortBase {
  /**
   * @hideconstructor
   */
  constructor(field, lat, lon) {
    super({
      by: 'geo_distance',
      field: field,
      location: [lon, lat],
    });
  }

  unit(unit) {
    this._data.unit = unit;
    return this;
  }

  descending(descending) {
    return this._descending(descending);
  }
}

/**
 * 
 * @category Full Text Search
 */
class SearchSort {
  /**
   * 
   */
  static score() {
    return new ScoreSort();
  }

  /**
   * 
   */
  static id() {
    return new IdSort();
  }

  /**
   * 
   */
  static field(field) {
    return new FieldSort(field);
  }

  /**
   * 
   */
  static geoDistance(field, lat, lon) {
    return new GeoDistanceSort(field, lat, lon);
  }
}

module.exports = SearchSort;
