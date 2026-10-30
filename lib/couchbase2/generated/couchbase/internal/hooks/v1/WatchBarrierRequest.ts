// Original file: couchbase/internal/hooks/v1/hooks.proto


/**
 * WatchBarrierRequest opens a stream for a specific barrier.
 */
export interface WatchBarrierRequest {
  'hooks_context_id'?: (string);
  'barrier_id'?: (string);
}

/**
 * WatchBarrierRequest opens a stream for a specific barrier.
 */
export interface WatchBarrierRequest__Output {
  'hooks_context_id': (string);
  'barrier_id': (string);
}
