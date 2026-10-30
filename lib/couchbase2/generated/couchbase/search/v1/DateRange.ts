// Original file: couchbase/search/v1/search.proto


/**
 * DateRange defines a named date range for faceting.
 */
export interface DateRange {
  'name'?: (string);
  'start'?: (string);
  'end'?: (string);
  '_start'?: "start";
  '_end'?: "end";
}

/**
 * DateRange defines a named date range for faceting.
 */
export interface DateRange__Output {
  'name': (string);
  'start'?: (string);
  'end'?: (string);
  '_start'?: "start";
  '_end'?: "end";
}
