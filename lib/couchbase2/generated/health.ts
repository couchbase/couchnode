import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { HealthClient as _grpc_health_v1_HealthClient, HealthDefinition as _grpc_health_v1_HealthDefinition } from './grpc/health/v1/Health';
import type { HealthCheckRequest as _grpc_health_v1_HealthCheckRequest, HealthCheckRequest__Output as _grpc_health_v1_HealthCheckRequest__Output } from './grpc/health/v1/HealthCheckRequest';
import type { HealthCheckResponse as _grpc_health_v1_HealthCheckResponse, HealthCheckResponse__Output as _grpc_health_v1_HealthCheckResponse__Output } from './grpc/health/v1/HealthCheckResponse';
import type { HealthListRequest as _grpc_health_v1_HealthListRequest, HealthListRequest__Output as _grpc_health_v1_HealthListRequest__Output } from './grpc/health/v1/HealthListRequest';
import type { HealthListResponse as _grpc_health_v1_HealthListResponse, HealthListResponse__Output as _grpc_health_v1_HealthListResponse__Output } from './grpc/health/v1/HealthListResponse';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  grpc: {
    health: {
      v1: {
        /**
         * Health is gRPC's mechanism for checking whether a server is able to handle
         * RPCs. Its semantics are documented in
         * https://github.com/grpc/grpc/blob/master/doc/health-checking.md.
         */
        Health: SubtypeConstructor<typeof grpc.Client, _grpc_health_v1_HealthClient> & { service: _grpc_health_v1_HealthDefinition }
        HealthCheckRequest: MessageTypeDefinition<_grpc_health_v1_HealthCheckRequest, _grpc_health_v1_HealthCheckRequest__Output>
        HealthCheckResponse: MessageTypeDefinition<_grpc_health_v1_HealthCheckResponse, _grpc_health_v1_HealthCheckResponse__Output>
        HealthListRequest: MessageTypeDefinition<_grpc_health_v1_HealthListRequest, _grpc_health_v1_HealthListRequest__Output>
        HealthListResponse: MessageTypeDefinition<_grpc_health_v1_HealthListResponse, _grpc_health_v1_HealthListResponse__Output>
      }
    }
  }
}

