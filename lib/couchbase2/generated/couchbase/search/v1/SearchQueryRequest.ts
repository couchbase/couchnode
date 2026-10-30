// Original file: couchbase/search/v1/search.proto

import type { Query as _couchbase_search_v1_Query, Query__Output as _couchbase_search_v1_Query__Output } from '../../../couchbase/search/v1/Query';
import type { Sorting as _couchbase_search_v1_Sorting, Sorting__Output as _couchbase_search_v1_Sorting__Output } from '../../../couchbase/search/v1/Sorting';
import type { Facet as _couchbase_search_v1_Facet, Facet__Output as _couchbase_search_v1_Facet__Output } from '../../../couchbase/search/v1/Facet';
import type { KnnQuery as _couchbase_search_v1_KnnQuery, KnnQuery__Output as _couchbase_search_v1_KnnQuery__Output } from '../../../couchbase/search/v1/KnnQuery';
import type { KnnOperator as _couchbase_search_v1_KnnOperator, KnnOperator__Output as _couchbase_search_v1_KnnOperator__Output } from '../../../couchbase/search/v1/KnnOperator';

// Original file: couchbase/search/v1/search.proto

/**
 * HighlightStyle controls how matching terms are highlighted in results.
 */
export const _couchbase_search_v1_SearchQueryRequest_HighlightStyle = {
  /**
   * Server default highlighting.
   */
  HIGHLIGHT_STYLE_DEFAULT: 'HIGHLIGHT_STYLE_DEFAULT',
  /**
   * HTML tag highlighting (<mark>).
   */
  HIGHLIGHT_STYLE_HTML: 'HIGHLIGHT_STYLE_HTML',
  /**
   * ANSI escape code highlighting (for terminals).
   */
  HIGHLIGHT_STYLE_ANSI: 'HIGHLIGHT_STYLE_ANSI',
} as const;

/**
 * HighlightStyle controls how matching terms are highlighted in results.
 */
export type _couchbase_search_v1_SearchQueryRequest_HighlightStyle =
  /**
   * Server default highlighting.
   */
  | 'HIGHLIGHT_STYLE_DEFAULT'
  | 0
  /**
   * HTML tag highlighting (<mark>).
   */
  | 'HIGHLIGHT_STYLE_HTML'
  | 1
  /**
   * ANSI escape code highlighting (for terminals).
   */
  | 'HIGHLIGHT_STYLE_ANSI'
  | 2

/**
 * HighlightStyle controls how matching terms are highlighted in results.
 */
export type _couchbase_search_v1_SearchQueryRequest_HighlightStyle__Output = typeof _couchbase_search_v1_SearchQueryRequest_HighlightStyle[keyof typeof _couchbase_search_v1_SearchQueryRequest_HighlightStyle]

// Original file: couchbase/search/v1/search.proto

/**
 * ScanConsistency for search queries.
 */
export const _couchbase_search_v1_SearchQueryRequest_ScanConsistency = {
  /**
   * No consistency required.
   */
  SCAN_CONSISTENCY_NOT_BOUNDED: 'SCAN_CONSISTENCY_NOT_BOUNDED',
} as const;

/**
 * ScanConsistency for search queries.
 */
export type _couchbase_search_v1_SearchQueryRequest_ScanConsistency =
  /**
   * No consistency required.
   */
  | 'SCAN_CONSISTENCY_NOT_BOUNDED'
  | 0

/**
 * ScanConsistency for search queries.
 */
export type _couchbase_search_v1_SearchQueryRequest_ScanConsistency__Output = typeof _couchbase_search_v1_SearchQueryRequest_ScanConsistency[keyof typeof _couchbase_search_v1_SearchQueryRequest_ScanConsistency]

/**
 * SearchQueryRequest specifies the search index, query, and all options.
 */
