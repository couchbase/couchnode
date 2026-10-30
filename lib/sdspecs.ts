import { LookupInOp, MutateInOp } from './sdutils'

/**
 * Represents a macro that can be passed to a lookup-in operation to
 * fetch special values such as the expiry, cas, etc...
 *
 * @category Key-Value
 */
export class LookupInMacro {
  /**
   * @internal
   */
  _value: string

  constructor(value: string) {
    this._value = value
  }

  /**
   * A macro which references the entirety of the document meta-data.
   */
  static get Document(): LookupInMacro {
    return new LookupInMacro('$document')
  }

  /**
   * A macro which references the expiry of a document.
   */
  static get Expiry(): LookupInMacro {
    return new LookupInMacro('$document.exptime')
  }

  /**
   * A macro which references the cas of a document.
   */
  static get Cas(): LookupInMacro {
    return new LookupInMacro('$document.CAS')
  }

  /**
   * A macro which references the seqno of a document.
   */
  static get SeqNo(): LookupInMacro {
    return new LookupInMacro('$document.seqno')
  }

  /**
   * A macro which references the last modified time of a document.
   */
  static get LastModified(): LookupInMacro {
    return new LookupInMacro('$document.last_modified')
  }

  /**
   * A macro which references the deletion state of a document.  This
   * only makes sense to use in concert with the internal AccessDeleted
   * flags, which are internal.
   */
  static get IsDeleted(): LookupInMacro {
    return new LookupInMacro('$document.deleted')
  }

  /**
   * A macro which references the size of a document, expressed in bytes.
   */
  static get ValueSizeBytes(): LookupInMacro {
    return new LookupInMacro('$document.value_bytes')
  }

  /**
   * A macro which references the revision id of a document.
   */
  static get RevId(): LookupInMacro {
    return new LookupInMacro('$document.revid')
  }
}

/**
 * Represents a macro that can be passed to a mutate-in operation to
 * write special values such as the expiry, cas, etc...
 *
 * @category Key-Value
 */
export class MutateInMacro {
  /**
   * @internal
   */
  _value: string

  constructor(value: string) {
    this._value = value
  }

  /**
   * A macro which references the cas of a document.
   */
  static get Cas(): MutateInMacro {
    return new MutateInMacro('${Mutation.CAS}')
  }

  /**
   * A macro which references the seqno of a document.
   */
  static get SeqNo(): MutateInMacro {
    return new MutateInMacro('${Mutation.seqno}')
  }

  /**
   * A macro which references the crc32 of the value of a document.
   */
  static get ValueCrc32c(): MutateInMacro {
    return new MutateInMacro('${Mutation.value_crc32c}')
  }
}

/**
 * Represents a sub-operation to perform within a lookup-in operation.
 *
 * @category Key-Value
 */
export class LookupInSpec {
  /**
   * BUG(JSCBC-756): Previously provided access to the expiry macro for a
   * lookup-in operation.
   *
   * @deprecated Use {@link LookupInMacro.Expiry} instead.
   */
  static get Expiry(): LookupInMacro {
    return LookupInMacro.Expiry
  }

  /**
   * @internal
   */
  _op: LookupInOp

  /**
   * @internal
   */
  _path: string

  /**
   * @internal
   */
  _xattr: boolean

  private constructor(op: LookupInOp, path: string, xattr: boolean) {
    this._op = op
    this._path = path
    this._xattr = xattr
  }

  private static _create(
    op: LookupInOp,
    path: string | LookupInMacro,
    options?: { xattr?: boolean }
  ) {
    if (!options) {
      options = {}
    }

    let xattr = !!options.xattr

    if (path instanceof LookupInMacro) {
      path = path._value
      xattr = true
    }

    return new LookupInSpec(op, path, xattr)
  }

  /**
   * Creates a LookupInSpec for fetching a field from the document.
   *
   * @param path The path to the field.
   * @param options Optional parameters for this operation.
   * @param options.xattr
   * Whether this operation should reference the document body or the extended
   * attributes data for the document.
   */
  static get(
    path: string | LookupInMacro,
    options?: { xattr?: boolean }
  ): LookupInSpec {
    if (!path) {
      return this._create(LookupInOp.GetDoc, '', options)
    }
    return this._create(LookupInOp.Get, path, options)
  }

  /**
   * Returns whether a specific field exists in the document.
   *
   * @param path The path to the field.
   * @param options Optional parameters for this operation.
   * @param options.xattr
   * Whether this operation should reference the document body or the extended
   * attributes data for the document.
   */
  static exists(
    path: string | LookupInMacro,
    options?: { xattr?: boolean }
  ): LookupInSpec {
    return this._create(LookupInOp.Exists, path, options)
  }

  /**
   * Returns the number of elements in the array reference by the path.
   *
   * @param path The path to the field.
   * @param options Optional parameters for this operation.
   * @param options.xattr
   * Whether this operation should reference the document body or the extended
   * attributes data for the document.
   */
  static count(
    path: string | LookupInMacro,
    options?: { xattr?: boolean }
  ): LookupInSpec {
    return this._create(LookupInOp.Count, path, options)
  }
}

