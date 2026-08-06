import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";

import {
  Search as SearchPb,
  SearchQuery as SearchQueryPb,
  MatchQuery as MatchQueryPb,
  MatchOperator as MatchOperatorPb,
  MatchPhraseQuery as MatchPhraseQueryPb,
  RegexpQuery as RegexpQueryPb,
  QueryStringQuery as QueryStringQueryPb,
  WildcardQuery as WildcardQueryPb,
  DocIdQuery as DocIdQueryPb,
  BooleanFieldQuery as BooleanFieldQueryPb,
  DateRangeQuery as DateRangeQueryPb,
  NumericRangeQuery as NumericRangeQueryPb,
  // [if:4.6.0]
  TermRangeQuery as TermRangeQueryPb,
  // [end]
  GeoDistanceQuery as GeoDistanceQueryPb,
  GeoBoundingBoxQuery as GeoBoundingBoxQueryPb,
  ConjunctionQuery as ConjunctionQueryPb,
  DisjunctionQuery as DisjunctionQueryPb,
  BooleanQuery as BooleanQueryPb,
  TermQuery as TermQueryPb,
  PrefixQuery as PrefixQueryPb,
  PhraseQuery as PhraseQueryPb,
  MatchAllQuery as MatchAllQueryPb,
  MatchNoneQuery as MatchNoneQueryPb,
  Location as LocationPb,
  // [if:4.2.10]
  SearchWrapper as SearchWrapperPb,
  SearchV2 as SearchV2Pb,
  SearchRequest as SearchRequestPb,
  VectorSearch as VectorSearchPb,
  VectorQuery as VectorQueryPb,
  VectorQueryOptions as VectorQueryOptionsPb,
  // [end]
} from "../../proto/sdk.search_pb";
import {
  ClusterLevelCommand as ClusterLevelCommandPb,
  Result as SdkCommandResultPb,
  // [if:4.2.10]
  ScopeLevelCommand as ScopeLevelCommandPb,
  // [end]
} from "../../proto/sdk.workload_pb";
// [if:4.2.10]
import { Scope as ScopePb } from "../../proto/shared.collection_pb";
// [end]
import { Result as ResultPb } from "../../proto/run.top_level_pb";
import { ContentAs as ContentAsPb } from "../../proto/shared.content_pb";
import {
  Config as StreamConfigPb,
  Type as StreamTypePb,
} from "../../proto/streams.top_level_pb";

import {
  Cluster,
  Scope,
  SearchQueryOptions,
  SearchQuery,
  MatchOperator,
  MatchSearchQuery,
  MatchPhraseSearchQuery,
  RegexpSearchQuery,
  QueryStringSearchQuery,
  WildcardSearchQuery,
  DocIdSearchQuery,
  BooleanFieldSearchQuery,
  DateRangeSearchQuery,
  NumericRangeSearchQuery,
  // [if:4.6.0]
  TermRangeSearchQuery,
  // [end]
  GeoDistanceSearchQuery,
  GeoBoundingBoxSearchQuery,
  ConjunctionSearchQuery,
  DisjunctionSearchQuery,
  BooleanSearchQuery,
  TermSearchQuery,
  PrefixSearchQuery,
  PhraseSearchQuery,
  MatchAllSearchQuery,
  MatchNoneSearchQuery,
  SearchRow,
  SearchMetaData,
  // [if:4.2.10]
  SearchRequest,
  // [end]
  SearchResult,
  StreamableRowPromise,
  // [if:4.2.10]
  VectorQuery,
  VectorSearch,
  VectorSearchOptions,
  // [end]
} from "couchbase";

import { ISdkCommand } from "./command";
import { SdkError } from "../error";
import { SdkCommandSearchOptions } from "../options/searchOptions";
import { SdkCommandResult } from "../results/result";
import { SdkSearchCommandResult } from "../results/searchResult";
import { StreamConfig, StreamResult } from "../results/stream";
import { ISpanOwner } from "../observability/observabilityTypes";
import { maybeAddParentSpan } from "../observability/utils";

