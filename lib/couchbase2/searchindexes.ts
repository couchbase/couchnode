import type * as grpc from '@grpc/grpc-js'

import type {
  SearchIndexManagementBackend,
  SearchIndexRequest,
} from '../backends'
import {
  IndexNotFoundError,
  InvalidArgumentError,
  ParsingFailureError,
} from '../errors'
import { ISearchIndex, SearchIndex } from '../searchindexmanager'
import type { AnalyzeDocumentResponse__Output as AnalyzeDocumentResponsePb } from './generated/couchbase/admin/search/v1/AnalyzeDocumentResponse'
import type { GetIndexResponse__Output as GetIndexResponsePb } from './generated/couchbase/admin/search/v1/GetIndexResponse'
import type { GetIndexedDocumentsCountResponse__Output as GetIndexedDocumentsCountResponsePb } from './generated/couchbase/admin/search/v1/GetIndexedDocumentsCountResponse'
import type { Index__Output as IndexPb } from './generated/couchbase/admin/search/v1/Index'
import type { ListIndexesResponse__Output as ListIndexesResponsePb } from './generated/couchbase/admin/search/v1/ListIndexesResponse'
import type { SearchAdminServiceClient } from './generated/couchbase/admin/search/v1/SearchAdminService'
import type { Couchbase2Channel, Couchbase2Op } from './requestcontext'
import { unary } from './retry'

/**
 * @internal
 */
export const SEARCH_INDEX_GET: Couchbase2Op = {
  name: 'search_index_get',
  readOnly: true,
}

/**
 * @internal
 */
export const SEARCH_INDEX_GET_ALL: Couchbase2Op = {
  name: 'search_index_get_all',
  readOnly: true,
}

/**
 * @internal
 */
export const SEARCH_INDEX_UPSERT: Couchbase2Op = {
  name: 'search_index_upsert',
  readOnly: false,
}

/**
 * @internal
 */
export const SEARCH_INDEX_DROP: Couchbase2Op = {
  name: 'search_index_drop',
  readOnly: false,
}

/**
 * @internal
 */
export const SEARCH_INDEX_GET_DOCUMENTS_COUNT: Couchbase2Op = {
  name: 'search_index_get_documents_count',
  readOnly: true,
}

/**
 * The control ops leave the index in the state they name, so each may be
 * sent any number of times.
 *
 * @internal
 */
export const SEARCH_INDEX_CONTROL_INGEST: Couchbase2Op = {
  name: 'search_index_control_ingest',
  readOnly: false,
}

/**
 * @internal
 */
export const SEARCH_INDEX_CONTROL_QUERY: Couchbase2Op = {
  name: 'search_index_control_query',
  readOnly: false,
}

/**
 * @internal
 */
export const SEARCH_INDEX_CONTROL_PLAN_FREEZE: Couchbase2Op = {
  name: 'search_index_control_plan_freeze',
  readOnly: false,
}

/**
 * @internal
 */
export const SEARCH_INDEX_ANALYZE_DOCUMENT: Couchbase2Op = {
  name: 'search_index_analyze_document',
  readOnly: true,
}

/**
 * The bucket and scope fields every request of the service carries.
 *
 * @internal
 */
export interface SearchScopePb {
  /**
   * The bucket of a scope's index, left out for the cluster's own.
   */
  bucket_name?: string

  /**
   * The scope of a scope's index, left out for the cluster's own.
   */
  scope_name?: string
}

/**
 * The fields a create or an update carries for one index definition.
 *
 * @internal
 */
export interface IndexFieldsPb {
  /**
   * The index's name.
   */
  name: string

  /**
   * The index's type, such as `fulltext-index`.
   */
  type: string

  /**
   * The source's name, left out when the definition gives none.
   */
  source_name?: string

  /**
   * The source's type, left out when the definition gives none.
   */
  source_type?: string

