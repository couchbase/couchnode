// Original file: couchbase/admin/collection/v1/collection.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { CreateCollectionRequest as _couchbase_admin_collection_v1_CreateCollectionRequest, CreateCollectionRequest__Output as _couchbase_admin_collection_v1_CreateCollectionRequest__Output } from '../../../../couchbase/admin/collection/v1/CreateCollectionRequest';
import type { CreateCollectionResponse as _couchbase_admin_collection_v1_CreateCollectionResponse, CreateCollectionResponse__Output as _couchbase_admin_collection_v1_CreateCollectionResponse__Output } from '../../../../couchbase/admin/collection/v1/CreateCollectionResponse';
import type { CreateScopeRequest as _couchbase_admin_collection_v1_CreateScopeRequest, CreateScopeRequest__Output as _couchbase_admin_collection_v1_CreateScopeRequest__Output } from '../../../../couchbase/admin/collection/v1/CreateScopeRequest';
import type { CreateScopeResponse as _couchbase_admin_collection_v1_CreateScopeResponse, CreateScopeResponse__Output as _couchbase_admin_collection_v1_CreateScopeResponse__Output } from '../../../../couchbase/admin/collection/v1/CreateScopeResponse';
import type { DeleteCollectionRequest as _couchbase_admin_collection_v1_DeleteCollectionRequest, DeleteCollectionRequest__Output as _couchbase_admin_collection_v1_DeleteCollectionRequest__Output } from '../../../../couchbase/admin/collection/v1/DeleteCollectionRequest';
import type { DeleteCollectionResponse as _couchbase_admin_collection_v1_DeleteCollectionResponse, DeleteCollectionResponse__Output as _couchbase_admin_collection_v1_DeleteCollectionResponse__Output } from '../../../../couchbase/admin/collection/v1/DeleteCollectionResponse';
import type { DeleteScopeRequest as _couchbase_admin_collection_v1_DeleteScopeRequest, DeleteScopeRequest__Output as _couchbase_admin_collection_v1_DeleteScopeRequest__Output } from '../../../../couchbase/admin/collection/v1/DeleteScopeRequest';
import type { DeleteScopeResponse as _couchbase_admin_collection_v1_DeleteScopeResponse, DeleteScopeResponse__Output as _couchbase_admin_collection_v1_DeleteScopeResponse__Output } from '../../../../couchbase/admin/collection/v1/DeleteScopeResponse';
import type { ListCollectionsRequest as _couchbase_admin_collection_v1_ListCollectionsRequest, ListCollectionsRequest__Output as _couchbase_admin_collection_v1_ListCollectionsRequest__Output } from '../../../../couchbase/admin/collection/v1/ListCollectionsRequest';
import type { ListCollectionsResponse as _couchbase_admin_collection_v1_ListCollectionsResponse, ListCollectionsResponse__Output as _couchbase_admin_collection_v1_ListCollectionsResponse__Output } from '../../../../couchbase/admin/collection/v1/ListCollectionsResponse';
import type { UpdateCollectionRequest as _couchbase_admin_collection_v1_UpdateCollectionRequest, UpdateCollectionRequest__Output as _couchbase_admin_collection_v1_UpdateCollectionRequest__Output } from '../../../../couchbase/admin/collection/v1/UpdateCollectionRequest';
import type { UpdateCollectionResponse as _couchbase_admin_collection_v1_UpdateCollectionResponse, UpdateCollectionResponse__Output as _couchbase_admin_collection_v1_UpdateCollectionResponse__Output } from '../../../../couchbase/admin/collection/v1/UpdateCollectionResponse';

/**
 * CollectionAdminService provides CRUD for scopes and collections.
 */
