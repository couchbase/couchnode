// Original file: couchbase/kv/v1/kv.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { AppendRequest as _couchbase_kv_v1_AppendRequest, AppendRequest__Output as _couchbase_kv_v1_AppendRequest__Output } from '../../../couchbase/kv/v1/AppendRequest';
import type { AppendResponse as _couchbase_kv_v1_AppendResponse, AppendResponse__Output as _couchbase_kv_v1_AppendResponse__Output } from '../../../couchbase/kv/v1/AppendResponse';
import type { DecrementRequest as _couchbase_kv_v1_DecrementRequest, DecrementRequest__Output as _couchbase_kv_v1_DecrementRequest__Output } from '../../../couchbase/kv/v1/DecrementRequest';
import type { DecrementResponse as _couchbase_kv_v1_DecrementResponse, DecrementResponse__Output as _couchbase_kv_v1_DecrementResponse__Output } from '../../../couchbase/kv/v1/DecrementResponse';
import type { ExistsRequest as _couchbase_kv_v1_ExistsRequest, ExistsRequest__Output as _couchbase_kv_v1_ExistsRequest__Output } from '../../../couchbase/kv/v1/ExistsRequest';
import type { ExistsResponse as _couchbase_kv_v1_ExistsResponse, ExistsResponse__Output as _couchbase_kv_v1_ExistsResponse__Output } from '../../../couchbase/kv/v1/ExistsResponse';
import type { GetAllReplicasRequest as _couchbase_kv_v1_GetAllReplicasRequest, GetAllReplicasRequest__Output as _couchbase_kv_v1_GetAllReplicasRequest__Output } from '../../../couchbase/kv/v1/GetAllReplicasRequest';
import type { GetAllReplicasResponse as _couchbase_kv_v1_GetAllReplicasResponse, GetAllReplicasResponse__Output as _couchbase_kv_v1_GetAllReplicasResponse__Output } from '../../../couchbase/kv/v1/GetAllReplicasResponse';
import type { GetAndLockRequest as _couchbase_kv_v1_GetAndLockRequest, GetAndLockRequest__Output as _couchbase_kv_v1_GetAndLockRequest__Output } from '../../../couchbase/kv/v1/GetAndLockRequest';
import type { GetAndLockResponse as _couchbase_kv_v1_GetAndLockResponse, GetAndLockResponse__Output as _couchbase_kv_v1_GetAndLockResponse__Output } from '../../../couchbase/kv/v1/GetAndLockResponse';
import type { GetAndTouchRequest as _couchbase_kv_v1_GetAndTouchRequest, GetAndTouchRequest__Output as _couchbase_kv_v1_GetAndTouchRequest__Output } from '../../../couchbase/kv/v1/GetAndTouchRequest';
import type { GetAndTouchResponse as _couchbase_kv_v1_GetAndTouchResponse, GetAndTouchResponse__Output as _couchbase_kv_v1_GetAndTouchResponse__Output } from '../../../couchbase/kv/v1/GetAndTouchResponse';
import type { GetRequest as _couchbase_kv_v1_GetRequest, GetRequest__Output as _couchbase_kv_v1_GetRequest__Output } from '../../../couchbase/kv/v1/GetRequest';
import type { GetResponse as _couchbase_kv_v1_GetResponse, GetResponse__Output as _couchbase_kv_v1_GetResponse__Output } from '../../../couchbase/kv/v1/GetResponse';
import type { IncrementRequest as _couchbase_kv_v1_IncrementRequest, IncrementRequest__Output as _couchbase_kv_v1_IncrementRequest__Output } from '../../../couchbase/kv/v1/IncrementRequest';
import type { IncrementResponse as _couchbase_kv_v1_IncrementResponse, IncrementResponse__Output as _couchbase_kv_v1_IncrementResponse__Output } from '../../../couchbase/kv/v1/IncrementResponse';
import type { InsertRequest as _couchbase_kv_v1_InsertRequest, InsertRequest__Output as _couchbase_kv_v1_InsertRequest__Output } from '../../../couchbase/kv/v1/InsertRequest';
import type { InsertResponse as _couchbase_kv_v1_InsertResponse, InsertResponse__Output as _couchbase_kv_v1_InsertResponse__Output } from '../../../couchbase/kv/v1/InsertResponse';
import type { LookupInRequest as _couchbase_kv_v1_LookupInRequest, LookupInRequest__Output as _couchbase_kv_v1_LookupInRequest__Output } from '../../../couchbase/kv/v1/LookupInRequest';
import type { LookupInResponse as _couchbase_kv_v1_LookupInResponse, LookupInResponse__Output as _couchbase_kv_v1_LookupInResponse__Output } from '../../../couchbase/kv/v1/LookupInResponse';
import type { MutateInRequest as _couchbase_kv_v1_MutateInRequest, MutateInRequest__Output as _couchbase_kv_v1_MutateInRequest__Output } from '../../../couchbase/kv/v1/MutateInRequest';
import type { MutateInResponse as _couchbase_kv_v1_MutateInResponse, MutateInResponse__Output as _couchbase_kv_v1_MutateInResponse__Output } from '../../../couchbase/kv/v1/MutateInResponse';
import type { PrependRequest as _couchbase_kv_v1_PrependRequest, PrependRequest__Output as _couchbase_kv_v1_PrependRequest__Output } from '../../../couchbase/kv/v1/PrependRequest';
import type { PrependResponse as _couchbase_kv_v1_PrependResponse, PrependResponse__Output as _couchbase_kv_v1_PrependResponse__Output } from '../../../couchbase/kv/v1/PrependResponse';
import type { RemoveRequest as _couchbase_kv_v1_RemoveRequest, RemoveRequest__Output as _couchbase_kv_v1_RemoveRequest__Output } from '../../../couchbase/kv/v1/RemoveRequest';
import type { RemoveResponse as _couchbase_kv_v1_RemoveResponse, RemoveResponse__Output as _couchbase_kv_v1_RemoveResponse__Output } from '../../../couchbase/kv/v1/RemoveResponse';
import type { ReplaceRequest as _couchbase_kv_v1_ReplaceRequest, ReplaceRequest__Output as _couchbase_kv_v1_ReplaceRequest__Output } from '../../../couchbase/kv/v1/ReplaceRequest';
import type { ReplaceResponse as _couchbase_kv_v1_ReplaceResponse, ReplaceResponse__Output as _couchbase_kv_v1_ReplaceResponse__Output } from '../../../couchbase/kv/v1/ReplaceResponse';
import type { TouchRequest as _couchbase_kv_v1_TouchRequest, TouchRequest__Output as _couchbase_kv_v1_TouchRequest__Output } from '../../../couchbase/kv/v1/TouchRequest';
import type { TouchResponse as _couchbase_kv_v1_TouchResponse, TouchResponse__Output as _couchbase_kv_v1_TouchResponse__Output } from '../../../couchbase/kv/v1/TouchResponse';
import type { UnlockRequest as _couchbase_kv_v1_UnlockRequest, UnlockRequest__Output as _couchbase_kv_v1_UnlockRequest__Output } from '../../../couchbase/kv/v1/UnlockRequest';
import type { UnlockResponse as _couchbase_kv_v1_UnlockResponse, UnlockResponse__Output as _couchbase_kv_v1_UnlockResponse__Output } from '../../../couchbase/kv/v1/UnlockResponse';
import type { UpsertRequest as _couchbase_kv_v1_UpsertRequest, UpsertRequest__Output as _couchbase_kv_v1_UpsertRequest__Output } from '../../../couchbase/kv/v1/UpsertRequest';
import type { UpsertResponse as _couchbase_kv_v1_UpsertResponse, UpsertResponse__Output as _couchbase_kv_v1_UpsertResponse__Output } from '../../../couchbase/kv/v1/UpsertResponse';

