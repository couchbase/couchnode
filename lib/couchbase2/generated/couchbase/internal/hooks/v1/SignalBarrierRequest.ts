// Original file: couchbase/internal/hooks/v1/hooks.proto


/**
 * SignalBarrierRequest signals a barrier to release waiters.
 */
export interface SignalBarrierRequest {
  'hooks_context_id'?: (string);
  'barrier_id'?: (string);
  /**
   * When specified, only the waiter with this ID is released.
   */
  'wait_id'?: (string);
  '_wait_id'?: "wait_id";
}

/**
 * SignalBarrierRequest signals a barrier to release waiters.
 */
export interface SignalBarrierRequest__Output {
  'hooks_context_id': (string);
  'barrier_id': (string);
  /**
   * When specified, only the waiter with this ID is released.
   */
  'wait_id'?: (string);
  '_wait_id'?: "wait_id";
}
