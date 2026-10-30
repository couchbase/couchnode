// Original file: couchbase/search/v1/search.proto

import type { Long } from '@grpc/proto-loader';

/**
 * TermQuery matches documents containing the exact term. Supports
 * fuzziness for approximate matching.
 */
export interface TermQuery {
  'boost'?: (number | string);
  'field'?: (string);
  'term'?: (string);
  'fuzziness'?: (number | string | Long);
  'prefix_length'?: (number | string | Long);
  '_boost'?: "boost";
  '_field'?: "field";
  '_fuzziness'?: "fuzziness";
  '_prefix_length'?: "prefix_length";
}

/**
 * TermQuery matches documents containing the exact term. Supports
 * fuzziness for approximate matching.
 */
export interface TermQuery__Output {
  'boost'?: (number);
  'field'?: (string);
  'term': (string);
  'fuzziness'?: (string);
  'prefix_length'?: (string);
  '_boost'?: "boost";
  '_field'?: "field";
  '_fuzziness'?: "fuzziness";
  '_prefix_length'?: "prefix_length";
}
