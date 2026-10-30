// Original file: couchbase/routing/v2/routing.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { WatchRoutingRequest as _couchbase_routing_v2_WatchRoutingRequest, WatchRoutingRequest__Output as _couchbase_routing_v2_WatchRoutingRequest__Output } from '../../../couchbase/routing/v2/WatchRoutingRequest';
import type { WatchRoutingResponse as _couchbase_routing_v2_WatchRoutingResponse, WatchRoutingResponse__Output as _couchbase_routing_v2_WatchRoutingResponse__Output } from '../../../couchbase/routing/v2/WatchRoutingResponse';

/**
 * RoutingService provides cluster topology updates as a server-streamed
 * response. The stream emits a new WatchRoutingResponse whenever the
 * cluster topology changes.
 */
export interface RoutingServiceClient extends grpc.Client {
  /**
   * WatchRouting opens a long-lived stream that delivers routing
   * configuration updates. If bucket_name is specified, the response
   * includes vbucket routing for that specific bucket.
   */
  WatchRouting(argument: _couchbase_routing_v2_WatchRoutingRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_routing_v2_WatchRoutingResponse__Output>;
  WatchRouting(argument: _couchbase_routing_v2_WatchRoutingRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_routing_v2_WatchRoutingResponse__Output>;
  /**
   * WatchRouting opens a long-lived stream that delivers routing
   * configuration updates. If bucket_name is specified, the response
   * includes vbucket routing for that specific bucket.
   */
  watchRouting(argument: _couchbase_routing_v2_WatchRoutingRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_routing_v2_WatchRoutingResponse__Output>;
  watchRouting(argument: _couchbase_routing_v2_WatchRoutingRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_routing_v2_WatchRoutingResponse__Output>;
  
}

/**
 * RoutingService provides cluster topology updates as a server-streamed
 * response. The stream emits a new WatchRoutingResponse whenever the
 * cluster topology changes.
 */
export interface RoutingServiceHandlers extends grpc.UntypedServiceImplementation {
  /**
   * WatchRouting opens a long-lived stream that delivers routing
   * configuration updates. If bucket_name is specified, the response
   * includes vbucket routing for that specific bucket.
   */
  WatchRouting: grpc.handleServerStreamingCall<_couchbase_routing_v2_WatchRoutingRequest__Output, _couchbase_routing_v2_WatchRoutingResponse>;
  
}

export interface RoutingServiceDefinition extends grpc.ServiceDefinition {
  WatchRouting: MethodDefinition<_couchbase_routing_v2_WatchRoutingRequest, _couchbase_routing_v2_WatchRoutingResponse, _couchbase_routing_v2_WatchRoutingRequest__Output, _couchbase_routing_v2_WatchRoutingResponse__Output>
}
