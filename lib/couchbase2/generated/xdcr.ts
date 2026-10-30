import type * as grpc from '@grpc/grpc-js';
import type { EnumTypeDefinition, MessageTypeDefinition } from '@grpc/proto-loader';

import type { CheckDocumentRequest as _couchbase_internal_xdcr_v1_CheckDocumentRequest, CheckDocumentRequest__Output as _couchbase_internal_xdcr_v1_CheckDocumentRequest__Output } from './couchbase/internal/xdcr/v1/CheckDocumentRequest';
import type { CheckDocumentResponse as _couchbase_internal_xdcr_v1_CheckDocumentResponse, CheckDocumentResponse__Output as _couchbase_internal_xdcr_v1_CheckDocumentResponse__Output } from './couchbase/internal/xdcr/v1/CheckDocumentResponse';
import type { GetBucketInfoRequest as _couchbase_internal_xdcr_v1_GetBucketInfoRequest, GetBucketInfoRequest__Output as _couchbase_internal_xdcr_v1_GetBucketInfoRequest__Output } from './couchbase/internal/xdcr/v1/GetBucketInfoRequest';
import type { GetBucketInfoResponse as _couchbase_internal_xdcr_v1_GetBucketInfoResponse, GetBucketInfoResponse__Output as _couchbase_internal_xdcr_v1_GetBucketInfoResponse__Output } from './couchbase/internal/xdcr/v1/GetBucketInfoResponse';
import type { GetClusterInfoRequest as _couchbase_internal_xdcr_v1_GetClusterInfoRequest, GetClusterInfoRequest__Output as _couchbase_internal_xdcr_v1_GetClusterInfoRequest__Output } from './couchbase/internal/xdcr/v1/GetClusterInfoRequest';
import type { GetClusterInfoResponse as _couchbase_internal_xdcr_v1_GetClusterInfoResponse, GetClusterInfoResponse__Output as _couchbase_internal_xdcr_v1_GetClusterInfoResponse__Output } from './couchbase/internal/xdcr/v1/GetClusterInfoResponse';
import type { GetDocumentRequest as _couchbase_internal_xdcr_v1_GetDocumentRequest, GetDocumentRequest__Output as _couchbase_internal_xdcr_v1_GetDocumentRequest__Output } from './couchbase/internal/xdcr/v1/GetDocumentRequest';
import type { GetDocumentResponse as _couchbase_internal_xdcr_v1_GetDocumentResponse, GetDocumentResponse__Output as _couchbase_internal_xdcr_v1_GetDocumentResponse__Output } from './couchbase/internal/xdcr/v1/GetDocumentResponse';
import type { GetVbucketInfoRequest as _couchbase_internal_xdcr_v1_GetVbucketInfoRequest, GetVbucketInfoRequest__Output as _couchbase_internal_xdcr_v1_GetVbucketInfoRequest__Output } from './couchbase/internal/xdcr/v1/GetVbucketInfoRequest';
import type { GetVbucketInfoResponse as _couchbase_internal_xdcr_v1_GetVbucketInfoResponse, GetVbucketInfoResponse__Output as _couchbase_internal_xdcr_v1_GetVbucketInfoResponse__Output } from './couchbase/internal/xdcr/v1/GetVbucketInfoResponse';
import type { HeartbeatRequest as _couchbase_internal_xdcr_v1_HeartbeatRequest, HeartbeatRequest__Output as _couchbase_internal_xdcr_v1_HeartbeatRequest__Output } from './couchbase/internal/xdcr/v1/HeartbeatRequest';
import type { HeartbeatResponse as _couchbase_internal_xdcr_v1_HeartbeatResponse, HeartbeatResponse__Output as _couchbase_internal_xdcr_v1_HeartbeatResponse__Output } from './couchbase/internal/xdcr/v1/HeartbeatResponse';
import type { PushDocumentRequest as _couchbase_internal_xdcr_v1_PushDocumentRequest, PushDocumentRequest__Output as _couchbase_internal_xdcr_v1_PushDocumentRequest__Output } from './couchbase/internal/xdcr/v1/PushDocumentRequest';
import type { PushDocumentResponse as _couchbase_internal_xdcr_v1_PushDocumentResponse, PushDocumentResponse__Output as _couchbase_internal_xdcr_v1_PushDocumentResponse__Output } from './couchbase/internal/xdcr/v1/PushDocumentResponse';
import type { WatchCollectionsRequest as _couchbase_internal_xdcr_v1_WatchCollectionsRequest, WatchCollectionsRequest__Output as _couchbase_internal_xdcr_v1_WatchCollectionsRequest__Output } from './couchbase/internal/xdcr/v1/WatchCollectionsRequest';
import type { WatchCollectionsResponse as _couchbase_internal_xdcr_v1_WatchCollectionsResponse, WatchCollectionsResponse__Output as _couchbase_internal_xdcr_v1_WatchCollectionsResponse__Output } from './couchbase/internal/xdcr/v1/WatchCollectionsResponse';
import type { XdcrServiceClient as _couchbase_internal_xdcr_v1_XdcrServiceClient, XdcrServiceDefinition as _couchbase_internal_xdcr_v1_XdcrServiceDefinition } from './couchbase/internal/xdcr/v1/XdcrService';
import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from './google/protobuf/Timestamp';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  couchbase: {
    internal: {
      xdcr: {
        v1: {
          BucketType: EnumTypeDefinition
          CheckDocumentRequest: MessageTypeDefinition<_couchbase_internal_xdcr_v1_CheckDocumentRequest, _couchbase_internal_xdcr_v1_CheckDocumentRequest__Output>
          CheckDocumentResponse: MessageTypeDefinition<_couchbase_internal_xdcr_v1_CheckDocumentResponse, _couchbase_internal_xdcr_v1_CheckDocumentResponse__Output>
          ClusterEdition: EnumTypeDefinition
          ConflictResolutionType: EnumTypeDefinition
          ContentType: EnumTypeDefinition
          GetBucketInfoRequest: MessageTypeDefinition<_couchbase_internal_xdcr_v1_GetBucketInfoRequest, _couchbase_internal_xdcr_v1_GetBucketInfoRequest__Output>
          GetBucketInfoResponse: MessageTypeDefinition<_couchbase_internal_xdcr_v1_GetBucketInfoResponse, _couchbase_internal_xdcr_v1_GetBucketInfoResponse__Output>
          GetClusterInfoRequest: MessageTypeDefinition<_couchbase_internal_xdcr_v1_GetClusterInfoRequest, _couchbase_internal_xdcr_v1_GetClusterInfoRequest__Output>
          GetClusterInfoResponse: MessageTypeDefinition<_couchbase_internal_xdcr_v1_GetClusterInfoResponse, _couchbase_internal_xdcr_v1_GetClusterInfoResponse__Output>
          GetDocumentRequest: MessageTypeDefinition<_couchbase_internal_xdcr_v1_GetDocumentRequest, _couchbase_internal_xdcr_v1_GetDocumentRequest__Output>
          GetDocumentResponse: MessageTypeDefinition<_couchbase_internal_xdcr_v1_GetDocumentResponse, _couchbase_internal_xdcr_v1_GetDocumentResponse__Output>
          GetVbucketInfoRequest: MessageTypeDefinition<_couchbase_internal_xdcr_v1_GetVbucketInfoRequest, _couchbase_internal_xdcr_v1_GetVbucketInfoRequest__Output>
          GetVbucketInfoResponse: MessageTypeDefinition<_couchbase_internal_xdcr_v1_GetVbucketInfoResponse, _couchbase_internal_xdcr_v1_GetVbucketInfoResponse__Output>
          HeartbeatRequest: MessageTypeDefinition<_couchbase_internal_xdcr_v1_HeartbeatRequest, _couchbase_internal_xdcr_v1_HeartbeatRequest__Output>
          HeartbeatResponse: MessageTypeDefinition<_couchbase_internal_xdcr_v1_HeartbeatResponse, _couchbase_internal_xdcr_v1_HeartbeatResponse__Output>
          PushDocumentRequest: MessageTypeDefinition<_couchbase_internal_xdcr_v1_PushDocumentRequest, _couchbase_internal_xdcr_v1_PushDocumentRequest__Output>
          PushDocumentResponse: MessageTypeDefinition<_couchbase_internal_xdcr_v1_PushDocumentResponse, _couchbase_internal_xdcr_v1_PushDocumentResponse__Output>
          WatchCollectionsRequest: MessageTypeDefinition<_couchbase_internal_xdcr_v1_WatchCollectionsRequest, _couchbase_internal_xdcr_v1_WatchCollectionsRequest__Output>
          WatchCollectionsResponse: MessageTypeDefinition<_couchbase_internal_xdcr_v1_WatchCollectionsResponse, _couchbase_internal_xdcr_v1_WatchCollectionsResponse__Output>
          /**
           * XdcrService provides XDCR replication operations.
           * @uncommitted This service is not yet stable and may change without warning.
           */
          XdcrService: SubtypeConstructor<typeof grpc.Client, _couchbase_internal_xdcr_v1_XdcrServiceClient> & { service: _couchbase_internal_xdcr_v1_XdcrServiceDefinition }
        }
      }
    }
  }
  google: {
    protobuf: {
      Timestamp: MessageTypeDefinition<_google_protobuf_Timestamp, _google_protobuf_Timestamp__Output>
    }
  }
}

