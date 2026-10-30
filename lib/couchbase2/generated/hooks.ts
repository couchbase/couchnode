import type * as grpc from '@grpc/grpc-js';
import type { EnumTypeDefinition, MessageTypeDefinition } from '@grpc/proto-loader';

import type { AddHooksRequest as _couchbase_internal_hooks_v1_AddHooksRequest, AddHooksRequest__Output as _couchbase_internal_hooks_v1_AddHooksRequest__Output } from './couchbase/internal/hooks/v1/AddHooksRequest';
import type { AddHooksResponse as _couchbase_internal_hooks_v1_AddHooksResponse, AddHooksResponse__Output as _couchbase_internal_hooks_v1_AddHooksResponse__Output } from './couchbase/internal/hooks/v1/AddHooksResponse';
import type { CreateHooksContextRequest as _couchbase_internal_hooks_v1_CreateHooksContextRequest, CreateHooksContextRequest__Output as _couchbase_internal_hooks_v1_CreateHooksContextRequest__Output } from './couchbase/internal/hooks/v1/CreateHooksContextRequest';
import type { CreateHooksContextResponse as _couchbase_internal_hooks_v1_CreateHooksContextResponse, CreateHooksContextResponse__Output as _couchbase_internal_hooks_v1_CreateHooksContextResponse__Output } from './couchbase/internal/hooks/v1/CreateHooksContextResponse';
import type { DestroyHooksContextRequest as _couchbase_internal_hooks_v1_DestroyHooksContextRequest, DestroyHooksContextRequest__Output as _couchbase_internal_hooks_v1_DestroyHooksContextRequest__Output } from './couchbase/internal/hooks/v1/DestroyHooksContextRequest';
import type { DestroyHooksContextResponse as _couchbase_internal_hooks_v1_DestroyHooksContextResponse, DestroyHooksContextResponse__Output as _couchbase_internal_hooks_v1_DestroyHooksContextResponse__Output } from './couchbase/internal/hooks/v1/DestroyHooksContextResponse';
import type { Hook as _couchbase_internal_hooks_v1_Hook, Hook__Output as _couchbase_internal_hooks_v1_Hook__Output } from './couchbase/internal/hooks/v1/Hook';
import type { HookAction as _couchbase_internal_hooks_v1_HookAction, HookAction__Output as _couchbase_internal_hooks_v1_HookAction__Output } from './couchbase/internal/hooks/v1/HookAction';
import type { HookCondition as _couchbase_internal_hooks_v1_HookCondition, HookCondition__Output as _couchbase_internal_hooks_v1_HookCondition__Output } from './couchbase/internal/hooks/v1/HookCondition';
import type { HooksServiceClient as _couchbase_internal_hooks_v1_HooksServiceClient, HooksServiceDefinition as _couchbase_internal_hooks_v1_HooksServiceDefinition } from './couchbase/internal/hooks/v1/HooksService';
import type { SignalBarrierRequest as _couchbase_internal_hooks_v1_SignalBarrierRequest, SignalBarrierRequest__Output as _couchbase_internal_hooks_v1_SignalBarrierRequest__Output } from './couchbase/internal/hooks/v1/SignalBarrierRequest';
import type { SignalBarrierResponse as _couchbase_internal_hooks_v1_SignalBarrierResponse, SignalBarrierResponse__Output as _couchbase_internal_hooks_v1_SignalBarrierResponse__Output } from './couchbase/internal/hooks/v1/SignalBarrierResponse';
import type { ValueRef as _couchbase_internal_hooks_v1_ValueRef, ValueRef__Output as _couchbase_internal_hooks_v1_ValueRef__Output } from './couchbase/internal/hooks/v1/ValueRef';
import type { WatchBarrierRequest as _couchbase_internal_hooks_v1_WatchBarrierRequest, WatchBarrierRequest__Output as _couchbase_internal_hooks_v1_WatchBarrierRequest__Output } from './couchbase/internal/hooks/v1/WatchBarrierRequest';
import type { WatchBarrierResponse as _couchbase_internal_hooks_v1_WatchBarrierResponse, WatchBarrierResponse__Output as _couchbase_internal_hooks_v1_WatchBarrierResponse__Output } from './couchbase/internal/hooks/v1/WatchBarrierResponse';
import type { WatchRequestsRequest as _couchbase_internal_hooks_v1_WatchRequestsRequest, WatchRequestsRequest__Output as _couchbase_internal_hooks_v1_WatchRequestsRequest__Output } from './couchbase/internal/hooks/v1/WatchRequestsRequest';
import type { WatchRequestsResponse as _couchbase_internal_hooks_v1_WatchRequestsResponse, WatchRequestsResponse__Output as _couchbase_internal_hooks_v1_WatchRequestsResponse__Output } from './couchbase/internal/hooks/v1/WatchRequestsResponse';
import type { Any as _google_protobuf_Any, Any__Output as _google_protobuf_Any__Output } from './google/protobuf/Any';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  couchbase: {
    internal: {
      hooks: {
        v1: {
          AddHooksRequest: MessageTypeDefinition<_couchbase_internal_hooks_v1_AddHooksRequest, _couchbase_internal_hooks_v1_AddHooksRequest__Output>
          AddHooksResponse: MessageTypeDefinition<_couchbase_internal_hooks_v1_AddHooksResponse, _couchbase_internal_hooks_v1_AddHooksResponse__Output>
          ComparisonOperator: EnumTypeDefinition
          CreateHooksContextRequest: MessageTypeDefinition<_couchbase_internal_hooks_v1_CreateHooksContextRequest, _couchbase_internal_hooks_v1_CreateHooksContextRequest__Output>
          CreateHooksContextResponse: MessageTypeDefinition<_couchbase_internal_hooks_v1_CreateHooksContextResponse, _couchbase_internal_hooks_v1_CreateHooksContextResponse__Output>
          DestroyHooksContextRequest: MessageTypeDefinition<_couchbase_internal_hooks_v1_DestroyHooksContextRequest, _couchbase_internal_hooks_v1_DestroyHooksContextRequest__Output>
          DestroyHooksContextResponse: MessageTypeDefinition<_couchbase_internal_hooks_v1_DestroyHooksContextResponse, _couchbase_internal_hooks_v1_DestroyHooksContextResponse__Output>
          Hook: MessageTypeDefinition<_couchbase_internal_hooks_v1_Hook, _couchbase_internal_hooks_v1_Hook__Output>
          HookAction: MessageTypeDefinition<_couchbase_internal_hooks_v1_HookAction, _couchbase_internal_hooks_v1_HookAction__Output>
          HookCondition: MessageTypeDefinition<_couchbase_internal_hooks_v1_HookCondition, _couchbase_internal_hooks_v1_HookCondition__Output>
          /**
           * HooksService provides test hook registration and synchronization primitives.
           */
          HooksService: SubtypeConstructor<typeof grpc.Client, _couchbase_internal_hooks_v1_HooksServiceClient> & { service: _couchbase_internal_hooks_v1_HooksServiceDefinition }
          SignalBarrierRequest: MessageTypeDefinition<_couchbase_internal_hooks_v1_SignalBarrierRequest, _couchbase_internal_hooks_v1_SignalBarrierRequest__Output>
          SignalBarrierResponse: MessageTypeDefinition<_couchbase_internal_hooks_v1_SignalBarrierResponse, _couchbase_internal_hooks_v1_SignalBarrierResponse__Output>
          ValueRef: MessageTypeDefinition<_couchbase_internal_hooks_v1_ValueRef, _couchbase_internal_hooks_v1_ValueRef__Output>
          WatchBarrierRequest: MessageTypeDefinition<_couchbase_internal_hooks_v1_WatchBarrierRequest, _couchbase_internal_hooks_v1_WatchBarrierRequest__Output>
          WatchBarrierResponse: MessageTypeDefinition<_couchbase_internal_hooks_v1_WatchBarrierResponse, _couchbase_internal_hooks_v1_WatchBarrierResponse__Output>
          WatchRequestsRequest: MessageTypeDefinition<_couchbase_internal_hooks_v1_WatchRequestsRequest, _couchbase_internal_hooks_v1_WatchRequestsRequest__Output>
          WatchRequestsResponse: MessageTypeDefinition<_couchbase_internal_hooks_v1_WatchRequestsResponse, _couchbase_internal_hooks_v1_WatchRequestsResponse__Output>
        }
      }
    }
  }
  google: {
    protobuf: {
      Any: MessageTypeDefinition<_google_protobuf_Any, _google_protobuf_Any__Output>
    }
  }
}

