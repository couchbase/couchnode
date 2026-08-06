import {
  CreateBucketOptions as CreateBucketOptionsPb,
  DropBucketOptions as DropBucketOptionsPb,
  FlushBucketOptions as FlushBucketOptionsPb,
  GetAllBucketsOptions as GetAllBucketOptionsPb,
  GetBucketOptions as GetBucketOptionsPb,
  UpdateBucketOptions as UpdateBucketOptionsPb,
} from "../../proto/sdk.cluster.bucket_manager_pb";

import {
  CreateBucketOptions,
  DropBucketOptions,
  FlushBucketOptions,
  GetAllBucketsOptions,
  GetBucketOptions,
  UpdateBucketOptions,
} from "couchbase";

export class SdkBucketMgmtOptions {
  static toCreateBucketOptions(
    options?: CreateBucketOptionsPb,
  ): CreateBucketOptions {
    const opts: CreateBucketOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    return opts;
  }

  static toDropBucketOptions(options?: DropBucketOptionsPb): DropBucketOptions {
    const opts: DropBucketOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    return opts;
  }

  static toFlushBucketOptions(
    options?: FlushBucketOptionsPb,
  ): FlushBucketOptions {
    const opts: FlushBucketOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    return opts;
  }

  static toGetAllBucketsOptions(
    options?: GetAllBucketOptionsPb,
  ): GetAllBucketsOptions {
    const opts: GetAllBucketsOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    return opts;
  }

  static toGetBucketOptions(options?: GetBucketOptionsPb): GetBucketOptions {
    const opts: GetBucketOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    return opts;
  }

  static toUpdateBucketOptions(
    options?: UpdateBucketOptionsPb,
  ): UpdateBucketOptions {
    const opts: UpdateBucketOptions = {};
    if (!options) return opts;

    if (options.hasTimeoutMsecs()) {
      opts.timeout = options.getTimeoutMsecs();
    }

    return opts;
  }
}
