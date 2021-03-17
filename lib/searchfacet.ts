/* eslint jsdoc/require-jsdoc: off */

/**
 * Provides the ability to specify facets for a search query.
 *
 * @category Full Text Search
 */
export class SearchFacet {
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

  static term(field: string, size: number): TermSearchFacet {
    return new TermSearchFacet(field, size)
  }

  static numeric(field: string, size: number): NumericSearchFacet {
    return new NumericSearchFacet(field, size)
  }

  static date(field: string, size: number): DateSearchFacet {
    return new DateSearchFacet(field, size)
  }
}

/**
 * Provides ability to request a term facet.
 *
 * @category Full Text Search
 */
export class TermSearchFacet extends SearchFacet {
  /**
   * @internal
   */
  constructor(field: string, size: number) {
    super({
      field: field,
      size: size,
    })
  }
}

/**
 * Provides ability to request a numeric facet.
 *
 * @category Full Text Search
 */
export class NumericSearchFacet extends SearchFacet {
  /**
   * @internal
   */
  constructor(field: string, size: number) {
    super({
      field: field,
      size: size,
      numeric_ranges: [],
    })
  }

  addRange(name: string, min?: number, max?: number): NumericSearchFacet {
    this._data.numeric_ranges.push({
      name: name,
      min: min,
      max: max,
    })
    return this
  }
}

/**
 * Provides ability to request a date facet.
 *
 * @category Full Text Search
 */
export class DateSearchFacet extends SearchFacet {
  /**
   * @internal
   */
  constructor(field: string, size: number) {
    super({
      field: field,
      size: size,
      date_ranges: [],
    })
  }

  addRange(name: string, start?: Date, end?: Date): DateSearchFacet {
    this._data.date_ranges.push({
      name: name,
      start: start,
      end: end,
    })
    return this
  }
}
