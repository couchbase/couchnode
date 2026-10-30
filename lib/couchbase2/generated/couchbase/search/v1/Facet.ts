// Original file: couchbase/search/v1/search.proto

import type { DateRangeFacet as _couchbase_search_v1_DateRangeFacet, DateRangeFacet__Output as _couchbase_search_v1_DateRangeFacet__Output } from '../../../couchbase/search/v1/DateRangeFacet';
import type { NumericRangeFacet as _couchbase_search_v1_NumericRangeFacet, NumericRangeFacet__Output as _couchbase_search_v1_NumericRangeFacet__Output } from '../../../couchbase/search/v1/NumericRangeFacet';
import type { TermFacet as _couchbase_search_v1_TermFacet, TermFacet__Output as _couchbase_search_v1_TermFacet__Output } from '../../../couchbase/search/v1/TermFacet';

/**
 * Facet is the polymorphic wrapper for facet specifications.
 */
export interface Facet {
  'date_range_facet'?: (_couchbase_search_v1_DateRangeFacet | null);
  'numeric_range_facet'?: (_couchbase_search_v1_NumericRangeFacet | null);
  'term_facet'?: (_couchbase_search_v1_TermFacet | null);
  'facet'?: "date_range_facet"|"numeric_range_facet"|"term_facet";
}

/**
 * Facet is the polymorphic wrapper for facet specifications.
 */
export interface Facet__Output {
  'date_range_facet'?: (_couchbase_search_v1_DateRangeFacet__Output | null);
  'numeric_range_facet'?: (_couchbase_search_v1_NumericRangeFacet__Output | null);
  'term_facet'?: (_couchbase_search_v1_TermFacet__Output | null);
  'facet'?: "date_range_facet"|"numeric_range_facet"|"term_facet";
}
