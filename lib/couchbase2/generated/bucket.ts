import type * as grpc from '@grpc/grpc-js';
import type { EnumTypeDefinition, MessageTypeDefinition } from '@grpc/proto-loader';

import type { BucketAdminServiceClient as _couchbase_admin_bucket_v1_BucketAdminServiceClient, BucketAdminServiceDefinition as _couchbase_admin_bucket_v1_BucketAdminServiceDefinition } from './couchbase/admin/bucket/v1/BucketAdminService';
import type { CreateBucketRequest as _couchbase_admin_bucket_v1_CreateBucketRequest, CreateBucketRequest__Output as _couchbase_admin_bucket_v1_CreateBucketRequest__Output } from './couchbase/admin/bucket/v1/CreateBucketRequest';
import type { CreateBucketResponse as _couchbase_admin_bucket_v1_CreateBucketResponse, CreateBucketResponse__Output as _couchbase_admin_bucket_v1_CreateBucketResponse__Output } from './couchbase/admin/bucket/v1/CreateBucketResponse';
import type { DeleteBucketRequest as _couchbase_admin_bucket_v1_DeleteBucketRequest, DeleteBucketRequest__Output as _couchbase_admin_bucket_v1_DeleteBucketRequest__Output } from './couchbase/admin/bucket/v1/DeleteBucketRequest';
import type { DeleteBucketResponse as _couchbase_admin_bucket_v1_DeleteBucketResponse, DeleteBucketResponse__Output as _couchbase_admin_bucket_v1_DeleteBucketResponse__Output } from './couchbase/admin/bucket/v1/DeleteBucketResponse';
import type { FlushBucketRequest as _couchbase_admin_bucket_v1_FlushBucketRequest, FlushBucketRequest__Output as _couchbase_admin_bucket_v1_FlushBucketRequest__Output } from './couchbase/admin/bucket/v1/FlushBucketRequest';
import type { FlushBucketResponse as _couchbase_admin_bucket_v1_FlushBucketResponse, FlushBucketResponse__Output as _couchbase_admin_bucket_v1_FlushBucketResponse__Output } from './couchbase/admin/bucket/v1/FlushBucketResponse';
import type { ListBucketsRequest as _couchbase_admin_bucket_v1_ListBucketsRequest, ListBucketsRequest__Output as _couchbase_admin_bucket_v1_ListBucketsRequest__Output } from './couchbase/admin/bucket/v1/ListBucketsRequest';
import type { ListBucketsResponse as _couchbase_admin_bucket_v1_ListBucketsResponse, ListBucketsResponse__Output as _couchbase_admin_bucket_v1_ListBucketsResponse__Output } from './couchbase/admin/bucket/v1/ListBucketsResponse';
import type { UpdateBucketRequest as _couchbase_admin_bucket_v1_UpdateBucketRequest, UpdateBucketRequest__Output as _couchbase_admin_bucket_v1_UpdateBucketRequest__Output } from './couchbase/admin/bucket/v1/UpdateBucketRequest';
import type { UpdateBucketResponse as _couchbase_admin_bucket_v1_UpdateBucketResponse, UpdateBucketResponse__Output as _couchbase_admin_bucket_v1_UpdateBucketResponse__Output } from './couchbase/admin/bucket/v1/UpdateBucketResponse';
import type { AppendRequest as _couchbase_kv_v1_AppendRequest, AppendRequest__Output as _couchbase_kv_v1_AppendRequest__Output } from './couchbase/kv/v1/AppendRequest';
import type { AppendResponse as _couchbase_kv_v1_AppendResponse, AppendResponse__Output as _couchbase_kv_v1_AppendResponse__Output } from './couchbase/kv/v1/AppendResponse';
import type { DecrementRequest as _couchbase_kv_v1_DecrementRequest, DecrementRequest__Output as _couchbase_kv_v1_DecrementRequest__Output } from './couchbase/kv/v1/DecrementRequest';
import type { DecrementResponse as _couchbase_kv_v1_DecrementResponse, DecrementResponse__Output as _couchbase_kv_v1_DecrementResponse__Output } from './couchbase/kv/v1/DecrementResponse';
import type { ExistsRequest as _couchbase_kv_v1_ExistsRequest, ExistsRequest__Output as _couchbase_kv_v1_ExistsRequest__Output } from './couchbase/kv/v1/ExistsRequest';
import type { ExistsResponse as _couchbase_kv_v1_ExistsResponse, ExistsResponse__Output as _couchbase_kv_v1_ExistsResponse__Output } from './couchbase/kv/v1/ExistsResponse';
import type { GetAllReplicasRequest as _couchbase_kv_v1_GetAllReplicasRequest, GetAllReplicasRequest__Output as _couchbase_kv_v1_GetAllReplicasRequest__Output } from './couchbase/kv/v1/GetAllReplicasRequest';
import type { GetAllReplicasResponse as _couchbase_kv_v1_GetAllReplicasResponse, GetAllReplicasResponse__Output as _couchbase_kv_v1_GetAllReplicasResponse__Output } from './couchbase/kv/v1/GetAllReplicasResponse';
import type { GetAndLockRequest as _couchbase_kv_v1_GetAndLockRequest, GetAndLockRequest__Output as _couchbase_kv_v1_GetAndLockRequest__Output } from './couchbase/kv/v1/GetAndLockRequest';
import type { GetAndLockResponse as _couchbase_kv_v1_GetAndLockResponse, GetAndLockResponse__Output as _couchbase_kv_v1_GetAndLockResponse__Output } from './couchbase/kv/v1/GetAndLockResponse';
import type { GetAndTouchRequest as _couchbase_kv_v1_GetAndTouchRequest, GetAndTouchRequest__Output as _couchbase_kv_v1_GetAndTouchRequest__Output } from './couchbase/kv/v1/GetAndTouchRequest';
import type { GetAndTouchResponse as _couchbase_kv_v1_GetAndTouchResponse, GetAndTouchResponse__Output as _couchbase_kv_v1_GetAndTouchResponse__Output } from './couchbase/kv/v1/GetAndTouchResponse';
import type { GetRequest as _couchbase_kv_v1_GetRequest, GetRequest__Output as _couchbase_kv_v1_GetRequest__Output } from './couchbase/kv/v1/GetRequest';
import type { GetResponse as _couchbase_kv_v1_GetResponse, GetResponse__Output as _couchbase_kv_v1_GetResponse__Output } from './couchbase/kv/v1/GetResponse';
import type { IncrementRequest as _couchbase_kv_v1_IncrementRequest, IncrementRequest__Output as _couchbase_kv_v1_IncrementRequest__Output } from './couchbase/kv/v1/IncrementRequest';
import type { IncrementResponse as _couchbase_kv_v1_IncrementResponse, IncrementResponse__Output as _couchbase_kv_v1_IncrementResponse__Output } from './couchbase/kv/v1/IncrementResponse';
import type { InsertRequest as _couchbase_kv_v1_InsertRequest, InsertRequest__Output as _couchbase_kv_v1_InsertRequest__Output } from './couchbase/kv/v1/InsertRequest';
import type { InsertResponse as _couchbase_kv_v1_InsertResponse, InsertResponse__Output as _couchbase_kv_v1_InsertResponse__Output } from './couchbase/kv/v1/InsertResponse';
import type { KvServiceClient as _couchbase_kv_v1_KvServiceClient, KvServiceDefinition as _couchbase_kv_v1_KvServiceDefinition } from './couchbase/kv/v1/KvService';
import type { LegacyDurabilitySpec as _couchbase_kv_v1_LegacyDurabilitySpec, LegacyDurabilitySpec__Output as _couchbase_kv_v1_LegacyDurabilitySpec__Output } from './couchbase/kv/v1/LegacyDurabilitySpec';
import type { LookupInRequest as _couchbase_kv_v1_LookupInRequest, LookupInRequest__Output as _couchbase_kv_v1_LookupInRequest__Output } from './couchbase/kv/v1/LookupInRequest';
import type { LookupInResponse as _couchbase_kv_v1_LookupInResponse, LookupInResponse__Output as _couchbase_kv_v1_LookupInResponse__Output } from './couchbase/kv/v1/LookupInResponse';
import type { MutateInRequest as _couchbase_kv_v1_MutateInRequest, MutateInRequest__Output as _couchbase_kv_v1_MutateInRequest__Output } from './couchbase/kv/v1/MutateInRequest';
import type { MutateInResponse as _couchbase_kv_v1_MutateInResponse, MutateInResponse__Output as _couchbase_kv_v1_MutateInResponse__Output } from './couchbase/kv/v1/MutateInResponse';
import type { MutationToken as _couchbase_kv_v1_MutationToken, MutationToken__Output as _couchbase_kv_v1_MutationToken__Output } from './couchbase/kv/v1/MutationToken';
import type { PrependRequest as _couchbase_kv_v1_PrependRequest, PrependRequest__Output as _couchbase_kv_v1_PrependRequest__Output } from './couchbase/kv/v1/PrependRequest';
import type { PrependResponse as _couchbase_kv_v1_PrependResponse, PrependResponse__Output as _couchbase_kv_v1_PrependResponse__Output } from './couchbase/kv/v1/PrependResponse';
import type { RemoveRequest as _couchbase_kv_v1_RemoveRequest, RemoveRequest__Output as _couchbase_kv_v1_RemoveRequest__Output } from './couchbase/kv/v1/RemoveRequest';
import type { RemoveResponse as _couchbase_kv_v1_RemoveResponse, RemoveResponse__Output as _couchbase_kv_v1_RemoveResponse__Output } from './couchbase/kv/v1/RemoveResponse';
import type { ReplaceRequest as _couchbase_kv_v1_ReplaceRequest, ReplaceRequest__Output as _couchbase_kv_v1_ReplaceRequest__Output } from './couchbase/kv/v1/ReplaceRequest';
import type { ReplaceResponse as _couchbase_kv_v1_ReplaceResponse, ReplaceResponse__Output as _couchbase_kv_v1_ReplaceResponse__Output } from './couchbase/kv/v1/ReplaceResponse';
import type { TouchRequest as _couchbase_kv_v1_TouchRequest, TouchRequest__Output as _couchbase_kv_v1_TouchRequest__Output } from './couchbase/kv/v1/TouchRequest';
import type { TouchResponse as _couchbase_kv_v1_TouchResponse, TouchResponse__Output as _couchbase_kv_v1_TouchResponse__Output } from './couchbase/kv/v1/TouchResponse';
import type { UnlockRequest as _couchbase_kv_v1_UnlockRequest, UnlockRequest__Output as _couchbase_kv_v1_UnlockRequest__Output } from './couchbase/kv/v1/UnlockRequest';
import type { UnlockResponse as _couchbase_kv_v1_UnlockResponse, UnlockResponse__Output as _couchbase_kv_v1_UnlockResponse__Output } from './couchbase/kv/v1/UnlockResponse';
import type { UpsertRequest as _couchbase_kv_v1_UpsertRequest, UpsertRequest__Output as _couchbase_kv_v1_UpsertRequest__Output } from './couchbase/kv/v1/UpsertRequest';
import type { UpsertResponse as _couchbase_kv_v1_UpsertResponse, UpsertResponse__Output as _couchbase_kv_v1_UpsertResponse__Output } from './couchbase/kv/v1/UpsertResponse';
import type { Any as _google_protobuf_Any, Any__Output as _google_protobuf_Any__Output } from './google/protobuf/Any';
import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from './google/protobuf/Timestamp';
import type { Status as _google_rpc_Status, Status__Output as _google_rpc_Status__Output } from './google/rpc/Status';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  couchbase: {
    admin: {
      bucket: {
        v1: {
          /**
           * BucketAdminService provides CRUD operations for Couchbase buckets.
           */
          BucketAdminService: SubtypeConstructor<typeof grpc.Client, _couchbase_admin_bucket_v1_BucketAdminServiceClient> & { service: _couchbase_admin_bucket_v1_BucketAdminServiceDefinition }
          BucketType: EnumTypeDefinition
          CompressionMode: EnumTypeDefinition
          ConflictResolutionType: EnumTypeDefinition
          CreateBucketRequest: MessageTypeDefinition<_couchbase_admin_bucket_v1_CreateBucketRequest, _couchbase_admin_bucket_v1_CreateBucketRequest__Output>
          CreateBucketResponse: MessageTypeDefinition<_couchbase_admin_bucket_v1_CreateBucketResponse, _couchbase_admin_bucket_v1_CreateBucketResponse__Output>
          DeleteBucketRequest: MessageTypeDefinition<_couchbase_admin_bucket_v1_DeleteBucketRequest, _couchbase_admin_bucket_v1_DeleteBucketRequest__Output>
          DeleteBucketResponse: MessageTypeDefinition<_couchbase_admin_bucket_v1_DeleteBucketResponse, _couchbase_admin_bucket_v1_DeleteBucketResponse__Output>
          EvictionMode: EnumTypeDefinition
          FlushBucketRequest: MessageTypeDefinition<_couchbase_admin_bucket_v1_FlushBucketRequest, _couchbase_admin_bucket_v1_FlushBucketRequest__Output>
          FlushBucketResponse: MessageTypeDefinition<_couchbase_admin_bucket_v1_FlushBucketResponse, _couchbase_admin_bucket_v1_FlushBucketResponse__Output>
          ListBucketsRequest: MessageTypeDefinition<_couchbase_admin_bucket_v1_ListBucketsRequest, _couchbase_admin_bucket_v1_ListBucketsRequest__Output>
          ListBucketsResponse: MessageTypeDefinition<_couchbase_admin_bucket_v1_ListBucketsResponse, _couchbase_admin_bucket_v1_ListBucketsResponse__Output>
          StorageBackend: EnumTypeDefinition
          UpdateBucketRequest: MessageTypeDefinition<_couchbase_admin_bucket_v1_UpdateBucketRequest, _couchbase_admin_bucket_v1_UpdateBucketRequest__Output>
          UpdateBucketResponse: MessageTypeDefinition<_couchbase_admin_bucket_v1_UpdateBucketResponse, _couchbase_admin_bucket_v1_UpdateBucketResponse__Output>
        }
      }
    }
    kv: {
      v1: {
        AppendRequest: MessageTypeDefinition<_couchbase_kv_v1_AppendRequest, _couchbase_kv_v1_AppendRequest__Output>
        AppendResponse: MessageTypeDefinition<_couchbase_kv_v1_AppendResponse, _couchbase_kv_v1_AppendResponse__Output>
        CompressionEnabled: EnumTypeDefinition
        DecrementRequest: MessageTypeDefinition<_couchbase_kv_v1_DecrementRequest, _couchbase_kv_v1_DecrementRequest__Output>
        DecrementResponse: MessageTypeDefinition<_couchbase_kv_v1_DecrementResponse, _couchbase_kv_v1_DecrementResponse__Output>
        DurabilityLevel: EnumTypeDefinition
        ExistsRequest: MessageTypeDefinition<_couchbase_kv_v1_ExistsRequest, _couchbase_kv_v1_ExistsRequest__Output>
        ExistsResponse: MessageTypeDefinition<_couchbase_kv_v1_ExistsResponse, _couchbase_kv_v1_ExistsResponse__Output>
        GetAllReplicasRequest: MessageTypeDefinition<_couchbase_kv_v1_GetAllReplicasRequest, _couchbase_kv_v1_GetAllReplicasRequest__Output>
        GetAllReplicasResponse: MessageTypeDefinition<_couchbase_kv_v1_GetAllReplicasResponse, _couchbase_kv_v1_GetAllReplicasResponse__Output>
        GetAndLockRequest: MessageTypeDefinition<_couchbase_kv_v1_GetAndLockRequest, _couchbase_kv_v1_GetAndLockRequest__Output>
        GetAndLockResponse: MessageTypeDefinition<_couchbase_kv_v1_GetAndLockResponse, _couchbase_kv_v1_GetAndLockResponse__Output>
        GetAndTouchRequest: MessageTypeDefinition<_couchbase_kv_v1_GetAndTouchRequest, _couchbase_kv_v1_GetAndTouchRequest__Output>
        GetAndTouchResponse: MessageTypeDefinition<_couchbase_kv_v1_GetAndTouchResponse, _couchbase_kv_v1_GetAndTouchResponse__Output>
        GetRequest: MessageTypeDefinition<_couchbase_kv_v1_GetRequest, _couchbase_kv_v1_GetRequest__Output>
        GetResponse: MessageTypeDefinition<_couchbase_kv_v1_GetResponse, _couchbase_kv_v1_GetResponse__Output>
        IncrementRequest: MessageTypeDefinition<_couchbase_kv_v1_IncrementRequest, _couchbase_kv_v1_IncrementRequest__Output>
        IncrementResponse: MessageTypeDefinition<_couchbase_kv_v1_IncrementResponse, _couchbase_kv_v1_IncrementResponse__Output>
        InsertRequest: MessageTypeDefinition<_couchbase_kv_v1_InsertRequest, _couchbase_kv_v1_InsertRequest__Output>
        InsertResponse: MessageTypeDefinition<_couchbase_kv_v1_InsertResponse, _couchbase_kv_v1_InsertResponse__Output>
        /**
         * KvService provides key-value document operations against a Couchbase cluster.
         * Operations are organized into reads, mutations, counters, binary operations,
         * sub-document operations, and replica reads.
         */
        KvService: SubtypeConstructor<typeof grpc.Client, _couchbase_kv_v1_KvServiceClient> & { service: _couchbase_kv_v1_KvServiceDefinition }
        LegacyDurabilitySpec: MessageTypeDefinition<_couchbase_kv_v1_LegacyDurabilitySpec, _couchbase_kv_v1_LegacyDurabilitySpec__Output>
        LookupInRequest: MessageTypeDefinition<_couchbase_kv_v1_LookupInRequest, _couchbase_kv_v1_LookupInRequest__Output>
        LookupInResponse: MessageTypeDefinition<_couchbase_kv_v1_LookupInResponse, _couchbase_kv_v1_LookupInResponse__Output>
        MutateInRequest: MessageTypeDefinition<_couchbase_kv_v1_MutateInRequest, _couchbase_kv_v1_MutateInRequest__Output>
        MutateInResponse: MessageTypeDefinition<_couchbase_kv_v1_MutateInResponse, _couchbase_kv_v1_MutateInResponse__Output>
        MutationToken: MessageTypeDefinition<_couchbase_kv_v1_MutationToken, _couchbase_kv_v1_MutationToken__Output>
        PrependRequest: MessageTypeDefinition<_couchbase_kv_v1_PrependRequest, _couchbase_kv_v1_PrependRequest__Output>
        PrependResponse: MessageTypeDefinition<_couchbase_kv_v1_PrependResponse, _couchbase_kv_v1_PrependResponse__Output>
        RemoveRequest: MessageTypeDefinition<_couchbase_kv_v1_RemoveRequest, _couchbase_kv_v1_RemoveRequest__Output>
        RemoveResponse: MessageTypeDefinition<_couchbase_kv_v1_RemoveResponse, _couchbase_kv_v1_RemoveResponse__Output>
        ReplaceRequest: MessageTypeDefinition<_couchbase_kv_v1_ReplaceRequest, _couchbase_kv_v1_ReplaceRequest__Output>
        ReplaceResponse: MessageTypeDefinition<_couchbase_kv_v1_ReplaceResponse, _couchbase_kv_v1_ReplaceResponse__Output>
        TouchRequest: MessageTypeDefinition<_couchbase_kv_v1_TouchRequest, _couchbase_kv_v1_TouchRequest__Output>
        TouchResponse: MessageTypeDefinition<_couchbase_kv_v1_TouchResponse, _couchbase_kv_v1_TouchResponse__Output>
        UnlockRequest: MessageTypeDefinition<_couchbase_kv_v1_UnlockRequest, _couchbase_kv_v1_UnlockRequest__Output>
        UnlockResponse: MessageTypeDefinition<_couchbase_kv_v1_UnlockResponse, _couchbase_kv_v1_UnlockResponse__Output>
        UpsertRequest: MessageTypeDefinition<_couchbase_kv_v1_UpsertRequest, _couchbase_kv_v1_UpsertRequest__Output>
        UpsertResponse: MessageTypeDefinition<_couchbase_kv_v1_UpsertResponse, _couchbase_kv_v1_UpsertResponse__Output>
      }
    }
  }
  google: {
    protobuf: {
      Any: MessageTypeDefinition<_google_protobuf_Any, _google_protobuf_Any__Output>
      Timestamp: MessageTypeDefinition<_google_protobuf_Timestamp, _google_protobuf_Timestamp__Output>
    }
    rpc: {
      Status: MessageTypeDefinition<_google_rpc_Status, _google_rpc_Status__Output>
    }
  }
}

