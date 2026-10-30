// Original file: couchbase/internal/xdcr/v1/xdcr.proto


/**
 * Collection describes a single collection within a scope.
 */
export interface _couchbase_internal_xdcr_v1_WatchCollectionsResponse_Collection {
  /**
   * The numeric collection ID.
   */
  'collection_id'?: (number);
  /**
   * The collection name.
   */
  'collection_name'?: (string);
}

/**
 * Collection describes a single collection within a scope.
 */
export interface _couchbase_internal_xdcr_v1_WatchCollectionsResponse_Collection__Output {
  /**
   * The numeric collection ID.
   */
  'collection_id': (number);
  /**
   * The collection name.
   */
  'collection_name': (string);
}

/**
 * Scope describes a scope and its collections.
 */
export interface _couchbase_internal_xdcr_v1_WatchCollectionsResponse_Scope {
  /**
   * The numeric scope ID.
   */
  'scope_id'?: (number);
  /**
   * The scope name.
   */
  'scope_name'?: (string);
  'collections'?: (_couchbase_internal_xdcr_v1_WatchCollectionsResponse_Collection)[];
}

/**
 * Scope describes a scope and its collections.
 */
export interface _couchbase_internal_xdcr_v1_WatchCollectionsResponse_Scope__Output {
  /**
   * The numeric scope ID.
   */
  'scope_id': (number);
  /**
   * The scope name.
   */
  'scope_name': (string);
  'collections': (_couchbase_internal_xdcr_v1_WatchCollectionsResponse_Collection__Output)[];
}

/**
 * WatchCollectionsResponse contains the current collection manifest.
 */
export interface WatchCollectionsResponse {
  /**
   * The manifest UID for this version of the collection configuration.
   */
  'manifest_uid'?: (number);
  'scopes'?: (_couchbase_internal_xdcr_v1_WatchCollectionsResponse_Scope)[];
}

/**
 * WatchCollectionsResponse contains the current collection manifest.
 */
export interface WatchCollectionsResponse__Output {
  /**
   * The manifest UID for this version of the collection configuration.
   */
  'manifest_uid': (number);
  'scopes': (_couchbase_internal_xdcr_v1_WatchCollectionsResponse_Scope__Output)[];
}
