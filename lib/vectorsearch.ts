import { InvalidArgumentError } from './errors'
import { SearchQuery } from './searchquery'

/**
 * Specifies how multiple vector searches are combined.
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
 * @category Full Text Search
 */
export class VectorQuery {
  private _fieldName: string
  private _vector: number[] | undefined
  private _vectorBase64: string | undefined
  private _numCandidates: number | undefined
  private _boost: number | undefined
  private _prefilter: SearchQuery | undefined

  constructor(fieldName: string, vector: number[] | string) {
    if (!fieldName) {
      throw new InvalidArgumentError(new Error('Must provide a field name.'))
    }
    this._fieldName = fieldName
    if (!vector) {
      throw new InvalidArgumentError(
        new Error('Provided vector cannot be empty.')
      )
    }
    if (Array.isArray(vector)) {
      if (vector.length == 0) {
        throw new InvalidArgumentError(
          new Error('Provided vector cannot be empty.')
        )
      }
      this._vector = vector
    } else if (typeof vector === 'string') {
      this._vectorBase64 = vector
    } else {
      throw new InvalidArgumentError(
        new Error(
          'Provided vector must be either a number[] or base64 encoded string.'
        )
      )
    }
  }

  /**
   * @internal
   */
  toJSON(): any {
    const output: { [key: string]: any } = {
      field: this._fieldName,
      k: this._numCandidates ?? 3,
    }
    if (this._vector) {
      output['vector'] = this._vector
    } else {
      output['vector_base64'] = this._vectorBase64
    }
    if (this._boost) {
      output['boost'] = this._boost
    }
    if (this._prefilter) {
      output['filter'] = this._prefilter.toJSON()
    }
    return output
  }

  /**
   * Adds boost option to vector query.
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
   * Adds prefilter option to vector query.
   *
   * @param prefilter A SearchQuery.
   */
  prefilter(prefilter: SearchQuery): VectorQuery {
    if (!(prefilter instanceof SearchQuery)) {
      throw new InvalidArgumentError(
        new Error('Provided value for prefilter must be a SearchQuery.')
      )
    }
    this._prefilter = prefilter
    return this
  }

  /**
   * Creates a vector query.
   *
   * @param fieldName The name of the field in the JSON document that holds the vector.
   * @param vector List of floating point values that represent the vector.
   */
  static create(fieldName: string, vector: number[] | string): VectorQuery {
    return new VectorQuery(fieldName, vector)
  }
}

/**
 * Represents a vector search.
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
   * Creates a vector search from a single VectorQuery.
   *
   * @param query A vectory query that should be a part of the vector search.
   */
  static fromVectorQuery(query: VectorQuery): VectorSearch {
    return new VectorSearch([query])
  }
}
