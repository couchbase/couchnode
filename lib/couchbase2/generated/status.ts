import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { Any as _google_protobuf_Any, Any__Output as _google_protobuf_Any__Output } from './google/protobuf/Any';
import type { Status as _google_rpc_Status, Status__Output as _google_rpc_Status__Output } from './google/rpc/Status';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  google: {
    protobuf: {
      Any: MessageTypeDefinition<_google_protobuf_Any, _google_protobuf_Any__Output>
    }
    rpc: {
      Status: MessageTypeDefinition<_google_rpc_Status, _google_rpc_Status__Output>
    }
  }
}

