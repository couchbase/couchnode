const ReplicaMode = {
  All: -1,
  Any: 0,
  Replica1: 1,
  Replica2: 2,
  Replica3: 3,
};
module.exports.ReplicaMode = ReplicaMode;

const DurabilityLevel = {
  None: 0,
  Majority: 1,
  MajorityAndPersistOnMaster: 2,
  PersistToMajority: 3,
};
module.exports.DurabilityLevel = DurabilityLevel;

const BucketType = {
  Couchbase: 'membase',
  Memcached: 'memcached',
  Ephemeral: 'ephemeral',
};
module.exports.BucketType = BucketType;

const EvictionPolicy = {
  FullEviction: 'fullEviction',
  ValueOnly: 'valueOnly',
};
module.exports.EvictionPolicy = EvictionPolicy;

const CompressionMode = {
  Off: 'off',
  Passive: 'passive',
  Active: 'active',
};
module.exports.CompressionMode = CompressionMode;

const ConflictResolutionType = {
  Timestamp: 'lww',
  SequenceNumber: 'seqno',
};
module.exports.ConflictResolutionType = ConflictResolutionType;

const QueryProfile = {
  Off: 'off',
  Phases: 'phases',
  Timings: 'timings',
};
module.exports.QueryProfile = QueryProfile;

const QueryScanConsistency = {
  NotBounded: 'not_bounded',
  RequestPlus: 'request_plus',
};
module.exports.QueryScanConsistency = QueryScanConsistency;

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
