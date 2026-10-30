// Original file: couchbase/admin/query/v1/query.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { BuildDeferredIndexesRequest as _couchbase_admin_query_v1_BuildDeferredIndexesRequest, BuildDeferredIndexesRequest__Output as _couchbase_admin_query_v1_BuildDeferredIndexesRequest__Output } from '../../../../couchbase/admin/query/v1/BuildDeferredIndexesRequest';
import type { BuildDeferredIndexesResponse as _couchbase_admin_query_v1_BuildDeferredIndexesResponse, BuildDeferredIndexesResponse__Output as _couchbase_admin_query_v1_BuildDeferredIndexesResponse__Output } from '../../../../couchbase/admin/query/v1/BuildDeferredIndexesResponse';
import type { CreateIndexRequest as _couchbase_admin_query_v1_CreateIndexRequest, CreateIndexRequest__Output as _couchbase_admin_query_v1_CreateIndexRequest__Output } from '../../../../couchbase/admin/query/v1/CreateIndexRequest';
import type { CreateIndexResponse as _couchbase_admin_query_v1_CreateIndexResponse, CreateIndexResponse__Output as _couchbase_admin_query_v1_CreateIndexResponse__Output } from '../../../../couchbase/admin/query/v1/CreateIndexResponse';
import type { CreatePrimaryIndexRequest as _couchbase_admin_query_v1_CreatePrimaryIndexRequest, CreatePrimaryIndexRequest__Output as _couchbase_admin_query_v1_CreatePrimaryIndexRequest__Output } from '../../../../couchbase/admin/query/v1/CreatePrimaryIndexRequest';
import type { CreatePrimaryIndexResponse as _couchbase_admin_query_v1_CreatePrimaryIndexResponse, CreatePrimaryIndexResponse__Output as _couchbase_admin_query_v1_CreatePrimaryIndexResponse__Output } from '../../../../couchbase/admin/query/v1/CreatePrimaryIndexResponse';
import type { DropIndexRequest as _couchbase_admin_query_v1_DropIndexRequest, DropIndexRequest__Output as _couchbase_admin_query_v1_DropIndexRequest__Output } from '../../../../couchbase/admin/query/v1/DropIndexRequest';
import type { DropIndexResponse as _couchbase_admin_query_v1_DropIndexResponse, DropIndexResponse__Output as _couchbase_admin_query_v1_DropIndexResponse__Output } from '../../../../couchbase/admin/query/v1/DropIndexResponse';
import type { DropPrimaryIndexRequest as _couchbase_admin_query_v1_DropPrimaryIndexRequest, DropPrimaryIndexRequest__Output as _couchbase_admin_query_v1_DropPrimaryIndexRequest__Output } from '../../../../couchbase/admin/query/v1/DropPrimaryIndexRequest';
import type { DropPrimaryIndexResponse as _couchbase_admin_query_v1_DropPrimaryIndexResponse, DropPrimaryIndexResponse__Output as _couchbase_admin_query_v1_DropPrimaryIndexResponse__Output } from '../../../../couchbase/admin/query/v1/DropPrimaryIndexResponse';
import type { GetAllIndexesRequest as _couchbase_admin_query_v1_GetAllIndexesRequest, GetAllIndexesRequest__Output as _couchbase_admin_query_v1_GetAllIndexesRequest__Output } from '../../../../couchbase/admin/query/v1/GetAllIndexesRequest';
import type { GetAllIndexesResponse as _couchbase_admin_query_v1_GetAllIndexesResponse, GetAllIndexesResponse__Output as _couchbase_admin_query_v1_GetAllIndexesResponse__Output } from '../../../../couchbase/admin/query/v1/GetAllIndexesResponse';
import type { WaitForIndexOnlineRequest as _couchbase_admin_query_v1_WaitForIndexOnlineRequest, WaitForIndexOnlineRequest__Output as _couchbase_admin_query_v1_WaitForIndexOnlineRequest__Output } from '../../../../couchbase/admin/query/v1/WaitForIndexOnlineRequest';
import type { WaitForIndexOnlineResponse as _couchbase_admin_query_v1_WaitForIndexOnlineResponse, WaitForIndexOnlineResponse__Output as _couchbase_admin_query_v1_WaitForIndexOnlineResponse__Output } from '../../../../couchbase/admin/query/v1/WaitForIndexOnlineResponse';

