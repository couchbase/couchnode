import { CppMutationToken } from './binding'

/**
 * Represents the mutation token returned by the server.
 *
 * @see {@link MutationState}
 */
export interface MutationToken {
  /**
   * Generates a string representation of this mutation token.
   */
  toString(): string

  /**
   * Generates a JSON representation of this mutation token.
   */
  toJSON(): any
}

/**
 * Aggregates a number of {@link MutationToken}'s which have been returned by mutation
 * operations, which can then be used when performing queries.  This will guarenteed
 * that the query includes the specified set of mutations without incurring the wait
 * associated with request_plus level consistency.
 */
export class MutationState {
  /**
   * @internal
   */
  public _data: {
    [bucketName: string]: { [vbId: number]: CppMutationToken }
  }

  constructor(...tokens: MutationToken[]) {
    this._data = {}

    tokens.forEach((token) => this._addOne(token))
  }

  /**
   * Adds a set of tokens to this state.
   *
   * @param tokens The tokens to add.
   */
  add(...tokens: MutationToken[]): void {
    tokens.forEach((token) => this._addOne(token))
  }

  private _addOne(token: MutationToken) {
    if (!token) {
      return
    }

    const cppToken = token as CppMutationToken
    const tokenData = cppToken.toJSON()
    const vbId = parseInt(tokenData.partition_id, 10)
    const vbSeqNo = parseInt(tokenData.sequence_number, 10)
    const bucketName = tokenData.bucket_name

    if (!this._data[bucketName]) {
      this._data[bucketName] = {}
    }
    if (!this._data[bucketName][vbId]) {
      this._data[bucketName][vbId] = cppToken
    } else {
      const otherToken = this._data[bucketName][vbId]
      const otherTokenSeqNo = parseInt(otherToken.toJSON().sequence, 10)
      if (otherTokenSeqNo < vbSeqNo) {
        this._data[bucketName][vbId] = cppToken
      }
    }
  }

  /**
   * @internal
   */
  toJSON(): any {
    return this._data
  }

  /**
   * @internal
   */
  inspect(): string {
    const tokens: string[] = []

    for (const bucketName in this._data) {
      for (const vbId in this._data[bucketName]) {
        const info = this._data[bucketName][vbId]
        tokens.push(bucketName + ':' + vbId + ':' + info.toString())
      }
    }

    return 'MutationState<' + tokens.join('; ') + '>'
  }
}
