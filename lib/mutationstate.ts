/**
 * Represents the mutation token returned by the server.
 *
 * @see {@link MutationState}
 */
export class MutationToken {
  private constructor() {
    // Private to discourage people from trying to construct it.
  }
}

/**
 * Aggregates a number of {@link MutationToken}'s which have been returned by mutation
 * operations, which can then be used when performing queries.  This will guarenteed
 * that the query includes the specified set of mutations without incurring the wait
 * associated with request_plus level consistency.
 */
export class MutationState {
  private _data: {
    [bucketName: string]: { [vbId: number]: [seqNo: number, vbUuid: string] }
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
    if ((token as any).token) {
      token = (token as any).token
    }

    const tokenData = token.toString().split(':')
    if (tokenData.length < 4 || tokenData[3] === '') {
      return
    }
    const vbId = parseInt(tokenData[0])
    const vbUuid = tokenData[1]
    const vbSeqNo = parseInt(tokenData[2], 10)
    const bucketName = tokenData[3]

    if (!this._data[bucketName]) {
      this._data[bucketName] = {}
    }
    if (!this._data[bucketName][vbId]) {
      this._data[bucketName][vbId] = [vbSeqNo, vbUuid]
    } else {
      const info = this._data[bucketName][vbId]
      if (info[0] < vbSeqNo) {
        info[0] = vbSeqNo
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
        tokens.push(vbId + ':' + info[0] + ':' + info[1] + ':' + bucketName)
      }
    }

    return 'MutationState<' + tokens.join('; ') + '>'
  }
}
