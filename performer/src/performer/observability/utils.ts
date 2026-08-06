import {
  AppendOptions,
  DecrementOptions,
  ExistsOptions,
  IncrementOptions,
  InsertOptions,
  GetAllReplicasOptions,
  GetAndLockOptions,
  GetAndTouchOptions,
  GetAnyReplicaOptions,
  GetOptions,
  // [if:4.2.7]
  LookupInAnyReplicaOptions,
  LookupInAllReplicasOptions,
  // [end]
  LookupInOptions,
  MutateInOptions,
  PrependOptions,
  QueryOptions,
  RemoveOptions,
  ReplaceOptions,
  SearchQueryOptions,
  TouchOptions,
  UnlockOptions,
  UpsertOptions,
  CreateBucketOptions,
  DropBucketOptions,
  FlushBucketOptions,
  GetAllBucketsOptions,
  GetBucketOptions,
  UpdateBucketOptions,
  CreateCollectionOptions,
  CreateScopeOptions,
  DropCollectionOptions,
  DropScopeOptions,
  GetAllScopesOptions,
  // [if:4.2.7]
  UpdateCollectionOptions,
  // [end]
  CreateQueryIndexOptions,
  CreatePrimaryQueryIndexOptions,
  DropQueryIndexOptions,
  DropPrimaryQueryIndexOptions,
  GetAllQueryIndexesOptions,
  BuildQueryIndexOptions,
  WatchQueryIndexOptions,
  GetSearchIndexOptions,
  GetAllSearchIndexesOptions,
  UpsertSearchIndexOptions,
  DropSearchIndexOptions,
  GetSearchIndexedDocumentsCountOptions,
  PauseSearchIngestOptions,
  ResumeSearchIngestOptions,
  AllowSearchQueryingOptions,
  DisallowSearchQueryingOptions,
  FreezeSearchPlanOptions,
  UnfreezeSearchPlanOptions,
  AnalyzeSearchDocumentOptions,
} from "couchbase";

import {
  AppendOptions as AppendOptionsPb,
  DecrementOptions as DecrementOptionsPb,
  IncrementOptions as IncrementOptionsPb,
  PrependOptions as PrependOptionsPb,
} from "../../proto/sdk.kv.binary.options_pb";
import {
  // [if:4.2.7]
  LookupInAllReplicasOptions as LookupInAllReplicasOptionsPb,
  LookupInAnyReplicaOptions as LookupInAnyReplicaOptionsPb,
  // [end]
  LookupInOptions as LookupInOptionsPb,
} from "../../proto/sdk.kv.lookup_in_pb";
import { MutateInOptions as MutateInOptionsPb } from "../../proto/sdk.kv.mutate_in_pb";

import {
  ExistsOptions as ExistsOptionsPb,
  GetAllReplicasOptions as GetAllReplicasOptionsPb,
  GetAndLockOptions as GetAndLockOptionsPb,
  GetAndTouchOptions as GetAndTouchOptionsPb,
  GetAnyReplicaOptions as GetAnyReplicaOptionsPb,
  GetOptions as GetOptionsPb,
  InsertOptions as InsertOptionsPb,
  ReplaceOptions as ReplaceOptionsPb,
  RemoveOptions as RemoveOptionsPb,
  TouchOptions as TouchOptionsPb,
  UnlockOptions as UnlockOptionsPb,
  UpsertOptions as UpsertOptionsPb,
} from "../../proto/sdk.kv.options_pb";
import { QueryOptions as QueryOptionsPb } from "../../proto/sdk.query_pb";
import { SearchOptions as SearchOptionsPb } from "../../proto/sdk.search_pb";
import {
  CreateBucketOptions as CreateBucketOptionsPb,
  DropBucketOptions as DropBucketOptionsPb,
  FlushBucketOptions as FlushBucketOptionsPb,
  GetAllBucketsOptions as GetAllBucketOptionsPb,
  GetBucketOptions as GetBucketOptionsPb,
  UpdateBucketOptions as UpdateBucketOptionsPb,
} from "../../proto/sdk.cluster.bucket_manager_pb";

import {
  CreateCollectionOptions as CreateCollectionOptionsPb,
  CreateScopeOptions as CreateScopeOptionsPb,
  DropCollectionOptions as DropCollectionOptionsPb,
  DropScopeOptions as DropScopeOptionsPb,
  GetAllScopesOptions as GetAllScopesOptionsPb,
  // [if:4.2.6]
  UpdateCollectionOptions as UpdateCollectionOptionsPb,
  // [end]
} from "../../proto/sdk.bucket.collection_manager_pb";

import {
  CreateQueryIndexOptions as CreateQueryIndexOptionsPb,
  CreatePrimaryQueryIndexOptions as CreatePrimaryQueryIndexOptionsPb,
  DropIndexOptions as DropIndexOptionsPb,
  DropPrimaryIndexOptions as DropPrimaryIndexOptionsPb,
  GetAllQueryIndexOptions as GetAllQueryIndexOptionsPb,
  BuildDeferredIndexesOptions as BuildDeferredIndexesOptionsPb,
  WatchIndexesOptions as WatchIndexesOptionsPb,
} from "../../proto/sdk.query.index_manager.options_pb";