/*

Types missing:
  - SearchRow
  - SearchRowLocations
  - SearchRowLocation
  - Fragments
  - Fields
  - SearchMetadata
  - SearchMetrics
  - SearchFacetResults

*/

// prettier-ignore
type SearchQueryType =
  | SearchQuery
// [if:4.2.10]
| SearchRequest
// [end]

class SdkSearchQueryBuilder {
  static buildMatchQuery(searchQueryPb: MatchQueryPb): MatchSearchQuery {
    const searchQuery = SearchQuery.match(searchQueryPb.getMatch());
    if (searchQueryPb.hasField()) {
      searchQuery.field(searchQueryPb.getField() as string);
    }
    if (searchQueryPb.hasAnalyzer()) {
      searchQuery.analyzer(searchQueryPb.getAnalyzer() as string);
    }
    if (searchQueryPb.hasPrefixLength()) {
      searchQuery.prefixLength(searchQueryPb.getPrefixLength() as number);
    }
    if (searchQueryPb.hasFuzziness()) {
      searchQuery.fuzziness(searchQueryPb.getFuzziness() as number);
    }
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    if (searchQueryPb.hasOperator()) {
      if (
        searchQueryPb.getOperator() == MatchOperatorPb.SEARCH_MATCH_OPERATOR_AND
      ) {
        searchQuery.operator(MatchOperator.And);
      } else if (
        searchQueryPb.getOperator() == MatchOperatorPb.SEARCH_MATCH_OPERATOR_OR
      ) {
        searchQuery.operator(MatchOperator.Or);
      }
    }
    return searchQuery;
  }

  static buildMatchPhraseQuery(
    searchQueryPb: MatchPhraseQueryPb,
  ): MatchPhraseSearchQuery {
    const searchQuery = SearchQuery.matchPhrase(searchQueryPb.getMatchPhrase());
    if (searchQueryPb.hasField()) {
      searchQuery.field(searchQueryPb.getField() as string);
    }
    if (searchQueryPb.hasAnalyzer()) {
      searchQuery.analyzer(searchQueryPb.getAnalyzer() as string);
    }
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    return searchQuery;
  }

  static buildRegexQuery(searchQueryPb: RegexpQueryPb): RegexpSearchQuery {
    const searchQuery = SearchQuery.regexp(searchQueryPb.getRegexp());
    if (searchQueryPb.hasField()) {
      searchQuery.field(searchQueryPb.getField() as string);
    }
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    return searchQuery;
  }

  static buildQueryStringQuery(
    searchQueryPb: QueryStringQueryPb,
  ): QueryStringSearchQuery {
    const searchQuery = SearchQuery.queryString(searchQueryPb.getQuery());
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    return searchQuery;
  }

  static buildWildcardQuery(
    searchQueryPb: WildcardQueryPb,
  ): WildcardSearchQuery {
    const searchQuery = SearchQuery.wildcard(searchQueryPb.getWildcard());
    if (searchQueryPb.hasField()) {
      searchQuery.field(searchQueryPb.getField() as string);
    }
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    return searchQuery;
  }

  static buildDocIdQuery(searchQueryPb: DocIdQueryPb): DocIdSearchQuery {
    const searchQuery = SearchQuery.docIds(...searchQueryPb.getIdsList());
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    return searchQuery;
  }

  static buildBooleanFieldQuery(
    searchQueryPb: BooleanFieldQueryPb,
  ): BooleanFieldSearchQuery {
    const searchQuery = SearchQuery.booleanField(searchQueryPb.getBool());
    if (searchQueryPb.hasField()) {
      searchQuery.field(searchQueryPb.getField() as string);
    }
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    return searchQuery;
  }

