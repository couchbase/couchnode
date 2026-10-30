// Original file: couchbase/search/v1/search.proto

import type { LatLng as _couchbase_search_v1_LatLng, LatLng__Output as _couchbase_search_v1_LatLng__Output } from '../../../couchbase/search/v1/LatLng';

/**
 * GeoDistanceSorting sorts results by distance from a geographic point.
 */
export interface GeoDistanceSorting {
  'field'?: (string);
  'descending'?: (boolean);
  'center'?: (_couchbase_search_v1_LatLng | null);
  /**
   * Distance unit (e.g., "mi", "km", "m").
   */
  'unit'?: (string);
}

/**
 * GeoDistanceSorting sorts results by distance from a geographic point.
 */
export interface GeoDistanceSorting__Output {
  'field': (string);
  'descending': (boolean);
  'center': (_couchbase_search_v1_LatLng__Output | null);
  /**
   * Distance unit (e.g., "mi", "km", "m").
   */
  'unit': (string);
}
