import {
  QueryIndex as QueryIndexPb,
  QueryIndexes as QueryIndexesPb,
  QueryIndexType as QueryIndexTypePb,
} from "../../proto/sdk.query.index_manager_pb";

import { QueryIndex } from "couchbase";

import { NotImplementedError } from "../error";

export class SdkQueryIndexMgmtCommandResult {
  static toQueryIndex(index: QueryIndex): QueryIndexPb {
    const queryIndex = new QueryIndexPb();
    queryIndex.setName(index.name);
    queryIndex.setIsPrimary(index.isPrimary);
    switch (index.type.toLowerCase()) {
      case "gsi":
        queryIndex.setType(QueryIndexTypePb.GSI);
        break;
      case "view":
        queryIndex.setType(QueryIndexTypePb.VIEW);
        break;
      default:
        throw new NotImplementedError(
          `Unknown query index type returned from server: ${index.type}`,
        );
    }
    queryIndex.setState(index.state);
    // queryIndex.setKeyspace(index.keySpace) Node does not have keyspace in its queryIndex
    queryIndex.setIndexKeyList(index.indexKey);
    if (index.condition) {
      queryIndex.setCondition(index.condition);
    }
    if (index.partition) {
      queryIndex.setPartition(index.partition);
    }
    if (index.bucketName) {
      queryIndex.setBucketName(index.bucketName);
    }
    if (index.scopeName) {
      queryIndex.setScopeName(index.scopeName);
    }
    if (index.collectionName) {
      queryIndex.setCollectionName(index.collectionName);
    }
    return queryIndex;
  }

  static toQueryIndexMgmtResultWithIndexes(
    indexes: QueryIndex[],
  ): QueryIndexesPb {
    const queryIndexArr: QueryIndexPb[] = [];
    for (const index of indexes) {
      queryIndexArr.push(SdkQueryIndexMgmtCommandResult.toQueryIndex(index));
    }
    const queryIndexes = new QueryIndexesPb();
    queryIndexes.setIndexesList(queryIndexArr);
    return queryIndexes;
  }
}