export interface SearchQueryRequest {
  /**
   * The name of the search index to query.
   */
  'index_name'?: (string);
  /**
   * The search query to execute.
   */
  'query'?: (_couchbase_search_v1_Query | null);
  'scan_consistency'?: (_couchbase_search_v1_SearchQueryRequest_ScanConsistency);
  /**
   * Maximum number of hits to return.
   */
  'limit'?: (number);
  /**
   * Number of hits to skip (for pagination).
   */
  'skip'?: (number);
  /**
   * When true, include scoring explanations in each hit.
   */
  'include_explanation'?: (boolean);
  'highlight_style'?: (_couchbase_search_v1_SearchQueryRequest_HighlightStyle);
  /**
   * Fields to apply highlighting to.
   */
  'highlight_fields'?: (string)[];
  /**
   * Document fields to include in each hit (empty = all stored fields).
   */
  'fields'?: (string)[];
  /**
   * Sort specifications. Applied in order.
   */
  'sort'?: (_couchbase_search_v1_Sorting)[];
  /**
   * When true, do not compute relevance scores (faster for non-scored queries).
   */
  'disable_scoring'?: (boolean);
  /**
   * Restrict the search to these collections within the index.
   */
  'collections'?: (string)[];
  /**
   * When true, include term location data in each hit.
   */
  'include_locations'?: (boolean);
  /**
   * Facets to compute. Keys are facet names, values are facet specs.
   */
  'facets'?: ({[key: string]: _couchbase_search_v1_Facet});
  /**
   * Optional bucket scope for scoped indexes.
   */
  'bucket_name'?: (string);
  'scope_name'?: (string);
  /**
   * KNN queries for vector search. Combined according to knn_operator.
   */
  'knn'?: (_couchbase_search_v1_KnnQuery)[];
  /**
   * How to combine multiple KNN queries. Default: OR.
   */
  'knn_operator'?: (_couchbase_search_v1_KnnOperator);
  '_knn_operator'?: "knn_operator";
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}

/**
 * SearchQueryRequest specifies the search index, query, and all options.
 */
export interface SearchQueryRequest__Output {
  /**
   * The name of the search index to query.
   */
  'index_name': (string);
  /**
   * The search query to execute.
   */
  'query': (_couchbase_search_v1_Query__Output | null);
  'scan_consistency': (_couchbase_search_v1_SearchQueryRequest_ScanConsistency__Output);
  /**
   * Maximum number of hits to return.
   */
  'limit': (number);
  /**
   * Number of hits to skip (for pagination).
   */
  'skip': (number);
  /**
   * When true, include scoring explanations in each hit.
   */
  'include_explanation': (boolean);
  'highlight_style': (_couchbase_search_v1_SearchQueryRequest_HighlightStyle__Output);
  /**
   * Fields to apply highlighting to.
   */
  'highlight_fields': (string)[];
  /**
   * Document fields to include in each hit (empty = all stored fields).
   */
  'fields': (string)[];
  /**
   * Sort specifications. Applied in order.
   */
  'sort': (_couchbase_search_v1_Sorting__Output)[];
  /**
   * When true, do not compute relevance scores (faster for non-scored queries).
   */
  'disable_scoring': (boolean);
  /**
   * Restrict the search to these collections within the index.
   */
  'collections': (string)[];
  /**
   * When true, include term location data in each hit.
   */
  'include_locations': (boolean);
  /**
   * Facets to compute. Keys are facet names, values are facet specs.
   */
  'facets': ({[key: string]: _couchbase_search_v1_Facet__Output});
  /**
   * Optional bucket scope for scoped indexes.
   */
  'bucket_name'?: (string);
  'scope_name'?: (string);
  /**
   * KNN queries for vector search. Combined according to knn_operator.
   */
  'knn': (_couchbase_search_v1_KnnQuery__Output)[];
  /**
   * How to combine multiple KNN queries. Default: OR.
   */
  'knn_operator'?: (_couchbase_search_v1_KnnOperator__Output);
  '_knn_operator'?: "knn_operator";
  '_bucket_name'?: "bucket_name";
  '_scope_name'?: "scope_name";
}
