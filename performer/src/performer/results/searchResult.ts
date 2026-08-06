import {
  BlockingSearchResult as BlockingSearchResultPb,
  StreamingSearchResult as StreamingSearchResultPb,
  SearchRow as SearchRowPb,
  SearchRowLocation as SearchRowLocationPb,
  SearchFacetResult as SearchFacetResultPb,
  SearchFacets as SearchFacetsPb,
  SearchFragments as SearchFragmentsPb,
  SearchMetaData as SearchMetaDataPb,
  SearchMetrics as SearchMetricsPb,
} from "../../proto/sdk.search_pb";
import { ContentAs } from "../../proto/shared.content_pb";

import { SearchResult } from "couchbase";

import { SdkUtils } from "../utils";

export class SdkSearchCommandResult {
  static toBlockingSearchResult(
    result: SearchResult,
    contentAs?: ContentAs,
  ): BlockingSearchResultPb {
    const searchResultPb = new BlockingSearchResultPb();

    const rows = result.rows.map((row) => {
      return SdkSearchCommandResult.toSearchRowPb(row, contentAs);
    });
    searchResultPb.setRowsList(rows);

    const metadata = result.meta as any;

    if (metadata.facets && metadata.facets.length > 0) {
      const searchFacets = SdkSearchCommandResult.toSearchFacetsPb(
        metadata.facets,
      );
      searchResultPb.setFacets(searchFacets);
    }
    const searchMetadata = SdkSearchCommandResult.toSearchMetadataPb(metadata);
    searchResultPb.setMetaData(searchMetadata);

    return searchResultPb;
  }

  static toSearchFacetsPb(facets: any): SearchFacetsPb {
    const searchFacets = new SearchFacetsPb();
    for (const facet of facets) {
      const facetName = facet.name;
      const facetPb = new SearchFacetResultPb();
      facetPb.setName(facetName);
      facetPb.setField(facet.field);
      facetPb.setTotal(facet.total);
      facetPb.setMissing(facet.missing);
      facetPb.setOther(facet.other);
      searchFacets.getFacetsMap().set(facetName, facetPb);
    }
    return searchFacets;
  }

  static toSearchFacetsStreamingResult(
    facets: any,
    streamId: string,
  ): StreamingSearchResultPb {
    const searchFacets = SdkSearchCommandResult.toSearchFacetsPb(facets);
    const searchResult = new StreamingSearchResultPb();
    searchResult.setStreamId(streamId);
    searchResult.setFacets(searchFacets);
    return searchResult;
  }

  static toSearchMetadataPb(metadata: any): SearchMetaDataPb {
    const searchMetadata = new SearchMetaDataPb();
    if (metadata.errors && Object.keys(metadata.errors).length > 0) {
      for (const [k, v] of Object.entries(metadata.errors)) {
        searchMetadata.getErrorsMap().set(k, v as string);
      }
    }
    const metrics = metadata.metrics;
    const searchMetrics = new SearchMetricsPb();
    //metrics.took in microseconds
    searchMetrics.setTookMsec(metrics.took * 1000);
    searchMetrics.setTotalRows(metrics.total_rows);
    searchMetrics.setMaxScore(metrics.max_score);
    // TODO:  C++ does not provide total_partition_count, is this correct?
    const totalPartitionCount =
      metrics.success_partition_count + metrics.error_partition_count;
    searchMetrics.setTotalPartitionCount(totalPartitionCount);
    searchMetrics.setSuccessPartitionCount(metrics.success_partition_count);
    searchMetrics.setErrorPartitionCount(metrics.error_partition_count);
    searchMetadata.setMetrics(searchMetrics);
    return searchMetadata;
  }

  static toSearchMetadataStreamingResult(
    metadata: any,
    streamId: string,
  ): StreamingSearchResultPb {
    const searchMetadata = SdkSearchCommandResult.toSearchMetadataPb(metadata);
    const searchResult = new StreamingSearchResultPb();
    searchResult.setStreamId(streamId);
    searchResult.setMetaData(searchMetadata);
    return searchResult;
  }

  static toSearchRowPb(row: any, contentAs?: ContentAs): SearchRowPb {
    const searchRow = new SearchRowPb();
    searchRow.setId(row.id);
    searchRow.setIndex(row.index);
    searchRow.setScore(row.score);
    if (row.locations && row.locations.length > 0) {
      const locations: SearchRowLocationPb[] = [];
      for (const loc of row.locations) {
        const locPb = new SearchRowLocationPb();
        locPb.setField(loc.field);
        locPb.setTerm(loc.term);
        locPb.setPosition(loc.position);
        locPb.setStart(loc.start_offset);
        locPb.setEnd(loc.end_offset);
        if (loc.array_positions && loc.array_positions.length > 0) {
          locPb.setArrayPositionsList(loc.array_positions);
        }
        locations.push(locPb);
      }
      searchRow.setLocationsList(locations);
    }
    if (row.fragments && Object.keys(row.fragments).length > 0) {
      for (const [k, v] of Object.entries(row.fragments)) {
        const searchFragments = new SearchFragmentsPb();
        searchFragments.setFragmentsList(v as string[]);
        searchRow.getFragmentsMap().set(k, searchFragments);
      }
    }
    if (contentAs) {
      const encodedContent = SdkUtils.getContentTypes(contentAs, row.fields);
      searchRow.setFields(encodedContent);
    }
    return searchRow;
  }

  static toSearchRowStreamingResult(
    row: any,
    streamId: string,
    contentAs?: ContentAs,
  ): StreamingSearchResultPb {
    const searchRow = SdkSearchCommandResult.toSearchRowPb(row, contentAs);
    const searchResult = new StreamingSearchResultPb();
    searchResult.setStreamId(streamId);
    searchResult.setRow(searchRow);
    return searchResult;
  }
}
