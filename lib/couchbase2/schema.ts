import * as grpc from '@grpc/grpc-js'
import { loadSync } from '@grpc/proto-loader'
import { join } from 'path'

import type { ProtoGrpcType as AnalyticsSchema } from './generated/analytics'
import type { ProtoGrpcType as BucketSchema } from './generated/bucket'
import type { ProtoGrpcType as CollectionSchema } from './generated/collection'
import type { ProtoGrpcType as ErrorDetailsSchema } from './generated/error_details'
import type { ProtoGrpcType as HealthSchema } from './generated/health'
import type { ProtoGrpcType as HooksSchema } from './generated/hooks'
import type { ProtoGrpcType as KvSchema } from './generated/kv'
import { LOADER_OPTIONS, PROTO_FILES } from './generated/loaderoptions'
import type { ProtoGrpcType as QuerySchema } from './generated/query'
import type { ProtoGrpcType as RoutingSchema } from './generated/routing'
import type { ProtoGrpcType as SearchSchema } from './generated/search'
import type { ProtoGrpcType as StatusSchema } from './generated/status'
import type { ProtoGrpcType as TransactionsSchema } from './generated/transactions'
import type { ProtoGrpcType as ViewSchema } from './generated/view'
import type { ProtoGrpcType as XdcrSchema } from './generated/xdcr'

/**
 * Every package in the pinned protos, typed by the declarations generated
 * from them.
 *
 * @internal
 */
export type Schema = AnalyticsSchema &
  BucketSchema &
  CollectionSchema &
  ErrorDetailsSchema &
  HealthSchema &
  HooksSchema &
  KvSchema &
  QuerySchema &
  RoutingSchema &
  SearchSchema &
  StatusSchema &
  TransactionsSchema &
  ViewSchema &
  XdcrSchema

/**
 * Where the protos are read from: beside this module, in `lib/couchbase2`
 * when it runs from source and in `dist/couchbase2` once built, where the
 * build copies them because `tsc` does not.
 *
 * @internal
 */
export const PROTOS_DIR = join(__dirname, 'protos')

let schema: Schema | undefined

/**
 * The schema, parsed on first use and kept for the life of the process.
 *
 * @internal
 */
export function loadSchema(): Schema {
  if (!schema) {
    const definition = loadSync([...PROTO_FILES], {
      ...LOADER_OPTIONS,
      includeDirs: [PROTOS_DIR],
    })
    schema = grpc.loadPackageDefinition(definition) as unknown as Schema
  }
  return schema
}
