// Original file: couchbase/analytics/v1/analytics.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { AnalyticsQueryRequest as _couchbase_analytics_v1_AnalyticsQueryRequest, AnalyticsQueryRequest__Output as _couchbase_analytics_v1_AnalyticsQueryRequest__Output } from '../../../couchbase/analytics/v1/AnalyticsQueryRequest';
import type { AnalyticsQueryResponse as _couchbase_analytics_v1_AnalyticsQueryResponse, AnalyticsQueryResponse__Output as _couchbase_analytics_v1_AnalyticsQueryResponse__Output } from '../../../couchbase/analytics/v1/AnalyticsQueryResponse';

/**
 * AnalyticsService provides SQL++ analytics query execution.
 */
export interface AnalyticsServiceClient extends grpc.Client {
  /**
   * AnalyticsQuery executes an analytics statement and streams back result
   * rows and metadata. The final streamed response contains MetaData.
   */
  AnalyticsQuery(argument: _couchbase_analytics_v1_AnalyticsQueryRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_analytics_v1_AnalyticsQueryResponse__Output>;
  AnalyticsQuery(argument: _couchbase_analytics_v1_AnalyticsQueryRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_analytics_v1_AnalyticsQueryResponse__Output>;
  /**
   * AnalyticsQuery executes an analytics statement and streams back result
   * rows and metadata. The final streamed response contains MetaData.
   */
  analyticsQuery(argument: _couchbase_analytics_v1_AnalyticsQueryRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_analytics_v1_AnalyticsQueryResponse__Output>;
  analyticsQuery(argument: _couchbase_analytics_v1_AnalyticsQueryRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_analytics_v1_AnalyticsQueryResponse__Output>;
  
}

/**
 * AnalyticsService provides SQL++ analytics query execution.
 */
export interface AnalyticsServiceHandlers extends grpc.UntypedServiceImplementation {
  /**
   * AnalyticsQuery executes an analytics statement and streams back result
   * rows and metadata. The final streamed response contains MetaData.
   */
  AnalyticsQuery: grpc.handleServerStreamingCall<_couchbase_analytics_v1_AnalyticsQueryRequest__Output, _couchbase_analytics_v1_AnalyticsQueryResponse>;
  
}

export interface AnalyticsServiceDefinition extends grpc.ServiceDefinition {
  AnalyticsQuery: MethodDefinition<_couchbase_analytics_v1_AnalyticsQueryRequest, _couchbase_analytics_v1_AnalyticsQueryResponse, _couchbase_analytics_v1_AnalyticsQueryRequest__Output, _couchbase_analytics_v1_AnalyticsQueryResponse__Output>
}
