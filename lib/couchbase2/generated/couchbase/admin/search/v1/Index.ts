// Original file: couchbase/admin/search/v1/search.proto


/**
 * Index represents a full-text search index definition.
 */
export interface Index {
  /**
   * The name of the index.
   */
  'name'?: (string);
  /**
   * Index parameters (type mappings, analyzers, etc.). Values are JSON-encoded.
   */
  'params'?: ({[key: string]: Buffer | Uint8Array | string});
  /**
   * Plan parameters (num_replicas, partition settings). Values are
   * JSON-encoded.
   */
  'plan_params'?: ({[key: string]: Buffer | Uint8Array | string});
  /**
   * The data source name (typically the bucket name).
   */
  'source_name'?: (string);
  /**
   * Source-specific parameters. Values are JSON-encoded.
   */
  'source_params'?: ({[key: string]: Buffer | Uint8Array | string});
  /**
   * The type of data source (e.g., "couchbase").
   */
  'source_type'?: (string);
  /**
   * The UUID of the source.
   */
  'source_uuid'?: (string);
  /**
   * The index type (e.g., "fulltext-index").
   */
  'type'?: (string);
  /**
   * The unique identifier for this index.
   */
  'uuid'?: (string);
  '_source_name'?: "source_name";
  '_source_type'?: "source_type";
  '_source_uuid'?: "source_uuid";
}

/**
 * Index represents a full-text search index definition.
 */
export interface Index__Output {
  /**
   * The name of the index.
   */
  'name': (string);
  /**
   * Index parameters (type mappings, analyzers, etc.). Values are JSON-encoded.
   */
  'params': ({[key: string]: Buffer});
  /**
   * Plan parameters (num_replicas, partition settings). Values are
   * JSON-encoded.
   */
  'plan_params': ({[key: string]: Buffer});
  /**
   * The data source name (typically the bucket name).
   */
  'source_name'?: (string);
  /**
   * Source-specific parameters. Values are JSON-encoded.
   */
  'source_params': ({[key: string]: Buffer});
  /**
   * The type of data source (e.g., "couchbase").
   */
  'source_type'?: (string);
  /**
   * The UUID of the source.
   */
  'source_uuid'?: (string);
  /**
   * The index type (e.g., "fulltext-index").
   */
  'type': (string);
  /**
   * The unique identifier for this index.
   */
  'uuid': (string);
  '_source_name'?: "source_name";
  '_source_type'?: "source_type";
  '_source_uuid'?: "source_uuid";
}