/**
 * QueryAdminService provides N1QL index lifecycle management.
 */
export interface QueryAdminServiceClient extends grpc.Client {
  /**
   * BuildDeferredIndexes triggers the build of all indexes that were created
   * with deferred=true. Returns the list of indexes that will be built.
   */
  BuildDeferredIndexes(argument: _couchbase_admin_query_v1_BuildDeferredIndexesRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_BuildDeferredIndexesResponse__Output>): grpc.ClientUnaryCall;
  BuildDeferredIndexes(argument: _couchbase_admin_query_v1_BuildDeferredIndexesRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_query_v1_BuildDeferredIndexesResponse__Output>): grpc.ClientUnaryCall;
  BuildDeferredIndexes(argument: _couchbase_admin_query_v1_BuildDeferredIndexesRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_BuildDeferredIndexesResponse__Output>): grpc.ClientUnaryCall;
  BuildDeferredIndexes(argument: _couchbase_admin_query_v1_BuildDeferredIndexesRequest, callback: grpc.requestCallback<_couchbase_admin_query_v1_BuildDeferredIndexesResponse__Output>): grpc.ClientUnaryCall;
  /**
   * BuildDeferredIndexes triggers the build of all indexes that were created
   * with deferred=true. Returns the list of indexes that will be built.
   */
  buildDeferredIndexes(argument: _couchbase_admin_query_v1_BuildDeferredIndexesRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_BuildDeferredIndexesResponse__Output>): grpc.ClientUnaryCall;
  buildDeferredIndexes(argument: _couchbase_admin_query_v1_BuildDeferredIndexesRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_query_v1_BuildDeferredIndexesResponse__Output>): grpc.ClientUnaryCall;
  buildDeferredIndexes(argument: _couchbase_admin_query_v1_BuildDeferredIndexesRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_BuildDeferredIndexesResponse__Output>): grpc.ClientUnaryCall;
  buildDeferredIndexes(argument: _couchbase_admin_query_v1_BuildDeferredIndexesRequest, callback: grpc.requestCallback<_couchbase_admin_query_v1_BuildDeferredIndexesResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * CreateIndex creates a secondary index on specific document fields.
   */
  CreateIndex(argument: _couchbase_admin_query_v1_CreateIndexRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_CreateIndexResponse__Output>): grpc.ClientUnaryCall;
  CreateIndex(argument: _couchbase_admin_query_v1_CreateIndexRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_query_v1_CreateIndexResponse__Output>): grpc.ClientUnaryCall;
  CreateIndex(argument: _couchbase_admin_query_v1_CreateIndexRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_CreateIndexResponse__Output>): grpc.ClientUnaryCall;
  CreateIndex(argument: _couchbase_admin_query_v1_CreateIndexRequest, callback: grpc.requestCallback<_couchbase_admin_query_v1_CreateIndexResponse__Output>): grpc.ClientUnaryCall;
  /**
   * CreateIndex creates a secondary index on specific document fields.
   */
  createIndex(argument: _couchbase_admin_query_v1_CreateIndexRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_CreateIndexResponse__Output>): grpc.ClientUnaryCall;
  createIndex(argument: _couchbase_admin_query_v1_CreateIndexRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_query_v1_CreateIndexResponse__Output>): grpc.ClientUnaryCall;
  createIndex(argument: _couchbase_admin_query_v1_CreateIndexRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_CreateIndexResponse__Output>): grpc.ClientUnaryCall;
  createIndex(argument: _couchbase_admin_query_v1_CreateIndexRequest, callback: grpc.requestCallback<_couchbase_admin_query_v1_CreateIndexResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * CreatePrimaryIndex creates a primary index on a collection.
   * A primary index indexes all document keys.
   */
  CreatePrimaryIndex(argument: _couchbase_admin_query_v1_CreatePrimaryIndexRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_CreatePrimaryIndexResponse__Output>): grpc.ClientUnaryCall;
  CreatePrimaryIndex(argument: _couchbase_admin_query_v1_CreatePrimaryIndexRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_query_v1_CreatePrimaryIndexResponse__Output>): grpc.ClientUnaryCall;
  CreatePrimaryIndex(argument: _couchbase_admin_query_v1_CreatePrimaryIndexRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_CreatePrimaryIndexResponse__Output>): grpc.ClientUnaryCall;
  CreatePrimaryIndex(argument: _couchbase_admin_query_v1_CreatePrimaryIndexRequest, callback: grpc.requestCallback<_couchbase_admin_query_v1_CreatePrimaryIndexResponse__Output>): grpc.ClientUnaryCall;
  /**
   * CreatePrimaryIndex creates a primary index on a collection.
   * A primary index indexes all document keys.
   */
  createPrimaryIndex(argument: _couchbase_admin_query_v1_CreatePrimaryIndexRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_CreatePrimaryIndexResponse__Output>): grpc.ClientUnaryCall;
  createPrimaryIndex(argument: _couchbase_admin_query_v1_CreatePrimaryIndexRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_query_v1_CreatePrimaryIndexResponse__Output>): grpc.ClientUnaryCall;
  createPrimaryIndex(argument: _couchbase_admin_query_v1_CreatePrimaryIndexRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_CreatePrimaryIndexResponse__Output>): grpc.ClientUnaryCall;
  createPrimaryIndex(argument: _couchbase_admin_query_v1_CreatePrimaryIndexRequest, callback: grpc.requestCallback<_couchbase_admin_query_v1_CreatePrimaryIndexResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * DropIndex removes a named secondary index.
   */
  DropIndex(argument: _couchbase_admin_query_v1_DropIndexRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_DropIndexResponse__Output>): grpc.ClientUnaryCall;
  DropIndex(argument: _couchbase_admin_query_v1_DropIndexRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_query_v1_DropIndexResponse__Output>): grpc.ClientUnaryCall;
  DropIndex(argument: _couchbase_admin_query_v1_DropIndexRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_DropIndexResponse__Output>): grpc.ClientUnaryCall;
  DropIndex(argument: _couchbase_admin_query_v1_DropIndexRequest, callback: grpc.requestCallback<_couchbase_admin_query_v1_DropIndexResponse__Output>): grpc.ClientUnaryCall;
  /**
   * DropIndex removes a named secondary index.
   */
  dropIndex(argument: _couchbase_admin_query_v1_DropIndexRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_DropIndexResponse__Output>): grpc.ClientUnaryCall;
  dropIndex(argument: _couchbase_admin_query_v1_DropIndexRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_query_v1_DropIndexResponse__Output>): grpc.ClientUnaryCall;
  dropIndex(argument: _couchbase_admin_query_v1_DropIndexRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_DropIndexResponse__Output>): grpc.ClientUnaryCall;
  dropIndex(argument: _couchbase_admin_query_v1_DropIndexRequest, callback: grpc.requestCallback<_couchbase_admin_query_v1_DropIndexResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * DropPrimaryIndex removes a primary index.
   */
  DropPrimaryIndex(argument: _couchbase_admin_query_v1_DropPrimaryIndexRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_DropPrimaryIndexResponse__Output>): grpc.ClientUnaryCall;
  DropPrimaryIndex(argument: _couchbase_admin_query_v1_DropPrimaryIndexRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_query_v1_DropPrimaryIndexResponse__Output>): grpc.ClientUnaryCall;
  DropPrimaryIndex(argument: _couchbase_admin_query_v1_DropPrimaryIndexRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_DropPrimaryIndexResponse__Output>): grpc.ClientUnaryCall;
  DropPrimaryIndex(argument: _couchbase_admin_query_v1_DropPrimaryIndexRequest, callback: grpc.requestCallback<_couchbase_admin_query_v1_DropPrimaryIndexResponse__Output>): grpc.ClientUnaryCall;
  /**
   * DropPrimaryIndex removes a primary index.
   */
  dropPrimaryIndex(argument: _couchbase_admin_query_v1_DropPrimaryIndexRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_DropPrimaryIndexResponse__Output>): grpc.ClientUnaryCall;
  dropPrimaryIndex(argument: _couchbase_admin_query_v1_DropPrimaryIndexRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_query_v1_DropPrimaryIndexResponse__Output>): grpc.ClientUnaryCall;
  dropPrimaryIndex(argument: _couchbase_admin_query_v1_DropPrimaryIndexRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_DropPrimaryIndexResponse__Output>): grpc.ClientUnaryCall;
  dropPrimaryIndex(argument: _couchbase_admin_query_v1_DropPrimaryIndexRequest, callback: grpc.requestCallback<_couchbase_admin_query_v1_DropPrimaryIndexResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * GetAllIndexes returns all indexes matching the optional scope filter.
   */
  GetAllIndexes(argument: _couchbase_admin_query_v1_GetAllIndexesRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_GetAllIndexesResponse__Output>): grpc.ClientUnaryCall;
  GetAllIndexes(argument: _couchbase_admin_query_v1_GetAllIndexesRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_query_v1_GetAllIndexesResponse__Output>): grpc.ClientUnaryCall;
  GetAllIndexes(argument: _couchbase_admin_query_v1_GetAllIndexesRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_GetAllIndexesResponse__Output>): grpc.ClientUnaryCall;
  GetAllIndexes(argument: _couchbase_admin_query_v1_GetAllIndexesRequest, callback: grpc.requestCallback<_couchbase_admin_query_v1_GetAllIndexesResponse__Output>): grpc.ClientUnaryCall;
  /**
   * GetAllIndexes returns all indexes matching the optional scope filter.
   */
  getAllIndexes(argument: _couchbase_admin_query_v1_GetAllIndexesRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_GetAllIndexesResponse__Output>): grpc.ClientUnaryCall;
  getAllIndexes(argument: _couchbase_admin_query_v1_GetAllIndexesRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_query_v1_GetAllIndexesResponse__Output>): grpc.ClientUnaryCall;
  getAllIndexes(argument: _couchbase_admin_query_v1_GetAllIndexesRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_GetAllIndexesResponse__Output>): grpc.ClientUnaryCall;
  getAllIndexes(argument: _couchbase_admin_query_v1_GetAllIndexesRequest, callback: grpc.requestCallback<_couchbase_admin_query_v1_GetAllIndexesResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * WaitForIndexOnline blocks until the specified index reaches ONLINE state.
   */
  WaitForIndexOnline(argument: _couchbase_admin_query_v1_WaitForIndexOnlineRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_WaitForIndexOnlineResponse__Output>): grpc.ClientUnaryCall;
  WaitForIndexOnline(argument: _couchbase_admin_query_v1_WaitForIndexOnlineRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_query_v1_WaitForIndexOnlineResponse__Output>): grpc.ClientUnaryCall;
  WaitForIndexOnline(argument: _couchbase_admin_query_v1_WaitForIndexOnlineRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_WaitForIndexOnlineResponse__Output>): grpc.ClientUnaryCall;
  WaitForIndexOnline(argument: _couchbase_admin_query_v1_WaitForIndexOnlineRequest, callback: grpc.requestCallback<_couchbase_admin_query_v1_WaitForIndexOnlineResponse__Output>): grpc.ClientUnaryCall;
  /**
   * WaitForIndexOnline blocks until the specified index reaches ONLINE state.
   */
  waitForIndexOnline(argument: _couchbase_admin_query_v1_WaitForIndexOnlineRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_WaitForIndexOnlineResponse__Output>): grpc.ClientUnaryCall;
  waitForIndexOnline(argument: _couchbase_admin_query_v1_WaitForIndexOnlineRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_query_v1_WaitForIndexOnlineResponse__Output>): grpc.ClientUnaryCall;
  waitForIndexOnline(argument: _couchbase_admin_query_v1_WaitForIndexOnlineRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_query_v1_WaitForIndexOnlineResponse__Output>): grpc.ClientUnaryCall;
  waitForIndexOnline(argument: _couchbase_admin_query_v1_WaitForIndexOnlineRequest, callback: grpc.requestCallback<_couchbase_admin_query_v1_WaitForIndexOnlineResponse__Output>): grpc.ClientUnaryCall;
  
}

/**
 * QueryAdminService provides N1QL index lifecycle management.
 */
export interface QueryAdminServiceHandlers extends grpc.UntypedServiceImplementation {
  /**
   * BuildDeferredIndexes triggers the build of all indexes that were created
   * with deferred=true. Returns the list of indexes that will be built.
   */
  BuildDeferredIndexes: grpc.handleUnaryCall<_couchbase_admin_query_v1_BuildDeferredIndexesRequest__Output, _couchbase_admin_query_v1_BuildDeferredIndexesResponse>;
  
  /**
   * CreateIndex creates a secondary index on specific document fields.
   */
  CreateIndex: grpc.handleUnaryCall<_couchbase_admin_query_v1_CreateIndexRequest__Output, _couchbase_admin_query_v1_CreateIndexResponse>;
  
  /**
   * CreatePrimaryIndex creates a primary index on a collection.
   * A primary index indexes all document keys.
   */
  CreatePrimaryIndex: grpc.handleUnaryCall<_couchbase_admin_query_v1_CreatePrimaryIndexRequest__Output, _couchbase_admin_query_v1_CreatePrimaryIndexResponse>;
  
  /**
   * DropIndex removes a named secondary index.
   */
  DropIndex: grpc.handleUnaryCall<_couchbase_admin_query_v1_DropIndexRequest__Output, _couchbase_admin_query_v1_DropIndexResponse>;
  
  /**
   * DropPrimaryIndex removes a primary index.
   */
  DropPrimaryIndex: grpc.handleUnaryCall<_couchbase_admin_query_v1_DropPrimaryIndexRequest__Output, _couchbase_admin_query_v1_DropPrimaryIndexResponse>;
  
  /**
   * GetAllIndexes returns all indexes matching the optional scope filter.
   */
  GetAllIndexes: grpc.handleUnaryCall<_couchbase_admin_query_v1_GetAllIndexesRequest__Output, _couchbase_admin_query_v1_GetAllIndexesResponse>;
  
  /**
   * WaitForIndexOnline blocks until the specified index reaches ONLINE state.
   */
  WaitForIndexOnline: grpc.handleUnaryCall<_couchbase_admin_query_v1_WaitForIndexOnlineRequest__Output, _couchbase_admin_query_v1_WaitForIndexOnlineResponse>;
  
}

export interface QueryAdminServiceDefinition extends grpc.ServiceDefinition {
  BuildDeferredIndexes: MethodDefinition<_couchbase_admin_query_v1_BuildDeferredIndexesRequest, _couchbase_admin_query_v1_BuildDeferredIndexesResponse, _couchbase_admin_query_v1_BuildDeferredIndexesRequest__Output, _couchbase_admin_query_v1_BuildDeferredIndexesResponse__Output>
  CreateIndex: MethodDefinition<_couchbase_admin_query_v1_CreateIndexRequest, _couchbase_admin_query_v1_CreateIndexResponse, _couchbase_admin_query_v1_CreateIndexRequest__Output, _couchbase_admin_query_v1_CreateIndexResponse__Output>
  CreatePrimaryIndex: MethodDefinition<_couchbase_admin_query_v1_CreatePrimaryIndexRequest, _couchbase_admin_query_v1_CreatePrimaryIndexResponse, _couchbase_admin_query_v1_CreatePrimaryIndexRequest__Output, _couchbase_admin_query_v1_CreatePrimaryIndexResponse__Output>
  DropIndex: MethodDefinition<_couchbase_admin_query_v1_DropIndexRequest, _couchbase_admin_query_v1_DropIndexResponse, _couchbase_admin_query_v1_DropIndexRequest__Output, _couchbase_admin_query_v1_DropIndexResponse__Output>
  DropPrimaryIndex: MethodDefinition<_couchbase_admin_query_v1_DropPrimaryIndexRequest, _couchbase_admin_query_v1_DropPrimaryIndexResponse, _couchbase_admin_query_v1_DropPrimaryIndexRequest__Output, _couchbase_admin_query_v1_DropPrimaryIndexResponse__Output>
  GetAllIndexes: MethodDefinition<_couchbase_admin_query_v1_GetAllIndexesRequest, _couchbase_admin_query_v1_GetAllIndexesResponse, _couchbase_admin_query_v1_GetAllIndexesRequest__Output, _couchbase_admin_query_v1_GetAllIndexesResponse__Output>
  WaitForIndexOnline: MethodDefinition<_couchbase_admin_query_v1_WaitForIndexOnlineRequest, _couchbase_admin_query_v1_WaitForIndexOnlineResponse, _couchbase_admin_query_v1_WaitForIndexOnlineRequest__Output, _couchbase_admin_query_v1_WaitForIndexOnlineResponse__Output>
}
