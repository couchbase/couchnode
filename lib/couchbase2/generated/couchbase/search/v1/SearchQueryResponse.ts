// Original file: couchbase/search/v1/search.proto

import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from '../../../google/protobuf/Timestamp';
import type { Duration as _google_protobuf_Duration, Duration__Output as _google_protobuf_Duration__Output } from '../../../google/protobuf/Duration';
import type { Long } from '@grpc/proto-loader';

/**
 * DateRangeFacetResult contains the results of a date range facet.
 */
export interface _couchbase_search_v1_SearchQueryResponse_DateRangeFacetResult {
  'field'?: (string);
  'total'?: (number | string | Long);
  'missing'?: (number | string | Long);
  'other'?: (number | string | Long);
  'date_ranges'?: (_couchbase_search_v1_SearchQueryResponse_DateRangeResult)[];
}

/**
 * DateRangeFacetResult contains the results of a date range facet.
 */
export interface _couchbase_search_v1_SearchQueryResponse_DateRangeFacetResult__Output {
  'field': (string);
  'total': (string);
  'missing': (string);
  'other': (string);
  'date_ranges': (_couchbase_search_v1_SearchQueryResponse_DateRangeResult__Output)[];
}

/**
 * DateRangeResult is a single bucket in a date range facet.
 */
export interface _couchbase_search_v1_SearchQueryResponse_DateRangeResult {
  'name'?: (string);
  'size'?: (number | string | Long);
  'start'?: (_google_protobuf_Timestamp | null);
  'end'?: (_google_protobuf_Timestamp | null);
}

/**
 * DateRangeResult is a single bucket in a date range facet.
 */
export interface _couchbase_search_v1_SearchQueryResponse_DateRangeResult__Output {
  'name': (string);
  'size': (string);
  'start': (_google_protobuf_Timestamp__Output | null);
  'end': (_google_protobuf_Timestamp__Output | null);
}

/**
 * FacetResult contains the result for a single facet computation.
 */
export interface _couchbase_search_v1_SearchQueryResponse_FacetResult {
  'term_facet'?: (_couchbase_search_v1_SearchQueryResponse_TermFacetResult | null);
  'date_range_facet'?: (_couchbase_search_v1_SearchQueryResponse_DateRangeFacetResult | null);
  'numeric_range_facet'?: (_couchbase_search_v1_SearchQueryResponse_NumericRangeFacetResult | null);
  'search_facet'?: "term_facet"|"date_range_facet"|"numeric_range_facet";
}

/**
 * FacetResult contains the result for a single facet computation.
 */
export interface _couchbase_search_v1_SearchQueryResponse_FacetResult__Output {
  'term_facet'?: (_couchbase_search_v1_SearchQueryResponse_TermFacetResult__Output | null);
  'date_range_facet'?: (_couchbase_search_v1_SearchQueryResponse_DateRangeFacetResult__Output | null);
  'numeric_range_facet'?: (_couchbase_search_v1_SearchQueryResponse_NumericRangeFacetResult__Output | null);
  'search_facet'?: "term_facet"|"date_range_facet"|"numeric_range_facet";
}

/**
 * Fragment contains highlighted text snippets for a field.
 */
export interface _couchbase_search_v1_SearchQueryResponse_Fragment {
  'content'?: (string)[];
}

/**
 * Fragment contains highlighted text snippets for a field.
 */
export interface _couchbase_search_v1_SearchQueryResponse_Fragment__Output {
  'content': (string)[];
}

/**
 * Location describes where a term was found within a document field.
 */
export interface _couchbase_search_v1_SearchQueryResponse_Location {
  'field'?: (string);
  'term'?: (string);
  'position'?: (number);
  /**
   * Byte offset of the term start in the field value.
   */
  'start'?: (number);
  /**
   * Byte offset of the term end in the field value.
   */
  'end'?: (number);
  /**
   * Array positions if the field is an array.
   */
  'array_positions'?: (number)[];
}

