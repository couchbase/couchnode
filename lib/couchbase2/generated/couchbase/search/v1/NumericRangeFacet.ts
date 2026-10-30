// Original file: couchbase/search/v1/search.proto

import type { NumericRange as _couchbase_search_v1_NumericRange, NumericRange__Output as _couchbase_search_v1_NumericRange__Output } from '../../../couchbase/search/v1/NumericRange';

/**
 * NumericRangeFacet aggregates results into named numeric ranges on a field.
 */
export interface NumericRangeFacet {
  'field'?: (string);
  'size'?: (number);
  'numeric_ranges'?: (_couchbase_search_v1_NumericRange)[];
}

/**
 * NumericRangeFacet aggregates results into named numeric ranges on a field.
 */
export interface NumericRangeFacet__Output {
  'field': (string);
  'size': (number);
  'numeric_ranges': (_couchbase_search_v1_NumericRange__Output)[];
}
