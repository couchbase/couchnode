// Original file: couchbase/query/v1/query.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { QueryRequest as _couchbase_query_v1_QueryRequest, QueryRequest__Output as _couchbase_query_v1_QueryRequest__Output } from '../../../couchbase/query/v1/QueryRequest';
import type { QueryResponse as _couchbase_query_v1_QueryResponse, QueryResponse__Output as _couchbase_query_v1_QueryResponse__Output } from '../../../couchbase/query/v1/QueryResponse';

/**
 * QueryService provides N1QL (SQL++) query execution.
 */
export interface QueryServiceClient extends grpc.Client {
  /**
   * Query executes a N1QL statement and streams back result rows and metadata.
   * Results are delivered incrementally — rows arrive first, followed by a
   * final response containing MetaData (status, metrics, warnings).
   */
  Query(argument: _couchbase_query_v1_QueryRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_query_v1_QueryResponse__Output>;
  Query(argument: _couchbase_query_v1_QueryRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_query_v1_QueryResponse__Output>;
  /**
   * Query executes a N1QL statement and streams back result rows and metadata.
   * Results are delivered incrementally — rows arrive first, followed by a
   * final response containing MetaData (status, metrics, warnings).
   */
  query(argument: _couchbase_query_v1_QueryRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_query_v1_QueryResponse__Output>;
  query(argument: _couchbase_query_v1_QueryRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_query_v1_QueryResponse__Output>;
  
}

/**
 * QueryService provides N1QL (SQL++) query execution.
 */
export interface QueryServiceHandlers extends grpc.UntypedServiceImplementation {
  /**
   * Query executes a N1QL statement and streams back result rows and metadata.
   * Results are delivered incrementally — rows arrive first, followed by a
   * final response containing MetaData (status, metrics, warnings).
   */
  Query: grpc.handleServerStreamingCall<_couchbase_query_v1_QueryRequest__Output, _couchbase_query_v1_QueryResponse>;
  
}

export interface QueryServiceDefinition extends grpc.ServiceDefinition {
  Query: MethodDefinition<_couchbase_query_v1_QueryRequest, _couchbase_query_v1_QueryResponse, _couchbase_query_v1_QueryRequest__Output, _couchbase_query_v1_QueryResponse__Output>
}
