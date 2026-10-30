// Original file: couchbase/internal/xdcr/v1/xdcr.proto

/**
 * ContentType indicates the format of document content.
 */
export const ContentType = {
  /**
   * Non-JSON content (binary, string, etc.).
   */
  CONTENT_TYPE_NONJSON: 'CONTENT_TYPE_NONJSON',
  /**
   * JSON content.
   */
  CONTENT_TYPE_JSON: 'CONTENT_TYPE_JSON',
} as const;

/**
 * ContentType indicates the format of document content.
 */
export type ContentType =
  /**
   * Non-JSON content (binary, string, etc.).
   */
  | 'CONTENT_TYPE_NONJSON'
  | 0
  /**
   * JSON content.
   */
  | 'CONTENT_TYPE_JSON'
  | 1

/**
 * ContentType indicates the format of document content.
 */
export type ContentType__Output = typeof ContentType[keyof typeof ContentType]
