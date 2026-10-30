// Original file: couchbase/internal/hooks/v1/hooks.proto

import type { Hook as _couchbase_internal_hooks_v1_Hook, Hook__Output as _couchbase_internal_hooks_v1_Hook__Output } from '../../../../couchbase/internal/hooks/v1/Hook';

/**
 * AddHooksRequest registers hooks within a context.
 */
export interface AddHooksRequest {
  'hooks_context_id'?: (string);
  'hooks'?: (_couchbase_internal_hooks_v1_Hook)[];
}

/**
 * AddHooksRequest registers hooks within a context.
 */
export interface AddHooksRequest__Output {
  'hooks_context_id': (string);
  'hooks': (_couchbase_internal_hooks_v1_Hook__Output)[];
}
