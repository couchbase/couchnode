// Original file: couchbase/internal/hooks/v1/hooks.proto

import type { ValueRef as _couchbase_internal_hooks_v1_ValueRef, ValueRef__Output as _couchbase_internal_hooks_v1_ValueRef__Output } from '../../../../couchbase/internal/hooks/v1/ValueRef';
import type { ComparisonOperator as _couchbase_internal_hooks_v1_ComparisonOperator, ComparisonOperator__Output as _couchbase_internal_hooks_v1_ComparisonOperator__Output } from '../../../../couchbase/internal/hooks/v1/ComparisonOperator';

/**
 * HookCondition defines a comparison between two ValueRefs.
 */
export interface HookCondition {
  'left'?: (_couchbase_internal_hooks_v1_ValueRef | null);
  'op'?: (_couchbase_internal_hooks_v1_ComparisonOperator);
  'right'?: (_couchbase_internal_hooks_v1_ValueRef | null);
}

/**
 * HookCondition defines a comparison between two ValueRefs.
 */
export interface HookCondition__Output {
  'left': (_couchbase_internal_hooks_v1_ValueRef__Output | null);
  'op': (_couchbase_internal_hooks_v1_ComparisonOperator__Output);
  'right': (_couchbase_internal_hooks_v1_ValueRef__Output | null);
}
