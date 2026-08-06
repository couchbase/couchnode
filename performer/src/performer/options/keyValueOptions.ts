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
import {
  MutateInOptions as MutateInOptionsPb,
  StoreSemantics as StoreSemanticsPb,
} from "../../proto/sdk.kv.mutate_in_pb";
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
// [if:4.2.6]
import { ScanOptions as ScanOptionsPb } from "../../proto/sdk.kv.rangescan.top_level_pb";
// [end]
import {
  DurabilityType as DurabilityTypePb,
  // [if:4.2.6]
  MutationState as MutationStatePb,
  // [end]
  // [if:4.5.0]
  ReadPreference as ReadPreferencePb,
  // [end]
} from "../../proto/shared.basic_pb";
import { Transcoder as TranscoderPb } from "../../proto/shared.transcoders_pb";

import {
  AppendOptions,
  // [if:<4.3.1]
  //? Cas,
  // [end]
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
  RemoveOptions,
  ReplaceOptions,
  // [if:4.2.6]
  ScanOptions,
  // [end]
  StoreSemantics,
  TouchOptions,
  UnlockOptions,
  UpsertOptions,
} from "couchbase";

import { SdkUtils } from "../utils";

export class SdkCommandKeyValueOptions {
  static toSdkBinaryAppendOptions(options?: AppendOptionsPb): AppendOptions {
    const opts: AppendOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // [if:4.5.0]
    if (options.hasCas()) {
      opts.cas = options.getCas();
    }
    // [end]

    if (options.hasDurability()) {
      const durability = options.getDurability() as DurabilityTypePb;
      opts.durabilityLevel = SdkUtils.toDurabilityLevel(
        durability.getDurabilitylevel(),
      );
    }
    return opts;
  }

  static toSdkBinaryDecrementOptions(
    options?: DecrementOptionsPb,
  ): DecrementOptions {
    const opts: DecrementOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }
    if (options.hasExpiry()) {
      opts.expiry = SdkUtils.toExpiry(options.getExpiry());
    }
    // TODO:  Node.js SDK has delta in decrement() call
    // if(options.hasDelta()) {
    //   opts.delta = options.getDelta()
    // }
    if (options.hasInitial()) {
      opts.initial = options.getInitial();
    }

