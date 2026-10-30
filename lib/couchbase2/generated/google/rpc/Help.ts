// Original file: google/rpc/error_details.proto


/**
 * Describes a URL link.
 */
export interface _google_rpc_Help_Link {
  /**
   * Describes what the link offers.
   */
  'description'?: (string);
  /**
   * The URL of the link.
   */
  'url'?: (string);
}

/**
 * Describes a URL link.
 */
export interface _google_rpc_Help_Link__Output {
  /**
   * Describes what the link offers.
   */
  'description': (string);
  /**
   * The URL of the link.
   */
  'url': (string);
}

/**
 * Provides links to documentation or for performing an out of band action.
 * 
 * For example, if a quota check failed with an error indicating the calling
 * project hasn't enabled the accessed service, this can contain a URL pointing
 * directly to the right place in the developer console to flip the bit.
 */
export interface Help {
  /**
   * URL(s) pointing to additional information on handling the current error.
   */
  'links'?: (_google_rpc_Help_Link)[];
}

/**
 * Provides links to documentation or for performing an out of band action.
 * 
 * For example, if a quota check failed with an error indicating the calling
 * project hasn't enabled the accessed service, this can contain a URL pointing
 * directly to the right place in the developer console to flip the bit.
 */
export interface Help__Output {
  /**
   * URL(s) pointing to additional information on handling the current error.
   */
  'links': (_google_rpc_Help_Link__Output)[];
}
