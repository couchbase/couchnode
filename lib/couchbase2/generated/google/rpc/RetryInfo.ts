// Original file: google/rpc/error_details.proto

import type { Duration as _google_protobuf_Duration, Duration__Output as _google_protobuf_Duration__Output } from '../../google/protobuf/Duration';

/**
 * Describes when the clients can retry a failed request. Clients could ignore
 * the recommendation here or retry when this information is missing from error
 * responses.
 * 
 * It's always recommended that clients should use exponential backoff when
 * retrying.
 * 
 * Clients should wait until `retry_delay` amount of time has passed since
 * receiving the error response before retrying.  If retrying requests also
 * fail, clients should use an exponential backoff scheme to gradually increase
 * the delay between retries based on `retry_delay`, until either a maximum
 * number of retries have been reached or a maximum retry delay cap has been
 * reached.
 */
export interface RetryInfo {
  /**
   * Clients should wait at least this long between retrying the same request.
   */
  'retry_delay'?: (_google_protobuf_Duration | null);
}

/**
 * Describes when the clients can retry a failed request. Clients could ignore
 * the recommendation here or retry when this information is missing from error
 * responses.
 * 
 * It's always recommended that clients should use exponential backoff when
 * retrying.
 * 
 * Clients should wait until `retry_delay` amount of time has passed since
 * receiving the error response before retrying.  If retrying requests also
 * fail, clients should use an exponential backoff scheme to gradually increase
 * the delay between retries based on `retry_delay`, until either a maximum
 * number of retries have been reached or a maximum retry delay cap has been
 * reached.
 */
export interface RetryInfo__Output {
  /**
   * Clients should wait at least this long between retrying the same request.
   */
  'retry_delay': (_google_protobuf_Duration__Output | null);
}
