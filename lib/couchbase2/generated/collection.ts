import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { CollectionAdminServiceClient as _couchbase_admin_collection_v1_CollectionAdminServiceClient, CollectionAdminServiceDefinition as _couchbase_admin_collection_v1_CollectionAdminServiceDefinition } from './couchbase/admin/collection/v1/CollectionAdminService';
import type { CreateCollectionRequest as _couchbase_admin_collection_v1_CreateCollectionRequest, CreateCollectionRequest__Output as _couchbase_admin_collection_v1_CreateCollectionRequest__Output } from './couchbase/admin/collection/v1/CreateCollectionRequest';
import type { CreateCollectionResponse as _couchbase_admin_collection_v1_CreateCollectionResponse, CreateCollectionResponse__Output as _couchbase_admin_collection_v1_CreateCollectionResponse__Output } from './couchbase/admin/collection/v1/CreateCollectionResponse';
import type { CreateScopeRequest as _couchbase_admin_collection_v1_CreateScopeRequest, CreateScopeRequest__Output as _couchbase_admin_collection_v1_CreateScopeRequest__Output } from './couchbase/admin/collection/v1/CreateScopeRequest';
import type { CreateScopeResponse as _couchbase_admin_collection_v1_CreateScopeResponse, CreateScopeResponse__Output as _couchbase_admin_collection_v1_CreateScopeResponse__Output } from './couchbase/admin/collection/v1/CreateScopeResponse';
import type { DeleteCollectionRequest as _couchbase_admin_collection_v1_DeleteCollectionRequest, DeleteCollectionRequest__Output as _couchbase_admin_collection_v1_DeleteCollectionRequest__Output } from './couchbase/admin/collection/v1/DeleteCollectionRequest';
import type { DeleteCollectionResponse as _couchbase_admin_collection_v1_DeleteCollectionResponse, DeleteCollectionResponse__Output as _couchbase_admin_collection_v1_DeleteCollectionResponse__Output } from './couchbase/admin/collection/v1/DeleteCollectionResponse';
import type { DeleteScopeRequest as _couchbase_admin_collection_v1_DeleteScopeRequest, DeleteScopeRequest__Output as _couchbase_admin_collection_v1_DeleteScopeRequest__Output } from './couchbase/admin/collection/v1/DeleteScopeRequest';
import type { DeleteScopeResponse as _couchbase_admin_collection_v1_DeleteScopeResponse, DeleteScopeResponse__Output as _couchbase_admin_collection_v1_DeleteScopeResponse__Output } from './couchbase/admin/collection/v1/DeleteScopeResponse';
import type { ListCollectionsRequest as _couchbase_admin_collection_v1_ListCollectionsRequest, ListCollectionsRequest__Output as _couchbase_admin_collection_v1_ListCollectionsRequest__Output } from './couchbase/admin/collection/v1/ListCollectionsRequest';
import type { ListCollectionsResponse as _couchbase_admin_collection_v1_ListCollectionsResponse, ListCollectionsResponse__Output as _couchbase_admin_collection_v1_ListCollectionsResponse__Output } from './couchbase/admin/collection/v1/ListCollectionsResponse';
import type { UpdateCollectionRequest as _couchbase_admin_collection_v1_UpdateCollectionRequest, UpdateCollectionRequest__Output as _couchbase_admin_collection_v1_UpdateCollectionRequest__Output } from './couchbase/admin/collection/v1/UpdateCollectionRequest';
import type { UpdateCollectionResponse as _couchbase_admin_collection_v1_UpdateCollectionResponse, UpdateCollectionResponse__Output as _couchbase_admin_collection_v1_UpdateCollectionResponse__Output } from './couchbase/admin/collection/v1/UpdateCollectionResponse';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  couchbase: {
    admin: {
      collection: {
        v1: {
          /**
           * CollectionAdminService provides CRUD for scopes and collections.
           */
          CollectionAdminService: SubtypeConstructor<typeof grpc.Client, _couchbase_admin_collection_v1_CollectionAdminServiceClient> & { service: _couchbase_admin_collection_v1_CollectionAdminServiceDefinition }
          CreateCollectionRequest: MessageTypeDefinition<_couchbase_admin_collection_v1_CreateCollectionRequest, _couchbase_admin_collection_v1_CreateCollectionRequest__Output>
          CreateCollectionResponse: MessageTypeDefinition<_couchbase_admin_collection_v1_CreateCollectionResponse, _couchbase_admin_collection_v1_CreateCollectionResponse__Output>
          CreateScopeRequest: MessageTypeDefinition<_couchbase_admin_collection_v1_CreateScopeRequest, _couchbase_admin_collection_v1_CreateScopeRequest__Output>
          CreateScopeResponse: MessageTypeDefinition<_couchbase_admin_collection_v1_CreateScopeResponse, _couchbase_admin_collection_v1_CreateScopeResponse__Output>
          DeleteCollectionRequest: MessageTypeDefinition<_couchbase_admin_collection_v1_DeleteCollectionRequest, _couchbase_admin_collection_v1_DeleteCollectionRequest__Output>
          DeleteCollectionResponse: MessageTypeDefinition<_couchbase_admin_collection_v1_DeleteCollectionResponse, _couchbase_admin_collection_v1_DeleteCollectionResponse__Output>
          DeleteScopeRequest: MessageTypeDefinition<_couchbase_admin_collection_v1_DeleteScopeRequest, _couchbase_admin_collection_v1_DeleteScopeRequest__Output>
          DeleteScopeResponse: MessageTypeDefinition<_couchbase_admin_collection_v1_DeleteScopeResponse, _couchbase_admin_collection_v1_DeleteScopeResponse__Output>
          ListCollectionsRequest: MessageTypeDefinition<_couchbase_admin_collection_v1_ListCollectionsRequest, _couchbase_admin_collection_v1_ListCollectionsRequest__Output>
          ListCollectionsResponse: MessageTypeDefinition<_couchbase_admin_collection_v1_ListCollectionsResponse, _couchbase_admin_collection_v1_ListCollectionsResponse__Output>
          UpdateCollectionRequest: MessageTypeDefinition<_couchbase_admin_collection_v1_UpdateCollectionRequest, _couchbase_admin_collection_v1_UpdateCollectionRequest__Output>
          UpdateCollectionResponse: MessageTypeDefinition<_couchbase_admin_collection_v1_UpdateCollectionResponse, _couchbase_admin_collection_v1_UpdateCollectionResponse__Output>
        }
      }
    }
  }
}

