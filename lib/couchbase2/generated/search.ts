import type * as grpc from '@grpc/grpc-js';
import type { EnumTypeDefinition, MessageTypeDefinition } from '@grpc/proto-loader';

import type { AllowIndexQueryingRequest as _couchbase_admin_search_v1_AllowIndexQueryingRequest, AllowIndexQueryingRequest__Output as _couchbase_admin_search_v1_AllowIndexQueryingRequest__Output } from './couchbase/admin/search/v1/AllowIndexQueryingRequest';
import type { AllowIndexQueryingResponse as _couchbase_admin_search_v1_AllowIndexQueryingResponse, AllowIndexQueryingResponse__Output as _couchbase_admin_search_v1_AllowIndexQueryingResponse__Output } from './couchbase/admin/search/v1/AllowIndexQueryingResponse';
import type { AnalyzeDocumentRequest as _couchbase_admin_search_v1_AnalyzeDocumentRequest, AnalyzeDocumentRequest__Output as _couchbase_admin_search_v1_AnalyzeDocumentRequest__Output } from './couchbase/admin/search/v1/AnalyzeDocumentRequest';
import type { AnalyzeDocumentResponse as _couchbase_admin_search_v1_AnalyzeDocumentResponse, AnalyzeDocumentResponse__Output as _couchbase_admin_search_v1_AnalyzeDocumentResponse__Output } from './couchbase/admin/search/v1/AnalyzeDocumentResponse';
import type { CreateIndexRequest as _couchbase_admin_search_v1_CreateIndexRequest, CreateIndexRequest__Output as _couchbase_admin_search_v1_CreateIndexRequest__Output } from './couchbase/admin/search/v1/CreateIndexRequest';
import type { CreateIndexResponse as _couchbase_admin_search_v1_CreateIndexResponse, CreateIndexResponse__Output as _couchbase_admin_search_v1_CreateIndexResponse__Output } from './couchbase/admin/search/v1/CreateIndexResponse';
import type { DeleteIndexRequest as _couchbase_admin_search_v1_DeleteIndexRequest, DeleteIndexRequest__Output as _couchbase_admin_search_v1_DeleteIndexRequest__Output } from './couchbase/admin/search/v1/DeleteIndexRequest';
import type { DeleteIndexResponse as _couchbase_admin_search_v1_DeleteIndexResponse, DeleteIndexResponse__Output as _couchbase_admin_search_v1_DeleteIndexResponse__Output } from './couchbase/admin/search/v1/DeleteIndexResponse';
import type { DisallowIndexQueryingRequest as _couchbase_admin_search_v1_DisallowIndexQueryingRequest, DisallowIndexQueryingRequest__Output as _couchbase_admin_search_v1_DisallowIndexQueryingRequest__Output } from './couchbase/admin/search/v1/DisallowIndexQueryingRequest';
import type { DisallowIndexQueryingResponse as _couchbase_admin_search_v1_DisallowIndexQueryingResponse, DisallowIndexQueryingResponse__Output as _couchbase_admin_search_v1_DisallowIndexQueryingResponse__Output } from './couchbase/admin/search/v1/DisallowIndexQueryingResponse';
import type { FreezeIndexPlanRequest as _couchbase_admin_search_v1_FreezeIndexPlanRequest, FreezeIndexPlanRequest__Output as _couchbase_admin_search_v1_FreezeIndexPlanRequest__Output } from './couchbase/admin/search/v1/FreezeIndexPlanRequest';
import type { FreezeIndexPlanResponse as _couchbase_admin_search_v1_FreezeIndexPlanResponse, FreezeIndexPlanResponse__Output as _couchbase_admin_search_v1_FreezeIndexPlanResponse__Output } from './couchbase/admin/search/v1/FreezeIndexPlanResponse';
import type { GetIndexRequest as _couchbase_admin_search_v1_GetIndexRequest, GetIndexRequest__Output as _couchbase_admin_search_v1_GetIndexRequest__Output } from './couchbase/admin/search/v1/GetIndexRequest';
import type { GetIndexResponse as _couchbase_admin_search_v1_GetIndexResponse, GetIndexResponse__Output as _couchbase_admin_search_v1_GetIndexResponse__Output } from './couchbase/admin/search/v1/GetIndexResponse';
import type { GetIndexedDocumentsCountRequest as _couchbase_admin_search_v1_GetIndexedDocumentsCountRequest, GetIndexedDocumentsCountRequest__Output as _couchbase_admin_search_v1_GetIndexedDocumentsCountRequest__Output } from './couchbase/admin/search/v1/GetIndexedDocumentsCountRequest';
import type { GetIndexedDocumentsCountResponse as _couchbase_admin_search_v1_GetIndexedDocumentsCountResponse, GetIndexedDocumentsCountResponse__Output as _couchbase_admin_search_v1_GetIndexedDocumentsCountResponse__Output } from './couchbase/admin/search/v1/GetIndexedDocumentsCountResponse';
import type { Index as _couchbase_admin_search_v1_Index, Index__Output as _couchbase_admin_search_v1_Index__Output } from './couchbase/admin/search/v1/Index';
import type { ListIndexesRequest as _couchbase_admin_search_v1_ListIndexesRequest, ListIndexesRequest__Output as _couchbase_admin_search_v1_ListIndexesRequest__Output } from './couchbase/admin/search/v1/ListIndexesRequest';
import type { ListIndexesResponse as _couchbase_admin_search_v1_ListIndexesResponse, ListIndexesResponse__Output as _couchbase_admin_search_v1_ListIndexesResponse__Output } from './couchbase/admin/search/v1/ListIndexesResponse';
import type { PauseIndexIngestRequest as _couchbase_admin_search_v1_PauseIndexIngestRequest, PauseIndexIngestRequest__Output as _couchbase_admin_search_v1_PauseIndexIngestRequest__Output } from './couchbase/admin/search/v1/PauseIndexIngestRequest';
import type { PauseIndexIngestResponse as _couchbase_admin_search_v1_PauseIndexIngestResponse, PauseIndexIngestResponse__Output as _couchbase_admin_search_v1_PauseIndexIngestResponse__Output } from './couchbase/admin/search/v1/PauseIndexIngestResponse';
import type { ResumeIndexIngestRequest as _couchbase_admin_search_v1_ResumeIndexIngestRequest, ResumeIndexIngestRequest__Output as _couchbase_admin_search_v1_ResumeIndexIngestRequest__Output } from './couchbase/admin/search/v1/ResumeIndexIngestRequest';
import type { ResumeIndexIngestResponse as _couchbase_admin_search_v1_ResumeIndexIngestResponse, ResumeIndexIngestResponse__Output as _couchbase_admin_search_v1_ResumeIndexIngestResponse__Output } from './couchbase/admin/search/v1/ResumeIndexIngestResponse';
import type { SearchAdminServiceClient as _couchbase_admin_search_v1_SearchAdminServiceClient, SearchAdminServiceDefinition as _couchbase_admin_search_v1_SearchAdminServiceDefinition } from './couchbase/admin/search/v1/SearchAdminService';
import type { UnfreezeIndexPlanRequest as _couchbase_admin_search_v1_UnfreezeIndexPlanRequest, UnfreezeIndexPlanRequest__Output as _couchbase_admin_search_v1_UnfreezeIndexPlanRequest__Output } from './couchbase/admin/search/v1/UnfreezeIndexPlanRequest';
import type { UnfreezeIndexPlanResponse as _couchbase_admin_search_v1_UnfreezeIndexPlanResponse, UnfreezeIndexPlanResponse__Output as _couchbase_admin_search_v1_UnfreezeIndexPlanResponse__Output } from './couchbase/admin/search/v1/UnfreezeIndexPlanResponse';
import type { UpdateIndexRequest as _couchbase_admin_search_v1_UpdateIndexRequest, UpdateIndexRequest__Output as _couchbase_admin_search_v1_UpdateIndexRequest__Output } from './couchbase/admin/search/v1/UpdateIndexRequest';
import type { UpdateIndexResponse as _couchbase_admin_search_v1_UpdateIndexResponse, UpdateIndexResponse__Output as _couchbase_admin_search_v1_UpdateIndexResponse__Output } from './couchbase/admin/search/v1/UpdateIndexResponse';
import type { BooleanFieldQuery as _couchbase_search_v1_BooleanFieldQuery, BooleanFieldQuery__Output as _couchbase_search_v1_BooleanFieldQuery__Output } from './couchbase/search/v1/BooleanFieldQuery';
import type { BooleanQuery as _couchbase_search_v1_BooleanQuery, BooleanQuery__Output as _couchbase_search_v1_BooleanQuery__Output } from './couchbase/search/v1/BooleanQuery';
import type { ConjunctionQuery as _couchbase_search_v1_ConjunctionQuery, ConjunctionQuery__Output as _couchbase_search_v1_ConjunctionQuery__Output } from './couchbase/search/v1/ConjunctionQuery';
import type { DateRange as _couchbase_search_v1_DateRange, DateRange__Output as _couchbase_search_v1_DateRange__Output } from './couchbase/search/v1/DateRange';
import type { DateRangeFacet as _couchbase_search_v1_DateRangeFacet, DateRangeFacet__Output as _couchbase_search_v1_DateRangeFacet__Output } from './couchbase/search/v1/DateRangeFacet';
import type { DateRangeQuery as _couchbase_search_v1_DateRangeQuery, DateRangeQuery__Output as _couchbase_search_v1_DateRangeQuery__Output } from './couchbase/search/v1/DateRangeQuery';
import type { DisjunctionQuery as _couchbase_search_v1_DisjunctionQuery, DisjunctionQuery__Output as _couchbase_search_v1_DisjunctionQuery__Output } from './couchbase/search/v1/DisjunctionQuery';
import type { DocIdQuery as _couchbase_search_v1_DocIdQuery, DocIdQuery__Output as _couchbase_search_v1_DocIdQuery__Output } from './couchbase/search/v1/DocIdQuery';
import type { Facet as _couchbase_search_v1_Facet, Facet__Output as _couchbase_search_v1_Facet__Output } from './couchbase/search/v1/Facet';
import type { FieldSorting as _couchbase_search_v1_FieldSorting, FieldSorting__Output as _couchbase_search_v1_FieldSorting__Output } from './couchbase/search/v1/FieldSorting';
import type { GeoBoundingBoxQuery as _couchbase_search_v1_GeoBoundingBoxQuery, GeoBoundingBoxQuery__Output as _couchbase_search_v1_GeoBoundingBoxQuery__Output } from './couchbase/search/v1/GeoBoundingBoxQuery';
import type { GeoDistanceQuery as _couchbase_search_v1_GeoDistanceQuery, GeoDistanceQuery__Output as _couchbase_search_v1_GeoDistanceQuery__Output } from './couchbase/search/v1/GeoDistanceQuery';
import type { GeoDistanceSorting as _couchbase_search_v1_GeoDistanceSorting, GeoDistanceSorting__Output as _couchbase_search_v1_GeoDistanceSorting__Output } from './couchbase/search/v1/GeoDistanceSorting';
import type { GeoPolygonQuery as _couchbase_search_v1_GeoPolygonQuery, GeoPolygonQuery__Output as _couchbase_search_v1_GeoPolygonQuery__Output } from './couchbase/search/v1/GeoPolygonQuery';
import type { IdSorting as _couchbase_search_v1_IdSorting, IdSorting__Output as _couchbase_search_v1_IdSorting__Output } from './couchbase/search/v1/IdSorting';
import type { KnnQuery as _couchbase_search_v1_KnnQuery, KnnQuery__Output as _couchbase_search_v1_KnnQuery__Output } from './couchbase/search/v1/KnnQuery';
import type { LatLng as _couchbase_search_v1_LatLng, LatLng__Output as _couchbase_search_v1_LatLng__Output } from './couchbase/search/v1/LatLng';
import type { MatchAllQuery as _couchbase_search_v1_MatchAllQuery, MatchAllQuery__Output as _couchbase_search_v1_MatchAllQuery__Output } from './couchbase/search/v1/MatchAllQuery';
import type { MatchNoneQuery as _couchbase_search_v1_MatchNoneQuery, MatchNoneQuery__Output as _couchbase_search_v1_MatchNoneQuery__Output } from './couchbase/search/v1/MatchNoneQuery';
import type { MatchPhraseQuery as _couchbase_search_v1_MatchPhraseQuery, MatchPhraseQuery__Output as _couchbase_search_v1_MatchPhraseQuery__Output } from './couchbase/search/v1/MatchPhraseQuery';
import type { MatchQuery as _couchbase_search_v1_MatchQuery, MatchQuery__Output as _couchbase_search_v1_MatchQuery__Output } from './couchbase/search/v1/MatchQuery';
import type { NumericRange as _couchbase_search_v1_NumericRange, NumericRange__Output as _couchbase_search_v1_NumericRange__Output } from './couchbase/search/v1/NumericRange';
import type { NumericRangeFacet as _couchbase_search_v1_NumericRangeFacet, NumericRangeFacet__Output as _couchbase_search_v1_NumericRangeFacet__Output } from './couchbase/search/v1/NumericRangeFacet';
import type { NumericRangeQuery as _couchbase_search_v1_NumericRangeQuery, NumericRangeQuery__Output as _couchbase_search_v1_NumericRangeQuery__Output } from './couchbase/search/v1/NumericRangeQuery';
import type { PhraseQuery as _couchbase_search_v1_PhraseQuery, PhraseQuery__Output as _couchbase_search_v1_PhraseQuery__Output } from './couchbase/search/v1/PhraseQuery';
import type { PrefixQuery as _couchbase_search_v1_PrefixQuery, PrefixQuery__Output as _couchbase_search_v1_PrefixQuery__Output } from './couchbase/search/v1/PrefixQuery';
import type { Query as _couchbase_search_v1_Query, Query__Output as _couchbase_search_v1_Query__Output } from './couchbase/search/v1/Query';
import type { QueryStringQuery as _couchbase_search_v1_QueryStringQuery, QueryStringQuery__Output as _couchbase_search_v1_QueryStringQuery__Output } from './couchbase/search/v1/QueryStringQuery';
import type { RegexpQuery as _couchbase_search_v1_RegexpQuery, RegexpQuery__Output as _couchbase_search_v1_RegexpQuery__Output } from './couchbase/search/v1/RegexpQuery';
import type { ScoreSorting as _couchbase_search_v1_ScoreSorting, ScoreSorting__Output as _couchbase_search_v1_ScoreSorting__Output } from './couchbase/search/v1/ScoreSorting';
import type { SearchQueryRequest as _couchbase_search_v1_SearchQueryRequest, SearchQueryRequest__Output as _couchbase_search_v1_SearchQueryRequest__Output } from './couchbase/search/v1/SearchQueryRequest';
import type { SearchQueryResponse as _couchbase_search_v1_SearchQueryResponse, SearchQueryResponse__Output as _couchbase_search_v1_SearchQueryResponse__Output } from './couchbase/search/v1/SearchQueryResponse';
import type { SearchServiceClient as _couchbase_search_v1_SearchServiceClient, SearchServiceDefinition as _couchbase_search_v1_SearchServiceDefinition } from './couchbase/search/v1/SearchService';
import type { Sorting as _couchbase_search_v1_Sorting, Sorting__Output as _couchbase_search_v1_Sorting__Output } from './couchbase/search/v1/Sorting';
import type { TermFacet as _couchbase_search_v1_TermFacet, TermFacet__Output as _couchbase_search_v1_TermFacet__Output } from './couchbase/search/v1/TermFacet';
import type { TermQuery as _couchbase_search_v1_TermQuery, TermQuery__Output as _couchbase_search_v1_TermQuery__Output } from './couchbase/search/v1/TermQuery';
import type { TermRangeQuery as _couchbase_search_v1_TermRangeQuery, TermRangeQuery__Output as _couchbase_search_v1_TermRangeQuery__Output } from './couchbase/search/v1/TermRangeQuery';
import type { WildcardQuery as _couchbase_search_v1_WildcardQuery, WildcardQuery__Output as _couchbase_search_v1_WildcardQuery__Output } from './couchbase/search/v1/WildcardQuery';
import type { Duration as _google_protobuf_Duration, Duration__Output as _google_protobuf_Duration__Output } from './google/protobuf/Duration';
import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from './google/protobuf/Timestamp';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  couchbase: {
    admin: {
      search: {
        v1: {
          AllowIndexQueryingRequest: MessageTypeDefinition<_couchbase_admin_search_v1_AllowIndexQueryingRequest, _couchbase_admin_search_v1_AllowIndexQueryingRequest__Output>
          AllowIndexQueryingResponse: MessageTypeDefinition<_couchbase_admin_search_v1_AllowIndexQueryingResponse, _couchbase_admin_search_v1_AllowIndexQueryingResponse__Output>
          AnalyzeDocumentRequest: MessageTypeDefinition<_couchbase_admin_search_v1_AnalyzeDocumentRequest, _couchbase_admin_search_v1_AnalyzeDocumentRequest__Output>
          AnalyzeDocumentResponse: MessageTypeDefinition<_couchbase_admin_search_v1_AnalyzeDocumentResponse, _couchbase_admin_search_v1_AnalyzeDocumentResponse__Output>
          CreateIndexRequest: MessageTypeDefinition<_couchbase_admin_search_v1_CreateIndexRequest, _couchbase_admin_search_v1_CreateIndexRequest__Output>
          CreateIndexResponse: MessageTypeDefinition<_couchbase_admin_search_v1_CreateIndexResponse, _couchbase_admin_search_v1_CreateIndexResponse__Output>
          DeleteIndexRequest: MessageTypeDefinition<_couchbase_admin_search_v1_DeleteIndexRequest, _couchbase_admin_search_v1_DeleteIndexRequest__Output>
          DeleteIndexResponse: MessageTypeDefinition<_couchbase_admin_search_v1_DeleteIndexResponse, _couchbase_admin_search_v1_DeleteIndexResponse__Output>
          DisallowIndexQueryingRequest: MessageTypeDefinition<_couchbase_admin_search_v1_DisallowIndexQueryingRequest, _couchbase_admin_search_v1_DisallowIndexQueryingRequest__Output>
          DisallowIndexQueryingResponse: MessageTypeDefinition<_couchbase_admin_search_v1_DisallowIndexQueryingResponse, _couchbase_admin_search_v1_DisallowIndexQueryingResponse__Output>
          FreezeIndexPlanRequest: MessageTypeDefinition<_couchbase_admin_search_v1_FreezeIndexPlanRequest, _couchbase_admin_search_v1_FreezeIndexPlanRequest__Output>
          FreezeIndexPlanResponse: MessageTypeDefinition<_couchbase_admin_search_v1_FreezeIndexPlanResponse, _couchbase_admin_search_v1_FreezeIndexPlanResponse__Output>
          GetIndexRequest: MessageTypeDefinition<_couchbase_admin_search_v1_GetIndexRequest, _couchbase_admin_search_v1_GetIndexRequest__Output>
          GetIndexResponse: MessageTypeDefinition<_couchbase_admin_search_v1_GetIndexResponse, _couchbase_admin_search_v1_GetIndexResponse__Output>
          GetIndexedDocumentsCountRequest: MessageTypeDefinition<_couchbase_admin_search_v1_GetIndexedDocumentsCountRequest, _couchbase_admin_search_v1_GetIndexedDocumentsCountRequest__Output>
          GetIndexedDocumentsCountResponse: MessageTypeDefinition<_couchbase_admin_search_v1_GetIndexedDocumentsCountResponse, _couchbase_admin_search_v1_GetIndexedDocumentsCountResponse__Output>
          Index: MessageTypeDefinition<_couchbase_admin_search_v1_Index, _couchbase_admin_search_v1_Index__Output>
          ListIndexesRequest: MessageTypeDefinition<_couchbase_admin_search_v1_ListIndexesRequest, _couchbase_admin_search_v1_ListIndexesRequest__Output>
          ListIndexesResponse: MessageTypeDefinition<_couchbase_admin_search_v1_ListIndexesResponse, _couchbase_admin_search_v1_ListIndexesResponse__Output>
          PauseIndexIngestRequest: MessageTypeDefinition<_couchbase_admin_search_v1_PauseIndexIngestRequest, _couchbase_admin_search_v1_PauseIndexIngestRequest__Output>
          PauseIndexIngestResponse: MessageTypeDefinition<_couchbase_admin_search_v1_PauseIndexIngestResponse, _couchbase_admin_search_v1_PauseIndexIngestResponse__Output>
          ResumeIndexIngestRequest: MessageTypeDefinition<_couchbase_admin_search_v1_ResumeIndexIngestRequest, _couchbase_admin_search_v1_ResumeIndexIngestRequest__Output>
          ResumeIndexIngestResponse: MessageTypeDefinition<_couchbase_admin_search_v1_ResumeIndexIngestResponse, _couchbase_admin_search_v1_ResumeIndexIngestResponse__Output>
          /**
           * SearchAdminService provides search index management and control.
           */
          SearchAdminService: SubtypeConstructor<typeof grpc.Client, _couchbase_admin_search_v1_SearchAdminServiceClient> & { service: _couchbase_admin_search_v1_SearchAdminServiceDefinition }
          UnfreezeIndexPlanRequest: MessageTypeDefinition<_couchbase_admin_search_v1_UnfreezeIndexPlanRequest, _couchbase_admin_search_v1_UnfreezeIndexPlanRequest__Output>
          UnfreezeIndexPlanResponse: MessageTypeDefinition<_couchbase_admin_search_v1_UnfreezeIndexPlanResponse, _couchbase_admin_search_v1_UnfreezeIndexPlanResponse__Output>
          UpdateIndexRequest: MessageTypeDefinition<_couchbase_admin_search_v1_UpdateIndexRequest, _couchbase_admin_search_v1_UpdateIndexRequest__Output>
          UpdateIndexResponse: MessageTypeDefinition<_couchbase_admin_search_v1_UpdateIndexResponse, _couchbase_admin_search_v1_UpdateIndexResponse__Output>
        }
      }
    }
    search: {
      v1: {
        BooleanFieldQuery: MessageTypeDefinition<_couchbase_search_v1_BooleanFieldQuery, _couchbase_search_v1_BooleanFieldQuery__Output>
        BooleanQuery: MessageTypeDefinition<_couchbase_search_v1_BooleanQuery, _couchbase_search_v1_BooleanQuery__Output>
        ConjunctionQuery: MessageTypeDefinition<_couchbase_search_v1_ConjunctionQuery, _couchbase_search_v1_ConjunctionQuery__Output>
        DateRange: MessageTypeDefinition<_couchbase_search_v1_DateRange, _couchbase_search_v1_DateRange__Output>
        DateRangeFacet: MessageTypeDefinition<_couchbase_search_v1_DateRangeFacet, _couchbase_search_v1_DateRangeFacet__Output>
        DateRangeQuery: MessageTypeDefinition<_couchbase_search_v1_DateRangeQuery, _couchbase_search_v1_DateRangeQuery__Output>
        DisjunctionQuery: MessageTypeDefinition<_couchbase_search_v1_DisjunctionQuery, _couchbase_search_v1_DisjunctionQuery__Output>
        DocIdQuery: MessageTypeDefinition<_couchbase_search_v1_DocIdQuery, _couchbase_search_v1_DocIdQuery__Output>
        Facet: MessageTypeDefinition<_couchbase_search_v1_Facet, _couchbase_search_v1_Facet__Output>
        FieldSorting: MessageTypeDefinition<_couchbase_search_v1_FieldSorting, _couchbase_search_v1_FieldSorting__Output>
        GeoBoundingBoxQuery: MessageTypeDefinition<_couchbase_search_v1_GeoBoundingBoxQuery, _couchbase_search_v1_GeoBoundingBoxQuery__Output>
        GeoDistanceQuery: MessageTypeDefinition<_couchbase_search_v1_GeoDistanceQuery, _couchbase_search_v1_GeoDistanceQuery__Output>
        GeoDistanceSorting: MessageTypeDefinition<_couchbase_search_v1_GeoDistanceSorting, _couchbase_search_v1_GeoDistanceSorting__Output>
        GeoPolygonQuery: MessageTypeDefinition<_couchbase_search_v1_GeoPolygonQuery, _couchbase_search_v1_GeoPolygonQuery__Output>
        IdSorting: MessageTypeDefinition<_couchbase_search_v1_IdSorting, _couchbase_search_v1_IdSorting__Output>
        KnnOperator: EnumTypeDefinition
        KnnQuery: MessageTypeDefinition<_couchbase_search_v1_KnnQuery, _couchbase_search_v1_KnnQuery__Output>
        LatLng: MessageTypeDefinition<_couchbase_search_v1_LatLng, _couchbase_search_v1_LatLng__Output>
        MatchAllQuery: MessageTypeDefinition<_couchbase_search_v1_MatchAllQuery, _couchbase_search_v1_MatchAllQuery__Output>
        MatchNoneQuery: MessageTypeDefinition<_couchbase_search_v1_MatchNoneQuery, _couchbase_search_v1_MatchNoneQuery__Output>
        MatchPhraseQuery: MessageTypeDefinition<_couchbase_search_v1_MatchPhraseQuery, _couchbase_search_v1_MatchPhraseQuery__Output>
        MatchQuery: MessageTypeDefinition<_couchbase_search_v1_MatchQuery, _couchbase_search_v1_MatchQuery__Output>
        NumericRange: MessageTypeDefinition<_couchbase_search_v1_NumericRange, _couchbase_search_v1_NumericRange__Output>
        NumericRangeFacet: MessageTypeDefinition<_couchbase_search_v1_NumericRangeFacet, _couchbase_search_v1_NumericRangeFacet__Output>
        NumericRangeQuery: MessageTypeDefinition<_couchbase_search_v1_NumericRangeQuery, _couchbase_search_v1_NumericRangeQuery__Output>
        PhraseQuery: MessageTypeDefinition<_couchbase_search_v1_PhraseQuery, _couchbase_search_v1_PhraseQuery__Output>
        PrefixQuery: MessageTypeDefinition<_couchbase_search_v1_PrefixQuery, _couchbase_search_v1_PrefixQuery__Output>
        Query: MessageTypeDefinition<_couchbase_search_v1_Query, _couchbase_search_v1_Query__Output>
        QueryStringQuery: MessageTypeDefinition<_couchbase_search_v1_QueryStringQuery, _couchbase_search_v1_QueryStringQuery__Output>
        RegexpQuery: MessageTypeDefinition<_couchbase_search_v1_RegexpQuery, _couchbase_search_v1_RegexpQuery__Output>
        ScoreSorting: MessageTypeDefinition<_couchbase_search_v1_ScoreSorting, _couchbase_search_v1_ScoreSorting__Output>
        SearchQueryRequest: MessageTypeDefinition<_couchbase_search_v1_SearchQueryRequest, _couchbase_search_v1_SearchQueryRequest__Output>
        SearchQueryResponse: MessageTypeDefinition<_couchbase_search_v1_SearchQueryResponse, _couchbase_search_v1_SearchQueryResponse__Output>
        /**
         * SearchService provides full-text search query execution.
         */
        SearchService: SubtypeConstructor<typeof grpc.Client, _couchbase_search_v1_SearchServiceClient> & { service: _couchbase_search_v1_SearchServiceDefinition }
        Sorting: MessageTypeDefinition<_couchbase_search_v1_Sorting, _couchbase_search_v1_Sorting__Output>
        TermFacet: MessageTypeDefinition<_couchbase_search_v1_TermFacet, _couchbase_search_v1_TermFacet__Output>
        TermQuery: MessageTypeDefinition<_couchbase_search_v1_TermQuery, _couchbase_search_v1_TermQuery__Output>
        TermRangeQuery: MessageTypeDefinition<_couchbase_search_v1_TermRangeQuery, _couchbase_search_v1_TermRangeQuery__Output>
        WildcardQuery: MessageTypeDefinition<_couchbase_search_v1_WildcardQuery, _couchbase_search_v1_WildcardQuery__Output>
      }
    }
  }
  google: {
    protobuf: {
      Duration: MessageTypeDefinition<_google_protobuf_Duration, _google_protobuf_Duration__Output>
      Timestamp: MessageTypeDefinition<_google_protobuf_Timestamp, _google_protobuf_Timestamp__Output>
    }
  }
}

