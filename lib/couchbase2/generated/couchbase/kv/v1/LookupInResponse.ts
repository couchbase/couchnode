// Original file: couchbase/kv/v1/kv.proto

import type { Status as _google_rpc_Status, Status__Output as _google_rpc_Status__Output } from '../../../google/rpc/Status';
import type { Long } from '@grpc/proto-loader';

/**
 * Spec contains the result for a single lookup operation.
 */
export interface _couchbase_kv_v1_LookupInResponse_Spec {
  /**
   * The status of this individual lookup operation. A non-OK status
   * indicates the path was not found or another path-level error.
   */
  'status'?: (_google_rpc_Status | null);
  /**
   * The content retrieved from the path, if the operation succeeded.
   */
  'content'?: (Buffer | Uint8Array | string);
}

/**
 * Spec contains the result for a single lookup operation.
 */
export interface _couchbase_kv_v1_LookupInResponse_Spec__Output {
  /**
   * The status of this individual lookup operation. A non-OK status
   * indicates the path was not found or another path-level error.
   */
  'status': (_google_rpc_Status__Output | null);
  /**
   * The content retrieved from the path, if the operation succeeded.
   */
  'content': (Buffer);
}

/**
 * LookupInResponse contains the results of sub-document lookup operations.
 */
export interface LookupInResponse {
  /**
   * Results corresponding 1:1 to the specs in the request.
   */
  'specs'?: (_couchbase_kv_v1_LookupInResponse_Spec)[];
  /**
   * The document's CAS at the time of the lookup.
   */
  'cas'?: (number | string | Long);
}

/**
 * LookupInResponse contains the results of sub-document lookup operations.
 */
export interface LookupInResponse__Output {
  /**
   * Results corresponding 1:1 to the specs in the request.
   */
  'specs': (_couchbase_kv_v1_LookupInResponse_Spec__Output)[];
  /**
   * The document's CAS at the time of the lookup.
   */
  'cas': (string);
}
