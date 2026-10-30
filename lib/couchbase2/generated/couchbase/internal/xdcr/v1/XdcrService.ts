// Original file: couchbase/internal/xdcr/v1/xdcr.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { CheckDocumentRequest as _couchbase_internal_xdcr_v1_CheckDocumentRequest, CheckDocumentRequest__Output as _couchbase_internal_xdcr_v1_CheckDocumentRequest__Output } from '../../../../couchbase/internal/xdcr/v1/CheckDocumentRequest';
import type { CheckDocumentResponse as _couchbase_internal_xdcr_v1_CheckDocumentResponse, CheckDocumentResponse__Output as _couchbase_internal_xdcr_v1_CheckDocumentResponse__Output } from '../../../../couchbase/internal/xdcr/v1/CheckDocumentResponse';
import type { GetBucketInfoRequest as _couchbase_internal_xdcr_v1_GetBucketInfoRequest, GetBucketInfoRequest__Output as _couchbase_internal_xdcr_v1_GetBucketInfoRequest__Output } from '../../../../couchbase/internal/xdcr/v1/GetBucketInfoRequest';
import type { GetBucketInfoResponse as _couchbase_internal_xdcr_v1_GetBucketInfoResponse, GetBucketInfoResponse__Output as _couchbase_internal_xdcr_v1_GetBucketInfoResponse__Output } from '../../../../couchbase/internal/xdcr/v1/GetBucketInfoResponse';
import type { GetClusterInfoRequest as _couchbase_internal_xdcr_v1_GetClusterInfoRequest, GetClusterInfoRequest__Output as _couchbase_internal_xdcr_v1_GetClusterInfoRequest__Output } from '../../../../couchbase/internal/xdcr/v1/GetClusterInfoRequest';
import type { GetClusterInfoResponse as _couchbase_internal_xdcr_v1_GetClusterInfoResponse, GetClusterInfoResponse__Output as _couchbase_internal_xdcr_v1_GetClusterInfoResponse__Output } from '../../../../couchbase/internal/xdcr/v1/GetClusterInfoResponse';
import type { GetDocumentRequest as _couchbase_internal_xdcr_v1_GetDocumentRequest, GetDocumentRequest__Output as _couchbase_internal_xdcr_v1_GetDocumentRequest__Output } from '../../../../couchbase/internal/xdcr/v1/GetDocumentRequest';
import type { GetDocumentResponse as _couchbase_internal_xdcr_v1_GetDocumentResponse, GetDocumentResponse__Output as _couchbase_internal_xdcr_v1_GetDocumentResponse__Output } from '../../../../couchbase/internal/xdcr/v1/GetDocumentResponse';
import type { GetVbucketInfoRequest as _couchbase_internal_xdcr_v1_GetVbucketInfoRequest, GetVbucketInfoRequest__Output as _couchbase_internal_xdcr_v1_GetVbucketInfoRequest__Output } from '../../../../couchbase/internal/xdcr/v1/GetVbucketInfoRequest';
import type { GetVbucketInfoResponse as _couchbase_internal_xdcr_v1_GetVbucketInfoResponse, GetVbucketInfoResponse__Output as _couchbase_internal_xdcr_v1_GetVbucketInfoResponse__Output } from '../../../../couchbase/internal/xdcr/v1/GetVbucketInfoResponse';
import type { HeartbeatRequest as _couchbase_internal_xdcr_v1_HeartbeatRequest, HeartbeatRequest__Output as _couchbase_internal_xdcr_v1_HeartbeatRequest__Output } from '../../../../couchbase/internal/xdcr/v1/HeartbeatRequest';
import type { HeartbeatResponse as _couchbase_internal_xdcr_v1_HeartbeatResponse, HeartbeatResponse__Output as _couchbase_internal_xdcr_v1_HeartbeatResponse__Output } from '../../../../couchbase/internal/xdcr/v1/HeartbeatResponse';
import type { PushDocumentRequest as _couchbase_internal_xdcr_v1_PushDocumentRequest, PushDocumentRequest__Output as _couchbase_internal_xdcr_v1_PushDocumentRequest__Output } from '../../../../couchbase/internal/xdcr/v1/PushDocumentRequest';
import type { PushDocumentResponse as _couchbase_internal_xdcr_v1_PushDocumentResponse, PushDocumentResponse__Output as _couchbase_internal_xdcr_v1_PushDocumentResponse__Output } from '../../../../couchbase/internal/xdcr/v1/PushDocumentResponse';
import type { WatchCollectionsRequest as _couchbase_internal_xdcr_v1_WatchCollectionsRequest, WatchCollectionsRequest__Output as _couchbase_internal_xdcr_v1_WatchCollectionsRequest__Output } from '../../../../couchbase/internal/xdcr/v1/WatchCollectionsRequest';
import type { WatchCollectionsResponse as _couchbase_internal_xdcr_v1_WatchCollectionsResponse, WatchCollectionsResponse__Output as _couchbase_internal_xdcr_v1_WatchCollectionsResponse__Output } from '../../../../couchbase/internal/xdcr/v1/WatchCollectionsResponse';

