import { QueryOptions as QueryOptionsPb } from "../../proto/sdk.query_pb";
import {
  MutationState as MutationStatePb,
  ScanConsistency as ScanConsistencyPb,
} from "../../proto/shared.basic_pb";

import {
  QueryOptions,
  QueryProfileMode,
  QueryScanConsistency,
} from "couchbase";

import { SdkUtils } from "../utils";

export class SdkCommandQueryOptions {
  static toSdkQueryOptions(options?: QueryOptionsPb): QueryOptions {
    const opts: QueryOptions = {};
    if (!options) return opts;

    if (options.hasScanConsistency()) {
      if (options.getScanConsistency() == ScanConsistencyPb.NOT_BOUNDED) {
        opts.scanConsistency = QueryScanConsistency.NotBounded;
      } else if (
        options.getScanConsistency() == ScanConsistencyPb.REQUEST_PLUS
      ) {
        opts.scanConsistency = QueryScanConsistency.RequestPlus;
      }
    }

    if (Object.keys(options.getRawMap()).length > 0) {
      const raw: { [key: string]: any } = {};
      options.getRawMap().forEach((k, v) => {
        raw[k] = v;
      });
      opts.raw = raw;
    }

    if (options.hasAdhoc()) {
      opts.adhoc = options.getAdhoc();
    }

    if (options.hasProfile()) {
      if (options.getProfile() === "off") {
        opts.profile = QueryProfileMode.Off;
      } else if (options.getProfile() === "phases") {
        opts.profile = QueryProfileMode.Phases;
      } else if (options.getProfile() === "timings") {
        opts.profile = QueryProfileMode.Timings;
      }
    }

    if (options.hasReadonly()) {
      opts.readOnly = options.getReadonly();
    }

    if (options.hasConsistentWith()) {
      opts.consistentWith = SdkUtils.convertConsistentWith(
        options.getConsistentWith() as MutationStatePb,
      );
    }

    if (options.getParametersPositionalList().length > 0) {
      opts.parameters = options.getParametersPositionalList();
    } else if (Object.keys(options.getParametersNamedMap()).length > 0) {
      const params: { [key: string]: any } = {};
      options.getParametersNamedMap().forEach((entry, key) => {
        params[key] = entry;
      });
      opts.parameters = params;
    }

    if (options.hasFlexIndex()) {
      opts.flexIndex = options.getFlexIndex();
    }

    if (options.hasPipelineCap()) {
      opts.pipelineCap = options.getPipelineCap();
    }

    if (options.hasPipelineBatch()) {
      opts.pipelineBatch = options.getPipelineBatch();
    }

    if (options.hasScanCap()) {
      opts.scanCap = options.getScanCap();
    }

    if (options.hasScanWaitMillis()) {
      opts.scanWait = options.getScanWaitMillis();
    }

    if (options.hasTimeoutMillis()) {
      opts.timeout = options.getTimeoutMillis();
    }

    if (options.hasMaxParallelism()) {
      opts.maxParallelism = options.getMaxParallelism();
    }

    if (options.hasMetrics()) {
      opts.metrics = options.getMetrics();
    }

    // [if:4.2.6]
    if (options.hasUseReplica()) {
      opts.useReplica = options.getUseReplica();
    }
    // [end]

    if (options.hasClientContextId()) {
      opts.clientContextId = options.getClientContextId();
    }

    if (options.hasPreserveExpiry()) {
      opts.preserveExpiry = options.getPreserveExpiry();
    }

    return opts;
  }
}
