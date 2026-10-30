// Original file: couchbase/internal/hooks/v1/hooks.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { AddHooksRequest as _couchbase_internal_hooks_v1_AddHooksRequest, AddHooksRequest__Output as _couchbase_internal_hooks_v1_AddHooksRequest__Output } from '../../../../couchbase/internal/hooks/v1/AddHooksRequest';
import type { AddHooksResponse as _couchbase_internal_hooks_v1_AddHooksResponse, AddHooksResponse__Output as _couchbase_internal_hooks_v1_AddHooksResponse__Output } from '../../../../couchbase/internal/hooks/v1/AddHooksResponse';
import type { CreateHooksContextRequest as _couchbase_internal_hooks_v1_CreateHooksContextRequest, CreateHooksContextRequest__Output as _couchbase_internal_hooks_v1_CreateHooksContextRequest__Output } from '../../../../couchbase/internal/hooks/v1/CreateHooksContextRequest';
import type { CreateHooksContextResponse as _couchbase_internal_hooks_v1_CreateHooksContextResponse, CreateHooksContextResponse__Output as _couchbase_internal_hooks_v1_CreateHooksContextResponse__Output } from '../../../../couchbase/internal/hooks/v1/CreateHooksContextResponse';
import type { DestroyHooksContextRequest as _couchbase_internal_hooks_v1_DestroyHooksContextRequest, DestroyHooksContextRequest__Output as _couchbase_internal_hooks_v1_DestroyHooksContextRequest__Output } from '../../../../couchbase/internal/hooks/v1/DestroyHooksContextRequest';
import type { DestroyHooksContextResponse as _couchbase_internal_hooks_v1_DestroyHooksContextResponse, DestroyHooksContextResponse__Output as _couchbase_internal_hooks_v1_DestroyHooksContextResponse__Output } from '../../../../couchbase/internal/hooks/v1/DestroyHooksContextResponse';
import type { SignalBarrierRequest as _couchbase_internal_hooks_v1_SignalBarrierRequest, SignalBarrierRequest__Output as _couchbase_internal_hooks_v1_SignalBarrierRequest__Output } from '../../../../couchbase/internal/hooks/v1/SignalBarrierRequest';
import type { SignalBarrierResponse as _couchbase_internal_hooks_v1_SignalBarrierResponse, SignalBarrierResponse__Output as _couchbase_internal_hooks_v1_SignalBarrierResponse__Output } from '../../../../couchbase/internal/hooks/v1/SignalBarrierResponse';
import type { WatchBarrierRequest as _couchbase_internal_hooks_v1_WatchBarrierRequest, WatchBarrierRequest__Output as _couchbase_internal_hooks_v1_WatchBarrierRequest__Output } from '../../../../couchbase/internal/hooks/v1/WatchBarrierRequest';
import type { WatchBarrierResponse as _couchbase_internal_hooks_v1_WatchBarrierResponse, WatchBarrierResponse__Output as _couchbase_internal_hooks_v1_WatchBarrierResponse__Output } from '../../../../couchbase/internal/hooks/v1/WatchBarrierResponse';
import type { WatchRequestsRequest as _couchbase_internal_hooks_v1_WatchRequestsRequest, WatchRequestsRequest__Output as _couchbase_internal_hooks_v1_WatchRequestsRequest__Output } from '../../../../couchbase/internal/hooks/v1/WatchRequestsRequest';
import type { WatchRequestsResponse as _couchbase_internal_hooks_v1_WatchRequestsResponse, WatchRequestsResponse__Output as _couchbase_internal_hooks_v1_WatchRequestsResponse__Output } from '../../../../couchbase/internal/hooks/v1/WatchRequestsResponse';

/**
 * HooksService provides test hook registration and synchronization primitives.
 */
