'use strict';

const binding = require('./binding');
const enums = require('./enums');

/**
 *
 * @category Sub-Document
 */
class MutateInSpec {
  // BUG(JSCBC-756): Added backwards compatible access to the CAS placeholder.
  static get CasPlaceholder() {
    return enums.MutateInMacro.Cas;
  }

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

    if (value === enums.MutateInMacro.Cas) {
      value = '${document.CAS}';
      flags |= binding.LCB_SUBDOCSPECS_F_XATTR_MACROVALUES;
    } else if (value === enums.MutateInMacro.SeqNo) {
      value = '${document.seqno}';
      flags |= binding.LCB_SUBDOCSPECS_F_XATTR_MACROVALUES;
    } else if (value === enums.MutateInMacro.ValueCrc32c) {
      value = '${document.value_crc32c}';
      flags |= binding.LCB_SUBDOCSPECS_F_XATTR_MACROVALUES;
    }

    if (options.createPath) {
      flags |= binding.LCB_SUBDOCSPECS_F_MKINTERMEDIATES;
    }

    if (options.xattr) {
      flags |= binding.LCB_SUBDOCSPECS_F_XATTRPATH;
    }

    if (value !== undefined) {
      // BUG(JSCBC-755): As a solution to our oversight of not accepting arrays of
      // values to various sub-document operations, we have exposed an option instead.
      if (!options.multi) {
        value = JSON.stringify(value);
      } else {
        if (!Array.isArray(value)) {
          throw new Error('value must be an array for a multi operation');
        }

        value = JSON.stringify(value);
        value = value.substr(1, value.length - 2);
      }
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
   * @param {Object} [options]
   * @param {boolean} [options.createPath]
   *
   * @returns {MutateInSpec}
   */
  static insert(path, value, options) {
    return this._create(binding.LCBX_SDCMD_DICT_ADD, path, value, options);
  }

  /**
   *
   * @param {string} path
   * @param {*} value
   * @param {Object} [options]
   * @param {boolean} [options.createPath]
   *
   * @returns {MutateInSpec}
   */
  static upsert(path, value, options) {
    return this._create(binding.LCBX_SDCMD_DICT_UPSERT, path, value, options);
  }

  /**
   *
   * @param {string} path
   * @param {*} value
   * @param {Object} [options]
   * @param {boolean} [options.createPath]
   *
   * @returns {MutateInSpec}
   */
  static replace(path, value, options) {
    return this._create(binding.LCBX_SDCMD_REPLACE, path, value, options);
  }

  /**
   *
   * @param {string} path
   * @param {Object} [options]
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
   * @param {Object} [options]
   * @param {boolean} [options.createPath]
   * @param {boolean} [options.multi]
   *
   * @returns {MutateInSpec}
   */
  static arrayAppend(path, value, options) {
    return this._create(
      binding.LCBX_SDCMD_ARRAY_ADD_LAST,
      path,
      value,
      options
    );
  }

  /**
   *
   * @param {string} path
   * @param {*} value
   * @param {Object} [options]
   * @param {boolean} [options.createPath]
   * @param {boolean} [options.multi]
   *
   * @returns {MutateInSpec}
   */
  static arrayPrepend(path, value, options) {
    return this._create(
      binding.LCBX_SDCMD_ARRAY_ADD_FIRST,
      path,
      value,
      options
    );
  }

  /**
   *
   * @param {string} path
   * @param {*} value
   * @param {Object} [options]
   * @param {boolean} [options.createPath]
   * @param {boolean} [options.multi]
   *
   * @returns {MutateInSpec}
   */
  static arrayInsert(path, value, options) {
    return this._create(binding.LCBX_SDCMD_ARRAY_INSERT, path, value, options);
  }

  /**
   *
   * @param {string} path
   * @param {*} value
   * @param {Object} [options]
   * @param {boolean} [options.createPath]
   *
   * @returns {MutateInSpec}
   */
  static arrayAddUnique(path, value, options) {
    return this._create(
      binding.LCBX_SDCMD_ARRAY_ADD_UNIQUE,
      path,
      value,
      options
    );
  }

  /**
   *
   * @param {string} path
   * @param {number} value
   * @param {Object} [options]
   * @param {boolean} [options.createPath]
   *
   * @returns {MutateInSpec}
   */
  static increment(path, value, options) {
    return this._create(binding.LCBX_SDCMD_COUNTER, path, +value, options);
  }

  /**
   *
   * @param {string} path
   * @param {number} value
   * @param {Object} [options]
   * @param {boolean} [options.createPath]
   *
   * @returns {MutateInSpec}
   */
  static decrement(path, value, options) {
    return this._create(binding.LCBX_SDCMD_COUNTER, path, +value, options);
  }
}

module.exports = MutateInSpec;