/**
 * Represents a sub-operation to perform within a mutate-in operation.
 *
 * @category Key-Value
 */
export class MutateInSpec {
  /**
   * BUG(JSCBC-756): Previously provided access to the document cas mutate
   * macro.
   *
   * @deprecated Use {@link MutateInMacro.Cas} instead.
   */
  static get CasPlaceholder(): MutateInMacro {
    return MutateInMacro.Cas
  }

  /**
   * @internal
   */
  _op: MutateInOp

  /**
   * @internal
   */
  _path: string

  /**
   * @internal
   */
  _xattr: boolean

  /**
   * @internal
   */
  _createPath: boolean

  /**
   * @internal
   */
  _expandMacros: boolean

  /**
   * @internal
   */
  _data: any

  private constructor(
    op: MutateInOp,
    path: string,
    flags: { xattr: boolean; createPath: boolean; expandMacros: boolean },
    data: any
  ) {
    this._op = op
    this._path = path
    this._xattr = flags.xattr
    this._createPath = flags.createPath
    this._expandMacros = flags.expandMacros
    this._data = data
  }

  private static _create(
    op: MutateInOp,
    path: string,
    value?: any | MutateInMacro,
    options?: {
      createPath?: boolean
      multi?: boolean
      xattr?: boolean
    }
  ) {
    if (!options) {
      options = {}
    }

    const flags = {
      xattr: !!options.xattr,
      createPath: !!options.createPath,
      expandMacros: false,
    }

    if (value instanceof MutateInMacro) {
      value = value._value
      flags.xattr = true
      flags.expandMacros = true
    }

    if (value !== undefined) {
      if (typeof value === 'bigint') {
        // Subdoc counter delta: emit the bigint as a bare integer literal to
        // preserve full 64-bit precision (JSON.stringify throws on a bigint).
        value = value.toString()
      } else if (!options.multi) {
        // BUG(JSCBC-755): As a solution to our oversight of not accepting arrays of
        // values to various sub-document operations, we have exposed an option instead.
        value = JSON.stringify(value)
      } else {
        if (!Array.isArray(value)) {
          throw new Error('value must be an array for a multi operation')
        }

        value = JSON.stringify(value)
        value = value.substr(1, value.length - 2)
      }
    }

    return new MutateInSpec(op, path, flags, value)
  }

  /**
   * Creates a MutateInSpec for inserting a field into the document.  Failing if
   * the field already exists at the specified path.
   *
   * @param path The path to the field.
   * @param value The value to insert.
   * @param options Optional parameters for this operation.
   * @param options.createPath
   * Whether or not the path to the field should be created if it does not
   * already exist.
   * @param options.xattr
   * Whether this operation should reference the document body or the extended
   * attributes data for the document.
   */
  static insert(
    path: string,
    value: any,
    options?: { createPath?: boolean; xattr?: boolean }
  ): MutateInSpec {
    return this._create(MutateInOp.Insert, path, value, options)
  }

  /**
   * Creates a MutateInSpec for upserting a field on a document.  This updates
   * the value of the specified field, or creates the field if it does not exits.
   *
   * @param path The path to the field.
   * @param value The value to write.
   * @param options Optional parameters for this operation.
   * @param options.createPath
   * Whether or not the path to the field should be created if it does not
   * already exist.
   * @param options.xattr
   * Whether this operation should reference the document body or the extended
   * attributes data for the document.
   */
  static upsert(
    path: string,
    value: any | MutateInMacro,
    options?: { createPath?: boolean; xattr?: boolean }
  ): MutateInSpec {
    if (!path) {
      return this._create(MutateInOp.SetDoc, '', value, options)
    }
    return this._create(MutateInOp.Upsert, path, value, options)
  }

  /**
   * Creates a MutateInSpec for replacing a field on a document.  This updates
   * the value of the specified field, failing if the field does not exits.
   *
   * @param path The path to the field.
   * @param value The value to write.
   * @param options Optional parameters for this operation.
   * @param options.xattr
   * Whether this operation should reference the document body or the extended
   * attributes data for the document.
   */
  static replace(
    path: string,
    value: any | MutateInMacro,
    options?: { xattr?: boolean }
  ): MutateInSpec {
    let opCode = MutateInOp.Replace

    // On an empty path we replace the whole document
    if (path.length === 0) {
      opCode = MutateInOp.SetDoc
    }

    return this._create(opCode, path, value, options)
  }

  /**
   * Creates a MutateInSpec for remove a field from a document.
   *
   * @param path The path to the field.
   * @param options Optional parameters for this operation.
   * @param options.xattr
   * Whether this operation should reference the document body or the extended
   * attributes data for the document.
   */
  static remove(path: string, options?: { xattr?: boolean }): MutateInSpec {
    if (!path) {
      return this._create(MutateInOp.RemoveDoc, '', undefined, options)
    }
    return this._create(MutateInOp.Remove, path, undefined, options)
  }

