// Original file: couchbase/admin/collection/v1/collection.proto

import type { Long } from '@grpc/proto-loader';

/**
 * Collection describes a single collection within a scope.
 */
export interface _couchbase_admin_collection_v1_ListCollectionsResponse_Collection {
  'name'?: (string);
  /**
   * Maximum document expiry in seconds. 0 means no maximum.
   */
  'max_expiry_secs'?: (number);
  /**
   * Whether change history retention is enabled for this collection.
   */
  'history_retention_enabled'?: (boolean);
  '_max_expiry_secs'?: "max_expiry_secs";
  '_history_retention_enabled'?: "history_retention_enabled";
}

/**
 * Collection describes a single collection within a scope.
 */
export interface _couchbase_admin_collection_v1_ListCollectionsResponse_Collection__Output {
  'name': (string);
  /**
   * Maximum document expiry in seconds. 0 means no maximum.
   */
  'max_expiry_secs'?: (number);
  /**
   * Whether change history retention is enabled for this collection.
   */
  'history_retention_enabled'?: (boolean);
  '_max_expiry_secs'?: "max_expiry_secs";
  '_history_retention_enabled'?: "history_retention_enabled";
}

/**
 * Scope describes a scope and its collections.
 */
export interface _couchbase_admin_collection_v1_ListCollectionsResponse_Scope {
  'name'?: (string);
  'collections'?: (_couchbase_admin_collection_v1_ListCollectionsResponse_Collection)[];
}

/**
 * Scope describes a scope and its collections.
 */
export interface _couchbase_admin_collection_v1_ListCollectionsResponse_Scope__Output {
  'name': (string);
  'collections': (_couchbase_admin_collection_v1_ListCollectionsResponse_Collection__Output)[];
}

/**
 * ListCollectionsResponse contains the scope/collection hierarchy.
 */
export interface ListCollectionsResponse {
  'scopes'?: (_couchbase_admin_collection_v1_ListCollectionsResponse_Scope)[];
  /**
   * The unique identifier for the current collection manifest version.
   * Incremented on each scope/collection mutation.
   */
  'manifest_uid'?: (number | string | Long);
}

/**
 * ListCollectionsResponse contains the scope/collection hierarchy.
 */
export interface ListCollectionsResponse__Output {
  'scopes': (_couchbase_admin_collection_v1_ListCollectionsResponse_Scope__Output)[];
  /**
   * The unique identifier for the current collection manifest version.
   * Incremented on each scope/collection mutation.
   */
  'manifest_uid': (string);
}
