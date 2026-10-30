// Original file: couchbase/view/v1/view.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { ViewQueryRequest as _couchbase_view_v1_ViewQueryRequest, ViewQueryRequest__Output as _couchbase_view_v1_ViewQueryRequest__Output } from '../../../couchbase/view/v1/ViewQueryRequest';
import type { ViewQueryResponse as _couchbase_view_v1_ViewQueryResponse, ViewQueryResponse__Output as _couchbase_view_v1_ViewQueryResponse__Output } from '../../../couchbase/view/v1/ViewQueryResponse';

/**
 * ViewService provides MapReduce view query execution.
 */
export interface ViewServiceClient extends grpc.Client {
  /**
   * ViewQuery executes a MapReduce view query and streams back result rows
   * and metadata. The final streamed response contains MetaData.
   */
  ViewQuery(argument: _couchbase_view_v1_ViewQueryRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_view_v1_ViewQueryResponse__Output>;
  ViewQuery(argument: _couchbase_view_v1_ViewQueryRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_view_v1_ViewQueryResponse__Output>;
  /**
   * ViewQuery executes a MapReduce view query and streams back result rows
   * and metadata. The final streamed response contains MetaData.
   */
  viewQuery(argument: _couchbase_view_v1_ViewQueryRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_view_v1_ViewQueryResponse__Output>;
  viewQuery(argument: _couchbase_view_v1_ViewQueryRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_view_v1_ViewQueryResponse__Output>;
  
}

/**
 * ViewService provides MapReduce view query execution.
 */
export interface ViewServiceHandlers extends grpc.UntypedServiceImplementation {
  /**
   * ViewQuery executes a MapReduce view query and streams back result rows
   * and metadata. The final streamed response contains MetaData.
   */
  ViewQuery: grpc.handleServerStreamingCall<_couchbase_view_v1_ViewQueryRequest__Output, _couchbase_view_v1_ViewQueryResponse>;
  
}

export interface ViewServiceDefinition extends grpc.ServiceDefinition {
  ViewQuery: MethodDefinition<_couchbase_view_v1_ViewQueryRequest, _couchbase_view_v1_ViewQueryResponse, _couchbase_view_v1_ViewQueryRequest__Output, _couchbase_view_v1_ViewQueryResponse__Output>
}
