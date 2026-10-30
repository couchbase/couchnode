// Original file: couchbase/search/v1/search.proto

import type { LatLng as _couchbase_search_v1_LatLng, LatLng__Output as _couchbase_search_v1_LatLng__Output } from '../../../couchbase/search/v1/LatLng';

/**
 * GeoPolygonQuery matches documents with a geo field within the
 * polygon defined by the given vertices.
 */
export interface GeoPolygonQuery {
  'boost'?: (number | string);
  'field'?: (string);
  'vertices'?: (_couchbase_search_v1_LatLng)[];
  '_boost'?: "boost";
  '_field'?: "field";
}

/**
 * GeoPolygonQuery matches documents with a geo field within the
 * polygon defined by the given vertices.
 */
export interface GeoPolygonQuery__Output {
  'boost'?: (number);
  'field'?: (string);
  'vertices': (_couchbase_search_v1_LatLng__Output)[];
  '_boost'?: "boost";
  '_field'?: "field";
}
