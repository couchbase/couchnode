// Original file: couchbase/admin/search/v1/search.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { AllowIndexQueryingRequest as _couchbase_admin_search_v1_AllowIndexQueryingRequest, AllowIndexQueryingRequest__Output as _couchbase_admin_search_v1_AllowIndexQueryingRequest__Output } from '../../../../couchbase/admin/search/v1/AllowIndexQueryingRequest';
import type { AllowIndexQueryingResponse as _couchbase_admin_search_v1_AllowIndexQueryingResponse, AllowIndexQueryingResponse__Output as _couchbase_admin_search_v1_AllowIndexQueryingResponse__Output } from '../../../../couchbase/admin/search/v1/AllowIndexQueryingResponse';
import type { AnalyzeDocumentRequest as _couchbase_admin_search_v1_AnalyzeDocumentRequest, AnalyzeDocumentRequest__Output as _couchbase_admin_search_v1_AnalyzeDocumentRequest__Output } from '../../../../couchbase/admin/search/v1/AnalyzeDocumentRequest';
import type { AnalyzeDocumentResponse as _couchbase_admin_search_v1_AnalyzeDocumentResponse, AnalyzeDocumentResponse__Output as _couchbase_admin_search_v1_AnalyzeDocumentResponse__Output } from '../../../../couchbase/admin/search/v1/AnalyzeDocumentResponse';
import type { CreateIndexRequest as _couchbase_admin_search_v1_CreateIndexRequest, CreateIndexRequest__Output as _couchbase_admin_search_v1_CreateIndexRequest__Output } from '../../../../couchbase/admin/search/v1/CreateIndexRequest';
import type { CreateIndexResponse as _couchbase_admin_search_v1_CreateIndexResponse, CreateIndexResponse__Output as _couchbase_admin_search_v1_CreateIndexResponse__Output } from '../../../../couchbase/admin/search/v1/CreateIndexResponse';
import type { DeleteIndexRequest as _couchbase_admin_search_v1_DeleteIndexRequest, DeleteIndexRequest__Output as _couchbase_admin_search_v1_DeleteIndexRequest__Output } from '../../../../couchbase/admin/search/v1/DeleteIndexRequest';
import type { DeleteIndexResponse as _couchbase_admin_search_v1_DeleteIndexResponse, DeleteIndexResponse__Output as _couchbase_admin_search_v1_DeleteIndexResponse__Output } from '../../../../couchbase/admin/search/v1/DeleteIndexResponse';
import type { DisallowIndexQueryingRequest as _couchbase_admin_search_v1_DisallowIndexQueryingRequest, DisallowIndexQueryingRequest__Output as _couchbase_admin_search_v1_DisallowIndexQueryingRequest__Output } from '../../../../couchbase/admin/search/v1/DisallowIndexQueryingRequest';
import type { DisallowIndexQueryingResponse as _couchbase_admin_search_v1_DisallowIndexQueryingResponse, DisallowIndexQueryingResponse__Output as _couchbase_admin_search_v1_DisallowIndexQueryingResponse__Output } from '../../../../couchbase/admin/search/v1/DisallowIndexQueryingResponse';
import type { FreezeIndexPlanRequest as _couchbase_admin_search_v1_FreezeIndexPlanRequest, FreezeIndexPlanRequest__Output as _couchbase_admin_search_v1_FreezeIndexPlanRequest__Output } from '../../../../couchbase/admin/search/v1/FreezeIndexPlanRequest';
import type { FreezeIndexPlanResponse as _couchbase_admin_search_v1_FreezeIndexPlanResponse, FreezeIndexPlanResponse__Output as _couchbase_admin_search_v1_FreezeIndexPlanResponse__Output } from '../../../../couchbase/admin/search/v1/FreezeIndexPlanResponse';
import type { GetIndexRequest as _couchbase_admin_search_v1_GetIndexRequest, GetIndexRequest__Output as _couchbase_admin_search_v1_GetIndexRequest__Output } from '../../../../couchbase/admin/search/v1/GetIndexRequest';
import type { GetIndexResponse as _couchbase_admin_search_v1_GetIndexResponse, GetIndexResponse__Output as _couchbase_admin_search_v1_GetIndexResponse__Output } from '../../../../couchbase/admin/search/v1/GetIndexResponse';
import type { GetIndexedDocumentsCountRequest as _couchbase_admin_search_v1_GetIndexedDocumentsCountRequest, GetIndexedDocumentsCountRequest__Output as _couchbase_admin_search_v1_GetIndexedDocumentsCountRequest__Output } from '../../../../couchbase/admin/search/v1/GetIndexedDocumentsCountRequest';
import type { GetIndexedDocumentsCountResponse as _couchbase_admin_search_v1_GetIndexedDocumentsCountResponse, GetIndexedDocumentsCountResponse__Output as _couchbase_admin_search_v1_GetIndexedDocumentsCountResponse__Output } from '../../../../couchbase/admin/search/v1/GetIndexedDocumentsCountResponse';
import type { ListIndexesRequest as _couchbase_admin_search_v1_ListIndexesRequest, ListIndexesRequest__Output as _couchbase_admin_search_v1_ListIndexesRequest__Output } from '../../../../couchbase/admin/search/v1/ListIndexesRequest';
import type { ListIndexesResponse as _couchbase_admin_search_v1_ListIndexesResponse, ListIndexesResponse__Output as _couchbase_admin_search_v1_ListIndexesResponse__Output } from '../../../../couchbase/admin/search/v1/ListIndexesResponse';
import type { PauseIndexIngestRequest as _couchbase_admin_search_v1_PauseIndexIngestRequest, PauseIndexIngestRequest__Output as _couchbase_admin_search_v1_PauseIndexIngestRequest__Output } from '../../../../couchbase/admin/search/v1/PauseIndexIngestRequest';
import type { PauseIndexIngestResponse as _couchbase_admin_search_v1_PauseIndexIngestResponse, PauseIndexIngestResponse__Output as _couchbase_admin_search_v1_PauseIndexIngestResponse__Output } from '../../../../couchbase/admin/search/v1/PauseIndexIngestResponse';
import type { ResumeIndexIngestRequest as _couchbase_admin_search_v1_ResumeIndexIngestRequest, ResumeIndexIngestRequest__Output as _couchbase_admin_search_v1_ResumeIndexIngestRequest__Output } from '../../../../couchbase/admin/search/v1/ResumeIndexIngestRequest';
import type { ResumeIndexIngestResponse as _couchbase_admin_search_v1_ResumeIndexIngestResponse, ResumeIndexIngestResponse__Output as _couchbase_admin_search_v1_ResumeIndexIngestResponse__Output } from '../../../../couchbase/admin/search/v1/ResumeIndexIngestResponse';
import type { UnfreezeIndexPlanRequest as _couchbase_admin_search_v1_UnfreezeIndexPlanRequest, UnfreezeIndexPlanRequest__Output as _couchbase_admin_search_v1_UnfreezeIndexPlanRequest__Output } from '../../../../couchbase/admin/search/v1/UnfreezeIndexPlanRequest';
import type { UnfreezeIndexPlanResponse as _couchbase_admin_search_v1_UnfreezeIndexPlanResponse, UnfreezeIndexPlanResponse__Output as _couchbase_admin_search_v1_UnfreezeIndexPlanResponse__Output } from '../../../../couchbase/admin/search/v1/UnfreezeIndexPlanResponse';
import type { UpdateIndexRequest as _couchbase_admin_search_v1_UpdateIndexRequest, UpdateIndexRequest__Output as _couchbase_admin_search_v1_UpdateIndexRequest__Output } from '../../../../couchbase/admin/search/v1/UpdateIndexRequest';
import type { UpdateIndexResponse as _couchbase_admin_search_v1_UpdateIndexResponse, UpdateIndexResponse__Output as _couchbase_admin_search_v1_UpdateIndexResponse__Output } from '../../../../couchbase/admin/search/v1/UpdateIndexResponse';

