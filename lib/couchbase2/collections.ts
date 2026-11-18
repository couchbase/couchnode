import type { BackendRequest, CollectionManagementBackend } from '../backends'
import {
  CollectionSpec,
  CreateCollectionSettings,
  ScopeSpec,
  UpdateCollectionSettings,
} from '../collectionmanager'
import { FeatureNotAvailableError, InvalidArgumentError } from '../errors'
import { unavailableWhen } from './errormapping'
import type { CollectionAdminServiceClient } from './generated/couchbase/admin/collection/v1/CollectionAdminService'
import type { CreateCollectionRequest as CreateCollectionRequestPb } from './generated/couchbase/admin/collection/v1/CreateCollectionRequest'
import type { CreateCollectionResponse__Output as CreateCollectionResponsePb } from './generated/couchbase/admin/collection/v1/CreateCollectionResponse'
import type { CreateScopeResponse__Output as CreateScopeResponsePb } from './generated/couchbase/admin/collection/v1/CreateScopeResponse'
import type { DeleteCollectionResponse__Output as DeleteCollectionResponsePb } from './generated/couchbase/admin/collection/v1/DeleteCollectionResponse'
import type { DeleteScopeResponse__Output as DeleteScopeResponsePb } from './generated/couchbase/admin/collection/v1/DeleteScopeResponse'
import type {
  _couchbase_admin_collection_v1_ListCollectionsResponse_Collection__Output as ListedCollectionPb,
  ListCollectionsResponse__Output as ListCollectionsResponsePb,
} from './generated/couchbase/admin/collection/v1/ListCollectionsResponse'
import type { UpdateCollectionRequest as UpdateCollectionRequestPb } from './generated/couchbase/admin/collection/v1/UpdateCollectionRequest'
import type { UpdateCollectionResponse__Output as UpdateCollectionResponsePb } from './generated/couchbase/admin/collection/v1/UpdateCollectionResponse'
import type { Couchbase2Channel, Couchbase2Op } from './requestcontext'
import { unary } from './retry'

// The gateway and the SDK spell a collection's maximum expiry differently.
// The SDK's zero is the bucket's own maximum and its -1 is never to expire;
// the gateway leaves the field out for the bucket's maximum and reads zero as
// never.

/**
 * @internal
 */
export const SCOPE_GET_ALL: Couchbase2Op = {
  name: 'scope_get_all',
  readOnly: true,
}

/**
 * @internal
 */
export const SCOPE_CREATE: Couchbase2Op = {
  name: 'scope_create',
  readOnly: false,
}

/**
 * @internal
 */
export const SCOPE_DROP: Couchbase2Op = {
  name: 'scope_drop',
  readOnly: false,
}

/**
 * @internal
 */
export const COLLECTION_CREATE: Couchbase2Op = {
  name: 'collection_create',
  readOnly: false,
}

/**
 * @internal
 */
export const COLLECTION_UPDATE: Couchbase2Op = {
  name: 'collection_update',
  readOnly: false,
}

/**
 * @internal
 */
export const COLLECTION_DROP: Couchbase2Op = {
  name: 'collection_drop',
  readOnly: false,
}

/**
 * The longest maximum expiry the server accepts, in seconds.
 */
const MAX_EXPIRY_SECS = 2 ** 31 - 1

/**
 * What the server says when asked for history on a bucket that keeps none,
 * such as a couchstore one.
 */
const HISTORY_UNAVAILABLE = 'not allowed on this type of bucket'

/**
 * A maximum expiry other than zero in the gateway's form.
 */
function maxExpiryToProto(maxExpiry: number): number {
  if (maxExpiry === -1) {
    return 0
  }
  if (
    !Number.isInteger(maxExpiry) ||
    maxExpiry < 1 ||
    maxExpiry > MAX_EXPIRY_SECS
  ) {
    throw new InvalidArgumentError(
      new Error(
        `Expected a maximum expiry of -1 (for no expiry) or 0 to ` +
          `${MAX_EXPIRY_SECS} seconds, got ${maxExpiry}.`
      )
    )
  }
  return maxExpiry
}

/**
 * @internal
 */
export function createCollectionRequestToProto(
  bucketName: string,
  scopeName: string,
  collectionName: string,
  settings: CreateCollectionSettings
): CreateCollectionRequestPb {
  const message: CreateCollectionRequestPb = {
    bucket_name: bucketName,
    scope_name: scopeName,
    collection_name: collectionName,
  }
  // A collection created with no maximum expiry takes the bucket's.
  if (settings.maxExpiry !== undefined && settings.maxExpiry !== 0) {
    message.max_expiry_secs = maxExpiryToProto(settings.maxExpiry)
  }
  if (settings.history !== undefined) {
    message.history_retention_enabled = settings.history
  }
  return message
}

/**
 * Throws `FeatureNotAvailableError` for a maximum expiry of zero: an update
 * with no maximum expiry leaves it unchanged, so there is no way to ask for
 * the bucket's.
 *
 * @internal
 */
export function updateCollectionRequestToProto(
  bucketName: string,
  scopeName: string,
  collectionName: string,
  settings: UpdateCollectionSettings
): UpdateCollectionRequestPb {
  const message: UpdateCollectionRequestPb = {
    bucket_name: bucketName,
    scope_name: scopeName,
    collection_name: collectionName,
  }
  if (settings.maxExpiry === 0) {
    throw new FeatureNotAvailableError(
      new Error(
        "Updating a collection's maximum expiry to the bucket's is not " +
          'supported over couchbase2.'
      )
    )
  }
  if (settings.maxExpiry !== undefined) {
    message.max_expiry_secs = maxExpiryToProto(settings.maxExpiry)
  }
  if (settings.history !== undefined) {
    message.history_retention_enabled = settings.history
  }
  return message
}

