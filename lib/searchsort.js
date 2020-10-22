'use strict';

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

  /**
   *
   * @param {boolean} descending
   *
   * @returns {ScoreSort}
   */
  descending(descending) {
    return this._descending(descending);
  }
}

/**
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

  /**
   *
   * @param {boolean} descending
   *
   * @returns {IdSort}
   */
  descending(descending) {
    return this._descending(descending);
  }
}

/**
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

  /**
   *
   * @param {string} type
   *
   * @returns {FieldSort}
   */
  type(type) {
    this._data.type = type;
    return this;
  }

  /**
   *
   * @param {string} mode
   *
   * @returns {FieldSort}
   */
  mode(mode) {
    this._data.mode = mode;
    return this;
  }

  /**
   *
   * @param {boolean} missing
   *
   * @returns {FieldSort}
   */
  missing(missing) {
    this._data.missing = missing;
    return this;
  }

  /**
   *
   * @param {boolean} descending
   *
   * @returns {FieldSort}
   */
  descending(descending) {
    return this._descending(descending);
  }
}

/**
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

  /**
   *
   * @param {string} unit
   *
   * @returns {GeoDistanceSort}
   */
  unit(unit) {
    this._data.unit = unit;
    return this;
  }

  /**
   *
   * @param {boolean} descending
   *
   * @returns {GeoDistanceSort}
   */
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
   * @returns {ScoreSort}
   */
  static score() {
    return new ScoreSort();
  }

  /**
   *
   * @returns {IdSort}
   */
  static id() {
    return new IdSort();
  }

  /**
   *
   * @returns {FieldSort}
   */
  static field(field) {
    return new FieldSort(field);
  }

  /**
   *
   * @returns {GeoDistanceSort}
   */
  static geoDistance(field, lat, lon) {
    return new GeoDistanceSort(field, lat, lon);
  }
}

module.exports = SearchSort;
