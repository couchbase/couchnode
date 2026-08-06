import {
  Highlight as HighlightPb,
  HighlightStyle as HighlightStylePb,
  SearchOptions as SearchOptionsPb,
  SearchScanConsistency as SearchScanConsistencyPb,
  SearchSort as SearchSortPb,
  SearchSortField as SearchSortFieldPb,
  SearchSortGeoDistance as SearchSortGeoDistancePb,
  SearchSortId as SearchSortIdPb,
  SearchSortScore as SearchSortScorePb,
  Location as LocationPb,
  SearchGeoDistanceUnits as SearchGeoDistanceUnitsPb,
  SearchFacet as SearchFacetPb,
  DateRangeFacet as DateRangeFacetPb,
  NumericRangeFacet as NumericRangeFacetPb,
  TermFacet as TermFacetPb,
  // [if:4.2.10]
  VectorSearchOptions as VectorSearchOptionsPb,
  VectorQueryCombination as VectorQueryCombinationPb,
  // [end]
} from "../../proto/sdk.search_pb";
import { MutationState as MutationStatePb } from "../../proto/shared.basic_pb";

import {
  SearchQueryOptions,
  SearchScanConsistency,
  HighlightStyle,
  SearchSort,
  SearchFacet,
  // [if:4.2.10]
  VectorSearchOptions,
  VectorQueryCombination,
  // [end]
} from "couchbase";

import { SdkUtils } from "../utils";

export class SdkCommandSearchOptions {
  //TODO:  Node.js SDK should have size: number | undefined
  static toSdkSearchFacet(facetPb: SearchFacetPb): SearchFacet | undefined {
    if (facetPb.hasDateRange()) {
      const dateRangeFacetPb = facetPb.getDateRange() as DateRangeFacetPb;
      // TODO: fix in Node.js SDK
      const facet = SearchFacet.date(
        dateRangeFacetPb.getField(),
        dateRangeFacetPb.getSize() ?? 0,
      );
      for (const dateRange of dateRangeFacetPb.getDateRangesList()) {
        const name = dateRange.getName();
        facet.addRange(
          name,
          dateRange.getStart()?.toDate(),
          dateRange.getEnd()?.toDate(),
        );
      }
      return facet;
    } else if (facetPb.hasNumericRange()) {
      const numRangeFacetPb = facetPb.getNumericRange() as NumericRangeFacetPb;
      // TODO: fix in Node.js SDK
      const facet = SearchFacet.numeric(
        numRangeFacetPb.getField(),
        numRangeFacetPb.getSize() ?? 0,
      );
      for (const numRange of numRangeFacetPb.getNumericRangesList()) {
        const name = numRange.getName();
        facet.addRange(name, numRange.getMin(), numRange.getMax());
      }
      return facet;
    } else if (facetPb.hasTerm()) {
      const termFacetPb = facetPb.getTerm() as TermFacetPb;
      // TODO: fix in Node.js SDK
      return SearchFacet.term(
        termFacetPb.getField(),
        termFacetPb.getSize() ?? 0,
      );
    }
  }

  static toSdkSearchSortList(
    sortList: SearchSortPb[],
  ): string[] | SearchSort[] {
    if (sortList.every((s) => s.hasRaw())) {
      return sortList.map((s) => s.getRaw());
    }
    const output: SearchSort[] = [];
    for (const sort of sortList) {
      if (sort.hasField()) {
        const fieldSortPb = sort.getField() as SearchSortFieldPb;
        const fieldSort = SearchSort.field(fieldSortPb.getField());
        if (fieldSortPb.hasDesc()) {
          fieldSort.descending(fieldSortPb.getDesc() as boolean);
        }
        //TODO:  Node.js SDK should use string for missing
        if (fieldSortPb.hasMissing()) {
          fieldSort.missing((fieldSortPb.getMissing() as string) == "first");
        }
        if (fieldSortPb.hasMode()) {
          fieldSort.mode(fieldSortPb.getMode() as string);
        }
        if (fieldSortPb.hasType()) {
          fieldSort.type(fieldSortPb.getType() as string);
        }
        output.push(fieldSort);
      } else if (sort.hasGeoDistance()) {
        const geoSortPb = sort.getGeoDistance() as SearchSortGeoDistancePb;
        const locPb = geoSortPb.getLocation() as LocationPb;
        const geoSort = SearchSort.geoDistance(
          geoSortPb.getField(),
          locPb.getLat(),
          locPb.getLon(),
        );
        if (geoSortPb.hasDesc()) {
          geoSort.descending(geoSortPb.getDesc() as boolean);
        }
        if (geoSortPb.hasUnit()) {
          if (
            geoSortPb.getUnit() ==
            SearchGeoDistanceUnitsPb.SEARCH_GEO_DISTANCE_UNITS_METERS
          ) {
            geoSort.unit("meters");
          } else if (
            geoSortPb.getUnit() ==
            SearchGeoDistanceUnitsPb.SEARCH_GEO_DISTANCE_UNITS_MILES
          ) {
            geoSort.unit("miles");
          } else if (
            geoSortPb.getUnit() ==
            SearchGeoDistanceUnitsPb.SEARCH_GEO_DISTANCE_UNITS_CENTIMETERS
          ) {
            geoSort.unit("centimeters");
          } else if (
            geoSortPb.getUnit() ==
            SearchGeoDistanceUnitsPb.SEARCH_GEO_DISTANCE_UNITS_MILLIMETERS
          ) {
            geoSort.unit("millimeters");
          } else if (
            geoSortPb.getUnit() ==
            SearchGeoDistanceUnitsPb.SEARCH_GEO_DISTANCE_UNITS_NAUTICAL_MILES
          ) {
            geoSort.unit("nauticalmiles");
          } else if (
            geoSortPb.getUnit() ==
            SearchGeoDistanceUnitsPb.SEARCH_GEO_DISTANCE_UNITS_KILOMETERS
          ) {
            geoSort.unit("kilometers");
          } else if (
            geoSortPb.getUnit() ==
            SearchGeoDistanceUnitsPb.SEARCH_GEO_DISTANCE_UNITS_FEET
          ) {
            geoSort.unit("feet");
          } else if (
            geoSortPb.getUnit() ==
            SearchGeoDistanceUnitsPb.SEARCH_GEO_DISTANCE_UNITS_YARDS
          ) {
            geoSort.unit("yard");
          } else if (
            geoSortPb.getUnit() ==
            SearchGeoDistanceUnitsPb.SEARCH_GEO_DISTANCE_UNITS_INCHES
          ) {
            geoSort.unit("inch");
          }
        }
        output.push(geoSort);
      } else if (sort.hasId()) {
        const idSortPb = sort.getId() as SearchSortIdPb;
        const idSort = SearchSort.id();
        if (idSortPb.hasDesc()) {
          idSort.descending(idSortPb.getDesc() as boolean);
        }
        output.push(idSort);
      } else if (sort.hasScore()) {
        const scoreSortPb = sort.getScore() as SearchSortScorePb;
        const scoreSort = SearchSort.id();
        if (scoreSortPb.hasDesc()) {
          scoreSort.descending(scoreSortPb.getDesc() as boolean);
        }
        output.push(scoreSort);
      }
    }
    return output;
  }

