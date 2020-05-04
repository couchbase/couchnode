'use strict';

/**
 *
 */
const DurabilityLevel = {
  None: 0,
  Majority: 1,
  MajorityAndPersistOnMaster: 2,
  PersistToMajority: 3,
};
module.exports.DurabilityLevel = DurabilityLevel;

/**
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
 *
 * @category Management
 */
const EvictionPolicy = {
  FullEviction: 'fullEviction',
  ValueOnly: 'valueOnly',
};
module.exports.EvictionPolicy = EvictionPolicy;

/**
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
 *
 * @category Management
 */
const ConflictResolutionType = {
  Timestamp: 'lww',
  SequenceNumber: 'seqno',
};
module.exports.ConflictResolutionType = ConflictResolutionType;

/**
 *
 */
const QueryProfileMode = {
  Off: 'off',
  Phases: 'phases',
  Timings: 'timings',
};
module.exports.QueryProfileMode = QueryProfileMode;

/**
 *
 */
const QueryScanConsistency = {
  NotBounded: 'not_bounded',
  RequestPlus: 'request_plus',
};
module.exports.QueryScanConsistency = QueryScanConsistency;

/**
 *
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
 *
 */
const AnalyticsScanConsistency = {
  NotBounded: 'not_bounded',
  RequestPlus: 'request_plus',
};
module.exports.AnalyticsScanConsistency = AnalyticsScanConsistency;

/**
 *
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

const IndexType = {
  Gsi: 'gsi',
  View: 'view',
  Unknown: '',
};
module.exports.IndexType = IndexType;

const HighlightStyle = {
  HTML: 'html',
  ANSI: 'ansi',
};
module.exports.HighlightStyle = HighlightStyle;
