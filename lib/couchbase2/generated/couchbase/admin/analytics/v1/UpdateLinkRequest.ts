// Original file: couchbase/admin/analytics/v1/analytics.proto

import type { CouchbaseEncryptionMode as _couchbase_admin_analytics_v1_CouchbaseEncryptionMode, CouchbaseEncryptionMode__Output as _couchbase_admin_analytics_v1_CouchbaseEncryptionMode__Output } from '../../../../couchbase/admin/analytics/v1/CouchbaseEncryptionMode';

export interface _couchbase_admin_analytics_v1_UpdateLinkRequest_AzureBlobLink {
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

export interface _couchbase_admin_analytics_v1_UpdateLinkRequest_AzureBlobLink__Output {
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
 * CouchbaseLink — same fields as CreateLinkRequest.CouchbaseLink.
 */
export interface _couchbase_admin_analytics_v1_UpdateLinkRequest_CouchbaseLink {
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
 * CouchbaseLink — same fields as CreateLinkRequest.CouchbaseLink.
 */
export interface _couchbase_admin_analytics_v1_UpdateLinkRequest_CouchbaseLink__Output {
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

export interface _couchbase_admin_analytics_v1_UpdateLinkRequest_GcsLink {
  'json_credentials'?: (string);
  '_json_credentials'?: "json_credentials";
}

export interface _couchbase_admin_analytics_v1_UpdateLinkRequest_GcsLink__Output {
  'json_credentials'?: (string);
  '_json_credentials'?: "json_credentials";
}

export interface _couchbase_admin_analytics_v1_UpdateLinkRequest_S3Link {
  'access_key_id'?: (string);
  'secret_access_key'?: (string);
  'session_token'?: (string);
  'region'?: (string);
  'service_endpoint'?: (string);
  '_session_token'?: "session_token";
  '_service_endpoint'?: "service_endpoint";
}

export interface _couchbase_admin_analytics_v1_UpdateLinkRequest_S3Link__Output {
  'access_key_id': (string);
  'secret_access_key': (string);
  'session_token'?: (string);
  'region': (string);
  'service_endpoint'?: (string);
  '_session_token'?: "session_token";
  '_service_endpoint'?: "service_endpoint";
}

/**
 * UpdateLinkRequest updates an existing link. Same structure as
 * CreateLinkRequest.
 */
export interface UpdateLinkRequest {
  'analytics_scope_name'?: (string);
  'link_name'?: (string);
  'couchbase_link'?: (_couchbase_admin_analytics_v1_UpdateLinkRequest_CouchbaseLink | null);
  's3_link'?: (_couchbase_admin_analytics_v1_UpdateLinkRequest_S3Link | null);
  'azureblob_link'?: (_couchbase_admin_analytics_v1_UpdateLinkRequest_AzureBlobLink | null);
  'gcs_link'?: (_couchbase_admin_analytics_v1_UpdateLinkRequest_GcsLink | null);
  'link'?: "couchbase_link"|"s3_link"|"azureblob_link"|"gcs_link";
}

/**
 * UpdateLinkRequest updates an existing link. Same structure as
 * CreateLinkRequest.
 */
export interface UpdateLinkRequest__Output {
  'analytics_scope_name': (string);
  'link_name': (string);
  'couchbase_link'?: (_couchbase_admin_analytics_v1_UpdateLinkRequest_CouchbaseLink__Output | null);
  's3_link'?: (_couchbase_admin_analytics_v1_UpdateLinkRequest_S3Link__Output | null);
  'azureblob_link'?: (_couchbase_admin_analytics_v1_UpdateLinkRequest_AzureBlobLink__Output | null);
  'gcs_link'?: (_couchbase_admin_analytics_v1_UpdateLinkRequest_GcsLink__Output | null);
  'link'?: "couchbase_link"|"s3_link"|"azureblob_link"|"gcs_link";
}
