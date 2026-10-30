import * as grpc from '@grpc/grpc-js'
import { randomUUID } from 'crypto'

import type { KeyspaceScope, QueryBackend } from '../backends'
import { InvalidArgumentError } from '../errors'
import type { MutationState } from '../mutationstate'
import type { ObservableRequestHandler } from '../observabilityhandler'
import { QueryAbort } from '../queryexecutor'
import {
  QueryMetaData,
  QueryMetrics,
  QueryOptions,
  QueryProfileMode,
  QueryResult,
  QueryScanConsistency,
  QueryStatus,
  QueryWarning,
} from '../querytypes'
import { StreamableRowPromise } from '../streamablepromises'
import type { MutationToken as MutationTokenInputPb } from './generated/couchbase/kv/v1/MutationToken'
import type {
  QueryRequest as QueryRequestPb,
  _couchbase_query_v1_QueryRequest_TuningOptions as QueryTuningOptionsInputPb,
} from './generated/couchbase/query/v1/QueryRequest'
import type {
  _couchbase_query_v1_QueryResponse_MetaData__Output as QueryMetaDataOutputPb,
  QueryResponse__Output as QueryResponsePb,
} from './generated/couchbase/query/v1/QueryResponse'
import type { QueryServiceClient } from './generated/couchbase/query/v1/QueryService'
import type { Duration__Output as DurationOutputPb } from './generated/google/protobuf/Duration'
import type { Couchbase2Op, RequestContext } from './requestcontext'
import {
  endWithError,
  OpenStreams,
  rethrowListenerErrors,
  retryStream,
} from './streaming'

/**
 * A query context naming a bucket and a scope, each backticked or bare. A
 * scope name cannot hold a `.`, so a bare context splits at its last.
 */
const QUERY_CONTEXT =
  /^(?:default:)?(?:`([^`]+)`|([^`]+))\.(?:`([^`]+)`|([^`.]+))$/

const UINT32_MAX = 2 ** 32 - 1

/**
 * The operation a query is sent as. Only a read-only query changes nothing,
 * so only one leaves no doubt about its outcome when it runs out of time.
 *
 * @internal
 */
export function queryOp(options: QueryOptions): Couchbase2Op {
  const readOnly = options.readOnly || false
  return { name: 'query', readOnly, idempotent: readOnly }
}

/**
 * An `InvalidArgumentError` for a query option that cannot be sent.
 */
function invalid(message: string): InvalidArgumentError {
  return new InvalidArgumentError(new Error(message))
}

/**
 * The bucket and scope a query runs in: the scope it was sent from, or one
 * its query context names. A context that is not exactly a bucket and a
 * scope sets neither, and the statement then names its keyspace.
 */
function keyspaceToProto(
  options: QueryOptions,
  scope: KeyspaceScope | undefined
): Pick<QueryRequestPb, 'bucket_name' | 'scope_name'> {
  if (scope) {
    return { bucket_name: scope.bucketName, scope_name: scope.scopeName }
  }
  const match = options.queryContext
    ? QUERY_CONTEXT.exec(options.queryContext)
    : null
  return match
    ? { bucket_name: match[1] ?? match[2], scope_name: match[3] ?? match[4] }
    : {}
}

/**
 * The tokens of a mutation state, as the gateway reads them.
 */
function mutationStateToProto(state: MutationState): MutationTokenInputPb[] {
  const tokens: MutationTokenInputPb[] = []
  for (const vbuckets of Object.values(state._data)) {
    for (const token of Object.values(vbuckets)) {
      const data = token.toJSON()
      tokens.push({
        bucket_name: data.bucket_name,
        vbucket_id: Number(data.partition_id),
        vbucket_uuid: data.partition_uuid,
        seq_no: data.sequence_number,
      })
    }
  }
  return tokens
}

/**
 * The query's consistency. A mutation state with tokens wins over the scan
 * consistency, as on a classic connection.
 */
