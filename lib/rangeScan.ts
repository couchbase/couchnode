/**
 * Represents a search term for a RangeScan.
 *
 * @see {@link RangeScan}
 * @category Key-Value
 */
export class ScanTerm {
  /**
   * The scan term.
   *
   * @see {@link MutationState}
   */
  term: string

  /**
   * Set to true for the scan term to be exclusive. Defaults to false (inclusive).
   */
  exclusive?: boolean

  /**
   * @internal
   */
  constructor(term: string, exclusive?: boolean) {
    this.term = term
    this.exclusive = exclusive
  }
}

/**
 *
 * @internal
 */
export interface ScanType {
  /**
   * Returns string representation of scan type.
   */
  getScanType(): string
}

/**
 * A RangeScan performs a scan on a range of keys with the range specified through
 * a start and end ScanTerm.
 *
 * @category Key-Value
 */
export class RangeScan implements ScanType {
  /**
   * RangeScan start term.
   */
  start?: ScanTerm

  /**
   * RangeScan end term.
   */
  end?: ScanTerm

  /**
   * @internal
   */
  constructor(start?: ScanTerm, end?: ScanTerm) {
    this.start = start
    this.end = end
  }

  /**
   * Returns string representation of scan type.
   */
  getScanType(): string {
    return 'range_scan'
  }
}

/**
 * A SamplingScan performs a scan on a random sampling of keys with the sampling bounded by
 * a limit.
 *
 * @category Key-Value
 */
export class SamplingScan implements ScanType {
  /**
   * SamplingScan limit.
   */
  limit: number

  /**
   * SamplingScan seed.
   */
  seed?: number

  /**
   * @internal
   */
  constructor(limit: number, seed?: number) {
    this.limit = limit
    this.seed = seed
  }

  /**
   * Returns string representation of scan type.
   */
  getScanType(): string {
    return 'sampling_scan'
  }
}

/**
 * A PrefixScan scan type selects every document whose ID starts with a certain prefix.
 *
 * @category Key-Value
 */
export class PrefixScan implements ScanType {
  /**
   * PrefixScan prefix.
   */
  prefix: string

  /**
   * @internal
   */
  constructor(prefix: string) {
    this.prefix = prefix
  }

  /**
   * Returns string representation of scan type.
   */
  getScanType(): string {
    return 'prefix_scan'
  }
}
