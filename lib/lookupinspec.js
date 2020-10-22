'use strict';

const binding = require('./binding');
const enums = require('./enums');

/**
 *
 * @category Sub-Document
 */
class LookupInSpec {
  // BUG(JSCBC-756): Added backwards compatible access to the Expiry placeholder.
  static get Expiry() {
    return enums.LookupInMacro.Expiry;
  }

  /**
   *
   */
  constructor() {
    this._op = -1;
    this._path = '';
    this._flags = 0;
  }

  static _create(opType, path, options) {
    if (!options) {
      options = {};
    }

    var flags = 0;

    if (path === enums.LookupInMacro.Document) {
      path = '$document';
      flags |= binding.LCB_SUBDOCSPECS_F_XATTRPATH;
    } else if (path === enums.LookupInMacro.Expiry) {
      path = '$document.exptime';
      flags |= binding.LCB_SUBDOCSPECS_F_XATTRPATH;
    } else if (path === enums.LookupInMacro.Cas) {
      path = '$document.CAS';
      flags |= binding.LCB_SUBDOCSPECS_F_XATTRPATH;
    } else if (path === enums.LookupInMacro.SeqNo) {
      path = '$document.seqno';
      flags |= binding.LCB_SUBDOCSPECS_F_XATTRPATH;
    } else if (path === enums.LookupInMacro.LastModified) {
      path = '$document.last_modified';
      flags |= binding.LCB_SUBDOCSPECS_F_XATTRPATH;
    } else if (path === enums.LookupInMacro.IsDeleted) {
      path = '$document.deleted';
      flags |= binding.LCB_SUBDOCSPECS_F_XATTRPATH;
    } else if (path === enums.LookupInMacro.ValueSizeBytes) {
      path = '$document.value_bytes';
      flags |= binding.LCB_SUBDOCSPECS_F_XATTRPATH;
    } else if (path === enums.LookupInMacro.RevId) {
      path = '$document.revid';
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
   * @param {Object} [options]
   *
   * @returns {LookupInSpec}
   */
  static get(path, options) {
    return this._create(binding.LCBX_SDCMD_GET, path, options);
  }

  /**
   *
   * @param {string} path
   * @param {Object} [options]
   *
   * @returns {LookupInSpec}
   */
  static exists(path, options) {
    return this._create(binding.LCBX_SDCMD_EXISTS, path, options);
  }

  /**
   *
   * @param {string} path
   * @param {Object} [options]
   *
   * @returns {LookupInSpec}
   */
  static count(path, options) {
    return this._create(binding.LCBX_SDCMD_GET_COUNT, path, options);
  }
}

module.exports = LookupInSpec;