function scanConsistencyToProto(
  options: QueryOptions
): Pick<QueryRequestPb, 'consistent_with' | 'scan_consistency'> {
  const tokens = options.consistentWith
    ? mutationStateToProto(options.consistentWith)
    : []
  if (tokens.length > 0) {
    return { consistent_with: tokens }
  }
  switch (options.scanConsistency) {
    case undefined:
      return {}
    case QueryScanConsistency.NotBounded:
      return { scan_consistency: 'SCAN_CONSISTENCY_NOT_BOUNDED' }
    case QueryScanConsistency.RequestPlus:
      return { scan_consistency: 'SCAN_CONSISTENCY_REQUEST_PLUS' }
    default:
      throw invalid(
        `${options.scanConsistency} is not a valid scan consistency.`
      )
  }
}

/**
 * The gateway's profile mode for `profile`.
 */
function profileModeToProto(
  profile: QueryOptions['profile']
): QueryRequestPb['profile_mode'] {
  switch (profile) {
    case undefined:
      return undefined
    case QueryProfileMode.Off:
      return 'PROFILE_MODE_OFF'
    case QueryProfileMode.Phases:
      return 'PROFILE_MODE_PHASES'
    case QueryProfileMode.Timings:
      return 'PROFILE_MODE_TIMINGS'
    default:
      throw invalid(`${profile} is not a valid query profile.`)
  }
}

/**
 * `value`, checked to fit the gateway's unsigned 32 bit field `name`.
 */
function uint32ToProto(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
    throw invalid(
      `Expected ${name} to be an integer from 0 to ${UINT32_MAX}, ` +
        `got ${value}.`
    )
  }
  return value
}

/**
 * The tuning options. The SDK's metrics default to off and the gateway's to
 * on, so metrics are always stated.
 */
function tuningOptionsToProto(
  options: QueryOptions
): QueryTuningOptionsInputPb {
  const tuning: QueryTuningOptionsInputPb = {
    disable_metrics: !options.metrics,
  }
  if (options.maxParallelism !== undefined) {
    tuning.max_parallelism = uint32ToProto(
      'maxParallelism',
      options.maxParallelism
    )
  }
  if (options.pipelineBatch !== undefined) {
    tuning.pipeline_batch = uint32ToProto(
      'pipelineBatch',
      options.pipelineBatch
    )
  }
  if (options.pipelineCap !== undefined) {
    tuning.pipeline_cap = uint32ToProto('pipelineCap', options.pipelineCap)
  }
  if (options.scanCap !== undefined) {
    tuning.scan_cap = uint32ToProto('scanCap', options.scanCap)
  }
  if (options.scanWait !== undefined) {
    const ms = options.scanWait
    if (!Number.isFinite(ms) || ms < 0) {
      throw invalid(`Expected scanWait to be milliseconds, got ${ms}.`)
    }
    tuning.scan_wait = {
      seconds: Math.floor(ms / 1000),
      nanos: Math.round((ms % 1000) * 1e6),
    }
  }
  return tuning
}

/**
 * A parameter, encoded as JSON, as a classic connection encodes it.
 */
function encode(value: any): Buffer {
  return Buffer.from(JSON.stringify(value ?? null))
}

/**
 * The parameters. A named parameter is sent without its leading `$`, which
 * the gateway adds.
 */
function parametersToProto(
  parameters: QueryOptions['parameters']
): Pick<QueryRequestPb, 'positional_parameters' | 'named_parameters'> {
  if (!parameters) {
    return {}
  }
  if (Array.isArray(parameters)) {
    return { positional_parameters: parameters.map(encode) }
  }
  const named: { [key: string]: Buffer } = {}
  for (const [name, value] of Object.entries(parameters)) {
    if (value !== undefined) {
      named[name.startsWith('$') ? name.slice(1) : name] = encode(value)
    }
  }
  return { named_parameters: named }
}

/**
 * Warns that `name` is set but not sent, as the gateway has no field for it.
 */
function warnNotSent(name: string, reason: string): void {
  process.emitWarning(
    `couchbase2 does not send the query option ${name}: ${reason}.`,
    'CouchbaseWarning'
  )
}

