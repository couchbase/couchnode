// Original file: couchbase/search/v1/search.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { SearchQueryRequest as _couchbase_search_v1_SearchQueryRequest, SearchQueryRequest__Output as _couchbase_search_v1_SearchQueryRequest__Output } from '../../../couchbase/search/v1/SearchQueryRequest';
import type { SearchQueryResponse as _couchbase_search_v1_SearchQueryResponse, SearchQueryResponse__Output as _couchbase_search_v1_SearchQueryResponse__Output } from '../../../couchbase/search/v1/SearchQueryResponse';

/**
 * SearchService provides full-text search query execution.
 */
export interface SearchServiceClient extends grpc.Client {
  /**
   * SearchQuery executes a search query against a named index and streams
   * back hits, facet results, and metadata.
   */
  SearchQuery(argument: _couchbase_search_v1_SearchQueryRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_search_v1_SearchQueryResponse__Output>;
  SearchQuery(argument: _couchbase_search_v1_SearchQueryRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_search_v1_SearchQueryResponse__Output>;
  /**
   * SearchQuery executes a search query against a named index and streams
   * back hits, facet results, and metadata.
   */
  searchQuery(argument: _couchbase_search_v1_SearchQueryRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_search_v1_SearchQueryResponse__Output>;
  searchQuery(argument: _couchbase_search_v1_SearchQueryRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_couchbase_search_v1_SearchQueryResponse__Output>;
  
}

/**
 * SearchService provides full-text search query execution.
 */
export interface SearchServiceHandlers extends grpc.UntypedServiceImplementation {
  /**
   * SearchQuery executes a search query against a named index and streams
   * back hits, facet results, and metadata.
   */
  SearchQuery: grpc.handleServerStreamingCall<_couchbase_search_v1_SearchQueryRequest__Output, _couchbase_search_v1_SearchQueryResponse>;
  
}

export interface SearchServiceDefinition extends grpc.ServiceDefinition {
  SearchQuery: MethodDefinition<_couchbase_search_v1_SearchQueryRequest, _couchbase_search_v1_SearchQueryResponse, _couchbase_search_v1_SearchQueryRequest__Output, _couchbase_search_v1_SearchQueryResponse__Output>
}
