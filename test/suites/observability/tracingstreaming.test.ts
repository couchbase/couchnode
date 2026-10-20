import { describe, expect } from 'vitest'

import type { Bucket } from '../../../lib/bucket'
import type { Cluster } from '../../../lib/cluster'
import { CouchbaseError } from '../../../lib/errors'
import { StreamingOp } from '../../../lib/observabilitytypes'
import type { Scope } from '../../../lib/scope'
import { SearchQuery } from '../../../lib/searchquery'
import { SearchRequest } from '../../../lib/searchtypes'
import { DesignDocumentNamespace } from '../../../lib/viewtypes'
import { expectThrows } from '../../asserts/errors'
import { ServerFeature } from '../../infra/capabilities'
import { TestEnv } from '../../infra/env'
import { defineSuite } from '../../infra/suite'
import {
  TRACER_KINDS,
  TracerKind,
  tracedTarget,
} from '../../observability/tracing/target'
import type { AnyTestSpan } from '../../observability/tracing/tracingtypes'
import {
  TracingValidator,
  createHttpValidator,
} from '../../observability/tracing/validators'

// Search queries an index that does not exist, because a search index takes
// minutes to build, and views do the same because views are deprecated. Both
// still reach the server and open a span.
//
// `_default` rather than a leased scope: the query and search services learn
// about a new scope on their own schedule, which a collection lease does not
// wait for. Leased scopes under a query are covered by `n1ql` and `search`.

const TRIVIAL_QUERY = 'SELECT 1=1;'
const NAMED_PARAM_QUERY = 'SELECT $named_param as param'
const POSITIONAL_PARAM_QUERY = 'SELECT $1 as param'
const INVALID_QUERY = 'This is not SQL++;'
const MISSING_INDEX = 'not-an-index'
const MISSING_DESIGN_DOC = 'not-a-design-doc'
const MISSING_VIEW = 'not-a-view'

interface TracingTarget {
  readonly cluster: Cluster
  readonly bucket: Bucket
  readonly scope: Scope
  readonly validator: TracingValidator
  /** Opens a root span for the SDK's span to hang under. */
  readonly parentSpan: (name: string) => AnyTestSpan
}

async function targetFor(
  env: TestEnv,
  kind: TracerKind
): Promise<TracingTarget> {
  const target = await tracedTarget(env, kind)
  const bucket = target.cluster.bucket(env.config.bucket)
  return {
    cluster: target.cluster,
    bucket,
    scope: bucket.defaultScope(),
    // No collection details: each assertion declares the keyspace it expects.
    validator: createHttpValidator(
      target.tracer,
      undefined,
      target.clusterName
    ),
    parentSpan: (name: string) => target.tracer.requestSpan(name),
  }
}

interface QueryLevel {
  readonly label: string
  readonly expectKeyspace: (
    validator: TracingValidator,
    target: TracingTarget
  ) => void
}

const CLUSTER_LEVEL: QueryLevel = {
  label: 'cluster',
  // A cluster-level query names no keyspace.
  expectKeyspace: () => undefined,
}

const SCOPE_LEVEL: QueryLevel = {
  label: 'scope',
  expectKeyspace: (validator, target) => {
    validator.bucketName(target.bucket.name).scopeName(target.scope.name)
  },
}

const QUERY_LEVELS: readonly QueryLevel[] = [CLUSTER_LEVEL, SCOPE_LEVEL]