  static buildDateRangeQuery(
    searchQueryPb: DateRangeQueryPb,
  ): DateRangeSearchQuery {
    const searchQuery = SearchQuery.dateRange();
    if (searchQueryPb.hasStart()) {
      searchQuery.start(
        searchQueryPb.getStart() as string,
        searchQueryPb.getInclusiveEnd(),
      );
    }
    if (searchQueryPb.hasEnd()) {
      searchQuery.end(
        searchQueryPb.getEnd() as string,
        searchQueryPb.getInclusiveEnd(),
      );
    }
    if (searchQueryPb.hasDatetimeParser()) {
      searchQuery.dateTimeParser(searchQueryPb.getDatetimeParser() as string);
    }
    if (searchQueryPb.hasField()) {
      searchQuery.field(searchQueryPb.getField() as string);
    }
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    return searchQuery;
  }

  static buildNumericRangeQuery(
    searchQueryPb: NumericRangeQueryPb,
  ): NumericRangeSearchQuery {
    const searchQuery = SearchQuery.numericRange();
    if (searchQueryPb.hasMin()) {
      searchQuery.min(
        searchQueryPb.getMin() as number,
        searchQueryPb.getInclusiveMin(),
      );
    }
    if (searchQueryPb.hasMax()) {
      searchQuery.max(
        searchQueryPb.getMax() as number,
        searchQueryPb.getInclusiveMax(),
      );
    }
    if (searchQueryPb.hasField()) {
      searchQuery.field(searchQueryPb.getField() as string);
    }
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    return searchQuery;
  }

  // [if:4.6.0]
  static buildTermRangeQuery(
    searchQueryPb: TermRangeQueryPb,
  ): TermRangeSearchQuery {
    const searchQuery = SearchQuery.termRange();
    if (searchQueryPb.hasMin()) {
      searchQuery.min(
        searchQueryPb.getMin() as string,
        searchQueryPb.getInclusiveMin(),
      );
    }
    if (searchQueryPb.hasMax()) {
      searchQuery.max(
        searchQueryPb.getMax() as string,
        searchQueryPb.getInclusiveMax(),
      );
    }
    if (searchQueryPb.hasField()) {
      searchQuery.field(searchQueryPb.getField() as string);
    }
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    return searchQuery;
  }
  // [end]

  static buildGeoDistanceQuery(
    searchQueryPb: GeoDistanceQueryPb,
  ): GeoDistanceSearchQuery {
    const locPb = searchQueryPb.getLocation() as LocationPb;
    // [if:4.6.0]
    const searchQuery = SearchQuery.geoDistance(
      locPb.getLon(),
      locPb.getLat(),
      searchQueryPb.getDistance(),
    );
    // [else]
    //? const searchQuery = SearchQuery.geoDistance(
    //?   locPb.getLon(),
    //?   locPb.getLat(),
    //?   parseInt(searchQueryPb.getDistance())
    //? );
    // [end]
    if (searchQueryPb.hasField()) {
      searchQuery.field(searchQueryPb.getField() as string);
    }
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    return searchQuery;
  }

  static buildGeoBoundingBoxQuery(
    searchQueryPb: GeoBoundingBoxQueryPb,
  ): GeoBoundingBoxSearchQuery {
    const tlLocPb = searchQueryPb.getTopLeft() as LocationPb;
    const brLocPb = searchQueryPb.getBottomRight() as LocationPb;
    const searchQuery = SearchQuery.geoBoundingBox(
      tlLocPb.getLon(),
      tlLocPb.getLat(),
      brLocPb.getLon(),
      brLocPb.getLat(),
    );
    if (searchQueryPb.hasField()) {
      searchQuery.field(searchQueryPb.getField() as string);
    }
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    return searchQuery;
  }

  static buildConjunctionQuery(
    searchQueryPb: ConjunctionQueryPb,
  ): ConjunctionSearchQuery {
    const searchQuery = SearchQuery.conjuncts(
      ...searchQueryPb
        .getConjunctsList()
        .map((q) => SdkSearchQueryBuilder.buildSearchQuery(q)),
    );
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    return searchQuery;
  }

