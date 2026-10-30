import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { Duration as _google_protobuf_Duration, Duration__Output as _google_protobuf_Duration__Output } from './google/protobuf/Duration';
import type { BadRequest as _google_rpc_BadRequest, BadRequest__Output as _google_rpc_BadRequest__Output } from './google/rpc/BadRequest';
import type { DebugInfo as _google_rpc_DebugInfo, DebugInfo__Output as _google_rpc_DebugInfo__Output } from './google/rpc/DebugInfo';
import type { ErrorInfo as _google_rpc_ErrorInfo, ErrorInfo__Output as _google_rpc_ErrorInfo__Output } from './google/rpc/ErrorInfo';
import type { Help as _google_rpc_Help, Help__Output as _google_rpc_Help__Output } from './google/rpc/Help';
import type { LocalizedMessage as _google_rpc_LocalizedMessage, LocalizedMessage__Output as _google_rpc_LocalizedMessage__Output } from './google/rpc/LocalizedMessage';
import type { PreconditionFailure as _google_rpc_PreconditionFailure, PreconditionFailure__Output as _google_rpc_PreconditionFailure__Output } from './google/rpc/PreconditionFailure';
import type { QuotaFailure as _google_rpc_QuotaFailure, QuotaFailure__Output as _google_rpc_QuotaFailure__Output } from './google/rpc/QuotaFailure';
import type { RequestInfo as _google_rpc_RequestInfo, RequestInfo__Output as _google_rpc_RequestInfo__Output } from './google/rpc/RequestInfo';
import type { ResourceInfo as _google_rpc_ResourceInfo, ResourceInfo__Output as _google_rpc_ResourceInfo__Output } from './google/rpc/ResourceInfo';
import type { RetryInfo as _google_rpc_RetryInfo, RetryInfo__Output as _google_rpc_RetryInfo__Output } from './google/rpc/RetryInfo';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  google: {
    protobuf: {
      Duration: MessageTypeDefinition<_google_protobuf_Duration, _google_protobuf_Duration__Output>
    }
    rpc: {
      BadRequest: MessageTypeDefinition<_google_rpc_BadRequest, _google_rpc_BadRequest__Output>
      DebugInfo: MessageTypeDefinition<_google_rpc_DebugInfo, _google_rpc_DebugInfo__Output>
      ErrorInfo: MessageTypeDefinition<_google_rpc_ErrorInfo, _google_rpc_ErrorInfo__Output>
      Help: MessageTypeDefinition<_google_rpc_Help, _google_rpc_Help__Output>
      LocalizedMessage: MessageTypeDefinition<_google_rpc_LocalizedMessage, _google_rpc_LocalizedMessage__Output>
      PreconditionFailure: MessageTypeDefinition<_google_rpc_PreconditionFailure, _google_rpc_PreconditionFailure__Output>
      QuotaFailure: MessageTypeDefinition<_google_rpc_QuotaFailure, _google_rpc_QuotaFailure__Output>
      RequestInfo: MessageTypeDefinition<_google_rpc_RequestInfo, _google_rpc_RequestInfo__Output>
      ResourceInfo: MessageTypeDefinition<_google_rpc_ResourceInfo, _google_rpc_ResourceInfo__Output>
      RetryInfo: MessageTypeDefinition<_google_rpc_RetryInfo, _google_rpc_RetryInfo__Output>
    }
  }
}

