import {
  BucketSettings as BucketSettingsPb,
  BucketType as BucketTypePb,
  CompressionMode as CompressionModePb,
  EvictionPolicyType as EvictionPolicyTypePb,
  GetAllBucketsResult as GetAllBucketsResultPb,
  Result as BucketMgmtResultPb,
  StorageBackend as StorageBackendPb,
} from "../../proto/sdk.cluster.bucket_manager_pb";

import {
  BucketSettings,
  BucketType,
  CompressionMode,
  EvictionPolicy,
  StorageBackend,
} from "couchbase";

import { SdkUtils } from "../utils";
import { NotImplementedError } from "../error";

export class SdkBucketMgmtCommandResult {
  static toBucketSettings(settings: BucketSettings): BucketSettingsPb {
    const bucketSettings = new BucketSettingsPb();
    bucketSettings.setName(settings.name);
    bucketSettings.setRamQuotaMb(settings.ramQuotaMB);
    if (typeof settings.flushEnabled !== "undefined") {
      bucketSettings.setFlushEnabled(settings.flushEnabled);
    }
    if (typeof settings.numReplicas !== "undefined") {
      bucketSettings.setNumReplicas(settings.numReplicas);
    }
    if (typeof settings.replicaIndexes !== "undefined") {
      bucketSettings.setReplicaIndexes(settings.replicaIndexes);
    }
    if (typeof settings.bucketType !== "undefined") {
      if (settings.bucketType === BucketType.Couchbase) {
        bucketSettings.setBucketType(BucketTypePb.COUCHBASE);
      } else if (settings.bucketType === BucketType.Memcached) {
        bucketSettings.setBucketType(BucketTypePb.MEMCACHED);
      } else if (settings.bucketType === BucketType.Ephemeral) {
        bucketSettings.setBucketType(BucketTypePb.EPHEMERAL);
      } else {
        throw new NotImplementedError(
          "Unimplemented bucket type returned from SDK",
        );
      }
    }
    if (typeof settings.evictionPolicy !== "undefined") {
      if (settings.evictionPolicy === EvictionPolicy.NoEviction) {
        bucketSettings.setEvictionPolicy(EvictionPolicyTypePb.NO_EVICTION);
      } else if (settings.evictionPolicy === EvictionPolicy.FullEviction) {
        bucketSettings.setEvictionPolicy(EvictionPolicyTypePb.FULL);
      } else if (settings.evictionPolicy === EvictionPolicy.ValueOnly) {
        bucketSettings.setEvictionPolicy(EvictionPolicyTypePb.VALUE_ONLY);
      } else if (settings.evictionPolicy === EvictionPolicy.NotRecentlyUsed) {
        bucketSettings.setEvictionPolicy(
          EvictionPolicyTypePb.NOT_RECENTLY_USED,
        );
      } else {
        throw new NotImplementedError(
          "Unknown eviction policy returned from SDK",
        );
      }
    }
    if (typeof settings.maxExpiry !== "undefined") {
      bucketSettings.setMaxExpirySeconds(settings.maxExpiry);
    }
    if (typeof settings.compressionMode !== "undefined") {
      if (settings.compressionMode === CompressionMode.Off) {
        bucketSettings.setCompressionMode(CompressionModePb.OFF);
      } else if (settings.compressionMode === CompressionMode.Active) {
        bucketSettings.setCompressionMode(CompressionModePb.ACTIVE);
      } else if (settings.compressionMode === CompressionMode.Passive) {
        bucketSettings.setCompressionMode(CompressionModePb.PASSIVE);
      } else {
        throw new NotImplementedError(
          "Unknown compression mode returned from SDK",
        );
      }
    }
    if (typeof settings.minimumDurabilityLevel !== "undefined") {
      bucketSettings.setMinimumDurabilityLevel(
        SdkUtils.toDurabilityLevelPb(settings.minimumDurabilityLevel),
      );
    }
    if (typeof settings.storageBackend !== "undefined") {
      if (settings.storageBackend === StorageBackend.Magma) {
        bucketSettings.setStorageBackend(StorageBackendPb.MAGMA);
      } else if (settings.storageBackend === StorageBackend.Couchstore) {
        bucketSettings.setStorageBackend(StorageBackendPb.COUCHSTORE);
      } else {
        throw new NotImplementedError(
          "Unknown storage backend returned from SDK",
        );
      }
    }
    // [if:4.2.7]
    if (typeof settings.historyRetentionCollectionDefault !== "undefined") {
      bucketSettings.setHistoryRetentionCollectionDefault(
        settings.historyRetentionCollectionDefault,
      );
    }
    if (typeof settings.historyRetentionBytes !== "undefined") {
      bucketSettings.setHistoryRetentionBytes(settings.historyRetentionBytes);
    }
    if (typeof settings.historyRetentionDuration !== "undefined") {
      bucketSettings.setHistoryRetentionSeconds(
        settings.historyRetentionDuration,
      );
    }
    // [end]
    // [if:4.6.0]
    if (typeof settings.numVBuckets !== "undefined") {
      bucketSettings.setNumVbuckets(settings.numVBuckets);
    }
    // [end]
    return bucketSettings;
  }

  static toGetBucketMgmtResult(
    bucketSettings: BucketSettings,
  ): BucketMgmtResultPb {
    const bucketMgmtResult = new BucketMgmtResultPb();
    bucketMgmtResult.setBucketSettings(
      SdkBucketMgmtCommandResult.toBucketSettings(bucketSettings),
    );
    return bucketMgmtResult;
  }

  static toGetAllBucketsMgmtResult(
    buckets: BucketSettings[],
  ): BucketMgmtResultPb {
    const bucketMgmtResult = new BucketMgmtResultPb();
    const getAllBucketsResult = new GetAllBucketsResultPb();
    buckets.forEach((bucket) => {
      const bucketPb = SdkBucketMgmtCommandResult.toBucketSettings(bucket);
      getAllBucketsResult.getResultMap().set(bucket.name, bucketPb);
    });
    bucketMgmtResult.setGetAllBucketsResult(getAllBucketsResult);
    return bucketMgmtResult;
  }
}
