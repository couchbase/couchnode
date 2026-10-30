import type * as grpc from '@grpc/grpc-js';
import type { EnumTypeDefinition, MessageTypeDefinition } from '@grpc/proto-loader';

import type { AnalyticsAdminServiceClient as _couchbase_admin_analytics_v1_AnalyticsAdminServiceClient, AnalyticsAdminServiceDefinition as _couchbase_admin_analytics_v1_AnalyticsAdminServiceDefinition } from './couchbase/admin/analytics/v1/AnalyticsAdminService';
import type { CreateLinkRequest as _couchbase_admin_analytics_v1_CreateLinkRequest, CreateLinkRequest__Output as _couchbase_admin_analytics_v1_CreateLinkRequest__Output } from './couchbase/admin/analytics/v1/CreateLinkRequest';
import type { CreateLinkResponse as _couchbase_admin_analytics_v1_CreateLinkResponse, CreateLinkResponse__Output as _couchbase_admin_analytics_v1_CreateLinkResponse__Output } from './couchbase/admin/analytics/v1/CreateLinkResponse';
import type { DeleteLinkRequest as _couchbase_admin_analytics_v1_DeleteLinkRequest, DeleteLinkRequest__Output as _couchbase_admin_analytics_v1_DeleteLinkRequest__Output } from './couchbase/admin/analytics/v1/DeleteLinkRequest';
import type { DeleteLinkResponse as _couchbase_admin_analytics_v1_DeleteLinkResponse, DeleteLinkResponse__Output as _couchbase_admin_analytics_v1_DeleteLinkResponse__Output } from './couchbase/admin/analytics/v1/DeleteLinkResponse';
import type { GetIngestionStatusRequest as _couchbase_admin_analytics_v1_GetIngestionStatusRequest, GetIngestionStatusRequest__Output as _couchbase_admin_analytics_v1_GetIngestionStatusRequest__Output } from './couchbase/admin/analytics/v1/GetIngestionStatusRequest';
import type { GetIngestionStatusResponse as _couchbase_admin_analytics_v1_GetIngestionStatusResponse, GetIngestionStatusResponse__Output as _couchbase_admin_analytics_v1_GetIngestionStatusResponse__Output } from './couchbase/admin/analytics/v1/GetIngestionStatusResponse';
import type { GetLinkRequest as _couchbase_admin_analytics_v1_GetLinkRequest, GetLinkRequest__Output as _couchbase_admin_analytics_v1_GetLinkRequest__Output } from './couchbase/admin/analytics/v1/GetLinkRequest';
import type { GetLinkResponse as _couchbase_admin_analytics_v1_GetLinkResponse, GetLinkResponse__Output as _couchbase_admin_analytics_v1_GetLinkResponse__Output } from './couchbase/admin/analytics/v1/GetLinkResponse';
import type { UpdateLinkRequest as _couchbase_admin_analytics_v1_UpdateLinkRequest, UpdateLinkRequest__Output as _couchbase_admin_analytics_v1_UpdateLinkRequest__Output } from './couchbase/admin/analytics/v1/UpdateLinkRequest';
import type { UpdateLinkResponse as _couchbase_admin_analytics_v1_UpdateLinkResponse, UpdateLinkResponse__Output as _couchbase_admin_analytics_v1_UpdateLinkResponse__Output } from './couchbase/admin/analytics/v1/UpdateLinkResponse';
import type { AnalyticsQueryRequest as _couchbase_analytics_v1_AnalyticsQueryRequest, AnalyticsQueryRequest__Output as _couchbase_analytics_v1_AnalyticsQueryRequest__Output } from './couchbase/analytics/v1/AnalyticsQueryRequest';
import type { AnalyticsQueryResponse as _couchbase_analytics_v1_AnalyticsQueryResponse, AnalyticsQueryResponse__Output as _couchbase_analytics_v1_AnalyticsQueryResponse__Output } from './couchbase/analytics/v1/AnalyticsQueryResponse';
import type { AnalyticsServiceClient as _couchbase_analytics_v1_AnalyticsServiceClient, AnalyticsServiceDefinition as _couchbase_analytics_v1_AnalyticsServiceDefinition } from './couchbase/analytics/v1/AnalyticsService';
import type { Duration as _google_protobuf_Duration, Duration__Output as _google_protobuf_Duration__Output } from './google/protobuf/Duration';
import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from './google/protobuf/Timestamp';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  couchbase: {
    admin: {
      analytics: {
        v1: {
          /**
           * AnalyticsAdminService provides CRUD for analytics links and
           * ingestion status monitoring.
           */
          AnalyticsAdminService: SubtypeConstructor<typeof grpc.Client, _couchbase_admin_analytics_v1_AnalyticsAdminServiceClient> & { service: _couchbase_admin_analytics_v1_AnalyticsAdminServiceDefinition }
          CouchbaseEncryptionMode: EnumTypeDefinition
          CreateLinkRequest: MessageTypeDefinition<_couchbase_admin_analytics_v1_CreateLinkRequest, _couchbase_admin_analytics_v1_CreateLinkRequest__Output>
          CreateLinkResponse: MessageTypeDefinition<_couchbase_admin_analytics_v1_CreateLinkResponse, _couchbase_admin_analytics_v1_CreateLinkResponse__Output>
          DeleteLinkRequest: MessageTypeDefinition<_couchbase_admin_analytics_v1_DeleteLinkRequest, _couchbase_admin_analytics_v1_DeleteLinkRequest__Output>
          DeleteLinkResponse: MessageTypeDefinition<_couchbase_admin_analytics_v1_DeleteLinkResponse, _couchbase_admin_analytics_v1_DeleteLinkResponse__Output>
          GetIngestionStatusRequest: MessageTypeDefinition<_couchbase_admin_analytics_v1_GetIngestionStatusRequest, _couchbase_admin_analytics_v1_GetIngestionStatusRequest__Output>
          GetIngestionStatusResponse: MessageTypeDefinition<_couchbase_admin_analytics_v1_GetIngestionStatusResponse, _couchbase_admin_analytics_v1_GetIngestionStatusResponse__Output>
          GetLinkRequest: MessageTypeDefinition<_couchbase_admin_analytics_v1_GetLinkRequest, _couchbase_admin_analytics_v1_GetLinkRequest__Output>
          GetLinkResponse: MessageTypeDefinition<_couchbase_admin_analytics_v1_GetLinkResponse, _couchbase_admin_analytics_v1_GetLinkResponse__Output>
          LinkStatus: EnumTypeDefinition
          UpdateLinkRequest: MessageTypeDefinition<_couchbase_admin_analytics_v1_UpdateLinkRequest, _couchbase_admin_analytics_v1_UpdateLinkRequest__Output>
          UpdateLinkResponse: MessageTypeDefinition<_couchbase_admin_analytics_v1_UpdateLinkResponse, _couchbase_admin_analytics_v1_UpdateLinkResponse__Output>
        }
      }
    }
    analytics: {
      v1: {
        AnalyticsQueryRequest: MessageTypeDefinition<_couchbase_analytics_v1_AnalyticsQueryRequest, _couchbase_analytics_v1_AnalyticsQueryRequest__Output>
        AnalyticsQueryResponse: MessageTypeDefinition<_couchbase_analytics_v1_AnalyticsQueryResponse, _couchbase_analytics_v1_AnalyticsQueryResponse__Output>
        /**
         * AnalyticsService provides SQL++ analytics query execution.
         */
        AnalyticsService: SubtypeConstructor<typeof grpc.Client, _couchbase_analytics_v1_AnalyticsServiceClient> & { service: _couchbase_analytics_v1_AnalyticsServiceDefinition }
      }
    }
  }
  google: {
    protobuf: {
      Duration: MessageTypeDefinition<_google_protobuf_Duration, _google_protobuf_Duration__Output>
      Timestamp: MessageTypeDefinition<_google_protobuf_Timestamp, _google_protobuf_Timestamp__Output>
    }
  }
}