/**
 * SearchAdminService provides search index management and control.
 */
export interface SearchAdminServiceClient extends grpc.Client {
  /**
   * AllowIndexQuerying allows queries against an index.
   */
  AllowIndexQuerying(argument: _couchbase_admin_search_v1_AllowIndexQueryingRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_AllowIndexQueryingResponse__Output>): grpc.ClientUnaryCall;
  AllowIndexQuerying(argument: _couchbase_admin_search_v1_AllowIndexQueryingRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_AllowIndexQueryingResponse__Output>): grpc.ClientUnaryCall;
  AllowIndexQuerying(argument: _couchbase_admin_search_v1_AllowIndexQueryingRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_AllowIndexQueryingResponse__Output>): grpc.ClientUnaryCall;
  AllowIndexQuerying(argument: _couchbase_admin_search_v1_AllowIndexQueryingRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_AllowIndexQueryingResponse__Output>): grpc.ClientUnaryCall;
  /**
   * AllowIndexQuerying allows queries against an index.
   */
  allowIndexQuerying(argument: _couchbase_admin_search_v1_AllowIndexQueryingRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_AllowIndexQueryingResponse__Output>): grpc.ClientUnaryCall;
  allowIndexQuerying(argument: _couchbase_admin_search_v1_AllowIndexQueryingRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_AllowIndexQueryingResponse__Output>): grpc.ClientUnaryCall;
  allowIndexQuerying(argument: _couchbase_admin_search_v1_AllowIndexQueryingRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_AllowIndexQueryingResponse__Output>): grpc.ClientUnaryCall;
  allowIndexQuerying(argument: _couchbase_admin_search_v1_AllowIndexQueryingRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_AllowIndexQueryingResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * AnalyzeDocument analyzes a document against an index definition,
   * returning the tokens that would be indexed.
   */
  AnalyzeDocument(argument: _couchbase_admin_search_v1_AnalyzeDocumentRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_AnalyzeDocumentResponse__Output>): grpc.ClientUnaryCall;
  AnalyzeDocument(argument: _couchbase_admin_search_v1_AnalyzeDocumentRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_AnalyzeDocumentResponse__Output>): grpc.ClientUnaryCall;
  AnalyzeDocument(argument: _couchbase_admin_search_v1_AnalyzeDocumentRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_AnalyzeDocumentResponse__Output>): grpc.ClientUnaryCall;
  AnalyzeDocument(argument: _couchbase_admin_search_v1_AnalyzeDocumentRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_AnalyzeDocumentResponse__Output>): grpc.ClientUnaryCall;
  /**
   * AnalyzeDocument analyzes a document against an index definition,
   * returning the tokens that would be indexed.
   */
  analyzeDocument(argument: _couchbase_admin_search_v1_AnalyzeDocumentRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_AnalyzeDocumentResponse__Output>): grpc.ClientUnaryCall;
  analyzeDocument(argument: _couchbase_admin_search_v1_AnalyzeDocumentRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_AnalyzeDocumentResponse__Output>): grpc.ClientUnaryCall;
  analyzeDocument(argument: _couchbase_admin_search_v1_AnalyzeDocumentRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_AnalyzeDocumentResponse__Output>): grpc.ClientUnaryCall;
  analyzeDocument(argument: _couchbase_admin_search_v1_AnalyzeDocumentRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_AnalyzeDocumentResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * CreateIndex creates a new search index.
   */
  CreateIndex(argument: _couchbase_admin_search_v1_CreateIndexRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_CreateIndexResponse__Output>): grpc.ClientUnaryCall;
  CreateIndex(argument: _couchbase_admin_search_v1_CreateIndexRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_CreateIndexResponse__Output>): grpc.ClientUnaryCall;
  CreateIndex(argument: _couchbase_admin_search_v1_CreateIndexRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_CreateIndexResponse__Output>): grpc.ClientUnaryCall;
  CreateIndex(argument: _couchbase_admin_search_v1_CreateIndexRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_CreateIndexResponse__Output>): grpc.ClientUnaryCall;
  /**
   * CreateIndex creates a new search index.
   */
  createIndex(argument: _couchbase_admin_search_v1_CreateIndexRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_CreateIndexResponse__Output>): grpc.ClientUnaryCall;
  createIndex(argument: _couchbase_admin_search_v1_CreateIndexRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_CreateIndexResponse__Output>): grpc.ClientUnaryCall;
  createIndex(argument: _couchbase_admin_search_v1_CreateIndexRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_CreateIndexResponse__Output>): grpc.ClientUnaryCall;
  createIndex(argument: _couchbase_admin_search_v1_CreateIndexRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_CreateIndexResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * DeleteIndex deletes a search index.
   */
  DeleteIndex(argument: _couchbase_admin_search_v1_DeleteIndexRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_DeleteIndexResponse__Output>): grpc.ClientUnaryCall;
  DeleteIndex(argument: _couchbase_admin_search_v1_DeleteIndexRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_DeleteIndexResponse__Output>): grpc.ClientUnaryCall;
  DeleteIndex(argument: _couchbase_admin_search_v1_DeleteIndexRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_DeleteIndexResponse__Output>): grpc.ClientUnaryCall;
  DeleteIndex(argument: _couchbase_admin_search_v1_DeleteIndexRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_DeleteIndexResponse__Output>): grpc.ClientUnaryCall;
  /**
   * DeleteIndex deletes a search index.
   */
  deleteIndex(argument: _couchbase_admin_search_v1_DeleteIndexRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_DeleteIndexResponse__Output>): grpc.ClientUnaryCall;
  deleteIndex(argument: _couchbase_admin_search_v1_DeleteIndexRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_DeleteIndexResponse__Output>): grpc.ClientUnaryCall;
  deleteIndex(argument: _couchbase_admin_search_v1_DeleteIndexRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_DeleteIndexResponse__Output>): grpc.ClientUnaryCall;
  deleteIndex(argument: _couchbase_admin_search_v1_DeleteIndexRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_DeleteIndexResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * DisallowIndexQuerying prevents queries against an index.
   */
  DisallowIndexQuerying(argument: _couchbase_admin_search_v1_DisallowIndexQueryingRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_DisallowIndexQueryingResponse__Output>): grpc.ClientUnaryCall;
  DisallowIndexQuerying(argument: _couchbase_admin_search_v1_DisallowIndexQueryingRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_DisallowIndexQueryingResponse__Output>): grpc.ClientUnaryCall;
  DisallowIndexQuerying(argument: _couchbase_admin_search_v1_DisallowIndexQueryingRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_DisallowIndexQueryingResponse__Output>): grpc.ClientUnaryCall;
  DisallowIndexQuerying(argument: _couchbase_admin_search_v1_DisallowIndexQueryingRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_DisallowIndexQueryingResponse__Output>): grpc.ClientUnaryCall;
  /**
   * DisallowIndexQuerying prevents queries against an index.
   */
  disallowIndexQuerying(argument: _couchbase_admin_search_v1_DisallowIndexQueryingRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_DisallowIndexQueryingResponse__Output>): grpc.ClientUnaryCall;
  disallowIndexQuerying(argument: _couchbase_admin_search_v1_DisallowIndexQueryingRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_DisallowIndexQueryingResponse__Output>): grpc.ClientUnaryCall;
  disallowIndexQuerying(argument: _couchbase_admin_search_v1_DisallowIndexQueryingRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_DisallowIndexQueryingResponse__Output>): grpc.ClientUnaryCall;
  disallowIndexQuerying(argument: _couchbase_admin_search_v1_DisallowIndexQueryingRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_DisallowIndexQueryingResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * FreezeIndexPlan prevents the index plan from being reassigned.
   */
  FreezeIndexPlan(argument: _couchbase_admin_search_v1_FreezeIndexPlanRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_FreezeIndexPlanResponse__Output>): grpc.ClientUnaryCall;
  FreezeIndexPlan(argument: _couchbase_admin_search_v1_FreezeIndexPlanRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_FreezeIndexPlanResponse__Output>): grpc.ClientUnaryCall;
  FreezeIndexPlan(argument: _couchbase_admin_search_v1_FreezeIndexPlanRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_FreezeIndexPlanResponse__Output>): grpc.ClientUnaryCall;
  FreezeIndexPlan(argument: _couchbase_admin_search_v1_FreezeIndexPlanRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_FreezeIndexPlanResponse__Output>): grpc.ClientUnaryCall;
  /**
   * FreezeIndexPlan prevents the index plan from being reassigned.
   */
  freezeIndexPlan(argument: _couchbase_admin_search_v1_FreezeIndexPlanRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_FreezeIndexPlanResponse__Output>): grpc.ClientUnaryCall;
  freezeIndexPlan(argument: _couchbase_admin_search_v1_FreezeIndexPlanRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_FreezeIndexPlanResponse__Output>): grpc.ClientUnaryCall;
  freezeIndexPlan(argument: _couchbase_admin_search_v1_FreezeIndexPlanRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_FreezeIndexPlanResponse__Output>): grpc.ClientUnaryCall;
  freezeIndexPlan(argument: _couchbase_admin_search_v1_FreezeIndexPlanRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_FreezeIndexPlanResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * GetIndex retrieves a single search index by name.
   */
  GetIndex(argument: _couchbase_admin_search_v1_GetIndexRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_GetIndexResponse__Output>): grpc.ClientUnaryCall;
  GetIndex(argument: _couchbase_admin_search_v1_GetIndexRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_GetIndexResponse__Output>): grpc.ClientUnaryCall;
  GetIndex(argument: _couchbase_admin_search_v1_GetIndexRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_GetIndexResponse__Output>): grpc.ClientUnaryCall;
  GetIndex(argument: _couchbase_admin_search_v1_GetIndexRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_GetIndexResponse__Output>): grpc.ClientUnaryCall;
  /**
   * GetIndex retrieves a single search index by name.
   */
  getIndex(argument: _couchbase_admin_search_v1_GetIndexRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_GetIndexResponse__Output>): grpc.ClientUnaryCall;
  getIndex(argument: _couchbase_admin_search_v1_GetIndexRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_GetIndexResponse__Output>): grpc.ClientUnaryCall;
  getIndex(argument: _couchbase_admin_search_v1_GetIndexRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_GetIndexResponse__Output>): grpc.ClientUnaryCall;
  getIndex(argument: _couchbase_admin_search_v1_GetIndexRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_GetIndexResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * GetIndexedDocumentsCount returns the number of documents indexed
   * by a specific search index.
   */
  GetIndexedDocumentsCount(argument: _couchbase_admin_search_v1_GetIndexedDocumentsCountRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_GetIndexedDocumentsCountResponse__Output>): grpc.ClientUnaryCall;
  GetIndexedDocumentsCount(argument: _couchbase_admin_search_v1_GetIndexedDocumentsCountRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_GetIndexedDocumentsCountResponse__Output>): grpc.ClientUnaryCall;
  GetIndexedDocumentsCount(argument: _couchbase_admin_search_v1_GetIndexedDocumentsCountRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_GetIndexedDocumentsCountResponse__Output>): grpc.ClientUnaryCall;
  GetIndexedDocumentsCount(argument: _couchbase_admin_search_v1_GetIndexedDocumentsCountRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_GetIndexedDocumentsCountResponse__Output>): grpc.ClientUnaryCall;
  /**
   * GetIndexedDocumentsCount returns the number of documents indexed
   * by a specific search index.
   */
  getIndexedDocumentsCount(argument: _couchbase_admin_search_v1_GetIndexedDocumentsCountRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_GetIndexedDocumentsCountResponse__Output>): grpc.ClientUnaryCall;
  getIndexedDocumentsCount(argument: _couchbase_admin_search_v1_GetIndexedDocumentsCountRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_GetIndexedDocumentsCountResponse__Output>): grpc.ClientUnaryCall;
  getIndexedDocumentsCount(argument: _couchbase_admin_search_v1_GetIndexedDocumentsCountRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_GetIndexedDocumentsCountResponse__Output>): grpc.ClientUnaryCall;
  getIndexedDocumentsCount(argument: _couchbase_admin_search_v1_GetIndexedDocumentsCountRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_GetIndexedDocumentsCountResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * ListIndexes returns all search indexes, optionally scoped.
   */
  ListIndexes(argument: _couchbase_admin_search_v1_ListIndexesRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_ListIndexesResponse__Output>): grpc.ClientUnaryCall;
  ListIndexes(argument: _couchbase_admin_search_v1_ListIndexesRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_ListIndexesResponse__Output>): grpc.ClientUnaryCall;
  ListIndexes(argument: _couchbase_admin_search_v1_ListIndexesRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_ListIndexesResponse__Output>): grpc.ClientUnaryCall;
  ListIndexes(argument: _couchbase_admin_search_v1_ListIndexesRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_ListIndexesResponse__Output>): grpc.ClientUnaryCall;
  /**
   * ListIndexes returns all search indexes, optionally scoped.
   */
  listIndexes(argument: _couchbase_admin_search_v1_ListIndexesRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_ListIndexesResponse__Output>): grpc.ClientUnaryCall;
  listIndexes(argument: _couchbase_admin_search_v1_ListIndexesRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_ListIndexesResponse__Output>): grpc.ClientUnaryCall;
  listIndexes(argument: _couchbase_admin_search_v1_ListIndexesRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_ListIndexesResponse__Output>): grpc.ClientUnaryCall;
  listIndexes(argument: _couchbase_admin_search_v1_ListIndexesRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_ListIndexesResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * PauseIndexIngest pauses document ingestion for an index.
   */
  PauseIndexIngest(argument: _couchbase_admin_search_v1_PauseIndexIngestRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_PauseIndexIngestResponse__Output>): grpc.ClientUnaryCall;
  PauseIndexIngest(argument: _couchbase_admin_search_v1_PauseIndexIngestRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_PauseIndexIngestResponse__Output>): grpc.ClientUnaryCall;
  PauseIndexIngest(argument: _couchbase_admin_search_v1_PauseIndexIngestRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_PauseIndexIngestResponse__Output>): grpc.ClientUnaryCall;
  PauseIndexIngest(argument: _couchbase_admin_search_v1_PauseIndexIngestRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_PauseIndexIngestResponse__Output>): grpc.ClientUnaryCall;
  /**
   * PauseIndexIngest pauses document ingestion for an index.
   */
  pauseIndexIngest(argument: _couchbase_admin_search_v1_PauseIndexIngestRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_PauseIndexIngestResponse__Output>): grpc.ClientUnaryCall;
  pauseIndexIngest(argument: _couchbase_admin_search_v1_PauseIndexIngestRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_PauseIndexIngestResponse__Output>): grpc.ClientUnaryCall;
  pauseIndexIngest(argument: _couchbase_admin_search_v1_PauseIndexIngestRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_PauseIndexIngestResponse__Output>): grpc.ClientUnaryCall;
  pauseIndexIngest(argument: _couchbase_admin_search_v1_PauseIndexIngestRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_PauseIndexIngestResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * ResumeIndexIngest resumes document ingestion for a paused index.
   */
  ResumeIndexIngest(argument: _couchbase_admin_search_v1_ResumeIndexIngestRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_ResumeIndexIngestResponse__Output>): grpc.ClientUnaryCall;
  ResumeIndexIngest(argument: _couchbase_admin_search_v1_ResumeIndexIngestRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_ResumeIndexIngestResponse__Output>): grpc.ClientUnaryCall;
  ResumeIndexIngest(argument: _couchbase_admin_search_v1_ResumeIndexIngestRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_ResumeIndexIngestResponse__Output>): grpc.ClientUnaryCall;
  ResumeIndexIngest(argument: _couchbase_admin_search_v1_ResumeIndexIngestRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_ResumeIndexIngestResponse__Output>): grpc.ClientUnaryCall;
  /**
   * ResumeIndexIngest resumes document ingestion for a paused index.
   */
  resumeIndexIngest(argument: _couchbase_admin_search_v1_ResumeIndexIngestRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_ResumeIndexIngestResponse__Output>): grpc.ClientUnaryCall;
  resumeIndexIngest(argument: _couchbase_admin_search_v1_ResumeIndexIngestRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_ResumeIndexIngestResponse__Output>): grpc.ClientUnaryCall;
  resumeIndexIngest(argument: _couchbase_admin_search_v1_ResumeIndexIngestRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_ResumeIndexIngestResponse__Output>): grpc.ClientUnaryCall;
  resumeIndexIngest(argument: _couchbase_admin_search_v1_ResumeIndexIngestRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_ResumeIndexIngestResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * UnfreezeIndexPlan allows the index plan to be reassigned.
   */
  UnfreezeIndexPlan(argument: _couchbase_admin_search_v1_UnfreezeIndexPlanRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_UnfreezeIndexPlanResponse__Output>): grpc.ClientUnaryCall;
  UnfreezeIndexPlan(argument: _couchbase_admin_search_v1_UnfreezeIndexPlanRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_UnfreezeIndexPlanResponse__Output>): grpc.ClientUnaryCall;
  UnfreezeIndexPlan(argument: _couchbase_admin_search_v1_UnfreezeIndexPlanRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_UnfreezeIndexPlanResponse__Output>): grpc.ClientUnaryCall;
  UnfreezeIndexPlan(argument: _couchbase_admin_search_v1_UnfreezeIndexPlanRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_UnfreezeIndexPlanResponse__Output>): grpc.ClientUnaryCall;
  /**
   * UnfreezeIndexPlan allows the index plan to be reassigned.
   */
  unfreezeIndexPlan(argument: _couchbase_admin_search_v1_UnfreezeIndexPlanRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_UnfreezeIndexPlanResponse__Output>): grpc.ClientUnaryCall;
  unfreezeIndexPlan(argument: _couchbase_admin_search_v1_UnfreezeIndexPlanRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_UnfreezeIndexPlanResponse__Output>): grpc.ClientUnaryCall;
  unfreezeIndexPlan(argument: _couchbase_admin_search_v1_UnfreezeIndexPlanRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_UnfreezeIndexPlanResponse__Output>): grpc.ClientUnaryCall;
  unfreezeIndexPlan(argument: _couchbase_admin_search_v1_UnfreezeIndexPlanRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_UnfreezeIndexPlanResponse__Output>): grpc.ClientUnaryCall;
  
  /**
   * UpdateIndex updates an existing search index definition.
   */
  UpdateIndex(argument: _couchbase_admin_search_v1_UpdateIndexRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_UpdateIndexResponse__Output>): grpc.ClientUnaryCall;
  UpdateIndex(argument: _couchbase_admin_search_v1_UpdateIndexRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_UpdateIndexResponse__Output>): grpc.ClientUnaryCall;
  UpdateIndex(argument: _couchbase_admin_search_v1_UpdateIndexRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_UpdateIndexResponse__Output>): grpc.ClientUnaryCall;
  UpdateIndex(argument: _couchbase_admin_search_v1_UpdateIndexRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_UpdateIndexResponse__Output>): grpc.ClientUnaryCall;
  /**
   * UpdateIndex updates an existing search index definition.
   */
  updateIndex(argument: _couchbase_admin_search_v1_UpdateIndexRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_UpdateIndexResponse__Output>): grpc.ClientUnaryCall;
  updateIndex(argument: _couchbase_admin_search_v1_UpdateIndexRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_couchbase_admin_search_v1_UpdateIndexResponse__Output>): grpc.ClientUnaryCall;
  updateIndex(argument: _couchbase_admin_search_v1_UpdateIndexRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_couchbase_admin_search_v1_UpdateIndexResponse__Output>): grpc.ClientUnaryCall;
  updateIndex(argument: _couchbase_admin_search_v1_UpdateIndexRequest, callback: grpc.requestCallback<_couchbase_admin_search_v1_UpdateIndexResponse__Output>): grpc.ClientUnaryCall;
  
}

/**
 * SearchAdminService provides search index management and control.
 */
export interface SearchAdminServiceHandlers extends grpc.UntypedServiceImplementation {
  /**
   * AllowIndexQuerying allows queries against an index.
   */
  AllowIndexQuerying: grpc.handleUnaryCall<_couchbase_admin_search_v1_AllowIndexQueryingRequest__Output, _couchbase_admin_search_v1_AllowIndexQueryingResponse>;
  
  /**
   * AnalyzeDocument analyzes a document against an index definition,
   * returning the tokens that would be indexed.
   */
  AnalyzeDocument: grpc.handleUnaryCall<_couchbase_admin_search_v1_AnalyzeDocumentRequest__Output, _couchbase_admin_search_v1_AnalyzeDocumentResponse>;
  
  /**
   * CreateIndex creates a new search index.
   */
  CreateIndex: grpc.handleUnaryCall<_couchbase_admin_search_v1_CreateIndexRequest__Output, _couchbase_admin_search_v1_CreateIndexResponse>;
  
  /**
   * DeleteIndex deletes a search index.
   */
  DeleteIndex: grpc.handleUnaryCall<_couchbase_admin_search_v1_DeleteIndexRequest__Output, _couchbase_admin_search_v1_DeleteIndexResponse>;
  
  /**
   * DisallowIndexQuerying prevents queries against an index.
   */
  DisallowIndexQuerying: grpc.handleUnaryCall<_couchbase_admin_search_v1_DisallowIndexQueryingRequest__Output, _couchbase_admin_search_v1_DisallowIndexQueryingResponse>;
  
  /**
   * FreezeIndexPlan prevents the index plan from being reassigned.
   */
  FreezeIndexPlan: grpc.handleUnaryCall<_couchbase_admin_search_v1_FreezeIndexPlanRequest__Output, _couchbase_admin_search_v1_FreezeIndexPlanResponse>;
  
  /**
   * GetIndex retrieves a single search index by name.
   */
  GetIndex: grpc.handleUnaryCall<_couchbase_admin_search_v1_GetIndexRequest__Output, _couchbase_admin_search_v1_GetIndexResponse>;
  
  /**
   * GetIndexedDocumentsCount returns the number of documents indexed
   * by a specific search index.
   */
  GetIndexedDocumentsCount: grpc.handleUnaryCall<_couchbase_admin_search_v1_GetIndexedDocumentsCountRequest__Output, _couchbase_admin_search_v1_GetIndexedDocumentsCountResponse>;
  
  /**
   * ListIndexes returns all search indexes, optionally scoped.
   */
  ListIndexes: grpc.handleUnaryCall<_couchbase_admin_search_v1_ListIndexesRequest__Output, _couchbase_admin_search_v1_ListIndexesResponse>;
  
  /**
   * PauseIndexIngest pauses document ingestion for an index.
   */
  PauseIndexIngest: grpc.handleUnaryCall<_couchbase_admin_search_v1_PauseIndexIngestRequest__Output, _couchbase_admin_search_v1_PauseIndexIngestResponse>;
  
  /**
   * ResumeIndexIngest resumes document ingestion for a paused index.
   */
  ResumeIndexIngest: grpc.handleUnaryCall<_couchbase_admin_search_v1_ResumeIndexIngestRequest__Output, _couchbase_admin_search_v1_ResumeIndexIngestResponse>;
  
  /**
   * UnfreezeIndexPlan allows the index plan to be reassigned.
   */
  UnfreezeIndexPlan: grpc.handleUnaryCall<_couchbase_admin_search_v1_UnfreezeIndexPlanRequest__Output, _couchbase_admin_search_v1_UnfreezeIndexPlanResponse>;
  
  /**
   * UpdateIndex updates an existing search index definition.
   */
  UpdateIndex: grpc.handleUnaryCall<_couchbase_admin_search_v1_UpdateIndexRequest__Output, _couchbase_admin_search_v1_UpdateIndexResponse>;
  
}

export interface SearchAdminServiceDefinition extends grpc.ServiceDefinition {
  AllowIndexQuerying: MethodDefinition<_couchbase_admin_search_v1_AllowIndexQueryingRequest, _couchbase_admin_search_v1_AllowIndexQueryingResponse, _couchbase_admin_search_v1_AllowIndexQueryingRequest__Output, _couchbase_admin_search_v1_AllowIndexQueryingResponse__Output>
  AnalyzeDocument: MethodDefinition<_couchbase_admin_search_v1_AnalyzeDocumentRequest, _couchbase_admin_search_v1_AnalyzeDocumentResponse, _couchbase_admin_search_v1_AnalyzeDocumentRequest__Output, _couchbase_admin_search_v1_AnalyzeDocumentResponse__Output>
  CreateIndex: MethodDefinition<_couchbase_admin_search_v1_CreateIndexRequest, _couchbase_admin_search_v1_CreateIndexResponse, _couchbase_admin_search_v1_CreateIndexRequest__Output, _couchbase_admin_search_v1_CreateIndexResponse__Output>
  DeleteIndex: MethodDefinition<_couchbase_admin_search_v1_DeleteIndexRequest, _couchbase_admin_search_v1_DeleteIndexResponse, _couchbase_admin_search_v1_DeleteIndexRequest__Output, _couchbase_admin_search_v1_DeleteIndexResponse__Output>
  DisallowIndexQuerying: MethodDefinition<_couchbase_admin_search_v1_DisallowIndexQueryingRequest, _couchbase_admin_search_v1_DisallowIndexQueryingResponse, _couchbase_admin_search_v1_DisallowIndexQueryingRequest__Output, _couchbase_admin_search_v1_DisallowIndexQueryingResponse__Output>
  FreezeIndexPlan: MethodDefinition<_couchbase_admin_search_v1_FreezeIndexPlanRequest, _couchbase_admin_search_v1_FreezeIndexPlanResponse, _couchbase_admin_search_v1_FreezeIndexPlanRequest__Output, _couchbase_admin_search_v1_FreezeIndexPlanResponse__Output>
  GetIndex: MethodDefinition<_couchbase_admin_search_v1_GetIndexRequest, _couchbase_admin_search_v1_GetIndexResponse, _couchbase_admin_search_v1_GetIndexRequest__Output, _couchbase_admin_search_v1_GetIndexResponse__Output>
  GetIndexedDocumentsCount: MethodDefinition<_couchbase_admin_search_v1_GetIndexedDocumentsCountRequest, _couchbase_admin_search_v1_GetIndexedDocumentsCountResponse, _couchbase_admin_search_v1_GetIndexedDocumentsCountRequest__Output, _couchbase_admin_search_v1_GetIndexedDocumentsCountResponse__Output>
  ListIndexes: MethodDefinition<_couchbase_admin_search_v1_ListIndexesRequest, _couchbase_admin_search_v1_ListIndexesResponse, _couchbase_admin_search_v1_ListIndexesRequest__Output, _couchbase_admin_search_v1_ListIndexesResponse__Output>
  PauseIndexIngest: MethodDefinition<_couchbase_admin_search_v1_PauseIndexIngestRequest, _couchbase_admin_search_v1_PauseIndexIngestResponse, _couchbase_admin_search_v1_PauseIndexIngestRequest__Output, _couchbase_admin_search_v1_PauseIndexIngestResponse__Output>
  ResumeIndexIngest: MethodDefinition<_couchbase_admin_search_v1_ResumeIndexIngestRequest, _couchbase_admin_search_v1_ResumeIndexIngestResponse, _couchbase_admin_search_v1_ResumeIndexIngestRequest__Output, _couchbase_admin_search_v1_ResumeIndexIngestResponse__Output>
  UnfreezeIndexPlan: MethodDefinition<_couchbase_admin_search_v1_UnfreezeIndexPlanRequest, _couchbase_admin_search_v1_UnfreezeIndexPlanResponse, _couchbase_admin_search_v1_UnfreezeIndexPlanRequest__Output, _couchbase_admin_search_v1_UnfreezeIndexPlanResponse__Output>
  UpdateIndex: MethodDefinition<_couchbase_admin_search_v1_UpdateIndexRequest, _couchbase_admin_search_v1_UpdateIndexResponse, _couchbase_admin_search_v1_UpdateIndexRequest__Output, _couchbase_admin_search_v1_UpdateIndexResponse__Output>
}
