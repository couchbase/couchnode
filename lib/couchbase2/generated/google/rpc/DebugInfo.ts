// Original file: google/rpc/error_details.proto


/**
 * Describes additional debugging info.
 */
export interface DebugInfo {
  /**
   * The stack trace entries indicating where the error occurred.
   */
  'stack_entries'?: (string)[];
  /**
   * Additional debugging information provided by the server.
   */
  'detail'?: (string);
}

/**
 * Describes additional debugging info.
 */
export interface DebugInfo__Output {
  /**
   * The stack trace entries indicating where the error occurred.
   */
  'stack_entries': (string)[];
  /**
   * Additional debugging information provided by the server.
   */
  'detail': (string);
}
