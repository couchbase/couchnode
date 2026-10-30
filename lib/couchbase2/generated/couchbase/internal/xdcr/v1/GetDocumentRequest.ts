// Original file: couchbase/internal/xdcr/v1/xdcr.proto


/**
 * GetDocumentRequest retrieves a document with full replication metadata.
 */
export interface GetDocumentRequest {
  'bucket_name'?: (string);
  'scope_name'?: (string);
  'collection_name'?: (string);
  'key'?: (string);
  /**
   * When true, include the document body in the response.
   */
  'include_content'?: (boolean);
  /**
   * When true, include extended attributes (xattrs) in the response.
   */
  'include_xattrs'?: (boolean);
  '_include_xattrs'?: "include_xattrs";
}

/**
 * GetDocumentRequest retrieves a document with full replication metadata.
 */
export interface GetDocumentRequest__Output {
  'bucket_name': (string);
  'scope_name': (string);
  'collection_name': (string);
  'key': (string);
  /**
   * When true, include the document body in the response.
   */
  'include_content': (boolean);
  /**
   * When true, include extended attributes (xattrs) in the response.
   */
  'include_xattrs'?: (boolean);
  '_include_xattrs'?: "include_xattrs";
}