/**
 * @internal
 */
export function scopeSpecsFromProto(
  resp: ListCollectionsResponsePb
): ScopeSpec[] {
  return resp.scopes.map(
    (scope) =>
      new ScopeSpec({
        name: scope.name,
        collections: scope.collections.map((collection) =>
          collectionSpecFromProto(collection, scope.name)
        ),
      })
  )
}

/**
 * Reads one listed collection, mapping its maximum expiry back to the SDK's.
 */
function collectionSpecFromProto(
  collection: ListedCollectionPb,
  scopeName: string
): CollectionSpec {
  let maxExpiry: number
  if (collection.max_expiry_secs === undefined) {
    maxExpiry = 0
  } else if (collection.max_expiry_secs === 0) {
    maxExpiry = -1
  } else {
    maxExpiry = collection.max_expiry_secs
  }
  return new CollectionSpec({
    name: collection.name,
    scopeName: scopeName,
    maxExpiry: maxExpiry,
    history: collection.history_retention_enabled,
  })
}

/**
 * Scope and collection management over the gateway's
 * `CollectionAdminService`.
 *
 * @internal
 */
export class Couchbase2Collections implements CollectionManagementBackend {
  private readonly _channel: Couchbase2Channel
  private readonly _client: CollectionAdminServiceClient

  constructor(
    channel: Couchbase2Channel,
    client: CollectionAdminServiceClient
  ) {
    this._channel = channel
    this._client = client
  }

  /**
   * Lists a bucket's scopes and their collections with
   * `CollectionAdminService.ListCollections`.
   */
  async getAllScopes(
    bucketName: string,
    req: BackendRequest
  ): Promise<ScopeSpec[]> {
    const message = { bucket_name: bucketName }
    const ctx = this._channel.context(SCOPE_GET_ALL, req.timeout, req.obs)
    const resp = await unary<ListCollectionsResponsePb>(
      ctx,
      (options, callback) =>
        this._client.ListCollections(
          message,
          this._channel.metadata,
          options,
          callback
        )
    )
    return scopeSpecsFromProto(resp)
  }

  /**
   * Creates a scope with `CollectionAdminService.CreateScope`.
   */
  async createScope(
    bucketName: string,
    scopeName: string,
    req: BackendRequest
  ): Promise<void> {
    const message = { bucket_name: bucketName, scope_name: scopeName }
    const ctx = this._channel.context(SCOPE_CREATE, req.timeout, req.obs)
    await unary<CreateScopeResponsePb>(ctx, (options, callback) =>
      this._client.CreateScope(
        message,
        this._channel.metadata,
        options,
        callback
      )
    )
  }

  /**
   * Drops a scope with `CollectionAdminService.DeleteScope`.
   */
  async dropScope(
    bucketName: string,
    scopeName: string,
    req: BackendRequest
  ): Promise<void> {
    const message = { bucket_name: bucketName, scope_name: scopeName }
    const ctx = this._channel.context(SCOPE_DROP, req.timeout, req.obs)
    await unary<DeleteScopeResponsePb>(ctx, (options, callback) =>
      this._client.DeleteScope(
        message,
        this._channel.metadata,
        options,
        callback
      )
    )
  }

  /**
   * Creates a collection with `CollectionAdminService.CreateCollection`.
   */
  async createCollection(
    bucketName: string,
    scopeName: string,
    collectionName: string,
    settings: CreateCollectionSettings,
    req: BackendRequest
  ): Promise<void> {
    const message = createCollectionRequestToProto(
      bucketName,
      scopeName,
      collectionName,
      settings
    )
    const ctx = this._channel.context(COLLECTION_CREATE, req.timeout, req.obs)
    await unavailableWhen(HISTORY_UNAVAILABLE, () =>
      unary<CreateCollectionResponsePb>(ctx, (options, callback) =>
        this._client.CreateCollection(
          message,
          this._channel.metadata,
          options,
          callback
        )
      )
    )
  }

  /**
   * Updates a collection with `CollectionAdminService.UpdateCollection`.
   */
  async updateCollection(
    bucketName: string,
    scopeName: string,
    collectionName: string,
    settings: UpdateCollectionSettings,
    req: BackendRequest
  ): Promise<void> {
    const message = updateCollectionRequestToProto(
      bucketName,
      scopeName,
      collectionName,
      settings
    )
    const ctx = this._channel.context(COLLECTION_UPDATE, req.timeout, req.obs)
    await unavailableWhen(HISTORY_UNAVAILABLE, () =>
      unary<UpdateCollectionResponsePb>(ctx, (options, callback) =>
        this._client.UpdateCollection(
          message,
          this._channel.metadata,
          options,
          callback
        )
      )
    )
  }

  /**
   * Drops a collection with `CollectionAdminService.DeleteCollection`.
   */
  async dropCollection(
    bucketName: string,
    scopeName: string,
    collectionName: string,
    req: BackendRequest
  ): Promise<void> {
    const message = {
      bucket_name: bucketName,
      scope_name: scopeName,
      collection_name: collectionName,
    }
    const ctx = this._channel.context(COLLECTION_DROP, req.timeout, req.obs)
    await unary<DeleteCollectionResponsePb>(ctx, (options, callback) =>
      this._client.DeleteCollection(
        message,
        this._channel.metadata,
        options,
        callback
      )
    )
  }
}