export interface CollectionAdminServiceClient extends grpc.Client {
  /**
   * CreateCollection creates a new collection within a scope.
   */
  CreateCollection(argument: _couchbase_admin_collection_v1_CreateCollectionRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_CreateCollectionResponse__Output>): grpc.ClientUnaryCall;
  CreateCollection(argument: _couchbase_admin_collection_v1_CreateCollectionRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_collection_v1_CreateCollectionResponse__Output>): grpc.ClientUnaryCall;
  CreateCollection(argument: _couchbase_admin_collection_v1_CreateCollectionRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_CreateCollectionResponse__Output>): grpc.ClientUnaryCall;
  CreateCollection(argument: _couchbase_admin_collection_v1_CreateCollectionRequest, callback: grpc.requestCallback<_couchbase_admin_collection_v1_CreateCollectionResponse__Output>): grpc.ClientUnaryCall;
  /**
   * CreateCollection creates a new collection within a scope.
   */
  createCollection(argument: _couchbase_admin_collection_v1_CreateCollectionRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_CreateCollectionResponse__Output>): grpc.ClientUnaryCall;
  createCollection(argument: _couchbase_admin_collection_v1_CreateCollectionRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_collection_v1_CreateCollectionResponse__Output>): grpc.ClientUnaryCall;
  createCollection(argument: _couchbase_admin_collection_v1_CreateCollectionRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_CreateCollectionResponse__Output>): grpc.ClientUnaryCall;
  createCollection(argument: _couchbase_admin_collection_v1_CreateCollectionRequest, callback: grpc.requestCallback<_couchbase_admin_collection_v1_CreateCollectionResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * CreateScope creates a new scope within a bucket.
   */
  CreateScope(argument: _couchbase_admin_collection_v1_CreateScopeRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_CreateScopeResponse__Output>): grpc.ClientUnaryCall;
  CreateScope(argument: _couchbase_admin_collection_v1_CreateScopeRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_collection_v1_CreateScopeResponse__Output>): grpc.ClientUnaryCall;
  CreateScope(argument: _couchbase_admin_collection_v1_CreateScopeRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_CreateScopeResponse__Output>): grpc.ClientUnaryCall;
  CreateScope(argument: _couchbase_admin_collection_v1_CreateScopeRequest, callback: grpc.requestCallback<_couchbase_admin_collection_v1_CreateScopeResponse__Output>): grpc.ClientUnaryCall;
  /**
   * CreateScope creates a new scope within a bucket.
   */
  createScope(argument: _couchbase_admin_collection_v1_CreateScopeRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_CreateScopeResponse__Output>): grpc.ClientUnaryCall;
  createScope(argument: _couchbase_admin_collection_v1_CreateScopeRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_collection_v1_CreateScopeResponse__Output>): grpc.ClientUnaryCall;
  createScope(argument: _couchbase_admin_collection_v1_CreateScopeRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_CreateScopeResponse__Output>): grpc.ClientUnaryCall;
  createScope(argument: _couchbase_admin_collection_v1_CreateScopeRequest, callback: grpc.requestCallback<_couchbase_admin_collection_v1_CreateScopeResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * DeleteCollection removes a collection from a scope.
   */
  DeleteCollection(argument: _couchbase_admin_collection_v1_DeleteCollectionRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_DeleteCollectionResponse__Output>): grpc.ClientUnaryCall;
  DeleteCollection(argument: _couchbase_admin_collection_v1_DeleteCollectionRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_collection_v1_DeleteCollectionResponse__Output>): grpc.ClientUnaryCall;
  DeleteCollection(argument: _couchbase_admin_collection_v1_DeleteCollectionRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_DeleteCollectionResponse__Output>): grpc.ClientUnaryCall;
  DeleteCollection(argument: _couchbase_admin_collection_v1_DeleteCollectionRequest, callback: grpc.requestCallback<_couchbase_admin_collection_v1_DeleteCollectionResponse__Output>): grpc.ClientUnaryCall;
  /**
   * DeleteCollection removes a collection from a scope.
   */
  deleteCollection(argument: _couchbase_admin_collection_v1_DeleteCollectionRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_DeleteCollectionResponse__Output>): grpc.ClientUnaryCall;
  deleteCollection(argument: _couchbase_admin_collection_v1_DeleteCollectionRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_collection_v1_DeleteCollectionResponse__Output>): grpc.ClientUnaryCall;
  deleteCollection(argument: _couchbase_admin_collection_v1_DeleteCollectionRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_DeleteCollectionResponse__Output>): grpc.ClientUnaryCall;
  deleteCollection(argument: _couchbase_admin_collection_v1_DeleteCollectionRequest, callback: grpc.requestCallback<_couchbase_admin_collection_v1_DeleteCollectionResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * DeleteScope removes a scope and all its collections from a bucket.
   */
  DeleteScope(argument: _couchbase_admin_collection_v1_DeleteScopeRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_DeleteScopeResponse__Output>): grpc.ClientUnaryCall;
  DeleteScope(argument: _couchbase_admin_collection_v1_DeleteScopeRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_collection_v1_DeleteScopeResponse__Output>): grpc.ClientUnaryCall;
  DeleteScope(argument: _couchbase_admin_collection_v1_DeleteScopeRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_DeleteScopeResponse__Output>): grpc.ClientUnaryCall;
  DeleteScope(argument: _couchbase_admin_collection_v1_DeleteScopeRequest, callback: grpc.requestCallback<_couchbase_admin_collection_v1_DeleteScopeResponse__Output>): grpc.ClientUnaryCall;
  /**
   * DeleteScope removes a scope and all its collections from a bucket.
   */
  deleteScope(argument: _couchbase_admin_collection_v1_DeleteScopeRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_DeleteScopeResponse__Output>): grpc.ClientUnaryCall;
  deleteScope(argument: _couchbase_admin_collection_v1_DeleteScopeRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_collection_v1_DeleteScopeResponse__Output>): grpc.ClientUnaryCall;
  deleteScope(argument: _couchbase_admin_collection_v1_DeleteScopeRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_DeleteScopeResponse__Output>): grpc.ClientUnaryCall;
  deleteScope(argument: _couchbase_admin_collection_v1_DeleteScopeRequest, callback: grpc.requestCallback<_couchbase_admin_collection_v1_DeleteScopeResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * ListCollections returns all scopes and collections within a bucket,
   * along with the current manifest_uid.
   */
  ListCollections(argument: _couchbase_admin_collection_v1_ListCollectionsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_ListCollectionsResponse__Output>): grpc.ClientUnaryCall;
  ListCollections(argument: _couchbase_admin_collection_v1_ListCollectionsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_collection_v1_ListCollectionsResponse__Output>): grpc.ClientUnaryCall;
  ListCollections(argument: _couchbase_admin_collection_v1_ListCollectionsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_ListCollectionsResponse__Output>): grpc.ClientUnaryCall;
  ListCollections(argument: _couchbase_admin_collection_v1_ListCollectionsRequest, callback: grpc.requestCallback<_couchbase_admin_collection_v1_ListCollectionsResponse__Output>): grpc.ClientUnaryCall;
  /**
   * ListCollections returns all scopes and collections within a bucket,
   * along with the current manifest_uid.
   */
  listCollections(argument: _couchbase_admin_collection_v1_ListCollectionsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_ListCollectionsResponse__Output>): grpc.ClientUnaryCall;
  listCollections(argument: _couchbase_admin_collection_v1_ListCollectionsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_collection_v1_ListCollectionsResponse__Output>): grpc.ClientUnaryCall;
  listCollections(argument: _couchbase_admin_collection_v1_ListCollectionsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_ListCollectionsResponse__Output>): grpc.ClientUnaryCall;
  listCollections(argument: _couchbase_admin_collection_v1_ListCollectionsRequest, callback: grpc.requestCallback<_couchbase_admin_collection_v1_ListCollectionsResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * UpdateCollection modifies a collection's configuration (e.g., max expiry).
   */
  UpdateCollection(argument: _couchbase_admin_collection_v1_UpdateCollectionRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_UpdateCollectionResponse__Output>): grpc.ClientUnaryCall;
  UpdateCollection(argument: _couchbase_admin_collection_v1_UpdateCollectionRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_collection_v1_UpdateCollectionResponse__Output>): grpc.ClientUnaryCall;
  UpdateCollection(argument: _couchbase_admin_collection_v1_UpdateCollectionRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_UpdateCollectionResponse__Output>): grpc.ClientUnaryCall;
  UpdateCollection(argument: _couchbase_admin_collection_v1_UpdateCollectionRequest, callback: grpc.requestCallback<_couchbase_admin_collection_v1_UpdateCollectionResponse__Output>): grpc.ClientUnaryCall;
  /**
   * UpdateCollection modifies a collection's configuration (e.g., max expiry).
   */
  updateCollection(argument: _couchbase_admin_collection_v1_UpdateCollectionRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_UpdateCollectionResponse__Output>): grpc.ClientUnaryCall;
  updateCollection(argument: _couchbase_admin_collection_v1_UpdateCollectionRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_collection_v1_UpdateCollectionResponse__Output>): grpc.ClientUnaryCall;
  updateCollection(argument: _couchbase_admin_collection_v1_UpdateCollectionRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_collection_v1_UpdateCollectionResponse__Output>): grpc.ClientUnaryCall;
  updateCollection(argument: _couchbase_admin_collection_v1_UpdateCollectionRequest, callback: grpc.requestCallback<_couchbase_admin_collection_v1_UpdateCollectionResponse__Output>): grpc.ClientUnaryCall;
  
}

/**
 * CollectionAdminService provides CRUD for scopes and collections.
 */
export interface CollectionAdminServiceHandlers extends grpc.UntypedServiceImplementation {
  /**
   * CreateCollection creates a new collection within a scope.
   */
  CreateCollection: grpc.handleUnaryCall<_couchbase_admin_collection_v1_CreateCollectionRequest__Output, _couchbase_admin_collection_v1_CreateCollectionResponse>;
  
  /**
   * CreateScope creates a new scope within a bucket.
   */
  CreateScope: grpc.handleUnaryCall<_couchbase_admin_collection_v1_CreateScopeRequest__Output, _couchbase_admin_collection_v1_CreateScopeResponse>;
  
  /**
   * DeleteCollection removes a collection from a scope.
   */
  DeleteCollection: grpc.handleUnaryCall<_couchbase_admin_collection_v1_DeleteCollectionRequest__Output, _couchbase_admin_collection_v1_DeleteCollectionResponse>;
  
  /**
   * DeleteScope removes a scope and all its collections from a bucket.
   */
  DeleteScope: grpc.handleUnaryCall<_couchbase_admin_collection_v1_DeleteScopeRequest__Output, _couchbase_admin_collection_v1_DeleteScopeResponse>;
  
  /**
   * ListCollections returns all scopes and collections within a bucket,
   * along with the current manifest_uid.
   */
  ListCollections: grpc.handleUnaryCall<_couchbase_admin_collection_v1_ListCollectionsRequest__Output, _couchbase_admin_collection_v1_ListCollectionsResponse>;
  
  /**
   * UpdateCollection modifies a collection's configuration (e.g., max expiry).
   */
  UpdateCollection: grpc.handleUnaryCall<_couchbase_admin_collection_v1_UpdateCollectionRequest__Output, _couchbase_admin_collection_v1_UpdateCollectionResponse>;
  
}

export interface CollectionAdminServiceDefinition extends grpc.ServiceDefinition {
  CreateCollection: MethodDefinition<_couchbase_admin_collection_v1_CreateCollectionRequest, _couchbase_admin_collection_v1_CreateCollectionResponse, _couchbase_admin_collection_v1_CreateCollectionRequest__Output, _couchbase_admin_collection_v1_CreateCollectionResponse__Output>
  CreateScope: MethodDefinition<_couchbase_admin_collection_v1_CreateScopeRequest, _couchbase_admin_collection_v1_CreateScopeResponse, _couchbase_admin_collection_v1_CreateScopeRequest__Output, _couchbase_admin_collection_v1_CreateScopeResponse__Output>
  DeleteCollection: MethodDefinition<_couchbase_admin_collection_v1_DeleteCollectionRequest, _couchbase_admin_collection_v1_DeleteCollectionResponse, _couchbase_admin_collection_v1_DeleteCollectionRequest__Output, _couchbase_admin_collection_v1_DeleteCollectionResponse__Output>
  DeleteScope: MethodDefinition<_couchbase_admin_collection_v1_DeleteScopeRequest, _couchbase_admin_collection_v1_DeleteScopeResponse, _couchbase_admin_collection_v1_DeleteScopeRequest__Output, _couchbase_admin_collection_v1_DeleteScopeResponse__Output>
  ListCollections: MethodDefinition<_couchbase_admin_collection_v1_ListCollectionsRequest, _couchbase_admin_collection_v1_ListCollectionsResponse, _couchbase_admin_collection_v1_ListCollectionsRequest__Output, _couchbase_admin_collection_v1_ListCollectionsResponse__Output>
  UpdateCollection: MethodDefinition<_couchbase_admin_collection_v1_UpdateCollectionRequest, _couchbase_admin_collection_v1_UpdateCollectionResponse, _couchbase_admin_collection_v1_UpdateCollectionRequest__Output, _couchbase_admin_collection_v1_UpdateCollectionResponse__Output>
}