/**
 * KvService provides key-value document operations against a Couchbase cluster.
 * Operations are organized into reads, mutations, counters, binary operations,
 * sub-document operations, and replica reads.
 */
export interface KvServiceClient extends grpc.Client {
  /**
   * Append appends raw bytes to the end of an existing document's value.
   */
  Append(argument: _couchbase_kv_v1_AppendRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_AppendResponse__Output>): grpc.ClientUnaryCall;
  Append(argument: _couchbase_kv_v1_AppendRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_AppendResponse__Output>): grpc.ClientUnaryCall;
  Append(argument: _couchbase_kv_v1_AppendRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_AppendResponse__Output>): grpc.ClientUnaryCall;
  Append(argument: _couchbase_kv_v1_AppendRequest, callback: grpc.requestCallback<_couchbase_kv_v1_AppendResponse__Output>): grpc.ClientUnaryCall;
  /**
   * Append appends raw bytes to the end of an existing document's value.
   */
  append(argument: _couchbase_kv_v1_AppendRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_AppendResponse__Output>): grpc.ClientUnaryCall;
  append(argument: _couchbase_kv_v1_AppendRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_AppendResponse__Output>): grpc.ClientUnaryCall;
  append(argument: _couchbase_kv_v1_AppendRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_AppendResponse__Output>): grpc.ClientUnaryCall;
  append(argument: _couchbase_kv_v1_AppendRequest, callback: grpc.requestCallback<_couchbase_kv_v1_AppendResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * Decrement atomically decrements a counter document by the specified delta.
   * If the document does not exist and an initial value is provided, it is
   * created with that value.
   */
  Decrement(argument: _couchbase_kv_v1_DecrementRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_DecrementResponse__Output>): grpc.ClientUnaryCall;
  Decrement(argument: _couchbase_kv_v1_DecrementRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_DecrementResponse__Output>): grpc.ClientUnaryCall;
  Decrement(argument: _couchbase_kv_v1_DecrementRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_DecrementResponse__Output>): grpc.ClientUnaryCall;
  Decrement(argument: _couchbase_kv_v1_DecrementRequest, callback: grpc.requestCallback<_couchbase_kv_v1_DecrementResponse__Output>): grpc.ClientUnaryCall;
  /**
   * Decrement atomically decrements a counter document by the specified delta.
   * If the document does not exist and an initial value is provided, it is
   * created with that value.
   */
  decrement(argument: _couchbase_kv_v1_DecrementRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_DecrementResponse__Output>): grpc.ClientUnaryCall;
  decrement(argument: _couchbase_kv_v1_DecrementRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_DecrementResponse__Output>): grpc.ClientUnaryCall;
  decrement(argument: _couchbase_kv_v1_DecrementRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_DecrementResponse__Output>): grpc.ClientUnaryCall;
  decrement(argument: _couchbase_kv_v1_DecrementRequest, callback: grpc.requestCallback<_couchbase_kv_v1_DecrementResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * Exists checks whether a document exists without retrieving its content.
   * Returns a boolean result and the current CAS.
   */
  Exists(argument: _couchbase_kv_v1_ExistsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_ExistsResponse__Output>): grpc.ClientUnaryCall;
  Exists(argument: _couchbase_kv_v1_ExistsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_ExistsResponse__Output>): grpc.ClientUnaryCall;
  Exists(argument: _couchbase_kv_v1_ExistsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_ExistsResponse__Output>): grpc.ClientUnaryCall;
  Exists(argument: _couchbase_kv_v1_ExistsRequest, callback: grpc.requestCallback<_couchbase_kv_v1_ExistsResponse__Output>): grpc.ClientUnaryCall;
  /**
   * Exists checks whether a document exists without retrieving its content.
   * Returns a boolean result and the current CAS.
   */
  exists(argument: _couchbase_kv_v1_ExistsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_ExistsResponse__Output>): grpc.ClientUnaryCall;
  exists(argument: _couchbase_kv_v1_ExistsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_ExistsResponse__Output>): grpc.ClientUnaryCall;
  exists(argument: _couchbase_kv_v1_ExistsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_ExistsResponse__Output>): grpc.ClientUnaryCall;
  exists(argument: _couchbase_kv_v1_ExistsRequest, callback: grpc.requestCallback<_couchbase_kv_v1_ExistsResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * Get retrieves a document by key. Supports field-level projection via the
   * `project` field and optional compressed responses.
   */
  Get(argument: _couchbase_kv_v1_GetRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_GetResponse__Output>): grpc.ClientUnaryCall;
  Get(argument: _couchbase_kv_v1_GetRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_GetResponse__Output>): grpc.ClientUnaryCall;
  Get(argument: _couchbase_kv_v1_GetRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_GetResponse__Output>): grpc.ClientUnaryCall;
  Get(argument: _couchbase_kv_v1_GetRequest, callback: grpc.requestCallback<_couchbase_kv_v1_GetResponse__Output>): grpc.ClientUnaryCall;
  /**
   * Get retrieves a document by key. Supports field-level projection via the
   * `project` field and optional compressed responses.
   */
  get(argument: _couchbase_kv_v1_GetRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_GetResponse__Output>): grpc.ClientUnaryCall;
  get(argument: _couchbase_kv_v1_GetRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_GetResponse__Output>): grpc.ClientUnaryCall;
  get(argument: _couchbase_kv_v1_GetRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_GetResponse__Output>): grpc.ClientUnaryCall;
  get(argument: _couchbase_kv_v1_GetRequest, callback: grpc.requestCallback<_couchbase_kv_v1_GetResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * GetAllReplicas returns the document from the active node and all replica
   * nodes as a server-streamed response. Each response indicates whether it
   * is from a replica via the is_replica flag.
   */
  GetAllReplicas(argument: _couchbase_kv_v1_GetAllReplicasRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_kv_v1_GetAllReplicasResponse__Output>;
  GetAllReplicas(argument: _couchbase_kv_v1_GetAllReplicasRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_kv_v1_GetAllReplicasResponse__Output>;
  /**
   * GetAllReplicas returns the document from the active node and all replica
   * nodes as a server-streamed response. Each response indicates whether it
   * is from a replica via the is_replica flag.
   */
  getAllReplicas(argument: _couchbase_kv_v1_GetAllReplicasRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_kv_v1_GetAllReplicasResponse__Output>;
  getAllReplicas(argument: _couchbase_kv_v1_GetAllReplicasRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_kv_v1_GetAllReplicasResponse__Output>;
  
  /**
   * GetAndLock retrieves a document and acquires a pessimistic lock for the
   * specified duration. The lock must be released via Unlock or will
   * auto-expire after lock_time_secs.
   */
  GetAndLock(argument: _couchbase_kv_v1_GetAndLockRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_GetAndLockResponse__Output>): grpc.ClientUnaryCall;
  GetAndLock(argument: _couchbase_kv_v1_GetAndLockRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_GetAndLockResponse__Output>): grpc.ClientUnaryCall;
  GetAndLock(argument: _couchbase_kv_v1_GetAndLockRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_GetAndLockResponse__Output>): grpc.ClientUnaryCall;
  GetAndLock(argument: _couchbase_kv_v1_GetAndLockRequest, callback: grpc.requestCallback<_couchbase_kv_v1_GetAndLockResponse__Output>): grpc.ClientUnaryCall;
  /**
   * GetAndLock retrieves a document and acquires a pessimistic lock for the
   * specified duration. The lock must be released via Unlock or will
   * auto-expire after lock_time_secs.
   */
  getAndLock(argument: _couchbase_kv_v1_GetAndLockRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_GetAndLockResponse__Output>): grpc.ClientUnaryCall;
  getAndLock(argument: _couchbase_kv_v1_GetAndLockRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_GetAndLockResponse__Output>): grpc.ClientUnaryCall;
  getAndLock(argument: _couchbase_kv_v1_GetAndLockRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_GetAndLockResponse__Output>): grpc.ClientUnaryCall;
  getAndLock(argument: _couchbase_kv_v1_GetAndLockRequest, callback: grpc.requestCallback<_couchbase_kv_v1_GetAndLockResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * GetAndTouch retrieves a document and simultaneously resets its expiry.
   */
  GetAndTouch(argument: _couchbase_kv_v1_GetAndTouchRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_GetAndTouchResponse__Output>): grpc.ClientUnaryCall;
  GetAndTouch(argument: _couchbase_kv_v1_GetAndTouchRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_GetAndTouchResponse__Output>): grpc.ClientUnaryCall;
  GetAndTouch(argument: _couchbase_kv_v1_GetAndTouchRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_GetAndTouchResponse__Output>): grpc.ClientUnaryCall;
  GetAndTouch(argument: _couchbase_kv_v1_GetAndTouchRequest, callback: grpc.requestCallback<_couchbase_kv_v1_GetAndTouchResponse__Output>): grpc.ClientUnaryCall;
  /**
   * GetAndTouch retrieves a document and simultaneously resets its expiry.
   */
  getAndTouch(argument: _couchbase_kv_v1_GetAndTouchRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_GetAndTouchResponse__Output>): grpc.ClientUnaryCall;
  getAndTouch(argument: _couchbase_kv_v1_GetAndTouchRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_GetAndTouchResponse__Output>): grpc.ClientUnaryCall;
  getAndTouch(argument: _couchbase_kv_v1_GetAndTouchRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_GetAndTouchResponse__Output>): grpc.ClientUnaryCall;
  getAndTouch(argument: _couchbase_kv_v1_GetAndTouchRequest, callback: grpc.requestCallback<_couchbase_kv_v1_GetAndTouchResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * Increment atomically increments a counter document by the specified delta.
   * If the document does not exist and an initial value is provided, it is
   * created with that value.
   */
  Increment(argument: _couchbase_kv_v1_IncrementRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_IncrementResponse__Output>): grpc.ClientUnaryCall;
  Increment(argument: _couchbase_kv_v1_IncrementRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_IncrementResponse__Output>): grpc.ClientUnaryCall;
  Increment(argument: _couchbase_kv_v1_IncrementRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_IncrementResponse__Output>): grpc.ClientUnaryCall;
  Increment(argument: _couchbase_kv_v1_IncrementRequest, callback: grpc.requestCallback<_couchbase_kv_v1_IncrementResponse__Output>): grpc.ClientUnaryCall;
  /**
   * Increment atomically increments a counter document by the specified delta.
   * If the document does not exist and an initial value is provided, it is
   * created with that value.
   */
  increment(argument: _couchbase_kv_v1_IncrementRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_IncrementResponse__Output>): grpc.ClientUnaryCall;
  increment(argument: _couchbase_kv_v1_IncrementRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_IncrementResponse__Output>): grpc.ClientUnaryCall;
  increment(argument: _couchbase_kv_v1_IncrementRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_IncrementResponse__Output>): grpc.ClientUnaryCall;
  increment(argument: _couchbase_kv_v1_IncrementRequest, callback: grpc.requestCallback<_couchbase_kv_v1_IncrementResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * Insert creates a new document. Fails if the document already exists.
   * Supports durability requirements.
   */
  Insert(argument: _couchbase_kv_v1_InsertRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_InsertResponse__Output>): grpc.ClientUnaryCall;
  Insert(argument: _couchbase_kv_v1_InsertRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_InsertResponse__Output>): grpc.ClientUnaryCall;
  Insert(argument: _couchbase_kv_v1_InsertRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_InsertResponse__Output>): grpc.ClientUnaryCall;
  Insert(argument: _couchbase_kv_v1_InsertRequest, callback: grpc.requestCallback<_couchbase_kv_v1_InsertResponse__Output>): grpc.ClientUnaryCall;
  /**
   * Insert creates a new document. Fails if the document already exists.
   * Supports durability requirements.
   */
  insert(argument: _couchbase_kv_v1_InsertRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_InsertResponse__Output>): grpc.ClientUnaryCall;
  insert(argument: _couchbase_kv_v1_InsertRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_InsertResponse__Output>): grpc.ClientUnaryCall;
  insert(argument: _couchbase_kv_v1_InsertRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_InsertResponse__Output>): grpc.ClientUnaryCall;
  insert(argument: _couchbase_kv_v1_InsertRequest, callback: grpc.requestCallback<_couchbase_kv_v1_InsertResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * LookupIn performs one or more sub-document lookup operations (get, exists,
   * count) on paths within a JSON document. Supports xattr and access_deleted
   * flags.
   */
  LookupIn(argument: _couchbase_kv_v1_LookupInRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_LookupInResponse__Output>): grpc.ClientUnaryCall;
  LookupIn(argument: _couchbase_kv_v1_LookupInRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_LookupInResponse__Output>): grpc.ClientUnaryCall;
  LookupIn(argument: _couchbase_kv_v1_LookupInRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_LookupInResponse__Output>): grpc.ClientUnaryCall;
  LookupIn(argument: _couchbase_kv_v1_LookupInRequest, callback: grpc.requestCallback<_couchbase_kv_v1_LookupInResponse__Output>): grpc.ClientUnaryCall;
  /**
   * LookupIn performs one or more sub-document lookup operations (get, exists,
   * count) on paths within a JSON document. Supports xattr and access_deleted
   * flags.
   */
  lookupIn(argument: _couchbase_kv_v1_LookupInRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_LookupInResponse__Output>): grpc.ClientUnaryCall;
  lookupIn(argument: _couchbase_kv_v1_LookupInRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_LookupInResponse__Output>): grpc.ClientUnaryCall;
  lookupIn(argument: _couchbase_kv_v1_LookupInRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_LookupInResponse__Output>): grpc.ClientUnaryCall;
  lookupIn(argument: _couchbase_kv_v1_LookupInRequest, callback: grpc.requestCallback<_couchbase_kv_v1_LookupInResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * MutateIn performs one or more sub-document mutation operations on paths
   * within a JSON document. Supports insert, upsert, replace, remove, array
   * operations, and counters at the sub-document level.
   */
  MutateIn(argument: _couchbase_kv_v1_MutateInRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_MutateInResponse__Output>): grpc.ClientUnaryCall;
  MutateIn(argument: _couchbase_kv_v1_MutateInRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_MutateInResponse__Output>): grpc.ClientUnaryCall;
  MutateIn(argument: _couchbase_kv_v1_MutateInRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_MutateInResponse__Output>): grpc.ClientUnaryCall;
  MutateIn(argument: _couchbase_kv_v1_MutateInRequest, callback: grpc.requestCallback<_couchbase_kv_v1_MutateInResponse__Output>): grpc.ClientUnaryCall;
  /**
   * MutateIn performs one or more sub-document mutation operations on paths
   * within a JSON document. Supports insert, upsert, replace, remove, array
   * operations, and counters at the sub-document level.
   */
  mutateIn(argument: _couchbase_kv_v1_MutateInRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_MutateInResponse__Output>): grpc.ClientUnaryCall;
  mutateIn(argument: _couchbase_kv_v1_MutateInRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_MutateInResponse__Output>): grpc.ClientUnaryCall;
  mutateIn(argument: _couchbase_kv_v1_MutateInRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_MutateInResponse__Output>): grpc.ClientUnaryCall;
  mutateIn(argument: _couchbase_kv_v1_MutateInRequest, callback: grpc.requestCallback<_couchbase_kv_v1_MutateInResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * Prepend prepends raw bytes to the beginning of an existing document's
   * value.
   */
  Prepend(argument: _couchbase_kv_v1_PrependRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_PrependResponse__Output>): grpc.ClientUnaryCall;
  Prepend(argument: _couchbase_kv_v1_PrependRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_PrependResponse__Output>): grpc.ClientUnaryCall;
  Prepend(argument: _couchbase_kv_v1_PrependRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_PrependResponse__Output>): grpc.ClientUnaryCall;
  Prepend(argument: _couchbase_kv_v1_PrependRequest, callback: grpc.requestCallback<_couchbase_kv_v1_PrependResponse__Output>): grpc.ClientUnaryCall;
  /**
   * Prepend prepends raw bytes to the beginning of an existing document's
   * value.
   */
  prepend(argument: _couchbase_kv_v1_PrependRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_PrependResponse__Output>): grpc.ClientUnaryCall;
  prepend(argument: _couchbase_kv_v1_PrependRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_PrependResponse__Output>): grpc.ClientUnaryCall;
  prepend(argument: _couchbase_kv_v1_PrependRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_PrependResponse__Output>): grpc.ClientUnaryCall;
  prepend(argument: _couchbase_kv_v1_PrependRequest, callback: grpc.requestCallback<_couchbase_kv_v1_PrependResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * Remove deletes a document. Supports optimistic locking via optional CAS
   * and durability requirements.
   */
  Remove(argument: _couchbase_kv_v1_RemoveRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_RemoveResponse__Output>): grpc.ClientUnaryCall;
  Remove(argument: _couchbase_kv_v1_RemoveRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_RemoveResponse__Output>): grpc.ClientUnaryCall;
  Remove(argument: _couchbase_kv_v1_RemoveRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_RemoveResponse__Output>): grpc.ClientUnaryCall;
  Remove(argument: _couchbase_kv_v1_RemoveRequest, callback: grpc.requestCallback<_couchbase_kv_v1_RemoveResponse__Output>): grpc.ClientUnaryCall;
  /**
   * Remove deletes a document. Supports optimistic locking via optional CAS
   * and durability requirements.
   */
  remove(argument: _couchbase_kv_v1_RemoveRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_RemoveResponse__Output>): grpc.ClientUnaryCall;
  remove(argument: _couchbase_kv_v1_RemoveRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_RemoveResponse__Output>): grpc.ClientUnaryCall;
  remove(argument: _couchbase_kv_v1_RemoveRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_RemoveResponse__Output>): grpc.ClientUnaryCall;
  remove(argument: _couchbase_kv_v1_RemoveRequest, callback: grpc.requestCallback<_couchbase_kv_v1_RemoveResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * Replace updates an existing document. Fails if the document does not exist.
   * Supports optimistic locking via optional CAS.
   */
  Replace(argument: _couchbase_kv_v1_ReplaceRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_ReplaceResponse__Output>): grpc.ClientUnaryCall;
  Replace(argument: _couchbase_kv_v1_ReplaceRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_ReplaceResponse__Output>): grpc.ClientUnaryCall;
  Replace(argument: _couchbase_kv_v1_ReplaceRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_ReplaceResponse__Output>): grpc.ClientUnaryCall;
  Replace(argument: _couchbase_kv_v1_ReplaceRequest, callback: grpc.requestCallback<_couchbase_kv_v1_ReplaceResponse__Output>): grpc.ClientUnaryCall;
  /**
   * Replace updates an existing document. Fails if the document does not exist.
   * Supports optimistic locking via optional CAS.
   */
  replace(argument: _couchbase_kv_v1_ReplaceRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_ReplaceResponse__Output>): grpc.ClientUnaryCall;
  replace(argument: _couchbase_kv_v1_ReplaceRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_ReplaceResponse__Output>): grpc.ClientUnaryCall;
  replace(argument: _couchbase_kv_v1_ReplaceRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_ReplaceResponse__Output>): grpc.ClientUnaryCall;
  replace(argument: _couchbase_kv_v1_ReplaceRequest, callback: grpc.requestCallback<_couchbase_kv_v1_ReplaceResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * Touch resets a document's expiry without retrieving its content.
   */
  Touch(argument: _couchbase_kv_v1_TouchRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_TouchResponse__Output>): grpc.ClientUnaryCall;
  Touch(argument: _couchbase_kv_v1_TouchRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_TouchResponse__Output>): grpc.ClientUnaryCall;
  Touch(argument: _couchbase_kv_v1_TouchRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_TouchResponse__Output>): grpc.ClientUnaryCall;
  Touch(argument: _couchbase_kv_v1_TouchRequest, callback: grpc.requestCallback<_couchbase_kv_v1_TouchResponse__Output>): grpc.ClientUnaryCall;
  /**
   * Touch resets a document's expiry without retrieving its content.
   */
  touch(argument: _couchbase_kv_v1_TouchRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_TouchResponse__Output>): grpc.ClientUnaryCall;
  touch(argument: _couchbase_kv_v1_TouchRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_TouchResponse__Output>): grpc.ClientUnaryCall;
  touch(argument: _couchbase_kv_v1_TouchRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_TouchResponse__Output>): grpc.ClientUnaryCall;
  touch(argument: _couchbase_kv_v1_TouchRequest, callback: grpc.requestCallback<_couchbase_kv_v1_TouchResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * Unlock releases a pessimistic lock previously acquired by GetAndLock.
   * Requires the CAS value returned by the locking operation.
   */
  Unlock(argument: _couchbase_kv_v1_UnlockRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_UnlockResponse__Output>): grpc.ClientUnaryCall;
  Unlock(argument: _couchbase_kv_v1_UnlockRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_UnlockResponse__Output>): grpc.ClientUnaryCall;
  Unlock(argument: _couchbase_kv_v1_UnlockRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_UnlockResponse__Output>): grpc.ClientUnaryCall;
  Unlock(argument: _couchbase_kv_v1_UnlockRequest, callback: grpc.requestCallback<_couchbase_kv_v1_UnlockResponse__Output>): grpc.ClientUnaryCall;
  /**
   * Unlock releases a pessimistic lock previously acquired by GetAndLock.
   * Requires the CAS value returned by the locking operation.
   */
  unlock(argument: _couchbase_kv_v1_UnlockRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_UnlockResponse__Output>): grpc.ClientUnaryCall;
  unlock(argument: _couchbase_kv_v1_UnlockRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_UnlockResponse__Output>): grpc.ClientUnaryCall;
  unlock(argument: _couchbase_kv_v1_UnlockRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_UnlockResponse__Output>): grpc.ClientUnaryCall;
  unlock(argument: _couchbase_kv_v1_UnlockRequest, callback: grpc.requestCallback<_couchbase_kv_v1_UnlockResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * Upsert creates or replaces a document unconditionally.
   * Supports preserving the existing expiry on update.
   */
  Upsert(argument: _couchbase_kv_v1_UpsertRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_UpsertResponse__Output>): grpc.ClientUnaryCall;
  Upsert(argument: _couchbase_kv_v1_UpsertRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_UpsertResponse__Output>): grpc.ClientUnaryCall;
  Upsert(argument: _couchbase_kv_v1_UpsertRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_UpsertResponse__Output>): grpc.ClientUnaryCall;
  Upsert(argument: _couchbase_kv_v1_UpsertRequest, callback: grpc.requestCallback<_couchbase_kv_v1_UpsertResponse__Output>): grpc.ClientUnaryCall;
  /**
   * Upsert creates or replaces a document unconditionally.
   * Supports preserving the existing expiry on update.
   */
  upsert(argument: _couchbase_kv_v1_UpsertRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_UpsertResponse__Output>): grpc.ClientUnaryCall;
  upsert(argument: _couchbase_kv_v1_UpsertRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_kv_v1_UpsertResponse__Output>): grpc.ClientUnaryCall;
  upsert(argument: _couchbase_kv_v1_UpsertRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_kv_v1_UpsertResponse__Output>): grpc.ClientUnaryCall;
  upsert(argument: _couchbase_kv_v1_UpsertRequest, callback: grpc.requestCallback<_couchbase_kv_v1_UpsertResponse__Output>): grpc.ClientUnaryCall;
  
}

/**
 * KvService provides key-value document operations against a Couchbase cluster.
 * Operations are organized into reads, mutations, counters, binary operations,
 * sub-document operations, and replica reads.
 */
export interface KvServiceHandlers extends grpc.UntypedServiceImplementation {
  /**
   * Append appends raw bytes to the end of an existing document's value.
   */
  Append: grpc.handleUnaryCall<_couchbase_kv_v1_AppendRequest__Output, _couchbase_kv_v1_AppendResponse>;
  
  /**
   * Decrement atomically decrements a counter document by the specified delta.
   * If the document does not exist and an initial value is provided, it is
   * created with that value.
   */
  Decrement: grpc.handleUnaryCall<_couchbase_kv_v1_DecrementRequest__Output, _couchbase_kv_v1_DecrementResponse>;
  
  /**
   * Exists checks whether a document exists without retrieving its content.
   * Returns a boolean result and the current CAS.
   */
  Exists: grpc.handleUnaryCall<_couchbase_kv_v1_ExistsRequest__Output, _couchbase_kv_v1_ExistsResponse>;
  
  /**
   * Get retrieves a document by key. Supports field-level projection via the
   * `project` field and optional compressed responses.
   */
  Get: grpc.handleUnaryCall<_couchbase_kv_v1_GetRequest__Output, _couchbase_kv_v1_GetResponse>;
  
  /**
   * GetAllReplicas returns the document from the active node and all replica
   * nodes as a server-streamed response. Each response indicates whether it
   * is from a replica via the is_replica flag.
   */
  GetAllReplicas: grpc.handleServerStreamingCall<_couchbase_kv_v1_GetAllReplicasRequest__Output, _couchbase_kv_v1_GetAllReplicasResponse>;
  
  /**
   * GetAndLock retrieves a document and acquires a pessimistic lock for the
   * specified duration. The lock must be released via Unlock or will
   * auto-expire after lock_time_secs.
   */
  GetAndLock: grpc.handleUnaryCall<_couchbase_kv_v1_GetAndLockRequest__Output, _couchbase_kv_v1_GetAndLockResponse>;
  
  /**
   * GetAndTouch retrieves a document and simultaneously resets its expiry.
   */
  GetAndTouch: grpc.handleUnaryCall<_couchbase_kv_v1_GetAndTouchRequest__Output, _couchbase_kv_v1_GetAndTouchResponse>;
  
  /**
   * Increment atomically increments a counter document by the specified delta.
   * If the document does not exist and an initial value is provided, it is
   * created with that value.
   */
  Increment: grpc.handleUnaryCall<_couchbase_kv_v1_IncrementRequest__Output, _couchbase_kv_v1_IncrementResponse>;
  
  /**
   * Insert creates a new document. Fails if the document already exists.
   * Supports durability requirements.
   */
  Insert: grpc.handleUnaryCall<_couchbase_kv_v1_InsertRequest__Output, _couchbase_kv_v1_InsertResponse>;
  
  /**
   * LookupIn performs one or more sub-document lookup operations (get, exists,
   * count) on paths within a JSON document. Supports xattr and access_deleted
   * flags.
   */
  LookupIn: grpc.handleUnaryCall<_couchbase_kv_v1_LookupInRequest__Output, _couchbase_kv_v1_LookupInResponse>;
  
  /**
   * MutateIn performs one or more sub-document mutation operations on paths
   * within a JSON document. Supports insert, upsert, replace, remove, array
   * operations, and counters at the sub-document level.
   */
  MutateIn: grpc.handleUnaryCall<_couchbase_kv_v1_MutateInRequest__Output, _couchbase_kv_v1_MutateInResponse>;
  
  /**
   * Prepend prepends raw bytes to the beginning of an existing document's
   * value.
   */
  Prepend: grpc.handleUnaryCall<_couchbase_kv_v1_PrependRequest__Output, _couchbase_kv_v1_PrependResponse>;
  
  /**
   * Remove deletes a document. Supports optimistic locking via optional CAS
   * and durability requirements.
   */
  Remove: grpc.handleUnaryCall<_couchbase_kv_v1_RemoveRequest__Output, _couchbase_kv_v1_RemoveResponse>;
  
  /**
   * Replace updates an existing document. Fails if the document does not exist.
   * Supports optimistic locking via optional CAS.
   */
  Replace: grpc.handleUnaryCall<_couchbase_kv_v1_ReplaceRequest__Output, _couchbase_kv_v1_ReplaceResponse>;
  
  /**
   * Touch resets a document's expiry without retrieving its content.
   */
  Touch: grpc.handleUnaryCall<_couchbase_kv_v1_TouchRequest__Output, _couchbase_kv_v1_TouchResponse>;
  
  /**
   * Unlock releases a pessimistic lock previously acquired by GetAndLock.
   * Requires the CAS value returned by the locking operation.
   */
  Unlock: grpc.handleUnaryCall<_couchbase_kv_v1_UnlockRequest__Output, _couchbase_kv_v1_UnlockResponse>;
  
  /**
   * Upsert creates or replaces a document unconditionally.
   * Supports preserving the existing expiry on update.
   */
  Upsert: grpc.handleUnaryCall<_couchbase_kv_v1_UpsertRequest__Output, _couchbase_kv_v1_UpsertResponse>;
  
}

export interface KvServiceDefinition extends grpc.ServiceDefinition {
  Append: MethodDefinition<_couchbase_kv_v1_AppendRequest, _couchbase_kv_v1_AppendResponse, _couchbase_kv_v1_AppendRequest__Output, _couchbase_kv_v1_AppendResponse__Output>
  Decrement: MethodDefinition<_couchbase_kv_v1_DecrementRequest, _couchbase_kv_v1_DecrementResponse, _couchbase_kv_v1_DecrementRequest__Output, _couchbase_kv_v1_DecrementResponse__Output>
  Exists: MethodDefinition<_couchbase_kv_v1_ExistsRequest, _couchbase_kv_v1_ExistsResponse, _couchbase_kv_v1_ExistsRequest__Output, _couchbase_kv_v1_ExistsResponse__Output>
  Get: MethodDefinition<_couchbase_kv_v1_GetRequest, _couchbase_kv_v1_GetResponse, _couchbase_kv_v1_GetRequest__Output, _couchbase_kv_v1_GetResponse__Output>
  GetAllReplicas: MethodDefinition<_couchbase_kv_v1_GetAllReplicasRequest, _couchbase_kv_v1_GetAllReplicasResponse, _couchbase_kv_v1_GetAllReplicasRequest__Output, _couchbase_kv_v1_GetAllReplicasResponse__Output>
  GetAndLock: MethodDefinition<_couchbase_kv_v1_GetAndLockRequest, _couchbase_kv_v1_GetAndLockResponse, _couchbase_kv_v1_GetAndLockRequest__Output, _couchbase_kv_v1_GetAndLockResponse__Output>
  GetAndTouch: MethodDefinition<_couchbase_kv_v1_GetAndTouchRequest, _couchbase_kv_v1_GetAndTouchResponse, _couchbase_kv_v1_GetAndTouchRequest__Output, _couchbase_kv_v1_GetAndTouchResponse__Output>
  Increment: MethodDefinition<_couchbase_kv_v1_IncrementRequest, _couchbase_kv_v1_IncrementResponse, _couchbase_kv_v1_IncrementRequest__Output, _couchbase_kv_v1_IncrementResponse__Output>
  Insert: MethodDefinition<_couchbase_kv_v1_InsertRequest, _couchbase_kv_v1_InsertResponse, _couchbase_kv_v1_InsertRequest__Output, _couchbase_kv_v1_InsertResponse__Output>
  LookupIn: MethodDefinition<_couchbase_kv_v1_LookupInRequest, _couchbase_kv_v1_LookupInResponse, _couchbase_kv_v1_LookupInRequest__Output, _couchbase_kv_v1_LookupInResponse__Output>
  MutateIn: MethodDefinition<_couchbase_kv_v1_MutateInRequest, _couchbase_kv_v1_MutateInResponse, _couchbase_kv_v1_MutateInRequest__Output, _couchbase_kv_v1_MutateInResponse__Output>
  Prepend: MethodDefinition<_couchbase_kv_v1_PrependRequest, _couchbase_kv_v1_PrependResponse, _couchbase_kv_v1_PrependRequest__Output, _couchbase_kv_v1_PrependResponse__Output>
  Remove: MethodDefinition<_couchbase_kv_v1_RemoveRequest, _couchbase_kv_v1_RemoveResponse, _couchbase_kv_v1_RemoveRequest__Output, _couchbase_kv_v1_RemoveResponse__Output>
  Replace: MethodDefinition<_couchbase_kv_v1_ReplaceRequest, _couchbase_kv_v1_ReplaceResponse, _couchbase_kv_v1_ReplaceRequest__Output, _couchbase_kv_v1_ReplaceResponse__Output>
  Touch: MethodDefinition<_couchbase_kv_v1_TouchRequest, _couchbase_kv_v1_TouchResponse, _couchbase_kv_v1_TouchRequest__Output, _couchbase_kv_v1_TouchResponse__Output>
  Unlock: MethodDefinition<_couchbase_kv_v1_UnlockRequest, _couchbase_kv_v1_UnlockResponse, _couchbase_kv_v1_UnlockRequest__Output, _couchbase_kv_v1_UnlockResponse__Output>
  Upsert: MethodDefinition<_couchbase_kv_v1_UpsertRequest, _couchbase_kv_v1_UpsertResponse, _couchbase_kv_v1_UpsertRequest__Output, _couchbase_kv_v1_UpsertResponse__Output>
}
