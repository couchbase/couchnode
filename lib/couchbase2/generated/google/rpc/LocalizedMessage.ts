// Original file: google/rpc/error_details.proto


/**
 * Provides a localized error message that is safe to return to the user
 * which can be attached to an RPC error.
 */
export interface LocalizedMessage {
  /**
   * The locale used following the specification defined at
   * https://www.rfc-editor.org/rfc/bcp/bcp47.txt.
   * Examples are: "en-US", "fr-CH", "es-MX"
   */
  'locale'?: (string);
  /**
   * The localized error message in the above locale.
   */
  'message'?: (string);
}

/**
 * Provides a localized error message that is safe to return to the user
 * which can be attached to an RPC error.
 */
export interface LocalizedMessage__Output {
  /**
   * The locale used following the specification defined at
   * https://www.rfc-editor.org/rfc/bcp/bcp47.txt.
   * Examples are: "en-US", "fr-CH", "es-MX"
   */
  'locale': (string);
  /**
   * The localized error message in the above locale.
   */
  'message': (string);
}