    if (options.hasDurability()) {
      const durability = options.getDurability() as DurabilityTypePb;
      opts.durabilityLevel = SdkUtils.toDurabilityLevel(
        durability.getDurabilitylevel(),
      );
    }
    return opts;
  }

  static toSdkBinaryIncrementOptions(
    options?: IncrementOptionsPb,
  ): IncrementOptions {
    const opts: IncrementOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }
    if (options.hasExpiry()) {
      opts.expiry = SdkUtils.toExpiry(options.getExpiry());
    }
    // TODO:  Node.js SDK has delta in decrement() call
    // if(options.hasDelta()) {
    //   opts.delta = options.getDelta()
    // }
    if (options.hasInitial()) {
      opts.initial = options.getInitial();
    }

    if (options.hasDurability()) {
      const durability = options.getDurability() as DurabilityTypePb;
      opts.durabilityLevel = SdkUtils.toDurabilityLevel(
        durability.getDurabilitylevel(),
      );
    }
    return opts;
  }

  static toSdkBinaryPrependOptions(options?: PrependOptionsPb): PrependOptions {
    const opts: PrependOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    // [if:4.5.0]
    if (options.hasCas()) {
      opts.cas = options.getCas();
    }
    // [end]

    if (options.hasDurability()) {
      const durability = options.getDurability() as DurabilityTypePb;
      opts.durabilityLevel = SdkUtils.toDurabilityLevel(
        durability.getDurabilitylevel(),
      );
    }
    return opts;
  }

  static toSdkExistsOptions(options?: ExistsOptionsPb): ExistsOptions {
    const opts: ExistsOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }
    return opts;
  }

  static toSdkGetAllReplicasOptions(
    options?: GetAllReplicasOptionsPb,
  ): GetAllReplicasOptions {
    const opts: GetAllReplicasOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }
    if (options.hasTranscoder()) {
      opts.transcoder = SdkUtils.toTranscoder(
        options.getTranscoder() as TranscoderPb,
      );
    }
    // [if:4.5.0]
    if (options.hasReadPreference()) {
      opts.readPreference = SdkUtils.toReadPreference(
        options.getReadPreference() as ReadPreferencePb,
      );
    }
    // [end]
    return opts;
  }

  static toSdkGetAndLockOptions(
    options?: GetAndLockOptionsPb,
  ): GetAndLockOptions {
    const opts: GetAndLockOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }
    if (options.hasTranscoder()) {
      opts.transcoder = SdkUtils.toTranscoder(
        options.getTranscoder() as TranscoderPb,
      );
    }
    return opts;
  }

  static toSdkGetAndTouchOptions(
    options?: GetAndTouchOptionsPb,
  ): GetAndTouchOptions {
    const opts: GetAndTouchOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }
    if (options.hasTranscoder()) {
      opts.transcoder = SdkUtils.toTranscoder(
        options.getTranscoder() as TranscoderPb,
      );
    }
    return opts;
  }

  static toSdkGetAnyReplicaOptions(
    options?: GetAnyReplicaOptionsPb,
  ): GetAnyReplicaOptions {
    const opts: GetAnyReplicaOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }
    if (options.hasTranscoder()) {
      opts.transcoder = SdkUtils.toTranscoder(
        options.getTranscoder() as TranscoderPb,
      );
    }
    // [if:4.5.0]
    if (options.hasReadPreference()) {
      opts.readPreference = SdkUtils.toReadPreference(
        options.getReadPreference() as ReadPreferencePb,
      );
    }
    // [end]
    return opts;
  }

  static toSdkGetOptions(options?: GetOptionsPb): GetOptions {
    const opts: GetOptions = {};
    if (!options) return opts;

    if (options.getProjectionList().length !== 0) {
      opts.project = options.getProjectionList();
    }
    if (options.hasWithExpiry()) {
      opts.withExpiry = options.getWithExpiry();
    }
    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }
    if (options.hasTranscoder()) {
      opts.transcoder = SdkUtils.toTranscoder(
        options.getTranscoder() as TranscoderPb,
      );
    }
    return opts;
  }

  static toSdkInsertOptions(options?: InsertOptionsPb): InsertOptions {
    const opts: InsertOptions = {};
    if (!options) return opts;

    if (options.hasExpiry()) {
      opts.expiry = SdkUtils.toExpiry(options.getExpiry());
    }
    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }
    if (options.hasDurability()) {
      const durability = options.getDurability() as DurabilityTypePb;
      opts.durabilityLevel = SdkUtils.toDurabilityLevel(
        durability.getDurabilitylevel(),
      );
    }
    if (options.hasTranscoder()) {
      opts.transcoder = SdkUtils.toTranscoder(
        options.getTranscoder() as TranscoderPb,
      );
    }
    return opts;
  }

  // [if:4.2.7]
  static toSdkLookupInAllReplicasOptions(
    options?: LookupInAllReplicasOptionsPb,
  ): LookupInAllReplicasOptions {
    const opts: LookupInAllReplicasOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMillis()) {
      opts.timeout = options.getTimeoutMillis();
    }
    // [if:4.5.0]
    if (options.hasReadPreference()) {
      opts.readPreference = SdkUtils.toReadPreference(
        options.getReadPreference() as ReadPreferencePb,
      );
    }
    // [end]
    return opts;
  }

  static toSdkLookupInAnyReplicaOptions(
    options?: LookupInAnyReplicaOptionsPb,
  ): LookupInAnyReplicaOptions {
    const opts: LookupInAnyReplicaOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMillis()) {
      opts.timeout = options.getTimeoutMillis();
    }
    // [if:4.5.0]
    if (options.hasReadPreference()) {
      opts.readPreference = SdkUtils.toReadPreference(
        options.getReadPreference() as ReadPreferencePb,
      );
    }
    // [end]
    return opts;
  }
  // [end]

  static toSdkLookupInOptions(options?: LookupInOptionsPb): LookupInOptions {
    const opts: LookupInOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMillis()) {
      opts.timeout = options.getTimeoutMillis();
    }

    // [if:4.2.7]
    if (options.hasAccessDeleted()) {
      opts.accessDeleted = options.getAccessDeleted();
    }
    // [end]
    return opts;
  }

  static toSdkMutateInOptions(options?: MutateInOptionsPb): MutateInOptions {
    const opts: MutateInOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMillis()) {
      opts.timeout = options.getTimeoutMillis();
    }
    if (options.hasExpiry()) {
      opts.expiry = SdkUtils.toExpiry(options.getExpiry());
    }
    if (options.hasPreserveExpiry()) {
      opts.preserveExpiry = options.getPreserveExpiry();
    }
    if (options.hasCas()) {
      // NOTE:  fixed w/ JSCBC-1249, tests _can_ fail prior
      // [if:4.3.1]
      opts.cas = options.getCas();
      // [else]
      //? opts.cas = options.getCas() as unknown as Cas;
      // [end]
    }
    if (options.hasDurability()) {
      const durability = options.getDurability() as DurabilityTypePb;
      opts.durabilityLevel = SdkUtils.toDurabilityLevel(
        durability.getDurabilitylevel(),
      );
    }
    if (options.hasStoreSemantics()) {
      const semantics = options.getStoreSemantics() as StoreSemanticsPb;
      if (semantics == StoreSemanticsPb.INSERT) {
        opts.storeSemantics = StoreSemantics.Insert;
      } else if (semantics == StoreSemanticsPb.REPLACE) {
        opts.storeSemantics = StoreSemantics.Replace;
      } else if (semantics == StoreSemanticsPb.UPSERT) {
        opts.storeSemantics = StoreSemantics.Upsert;
      } else {
        throw new Error("Invalid MutateInOptions StoreSemantics type.");
      }
    }
    // TODO:  Node.js SDK does not implement
    // if(options.hasAccessDeleted()){
    //   opts.accessDeleted = options.getAccessDeleted()
    // }
    // TODO:  Node.js SDK does not implement
    // if (options.hasCreateAsDeleted()) {
    //   opts.createAsDeleted = options.getCreateAsDeleted();
    // }
    return opts;
  }

  // [if:4.2.6]
  static toSdkRangeScanOptions(options?: ScanOptionsPb): ScanOptions {
    const opts: ScanOptions = {};
    if (!options) return opts;

    if (options.hasTranscoder()) {
      opts.transcoder = SdkUtils.toTranscoder(
        options.getTranscoder() as TranscoderPb,
      );
    }
    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }
    if (options.hasIdsOnly()) {
      opts.idsOnly = options.getIdsOnly();
    }
    if (options.hasBatchByteLimit()) {
      opts.batchByteLimit = options.getBatchByteLimit();
    }
    if (options.hasBatchItemLimit()) {
      opts.batchItemLimit = options.getBatchItemLimit();
    }
    if (options.hasConcurrency()) {
      opts.concurrency = options.getConcurrency();
    }
    if (options.hasConsistentWith()) {
      opts.consistentWith = SdkUtils.convertConsistentWith(
        options.getConsistentWith() as MutationStatePb,
      );
    }
    return opts;
  }
  // [end]

  static toSdkRemoveOptions(options?: RemoveOptionsPb): RemoveOptions {
    const opts: RemoveOptions = {};
    if (!options) return opts;

    if (options.hasCas()) {
      // NOTE:  fixed w/ JSCBC-1249, tests _can_ fail prior
      // [if:4.3.1]
      opts.cas = options.getCas();
      // [else]
      //? opts.cas = options.getCas() as unknown as Cas;
      // [end]
    }
    if (options.hasDurability()) {
      const durability = options.getDurability() as DurabilityTypePb;
      opts.durabilityLevel = SdkUtils.toDurabilityLevel(
        durability.getDurabilitylevel(),
      );
    }
    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }
    return opts;
  }

  static toSdkReplaceOptions(options?: ReplaceOptionsPb): ReplaceOptions {
    const opts: ReplaceOptions = {};
    if (!options) return opts;

    if (options.hasExpiry()) {
      opts.expiry = SdkUtils.toExpiry(options.getExpiry());
    }
    if (options.hasPreserveExpiry()) {
      opts.preserveExpiry = options.getPreserveExpiry();
    }
    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }
    if (options.hasDurability()) {
      const durability = options.getDurability() as DurabilityTypePb;
      opts.durabilityLevel = SdkUtils.toDurabilityLevel(
        durability.getDurabilitylevel(),
      );
    }
    if (options.hasCas()) {
      // NOTE:  fixed w/ JSCBC-1249, tests _can_ fail prior
      // [if:4.3.1]
      opts.cas = options.getCas();
      // [else]
      //? opts.cas = options.getCas() as unknown as Cas;
      // [end]
    }
    if (options.hasTranscoder()) {
      opts.transcoder = SdkUtils.toTranscoder(
        options.getTranscoder() as TranscoderPb,
      );
    }
    return opts;
  }

  static toSdkTouchOptions(options?: TouchOptionsPb): TouchOptions {
    const opts: TouchOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }
    return opts;
  }

  static toSdkUnlockOptions(options?: UnlockOptionsPb): UnlockOptions {
    const opts: UnlockOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }
    return opts;
  }

  static toSdkUpsertOptions(options?: UpsertOptionsPb): UpsertOptions {
    const opts: UpsertOptions = {};
    if (!options) return opts;

    if (options.hasExpiry()) {
      opts.expiry = SdkUtils.toExpiry(options.getExpiry());
    }
    if (options.hasPreserveExpiry()) {
      opts.preserveExpiry = options.getPreserveExpiry();
    }
    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }
    if (options.hasDurability()) {
      const durability = options.getDurability() as DurabilityTypePb;
      opts.durabilityLevel = SdkUtils.toDurabilityLevel(
        durability.getDurabilitylevel(),
      );
    }
    if (options.hasTranscoder()) {
      opts.transcoder = SdkUtils.toTranscoder(
        options.getTranscoder() as TranscoderPb,
      );
    }
    return opts;
  }
}