/**
 * XdcrService provides XDCR replication operations.
 * @uncommitted This service is not yet stable and may change without warning.
 */
export interface XdcrServiceClient extends grpc.Client {
  /**
   * CheckDocument checks if a document exists with the given metadata,
   * used for conflict resolution before pushing.
   */
  CheckDocument(argument: _couchbase_internal_xdcr_v1_CheckDocumentRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_CheckDocumentResponse__Output>): grpc.ClientUnaryCall;
  CheckDocument(argument: _couchbase_internal_xdcr_v1_CheckDocumentRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_CheckDocumentResponse__Output>): grpc.ClientUnaryCall;
  CheckDocument(argument: _couchbase_internal_xdcr_v1_CheckDocumentRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_CheckDocumentResponse__Output>): grpc.ClientUnaryCall;
  CheckDocument(argument: _couchbase_internal_xdcr_v1_CheckDocumentRequest, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_CheckDocumentResponse__Output>): grpc.ClientUnaryCall;
  /**
   * CheckDocument checks if a document exists with the given metadata,
   * used for conflict resolution before pushing.
   */
  checkDocument(argument: _couchbase_internal_xdcr_v1_CheckDocumentRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_CheckDocumentResponse__Output>): grpc.ClientUnaryCall;
  checkDocument(argument: _couchbase_internal_xdcr_v1_CheckDocumentRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_CheckDocumentResponse__Output>): grpc.ClientUnaryCall;
  checkDocument(argument: _couchbase_internal_xdcr_v1_CheckDocumentRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_CheckDocumentResponse__Output>): grpc.ClientUnaryCall;
  checkDocument(argument: _couchbase_internal_xdcr_v1_CheckDocumentRequest, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_CheckDocumentResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * GetBucketInfo returns bucket metadata needed for XDCR setup.
   */
  GetBucketInfo(argument: _couchbase_internal_xdcr_v1_GetBucketInfoRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetBucketInfoResponse__Output>): grpc.ClientUnaryCall;
  GetBucketInfo(argument: _couchbase_internal_xdcr_v1_GetBucketInfoRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetBucketInfoResponse__Output>): grpc.ClientUnaryCall;
  GetBucketInfo(argument: _couchbase_internal_xdcr_v1_GetBucketInfoRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetBucketInfoResponse__Output>): grpc.ClientUnaryCall;
  GetBucketInfo(argument: _couchbase_internal_xdcr_v1_GetBucketInfoRequest, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetBucketInfoResponse__Output>): grpc.ClientUnaryCall;
  /**
   * GetBucketInfo returns bucket metadata needed for XDCR setup.
   */
  getBucketInfo(argument: _couchbase_internal_xdcr_v1_GetBucketInfoRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetBucketInfoResponse__Output>): grpc.ClientUnaryCall;
  getBucketInfo(argument: _couchbase_internal_xdcr_v1_GetBucketInfoRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetBucketInfoResponse__Output>): grpc.ClientUnaryCall;
  getBucketInfo(argument: _couchbase_internal_xdcr_v1_GetBucketInfoRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetBucketInfoResponse__Output>): grpc.ClientUnaryCall;
  getBucketInfo(argument: _couchbase_internal_xdcr_v1_GetBucketInfoRequest, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetBucketInfoResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * GetClusterInfo returns the cluster UUID for identity verification.
   */
  GetClusterInfo(argument: _couchbase_internal_xdcr_v1_GetClusterInfoRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetClusterInfoResponse__Output>): grpc.ClientUnaryCall;
  GetClusterInfo(argument: _couchbase_internal_xdcr_v1_GetClusterInfoRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetClusterInfoResponse__Output>): grpc.ClientUnaryCall;
  GetClusterInfo(argument: _couchbase_internal_xdcr_v1_GetClusterInfoRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetClusterInfoResponse__Output>): grpc.ClientUnaryCall;
  GetClusterInfo(argument: _couchbase_internal_xdcr_v1_GetClusterInfoRequest, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetClusterInfoResponse__Output>): grpc.ClientUnaryCall;
  /**
   * GetClusterInfo returns the cluster UUID for identity verification.
   */
  getClusterInfo(argument: _couchbase_internal_xdcr_v1_GetClusterInfoRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetClusterInfoResponse__Output>): grpc.ClientUnaryCall;
  getClusterInfo(argument: _couchbase_internal_xdcr_v1_GetClusterInfoRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetClusterInfoResponse__Output>): grpc.ClientUnaryCall;
  getClusterInfo(argument: _couchbase_internal_xdcr_v1_GetClusterInfoRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetClusterInfoResponse__Output>): grpc.ClientUnaryCall;
  getClusterInfo(argument: _couchbase_internal_xdcr_v1_GetClusterInfoRequest, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetClusterInfoResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * GetDocument retrieves a document with full metadata for replication.
   */
  GetDocument(argument: _couchbase_internal_xdcr_v1_GetDocumentRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetDocumentResponse__Output>): grpc.ClientUnaryCall;
  GetDocument(argument: _couchbase_internal_xdcr_v1_GetDocumentRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetDocumentResponse__Output>): grpc.ClientUnaryCall;
  GetDocument(argument: _couchbase_internal_xdcr_v1_GetDocumentRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetDocumentResponse__Output>): grpc.ClientUnaryCall;
  GetDocument(argument: _couchbase_internal_xdcr_v1_GetDocumentRequest, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetDocumentResponse__Output>): grpc.ClientUnaryCall;
  /**
   * GetDocument retrieves a document with full metadata for replication.
   */
  getDocument(argument: _couchbase_internal_xdcr_v1_GetDocumentRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetDocumentResponse__Output>): grpc.ClientUnaryCall;
  getDocument(argument: _couchbase_internal_xdcr_v1_GetDocumentRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetDocumentResponse__Output>): grpc.ClientUnaryCall;
  getDocument(argument: _couchbase_internal_xdcr_v1_GetDocumentRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetDocumentResponse__Output>): grpc.ClientUnaryCall;
  getDocument(argument: _couchbase_internal_xdcr_v1_GetDocumentRequest, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_GetDocumentResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * GetVbucketInfo streams vbucket state (UUIDs, seqnos, history)
   * for the requested vbucket IDs.
   */
  GetVbucketInfo(argument: _couchbase_internal_xdcr_v1_GetVbucketInfoRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_internal_xdcr_v1_GetVbucketInfoResponse__Output>;
  GetVbucketInfo(argument: _couchbase_internal_xdcr_v1_GetVbucketInfoRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_internal_xdcr_v1_GetVbucketInfoResponse__Output>;
  /**
   * GetVbucketInfo streams vbucket state (UUIDs, seqnos, history)
   * for the requested vbucket IDs.
   */
  getVbucketInfo(argument: _couchbase_internal_xdcr_v1_GetVbucketInfoRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_internal_xdcr_v1_GetVbucketInfoResponse__Output>;
  getVbucketInfo(argument: _couchbase_internal_xdcr_v1_GetVbucketInfoRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_internal_xdcr_v1_GetVbucketInfoResponse__Output>;
  
  /**
   * Heartbeat sends a payload to verify the XDCR connection is alive.
   */
  Heartbeat(argument: _couchbase_internal_xdcr_v1_HeartbeatRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_HeartbeatResponse__Output>): grpc.ClientUnaryCall;
  Heartbeat(argument: _couchbase_internal_xdcr_v1_HeartbeatRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_HeartbeatResponse__Output>): grpc.ClientUnaryCall;
  Heartbeat(argument: _couchbase_internal_xdcr_v1_HeartbeatRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_HeartbeatResponse__Output>): grpc.ClientUnaryCall;
  Heartbeat(argument: _couchbase_internal_xdcr_v1_HeartbeatRequest, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_HeartbeatResponse__Output>): grpc.ClientUnaryCall;
  /**
   * Heartbeat sends a payload to verify the XDCR connection is alive.
   */
  heartbeat(argument: _couchbase_internal_xdcr_v1_HeartbeatRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_HeartbeatResponse__Output>): grpc.ClientUnaryCall;
  heartbeat(argument: _couchbase_internal_xdcr_v1_HeartbeatRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_HeartbeatResponse__Output>): grpc.ClientUnaryCall;
  heartbeat(argument: _couchbase_internal_xdcr_v1_HeartbeatRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_HeartbeatResponse__Output>): grpc.ClientUnaryCall;
  heartbeat(argument: _couchbase_internal_xdcr_v1_HeartbeatRequest, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_HeartbeatResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * PushDocument pushes a replicated document to the target cluster.
   */
  PushDocument(argument: _couchbase_internal_xdcr_v1_PushDocumentRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_PushDocumentResponse__Output>): grpc.ClientUnaryCall;
  PushDocument(argument: _couchbase_internal_xdcr_v1_PushDocumentRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_PushDocumentResponse__Output>): grpc.ClientUnaryCall;
  PushDocument(argument: _couchbase_internal_xdcr_v1_PushDocumentRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_PushDocumentResponse__Output>): grpc.ClientUnaryCall;
  PushDocument(argument: _couchbase_internal_xdcr_v1_PushDocumentRequest, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_PushDocumentResponse__Output>): grpc.ClientUnaryCall;
  /**
   * PushDocument pushes a replicated document to the target cluster.
   */
  pushDocument(argument: _couchbase_internal_xdcr_v1_PushDocumentRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_PushDocumentResponse__Output>): grpc.ClientUnaryCall;
  pushDocument(argument: _couchbase_internal_xdcr_v1_PushDocumentRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_PushDocumentResponse__Output>): grpc.ClientUnaryCall;
  pushDocument(argument: _couchbase_internal_xdcr_v1_PushDocumentRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_PushDocumentResponse__Output>): grpc.ClientUnaryCall;
  pushDocument(argument: _couchbase_internal_xdcr_v1_PushDocumentRequest, callback: grpc.requestCallback<_couchbase_internal_xdcr_v1_PushDocumentResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * WatchCollections streams collection manifest updates for a bucket.
   */
  WatchCollections(argument: _couchbase_internal_xdcr_v1_WatchCollectionsRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_internal_xdcr_v1_WatchCollectionsResponse__Output>;
  WatchCollections(argument: _couchbase_internal_xdcr_v1_WatchCollectionsRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_internal_xdcr_v1_WatchCollectionsResponse__Output>;
  /**
   * WatchCollections streams collection manifest updates for a bucket.
   */
  watchCollections(argument: _couchbase_internal_xdcr_v1_WatchCollectionsRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_internal_xdcr_v1_WatchCollectionsResponse__Output>;
  watchCollections(argument: _couchbase_internal_xdcr_v1_WatchCollectionsRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_internal_xdcr_v1_WatchCollectionsResponse__Output>;
  
}

/**
 * XdcrService provides XDCR replication operations.
 * @uncommitted This service is not yet stable and may change without warning.
 */
export interface XdcrServiceHandlers extends grpc.UntypedServiceImplementation {
  /**
   * CheckDocument checks if a document exists with the given metadata,
   * used for conflict resolution before pushing.
   */
  CheckDocument: grpc.handleUnaryCall<_couchbase_internal_xdcr_v1_CheckDocumentRequest__Output, _couchbase_internal_xdcr_v1_CheckDocumentResponse>;
  
  /**
   * GetBucketInfo returns bucket metadata needed for XDCR setup.
   */
  GetBucketInfo: grpc.handleUnaryCall<_couchbase_internal_xdcr_v1_GetBucketInfoRequest__Output, _couchbase_internal_xdcr_v1_GetBucketInfoResponse>;
  
  /**
   * GetClusterInfo returns the cluster UUID for identity verification.
   */
  GetClusterInfo: grpc.handleUnaryCall<_couchbase_internal_xdcr_v1_GetClusterInfoRequest__Output, _couchbase_internal_xdcr_v1_GetClusterInfoResponse>;
  
  /**
   * GetDocument retrieves a document with full metadata for replication.
   */
  GetDocument: grpc.handleUnaryCall<_couchbase_internal_xdcr_v1_GetDocumentRequest__Output, _couchbase_internal_xdcr_v1_GetDocumentResponse>;
  
  /**
   * GetVbucketInfo streams vbucket state (UUIDs, seqnos, history)
   * for the requested vbucket IDs.
   */
  GetVbucketInfo: grpc.handleServerStreamingCall<_couchbase_internal_xdcr_v1_GetVbucketInfoRequest__Output, _couchbase_internal_xdcr_v1_GetVbucketInfoResponse>;
  
  /**
   * Heartbeat sends a payload to verify the XDCR connection is alive.
   */
  Heartbeat: grpc.handleUnaryCall<_couchbase_internal_xdcr_v1_HeartbeatRequest__Output, _couchbase_internal_xdcr_v1_HeartbeatResponse>;
  
  /**
   * PushDocument pushes a replicated document to the target cluster.
   */
  PushDocument: grpc.handleUnaryCall<_couchbase_internal_xdcr_v1_PushDocumentRequest__Output, _couchbase_internal_xdcr_v1_PushDocumentResponse>;
  
  /**
   * WatchCollections streams collection manifest updates for a bucket.
   */
  WatchCollections: grpc.handleServerStreamingCall<_couchbase_internal_xdcr_v1_WatchCollectionsRequest__Output, _couchbase_internal_xdcr_v1_WatchCollectionsResponse>;
  
}

export interface XdcrServiceDefinition extends grpc.ServiceDefinition {
  CheckDocument: MethodDefinition<_couchbase_internal_xdcr_v1_CheckDocumentRequest, _couchbase_internal_xdcr_v1_CheckDocumentResponse, _couchbase_internal_xdcr_v1_CheckDocumentRequest__Output, _couchbase_internal_xdcr_v1_CheckDocumentResponse__Output>
  GetBucketInfo: MethodDefinition<_couchbase_internal_xdcr_v1_GetBucketInfoRequest, _couchbase_internal_xdcr_v1_GetBucketInfoResponse, _couchbase_internal_xdcr_v1_GetBucketInfoRequest__Output, _couchbase_internal_xdcr_v1_GetBucketInfoResponse__Output>
  GetClusterInfo: MethodDefinition<_couchbase_internal_xdcr_v1_GetClusterInfoRequest, _couchbase_internal_xdcr_v1_GetClusterInfoResponse, _couchbase_internal_xdcr_v1_GetClusterInfoRequest__Output, _couchbase_internal_xdcr_v1_GetClusterInfoResponse__Output>
  GetDocument: MethodDefinition<_couchbase_internal_xdcr_v1_GetDocumentRequest, _couchbase_internal_xdcr_v1_GetDocumentResponse, _couchbase_internal_xdcr_v1_GetDocumentRequest__Output, _couchbase_internal_xdcr_v1_GetDocumentResponse__Output>
  GetVbucketInfo: MethodDefinition<_couchbase_internal_xdcr_v1_GetVbucketInfoRequest, _couchbase_internal_xdcr_v1_GetVbucketInfoResponse, _couchbase_internal_xdcr_v1_GetVbucketInfoRequest__Output, _couchbase_internal_xdcr_v1_GetVbucketInfoResponse__Output>
  Heartbeat: MethodDefinition<_couchbase_internal_xdcr_v1_HeartbeatRequest, _couchbase_internal_xdcr_v1_HeartbeatResponse, _couchbase_internal_xdcr_v1_HeartbeatRequest__Output, _couchbase_internal_xdcr_v1_HeartbeatResponse__Output>
  PushDocument: MethodDefinition<_couchbase_internal_xdcr_v1_PushDocumentRequest, _couchbase_internal_xdcr_v1_PushDocumentResponse, _couchbase_internal_xdcr_v1_PushDocumentRequest__Output, _couchbase_internal_xdcr_v1_PushDocumentResponse__Output>
  WatchCollections: MethodDefinition<_couchbase_internal_xdcr_v1_WatchCollectionsRequest, _couchbase_internal_xdcr_v1_WatchCollectionsResponse, _couchbase_internal_xdcr_v1_WatchCollectionsRequest__Output, _couchbase_internal_xdcr_v1_WatchCollectionsResponse__Output>
}