  /**
   * The source's uuid, left out when the definition gives none.
   */
  source_uuid?: string

  /**
   * The index params, one entry per member.
   */
  params: Record<string, Buffer>

  /**
   * The plan params, one entry per member.
   */
  plan_params: Record<string, Buffer>

  /**
   * The source params, one entry per member.
   */
  source_params: Record<string, Buffer>
}

/**
 * A scope's manager names its bucket and scope; the cluster's names
 * neither, which the gateway reads as an index of the cluster's own.
 *
 * @internal
 */
export function searchScopeToProto(req: SearchIndexRequest): SearchScopePb {
  if (!req.scope) {
    return {}
  }
  return {
    bucket_name: req.scope.bucketName,
    scope_name: req.scope.scopeName,
  }
}

/**
 * A member with no JSON form is left out, as a classic connection leaves it
 * out of the whole object. Params that are not an object are refused.
 *
 * @internal
 */
export function paramsToProto(
  params: unknown,
  what: string
): Record<string, Buffer> {
  if (params === undefined || params === null) {
    return {}
  }
  if (typeof params !== 'object' || Array.isArray(params)) {
    throw new InvalidArgumentError(
      new Error(`The search index ${what} must be an object.`)
    )
  }
  const encoded: Record<string, Buffer> = {}
  for (const [key, value] of Object.entries(params)) {
    const json = JSON.stringify(value)
    if (json !== undefined) {
      encoded[key] = Buffer.from(json)
    }
  }
  return encoded
}

/**
 * A params map read back into one object. A member that is not JSON fails
 * the whole read: callers upsert what a get returned, so a dropped member
 * would be silently deleted from the index.
 */
function paramsFromProto(
  indexName: string,
  what: string,
  source: Record<string, Buffer>
): { [key: string]: any } {
  const read: { [key: string]: any } = {}
  for (const [key, value] of Object.entries(source)) {
    try {
      read[key] = JSON.parse(value.toString())
    } catch (_e) {
      throw new ParsingFailureError(
        new Error(
          `The ${what} member '${key}' of search index '${indexName}' is ` +
            `not JSON.`
        )
      )
    }
  }
  return read
}

/**
 * The fields of `index` that a create and an update share. Neither
 * carries the uuid here: only an update has one, and the caller sets it.
 *
 * @internal
 */
export function indexFieldsToProto(index: ISearchIndex): IndexFieldsPb {
  const message: IndexFieldsPb = {
    name: index.name,
    type: index.type,
    params: paramsToProto(index.params, 'params'),
    plan_params: paramsToProto(index.planParams, 'plan params'),
    source_params: paramsToProto(index.sourceParams, 'source params'),
  }
  if (index.sourceName) {
    message.source_name = index.sourceName
  }
  if (index.sourceType) {
    message.source_type = index.sourceType
  }
  if (index.sourceUuid) {
    message.source_uuid = index.sourceUuid
  }
  return message
}

/**
 * One index the gateway sent back, as a classic connection reads it: a
 * field the gateway left out is empty, and absent params are an empty
 * object.
 *
 * @internal
 */
export function searchIndexFromProto(index: IndexPb): SearchIndex {
  return new SearchIndex({
    uuid: index.uuid,
    name: index.name,
    type: index.type,
    params: paramsFromProto(index.name, 'params', index.params),
    sourceUuid: index.source_uuid ?? '',
    sourceName: index.source_name ?? '',
    sourceType: index.source_type ?? '',
    sourceParams: paramsFromProto(
      index.name,
      'source params',
      index.source_params
    ),
    planParams: paramsFromProto(index.name, 'plan params', index.plan_params),
  })
}

/**
 * Search index management over the gateway's `SearchAdminService`.
 *
 * @internal
 */
export class Couchbase2SearchIndexes implements SearchIndexManagementBackend {
  private readonly _channel: Couchbase2Channel
  private readonly _client: SearchAdminServiceClient

