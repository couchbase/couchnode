// Original file: couchbase/search/v1/search.proto

import type { DateRange as _couchbase_search_v1_DateRange, DateRange__Output as _couchbase_search_v1_DateRange__Output } from '../../../couchbase/search/v1/DateRange';

/**
 * DateRangeFacet aggregates results into named date ranges on a field.
 */
export interface DateRangeFacet {
  'field'?: (string);
  'size'?: (number);
  'date_ranges'?: (_couchbase_search_v1_DateRange)[];
}

/**
 * DateRangeFacet aggregates results into named date ranges on a field.
 */
export interface DateRangeFacet__Output {
  'field': (string);
  'size': (number);
  'date_ranges': (_couchbase_search_v1_DateRange__Output)[];
}
