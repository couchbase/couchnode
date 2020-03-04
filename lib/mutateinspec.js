'use strict';

const binding = require('./binding');

class CasPlaceholder {}

/**
 *
 * @category Sub-Document
 */
class MutateInSpec {
  /**
   *
   */
  constructor() {
    this._op = -1;
    this._path = '';
    this._flags = 0;
    this._data = undefined;
  }

  static _create(opType, path, value, options) {
    if (!options) {
      options = {};
    }

    var flags = 0;

    if (value === CasPlaceholder) {
      value = '${document.cas}';
      flags |= binding.LCB_SUBDOCSPECS_F_XATTR_MACROVALUES;
    }

    if (options.createPath) {
      flags |= binding.LCB_SUBDOCSPECS_F_MKINTERMEDIATES;
    }

    if (options.xattr) {
      flags |= binding.LCB_SUBDOCSPECS_F_XATTRPATH;
    }

    var spec = new MutateInSpec();

    spec._op = opType;
    spec._path = path;
    spec._flags = flags;
    spec._data = value;

    return spec;
  }

  /**
   *
   * @param {string} path
   * @param {*} value
   * @param {*} [options]
   * @param {boolean} [options.createPath]
   *
   * @returns {MutateInSpec}
   */
  static insert(path, value, options) {
    return this._create(
      binding.LCBX_SDCMD_DICT_ADD,
      path,
      JSON.stringify(value),
      options
    );
  }

  /**
   *
   * @param {string} path
   * @param {*} value
   * @param {*} [options]
   * @param {boolean} [options.createPath]
   *
   * @returns {MutateInSpec}
   */
  static upsert(path, value, options) {
    return this._create(
      binding.LCBX_SDCMD_DICT_UPSERT,
      path,
      JSON.stringify(value),
      options
    );
  }

  /**
   *
   * @param {string} path
   * @param {*} value
   * @param {*} [options]
   * @param {boolean} [options.createPath]
   *
   * @returns {MutateInSpec}
   */
  static replace(path, value, options) {
    return this._create(
      binding.LCBX_SDCMD_REPLACE,
      path,
      JSON.stringify(value),
      options
    );
  }

  /**
   *
   * @param {string} path
   * @param {*} [options]
   *
   * @returns {MutateInSpec}
   */
  static remove(path, options) {
    return this._create(binding.LCBX_SDCMD_REMOVE, path, undefined, options);
  }

  /**
   *
   * @param {string} path
   * @param {*} value
   * @param {*} [options]
   * @param {boolean} [options.createPath]
   *
   * @returns {MutateInSpec}
   */
  static arrayAppend(path, value, options) {
    return this._create(
      binding.LCBX_SDCMD_ARRAY_ADD_LAST,
      path,
      JSON.stringify(value),
      options
    );
  }

  /**
   *
   * @param {string} path
   * @param {*} value
   * @param {*} [options]
   * @param {boolean} [options.createPath]
   *
   * @returns {MutateInSpec}
   */
  static arrayPrepend(path, value, options) {
    return this._create(
      binding.LCBX_SDCMD_ARRAY_ADD_FIRST,
      path,
      JSON.stringify(value),
      options
    );
  }

  /**
   *
   * @param {string} path
   * @param {*} value
   * @param {*} [options]
   * @param {boolean} [options.createPath]
   *
   * @returns {MutateInSpec}
   */
  static arrayInsert(path, value, options) {
    return this._create(
      binding.LCBX_SDCMD_ARRAY_INSERT,
      path,
      JSON.stringify(value),
      options
    );
  }

  /**
   *
   * @param {string} path
   * @param {*} value
   * @param {*} [options]
   * @param {boolean} [options.createPath]
   *
   * @returns {MutateInSpec}
   */
  static arrayAddUnique(path, value, options) {
    return this._create(
      binding.LCBX_SDCMD_ARRAY_ADD_UNIQUE,
      path,
      JSON.stringify(value),
      options
    );
  }

  /**
   *
   * @param {string} path
   * @param {integer} value
   * @param {*} [options]
   * @param {boolean} [options.createPath]
   *
   * @returns {MutateInSpec}
   */
  static increment(path, value, options) {
    return this._create(
      binding.LCBX_SDCMD_COUNTER,
      path,
      JSON.stringify(+value),
      options
    );
  }

  /**
   *
   * @param {string} path
   * @param {integer} value
   * @param {*} [options]
   * @param {boolean} [options.createPath]
   *
   * @returns {MutateInSpec}
   */
  static decrement(path, value, options) {
    return this._create(
      binding.LCBX_SDCMD_COUNTER,
      path,
      JSON.stringify(+value),
      options
    );
  }
}

MutateInSpec.CasPlaceholder = CasPlaceholder;

module.exports = MutateInSpec;
