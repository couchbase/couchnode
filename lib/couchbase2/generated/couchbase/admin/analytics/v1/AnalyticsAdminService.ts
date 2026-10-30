// Original file: couchbase/admin/analytics/v1/analytics.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { CreateLinkRequest as _couchbase_admin_analytics_v1_CreateLinkRequest, CreateLinkRequest__Output as _couchbase_admin_analytics_v1_CreateLinkRequest__Output } from '../../../../couchbase/admin/analytics/v1/CreateLinkRequest';
import type { CreateLinkResponse as _couchbase_admin_analytics_v1_CreateLinkResponse, CreateLinkResponse__Output as _couchbase_admin_analytics_v1_CreateLinkResponse__Output } from '../../../../couchbase/admin/analytics/v1/CreateLinkResponse';
import type { DeleteLinkRequest as _couchbase_admin_analytics_v1_DeleteLinkRequest, DeleteLinkRequest__Output as _couchbase_admin_analytics_v1_DeleteLinkRequest__Output } from '../../../../couchbase/admin/analytics/v1/DeleteLinkRequest';
import type { DeleteLinkResponse as _couchbase_admin_analytics_v1_DeleteLinkResponse, DeleteLinkResponse__Output as _couchbase_admin_analytics_v1_DeleteLinkResponse__Output } from '../../../../couchbase/admin/analytics/v1/DeleteLinkResponse';
import type { GetIngestionStatusRequest as _couchbase_admin_analytics_v1_GetIngestionStatusRequest, GetIngestionStatusRequest__Output as _couchbase_admin_analytics_v1_GetIngestionStatusRequest__Output } from '../../../../couchbase/admin/analytics/v1/GetIngestionStatusRequest';
import type { GetIngestionStatusResponse as _couchbase_admin_analytics_v1_GetIngestionStatusResponse, GetIngestionStatusResponse__Output as _couchbase_admin_analytics_v1_GetIngestionStatusResponse__Output } from '../../../../couchbase/admin/analytics/v1/GetIngestionStatusResponse';
import type { GetLinkRequest as _couchbase_admin_analytics_v1_GetLinkRequest, GetLinkRequest__Output as _couchbase_admin_analytics_v1_GetLinkRequest__Output } from '../../../../couchbase/admin/analytics/v1/GetLinkRequest';
import type { GetLinkResponse as _couchbase_admin_analytics_v1_GetLinkResponse, GetLinkResponse__Output as _couchbase_admin_analytics_v1_GetLinkResponse__Output } from '../../../../couchbase/admin/analytics/v1/GetLinkResponse';
import type { UpdateLinkRequest as _couchbase_admin_analytics_v1_UpdateLinkRequest, UpdateLinkRequest__Output as _couchbase_admin_analytics_v1_UpdateLinkRequest__Output } from '../../../../couchbase/admin/analytics/v1/UpdateLinkRequest';
import type { UpdateLinkResponse as _couchbase_admin_analytics_v1_UpdateLinkResponse, UpdateLinkResponse__Output as _couchbase_admin_analytics_v1_UpdateLinkResponse__Output } from '../../../../couchbase/admin/analytics/v1/UpdateLinkResponse';

/**
 * AnalyticsAdminService provides CRUD for analytics links and
 * ingestion status monitoring.
 */
