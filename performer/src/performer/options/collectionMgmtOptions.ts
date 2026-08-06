import {
  CreateCollectionOptions as CreateCollectionOptionsPb,
  CreateScopeOptions as CreateScopeOptionsPb,
  DropCollectionOptions as DropCollectionOptionsPb,
  DropScopeOptions as DropScopeOptionsPb,
  GetAllScopesOptions as GetAllScopesOptionsPb,
  // [if:4.2.6]
  UpdateCollectionOptions as UpdateCollectionOptionsPb,
  // [end]
} from "../../proto/sdk.bucket.collection_manager_pb";
import {
  CreateCollectionOptions,
  CreateScopeOptions,
  DropCollectionOptions,
  DropScopeOptions,
  GetAllScopesOptions,
  // [if:4.2.7]
  UpdateCollectionOptions,
  // [end]
} from "couchbase";

export class SdkCollectionMgmtOptions {
  static toCreateCollectionOptions(
    options?: CreateCollectionOptionsPb,
  ): CreateCollectionOptions {
    const opts: CreateCollectionOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    return opts;
  }

  static toDropCollectionOptions(
    options?: DropCollectionOptionsPb,
  ): DropCollectionOptions {
    const opts: DropCollectionOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    return opts;
  }

  // [if:4.2.7]
  static toUpdateCollectionOptions(
    options?: UpdateCollectionOptionsPb,
  ): UpdateCollectionOptions {
    const opts: UpdateCollectionOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    return opts;
  }
  // [end]

  static toCreateScopeOptions(
    options?: CreateScopeOptionsPb,
  ): CreateScopeOptions {
    const opts: CreateScopeOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    return opts;
  }

  static toDropScopeOptions(options?: DropScopeOptionsPb): DropScopeOptions {
    const opts: DropScopeOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    return opts;
  }

  static toGetAllScopesOptions(
    options?: GetAllScopesOptionsPb,
  ): GetAllScopesOptions {
    const opts: GetAllScopesOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    return opts;
  }
}
