// Original file: couchbase/search/v1/search.proto

import type { BooleanFieldQuery as _couchbase_search_v1_BooleanFieldQuery, BooleanFieldQuery__Output as _couchbase_search_v1_BooleanFieldQuery__Output } from '../../../couchbase/search/v1/BooleanFieldQuery';
import type { BooleanQuery as _couchbase_search_v1_BooleanQuery, BooleanQuery__Output as _couchbase_search_v1_BooleanQuery__Output } from '../../../couchbase/search/v1/BooleanQuery';
import type { ConjunctionQuery as _couchbase_search_v1_ConjunctionQuery, ConjunctionQuery__Output as _couchbase_search_v1_ConjunctionQuery__Output } from '../../../couchbase/search/v1/ConjunctionQuery';
import type { DateRangeQuery as _couchbase_search_v1_DateRangeQuery, DateRangeQuery__Output as _couchbase_search_v1_DateRangeQuery__Output } from '../../../couchbase/search/v1/DateRangeQuery';
import type { DisjunctionQuery as _couchbase_search_v1_DisjunctionQuery, DisjunctionQuery__Output as _couchbase_search_v1_DisjunctionQuery__Output } from '../../../couchbase/search/v1/DisjunctionQuery';
import type { DocIdQuery as _couchbase_search_v1_DocIdQuery, DocIdQuery__Output as _couchbase_search_v1_DocIdQuery__Output } from '../../../couchbase/search/v1/DocIdQuery';
import type { GeoBoundingBoxQuery as _couchbase_search_v1_GeoBoundingBoxQuery, GeoBoundingBoxQuery__Output as _couchbase_search_v1_GeoBoundingBoxQuery__Output } from '../../../couchbase/search/v1/GeoBoundingBoxQuery';
import type { GeoDistanceQuery as _couchbase_search_v1_GeoDistanceQuery, GeoDistanceQuery__Output as _couchbase_search_v1_GeoDistanceQuery__Output } from '../../../couchbase/search/v1/GeoDistanceQuery';
import type { GeoPolygonQuery as _couchbase_search_v1_GeoPolygonQuery, GeoPolygonQuery__Output as _couchbase_search_v1_GeoPolygonQuery__Output } from '../../../couchbase/search/v1/GeoPolygonQuery';
import type { MatchAllQuery as _couchbase_search_v1_MatchAllQuery, MatchAllQuery__Output as _couchbase_search_v1_MatchAllQuery__Output } from '../../../couchbase/search/v1/MatchAllQuery';
import type { MatchNoneQuery as _couchbase_search_v1_MatchNoneQuery, MatchNoneQuery__Output as _couchbase_search_v1_MatchNoneQuery__Output } from '../../../couchbase/search/v1/MatchNoneQuery';
import type { MatchPhraseQuery as _couchbase_search_v1_MatchPhraseQuery, MatchPhraseQuery__Output as _couchbase_search_v1_MatchPhraseQuery__Output } from '../../../couchbase/search/v1/MatchPhraseQuery';
import type { MatchQuery as _couchbase_search_v1_MatchQuery, MatchQuery__Output as _couchbase_search_v1_MatchQuery__Output } from '../../../couchbase/search/v1/MatchQuery';
import type { NumericRangeQuery as _couchbase_search_v1_NumericRangeQuery, NumericRangeQuery__Output as _couchbase_search_v1_NumericRangeQuery__Output } from '../../../couchbase/search/v1/NumericRangeQuery';
import type { PhraseQuery as _couchbase_search_v1_PhraseQuery, PhraseQuery__Output as _couchbase_search_v1_PhraseQuery__Output } from '../../../couchbase/search/v1/PhraseQuery';
import type { PrefixQuery as _couchbase_search_v1_PrefixQuery, PrefixQuery__Output as _couchbase_search_v1_PrefixQuery__Output } from '../../../couchbase/search/v1/PrefixQuery';
import type { QueryStringQuery as _couchbase_search_v1_QueryStringQuery, QueryStringQuery__Output as _couchbase_search_v1_QueryStringQuery__Output } from '../../../couchbase/search/v1/QueryStringQuery';
import type { RegexpQuery as _couchbase_search_v1_RegexpQuery, RegexpQuery__Output as _couchbase_search_v1_RegexpQuery__Output } from '../../../couchbase/search/v1/RegexpQuery';
import type { TermQuery as _couchbase_search_v1_TermQuery, TermQuery__Output as _couchbase_search_v1_TermQuery__Output } from '../../../couchbase/search/v1/TermQuery';
import type { TermRangeQuery as _couchbase_search_v1_TermRangeQuery, TermRangeQuery__Output as _couchbase_search_v1_TermRangeQuery__Output } from '../../../couchbase/search/v1/TermRangeQuery';
import type { WildcardQuery as _couchbase_search_v1_WildcardQuery, WildcardQuery__Output as _couchbase_search_v1_WildcardQuery__Output } from '../../../couchbase/search/v1/WildcardQuery';