export interface AnalyticsAdminServiceClient extends grpc.Client {
  /**
   * CreateLink creates a new analytics link.
   */
  CreateLink(argument: _couchbase_admin_analytics_v1_CreateLinkRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_CreateLinkResponse__Output>): grpc.ClientUnaryCall;
  CreateLink(argument: _couchbase_admin_analytics_v1_CreateLinkRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_CreateLinkResponse__Output>): grpc.ClientUnaryCall;
  CreateLink(argument: _couchbase_admin_analytics_v1_CreateLinkRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_CreateLinkResponse__Output>): grpc.ClientUnaryCall;
  CreateLink(argument: _couchbase_admin_analytics_v1_CreateLinkRequest, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_CreateLinkResponse__Output>): grpc.ClientUnaryCall;
  /**
   * CreateLink creates a new analytics link.
   */
  createLink(argument: _couchbase_admin_analytics_v1_CreateLinkRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_CreateLinkResponse__Output>): grpc.ClientUnaryCall;
  createLink(argument: _couchbase_admin_analytics_v1_CreateLinkRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_CreateLinkResponse__Output>): grpc.ClientUnaryCall;
  createLink(argument: _couchbase_admin_analytics_v1_CreateLinkRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_CreateLinkResponse__Output>): grpc.ClientUnaryCall;
  createLink(argument: _couchbase_admin_analytics_v1_CreateLinkRequest, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_CreateLinkResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * DeleteLink removes an analytics link.
   */
  DeleteLink(argument: _couchbase_admin_analytics_v1_DeleteLinkRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_DeleteLinkResponse__Output>): grpc.ClientUnaryCall;
  DeleteLink(argument: _couchbase_admin_analytics_v1_DeleteLinkRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_DeleteLinkResponse__Output>): grpc.ClientUnaryCall;
  DeleteLink(argument: _couchbase_admin_analytics_v1_DeleteLinkRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_DeleteLinkResponse__Output>): grpc.ClientUnaryCall;
  DeleteLink(argument: _couchbase_admin_analytics_v1_DeleteLinkRequest, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_DeleteLinkResponse__Output>): grpc.ClientUnaryCall;
  /**
   * DeleteLink removes an analytics link.
   */
  deleteLink(argument: _couchbase_admin_analytics_v1_DeleteLinkRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_DeleteLinkResponse__Output>): grpc.ClientUnaryCall;
  deleteLink(argument: _couchbase_admin_analytics_v1_DeleteLinkRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_DeleteLinkResponse__Output>): grpc.ClientUnaryCall;
  deleteLink(argument: _couchbase_admin_analytics_v1_DeleteLinkRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_DeleteLinkResponse__Output>): grpc.ClientUnaryCall;
  deleteLink(argument: _couchbase_admin_analytics_v1_DeleteLinkRequest, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_DeleteLinkResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * GetIngestionStatus returns the current ingestion status for all links,
   * including progress, time lag, and scope/collection details.
   */
  GetIngestionStatus(argument: _couchbase_admin_analytics_v1_GetIngestionStatusRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_GetIngestionStatusResponse__Output>): grpc.ClientUnaryCall;
  GetIngestionStatus(argument: _couchbase_admin_analytics_v1_GetIngestionStatusRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_GetIngestionStatusResponse__Output>): grpc.ClientUnaryCall;
  GetIngestionStatus(argument: _couchbase_admin_analytics_v1_GetIngestionStatusRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_GetIngestionStatusResponse__Output>): grpc.ClientUnaryCall;
  GetIngestionStatus(argument: _couchbase_admin_analytics_v1_GetIngestionStatusRequest, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_GetIngestionStatusResponse__Output>): grpc.ClientUnaryCall;
  /**
   * GetIngestionStatus returns the current ingestion status for all links,
   * including progress, time lag, and scope/collection details.
   */
  getIngestionStatus(argument: _couchbase_admin_analytics_v1_GetIngestionStatusRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_GetIngestionStatusResponse__Output>): grpc.ClientUnaryCall;
  getIngestionStatus(argument: _couchbase_admin_analytics_v1_GetIngestionStatusRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_GetIngestionStatusResponse__Output>): grpc.ClientUnaryCall;
  getIngestionStatus(argument: _couchbase_admin_analytics_v1_GetIngestionStatusRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_GetIngestionStatusResponse__Output>): grpc.ClientUnaryCall;
  getIngestionStatus(argument: _couchbase_admin_analytics_v1_GetIngestionStatusRequest, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_GetIngestionStatusResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * GetLink retrieves an analytics link's configuration.
   * Sensitive fields (passwords, secret keys) are omitted from the response.
   */
  GetLink(argument: _couchbase_admin_analytics_v1_GetLinkRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_GetLinkResponse__Output>): grpc.ClientUnaryCall;
  GetLink(argument: _couchbase_admin_analytics_v1_GetLinkRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_GetLinkResponse__Output>): grpc.ClientUnaryCall;
  GetLink(argument: _couchbase_admin_analytics_v1_GetLinkRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_GetLinkResponse__Output>): grpc.ClientUnaryCall;
  GetLink(argument: _couchbase_admin_analytics_v1_GetLinkRequest, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_GetLinkResponse__Output>): grpc.ClientUnaryCall;
  /**
   * GetLink retrieves an analytics link's configuration.
   * Sensitive fields (passwords, secret keys) are omitted from the response.
   */
  getLink(argument: _couchbase_admin_analytics_v1_GetLinkRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_GetLinkResponse__Output>): grpc.ClientUnaryCall;
  getLink(argument: _couchbase_admin_analytics_v1_GetLinkRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_GetLinkResponse__Output>): grpc.ClientUnaryCall;
  getLink(argument: _couchbase_admin_analytics_v1_GetLinkRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_GetLinkResponse__Output>): grpc.ClientUnaryCall;
  getLink(argument: _couchbase_admin_analytics_v1_GetLinkRequest, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_GetLinkResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * UpdateLink updates an existing analytics link's configuration.
   */
  UpdateLink(argument: _couchbase_admin_analytics_v1_UpdateLinkRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_UpdateLinkResponse__Output>): grpc.ClientUnaryCall;
  UpdateLink(argument: _couchbase_admin_analytics_v1_UpdateLinkRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_UpdateLinkResponse__Output>): grpc.ClientUnaryCall;
  UpdateLink(argument: _couchbase_admin_analytics_v1_UpdateLinkRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_UpdateLinkResponse__Output>): grpc.ClientUnaryCall;
  UpdateLink(argument: _couchbase_admin_analytics_v1_UpdateLinkRequest, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_UpdateLinkResponse__Output>): grpc.ClientUnaryCall;
  /**
   * UpdateLink updates an existing analytics link's configuration.
   */
  updateLink(argument: _couchbase_admin_analytics_v1_UpdateLinkRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_UpdateLinkResponse__Output>): grpc.ClientUnaryCall;
  updateLink(argument: _couchbase_admin_analytics_v1_UpdateLinkRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_UpdateLinkResponse__Output>): grpc.ClientUnaryCall;
  updateLink(argument: _couchbase_admin_analytics_v1_UpdateLinkRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_UpdateLinkResponse__Output>): grpc.ClientUnaryCall;
  updateLink(argument: _couchbase_admin_analytics_v1_UpdateLinkRequest, callback: grpc.requestCallback<_couchbase_admin_analytics_v1_UpdateLinkResponse__Output>): grpc.ClientUnaryCall;
  
}

/**
 * AnalyticsAdminService provides CRUD for analytics links and
 * ingestion status monitoring.
 */
export interface AnalyticsAdminServiceHandlers extends grpc.UntypedServiceImplementation {
  /**
   * CreateLink creates a new analytics link.
   */
  CreateLink: grpc.handleUnaryCall<_couchbase_admin_analytics_v1_CreateLinkRequest__Output, _couchbase_admin_analytics_v1_CreateLinkResponse>;
  
  /**
   * DeleteLink removes an analytics link.
   */
  DeleteLink: grpc.handleUnaryCall<_couchbase_admin_analytics_v1_DeleteLinkRequest__Output, _couchbase_admin_analytics_v1_DeleteLinkResponse>;
  
  /**
   * GetIngestionStatus returns the current ingestion status for all links,
   * including progress, time lag, and scope/collection details.
   */
  GetIngestionStatus: grpc.handleUnaryCall<_couchbase_admin_analytics_v1_GetIngestionStatusRequest__Output, _couchbase_admin_analytics_v1_GetIngestionStatusResponse>;
  
  /**
   * GetLink retrieves an analytics link's configuration.
   * Sensitive fields (passwords, secret keys) are omitted from the response.
   */
  GetLink: grpc.handleUnaryCall<_couchbase_admin_analytics_v1_GetLinkRequest__Output, _couchbase_admin_analytics_v1_GetLinkResponse>;
  
  /**
   * UpdateLink updates an existing analytics link's configuration.
   */
  UpdateLink: grpc.handleUnaryCall<_couchbase_admin_analytics_v1_UpdateLinkRequest__Output, _couchbase_admin_analytics_v1_UpdateLinkResponse>;
  
}

export interface AnalyticsAdminServiceDefinition extends grpc.ServiceDefinition {
  CreateLink: MethodDefinition<_couchbase_admin_analytics_v1_CreateLinkRequest, _couchbase_admin_analytics_v1_CreateLinkResponse, _couchbase_admin_analytics_v1_CreateLinkRequest__Output, _couchbase_admin_analytics_v1_CreateLinkResponse__Output>
  DeleteLink: MethodDefinition<_couchbase_admin_analytics_v1_DeleteLinkRequest, _couchbase_admin_analytics_v1_DeleteLinkResponse, _couchbase_admin_analytics_v1_DeleteLinkRequest__Output, _couchbase_admin_analytics_v1_DeleteLinkResponse__Output>
  GetIngestionStatus: MethodDefinition<_couchbase_admin_analytics_v1_GetIngestionStatusRequest, _couchbase_admin_analytics_v1_GetIngestionStatusResponse, _couchbase_admin_analytics_v1_GetIngestionStatusRequest__Output, _couchbase_admin_analytics_v1_GetIngestionStatusResponse__Output>
  GetLink: MethodDefinition<_couchbase_admin_analytics_v1_GetLinkRequest, _couchbase_admin_analytics_v1_GetLinkResponse, _couchbase_admin_analytics_v1_GetLinkRequest__Output, _couchbase_admin_analytics_v1_GetLinkResponse__Output>
  UpdateLink: MethodDefinition<_couchbase_admin_analytics_v1_UpdateLinkRequest, _couchbase_admin_analytics_v1_UpdateLinkResponse, _couchbase_admin_analytics_v1_UpdateLinkRequest__Output, _couchbase_admin_analytics_v1_UpdateLinkResponse__Output>
}