  constructor(channel: Couchbase2Channel, client: SearchAdminServiceClient) {
    this._channel = channel
    this._client = client
  }

  /**
   * Reads one index with `SearchAdminService.GetIndex`. A success that
   * carries no index describes none, so it raises `IndexNotFoundError`.
   */
  async getIndex(
    indexName: string,
    req: SearchIndexRequest
  ): Promise<SearchIndex> {
    const message = { ...searchScopeToProto(req), name: indexName }
    const ctx = this._channel.context(SEARCH_INDEX_GET, req.timeout, req.obs)
    const resp = await unary<GetIndexResponsePb>(ctx, (options, callback) =>
      this._client.GetIndex(message, this._channel.metadata, options, callback)
    )
    if (!resp.index) {
      throw new IndexNotFoundError(
        new Error(`Search index '${indexName}' was not found.`)
      )
    }
    return searchIndexFromProto(resp.index)
  }

  /**
   * Lists the indexes with `SearchAdminService.ListIndexes`.
   */
  async getAllIndexes(req: SearchIndexRequest): Promise<SearchIndex[]> {
    const message = searchScopeToProto(req)
    const ctx = this._channel.context(
      SEARCH_INDEX_GET_ALL,
      req.timeout,
      req.obs
    )
    const resp = await unary<ListIndexesResponsePb>(ctx, (options, callback) =>
      this._client.ListIndexes(
        message,
        this._channel.metadata,
        options,
        callback
      )
    )
    return resp.indexes.map(searchIndexFromProto)
  }

  /**
   * Creates an index with `SearchAdminService.CreateIndex`, or updates one
   * with `SearchAdminService.UpdateIndex` when the definition has a uuid.
   * The server refuses an update whose uuid is no longer the index's.
   */
  async upsertIndex(
    index: ISearchIndex,
    req: SearchIndexRequest
  ): Promise<void> {
    const scope = searchScopeToProto(req)
    const fields = indexFieldsToProto(index)
    const ctx = this._channel.context(SEARCH_INDEX_UPSERT, req.timeout, req.obs)
    if (index.uuid) {
      const message = { ...scope, index: { ...fields, uuid: index.uuid } }
      await unary(ctx, (options, callback) =>
        this._client.UpdateIndex(
          message,
          this._channel.metadata,
          options,
          callback
        )
      )
    } else {
      const message = { ...scope, ...fields }
      await unary(ctx, (options, callback) =>
        this._client.CreateIndex(
          message,
          this._channel.metadata,
          options,
          callback
        )
      )
    }
  }

  /**
   * Drops an index with `SearchAdminService.DeleteIndex`.
   */
  async dropIndex(indexName: string, req: SearchIndexRequest): Promise<void> {
    await this._named(
      SEARCH_INDEX_DROP,
      indexName,
      req,
      (message, metadata, options, callback) =>
        this._client.DeleteIndex(message, metadata, options, callback)
    )
  }

  /**
   * Counts the index's documents with
   * `SearchAdminService.GetIndexedDocumentsCount`.
   */
  async getIndexedDocumentsCount(
    indexName: string,
    req: SearchIndexRequest
  ): Promise<number> {
    const resp = await this._named<GetIndexedDocumentsCountResponsePb>(
      SEARCH_INDEX_GET_DOCUMENTS_COUNT,
      indexName,
      req,
      (message, metadata, options, callback) =>
        this._client.GetIndexedDocumentsCount(
          message,
          metadata,
          options,
          callback
        )
    )
    return Number(resp.count)
  }

  /**
   * Pauses ingest with `SearchAdminService.PauseIndexIngest`.
   */
  async pauseIngest(indexName: string, req: SearchIndexRequest): Promise<void> {
    await this._named(
      SEARCH_INDEX_CONTROL_INGEST,
      indexName,
      req,
      (message, metadata, options, callback) =>
        this._client.PauseIndexIngest(message, metadata, options, callback)
    )
  }

