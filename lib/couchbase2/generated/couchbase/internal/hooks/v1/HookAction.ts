// Original file: couchbase/internal/hooks/v1/hooks.proto

import type { HookCondition as _couchbase_internal_hooks_v1_HookCondition, HookCondition__Output as _couchbase_internal_hooks_v1_HookCondition__Output } from '../../../../couchbase/internal/hooks/v1/HookCondition';
import type { HookAction as _couchbase_internal_hooks_v1_HookAction, HookAction__Output as _couchbase_internal_hooks_v1_HookAction__Output } from '../../../../couchbase/internal/hooks/v1/HookAction';
import type { Any as _google_protobuf_Any, Any__Output as _google_protobuf_Any__Output } from '../../../../google/protobuf/Any';
import type { Long } from '@grpc/proto-loader';

/**
 * Counter increments or decrements a named counter.
 */
export interface _couchbase_internal_hooks_v1_HookAction_Counter {
  'counter_id'?: (string);
  'delta'?: (number | string | Long);
}

/**
 * Counter increments or decrements a named counter.
 */
export interface _couchbase_internal_hooks_v1_HookAction_Counter__Output {
  'counter_id': (string);
  'delta': (string);
}

/**
 * Execute proceeds with normal RPC execution (passthrough).
 */
export interface _couchbase_internal_hooks_v1_HookAction_Execute {
}

/**
 * Execute proceeds with normal RPC execution (passthrough).
 */
export interface _couchbase_internal_hooks_v1_HookAction_Execute__Output {
}

/**
 * If conditionally executes actions based on conditions.
 */
export interface _couchbase_internal_hooks_v1_HookAction_If {
  'cond'?: (_couchbase_internal_hooks_v1_HookCondition)[];
  /**
   * Actions when all conditions are true.
   */
  'match'?: (_couchbase_internal_hooks_v1_HookAction)[];
  /**
   * Actions when any condition is false.
   */
  'no_match'?: (_couchbase_internal_hooks_v1_HookAction)[];
}

/**
 * If conditionally executes actions based on conditions.
 */
export interface _couchbase_internal_hooks_v1_HookAction_If__Output {
  'cond': (_couchbase_internal_hooks_v1_HookCondition__Output)[];
  /**
   * Actions when all conditions are true.
   */
  'match': (_couchbase_internal_hooks_v1_HookAction__Output)[];
  /**
   * Actions when any condition is false.
   */
  'no_match': (_couchbase_internal_hooks_v1_HookAction__Output)[];
}

/**
 * ReturnError short-circuits the RPC and returns a gRPC error.
 */
export interface _couchbase_internal_hooks_v1_HookAction_ReturnError {
  'code'?: (number);
  'message'?: (string);
  'details'?: (_google_protobuf_Any)[];
}

/**
 * ReturnError short-circuits the RPC and returns a gRPC error.
 */
export interface _couchbase_internal_hooks_v1_HookAction_ReturnError__Output {
  'code': (number);
  'message': (string);
  'details': (_google_protobuf_Any__Output)[];
}

/**
 * ReturnResponse short-circuits the RPC and returns a custom response.
 */
export interface _couchbase_internal_hooks_v1_HookAction_ReturnResponse {
  'value'?: (_google_protobuf_Any | null);
}

/**
 * ReturnResponse short-circuits the RPC and returns a custom response.
 */
export interface _couchbase_internal_hooks_v1_HookAction_ReturnResponse__Output {
  'value': (_google_protobuf_Any__Output | null);
}

/**
 * SignalBarrier signals a named barrier to release waiters.
 */
export interface _couchbase_internal_hooks_v1_HookAction_SignalBarrier {
  'barrier_id'?: (string);
  'signal_all'?: (boolean);
}

/**
 * SignalBarrier signals a named barrier to release waiters.
 */
export interface _couchbase_internal_hooks_v1_HookAction_SignalBarrier__Output {
  'barrier_id': (string);
  'signal_all': (boolean);
}

/**
 * WaitOnBarrier pauses execution until the named barrier is signaled.
 */
export interface _couchbase_internal_hooks_v1_HookAction_WaitOnBarrier {
  'barrier_id'?: (string);
}

/**
 * WaitOnBarrier pauses execution until the named barrier is signaled.
 */
export interface _couchbase_internal_hooks_v1_HookAction_WaitOnBarrier__Output {
  'barrier_id': (string);
}

/**
 * HookAction defines a single action in the hook execution pipeline.
 * Actions form a small DSL for test control flow.
 */
export interface HookAction {
  'if'?: (_couchbase_internal_hooks_v1_HookAction_If | null);
  'counter'?: (_couchbase_internal_hooks_v1_HookAction_Counter | null);
  'wait_on_barrier'?: (_couchbase_internal_hooks_v1_HookAction_WaitOnBarrier | null);
  'signal_barrier'?: (_couchbase_internal_hooks_v1_HookAction_SignalBarrier | null);
  'return_response'?: (_couchbase_internal_hooks_v1_HookAction_ReturnResponse | null);
  'return_error'?: (_couchbase_internal_hooks_v1_HookAction_ReturnError | null);
  'execute'?: (_couchbase_internal_hooks_v1_HookAction_Execute | null);
  /**
   * Exactly one action type must be set.
   */
  'action'?: "if"|"counter"|"wait_on_barrier"|"signal_barrier"|"return_response"|"return_error"|"execute";
}

/**
 * HookAction defines a single action in the hook execution pipeline.
 * Actions form a small DSL for test control flow.
 */
export interface HookAction__Output {
  'if'?: (_couchbase_internal_hooks_v1_HookAction_If__Output | null);
  'counter'?: (_couchbase_internal_hooks_v1_HookAction_Counter__Output | null);
  'wait_on_barrier'?: (_couchbase_internal_hooks_v1_HookAction_WaitOnBarrier__Output | null);
  'signal_barrier'?: (_couchbase_internal_hooks_v1_HookAction_SignalBarrier__Output | null);
  'return_response'?: (_couchbase_internal_hooks_v1_HookAction_ReturnResponse__Output | null);
  'return_error'?: (_couchbase_internal_hooks_v1_HookAction_ReturnError__Output | null);
  'execute'?: (_couchbase_internal_hooks_v1_HookAction_Execute__Output | null);
  /**
   * Exactly one action type must be set.
   */
  'action'?: "if"|"counter"|"wait_on_barrier"|"signal_barrier"|"return_response"|"return_error"|"execute";
}