  static toSdkSearchQueryOptions(
    options?: SearchOptionsPb,
  ): SearchQueryOptions {
    const opts: SearchQueryOptions = {};
    if (!options) return opts;

    if (options.hasLimit()) {
      opts.limit = options.getLimit();
    }

    if (options.hasSkip()) {
      opts.skip = options.getSkip();
    }

    if (options.hasExplain()) {
      opts.explain = options.getExplain();
    }

    if (options.hasHighlight()) {
      const highlight = options.getHighlight() as HighlightPb;
      opts.highlight = {};
      if (highlight.hasStyle()) {
        if (highlight.getStyle() == HighlightStylePb.HIGHLIGHT_STYLE_ANSI) {
          opts.highlight.style = HighlightStyle.ANSI;
        } else if (
          highlight.getStyle() == HighlightStylePb.HIGHLIGHT_STYLE_HTML
        ) {
          opts.highlight.style = HighlightStyle.HTML;
        }
      }
      if (highlight.getFieldsList().length > 0) {
        opts.highlight.fields = highlight.getFieldsList();
      }
    }

    if (options.getFieldsList().length > 0) {
      opts.fields = options.getFieldsList();
    }

    if (options.hasScanConsistency()) {
      if (
        options.getScanConsistency() ==
        SearchScanConsistencyPb.SEARCH_SCAN_CONSISTENCY_NOT_BOUNDED
      ) {
        opts.consistency = SearchScanConsistency.NotBounded;
      }
    }

    if (options.hasConsistentWith()) {
      opts.consistentWith = SdkUtils.convertConsistentWith(
        options.getConsistentWith() as MutationStatePb,
      );
    }

    if (options.getSortList().length > 0) {
      opts.sort = SdkCommandSearchOptions.toSdkSearchSortList(
        options.getSortList(),
      );
    }

    if (options.getFacetsMap().getLength() > 0) {
      const facets: { [key: string]: SearchFacet } = {};
      options.getFacetsMap().forEach((entry, key) => {
        const facet = SdkCommandSearchOptions.toSdkSearchFacet(entry);
        if (facet) {
          facets[key] = facet;
        }
      });
      if (Object.keys(facets).length > 0) {
        opts.facets = facets;
      }
    }

    if (options.hasTimeoutMillis()) {
      opts.timeout = options.getTimeoutMillis();
    }

    // TODO:  Node.js does not support atm
    // if (options.hasParentSpanId()) {
    // }

    if (options.getRawMap().getLength() > 0) {
      const raw: { [key: string]: any } = {};
      options.getRawMap().forEach((k, v) => {
        raw[k] = v;
      });
      opts.raw = raw;
    }

    if (options.hasIncludeLocations()) {
      opts.includeLocations = options.getIncludeLocations();
    }

    return opts;
  }

  // [if:4.2.10]
  static toSdkVectorSearchOptions(
    options?: VectorSearchOptionsPb,
  ): VectorSearchOptions {
    const opts: VectorSearchOptions = {};
    if (!options) return opts;

    if (options.hasVectorQueryCombination()) {
      if (options.getVectorQueryCombination() == VectorQueryCombinationPb.AND) {
        opts.vectorQueryCombination = VectorQueryCombination.AND;
      } else if (
        options.getVectorQueryCombination() == VectorQueryCombinationPb.OR
      ) {
        opts.vectorQueryCombination = VectorQueryCombination.OR;
      }
    }

    return opts;
  }
  // [end]
}
