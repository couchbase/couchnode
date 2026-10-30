// Original file: couchbase/admin/bucket/v1/bucket.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { CreateBucketRequest as _couchbase_admin_bucket_v1_CreateBucketRequest, CreateBucketRequest__Output as _couchbase_admin_bucket_v1_CreateBucketRequest__Output } from '../../../../couchbase/admin/bucket/v1/CreateBucketRequest';
import type { CreateBucketResponse as _couchbase_admin_bucket_v1_CreateBucketResponse, CreateBucketResponse__Output as _couchbase_admin_bucket_v1_CreateBucketResponse__Output } from '../../../../couchbase/admin/bucket/v1/CreateBucketResponse';
import type { DeleteBucketRequest as _couchbase_admin_bucket_v1_DeleteBucketRequest, DeleteBucketRequest__Output as _couchbase_admin_bucket_v1_DeleteBucketRequest__Output } from '../../../../couchbase/admin/bucket/v1/DeleteBucketRequest';
import type { DeleteBucketResponse as _couchbase_admin_bucket_v1_DeleteBucketResponse, DeleteBucketResponse__Output as _couchbase_admin_bucket_v1_DeleteBucketResponse__Output } from '../../../../couchbase/admin/bucket/v1/DeleteBucketResponse';
import type { FlushBucketRequest as _couchbase_admin_bucket_v1_FlushBucketRequest, FlushBucketRequest__Output as _couchbase_admin_bucket_v1_FlushBucketRequest__Output } from '../../../../couchbase/admin/bucket/v1/FlushBucketRequest';
import type { FlushBucketResponse as _couchbase_admin_bucket_v1_FlushBucketResponse, FlushBucketResponse__Output as _couchbase_admin_bucket_v1_FlushBucketResponse__Output } from '../../../../couchbase/admin/bucket/v1/FlushBucketResponse';
import type { ListBucketsRequest as _couchbase_admin_bucket_v1_ListBucketsRequest, ListBucketsRequest__Output as _couchbase_admin_bucket_v1_ListBucketsRequest__Output } from '../../../../couchbase/admin/bucket/v1/ListBucketsRequest';
import type { ListBucketsResponse as _couchbase_admin_bucket_v1_ListBucketsResponse, ListBucketsResponse__Output as _couchbase_admin_bucket_v1_ListBucketsResponse__Output } from '../../../../couchbase/admin/bucket/v1/ListBucketsResponse';
import type { UpdateBucketRequest as _couchbase_admin_bucket_v1_UpdateBucketRequest, UpdateBucketRequest__Output as _couchbase_admin_bucket_v1_UpdateBucketRequest__Output } from '../../../../couchbase/admin/bucket/v1/UpdateBucketRequest';
import type { UpdateBucketResponse as _couchbase_admin_bucket_v1_UpdateBucketResponse, UpdateBucketResponse__Output as _couchbase_admin_bucket_v1_UpdateBucketResponse__Output } from '../../../../couchbase/admin/bucket/v1/UpdateBucketResponse';

/**
 * BucketAdminService provides CRUD operations for Couchbase buckets.
 */