/**
 * Location describes where a term was found within a document field.
 */
export interface _couchbase_search_v1_SearchQueryResponse_Location__Output {
  'field': (string);
  'term': (string);
  'position': (number);
  /**
   * Byte offset of the term start in the field value.
   */
  'start': (number);
  /**
   * Byte offset of the term end in the field value.
   */
  'end': (number);
  /**
   * Array positions if the field is an array.
   */
  'array_positions': (number)[];
}

/**
 * MetaData contains summary information about the search results.
 */
export interface _couchbase_search_v1_SearchQueryResponse_MetaData {
  'metrics'?: (_couchbase_search_v1_SearchQueryResponse_SearchMetrics | null);
  /**
   * Errors from individual search partitions, keyed by partition name.
   */
  'errors'?: ({[key: string]: string});
}

/**
 * MetaData contains summary information about the search results.
 */
export interface _couchbase_search_v1_SearchQueryResponse_MetaData__Output {
  'metrics': (_couchbase_search_v1_SearchQueryResponse_SearchMetrics__Output | null);
  /**
   * Errors from individual search partitions, keyed by partition name.
   */
  'errors': ({[key: string]: string});
}

/**
 * NumericRangeFacetResult contains the results of a numeric range facet.
 */
export interface _couchbase_search_v1_SearchQueryResponse_NumericRangeFacetResult {
  'field'?: (string);
  'total'?: (number | string | Long);
  'missing'?: (number | string | Long);
  'other'?: (number | string | Long);
  'numeric_ranges'?: (_couchbase_search_v1_SearchQueryResponse_NumericRangeResult)[];
}

/**
 * NumericRangeFacetResult contains the results of a numeric range facet.
 */
export interface _couchbase_search_v1_SearchQueryResponse_NumericRangeFacetResult__Output {
  'field': (string);
  'total': (string);
  'missing': (string);
  'other': (string);
  'numeric_ranges': (_couchbase_search_v1_SearchQueryResponse_NumericRangeResult__Output)[];
}

/**
 * NumericRangeResult is a single bucket in a numeric range facet.
 */
export interface _couchbase_search_v1_SearchQueryResponse_NumericRangeResult {
  'name'?: (string);
  'size'?: (number | string | Long);
  'min'?: (number | string | Long);
  'max'?: (number | string | Long);
}

/**
 * NumericRangeResult is a single bucket in a numeric range facet.
 */
export interface _couchbase_search_v1_SearchQueryResponse_NumericRangeResult__Output {
  'name': (string);
  'size': (string);
  'min': (string);
  'max': (string);
}

/**
 * SearchMetrics contains timing and count statistics for the search.
 */
export interface _couchbase_search_v1_SearchQueryResponse_SearchMetrics {
  'execution_time'?: (_google_protobuf_Duration | null);
  'total_rows'?: (number | string | Long);
  'max_score'?: (number | string);
  'total_partition_count'?: (number | string | Long);
  'success_partition_count'?: (number | string | Long);
  'error_partition_count'?: (number | string | Long);
}

/**
 * SearchMetrics contains timing and count statistics for the search.
 */
export interface _couchbase_search_v1_SearchQueryResponse_SearchMetrics__Output {
  'execution_time': (_google_protobuf_Duration__Output | null);
  'total_rows': (string);
  'max_score': (number);
  'total_partition_count': (string);
  'success_partition_count': (string);
  'error_partition_count': (string);
}

/**
 * SearchQueryRow represents a single search hit.
 */
