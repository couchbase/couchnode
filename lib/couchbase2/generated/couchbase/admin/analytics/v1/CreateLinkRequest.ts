// Original file: couchbase/admin/analytics/v1/analytics.proto

import type { CouchbaseEncryptionMode as _couchbase_admin_analytics_v1_CouchbaseEncryptionMode, CouchbaseEncryptionMode__Output as _couchbase_admin_analytics_v1_CouchbaseEncryptionMode__Output } from '../../../../couchbase/admin/analytics/v1/CouchbaseEncryptionMode';

/**
 * AzureBlobLink connects to an Azure Blob Storage data source.
 */
export interface _couchbase_admin_analytics_v1_CreateLinkRequest_AzureBlobLink {
  'account_name'?: (string);
  'account_key'?: (string);
  'shared_access_signature'?: (string);
  'managed_identity_id'?: (string);
  'client_id'?: (string);
  'tenant_id'?: (string);
  'client_secret'?: (string);
  'client_certificate_password'?: (string);
  'endpoint'?: (string);
  '_account_name'?: "account_name";
  '_account_key'?: "account_key";
  '_shared_access_signature'?: "shared_access_signature";
  '_managed_identity_id'?: "managed_identity_id";
  '_client_id'?: "client_id";
  '_tenant_id'?: "tenant_id";
  '_client_secret'?: "client_secret";
  '_client_certificate_password'?: "client_certificate_password";
  '_endpoint'?: "endpoint";
}

/**
 * AzureBlobLink connects to an Azure Blob Storage data source.
 */
export interface _couchbase_admin_analytics_v1_CreateLinkRequest_AzureBlobLink__Output {
  'account_name'?: (string);
  'account_key'?: (string);
  'shared_access_signature'?: (string);
  'managed_identity_id'?: (string);
  'client_id'?: (string);
  'tenant_id'?: (string);
  'client_secret'?: (string);
  'client_certificate_password'?: (string);
  'endpoint'?: (string);
  '_account_name'?: "account_name";
  '_account_key'?: "account_key";
  '_shared_access_signature'?: "shared_access_signature";
  '_managed_identity_id'?: "managed_identity_id";
  '_client_id'?: "client_id";
  '_tenant_id'?: "tenant_id";
  '_client_secret'?: "client_secret";
  '_client_certificate_password'?: "client_certificate_password";
  '_endpoint'?: "endpoint";
}

/**
 * CouchbaseLink connects to a remote Couchbase cluster.
 */
export interface _couchbase_admin_analytics_v1_CreateLinkRequest_CouchbaseLink {
  'hostname'?: (string);
  'encryption_mode'?: (_couchbase_admin_analytics_v1_CouchbaseEncryptionMode);
  'username'?: (string);
  'password'?: (string);
  'certificate'?: (string);
  'client_certificate'?: (string);
  'client_key'?: (string);
  '_username'?: "username";
  '_password'?: "password";
  '_certificate'?: "certificate";
  '_client_certificate'?: "client_certificate";
  '_client_key'?: "client_key";
}

/**
 * CouchbaseLink connects to a remote Couchbase cluster.
 */
export interface _couchbase_admin_analytics_v1_CreateLinkRequest_CouchbaseLink__Output {
  'hostname': (string);
  'encryption_mode': (_couchbase_admin_analytics_v1_CouchbaseEncryptionMode__Output);
  'username'?: (string);
  'password'?: (string);
  'certificate'?: (string);
  'client_certificate'?: (string);
  'client_key'?: (string);
  '_username'?: "username";
  '_password'?: "password";
  '_certificate'?: "certificate";
  '_client_certificate'?: "client_certificate";
  '_client_key'?: "client_key";
}

/**
 * GcsLink connects to a Google Cloud Storage data source.
 */
export interface _couchbase_admin_analytics_v1_CreateLinkRequest_GcsLink {
  'json_credentials'?: (string);
  '_json_credentials'?: "json_credentials";
}

/**
 * GcsLink connects to a Google Cloud Storage data source.
 */
export interface _couchbase_admin_analytics_v1_CreateLinkRequest_GcsLink__Output {
  'json_credentials'?: (string);
  '_json_credentials'?: "json_credentials";
}

/**
 * S3Link connects to an Amazon S3 data source.
 */
export interface _couchbase_admin_analytics_v1_CreateLinkRequest_S3Link {
  'access_key_id'?: (string);
  'secret_access_key'?: (string);
  'session_token'?: (string);
  'region'?: (string);
  'service_endpoint'?: (string);
  '_session_token'?: "session_token";
  '_service_endpoint'?: "service_endpoint";
}

/**
 * S3Link connects to an Amazon S3 data source.
 */
export interface _couchbase_admin_analytics_v1_CreateLinkRequest_S3Link__Output {
  'access_key_id': (string);
  'secret_access_key': (string);
  'session_token'?: (string);
  'region': (string);
  'service_endpoint'?: (string);
  '_session_token'?: "session_token";
  '_service_endpoint'?: "service_endpoint";
}

/**
 * CreateLinkRequest creates a new analytics link. Exactly one link type
 * must be specified via the oneof.
 */
export interface CreateLinkRequest {
  /**
   * The analytics scope this link belongs to.
   */
  'analytics_scope_name'?: (string);
  /**
   * The name of the link.
   */
  'link_name'?: (string);
  'couchbase_link'?: (_couchbase_admin_analytics_v1_CreateLinkRequest_CouchbaseLink | null);
  's3_link'?: (_couchbase_admin_analytics_v1_CreateLinkRequest_S3Link | null);
  'azureblob_link'?: (_couchbase_admin_analytics_v1_CreateLinkRequest_AzureBlobLink | null);
  'gcs_link'?: (_couchbase_admin_analytics_v1_CreateLinkRequest_GcsLink | null);
  /**
   * The link configuration. Exactly one must be set.
   */
  'link'?: "couchbase_link"|"s3_link"|"azureblob_link"|"gcs_link";
}

/**
 * CreateLinkRequest creates a new analytics link. Exactly one link type
 * must be specified via the oneof.
 */
export interface CreateLinkRequest__Output {
  /**
   * The analytics scope this link belongs to.
   */
  'analytics_scope_name': (string);
  /**
   * The name of the link.
   */
  'link_name': (string);
  'couchbase_link'?: (_couchbase_admin_analytics_v1_CreateLinkRequest_CouchbaseLink__Output | null);
  's3_link'?: (_couchbase_admin_analytics_v1_CreateLinkRequest_S3Link__Output | null);
  'azureblob_link'?: (_couchbase_admin_analytics_v1_CreateLinkRequest_AzureBlobLink__Output | null);
  'gcs_link'?: (_couchbase_admin_analytics_v1_CreateLinkRequest_GcsLink__Output | null);
  /**
   * The link configuration. Exactly one must be set.
   */
  'link'?: "couchbase_link"|"s3_link"|"azureblob_link"|"gcs_link";
}
