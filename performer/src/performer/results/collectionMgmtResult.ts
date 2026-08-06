import {
  CollectionSpec as CollectionSpecPb,
  GetAllScopesResult as GetAllScopesResultPb,
  Result as CollectionManagerResultPb,
  ScopeSpec as ScopeSpecPb,
} from "../../proto/sdk.bucket.collection_manager_pb";
import { CollectionSpec, ScopeSpec } from "couchbase";

export class SdkCollectionMgmtCommandResult {
  static toCollectionSpecs(collections: CollectionSpec[]): CollectionSpecPb[] {
    const collectionsPb: CollectionSpecPb[] = [];

    collections.forEach((collection) => {
      const collectionPb = new CollectionSpecPb();
      collectionPb.setName(collection.name);
      collectionPb.setScopeName(collection.scopeName);
      if (typeof collection.maxExpiry !== "undefined") {
        collectionPb.setExpirySecs(collection.maxExpiry);
      }
      // [if:4.2.7]
      if (typeof collection.history !== "undefined") {
        collectionPb.setHistory(collection.history);
      }
      // [end]
      collectionsPb.push(collectionPb);
    });
    return collectionsPb;
  }

  static toGetAllScopesMgmtResult(
    scopes: ScopeSpec[],
  ): CollectionManagerResultPb {
    const collectionMgmtResult = new CollectionManagerResultPb();
    const getAllScopesResult = new GetAllScopesResultPb();
    const scopeList: ScopeSpecPb[] = [];
    scopes.forEach((spec) => {
      const specPb = new ScopeSpecPb();
      specPb.setName(spec.name);
      specPb.setCollectionsList(
        SdkCollectionMgmtCommandResult.toCollectionSpecs(spec.collections),
      );
      scopeList.push(specPb);
    });
    getAllScopesResult.setResultList(scopeList);
    collectionMgmtResult.setGetAllScopesResult(getAllScopesResult);
    return collectionMgmtResult;
  }
}