export interface BucketAdminServiceClient extends grpc.Client {
  /**
   * CreateBucket creates a new bucket with the specified configuration.
   */
  CreateBucket(argument: _couchbase_admin_bucket_v1_CreateBucketRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_CreateBucketResponse__Output>): grpc.ClientUnaryCall;
  CreateBucket(argument: _couchbase_admin_bucket_v1_CreateBucketRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_CreateBucketResponse__Output>): grpc.ClientUnaryCall;
  CreateBucket(argument: _couchbase_admin_bucket_v1_CreateBucketRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_CreateBucketResponse__Output>): grpc.ClientUnaryCall;
  CreateBucket(argument: _couchbase_admin_bucket_v1_CreateBucketRequest, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_CreateBucketResponse__Output>): grpc.ClientUnaryCall;
  /**
   * CreateBucket creates a new bucket with the specified configuration.
   */
  createBucket(argument: _couchbase_admin_bucket_v1_CreateBucketRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_CreateBucketResponse__Output>): grpc.ClientUnaryCall;
  createBucket(argument: _couchbase_admin_bucket_v1_CreateBucketRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_CreateBucketResponse__Output>): grpc.ClientUnaryCall;
  createBucket(argument: _couchbase_admin_bucket_v1_CreateBucketRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_CreateBucketResponse__Output>): grpc.ClientUnaryCall;
  createBucket(argument: _couchbase_admin_bucket_v1_CreateBucketRequest, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_CreateBucketResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * DeleteBucket permanently removes a bucket and all its data.
   */
  DeleteBucket(argument: _couchbase_admin_bucket_v1_DeleteBucketRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_DeleteBucketResponse__Output>): grpc.ClientUnaryCall;
  DeleteBucket(argument: _couchbase_admin_bucket_v1_DeleteBucketRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_DeleteBucketResponse__Output>): grpc.ClientUnaryCall;
  DeleteBucket(argument: _couchbase_admin_bucket_v1_DeleteBucketRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_DeleteBucketResponse__Output>): grpc.ClientUnaryCall;
  DeleteBucket(argument: _couchbase_admin_bucket_v1_DeleteBucketRequest, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_DeleteBucketResponse__Output>): grpc.ClientUnaryCall;
  /**
   * DeleteBucket permanently removes a bucket and all its data.
   */
  deleteBucket(argument: _couchbase_admin_bucket_v1_DeleteBucketRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_DeleteBucketResponse__Output>): grpc.ClientUnaryCall;
  deleteBucket(argument: _couchbase_admin_bucket_v1_DeleteBucketRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_DeleteBucketResponse__Output>): grpc.ClientUnaryCall;
  deleteBucket(argument: _couchbase_admin_bucket_v1_DeleteBucketRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_DeleteBucketResponse__Output>): grpc.ClientUnaryCall;
  deleteBucket(argument: _couchbase_admin_bucket_v1_DeleteBucketRequest, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_DeleteBucketResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * FlushBucket removes all documents from a bucket while preserving its
   * configuration. Requires flush_enabled to be true on the bucket.
   */
  FlushBucket(argument: _couchbase_admin_bucket_v1_FlushBucketRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_FlushBucketResponse__Output>): grpc.ClientUnaryCall;
  FlushBucket(argument: _couchbase_admin_bucket_v1_FlushBucketRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_FlushBucketResponse__Output>): grpc.ClientUnaryCall;
  FlushBucket(argument: _couchbase_admin_bucket_v1_FlushBucketRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_FlushBucketResponse__Output>): grpc.ClientUnaryCall;
  FlushBucket(argument: _couchbase_admin_bucket_v1_FlushBucketRequest, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_FlushBucketResponse__Output>): grpc.ClientUnaryCall;
  /**
   * FlushBucket removes all documents from a bucket while preserving its
   * configuration. Requires flush_enabled to be true on the bucket.
   */
  flushBucket(argument: _couchbase_admin_bucket_v1_FlushBucketRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_FlushBucketResponse__Output>): grpc.ClientUnaryCall;
  flushBucket(argument: _couchbase_admin_bucket_v1_FlushBucketRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_FlushBucketResponse__Output>): grpc.ClientUnaryCall;
  flushBucket(argument: _couchbase_admin_bucket_v1_FlushBucketRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_FlushBucketResponse__Output>): grpc.ClientUnaryCall;
  flushBucket(argument: _couchbase_admin_bucket_v1_FlushBucketRequest, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_FlushBucketResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * ListBuckets returns all buckets in the cluster with their configurations.
   */
  ListBuckets(argument: _couchbase_admin_bucket_v1_ListBucketsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_ListBucketsResponse__Output>): grpc.ClientUnaryCall;
  ListBuckets(argument: _couchbase_admin_bucket_v1_ListBucketsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_ListBucketsResponse__Output>): grpc.ClientUnaryCall;
  ListBuckets(argument: _couchbase_admin_bucket_v1_ListBucketsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_ListBucketsResponse__Output>): grpc.ClientUnaryCall;
  ListBuckets(argument: _couchbase_admin_bucket_v1_ListBucketsRequest, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_ListBucketsResponse__Output>): grpc.ClientUnaryCall;
  /**
   * ListBuckets returns all buckets in the cluster with their configurations.
   */
  listBuckets(argument: _couchbase_admin_bucket_v1_ListBucketsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_ListBucketsResponse__Output>): grpc.ClientUnaryCall;
  listBuckets(argument: _couchbase_admin_bucket_v1_ListBucketsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_ListBucketsResponse__Output>): grpc.ClientUnaryCall;
  listBuckets(argument: _couchbase_admin_bucket_v1_ListBucketsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_ListBucketsResponse__Output>): grpc.ClientUnaryCall;
  listBuckets(argument: _couchbase_admin_bucket_v1_ListBucketsRequest, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_ListBucketsResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * UpdateBucket modifies the configuration of an existing bucket.
   * Only mutable properties can be changed (e.g., ram_quota, replicas).
   */
  UpdateBucket(argument: _couchbase_admin_bucket_v1_UpdateBucketRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_UpdateBucketResponse__Output>): grpc.ClientUnaryCall;
  UpdateBucket(argument: _couchbase_admin_bucket_v1_UpdateBucketRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_UpdateBucketResponse__Output>): grpc.ClientUnaryCall;
  UpdateBucket(argument: _couchbase_admin_bucket_v1_UpdateBucketRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_UpdateBucketResponse__Output>): grpc.ClientUnaryCall;
  UpdateBucket(argument: _couchbase_admin_bucket_v1_UpdateBucketRequest, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_UpdateBucketResponse__Output>): grpc.ClientUnaryCall;
  /**
   * UpdateBucket modifies the configuration of an existing bucket.
   * Only mutable properties can be changed (e.g., ram_quota, replicas).
   */
  updateBucket(argument: _couchbase_admin_bucket_v1_UpdateBucketRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_UpdateBucketResponse__Output>): grpc.ClientUnaryCall;
  updateBucket(argument: _couchbase_admin_bucket_v1_UpdateBucketRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_UpdateBucketResponse__Output>): grpc.ClientUnaryCall;
  updateBucket(argument: _couchbase_admin_bucket_v1_UpdateBucketRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_UpdateBucketResponse__Output>): grpc.ClientUnaryCall;
  updateBucket(argument: _couchbase_admin_bucket_v1_UpdateBucketRequest, callback: grpc.requestCallback<_couchbase_admin_bucket_v1_UpdateBucketResponse__Output>): grpc.ClientUnaryCall;
  
}

/**
 * BucketAdminService provides CRUD operations for Couchbase buckets.
 */
export interface BucketAdminServiceHandlers extends grpc.UntypedServiceImplementation {
  /**
   * CreateBucket creates a new bucket with the specified configuration.
   */
  CreateBucket: grpc.handleUnaryCall<_couchbase_admin_bucket_v1_CreateBucketRequest__Output, _couchbase_admin_bucket_v1_CreateBucketResponse>;
  
  /**
   * DeleteBucket permanently removes a bucket and all its data.
   */
  DeleteBucket: grpc.handleUnaryCall<_couchbase_admin_bucket_v1_DeleteBucketRequest__Output, _couchbase_admin_bucket_v1_DeleteBucketResponse>;
  
  /**
   * FlushBucket removes all documents from a bucket while preserving its
   * configuration. Requires flush_enabled to be true on the bucket.
   */
  FlushBucket: grpc.handleUnaryCall<_couchbase_admin_bucket_v1_FlushBucketRequest__Output, _couchbase_admin_bucket_v1_FlushBucketResponse>;
  
  /**
   * ListBuckets returns all buckets in the cluster with their configurations.
   */
  ListBuckets: grpc.handleUnaryCall<_couchbase_admin_bucket_v1_ListBucketsRequest__Output, _couchbase_admin_bucket_v1_ListBucketsResponse>;
  
  /**
   * UpdateBucket modifies the configuration of an existing bucket.
   * Only mutable properties can be changed (e.g., ram_quota, replicas).
   */
  UpdateBucket: grpc.handleUnaryCall<_couchbase_admin_bucket_v1_UpdateBucketRequest__Output, _couchbase_admin_bucket_v1_UpdateBucketResponse>;
  
}

export interface BucketAdminServiceDefinition extends grpc.ServiceDefinition {
  CreateBucket: MethodDefinition<_couchbase_admin_bucket_v1_CreateBucketRequest, _couchbase_admin_bucket_v1_CreateBucketResponse, _couchbase_admin_bucket_v1_CreateBucketRequest__Output, _couchbase_admin_bucket_v1_CreateBucketResponse__Output>
  DeleteBucket: MethodDefinition<_couchbase_admin_bucket_v1_DeleteBucketRequest, _couchbase_admin_bucket_v1_DeleteBucketResponse, _couchbase_admin_bucket_v1_DeleteBucketRequest__Output, _couchbase_admin_bucket_v1_DeleteBucketResponse__Output>
  FlushBucket: MethodDefinition<_couchbase_admin_bucket_v1_FlushBucketRequest, _couchbase_admin_bucket_v1_FlushBucketResponse, _couchbase_admin_bucket_v1_FlushBucketRequest__Output, _couchbase_admin_bucket_v1_FlushBucketResponse__Output>
  ListBuckets: MethodDefinition<_couchbase_admin_bucket_v1_ListBucketsRequest, _couchbase_admin_bucket_v1_ListBucketsResponse, _couchbase_admin_bucket_v1_ListBucketsRequest__Output, _couchbase_admin_bucket_v1_ListBucketsResponse__Output>
  UpdateBucket: MethodDefinition<_couchbase_admin_bucket_v1_UpdateBucketRequest, _couchbase_admin_bucket_v1_UpdateBucketResponse, _couchbase_admin_bucket_v1_UpdateBucketRequest__Output, _couchbase_admin_bucket_v1_UpdateBucketResponse__Output>
}