/**
 * A query's request. An option the gateway has no field for is not sent,
 * with a warning, so a query written for a classic connection still runs.
 *
 * @internal
 */
export function queryRequestToProto(
  statement: string,
  options: QueryOptions,
  scope?: KeyspaceScope
): QueryRequestPb {
  if (options.raw && Object.keys(options.raw).length > 0) {
    warnNotSent('raw', 'the gateway takes no extra query service parameters')
  }
  if (options.useReplica) {
    warnNotSent('useReplica', 'the gateway chooses where a query reads from')
  }

  const message: QueryRequestPb = {
    statement,
    client_context_id: options.clientContextId || randomUUID(),
    ...keyspaceToProto(options, scope),
    ...scanConsistencyToProto(options),
    ...parametersToProto(options.parameters),
    tuning_options: tuningOptionsToProto(options),
  }
  if (options.readOnly !== undefined) {
    message.read_only = options.readOnly
  }
  if (options.flexIndex !== undefined) {
    message.flex_index = options.flexIndex
  }
  if (options.preserveExpiry !== undefined) {
    message.preserve_expiry = options.preserveExpiry
  }
  if (options.adhoc === false) {
    message.prepared = true
  }
  const profile = profileModeToProto(options.profile)
  if (profile !== undefined) {
    message.profile_mode = profile
  }
  return message
}

/**
 * A duration in whole milliseconds, as a classic connection reports one.
 *
 * @internal
 */
export function durationFromProto(duration: DurationOutputPb | null): number {
  if (!duration) {
    return 0
  }
  return Number(duration.seconds) * 1000 + Math.floor(duration.nanos / 1000000)
}

/**
 * The status the gateway reports, by the SDK's name for it. A status this
 * SDK cannot name comes from a newer gateway, and reads as unknown.
 */
function queryStatusFromProto(
  status: QueryMetaDataOutputPb['status']
): QueryStatus {
  const name =
    typeof status === 'string'
      ? status.replace(/^STATUS_/, '').toLowerCase()
      : ''
  const known = Object.values(QueryStatus) as string[]
  return known.includes(name) ? (name as QueryStatus) : QueryStatus.Unknown
}

/**
 * A query's metadata, from the last message of its stream. The gateway
 * reports a query's errors as the call's status, so the metadata carries
 * none.
 *
 * @internal
 */
export function queryMetaDataFromProto(
  meta: QueryMetaDataOutputPb
): QueryMetaData {
  const metrics = meta.metrics
  return new QueryMetaData({
    requestId: meta.request_id,
    clientContextId: meta.client_context_id,
    status: queryStatusFromProto(meta.status),
    signature:
      meta.signature && meta.signature.length > 0
        ? JSON.parse(meta.signature.toString('utf8'))
        : undefined,
    warnings: meta.warnings.map(
      (warning) =>
        new QueryWarning({ code: warning.code, message: warning.message })
    ),
    metrics: metrics
      ? new QueryMetrics({
          elapsedTime: durationFromProto(metrics.elapsed_time),
          executionTime: durationFromProto(metrics.execution_time),
          sortCount: Number(metrics.sort_count),
          resultCount: Number(metrics.result_count),
          resultSize: Number(metrics.result_size),
          mutationCount: Number(metrics.mutation_count),
          errorCount: Number(metrics.error_count),
          warningCount: Number(metrics.warning_count),
        })
      : undefined,
    profile:
      meta.profile && meta.profile.length > 0
        ? JSON.parse(meta.profile.toString('utf8'))
        : undefined,
  })
}

/**
 * What a query needs from the backend.
 *
 * @internal
 */
export interface Couchbase2QueryChannel {
  /**
   * The metadata every call carries.
   */
  readonly metadata: grpc.Metadata

  /**
   * The streams open on the channel, canceled when it closes.
   */
  readonly streams: OpenStreams

  /**
   * The timeout of a query that does not set its own, in milliseconds.
   */
  readonly queryTimeout: number