  static buildDisjunctionQuery(
    searchQueryPb: DisjunctionQueryPb,
  ): DisjunctionSearchQuery {
    const searchQuery = SearchQuery.disjuncts(
      ...searchQueryPb
        .getDisjunctsList()
        .map((q) => SdkSearchQueryBuilder.buildSearchQuery(q)),
    );
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    return searchQuery;
  }

  static buildBooleanQuery(searchQueryPb: BooleanQueryPb): BooleanSearchQuery {
    const searchQuery = SearchQuery.boolean();
    if (searchQueryPb.getMustList().length > 0) {
      const conjuctQuery = SearchQuery.conjuncts(
        ...searchQueryPb
          .getMustList()
          .map((q) => SdkSearchQueryBuilder.buildSearchQuery(q)),
      );
      searchQuery.must(conjuctQuery);
    }
    if (searchQueryPb.getMustNotList().length > 0) {
      const disjunctQuery = SearchQuery.disjuncts(
        ...searchQueryPb
          .getMustNotList()
          .map((q) => SdkSearchQueryBuilder.buildSearchQuery(q)),
      );
      searchQuery.mustNot(disjunctQuery);
    }
    if (searchQueryPb.getShouldList().length > 0) {
      const disjunctQuery = SearchQuery.disjuncts(
        ...searchQueryPb
          .getShouldList()
          .map((q) => SdkSearchQueryBuilder.buildSearchQuery(q)),
      );
      searchQuery.should(disjunctQuery);
    }
    if (searchQueryPb.hasShouldMin()) {
      searchQuery.shouldMin(searchQueryPb.getShouldMin() as number);
    }
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    return searchQuery;
  }

  static buildTermQuery(searchQueryPb: TermQueryPb): TermSearchQuery {
    const searchQuery = SearchQuery.term(searchQueryPb.getTerm());
    if (searchQueryPb.hasField()) {
      searchQuery.field(searchQueryPb.getField() as string);
    }
    if (searchQueryPb.hasFuzziness()) {
      searchQuery.fuzziness(searchQueryPb.getFuzziness() as number);
    }
    if (searchQueryPb.hasPrefixLength()) {
      searchQuery.prefixLength(searchQueryPb.getPrefixLength() as number);
    }
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    return searchQuery;
  }

  static buildPrefixQuery(searchQueryPb: PrefixQueryPb): PrefixSearchQuery {
    const searchQuery = SearchQuery.prefix(searchQueryPb.getPrefix());
    if (searchQueryPb.hasField()) {
      searchQuery.field(searchQueryPb.getField() as string);
    }
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    return searchQuery;
  }

  static buildPhraseQuery(searchQueryPb: PhraseQueryPb): PhraseSearchQuery {
    const searchQuery = SearchQuery.phrase(searchQueryPb.getTermsList());
    if (searchQueryPb.hasField()) {
      searchQuery.field(searchQueryPb.getField() as string);
    }
    if (searchQueryPb.hasBoost()) {
      searchQuery.boost(searchQueryPb.getBoost() as number);
    }
    return searchQuery;
  }

  static buildMatchAllQuery(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    searchQueryPb: MatchAllQueryPb,
  ): MatchAllSearchQuery {
    return SearchQuery.matchAll();
  }

  static buildMatchNoneQuery(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    searchQueryPb: MatchNoneQueryPb,
  ): MatchNoneSearchQuery {
    return SearchQuery.matchNone();
  }

