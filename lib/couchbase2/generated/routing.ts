import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { RoutingServiceClient as _couchbase_routing_v2_RoutingServiceClient, RoutingServiceDefinition as _couchbase_routing_v2_RoutingServiceDefinition } from './couchbase/routing/v2/RoutingService';
import type { ServerRouting as _couchbase_routing_v2_ServerRouting, ServerRouting__Output as _couchbase_routing_v2_ServerRouting__Output } from './couchbase/routing/v2/ServerRouting';
import type { VbucketRouting as _couchbase_routing_v2_VbucketRouting, VbucketRouting__Output as _couchbase_routing_v2_VbucketRouting__Output } from './couchbase/routing/v2/VbucketRouting';
import type { WatchRoutingRequest as _couchbase_routing_v2_WatchRoutingRequest, WatchRoutingRequest__Output as _couchbase_routing_v2_WatchRoutingRequest__Output } from './couchbase/routing/v2/WatchRoutingRequest';
import type { WatchRoutingResponse as _couchbase_routing_v2_WatchRoutingResponse, WatchRoutingResponse__Output as _couchbase_routing_v2_WatchRoutingResponse__Output } from './couchbase/routing/v2/WatchRoutingResponse';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  couchbase: {
    routing: {
      v2: {
        /**
         * RoutingService provides cluster topology updates as a server-streamed
         * response. The stream emits a new WatchRoutingResponse whenever the
         * cluster topology changes.
         */
        RoutingService: SubtypeConstructor<typeof grpc.Client, _couchbase_routing_v2_RoutingServiceClient> & { service: _couchbase_routing_v2_RoutingServiceDefinition }
        ServerRouting: MessageTypeDefinition<_couchbase_routing_v2_ServerRouting, _couchbase_routing_v2_ServerRouting__Output>
        VbucketRouting: MessageTypeDefinition<_couchbase_routing_v2_VbucketRouting, _couchbase_routing_v2_VbucketRouting__Output>
        WatchRoutingRequest: MessageTypeDefinition<_couchbase_routing_v2_WatchRoutingRequest, _couchbase_routing_v2_WatchRoutingRequest__Output>
        WatchRoutingResponse: MessageTypeDefinition<_couchbase_routing_v2_WatchRoutingResponse, _couchbase_routing_v2_WatchRoutingResponse__Output>
      }
    }
  }
}

