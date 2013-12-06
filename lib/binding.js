'use strict';

/**
 * Attempts to load a binding by path ignoring not-found errors.
 *
 * @param {string} path The path to the binding to attempt loading.
 * @returns {Object}
 *
 * @ignore
 */
function tryLoadBinding(path) {
  try {
    return require('bindings')(path);
  } catch(e) {
    if (!e.message.match(/Could not load the bindings file/) &&
        !e.message.match(/invalid ELF/)) {
      throw e;
    }
  }
  return null;
}

/**
 * @type {{CouchbaseImpl:Object,Constants:Object}}
 * @ignore
 */
var couchnode = tryLoadBinding('couchbase_impl');
if (!couchnode) {
  // Try to load prebuilt windows binaries
  if (process.arch === 'x64') {
    couchnode = tryLoadBinding('../prebuilt/win/x64/couchbase_impl');
  } else if (process.arch === 'ia32') {
    couchnode = tryLoadBinding('../prebuilt/win/ia32/couchbase_impl');
  }
}
if (!couchnode) {
  throw new Error('Failed to locate couchnode native binding');
}

module.exports = couchnode;
