// Original file: couchbase/admin/search/v1/search.proto


/**
 * AnalyzeDocumentResponse contains the analysis results.
 */
export interface AnalyzeDocumentResponse {
  /**
   * Status of the analysis operation.
   */
  'status'?: (string);
  /**
   * The analysis results (tokens, etc.). JSON-encoded.
   */
  'analyzed'?: (Buffer | Uint8Array | string);
}

/**
 * AnalyzeDocumentResponse contains the analysis results.
 */
export interface AnalyzeDocumentResponse__Output {
  /**
   * Status of the analysis operation.
   */
  'status': (string);
  /**
   * The analysis results (tokens, etc.). JSON-encoded.
   */
  'analyzed': (Buffer);
}
