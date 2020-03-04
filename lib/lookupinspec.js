'use strict';

const binding = require('./binding');

var DOCUMENT_EXPIRY_MARKER = {};

/**
 *
 * @category Sub-Document
 */
class LookupInSpec {
  /**
   *
   */
  constructor() {
    this._op = -1;
    this._path = '';
    this._flags = 0;
  }

  /**
   *
   */
  static get Expiry() {
    return DOCUMENT_EXPIRY_MARKER;
  }

  static _create(opType, path, options) {
    if (!options) {
      options = {};
    }

    var flags = 0;

    if (path === DOCUMENT_EXPIRY_MARKER) {
      path = '$document.exptime';
      flags |= binding.LCB_SUBDOCSPECS_F_XATTRPATH;
    }

    if (options.xattr) {
      flags |= binding.LCB_SUBDOCSPECS_F_XATTRPATH;
    }

    var spec = new LookupInSpec();

    spec._op = opType;
    spec._path = path;
    spec._flags = flags;

    return spec;
  }

  /**
   *
   * @param {string} path
   * @param {*} [options]
   *
   * @returns {LookupInSpec}
   */
  static get(path, options) {
    return this._create(binding.LCBX_SDCMD_GET, path, options);
  }

  /**
   *
   * @param {string} path
   * @param {*} [options]
   *
   * @returns {LookupInSpec}
   */
  static exists(path, options) {
    return this._create(binding.LCBX_SDCMD_EXISTS, path, options);
  }

  /**
   *
   * @param {string} path
   * @param {*} [options]
   *
   * @returns {LookupInSpec}
   */
  static count(path, options) {
    return this._create(binding.LCBX_SDCMD_GET_COUNT, path, options);
  }
}

module.exports = LookupInSpec;
