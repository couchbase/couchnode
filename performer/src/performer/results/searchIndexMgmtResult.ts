import {
  SearchIndex as SearchIndexPb,
  SearchIndexes as SearchIndexesPb,
  Result as SearchIndexMgmtResultPb,
} from "../../proto/sdk.search.index_manager_pb";

export class SdkSearchIndexMgmtCommandResult {
  static toSearchIndex(index: any): SearchIndexPb {
    const searchIndex = new SearchIndexPb();
    searchIndex.setName(index.name);
    searchIndex.setUuid(index.uuid);
    searchIndex.setType(index.type);
    searchIndex.setSourceType(index.sourceType);
    searchIndex.setSourceUuid(index.sourceUuid);
    const encoder = new TextEncoder();
    searchIndex.setParams(encoder.encode(JSON.stringify(index.params)));
    searchIndex.setSourceParams(
      encoder.encode(JSON.stringify(index.sourceParams)),
    );
    searchIndex.setPlanParams(encoder.encode(JSON.stringify(index.planParams)));
    return searchIndex;
  }

  // TODO:  can probably remove this method...
  static toSearchIndexMgmtResult(success: boolean): SearchIndexMgmtResultPb {
    const result = new SearchIndexMgmtResultPb();
    result.setSuccess(success);
    return result;
  }

  static toSearchIndexMgmtResultWithIndex(index: any): SearchIndexMgmtResultPb {
    const result = new SearchIndexMgmtResultPb();
    result.setIndex(SdkSearchIndexMgmtCommandResult.toSearchIndex(index));
    return result;
  }

  static toSearchIndexMgmtResultWithIndexes(
    indexes: any[],
  ): SearchIndexMgmtResultPb {
    const result = new SearchIndexMgmtResultPb();
    const searchIndexes: SearchIndexPb[] = [];
    for (const idx of indexes) {
      searchIndexes.push(SdkSearchIndexMgmtCommandResult.toSearchIndex(idx));
    }
    result.setIndexes(new SearchIndexesPb().setIndexesList(searchIndexes));
    return result;
  }

  static toSearchIndexMgmtResultWithDocCount(
    docCount: number,
  ): SearchIndexMgmtResultPb {
    const result = new SearchIndexMgmtResultPb();
    result.setIndexedDocumentCounts(docCount);
    return result;
  }
}
