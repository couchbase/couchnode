// Original file: couchbase/kv/v1/kv.proto

import type { CompressionEnabled as _couchbase_kv_v1_CompressionEnabled, CompressionEnabled__Output as _couchbase_kv_v1_CompressionEnabled__Output } from '../../../couchbase/kv/v1/CompressionEnabled';

/**
 * GetRequest retrieves a document by its key.
 */
export interface GetRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  /**
   * Optional list of JSON field paths to project. When specified, only
   * the requested fields are returned instead of the full document.
   */
  'project'?: (string)[];
  /**
   * Controls whether compressed content may be returned.
   */
  'compression'?: (_couchbase_kv_v1_CompressionEnabled);
  '_compression'?: "compression";
}

/**
 * GetRequest retrieves a document by its key.
 */
export interface GetRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  /**
   * Optional list of JSON field paths to project. When specified, only
   * the requested fields are returned instead of the full document.
   */
  'project': (string)[];
  /**
   * Controls whether compressed content may be returned.
   */
  'compression'?: (_couchbase_kv_v1_CompressionEnabled__Output);
  '_compression'?: "compression";
}
