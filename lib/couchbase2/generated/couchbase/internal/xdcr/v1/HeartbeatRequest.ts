// Original file: couchbase/internal/xdcr/v1/xdcr.proto


/**
 * HeartbeatRequest sends an opaque payload to verify connectivity.
 */
export interface HeartbeatRequest {
  'payload'?: (Buffer | Uint8Array | string);
}

/**
 * HeartbeatRequest sends an opaque payload to verify connectivity.
 */
export interface HeartbeatRequest__Output {
  'payload': (Buffer);
}
