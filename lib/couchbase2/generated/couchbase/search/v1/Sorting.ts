// Original file: couchbase/search/v1/search.proto

import type { FieldSorting as _couchbase_search_v1_FieldSorting, FieldSorting__Output as _couchbase_search_v1_FieldSorting__Output } from '../../../couchbase/search/v1/FieldSorting';
import type { GeoDistanceSorting as _couchbase_search_v1_GeoDistanceSorting, GeoDistanceSorting__Output as _couchbase_search_v1_GeoDistanceSorting__Output } from '../../../couchbase/search/v1/GeoDistanceSorting';
import type { IdSorting as _couchbase_search_v1_IdSorting, IdSorting__Output as _couchbase_search_v1_IdSorting__Output } from '../../../couchbase/search/v1/IdSorting';
import type { ScoreSorting as _couchbase_search_v1_ScoreSorting, ScoreSorting__Output as _couchbase_search_v1_ScoreSorting__Output } from '../../../couchbase/search/v1/ScoreSorting';

/**
 * Sorting is the polymorphic wrapper for sort specifications.
 */
export interface Sorting {
  'field_sorting'?: (_couchbase_search_v1_FieldSorting | null);
  'geo_distance_sorting'?: (_couchbase_search_v1_GeoDistanceSorting | null);
  'id_sorting'?: (_couchbase_search_v1_IdSorting | null);
  'score_sorting'?: (_couchbase_search_v1_ScoreSorting | null);
  'sorting'?: "field_sorting"|"geo_distance_sorting"|"id_sorting"|"score_sorting";
}

/**
 * Sorting is the polymorphic wrapper for sort specifications.
 */
export interface Sorting__Output {
  'field_sorting'?: (_couchbase_search_v1_FieldSorting__Output | null);
  'geo_distance_sorting'?: (_couchbase_search_v1_GeoDistanceSorting__Output | null);
  'id_sorting'?: (_couchbase_search_v1_IdSorting__Output | null);
  'score_sorting'?: (_couchbase_search_v1_ScoreSorting__Output | null);
  'sorting'?: "field_sorting"|"geo_distance_sorting"|"id_sorting"|"score_sorting";
}
