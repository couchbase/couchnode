// Original file: google/rpc/error_details.proto

import type { LocalizedMessage as _google_rpc_LocalizedMessage, LocalizedMessage__Output as _google_rpc_LocalizedMessage__Output } from '../../google/rpc/LocalizedMessage';

/**
 * A message type used to describe a single bad request field.
 */
export interface _google_rpc_BadRequest_FieldViolation {
  /**
   * A path that leads to a field in the request body. The value will be a
   * sequence of dot-separated identifiers that identify a protocol buffer
   * field.
   * 
   * Consider the following:
   * 
   * message CreateContactRequest {
   * message EmailAddress {
   * enum Type {
   * TYPE_UNSPECIFIED = 0;
   * HOME = 1;
   * WORK = 2;
   * }
   * 
   * optional string email = 1;
   * repeated EmailType type = 2;
   * }
   * 
   * string full_name = 1;
   * repeated EmailAddress email_addresses = 2;
   * }
   * 
   * In this example, in proto `field` could take one of the following values:
   * 
   * * `full_name` for a violation in the `full_name` value
   * * `email_addresses[0].email` for a violation in the `email` field of the
   * first `email_addresses` message
   * * `email_addresses[2].type[1]` for a violation in the second `type`
   * value in the third `email_addresses` message.
   * 
   * In JSON, the same values are represented as:
   * 
   * * `fullName` for a violation in the `fullName` value
   * * `emailAddresses[0].email` for a violation in the `email` field of the
   * first `emailAddresses` message
   * * `emailAddresses[2].type[1]` for a violation in the second `type`
   * value in the third `emailAddresses` message.
   */
  'field'?: (string);
  /**
   * A description of why the request element is bad.
   */
  'description'?: (string);
  /**
   * The reason of the field-level error. This is a constant value that
   * identifies the proximate cause of the field-level error. It should
   * uniquely identify the type of the FieldViolation within the scope of the
   * google.rpc.ErrorInfo.domain. This should be at most 63
   * characters and match a regular expression of `[A-Z][A-Z0-9_]+[A-Z0-9]`,
   * which represents UPPER_SNAKE_CASE.
   */
  'reason'?: (string);
  /**
   * Provides a localized error message for field-level errors that is safe to
   * return to the API consumer.
   */
  'localized_message'?: (_google_rpc_LocalizedMessage | null);
}

/**
 * A message type used to describe a single bad request field.
 */
export interface _google_rpc_BadRequest_FieldViolation__Output {
  /**
   * A path that leads to a field in the request body. The value will be a
   * sequence of dot-separated identifiers that identify a protocol buffer
   * field.
   * 
   * Consider the following:
   * 
   * message CreateContactRequest {
   * message EmailAddress {
   * enum Type {
   * TYPE_UNSPECIFIED = 0;
   * HOME = 1;
   * WORK = 2;
   * }
   * 
   * optional string email = 1;
   * repeated EmailType type = 2;
   * }
   * 
   * string full_name = 1;
   * repeated EmailAddress email_addresses = 2;
   * }
   * 
   * In this example, in proto `field` could take one of the following values:
   * 
   * * `full_name` for a violation in the `full_name` value
   * * `email_addresses[0].email` for a violation in the `email` field of the
   * first `email_addresses` message
   * * `email_addresses[2].type[1]` for a violation in the second `type`
   * value in the third `email_addresses` message.
   * 
   * In JSON, the same values are represented as:
   * 
   * * `fullName` for a violation in the `fullName` value
   * * `emailAddresses[0].email` for a violation in the `email` field of the
   * first `emailAddresses` message
   * * `emailAddresses[2].type[1]` for a violation in the second `type`
   * value in the third `emailAddresses` message.
   */
  'field': (string);
  /**
   * A description of why the request element is bad.
   */
  'description': (string);
  /**
   * The reason of the field-level error. This is a constant value that
   * identifies the proximate cause of the field-level error. It should
   * uniquely identify the type of the FieldViolation within the scope of the
   * google.rpc.ErrorInfo.domain. This should be at most 63
   * characters and match a regular expression of `[A-Z][A-Z0-9_]+[A-Z0-9]`,
   * which represents UPPER_SNAKE_CASE.
   */
  'reason': (string);
  /**
   * Provides a localized error message for field-level errors that is safe to
   * return to the API consumer.
   */
  'localized_message': (_google_rpc_LocalizedMessage__Output | null);
}

/**
 * Describes violations in a client request. This error type focuses on the
 * syntactic aspects of the request.
 */
export interface BadRequest {
  /**
   * Describes all violations in a client request.
   */
  'field_violations'?: (_google_rpc_BadRequest_FieldViolation)[];
}

/**
 * Describes violations in a client request. This error type focuses on the
 * syntactic aspects of the request.
 */
export interface BadRequest__Output {
  /**
   * Describes all violations in a client request.
   */
  'field_violations': (_google_rpc_BadRequest_FieldViolation__Output)[];
}