for (const kind of TRACER_KINDS) {
  defineSuite(kind.suiteName, { tier: 'slow' }, (ctx) => {
    const { group, lacking, test } = ctx

    describe('#Streaming Operations', () => {
      group('#Analytics Operations', [ServerFeature.Analytics], () => {
        test('should perform analytics query operation', async ({ env }) => {
          const target = await targetFor(env, kind)
          const { cluster, validator } = target

          validator.reset().op(StreamingOp.Analytics)
          expect(
            (await cluster.analyticsQuery(TRIVIAL_QUERY)).rows,
            'analytics rows'
          ).toBeInstanceOf(Array)
          validator.validate()

          validator
            .reset()
            .op(StreamingOp.Analytics)
            .statement(NAMED_PARAM_QUERY)
          expect(
            (
              await cluster.analyticsQuery(NAMED_PARAM_QUERY, {
                parameters: { named_param: 5 },
              })
            ).rows,
            'analytics rows, named parameter'
          ).toBeInstanceOf(Array)
          validator.validate()

          validator
            .reset()
            .op(StreamingOp.Analytics)
            .statement(POSITIONAL_PARAM_QUERY)
          expect(
            (
              await cluster.analyticsQuery(POSITIONAL_PARAM_QUERY, {
                parameters: ['hello'],
              })
            ).rows,
            'analytics rows, positional parameter'
          ).toBeInstanceOf(Array)
          validator.validate()

          validator.reset()
          const parentSpan = target.parentSpan('analytics-parent-span')
          validator.op(StreamingOp.Analytics).parent(parentSpan)
          expect(
            (await cluster.analyticsQuery(TRIVIAL_QUERY, { parentSpan })).rows,
            'analytics rows, under a caller span'
          ).toBeInstanceOf(Array)
          validator.validate()

          validator.reset().op(StreamingOp.Analytics).error(true)
          await expectThrows(
            () => cluster.analyticsQuery(INVALID_QUERY),
            CouchbaseError,
            undefined,
            env.ctx({ op: 'analyticsQuery', extra: 'invalid statement' })
          )
          validator.validate()
        })
      })

      group('#Query Operations', [ServerFeature.Query], () => {
        for (const level of QUERY_LEVELS) {
          test(`should perform ${level.label} level query operations`, async ({
            env,
          }) => {
            const target = await targetFor(env, kind)
            const { validator } = target
            const runner =
              level === CLUSTER_LEVEL ? target.cluster : target.scope

            validator.reset().op(StreamingOp.Query)
            level.expectKeyspace(validator, target)
            expect(
              (await runner.query(TRIVIAL_QUERY)).rows,
              'query rows'
            ).toBeInstanceOf(Array)
            validator.validate()

            validator.reset().op(StreamingOp.Query).statement(NAMED_PARAM_QUERY)
            level.expectKeyspace(validator, target)
            expect(
              (
                await runner.query(NAMED_PARAM_QUERY, {
                  parameters: { named_param: 5 },
                })
              ).rows,
              'query rows, named parameter'
            ).toBeInstanceOf(Array)
            validator.validate()

            validator
              .reset()
              .op(StreamingOp.Query)
              .statement(POSITIONAL_PARAM_QUERY)
            level.expectKeyspace(validator, target)
            expect(
              (
                await runner.query(POSITIONAL_PARAM_QUERY, {
                  parameters: ['hello'],
                })
              ).rows,
              'query rows, positional parameter'
            ).toBeInstanceOf(Array)
            validator.validate()

            validator.reset()
            const parentSpan = target.parentSpan('query-parent-span')
            validator.op(StreamingOp.Query).parent(parentSpan)
            level.expectKeyspace(validator, target)
            expect(
              (await runner.query(TRIVIAL_QUERY, { parentSpan })).rows,
              'query rows, under a caller span'
            ).toBeInstanceOf(Array)
            validator.validate()

            validator.reset().op(StreamingOp.Query).error(true)
            level.expectKeyspace(validator, target)
            await expectThrows(
              () => runner.query(INVALID_QUERY),
              CouchbaseError,
              undefined,
              env.ctx({
                op: 'query',
                extra: `level=${level.label} invalid statement`,
              })
            )
            validator.validate()
          })
        }
      })

      group('#Search Operations', [ServerFeature.Search], () => {
        for (const level of QUERY_LEVELS) {
          test.skipIf(
            level === SCOPE_LEVEL && lacking(ServerFeature.ScopeSearch)
          )(
            `should perform ${level.label} level search operation`,
            async ({ env }) => {
              const target = await targetFor(env, kind)
              const { validator } = target
              const runner =
                level === CLUSTER_LEVEL ? target.cluster : target.scope

              validator.reset().op(StreamingOp.Search).error(true)
              level.expectKeyspace(validator, target)
              await expectThrows(
                () =>
                  runner.search(
                    MISSING_INDEX,
                    SearchRequest.create(SearchQuery.term('test'))
                  ),
                CouchbaseError,
                undefined,
                env.ctx({ op: 'search', extra: `level=${level.label}` })
              )
              validator.validate()

              validator.reset()
              const parentSpan = target.parentSpan('search-parent-span')
              validator.op(StreamingOp.Search).parent(parentSpan).error(true)
              level.expectKeyspace(validator, target)
              await expectThrows(
                () =>
                  runner.search(
                    MISSING_INDEX,
                    SearchRequest.create(SearchQuery.term('test')),
                    { parentSpan }
                  ),
                CouchbaseError,
                undefined,
                env.ctx({
                  op: 'search',
                  extra: `level=${level.label} under a caller span`,
                })
              )
              validator.validate()
            }
          )
        }
      })

      group('#View Operations', [ServerFeature.Views], () => {
        test('should perform view operation', async ({ env }) => {
          const target = await targetFor(env, kind)
          const { bucket, validator } = target

          validator
            .reset()
            .op(StreamingOp.View)
            .bucketName(bucket.name)
            .error(true)
          await expectThrows(
            () =>
              bucket.viewQuery(MISSING_DESIGN_DOC, MISSING_VIEW, {
                namespace: DesignDocumentNamespace.Development,
              }),
            CouchbaseError,
            undefined,
            env.ctx({
              op: 'viewQuery',
              extra: 'design document does not exist',
            })
          )
          validator.validate()

          validator.reset()
          const parentSpan = target.parentSpan('view-parent-span')
          validator
            .op(StreamingOp.View)
            .bucketName(bucket.name)
            .parent(parentSpan)
            .error(true)
          await expectThrows(
            () =>
              bucket.viewQuery(MISSING_DESIGN_DOC, MISSING_VIEW, {
                namespace: DesignDocumentNamespace.Development,
                parentSpan,
              }),
            CouchbaseError,
            undefined,
            env.ctx({
              op: 'viewQuery',
              extra: 'design document does not exist, under a caller span',
            })
          )
          validator.validate()
        })
      })
    })
  })
}
