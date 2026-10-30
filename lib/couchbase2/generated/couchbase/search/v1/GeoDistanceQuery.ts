// Original file: couchbase/search/v1/search.proto

import type { LatLng as _couchbase_search_v1_LatLng, LatLng__Output as _couchbase_search_v1_LatLng__Output } from '../../../couchbase/search/v1/LatLng';

/**
 * GeoDistanceQuery matches documents with a geo field within the
 * specified distance from a center point.
 */
export interface GeoDistanceQuery {
  'boost'?: (number | string);
  'field'?: (string);
  'center'?: (_couchbase_search_v1_LatLng | null);
  /**
   * The maximum distance from center, with unit (e.g., "10mi", "5km").
   */
  'distance'?: (string);
  '_boost'?: "boost";
  '_field'?: "field";
}

/**
 * GeoDistanceQuery matches documents with a geo field within the
 * specified distance from a center point.
 */
export interface GeoDistanceQuery__Output {
  'boost'?: (number);
  'field'?: (string);
  'center': (_couchbase_search_v1_LatLng__Output | null);
  /**
   * The maximum distance from center, with unit (e.g., "10mi", "5km").
   */
  'distance': (string);
  '_boost'?: "boost";
  '_field'?: "field";
}
