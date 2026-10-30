// Original file: couchbase/internal/hooks/v1/hooks.proto

import type { HookAction as _couchbase_internal_hooks_v1_HookAction, HookAction__Output as _couchbase_internal_hooks_v1_HookAction__Output } from '../../../../couchbase/internal/hooks/v1/HookAction';

/**
 * Hook defines a named hook targeting a gRPC method with a pipeline of actions.
 */
export interface Hook {
  /**
   * A descriptive name for this hook.
   */
  'name'?: (string);
  /**
   * A human-readable description of what this hook does.
   */
  'description'?: (string);
  /**
   * The full gRPC method name to intercept (e.g.,
   * "/couchbase.kv.v1.KvService/Get").
   */
  'target_method'?: (string);
  /**
   * The ordered list of actions to execute when the method is called.
   */
  'actions'?: (_couchbase_internal_hooks_v1_HookAction)[];
}

/**
 * Hook defines a named hook targeting a gRPC method with a pipeline of actions.
 */
export interface Hook__Output {
  /**
   * A descriptive name for this hook.
   */
  'name': (string);
  /**
   * A human-readable description of what this hook does.
   */
  'description': (string);
  /**
   * The full gRPC method name to intercept (e.g.,
   * "/couchbase.kv.v1.KvService/Get").
   */
  'target_method': (string);
  /**
   * The ordered list of actions to execute when the method is called.
   */
  'actions': (_couchbase_internal_hooks_v1_HookAction__Output)[];
}
