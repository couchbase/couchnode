'use strict';

/**
 * @typedef {Object} Cas
 */

/**
 * @typedef {Object} MutationToken
 */

/**
 * Represents the C/C++ binding layer that the Node.js SDK is built upon.
 * This library handles all network I/O along with most configuration and
 * bootstrapping requirements.
 *
 * @typedef {Object} CouchbaseBinding
 * @private
 * @ignore
 */

/**
 * @type {CouchbaseBinding}
 * @private
 */
var couchnode = require('bindings')('couchbase_impl');

module.exports = couchnode;
