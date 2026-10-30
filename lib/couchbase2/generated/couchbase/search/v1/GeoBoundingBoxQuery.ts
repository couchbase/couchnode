// Original file: couchbase/search/v1/search.proto

import type { LatLng as _couchbase_search_v1_LatLng, LatLng__Output as _couchbase_search_v1_LatLng__Output } from '../../../couchbase/search/v1/LatLng';

/**
 * GeoBoundingBoxQuery matches documents with a geo field within the
 * specified bounding box defined by top-left and bottom-right coordinates.
 */
export interface GeoBoundingBoxQuery {
  'boost'?: (number | string);
  'field'?: (string);
  'top_left'?: (_couchbase_search_v1_LatLng | null);
  'bottom_right'?: (_couchbase_search_v1_LatLng | null);
  '_boost'?: "boost";
  '_field'?: "field";
}

/**
 * GeoBoundingBoxQuery matches documents with a geo field within the
 * specified bounding box defined by top-left and bottom-right coordinates.
 */
export interface GeoBoundingBoxQuery__Output {
  'boost'?: (number);
  'field'?: (string);
  'top_left': (_couchbase_search_v1_LatLng__Output | null);
  'bottom_right': (_couchbase_search_v1_LatLng__Output | null);
  '_boost'?: "boost";
  '_field'?: "field";
}