export interface HooksServiceClient extends grpc.Client {
  /**
   * AddHooks registers one or more hooks within a context.
   */
  AddHooks(argument: _couchbase_internal_hooks_v1_AddHooksRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_AddHooksResponse__Output>): grpc.ClientUnaryCall;
  AddHooks(argument: _couchbase_internal_hooks_v1_AddHooksRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_AddHooksResponse__Output>): grpc.ClientUnaryCall;
  AddHooks(argument: _couchbase_internal_hooks_v1_AddHooksRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_AddHooksResponse__Output>): grpc.ClientUnaryCall;
  AddHooks(argument: _couchbase_internal_hooks_v1_AddHooksRequest, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_AddHooksResponse__Output>): grpc.ClientUnaryCall;
  /**
   * AddHooks registers one or more hooks within a context.
   */
  addHooks(argument: _couchbase_internal_hooks_v1_AddHooksRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_AddHooksResponse__Output>): grpc.ClientUnaryCall;
  addHooks(argument: _couchbase_internal_hooks_v1_AddHooksRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_AddHooksResponse__Output>): grpc.ClientUnaryCall;
  addHooks(argument: _couchbase_internal_hooks_v1_AddHooksRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_AddHooksResponse__Output>): grpc.ClientUnaryCall;
  addHooks(argument: _couchbase_internal_hooks_v1_AddHooksRequest, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_AddHooksResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * CreateHooksContext creates a new isolated hooks context with its own
   * hooks, counters, and barriers.
   */
  CreateHooksContext(argument: _couchbase_internal_hooks_v1_CreateHooksContextRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_CreateHooksContextResponse__Output>): grpc.ClientUnaryCall;
  CreateHooksContext(argument: _couchbase_internal_hooks_v1_CreateHooksContextRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_CreateHooksContextResponse__Output>): grpc.ClientUnaryCall;
  CreateHooksContext(argument: _couchbase_internal_hooks_v1_CreateHooksContextRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_CreateHooksContextResponse__Output>): grpc.ClientUnaryCall;
  CreateHooksContext(argument: _couchbase_internal_hooks_v1_CreateHooksContextRequest, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_CreateHooksContextResponse__Output>): grpc.ClientUnaryCall;
  /**
   * CreateHooksContext creates a new isolated hooks context with its own
   * hooks, counters, and barriers.
   */
  createHooksContext(argument: _couchbase_internal_hooks_v1_CreateHooksContextRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_CreateHooksContextResponse__Output>): grpc.ClientUnaryCall;
  createHooksContext(argument: _couchbase_internal_hooks_v1_CreateHooksContextRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_CreateHooksContextResponse__Output>): grpc.ClientUnaryCall;
  createHooksContext(argument: _couchbase_internal_hooks_v1_CreateHooksContextRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_CreateHooksContextResponse__Output>): grpc.ClientUnaryCall;
  createHooksContext(argument: _couchbase_internal_hooks_v1_CreateHooksContextRequest, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_CreateHooksContextResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * DestroyHooksContext tears down a hooks context and all its state.
   */
  DestroyHooksContext(argument: _couchbase_internal_hooks_v1_DestroyHooksContextRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_DestroyHooksContextResponse__Output>): grpc.ClientUnaryCall;
  DestroyHooksContext(argument: _couchbase_internal_hooks_v1_DestroyHooksContextRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_DestroyHooksContextResponse__Output>): grpc.ClientUnaryCall;
  DestroyHooksContext(argument: _couchbase_internal_hooks_v1_DestroyHooksContextRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_DestroyHooksContextResponse__Output>): grpc.ClientUnaryCall;
  DestroyHooksContext(argument: _couchbase_internal_hooks_v1_DestroyHooksContextRequest, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_DestroyHooksContextResponse__Output>): grpc.ClientUnaryCall;
  /**
   * DestroyHooksContext tears down a hooks context and all its state.
   */
  destroyHooksContext(argument: _couchbase_internal_hooks_v1_DestroyHooksContextRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_DestroyHooksContextResponse__Output>): grpc.ClientUnaryCall;
  destroyHooksContext(argument: _couchbase_internal_hooks_v1_DestroyHooksContextRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_DestroyHooksContextResponse__Output>): grpc.ClientUnaryCall;
  destroyHooksContext(argument: _couchbase_internal_hooks_v1_DestroyHooksContextRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_DestroyHooksContextResponse__Output>): grpc.ClientUnaryCall;
  destroyHooksContext(argument: _couchbase_internal_hooks_v1_DestroyHooksContextRequest, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_DestroyHooksContextResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * SignalBarrier signals a barrier to release waiting requests.
   */
  SignalBarrier(argument: _couchbase_internal_hooks_v1_SignalBarrierRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_SignalBarrierResponse__Output>): grpc.ClientUnaryCall;
  SignalBarrier(argument: _couchbase_internal_hooks_v1_SignalBarrierRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_SignalBarrierResponse__Output>): grpc.ClientUnaryCall;
  SignalBarrier(argument: _couchbase_internal_hooks_v1_SignalBarrierRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_SignalBarrierResponse__Output>): grpc.ClientUnaryCall;
  SignalBarrier(argument: _couchbase_internal_hooks_v1_SignalBarrierRequest, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_SignalBarrierResponse__Output>): grpc.ClientUnaryCall;
  /**
   * SignalBarrier signals a barrier to release waiting requests.
   */
  signalBarrier(argument: _couchbase_internal_hooks_v1_SignalBarrierRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_SignalBarrierResponse__Output>): grpc.ClientUnaryCall;
  signalBarrier(argument: _couchbase_internal_hooks_v1_SignalBarrierRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_SignalBarrierResponse__Output>): grpc.ClientUnaryCall;
  signalBarrier(argument: _couchbase_internal_hooks_v1_SignalBarrierRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_SignalBarrierResponse__Output>): grpc.ClientUnaryCall;
  signalBarrier(argument: _couchbase_internal_hooks_v1_SignalBarrierRequest, callback: grpc.requestCallback<_couchbase_internal_hooks_v1_SignalBarrierResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * WatchBarrier streams messages each time a request reaches a barrier.
   */
  WatchBarrier(argument: _couchbase_internal_hooks_v1_WatchBarrierRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_internal_hooks_v1_WatchBarrierResponse__Output>;
  WatchBarrier(argument: _couchbase_internal_hooks_v1_WatchBarrierRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_internal_hooks_v1_WatchBarrierResponse__Output>;
  /**
   * WatchBarrier streams messages each time a request reaches a barrier.
   */
  watchBarrier(argument: _couchbase_internal_hooks_v1_WatchBarrierRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_internal_hooks_v1_WatchBarrierResponse__Output>;
  watchBarrier(argument: _couchbase_internal_hooks_v1_WatchBarrierRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_internal_hooks_v1_WatchBarrierResponse__Output>;
  
  /**
   * WatchRequests streams intercepted requests matching registered hooks.
   */
  WatchRequests(argument: _couchbase_internal_hooks_v1_WatchRequestsRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_internal_hooks_v1_WatchRequestsResponse__Output>;
  WatchRequests(argument: _couchbase_internal_hooks_v1_WatchRequestsRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_internal_hooks_v1_WatchRequestsResponse__Output>;
  /**
   * WatchRequests streams intercepted requests matching registered hooks.
   */
  watchRequests(argument: _couchbase_internal_hooks_v1_WatchRequestsRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_internal_hooks_v1_WatchRequestsResponse__Output>;
  watchRequests(argument: _couchbase_internal_hooks_v1_WatchRequestsRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_internal_hooks_v1_WatchRequestsResponse__Output>;
  
}

/**
 * HooksService provides test hook registration and synchronization primitives.
 */
export interface HooksServiceHandlers extends grpc.UntypedServiceImplementation {
  /**
   * AddHooks registers one or more hooks within a context.
   */
  AddHooks: grpc.handleUnaryCall<_couchbase_internal_hooks_v1_AddHooksRequest__Output, _couchbase_internal_hooks_v1_AddHooksResponse>;
  
  /**
   * CreateHooksContext creates a new isolated hooks context with its own
   * hooks, counters, and barriers.
   */
  CreateHooksContext: grpc.handleUnaryCall<_couchbase_internal_hooks_v1_CreateHooksContextRequest__Output, _couchbase_internal_hooks_v1_CreateHooksContextResponse>;
  
  /**
   * DestroyHooksContext tears down a hooks context and all its state.
   */
  DestroyHooksContext: grpc.handleUnaryCall<_couchbase_internal_hooks_v1_DestroyHooksContextRequest__Output, _couchbase_internal_hooks_v1_DestroyHooksContextResponse>;
  
  /**
   * SignalBarrier signals a barrier to release waiting requests.
   */
  SignalBarrier: grpc.handleUnaryCall<_couchbase_internal_hooks_v1_SignalBarrierRequest__Output, _couchbase_internal_hooks_v1_SignalBarrierResponse>;
  
  /**
   * WatchBarrier streams messages each time a request reaches a barrier.
   */
  WatchBarrier: grpc.handleServerStreamingCall<_couchbase_internal_hooks_v1_WatchBarrierRequest__Output, _couchbase_internal_hooks_v1_WatchBarrierResponse>;
  
  /**
   * WatchRequests streams intercepted requests matching registered hooks.
   */
  WatchRequests: grpc.handleServerStreamingCall<_couchbase_internal_hooks_v1_WatchRequestsRequest__Output, _couchbase_internal_hooks_v1_WatchRequestsResponse>;
  
}

export interface HooksServiceDefinition extends grpc.ServiceDefinition {
  AddHooks: MethodDefinition<_couchbase_internal_hooks_v1_AddHooksRequest, _couchbase_internal_hooks_v1_AddHooksResponse, _couchbase_internal_hooks_v1_AddHooksRequest__Output, _couchbase_internal_hooks_v1_AddHooksResponse__Output>
  CreateHooksContext: MethodDefinition<_couchbase_internal_hooks_v1_CreateHooksContextRequest, _couchbase_internal_hooks_v1_CreateHooksContextResponse, _couchbase_internal_hooks_v1_CreateHooksContextRequest__Output, _couchbase_internal_hooks_v1_CreateHooksContextResponse__Output>
  DestroyHooksContext: MethodDefinition<_couchbase_internal_hooks_v1_DestroyHooksContextRequest, _couchbase_internal_hooks_v1_DestroyHooksContextResponse, _couchbase_internal_hooks_v1_DestroyHooksContextRequest__Output, _couchbase_internal_hooks_v1_DestroyHooksContextResponse__Output>
  SignalBarrier: MethodDefinition<_couchbase_internal_hooks_v1_SignalBarrierRequest, _couchbase_internal_hooks_v1_SignalBarrierResponse, _couchbase_internal_hooks_v1_SignalBarrierRequest__Output, _couchbase_internal_hooks_v1_SignalBarrierResponse__Output>
  WatchBarrier: MethodDefinition<_couchbase_internal_hooks_v1_WatchBarrierRequest, _couchbase_internal_hooks_v1_WatchBarrierResponse, _couchbase_internal_hooks_v1_WatchBarrierRequest__Output, _couchbase_internal_hooks_v1_WatchBarrierResponse__Output>
  WatchRequests: MethodDefinition<_couchbase_internal_hooks_v1_WatchRequestsRequest, _couchbase_internal_hooks_v1_WatchRequestsResponse, _couchbase_internal_hooks_v1_WatchRequestsRequest__Output, _couchbase_internal_hooks_v1_WatchRequestsResponse__Output>
}
