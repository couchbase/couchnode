// Original file: couchbase/kv/v1/kv.proto


/**
 * Flags for this individual spec.
 */
export interface _couchbase_kv_v1_LookupInRequest_Spec_Flags {
  /**
   * When true, operate on an extended attribute (xattr) rather
   * than the document body.
   */
  'xattr'?: (boolean);
  '_xattr'?: "xattr";
}

/**
 * Flags for this individual spec.
 */
export interface _couchbase_kv_v1_LookupInRequest_Spec_Flags__Output {
  /**
   * When true, operate on an extended attribute (xattr) rather
   * than the document body.
   */
  'xattr'?: (boolean);
  '_xattr'?: "xattr";
}

/**
 * Document-level flags.
 */
export interface _couchbase_kv_v1_LookupInRequest_Flags {
  /**
   * When true, allow lookups on deleted (tombstoned) documents.
   */
  'access_deleted'?: (boolean);
  '_access_deleted'?: "access_deleted";
}

/**
 * Document-level flags.
 */
export interface _couchbase_kv_v1_LookupInRequest_Flags__Output {
  /**
   * When true, allow lookups on deleted (tombstoned) documents.
   */
  'access_deleted'?: (boolean);
  '_access_deleted'?: "access_deleted";
}

// Original file: couchbase/kv/v1/kv.proto

/**
 * The type of sub-document lookup to perform.
 */
export const _couchbase_kv_v1_LookupInRequest_Spec_Operation = {
  /**
   * Retrieve the value at the specified path.
   */
  OPERATION_GET: 'OPERATION_GET',
  /**
   * Check whether a value exists at the specified path.
   */
  OPERATION_EXISTS: 'OPERATION_EXISTS',
  /**
   * Count the number of elements in an array or keys in an object
   * at the specified path.
   */
  OPERATION_COUNT: 'OPERATION_COUNT',
} as const;

/**
 * The type of sub-document lookup to perform.
 */
export type _couchbase_kv_v1_LookupInRequest_Spec_Operation =
  /**
   * Retrieve the value at the specified path.
   */
  | 'OPERATION_GET'
  | 0
  /**
   * Check whether a value exists at the specified path.
   */
  | 'OPERATION_EXISTS'
  | 1
  /**
   * Count the number of elements in an array or keys in an object
   * at the specified path.
   */
  | 'OPERATION_COUNT'
  | 2

/**
 * The type of sub-document lookup to perform.
 */
export type _couchbase_kv_v1_LookupInRequest_Spec_Operation__Output = typeof _couchbase_kv_v1_LookupInRequest_Spec_Operation[keyof typeof _couchbase_kv_v1_LookupInRequest_Spec_Operation]

/**
 * Spec defines a single sub-document lookup operation.
 */
export interface _couchbase_kv_v1_LookupInRequest_Spec {
  'operation'?: (_couchbase_kv_v1_LookupInRequest_Spec_Operation);
  /**
   * The JSON path to operate on (e.g., "address.city" or "tags[0]").
   */
  'path'?: (string);
  'flags'?: (_couchbase_kv_v1_LookupInRequest_Spec_Flags | null);
  '_flags'?: "flags";
}

/**
 * Spec defines a single sub-document lookup operation.
 */
export interface _couchbase_kv_v1_LookupInRequest_Spec__Output {
  'operation': (_couchbase_kv_v1_LookupInRequest_Spec_Operation__Output);
  /**
   * The JSON path to operate on (e.g., "address.city" or "tags[0]").
   */
  'path': (string);
  'flags'?: (_couchbase_kv_v1_LookupInRequest_Spec_Flags__Output | null);
  '_flags'?: "flags";
}

/**
 * LookupInRequest performs sub-document read operations on a JSON document.
 * Multiple lookup specs can be executed atomically in a single request.
 */
export interface LookupInRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  /**
   * The list of sub-document lookup operations to perform.
   */
  'specs'?: (_couchbase_kv_v1_LookupInRequest_Spec)[];
  'flags'?: (_couchbase_kv_v1_LookupInRequest_Flags | null);
  '_flags'?: "flags";
}

/**
 * LookupInRequest performs sub-document read operations on a JSON document.
 * Multiple lookup specs can be executed atomically in a single request.
 */
export interface LookupInRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  /**
   * The list of sub-document lookup operations to perform.
   */
  'specs': (_couchbase_kv_v1_LookupInRequest_Spec__Output)[];
  'flags'?: (_couchbase_kv_v1_LookupInRequest_Flags__Output | null);
  '_flags'?: "flags";
}