export interface _couchbase_search_v1_SearchQueryResponse_SearchQueryRow {
  /**
   * The document ID of the matching document.
   */
  'id'?: (string);
  /**
   * The relevance score of this hit.
   */
  'score'?: (number | string);
  /**
   * The index partition that produced this hit.
   */
  'index'?: (string);
  /**
   * Scoring explanation, if requested. JSON-encoded.
   */
  'explanation'?: (Buffer | Uint8Array | string);
  /**
   * Term location data, if requested.
   */
  'locations'?: (_couchbase_search_v1_SearchQueryResponse_Location)[];
  /**
   * Highlighted fragments, keyed by field name.
   */
  'fragments'?: ({[key: string]: _couchbase_search_v1_SearchQueryResponse_Fragment});
  /**
   * Stored field values, keyed by field name. JSON-encoded values.
   */
  'fields'?: ({[key: string]: Buffer | Uint8Array | string});
}

/**
 * SearchQueryRow represents a single search hit.
 */
export interface _couchbase_search_v1_SearchQueryResponse_SearchQueryRow__Output {
  /**
   * The document ID of the matching document.
   */
  'id': (string);
  /**
   * The relevance score of this hit.
   */
  'score': (number);
  /**
   * The index partition that produced this hit.
   */
  'index': (string);
  /**
   * Scoring explanation, if requested. JSON-encoded.
   */
  'explanation': (Buffer);
  /**
   * Term location data, if requested.
   */
  'locations': (_couchbase_search_v1_SearchQueryResponse_Location__Output)[];
  /**
   * Highlighted fragments, keyed by field name.
   */
  'fragments': ({[key: string]: _couchbase_search_v1_SearchQueryResponse_Fragment__Output});
  /**
   * Stored field values, keyed by field name. JSON-encoded values.
   */
  'fields': ({[key: string]: Buffer});
}

/**
 * TermFacetResult contains the results of a term facet aggregation.
 */
export interface _couchbase_search_v1_SearchQueryResponse_TermFacetResult {
  'field'?: (string);
  'total'?: (number | string | Long);
  'missing'?: (number | string | Long);
  'other'?: (number | string | Long);
  'terms'?: (_couchbase_search_v1_SearchQueryResponse_TermResult)[];
}

/**
 * TermFacetResult contains the results of a term facet aggregation.
 */
export interface _couchbase_search_v1_SearchQueryResponse_TermFacetResult__Output {
  'field': (string);
  'total': (string);
  'missing': (string);
  'other': (string);
  'terms': (_couchbase_search_v1_SearchQueryResponse_TermResult__Output)[];
}

/**
 * TermResult is a single term bucket in a term facet.
 */
export interface _couchbase_search_v1_SearchQueryResponse_TermResult {
  'name'?: (string);
  'field'?: (string);
  'size'?: (number | string | Long);
}

/**
 * TermResult is a single term bucket in a term facet.
 */
export interface _couchbase_search_v1_SearchQueryResponse_TermResult__Output {
  'name': (string);
  'field': (string);
  'size': (string);
}

/**
 * SearchQueryResponse is streamed back containing hits, facets, and metadata.
 */
export interface SearchQueryResponse {
  /**
   * The search hits matching the query.
   */
  'hits'?: (_couchbase_search_v1_SearchQueryResponse_SearchQueryRow)[];
  /**
   * Facet results, keyed by facet name.
   */
  'facets'?: ({[key: string]: _couchbase_search_v1_SearchQueryResponse_FacetResult});
  /**
   * Metadata about the search execution.
   */
  'meta_data'?: (_couchbase_search_v1_SearchQueryResponse_MetaData | null);
  '_meta_data'?: "meta_data";
}

/**
 * SearchQueryResponse is streamed back containing hits, facets, and metadata.
 */
export interface SearchQueryResponse__Output {
  /**
   * The search hits matching the query.
   */
  'hits': (_couchbase_search_v1_SearchQueryResponse_SearchQueryRow__Output)[];
  /**
   * Facet results, keyed by facet name.
   */
  'facets': ({[key: string]: _couchbase_search_v1_SearchQueryResponse_FacetResult__Output});
  /**
   * Metadata about the search execution.
   */
  'meta_data'?: (_couchbase_search_v1_SearchQueryResponse_MetaData__Output | null);
  '_meta_data'?: "meta_data";
}