  /**
   * Resumes ingest with `SearchAdminService.ResumeIndexIngest`.
   */
  async resumeIngest(
    indexName: string,
    req: SearchIndexRequest
  ): Promise<void> {
    await this._named(
      SEARCH_INDEX_CONTROL_INGEST,
      indexName,
      req,
      (message, metadata, options, callback) =>
        this._client.ResumeIndexIngest(message, metadata, options, callback)
    )
  }

  /**
   * Allows querying with `SearchAdminService.AllowIndexQuerying`.
   */
  async allowQuerying(
    indexName: string,
    req: SearchIndexRequest
  ): Promise<void> {
    await this._named(
      SEARCH_INDEX_CONTROL_QUERY,
      indexName,
      req,
      (message, metadata, options, callback) =>
        this._client.AllowIndexQuerying(message, metadata, options, callback)
    )
  }

  /**
   * Disallows querying with `SearchAdminService.DisallowIndexQuerying`.
   */
  async disallowQuerying(
    indexName: string,
    req: SearchIndexRequest
  ): Promise<void> {
    await this._named(
      SEARCH_INDEX_CONTROL_QUERY,
      indexName,
      req,
      (message, metadata, options, callback) =>
        this._client.DisallowIndexQuerying(message, metadata, options, callback)
    )
  }

  /**
   * Freezes the plan with `SearchAdminService.FreezeIndexPlan`.
   */
  async freezePlan(indexName: string, req: SearchIndexRequest): Promise<void> {
    await this._named(
      SEARCH_INDEX_CONTROL_PLAN_FREEZE,
      indexName,
      req,
      (message, metadata, options, callback) =>
        this._client.FreezeIndexPlan(message, metadata, options, callback)
    )
  }

  /**
   * Unfreezes the plan with `SearchAdminService.UnfreezeIndexPlan`.
   */
  async unfreezePlan(
    indexName: string,
    req: SearchIndexRequest
  ): Promise<void> {
    await this._named(
      SEARCH_INDEX_CONTROL_PLAN_FREEZE,
      indexName,
      req,
      (message, metadata, options, callback) =>
        this._client.UnfreezeIndexPlan(message, metadata, options, callback)
    )
  }

  /**
   * Analyzes `document` with `SearchAdminService.AnalyzeDocument`,
   * returning the analysis as a classic connection does.
   */
  async analyzeDocument(
    indexName: string,
    document: any,
    req: SearchIndexRequest
  ): Promise<any> {
    const message = {
      ...searchScopeToProto(req),
      name: indexName,
      doc: Buffer.from(JSON.stringify(document)),
    }
    const ctx = this._channel.context(
      SEARCH_INDEX_ANALYZE_DOCUMENT,
      req.timeout,
      req.obs
    )
    const resp = await unary<AnalyzeDocumentResponsePb>(
      ctx,
      (options, callback) =>
        this._client.AnalyzeDocument(
          message,
          this._channel.metadata,
          options,
          callback
        )
    )
    try {
      return JSON.parse(resp.analyzed.toString())
    } catch (_e) {
      throw new ParsingFailureError(
        new Error('The document analysis is not JSON.')
      )
    }
  }

  /**
   * Sends a request that names one index and carries nothing else.
   */
  private async _named<R = unknown>(
    op: Couchbase2Op,
    indexName: string,
    req: SearchIndexRequest,
    call: (
      message: SearchScopePb & { name: string },
      metadata: grpc.Metadata,
      options: grpc.CallOptions,
      callback: grpc.requestCallback<R>
    ) => grpc.ClientUnaryCall
  ): Promise<R> {
    const message = { ...searchScopeToProto(req), name: indexName }
    const ctx = this._channel.context(op, req.timeout, req.obs)
    return unary<R>(ctx, (options, callback) =>
      call(message, this._channel.metadata, options, callback)
    )
  }
}