  /**
   * Creates a MutateInSpec for adding a value to the end of an array in a document.
   *
   * @param path The path to the field.
   * @param value The value to add.
   * @param options Optional parameters for this operation.
   * @param options.createPath
   * Whether or not the path to the field should be created if it does not
   * already exist.
   * @param options.multi
   * If set, this enables an array of values to be passed as value, and each
   * element of the passed array is added to the array.
   * @param options.xattr
   * Whether this operation should reference the document body or the extended
   * attributes data for the document.
   */
  static arrayAppend(
    path: string,
    value: any | MutateInMacro,
    options?: { createPath?: boolean; multi?: boolean; xattr?: boolean }
  ): MutateInSpec {
    return this._create(MutateInOp.ArrayAppend, path, value, options)
  }

  /**
   * Creates a MutateInSpec for adding a value to the beginning of an array in a document.
   *
   * @param path The path to the field.
   * @param value The value to add.
   * @param options Optional parameters for this operation.
   * @param options.createPath
   * Whether or not the path to the field should be created if it does not
   * already exist.
   * @param options.multi
   * If set, this enables an array of values to be passed as value, and each
   * element of the passed array is added to the array.
   * @param options.xattr
   * Whether this operation should reference the document body or the extended
   * attributes data for the document.
   */
  static arrayPrepend(
    path: string,
    value: any | MutateInMacro,
    options?: { createPath?: boolean; multi?: boolean; xattr?: boolean }
  ): MutateInSpec {
    return this._create(MutateInOp.ArrayPrepend, path, value, options)
  }

  /**
   * Creates a MutateInSpec for adding a value to a specified location in an array in a
   * document.  The path should specify a specific index in the array and the new values
   * are inserted at this location.
   *
   * @param path The path to an element of an array.
   * @param value The value to add.
   * @param options Optional parameters for this operation.
   * @param options.createPath
   * Whether or not the path to the field should be created if it does not
   * already exist.
   * @param options.multi
   * If set, this enables an array of values to be passed as value, and each
   * element of the passed array is added to the array.
   * @param options.xattr
   * Whether this operation should reference the document body or the extended
   * attributes data for the document.
   */
  static arrayInsert(
    path: string,
    value: any | MutateInMacro,
    options?: { createPath?: boolean; multi?: boolean; xattr?: boolean }
  ): MutateInSpec {
    return this._create(MutateInOp.ArrayInsert, path, value, options)
  }

  /**
   * Creates a MutateInSpec for adding unique values to an array in a document.  This
   * operation will only add values if they do not already exist elsewhere in the array.
   *
   * @param path The path to the field.
   * @param value The value to add.
   * @param options Optional parameters for this operation.
   * @param options.createPath
   * Whether or not the path to the field should be created if it does not
   * already exist.
   * @param options.multi
   * If set, this enables an array of values to be passed as value, and each
   * element of the passed array is added to the array.
   * @param options.xattr
   * Whether this operation should reference the document body or the extended
   * attributes data for the document.
   */
  static arrayAddUnique(
    path: string,
    value: any | MutateInMacro,
    options?: { createPath?: boolean; multi?: boolean; xattr?: boolean }
  ): MutateInSpec {
    return this._create(MutateInOp.ArrayAddUnique, path, value, options)
  }

  /**
   * Creates a MutateInSpec for incrementing the value of a field in a document.
   *
   * @param path The path to the field.
   * @param value The value to add.  A `bigint` may be provided for values above
   * `Number.MAX_SAFE_INTEGER` (2^53 - 1), carried through without loss of
   * precision.
   * @param options Optional parameters for this operation.
   * @param options.createPath
   * Whether or not the path to the field should be created if it does not
   * already exist.
   * @param options.xattr
   * Whether this operation should reference the document body or the extended
   * attributes data for the document.
   */
  static increment(
    path: string,
    value: number | bigint,
    options?: { createPath?: boolean; xattr?: boolean }
  ): MutateInSpec {
    // bigint is carried through exactly (see _create); the number path is unchanged.
    const delta = typeof value === 'bigint' ? value : +value
    return this._create(MutateInOp.Counter, path, delta, options)
  }

  /**
   * Creates a MutateInSpec for decrementing the value of a field in a document.
   *
   * @param path The path to the field.
   * @param value The value to subtract.  A `bigint` may be provided for values
   * above `Number.MAX_SAFE_INTEGER` (2^53 - 1), carried through without loss of
   * precision.
   * @param options Optional parameters for this operation.
   * @param options.createPath
   * Whether or not the path to the field should be created if it does not
   * already exist.
   * @param options.xattr
   * Whether this operation should reference the document body or the extended
   * attributes data for the document.
   */
  static decrement(
    path: string,
    value: number | bigint,
    options?: { createPath?: boolean; xattr?: boolean }
  ): MutateInSpec {
    // bigint is carried through exactly (see _create); the number path is unchanged.
    const delta = typeof value === 'bigint' ? -value : -1 * +value
    return this._create(MutateInOp.Counter, path, delta, options)
  }
}
