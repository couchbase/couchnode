// Original file: couchbase/search/v1/search.proto


/**
 * FieldSorting sorts results by a document field value.
 */
export interface FieldSorting {
  'field'?: (string);
  'descending'?: (boolean);
  /**
   * How to handle documents missing this field ("first" or "last").
   */
  'missing'?: (string);
  /**
   * Sort mode for multi-valued fields ("min", "max").
   */
  'mode'?: (string);
  /**
   * Type hint for the field value ("auto", "string", "number", "date").
   */
  'type'?: (string);
}

/**
 * FieldSorting sorts results by a document field value.
 */
export interface FieldSorting__Output {
  'field': (string);
  'descending': (boolean);
  /**
   * How to handle documents missing this field ("first" or "last").
   */
  'missing': (string);
  /**
   * Sort mode for multi-valued fields ("min", "max").
   */
  'mode': (string);
  /**
   * Type hint for the field value ("auto", "string", "number", "date").
   */
  'type': (string);
}
