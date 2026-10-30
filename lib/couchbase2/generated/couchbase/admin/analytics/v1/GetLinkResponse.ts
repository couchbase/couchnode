// Original file: couchbase/admin/analytics/v1/analytics.proto

import type { CouchbaseEncryptionMode as _couchbase_admin_analytics_v1_CouchbaseEncryptionMode, CouchbaseEncryptionMode__Output as _couchbase_admin_analytics_v1_CouchbaseEncryptionMode__Output } from '../../../../couchbase/admin/analytics/v1/CouchbaseEncryptionMode';

/**
 * AzureBlobLink — sensitive credential fields are omitted.
 */
export interface _couchbase_admin_analytics_v1_GetLinkResponse_AzureBlobLink {
  /**
   * account_key — omitted
   */
  'account_name'?: (string);
  /**
   * client_certificate — omitted
   * client_certificate_password — omitted
   */
  'client_id'?: (string);
  /**
   * client_secret — omitted
   */
  'endpoint'?: (string);
  'managed_identity_id'?: (string);
  /**
   * shared_access_signature — omitted
   */
  'tenant_id'?: (string);
  '_account_name'?: "account_name";
  '_client_id'?: "client_id";
  '_managed_identity_id'?: "managed_identity_id";
  '_tenant_id'?: "tenant_id";
}

/**
 * AzureBlobLink — sensitive credential fields are omitted.
 */
export interface _couchbase_admin_analytics_v1_GetLinkResponse_AzureBlobLink__Output {
  /**
   * account_key — omitted
   */
  'account_name'?: (string);
  /**
   * client_certificate — omitted
   * client_certificate_password — omitted
   */
  'client_id'?: (string);
  /**
   * client_secret — omitted
   */
  'endpoint': (string);
  'managed_identity_id'?: (string);
  /**
   * shared_access_signature — omitted
   */
  'tenant_id'?: (string);
  '_account_name'?: "account_name";
  '_client_id'?: "client_id";
  '_managed_identity_id'?: "managed_identity_id";
  '_tenant_id'?: "tenant_id";
}

/**
 * CouchbaseLink — sensitive fields (password, client_key) are omitted.
 */
export interface _couchbase_admin_analytics_v1_GetLinkResponse_CouchbaseLink {
  'uuid'?: (string);
  'active_hostname'?: (string);
  'bootstrap_hostname'?: (string);
  'is_bootstrap_alternate_address'?: (boolean);
  'certificate'?: (string);
  /**
   * client_certificate — omitted
   * client_key — omitted
   * cluster_compatibility — omitted
   */
  'encryption_mode'?: (_couchbase_admin_analytics_v1_CouchbaseEncryptionMode);
  /**
   * nodes — omitted
   */
  'username'?: (string);
  '_certificate'?: "certificate";
}

/**
 * CouchbaseLink — sensitive fields (password, client_key) are omitted.
 */
export interface _couchbase_admin_analytics_v1_GetLinkResponse_CouchbaseLink__Output {
  'uuid': (string);
  'active_hostname': (string);
  'bootstrap_hostname': (string);
  'is_bootstrap_alternate_address': (boolean);
  'certificate'?: (string);
  /**
   * client_certificate — omitted
   * client_key — omitted
   * cluster_compatibility — omitted
   */
  'encryption_mode': (_couchbase_admin_analytics_v1_CouchbaseEncryptionMode__Output);
  /**
   * nodes — omitted
   */
  'username': (string);
  '_certificate'?: "certificate";
}

/**
 * GcsLink — json_credentials are omitted.
 */
export interface _couchbase_admin_analytics_v1_GetLinkResponse_GcsLink {
  'use_application_default_credentials'?: (boolean);
  'endpoint'?: (string);
}

/**
 * GcsLink — json_credentials are omitted.
 */
export interface _couchbase_admin_analytics_v1_GetLinkResponse_GcsLink__Output {
  'use_application_default_credentials': (boolean);
  'endpoint': (string);
}

/**
 * S3Link — secret_access_key and session_token are omitted.
 */
export interface _couchbase_admin_analytics_v1_GetLinkResponse_S3Link {
  'access_key_id'?: (string);
  'region'?: (string);
  /**
   * secret_access_key — omitted
   * session_token — omitted
   */
  'service_endpoint'?: (string);
  '_service_endpoint'?: "service_endpoint";
}

/**
 * S3Link — secret_access_key and session_token are omitted.
 */
export interface _couchbase_admin_analytics_v1_GetLinkResponse_S3Link__Output {
  'access_key_id': (string);
  'region': (string);
  /**
   * secret_access_key — omitted
   * session_token — omitted
   */
  'service_endpoint'?: (string);
  '_service_endpoint'?: "service_endpoint";
}

/**
 * GetLinkResponse returns the link configuration with sensitive fields
 * (passwords, secret keys, SAS tokens) omitted for security.
 */
export interface GetLinkResponse {
  'couchbase_link'?: (_couchbase_admin_analytics_v1_GetLinkResponse_CouchbaseLink | null);
  's3_link'?: (_couchbase_admin_analytics_v1_GetLinkResponse_S3Link | null);
  'azureblob_link'?: (_couchbase_admin_analytics_v1_GetLinkResponse_AzureBlobLink | null);
  'gcs_link'?: (_couchbase_admin_analytics_v1_GetLinkResponse_GcsLink | null);
  'link'?: "couchbase_link"|"s3_link"|"azureblob_link"|"gcs_link";
}

/**
 * GetLinkResponse returns the link configuration with sensitive fields
 * (passwords, secret keys, SAS tokens) omitted for security.
 */
export interface GetLinkResponse__Output {
  'couchbase_link'?: (_couchbase_admin_analytics_v1_GetLinkResponse_CouchbaseLink__Output | null);
  's3_link'?: (_couchbase_admin_analytics_v1_GetLinkResponse_S3Link__Output | null);
  'azureblob_link'?: (_couchbase_admin_analytics_v1_GetLinkResponse_AzureBlobLink__Output | null);
  'gcs_link'?: (_couchbase_admin_analytics_v1_GetLinkResponse_GcsLink__Output | null);
  'link'?: "couchbase_link"|"s3_link"|"azureblob_link"|"gcs_link";
}
