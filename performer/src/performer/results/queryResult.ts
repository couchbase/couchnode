import { Duration } from "google-protobuf/google/protobuf/duration_pb";

import {
  QueryResult as QueryResultPb,
  QueryMetaData as QueryMetaDataPb,
  QueryMetrics as QueryMetricsPb,
  QueryStatus as QueryStatusPb,
  QueryWarning as QueryWarningPb,
} from "../../proto/sdk.query_pb";
import { ContentAs } from "../../proto/shared.content_pb";

import {
  QueryResult,
  QueryMetaData,
  QueryMetrics,
  QueryStatus,
} from "couchbase";

import { SdkUtils } from "../utils";

export class SdkQueryCommandResult {
  static toQueryStatus(status: QueryStatus): QueryStatusPb {
    if (status == QueryStatus.Running) {
      return QueryStatusPb.RUNNING;
    } else if (status == QueryStatus.Success) {
      return QueryStatusPb.SUCCESS;
    } else if (status == QueryStatus.Errors) {
      return QueryStatusPb.ERRORS;
    } else if (status == QueryStatus.Completed) {
      return QueryStatusPb.COMPLETED;
    } else if (status == QueryStatus.Stopped) {
      return QueryStatusPb.STOPPED;
    } else if (status == QueryStatus.Timeout) {
      return QueryStatusPb.TIMEOUT;
    } else if (status == QueryStatus.Closed) {
      return QueryStatusPb.CLOSED;
    } else if (status == QueryStatus.Fatal) {
      return QueryStatusPb.FATAL;
    } else if (status == QueryStatus.Aborted) {
      return QueryStatusPb.ABORTED;
    } else {
      return QueryStatusPb.UNKNOWN;
    }
  }

  static toQueryMetrics(metrics?: QueryMetrics): QueryMetricsPb | undefined {
    if (!metrics) return metrics;

    const metricsPb = new QueryMetricsPb();
    const elapsed = new Duration();
    elapsed.setNanos(metrics.elapsedTime * 1e6);
    metricsPb.setElapsedTime(elapsed);
    const execution = new Duration();
    execution.setNanos(metrics.executionTime * 1e6);
    metricsPb.setExecutionTime(execution);
    metricsPb.setSortCount(metrics.sortCount);
    metricsPb.setSortCount(metrics.sortCount);
    metricsPb.setResultCount(metrics.resultCount);
    metricsPb.setResultSize(metrics.resultSize);
    metricsPb.setMutationCount(metrics.mutationCount);
    metricsPb.setErrorCount(metrics.errorCount);
    metricsPb.setWarningCount(metrics.warningCount);
    return metricsPb;
  }

  static toQueryMetadata(metadata: QueryMetaData): QueryMetaDataPb {
    const meta = new QueryMetaDataPb();
    meta.setRequestId(metadata.requestId);
    meta.setClientContextId(metadata.clientContextId);
    meta.setStatus(SdkQueryCommandResult.toQueryStatus(metadata.status));
    meta.setSignature(Buffer.from(JSON.stringify(metadata.signature)));
    meta.setWarningsList(
      metadata.warnings.map((w) => {
        const warning = new QueryWarningPb();
        warning.setCode(w.code);
        warning.setMessage(w.message);
        return warning;
      }),
    );
    meta.setMetrics(SdkQueryCommandResult.toQueryMetrics(metadata.metrics));
    if (metadata.profile) {
      meta.setProfile(Buffer.from(JSON.stringify(metadata.profile)));
    }

    return meta;
  }

  static toQueryResult(
    result: QueryResult,
    contentAs: ContentAs,
  ): QueryResultPb {
    const res = new QueryResultPb();
    res.setContentList(
      result.rows.map((r) => SdkUtils.getContentTypes(contentAs, r)),
    );
    res.setMetaData(SdkQueryCommandResult.toQueryMetadata(result.meta));
    return res;
  }
}
