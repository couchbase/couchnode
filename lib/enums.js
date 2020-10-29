'use strict';

/**
 * @readonly
 * @enum {number}
 */
const DurabilityLevel = {
  None: 0,
  Majority: 1,
  MajorityAndPersistOnMaster: 2,
  PersistToMajority: 3,
};
module.exports.DurabilityLevel = DurabilityLevel;

/**
 * @readonly
 * @enum {string}
 *
 * @category Management
 */
const BucketType = {
  Couchbase: 'membase',
  Memcached: 'memcached',
  Ephemeral: 'ephemeral',
};
module.exports.BucketType = BucketType;

/**
 * @readonly
 * @enum {string}
 *
 * @category Management
 */
const EvictionPolicy = {
  FullEviction: 'fullEviction',
  ValueOnly: 'valueOnly',
  NotRecentlyUsed: 'nruEviction',
  NoEviction: 'noEviction',
};
module.exports.EvictionPolicy = EvictionPolicy;

/**
 * @readonly
 * @enum {string}
 *
 * @category Management
 */
const CompressionMode = {
  Off: 'off',
  Passive: 'passive',
  Active: 'active',
};
module.exports.CompressionMode = CompressionMode;

/**
 * @readonly
 * @enum {string}
 *
 * @category Management
 */
const ConflictResolutionType = {
  Timestamp: 'lww',
  SequenceNumber: 'seqno',
};
module.exports.ConflictResolutionType = ConflictResolutionType;

/**
 * @readonly
 * @enum {string}
 */
const QueryProfileMode = {
  Off: 'off',
  Phases: 'phases',
  Timings: 'timings',
};
module.exports.QueryProfileMode = QueryProfileMode;

/**
 * @readonly
 * @enum {string}
 */
const QueryScanConsistency = {
  NotBounded: 'not_bounded',
  RequestPlus: 'request_plus',
};
module.exports.QueryScanConsistency = QueryScanConsistency;

/**
 * @readonly
 * @enum {string}
 */
const QueryStatus = {
  Running: 'running',
  Success: 'success',
  Errors: 'errors',
  Completed: 'completed',
  Stopped: 'stopped',
  Timeout: 'timeout',
  Closed: 'closed',
  Fatal: 'fatal',
  Aborted: 'aborted',
  Unknown: 'unknown',
};
module.exports.QueryStatus = QueryStatus;

/**
 * @readonly
 * @enum {string}
 */
const AnalyticsScanConsistency = {
  NotBounded: 'not_bounded',
  RequestPlus: 'request_plus',
};
module.exports.AnalyticsScanConsistency = AnalyticsScanConsistency;

/**
 * @readonly
 * @enum {string}
 */
const AnalyticsStatus = {
  Running: 'running',
  Success: 'success',
  Errors: 'errors',
  Completed: 'completed',
  Stopped: 'stopped',
  Timeout: 'timeout',
  Closed: 'closed',
  Fatal: 'fatal',
  Aborted: 'aborted',
  Unknown: 'unknown',
};
module.exports.AnalyticsStatus = AnalyticsStatus;

/**
 * @readonly
 * @enum {string}
 */
const IndexType = {
  Gsi: 'gsi',
  View: 'view',
  Unknown: '',
};
module.exports.IndexType = IndexType;

/**
 * @readonly
 * @enum {string}
 */
const HighlightStyle = {
  HTML: 'html',
  ANSI: 'ansi',
};
module.exports.HighlightStyle = HighlightStyle;

/**
 * @readonly
 * @enum {string}
 */
const ViewScanConsistency = {
  RequestPlus: 'false',
  UpdateAfter: 'update_after',
  NotBounded: 'ok',
};
module.exports.ViewScanConsistency = ViewScanConsistency;

/**
 * @readonly
 * @enum {string}
 */
const ViewOrdering = {
  Ascending: 'false',
  Descending: 'true',
};
module.exports.ViewOrderMode = ViewOrdering;
module.exports.ViewOrdering = ViewOrdering;

/**
 * @readonly
 * @enum {string}
 */
const ViewErrorMode = {
  Continue: 'continue',
  Stop: 'stop',
};
module.exports.ViewErrorMode = ViewErrorMode;

/**
 * @readonly
 * @enum {string}
 */
const SearchScanConsistency = {
  NotBounded: '',
};
module.exports.SearchScanConsistency = SearchScanConsistency;

/**
 * @readonly
 * @enum {Object}
 */
const LookupInMacro = {
  Document: {},
  Expiry: {},
  Cas: {},
  SeqNo: {},
  LastModified: {},
  IsDeleted: {},
  ValueSizeBytes: {},
  RevId: {},
};
module.exports.LookupInMacro = LookupInMacro;

/**
 * @readonly
 * @enum {Object}
 */
const MutateInMacro = {
  Cas: {},
  SeqNo: {},
  ValueCrc32c: {},
};
module.exports.MutateInMacro = MutateInMacro;

/**
 * @readonly
 * @enum {Object}
 */
const ServiceType = {
  KeyValue: 'kv',
  Management: 'mgmt',
  Views: 'views',
  Query: 'query',
  Search: 'search',
  Analytics: 'analytics',
};
module.exports.ServiceType = ServiceType;
