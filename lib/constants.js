'use strict';

/**
 * Enum representing the different services inside a Couchbase cluster.
 *
 * @readonly
 * @enum {string}
 *
 * @since 2.4.4
 * @uncommitted
 */
var ServiceType = {
  KeyValue: 'kv',
  Views: 'view',
  Query: 'query',
  Search: 'search',
  Analytics: 'analytics'
};

module.exports.ServiceType = ServiceType;