  static buildSearchQuery(searchQueryPb: SearchQueryPb): SearchQuery {
    if (searchQueryPb.hasMatch()) {
      return SdkSearchQueryBuilder.buildMatchQuery(
        searchQueryPb.getMatch() as MatchQueryPb,
      );
    } else if (searchQueryPb.hasMatchPhrase()) {
      return SdkSearchQueryBuilder.buildMatchPhraseQuery(
        searchQueryPb.getMatchPhrase() as MatchPhraseQueryPb,
      );
    } else if (searchQueryPb.hasRegexp()) {
      return SdkSearchQueryBuilder.buildRegexQuery(
        searchQueryPb.getRegexp() as RegexpQueryPb,
      );
    } else if (searchQueryPb.hasQueryString()) {
      return SdkSearchQueryBuilder.buildQueryStringQuery(
        searchQueryPb.getQueryString() as QueryStringQueryPb,
      );
    } else if (searchQueryPb.hasWildcard()) {
      return SdkSearchQueryBuilder.buildWildcardQuery(
        searchQueryPb.getWildcard() as WildcardQueryPb,
      );
    } else if (searchQueryPb.hasDocId()) {
      return SdkSearchQueryBuilder.buildDocIdQuery(
        searchQueryPb.getDocId() as DocIdQueryPb,
      );
    } else if (searchQueryPb.hasSearchBooleanField()) {
      return SdkSearchQueryBuilder.buildBooleanFieldQuery(
        searchQueryPb.getSearchBooleanField() as BooleanFieldQueryPb,
      );
    } else if (searchQueryPb.hasDateRange()) {
      return SdkSearchQueryBuilder.buildDateRangeQuery(
        searchQueryPb.getDateRange() as DateRangeQueryPb,
      );
    } else if (searchQueryPb.hasNumericRange()) {
      return SdkSearchQueryBuilder.buildNumericRangeQuery(
        searchQueryPb.getNumericRange() as NumericRangeQueryPb,
      );
    }
    // [if:4.6.0]
    else if (searchQueryPb.hasTermRange()) {
      return SdkSearchQueryBuilder.buildTermRangeQuery(
        searchQueryPb.getTermRange() as TermRangeQueryPb,
      );
    }
    // [end]
    else if (searchQueryPb.hasGeoDistance()) {
      return SdkSearchQueryBuilder.buildGeoDistanceQuery(
        searchQueryPb.getGeoDistance() as GeoDistanceQueryPb,
      );
    } else if (searchQueryPb.hasGeoBoundingBox()) {
      return SdkSearchQueryBuilder.buildGeoBoundingBoxQuery(
        searchQueryPb.getGeoBoundingBox() as GeoBoundingBoxQueryPb,
      );
    } else if (searchQueryPb.hasConjunction()) {
      return SdkSearchQueryBuilder.buildConjunctionQuery(
        searchQueryPb.getConjunction() as ConjunctionQueryPb,
      );
    } else if (searchQueryPb.hasDisjunction()) {
      return SdkSearchQueryBuilder.buildDisjunctionQuery(
        searchQueryPb.getDisjunction() as DisjunctionQueryPb,
      );
    } else if (searchQueryPb.hasBoolean()) {
      return SdkSearchQueryBuilder.buildBooleanQuery(
        searchQueryPb.getBoolean() as BooleanQueryPb,
      );
    } else if (searchQueryPb.hasTerm()) {
      return SdkSearchQueryBuilder.buildTermQuery(
        searchQueryPb.getTerm() as TermQueryPb,
      );
    } else if (searchQueryPb.hasPrefix()) {
      return SdkSearchQueryBuilder.buildPrefixQuery(
        searchQueryPb.getPrefix() as PrefixQueryPb,
      );
    } else if (searchQueryPb.hasPhrase()) {
      return SdkSearchQueryBuilder.buildPhraseQuery(
        searchQueryPb.getPhrase() as PhraseQueryPb,
      );
    } else if (searchQueryPb.hasMatchAll()) {
      return SdkSearchQueryBuilder.buildMatchAllQuery(
        searchQueryPb.getMatchAll() as MatchAllQueryPb,
      );
    } else if (searchQueryPb.hasMatchNone()) {
      return SdkSearchQueryBuilder.buildMatchNoneQuery(
        searchQueryPb.getMatchNone() as MatchNoneQueryPb,
      );
    } else {
      throw new Error("Invalid search query type.");
    }
  }
}