import {
  GetSearchIndexOptions as GetSearchIndexOptionsPb,
  GetAllSearchIndexesOptions as GetAllSearchIndexesOptionsPb,
  UpsertSearchIndexOptions as UpsertSearchIndexOptionsPb,
  DropSearchIndexOptions as DropSearchIndexOptionsPb,
  GetIndexedSearchIndexOptions as GetIndexedSearchIndexOptionsPb,
  PauseIngestSearchIndexOptions as PauseIngestSearchIndexOptionsPb,
  ResumeIngestSearchIndexOptions as ResumeIngestSearchIndexOptionsPb,
  AllowQueryingSearchIndexOptions as AllowQueryingSearchIndexOptionsPb,
  DisallowQueryingSearchIndexOptions as DisallowQueryingSearchIndexOptionsPb,
  FreezePlanSearchIndexOptions as FreezePlanSearchIndexOptionsPb,
  UnfreezePlanSearchIndexOptions as UnfreezePlanSearchIndexOptionsPb,
  AnalyzeDocumentOptions as AnalyzeDocumentOptionsPb,
} from "../../proto/sdk.search.index_manager_pb";

import { ISpanOwner } from "./observabilityTypes";

export type CommandOptions =
  | AppendOptions
  | DecrementOptions
  | ExistsOptions
  | IncrementOptions
  | InsertOptions
  | GetAllReplicasOptions
  | GetAndLockOptions
  | GetAndTouchOptions
  | GetAnyReplicaOptions
  | GetOptions
  // [if:4.2.7]
  | LookupInAllReplicasOptions
  | LookupInAnyReplicaOptions
  // [end]
  | LookupInOptions
  | MutateInOptions
  | PrependOptions
  | QueryOptions
  | RemoveOptions
  | ReplaceOptions
  | SearchQueryOptions
  | TouchOptions
  | UnlockOptions
  | UpsertOptions
  | CreateBucketOptions
  | DropBucketOptions
  | FlushBucketOptions
  | GetAllBucketsOptions
  | GetBucketOptions
  | UpdateBucketOptions
  | CreateCollectionOptions
  | CreateScopeOptions
  | DropCollectionOptions
  | DropScopeOptions
  | GetAllScopesOptions
  // [if:4.2.7]
  | UpdateCollectionOptions
  // [end]
  | CreateQueryIndexOptions
  | CreatePrimaryQueryIndexOptions
  | DropQueryIndexOptions
  | DropPrimaryQueryIndexOptions
  | GetAllQueryIndexesOptions
  | BuildQueryIndexOptions
  | WatchQueryIndexOptions
  | GetSearchIndexOptions
  | GetAllSearchIndexesOptions
  | UpsertSearchIndexOptions
  | DropSearchIndexOptions
  | GetSearchIndexedDocumentsCountOptions
  | PauseSearchIngestOptions
  | ResumeSearchIngestOptions
  | AllowSearchQueryingOptions
  | DisallowSearchQueryingOptions
  | FreezeSearchPlanOptions
  | UnfreezeSearchPlanOptions
  | AnalyzeSearchDocumentOptions;

export type CommandOptionsPb =
  | AppendOptionsPb
  | DecrementOptionsPb
  | IncrementOptionsPb
  | PrependOptionsPb
  | GetAllReplicasOptionsPb
  | GetAndLockOptionsPb
  | GetAndTouchOptionsPb
  | GetAnyReplicaOptionsPb
  | GetOptionsPb
  | InsertOptionsPb
  // [if:4.2.7]
  | LookupInAllReplicasOptionsPb
  | LookupInAnyReplicaOptionsPb
  // [end]
  | LookupInOptionsPb
  | MutateInOptionsPb
  | QueryOptionsPb
  | ReplaceOptionsPb
  | RemoveOptionsPb
  | SearchOptionsPb
  | TouchOptionsPb
  | UnlockOptionsPb
  | UpsertOptionsPb
  | ExistsOptionsPb
  | CreateBucketOptionsPb
  | DropBucketOptionsPb
  | FlushBucketOptionsPb
  | GetAllBucketOptionsPb
  | GetBucketOptionsPb
  | UpdateBucketOptionsPb
  | CreateCollectionOptionsPb
  | CreateScopeOptionsPb
  | DropCollectionOptionsPb
  | DropScopeOptionsPb
  | GetAllScopesOptionsPb
  // [if:4.2.6]
  | UpdateCollectionOptionsPb
  // [end]
  | CreateQueryIndexOptionsPb
  | CreatePrimaryQueryIndexOptionsPb
  | DropIndexOptionsPb
  | DropPrimaryIndexOptionsPb
  | GetAllQueryIndexOptionsPb
  | BuildDeferredIndexesOptionsPb
  | WatchIndexesOptionsPb
  | GetSearchIndexOptionsPb
  | GetAllSearchIndexesOptionsPb
  | UpsertSearchIndexOptionsPb
  | DropSearchIndexOptionsPb
  | GetIndexedSearchIndexOptionsPb
  | PauseIngestSearchIndexOptionsPb
  | ResumeIngestSearchIndexOptionsPb
  | AllowQueryingSearchIndexOptionsPb
  | DisallowQueryingSearchIndexOptionsPb
  | FreezePlanSearchIndexOptionsPb
  | UnfreezePlanSearchIndexOptionsPb
  | AnalyzeDocumentOptionsPb;

export function maybeAddParentSpan<
  T extends CommandOptions,
  P extends CommandOptionsPb,
>(opts: T, protoOptions?: P, spanOwner?: ISpanOwner): T {
  // [if:4.7.0]
  if (spanOwner && protoOptions && protoOptions.hasParentSpanId()) {
    opts.parentSpan = spanOwner.getSpan(
      protoOptions.getParentSpanId() as string,
    );
  }
  // [end]
  return opts;
}
