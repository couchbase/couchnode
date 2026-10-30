// Original file: couchbase/internal/hooks/v1/hooks.proto


/**
 * ValueRef references a value: a request field, a counter, or a literal.
 */
export interface ValueRef {
  /**
   * A field path in the incoming gRPC request message.
   */
  'request_field'?: (string);
  /**
   * The current value of a named counter.
   */
  'counter_value'?: (string);
  /**
   * A literal JSON value for comparison.
   */
  'json_value'?: (Buffer | Uint8Array | string);
  'value'?: "request_field"|"counter_value"|"json_value";
}

/**
 * ValueRef references a value: a request field, a counter, or a literal.
 */
export interface ValueRef__Output {
  /**
   * A field path in the incoming gRPC request message.
   */
  'request_field'?: (string);
  /**
   * The current value of a named counter.
   */
  'counter_value'?: (string);
  /**
   * A literal JSON value for comparison.
   */
  'json_value'?: (Buffer);
  'value'?: "request_field"|"counter_value"|"json_value";
}
