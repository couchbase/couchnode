import { performance } from 'perf_hooks'
import { setTimeout as sleepFor } from 'timers/promises'

import type {
  BackendRequest,
  QueryIndexCreateSettings,
  QueryIndexKeyspace,
  QueryIndexManagementBackend,
} from '../backends'
import { GenericErrorContext } from '../errorcontexts'
import {
  AmbiguousTimeoutError,
  CouchbaseError,
  UnambiguousTimeoutError,
} from '../errors'
import { QueryIndexMgmtOp } from '../observabilitytypes'
import { QueryIndex } from '../queryindexmanager'
import type { BuildDeferredIndexesResponse__Output as BuildDeferredIndexesResponsePb } from './generated/couchbase/admin/query/v1/BuildDeferredIndexesResponse'
import type { CreateIndexResponse__Output as CreateIndexResponsePb } from './generated/couchbase/admin/query/v1/CreateIndexResponse'
import type { CreatePrimaryIndexResponse__Output as CreatePrimaryIndexResponsePb } from './generated/couchbase/admin/query/v1/CreatePrimaryIndexResponse'
import type { DropIndexResponse__Output as DropIndexResponsePb } from './generated/couchbase/admin/query/v1/DropIndexResponse'
import type { DropPrimaryIndexResponse__Output as DropPrimaryIndexResponsePb } from './generated/couchbase/admin/query/v1/DropPrimaryIndexResponse'
import type {
  _couchbase_admin_query_v1_GetAllIndexesResponse_Index__Output as ListedIndexPb,
  GetAllIndexesResponse__Output as GetAllIndexesResponsePb,
} from './generated/couchbase/admin/query/v1/GetAllIndexesResponse'
import type { IndexState__Output as IndexStatePb } from './generated/couchbase/admin/query/v1/IndexState'
import type { IndexType__Output as IndexTypePb } from './generated/couchbase/admin/query/v1/IndexType'
import type { QueryAdminServiceClient } from './generated/couchbase/admin/query/v1/QueryAdminService'
import type { WaitForIndexOnlineResponse__Output as WaitForIndexOnlineResponsePb } from './generated/couchbase/admin/query/v1/WaitForIndexOnlineResponse'
import type { Couchbase2Channel, Couchbase2Op } from './requestcontext'
import { unary } from './retry'

/**
 * @internal
 */
export const QUERY_INDEX_CREATE: Couchbase2Op = {
  name: 'query_index_create',
  readOnly: false,
}

/**
 * @internal
 */
export const QUERY_INDEX_DROP: Couchbase2Op = {
  name: 'query_index_drop',
  readOnly: false,
}

/**
 * @internal
 */
export const QUERY_INDEX_GET_ALL: Couchbase2Op = {
  name: 'query_index_get_all',
  readOnly: true,
}

/**
 * @internal
 */
export const QUERY_INDEX_BUILD_DEFERRED: Couchbase2Op = {
  name: 'query_index_build_deferred',
  readOnly: false,
}

/**
 * One wait within a watch. It changes nothing, so it may be sent any number
 * of times.
 *
 * @internal
 */
export const QUERY_INDEX_WAIT_FOR_ONLINE: Couchbase2Op = {
  name: 'query_index_wait_for_online',
  readOnly: true,
}

/**
 * How long a watch waits before asking again about an index that has not
 * been built, in milliseconds.
 *
 * @internal
 */
export const WATCH_POLL_MS = 1000

/**
 * The precondition the gateway names when it refuses to wait on an index
 * that has not been built.
 */
const NOT_BUILDING = 'NOT_BUILDING'

/**
 * The name the server gives a primary index created without one.
 */
const DEFAULT_PRIMARY_NAME = '#primary'

const INDEX_TYPES: Readonly<Record<IndexTypePb, string>> = {
  INDEX_TYPE_VIEW: 'view',
  INDEX_TYPE_GSI: 'gsi',
}

const INDEX_STATES: Readonly<Record<IndexStatePb, string>> = {
  INDEX_STATE_DEFERRED: 'deferred',
  INDEX_STATE_BUILDING: 'building',
  INDEX_STATE_PENDING: 'pending',
  INDEX_STATE_ONLINE: 'online',
  INDEX_STATE_OFFLINE: 'offline',
  INDEX_STATE_ABRIDGED: 'abridged',
  INDEX_STATE_SCHEDULED: 'scheduled',
}

/**
 * The keyspace fields every request of the service carries.
 *
 * @internal
 */
export interface KeyspacePb {
  /**
   * The bucket.
   */
  bucket_name: string

  /**
   * The scope, left out for the whole bucket.
   */
  scope_name?: string

  /**
   * The collection, left out for the whole bucket.
   */
  collection_name?: string
}

/**
 * The keyspace fields of a request. An empty scope or collection is left
 * out: the gateway reads an absent one as the whole bucket, and an empty
 * one as a name, which it refuses.
 *
 * @internal
 */
