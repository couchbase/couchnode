/* eslint jsdoc/require-jsdoc: off */

/**
 * Provides the ability to specify sorting for a search query.
 *
 * @category Full Text Search
 */
export class SearchSort {
  protected _data: any

  constructor(data: any) {
    if (!data) {
      data = {}
    }

    this._data = data
  }

  toJSON(): any {
    return this._data
  }

  static score(): ScoreSearchSort {
    return new ScoreSearchSort()
  }

  static id(): IdSearchSort {
    return new IdSearchSort()
  }

  static field(field: string): FieldSearchSort {
    return new FieldSearchSort(field)
  }

  static geoDistance(
    field: string,
    lat: number,
    lon: number
  ): GeoDistanceSearchSort {
    return new GeoDistanceSearchSort(field, lat, lon)
  }
}

/**
 * Provides sorting for a search query by score.
 *
 * @category Full Text Search
 */
export class ScoreSearchSort extends SearchSort {
  /**
   * @internal
   */
  constructor() {
    super({
      by: 'score',
    })
  }

  descending(descending: boolean): ScoreSearchSort {
    this._data.desc = descending
    return this
  }
}

/**
 *  Provides sorting for a search query by document id.
 *
 * @category Full Text Search
 */
export class IdSearchSort extends SearchSort {
  /**
   * @internal
   */
  constructor() {
    super({
      by: 'id',
    })
  }

  descending(descending: boolean): IdSearchSort {
    this._data.desc = descending
    return this
  }
}

/**
 *  Provides sorting for a search query by a specified field.
 *
 * @category Full Text Search
 */
export class FieldSearchSort extends SearchSort {
  /**
   * @internal
   */
  constructor(field: string) {
    super({
      by: 'field',
      field: field,
    })
  }

  type(type: string): FieldSearchSort {
    this._data.type = type
    return this
  }

  mode(mode: string): FieldSearchSort {
    this._data.mode = mode
    return this
  }

  missing(missing: boolean): FieldSearchSort {
    this._data.missing = missing
    return this
  }

  descending(descending: boolean): FieldSearchSort {
    this._data.desc = descending
    return this
  }
}

/**
 *  Provides sorting for a search query by geographic distance from a point.
 *
 * @category Full Text Search
 */
export class GeoDistanceSearchSort extends SearchSort {
  /**
   * @internal
   */
  constructor(field: string, lat: number, lon: number) {
    super({
      by: 'geo_distance',
      field: field,
      location: [lon, lat],
    })
  }

  unit(unit: string): GeoDistanceSearchSort {
    this._data.unit = unit
    return this
  }

  descending(descending: boolean): GeoDistanceSearchSort {
    this._data.desc = descending
    return this
  }
}
