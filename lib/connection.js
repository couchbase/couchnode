'use strict';

/**
 * @class Connection
 *
 * Connection object exposed for backwards compatability with previous
 * versions of the Node.js SDK.
 *
 * @deprecated
 */
function Connection() {
}

var Bucket = require('./bucket');
module.exports = Bucket;