// Need to pop-out from SdkSearchRequestBuilder in order to avoid the nested versioned tags
class SdkSearchVectorQueryBuilder {
  // [if:4.3.2]
  static buildVectorQuery(query: VectorQueryPb): VectorQuery {
    let vector: number[] | string = query.getVectorQueryList();
    if (query.hasBase64VectorQuery()) {
      vector = query.getBase64VectorQuery() as string;
    }
    return new VectorQuery(query.getVectorFieldName(), vector);
  }
  // [end]
  // [if:4.2.10&&<4.3.2]
  //? static buildVectorQuery(query: VectorQueryPb): VectorQuery {
  //?   return  new VectorQuery(query.getVectorFieldName(), query.getVectorQueryList());
  //? }
  // [end]
}

// [if:4.2.10]
class SdkSearchRequestBuilder {
  static buildSearchRequest(req: SearchRequestPb): SearchRequest {
    let searchQuery: SearchQuery | undefined;
    let vectorSearch: VectorSearch | undefined;
    if (req.hasSearchQuery()) {
      searchQuery = SdkSearchQueryBuilder.buildSearchQuery(
        req.getSearchQuery() as SearchQueryPb,
      );
    }
    if (req.hasVectorSearch()) {
      const vSearch = req.getVectorSearch() as VectorSearchPb;
      const queries = [];
      for (const vQuery of vSearch.getVectorQueryList()) {
        queries.push(SdkSearchRequestBuilder.buildVectorQuery(vQuery));
      }
      let opts: VectorSearchOptions | undefined;
      if (vSearch.hasOptions()) {
        opts = SdkCommandSearchOptions.toSdkVectorSearchOptions(
          vSearch.getOptions(),
        );
      }
      vectorSearch = new VectorSearch(queries, opts);
    }

    let request: SearchRequest | undefined;
    if (searchQuery) {
      request = new SearchRequest(searchQuery);
    }
    if (vectorSearch) {
      if (request) {
        request.withVectorSearch(vectorSearch);
      } else {
        request = new SearchRequest(vectorSearch);
      }
    }
    if (!request) {
      throw new Error("Unable to build SearchRequest.");
    }
    return request;
  }

  static addVectorQueryOptions(
    queryPb: VectorQueryPb,
    query: VectorQuery,
  ): VectorQuery {
    if (queryPb.hasOptions()) {
      const queryOpts = queryPb.getOptions() as VectorQueryOptionsPb;
      if (queryOpts.hasBoost()) {
        query.boost(queryOpts.getBoost() as number);
      }
      if (queryOpts.hasNumCandidates()) {
        query.numCandidates(queryOpts.getNumCandidates() as number);
      }
      // [if:4.6.0]
      if (queryOpts.hasPrefilter()) {
        query.prefilter(
          SdkSearchQueryBuilder.buildSearchQuery(
            queryOpts.getPrefilter() as SearchQueryPb,
          ),
        );
      }
      // [end]
    }
    return query;
  }

  static buildVectorQuery(query: VectorQueryPb): VectorQuery {
    const vQuery = SdkSearchVectorQueryBuilder.buildVectorQuery(query);
    return SdkSearchRequestBuilder.addVectorQueryOptions(query, vQuery);
  }
}
// [end]

export class SdkSearchCommand implements ISdkCommand {
  private _connection: Cluster | Scope;
  private _indexName: string;
  private _searchQuery: SearchQuery | undefined;
  // [if:4.2.10]
  private _searchRequest: SearchRequest | undefined;
  // [end]
  private _initiated: Timestamp;
  private _streamConfig: StreamConfig;
  private _options: SearchQueryOptions = {};
  private _contentAs: ContentAsPb | undefined;