  /**
   * A new request's context, traced under `obs` when it is given.
   */
  context(
    op: Couchbase2Op,
    timeoutMs: number,
    obs?: ObservableRequestHandler | null
  ): RequestContext
}

/**
 * The emitter a query's rows, metadata and failure are reported through.
 */
type QueryEmitter<TRow> = StreamableRowPromise<
  QueryResult<TRow>,
  TRow,
  QueryMetaData
>

/**
 * SQL++ queries over the gateway's `QueryService`.
 *
 * @internal
 */
export class Couchbase2Query implements QueryBackend {
  private readonly _channel: Couchbase2QueryChannel
  private readonly _client: QueryServiceClient

  constructor(channel: Couchbase2QueryChannel, client: QueryServiceClient) {
    this._channel = channel
    this._client = client
  }

  /**
   * Sends the query and emits its rows as each message arrives. A request
   * that cannot be built fails on a later tick, so the caller has the
   * chance to attach its listeners or await it first. `obs` ends with the
   * stream.
   */
  query<TRow = any>(
    statement: string,
    options: QueryOptions,
    scope?: KeyspaceScope,
    obs?: ObservableRequestHandler | null
  ): QueryEmitter<TRow> {
    const emitter = new StreamableRowPromise<
      QueryResult<TRow>,
      TRow,
      QueryMetaData
    >((rows, meta) => new QueryResult({ rows, meta }))

    let message: QueryRequestPb
    try {
      message = queryRequestToProto(statement, options, scope)
      // A signal which has already aborted never fires its abort event.
      if (options.signal?.aborted) {
        throw QueryAbort.error(options.signal)
      }
    } catch (err) {
      process.nextTick(() => {
        obs?.endWithError(err)
        endWithError(emitter, err)
      })
      return emitter
    }

    const ctx = this._channel.context(
      queryOp(options),
      options.timeout || this._channel.queryTimeout,
      obs
    )
    void this._stream(emitter, ctx, message, obs, options.signal)
    return emitter
  }

  /**
   * Reads the stream one message at a time and emits each message's rows
   * before reading the next, so the SDK holds at most one message beyond
   * what grpc-js buffers. The metadata is the last message's.
   *
   * An abort of `signal` ends the query at once and cancels the call, and
   * the stream's own end is then ignored.
   */
  private async _stream<TRow>(
    emitter: QueryEmitter<TRow>,
    ctx: RequestContext,
    message: QueryRequestPb,
    obs: ObservableRequestHandler | null | undefined,
    signal: AbortSignal | undefined
  ): Promise<void> {
    let call: grpc.ClientReadableStream<QueryResponsePb> | undefined
    const abort = new QueryAbort(signal, (err) => {
      call?.cancel()
      obs?.endWithError(err)
      endWithError(emitter, err)
    })

    let meta: QueryMetaData | undefined
    try {
      const responses = retryStream<QueryResponsePb>(
        ctx,
        (options) => {
          // An abort while waiting to retry leaves no call to cancel, so
          // the next attempt is never sent.
          if (abort.aborted) {
            throw QueryAbort.error(signal as AbortSignal)
          }
          call = this._client.Query(message, this._channel.metadata, options)
          return call
        },
        { streams: this._channel.streams }
      )
      for await (const resp of responses) {
        for (const row of resp.rows) {
          emitter.emit('row', JSON.parse(row.toString('utf8')))
          // A row listener can abort the signal, which has then ended the
          // query; leaving the loop cancels the call.
          if (abort.aborted) {
            return
          }
        }
        if (resp.meta_data) {
          meta = queryMetaDataFromProto(resp.meta_data)
        }
      }
    } catch (err) {
      if (!abort.aborted) {
        obs?.endWithError(err)
        endWithError(emitter, err)
      }
      return
    } finally {
      abort.release()
    }

    obs?.end()
    rethrowListenerErrors(() => {
      if (meta) {
        emitter.emit('meta', meta)
      }
      emitter.emit('end')
    })
  }
}
