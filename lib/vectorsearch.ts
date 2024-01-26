import { InvalidArgumentError } from './errors'

/**
 * Specifies how multiple vector searches are combined.
 *
 * Volatile: This API is subject to change at any time.
 *
 * @category Full Text Search
 */
export enum VectorQueryCombination {
  /**
   * Indicates that multiple vector queries should be combined with logical AND.
   */
  AND = 'and',

  /**
   * Indicates that multiple vector queries should be combined with logical OR.
   */
  OR = 'or',
}

/**
 * Volatile: This API is subject to change at any time.
 *
 * @category Full Text Search
 */
export interface VectorSearchOptions {
  /**
   * Specifies how multiple vector queries should be combined.
   */
  vectorQueryCombination?: VectorQueryCombination
}

/**
 * Represents a vector query.
 *
 * Volatile: This API is subject to change at any time.
 *
 * @category Full Text Search
 */
export class VectorQuery {
  private _fieldName: string
  private _vector: number[]
  private _numCandidates: number | undefined
  private _boost: number | undefined

  constructor(fieldName: string, vector: number[]) {
    this._fieldName = fieldName
    if (!Array.isArray(vector) || vector.length == 0) {
      throw new InvalidArgumentError(
        new Error('Provided vector must be an array and cannot be empty.')
      )
    }
    this._vector = vector
  }

  /**
   * @internal
   */
  toJSON(): any {
    const output: { [key: string]: any } = {
      field: this._fieldName,
      vector: this._vector,
      k: this._numCandidates ?? 3,
    }
    if (this._boost) {
      output['boost'] = this._boost
    }
    return output
  }

  /**
   * Adds boost option to vector query.
   *
   * Volatile: This API is subject to change at any time.
   *
   * @param boost A floating point value.
   */
  boost(boost: number): VectorQuery {
    this._boost = boost
    return this
  }

  /**
   * Adds numCandidates option to vector query. Value must be >= 1.
   *
   * Volatile: This API is subject to change at any time.
   *
   * @param numCandidates An integer value.
   */
  numCandidates(numCandidates: number): VectorQuery {
    if (numCandidates < 1) {
      throw new InvalidArgumentError(
        new Error('Provided value for numCandidates must be >= 1.')
      )
    }
    this._numCandidates = numCandidates
    return this
  }

  /**
   * Creates a vector query.
   *
   * Volatile: This API is subject to change at any time.
   *
   * @param fieldName The name of the field in the JSON document that holds the vector.
   * @param vector List of floating point values that represent the vector.
   */
  static create(fieldName: string, vector: number[]): VectorQuery {
    return new VectorQuery(fieldName, vector)
  }
}

/**
 * Represents a vector search.
 *
 * Volatile: This API is subject to change at any time.
 *
 * @category Full Text Search
 */
export class VectorSearch {
  private _queries: VectorQuery[]
  private _options: VectorSearchOptions | undefined

  constructor(queries: VectorQuery[], options?: VectorSearchOptions) {
    if (!Array.isArray(queries) || queries.length == 0) {
      throw new InvalidArgumentError(
        new Error('Provided queries must be an array and cannot be empty.')
      )
    }
    if (!queries.every((q) => q instanceof VectorQuery)) {
      throw new InvalidArgumentError(
        new Error('All provided queries must be a VectorQuery.')
      )
    }
    this._queries = queries
    this._options = options
  }

  /**
   * @internal
   */
  get queries(): VectorQuery[] {
    return this._queries
  }

  /**
   * @internal
   */
  get options(): VectorSearchOptions | undefined {
    return this._options
  }

  /**
   * Creates a vector search.
   *
   * Volatile: This API is subject to change at any time.
   *
   * @param query A vectory query that should be a part of the vector search.
   */
  static fromVectorQuery(query: VectorQuery): VectorSearch {
    return new VectorSearch([query])
  }
}