  constructor(
    connection: Cluster | Scope,
    searchQuery: SearchQueryType,
    indexName: string,
    streamConfig: StreamConfig,
    initiated: Timestamp,
  ) {
    this._connection = connection;
    if (searchQuery instanceof SearchQuery) {
      this._searchQuery = searchQuery;
    }
    // [if:4.2.10]
    else {
      this._searchRequest = searchQuery;
    }
    // [end]
    this._indexName = indexName;
    this._streamConfig = streamConfig;
    this._initiated = initiated;
  }

  setStreamEvents(
    streamablePromise: StreamableRowPromise<
      SearchResult,
      SearchRow,
      SearchMetaData
    >,
    streamResult: StreamResult,
  ) {
    streamablePromise
      .on("row", (row: SearchRow) => {
        const sdkCommandResult = new SdkCommandResultPb();
        sdkCommandResult.setSearchStreamingResult(
          SdkSearchCommandResult.toSearchRowStreamingResult(
            row,
            streamResult.streamId,
            this._contentAs,
          ),
        );
        streamResult.newItem(
          SdkCommandResult.getTopLevelResult(this._initiated, sdkCommandResult),
        );
      })
      .on("meta", (metadata: any) => {
        if (metadata.facets && metadata.facets.length > 0) {
          const sdkCommandFacetResult = new SdkCommandResultPb();
          sdkCommandFacetResult.setSearchStreamingResult(
            SdkSearchCommandResult.toSearchFacetsStreamingResult(
              metadata.facets,
              streamResult.streamId,
            ),
          );
          streamResult.newItem(
            SdkCommandResult.getTopLevelResult(
              this._initiated,
              sdkCommandFacetResult,
            ),
          );
        }
        const sdkCommandResult = new SdkCommandResultPb();
        sdkCommandResult.setSearchStreamingResult(
          SdkSearchCommandResult.toSearchMetadataStreamingResult(
            metadata,
            streamResult.streamId,
          ),
        );
        streamResult.newItem(
          SdkCommandResult.getTopLevelResult(this._initiated, sdkCommandResult),
        );
      })
      .on("end", () => {
        streamResult.streamFinished();
      })
      .on("error", (err) => {
        streamResult.streamError(SdkError.toExceptionPb(err));
      });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async executeCommand(streamResult: StreamResult): Promise<void | ResultPb> {
    // [if:4.2.10]
    let useSearchV2 = false;
    if (this._searchRequest) {
      useSearchV2 = true;
    }
    // [end]

    let searchResult: SearchResult | undefined;
    // [if:4.2.11]
    if (useSearchV2 && this._connection instanceof Scope) {
      searchResult = await this._connection.search(
        this._indexName,
        this._searchRequest as SearchRequest,
        this._options,
      );
      // TODO:  allow true streaming once supported by C++ client
      // this.setStreamEvents(searchQuery, streamResult);
      // return;
    }
    // [end]
    // [if:4.2.10]
    if (useSearchV2 && this._connection instanceof Cluster) {
      searchResult = await this._connection.search(
        this._indexName,
        this._searchRequest as SearchRequest,
        this._options,
      );
      // TODO:  allow true streaming once supported by C++ client
      // this.setStreamEvents(searchQuery, streamResult);
      // return;
    }
    // [end]

    // searchQuery() is limited to the cluster level
    if (this._searchQuery && !(this._connection instanceof Scope)) {
      searchResult = await this._connection.searchQuery(
        this._indexName,
        this._searchQuery,
        this._options,
      );
      // TODO:  allow true streaming once supported by C++ client
      // this.setStreamEvents(searchQuery, streamResult);
      // return;
    }

    if (!searchResult) {
      throw new Error("Unable to execute search command.");
    }

    const sdkCommandResult = new SdkCommandResultPb();
    sdkCommandResult.setSuccess(searchResult instanceof SearchResult);
    sdkCommandResult.setSearchBlockingResult(
      SdkSearchCommandResult.toBlockingSearchResult(
        searchResult,
        this._contentAs as ContentAsPb,
      ),
    );

    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
    );
  }

