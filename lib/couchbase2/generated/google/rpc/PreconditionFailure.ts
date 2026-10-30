// Original file: google/rpc/error_details.proto


/**
 * A message type used to describe a single precondition failure.
 */
export interface _google_rpc_PreconditionFailure_Violation {
  /**
   * The type of PreconditionFailure. We recommend using a service-specific
   * enum type to define the supported precondition violation subjects. For
   * example, "TOS" for "Terms of Service violation".
   */
  'type'?: (string);
  /**
   * The subject, relative to the type, that failed.
   * For example, "google.com/cloud" relative to the "TOS" type would indicate
   * which terms of service is being referenced.
   */
  'subject'?: (string);
  /**
   * A description of how the precondition failed. Developers can use this
   * description to understand how to fix the failure.
   * 
   * For example: "Terms of service not accepted".
   */
  'description'?: (string);
}

/**
 * A message type used to describe a single precondition failure.
 */
export interface _google_rpc_PreconditionFailure_Violation__Output {
  /**
   * The type of PreconditionFailure. We recommend using a service-specific
   * enum type to define the supported precondition violation subjects. For
   * example, "TOS" for "Terms of Service violation".
   */
  'type': (string);
  /**
   * The subject, relative to the type, that failed.
   * For example, "google.com/cloud" relative to the "TOS" type would indicate
   * which terms of service is being referenced.
   */
  'subject': (string);
  /**
   * A description of how the precondition failed. Developers can use this
   * description to understand how to fix the failure.
   * 
   * For example: "Terms of service not accepted".
   */
  'description': (string);
}

/**
 * Describes what preconditions have failed.
 * 
 * For example, if an RPC failed because it required the Terms of Service to be
 * acknowledged, it could list the terms of service violation in the
 * PreconditionFailure message.
 */
export interface PreconditionFailure {
  /**
   * Describes all precondition violations.
   */
  'violations'?: (_google_rpc_PreconditionFailure_Violation)[];
}

/**
 * Describes what preconditions have failed.
 * 
 * For example, if an RPC failed because it required the Terms of Service to be
 * acknowledged, it could list the terms of service violation in the
 * PreconditionFailure message.
 */
export interface PreconditionFailure__Output {
  /**
   * Describes all precondition violations.
   */
  'violations': (_google_rpc_PreconditionFailure_Violation__Output)[];
}
