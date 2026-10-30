// Original file: couchbase/search/v1/search.proto


/**
 * DateRangeQuery matches documents with date field values within the
 * specified range. Dates are parsed using the optional date_time_parser.
 */
export interface DateRangeQuery {
  'boost'?: (number | string);
  'field'?: (string);
  'date_time_parser'?: (string);
  'start_date'?: (string);
  'end_date'?: (string);
  '_boost'?: "boost";
  '_field'?: "field";
  '_date_time_parser'?: "date_time_parser";
  '_start_date'?: "start_date";
  '_end_date'?: "end_date";
}

/**
 * DateRangeQuery matches documents with date field values within the
 * specified range. Dates are parsed using the optional date_time_parser.
 */
export interface DateRangeQuery__Output {
  'boost'?: (number);
  'field'?: (string);
  'date_time_parser'?: (string);
  'start_date'?: (string);
  'end_date'?: (string);
  '_boost'?: "boost";
  '_field'?: "field";
  '_date_time_parser'?: "date_time_parser";
  '_start_date'?: "start_date";
  '_end_date'?: "end_date";
}