  hasStreamConfig(): boolean {
    return true;
  }

  getStreamConfig(): StreamConfig {
    return this._streamConfig;
  }

  setSdkCommandOptions(options: SearchQueryOptions) {
    this._options = options;
  }

  setSdkCommandContentAs(contentAs: ContentAsPb) {
    this._contentAs = contentAs;
  }

  static buildCommand(
    cmd: ClusterLevelCommandPb,
    connection: Cluster,
    initiated: Timestamp,
    spanOwner?: ISpanOwner,
  ): SdkSearchCommand {
    const command = cmd.getSearch() as SearchPb;
    const searchQuery = SdkSearchQueryBuilder.buildSearchQuery(
      command.getQuery() as SearchQueryPb,
    );
    const streamConfigPb = command.getStreamConfig() as StreamConfigPb;
    const sdkCommand = new SdkSearchCommand(
      connection,
      searchQuery,
      command.getIndexname(),
      {
        streamId: streamConfigPb.getStreamId(),
        onDemand: streamConfigPb.hasOnDemand(),
        streamType: StreamTypePb.STREAM_FULL_TEXT_SEARCH,
      },
      initiated,
    );
    sdkCommand.setSdkCommandOptions(
      maybeAddParentSpan(
        SdkCommandSearchOptions.toSdkSearchQueryOptions(command.getOptions()),
        command.getOptions(),
        spanOwner,
      ),
    );
    if (command.hasFieldsAs()) {
      sdkCommand.setSdkCommandContentAs(command.getFieldsAs() as ContentAsPb);
    }
    return sdkCommand;
  }

  // [if:4.2.10]
  static buildCommandV2(
    cmd: ClusterLevelCommandPb | ScopeLevelCommandPb,
    connection: Cluster,
    initiated: Timestamp,
    spanOwner?: ISpanOwner,
  ): SdkSearchCommand {
    const command = cmd.getSearchV2() as SearchWrapperPb;
    const search = command.getSearch() as SearchV2Pb;
    const searchRequest = SdkSearchRequestBuilder.buildSearchRequest(
      search.getRequest() as SearchRequestPb,
    );
    const streamConfigPb = command.getStreamConfig() as StreamConfigPb;
    let sdkCommand: SdkSearchCommand | undefined;
    if (cmd instanceof ScopeLevelCommandPb) {
      const scopeDetails = cmd.getScope() as ScopePb;
      const scope = connection
        .bucket(scopeDetails.getBucketName())
        .scope(scopeDetails.getScopeName());
      sdkCommand = new SdkSearchCommand(
        scope,
        searchRequest,
        search.getIndexname(),
        {
          streamId: streamConfigPb.getStreamId(),
          onDemand: streamConfigPb.hasOnDemand(),
          streamType: StreamTypePb.STREAM_FULL_TEXT_SEARCH,
        },
        initiated,
      );
    } else {
      sdkCommand = new SdkSearchCommand(
        connection,
        searchRequest,
        search.getIndexname(),
        {
          streamId: streamConfigPb.getStreamId(),
          onDemand: streamConfigPb.hasOnDemand(),
          streamType: StreamTypePb.STREAM_FULL_TEXT_SEARCH,
        },
        initiated,
      );
    }

    sdkCommand.setSdkCommandOptions(
      maybeAddParentSpan(
        SdkCommandSearchOptions.toSdkSearchQueryOptions(search.getOptions()),
        search.getOptions(),
        spanOwner,
      ),
    );
    if (command.hasFieldsAs()) {
      sdkCommand.setSdkCommandContentAs(command.getFieldsAs() as ContentAsPb);
    }
    return sdkCommand;
  }
  // [end]
}