export function keyspaceToProto(keyspace: QueryIndexKeyspace): KeyspacePb {
  const message: KeyspacePb = { bucket_name: keyspace.bucketName }
  if (keyspace.scopeName) {
    message.scope_name = keyspace.scopeName
  }
  if (keyspace.collectionName) {
    message.collection_name = keyspace.collectionName
  }
  return message
}

/**
 * One index key as the gateway is sent it. A key wrapped in backticks is
 * taken as already escaped, which lets a nested path like `` `a`.`b` `` through,
 * and is sent as written, as on a classic connection. Any other key is quoted
 * as one identifier, so that it cannot close its own quoting.
 *
 * @internal
 */
export function escapeIndexKey(key: string): string {
  if (key.length >= 2 && key.startsWith('`') && key.endsWith('`')) {
    return key
  }
  return '`' + key.replace(/[\\`]/g, '\\$&') + '`'
}

/**
 * One listed index. The gateway's scope and collection names have no
 * presence, so an empty one is an index on the bucket itself; the condition
 * and partition do.
 *
 * @internal
 */
export function queryIndexFromProto(index: ListedIndexPb): QueryIndex {
  return new QueryIndex({
    name: index.name,
    isPrimary: index.is_primary,
    type: INDEX_TYPES[index.type] ?? 'unknown',
    state: INDEX_STATES[index.state] ?? 'unknown',
    indexKey: [...index.fields],
    condition: index.condition,
    partition: index.partition,
    bucketName: index.bucket_name,
    scopeName: index.scope_name || undefined,
    collectionName: index.collection_name || undefined,
  })
}

/**
 * The error a watch raises when its time runs out, as on a classic
 * connection.
 */
function watchTimedOut(): CouchbaseError {
  return new CouchbaseError(
    'Failed to find all indexes online within the alloted time.'
  )
}

/**
 * Whether `err` is the gateway refusing to wait on an index that has not
 * been built. The SDK has no error of its own for it, so it arrives as a
 * plain {@link CouchbaseError} naming the precondition.
 */
function stillDeferred(err: unknown): boolean {
  return (
    err instanceof CouchbaseError &&
    err.context instanceof GenericErrorContext &&
    err.context.precondition_violation === NOT_BUILDING
  )
}

/**
 * Query index management over the gateway's `QueryAdminService`. The
 * gateway builds each statement itself, so a request carries no statement
 * text but the index keys.
 *
 * @internal
 */
export class Couchbase2QueryIndexes implements QueryIndexManagementBackend {
  private readonly _channel: Couchbase2Channel
  private readonly _client: QueryAdminServiceClient

  constructor(channel: Couchbase2Channel, client: QueryAdminServiceClient) {
    this._channel = channel
    this._client = client
  }

  /**
   * Creates a secondary index with `QueryAdminService.CreateIndex`, each
   * key escaped to one identifier.
   */
  async createIndex(
    keyspace: QueryIndexKeyspace,
    indexName: string,
    keys: string[],
    settings: QueryIndexCreateSettings,
    req: BackendRequest
  ): Promise<void> {
    const message = {
      ...keyspaceToProto(keyspace),
      name: indexName,
      fields: keys.map(escapeIndexKey),
      ...createSettingsToProto(settings),
    }
    const ctx = this._channel.context(QUERY_INDEX_CREATE, req.timeout, req.obs)
    await unary<CreateIndexResponsePb>(ctx, (options, callback) =>
      this._client.CreateIndex(
        message,
        this._channel.metadata,
        options,
        callback
      )
    )
  }

  /**
   * Creates a primary index with `QueryAdminService.CreatePrimaryIndex`. An
   * index created without a name is given the server's own, `#primary`.
   */
  async createPrimaryIndex(
    keyspace: QueryIndexKeyspace,
    indexName: string | undefined,
    settings: QueryIndexCreateSettings,
    req: BackendRequest
  ): Promise<void> {
    const message = {
      ...keyspaceToProto(keyspace),
      ...(indexName ? { name: indexName } : {}),
      ...createSettingsToProto(settings),
    }
    const ctx = this._channel.context(QUERY_INDEX_CREATE, req.timeout, req.obs)
    await unary<CreatePrimaryIndexResponsePb>(ctx, (options, callback) =>
      this._client.CreatePrimaryIndex(
        message,
        this._channel.metadata,
        options,
        callback
      )
    )
  }

  /**
   * Drops a secondary index with `QueryAdminService.DropIndex`.
   */
  async dropIndex(
    keyspace: QueryIndexKeyspace,
    indexName: string,
    ignoreIfNotExists: boolean,
    req: BackendRequest
  ): Promise<void> {
    const message = {
      ...keyspaceToProto(keyspace),
      name: indexName,
      ignore_if_missing: ignoreIfNotExists,
    }
    const ctx = this._channel.context(QUERY_INDEX_DROP, req.timeout, req.obs)
    await unary<DropIndexResponsePb>(ctx, (options, callback) =>
      this._client.DropIndex(message, this._channel.metadata, options, callback)
    )
  }

  /**
   * Drops a primary index with `QueryAdminService.DropPrimaryIndex`, which
   * takes a name, so a named primary index needs no secondary drop.
   */
  async dropPrimaryIndex(
    keyspace: QueryIndexKeyspace,
    indexName: string | undefined,
    ignoreIfNotExists: boolean,
    req: BackendRequest
  ): Promise<void> {
    const message = {
      ...keyspaceToProto(keyspace),
      ...(indexName ? { name: indexName } : {}),
      ignore_if_missing: ignoreIfNotExists,
    }
    const ctx = this._channel.context(QUERY_INDEX_DROP, req.timeout, req.obs)
    await unary<DropPrimaryIndexResponsePb>(ctx, (options, callback) =>
      this._client.DropPrimaryIndex(
        message,
        this._channel.metadata,
        options,
        callback
      )
    )
  }

  /**
   * Lists the keyspace's indexes with `QueryAdminService.GetAllIndexes`.
   */
  async getAllIndexes(
    keyspace: QueryIndexKeyspace,
    req: BackendRequest
  ): Promise<QueryIndex[]> {
    const message = keyspaceToProto(keyspace)
    const ctx = this._channel.context(QUERY_INDEX_GET_ALL, req.timeout, req.obs)
    const resp = await unary<GetAllIndexesResponsePb>(
      ctx,
      (options, callback) =>
        this._client.GetAllIndexes(
          message,
          this._channel.metadata,
          options,
          callback
        )
    )
    return resp.indexes.map(queryIndexFromProto)
  }

  /**
   * Builds the keyspace's deferred indexes with
   * `QueryAdminService.BuildDeferredIndexes`, returning the name of each
   * index the gateway says it will build.
   */
  async buildDeferredIndexes(
    keyspace: QueryIndexKeyspace,
    req: BackendRequest
  ): Promise<string[]> {
    const message = keyspaceToProto(keyspace)
    const ctx = this._channel.context(
      QUERY_INDEX_BUILD_DEFERRED,
      req.timeout,
      req.obs
    )
    const resp = await unary<BuildDeferredIndexesResponsePb>(
      ctx,
      (options, callback) =>
        this._client.BuildDeferredIndexes(
          message,
          this._channel.metadata,
          options,
          callback
        )
    )
    return resp.indexes.map((index) => index.name)
  }

  /**
   * Waits on each index in turn with `QueryAdminService.WaitForIndexOnline`,
   * all within `timeout`. The gateway refuses to wait on an index that has
   * not been built yet, so a refused wait is retried every
   * {@link WATCH_POLL_MS}.
   */
  async watchIndexes(
    keyspace: QueryIndexKeyspace,
    indexNames: string[],
    watchPrimary: boolean,
    timeout: number,
    req: BackendRequest
  ): Promise<void> {
    const names = watchPrimary
      ? [...indexNames, DEFAULT_PRIMARY_NAME]
      : indexNames
    const deadline = performance.now() + timeout
    for (const name of names) {
      const message = { ...keyspaceToProto(keyspace), name }
      while (!(await this._waitForOnline(message, deadline, req))) {
        if (deadline - performance.now() < WATCH_POLL_MS) {
          throw watchTimedOut()
        }
        await sleepFor(WATCH_POLL_MS)
      }
    }
  }

  /**
   * Whether the index came online before `deadline`; false when it has not
   * been built. Each wait is an operation of its own under the watch's span,
   * with its call under it.
   */
  private async _waitForOnline(
    message: KeyspacePb & { name: string },
    deadline: number,
    req: BackendRequest
  ): Promise<boolean> {
    const obs =
      req.obs?.child(QueryIndexMgmtOp.QueryIndexWaitForIndexOnline) ?? null
    obs?.setRequestHttpAttributes()
    const ctx = this._channel.context(
      QUERY_INDEX_WAIT_FOR_ONLINE,
      Math.max(deadline - performance.now(), 0),
      obs
    )
    try {
      await unary<WaitForIndexOnlineResponsePb>(ctx, (options, callback) =>
        this._client.WaitForIndexOnline(
          message,
          this._channel.metadata,
          options,
          callback
        )
      )
      obs?.end()
    } catch (e) {
      obs?.endWithError(e)
      if (
        e instanceof UnambiguousTimeoutError ||
        e instanceof AmbiguousTimeoutError
      ) {
        throw watchTimedOut()
      }
      if (stillDeferred(e)) {
        return false
      }
      throw e
    }
    return true
  }
}

/**
 * The fields a create carries for `settings`. A setting that was not given
 * is left out, so the server's default applies.
 */
function createSettingsToProto(settings: QueryIndexCreateSettings): {
  num_replicas?: number
  deferred?: boolean
  ignore_if_exists: boolean
} {
  const message: {
    num_replicas?: number
    deferred?: boolean
    ignore_if_exists: boolean
  } = { ignore_if_exists: settings.ignoreIfExists }
  if (settings.numReplicas !== undefined) {
    message.num_replicas = settings.numReplicas
  }
  if (settings.deferred !== undefined) {
    message.deferred = settings.deferred
  }
  return message
}
