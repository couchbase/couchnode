// Written by `npm run gen:protos` from tools/autogen/config/protos.yaml; edit that, not this file.

import type { Options } from '@grpc/proto-loader'

/**
 * The schema files to load, relative to the protos directory.
 */
export const PROTO_FILES: readonly string[] = [
  'couchbase/admin/analytics/v1/analytics.proto',
  'couchbase/admin/bucket/v1/bucket.proto',
  'couchbase/admin/collection/v1/collection.proto',
  'couchbase/admin/query/v1/query.proto',
  'couchbase/admin/search/v1/search.proto',
  'couchbase/analytics/v1/analytics.proto',
  'couchbase/internal/hooks/v1/hooks.proto',
  'couchbase/internal/xdcr/v1/xdcr.proto',
  'couchbase/kv/v1/kv.proto',
  'couchbase/query/v1/query.proto',
  'couchbase/routing/v2/routing.proto',
  'couchbase/search/v1/search.proto',
  'couchbase/transactions/v1/transactions.proto',
  'couchbase/view/v1/view.proto',
  'google/rpc/error_details.proto',
  'google/rpc/status.proto',
  'grpc/health/v1/health.proto',
]

/**
 * The options the declarations beside this file were generated with.
 */
export const LOADER_OPTIONS: Options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
}