/**
 * Query is the polymorphic wrapper for all search query types.
 * Exactly one query variant must be set.
 */
export interface Query {
  'boolean_field_query'?: (_couchbase_search_v1_BooleanFieldQuery | null);
  'boolean_query'?: (_couchbase_search_v1_BooleanQuery | null);
  'conjunction_query'?: (_couchbase_search_v1_ConjunctionQuery | null);
  'date_range_query'?: (_couchbase_search_v1_DateRangeQuery | null);
  'disjunction_query'?: (_couchbase_search_v1_DisjunctionQuery | null);
  'doc_id_query'?: (_couchbase_search_v1_DocIdQuery | null);
  'geo_bounding_box_query'?: (_couchbase_search_v1_GeoBoundingBoxQuery | null);
  'geo_distance_query'?: (_couchbase_search_v1_GeoDistanceQuery | null);
  'geo_polygon_query'?: (_couchbase_search_v1_GeoPolygonQuery | null);
  'match_all_query'?: (_couchbase_search_v1_MatchAllQuery | null);
  'match_none_query'?: (_couchbase_search_v1_MatchNoneQuery | null);
  'match_phrase_query'?: (_couchbase_search_v1_MatchPhraseQuery | null);
  'match_query'?: (_couchbase_search_v1_MatchQuery | null);
  'numeric_range_query'?: (_couchbase_search_v1_NumericRangeQuery | null);
  'phrase_query'?: (_couchbase_search_v1_PhraseQuery | null);
  'prefix_query'?: (_couchbase_search_v1_PrefixQuery | null);
  'query_string_query'?: (_couchbase_search_v1_QueryStringQuery | null);
  'regexp_query'?: (_couchbase_search_v1_RegexpQuery | null);
  'term_query'?: (_couchbase_search_v1_TermQuery | null);
  'term_range_query'?: (_couchbase_search_v1_TermRangeQuery | null);
  'wildcard_query'?: (_couchbase_search_v1_WildcardQuery | null);
  'query'?: "boolean_field_query"|"boolean_query"|"conjunction_query"|"date_range_query"|"disjunction_query"|"doc_id_query"|"geo_bounding_box_query"|"geo_distance_query"|"geo_polygon_query"|"match_all_query"|"match_none_query"|"match_phrase_query"|"match_query"|"numeric_range_query"|"phrase_query"|"prefix_query"|"query_string_query"|"regexp_query"|"term_query"|"term_range_query"|"wildcard_query";
}

/**
 * Query is the polymorphic wrapper for all search query types.
 * Exactly one query variant must be set.
 */
export interface Query__Output {
  'boolean_field_query'?: (_couchbase_search_v1_BooleanFieldQuery__Output | null);
  'boolean_query'?: (_couchbase_search_v1_BooleanQuery__Output | null);
  'conjunction_query'?: (_couchbase_search_v1_ConjunctionQuery__Output | null);
  'date_range_query'?: (_couchbase_search_v1_DateRangeQuery__Output | null);
  'disjunction_query'?: (_couchbase_search_v1_DisjunctionQuery__Output | null);
  'doc_id_query'?: (_couchbase_search_v1_DocIdQuery__Output | null);
  'geo_bounding_box_query'?: (_couchbase_search_v1_GeoBoundingBoxQuery__Output | null);
  'geo_distance_query'?: (_couchbase_search_v1_GeoDistanceQuery__Output | null);
  'geo_polygon_query'?: (_couchbase_search_v1_GeoPolygonQuery__Output | null);
  'match_all_query'?: (_couchbase_search_v1_MatchAllQuery__Output | null);
  'match_none_query'?: (_couchbase_search_v1_MatchNoneQuery__Output | null);
  'match_phrase_query'?: (_couchbase_search_v1_MatchPhraseQuery__Output | null);
  'match_query'?: (_couchbase_search_v1_MatchQuery__Output | null);
  'numeric_range_query'?: (_couchbase_search_v1_NumericRangeQuery__Output | null);
  'phrase_query'?: (_couchbase_search_v1_PhraseQuery__Output | null);
  'prefix_query'?: (_couchbase_search_v1_PrefixQuery__Output | null);
  'query_string_query'?: (_couchbase_search_v1_QueryStringQuery__Output | null);
  'regexp_query'?: (_couchbase_search_v1_RegexpQuery__Output | null);
  'term_query'?: (_couchbase_search_v1_TermQuery__Output | null);
  'term_range_query'?: (_couchbase_search_v1_TermRangeQuery__Output | null);
  'wildcard_query'?: (_couchbase_search_v1_WildcardQuery__Output | null);
  'query'?: "boolean_field_query"|"boolean_query"|"conjunction_query"|"date_range_query"|"disjunction_query"|"doc_id_query"|"geo_bounding_box_query"|"geo_distance_query"|"geo_polygon_query"|"match_all_query"|"match_none_query"|"match_phrase_query"|"match_query"|"numeric_range_query"|"phrase_query"|"prefix_query"|"query_string_query"|"regexp_query"|"term_query"|"term_range_query"|"wildcard_query";
}
