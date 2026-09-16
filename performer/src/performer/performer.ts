import { v4 as uuidv4 } from "uuid";

import {
  UntypedHandleCall,
  sendUnaryData,
  Server,
  ServerCredentials,
  ServerUnaryCall,
  ServerWritableStream,
  status as GRPCStatus,
} from "@grpc/grpc-js";

import {
  Caps as PerformerCapsPb,
  PerformerCapsFetchRequest as PerformerCapsFetchRequestPb,
  PerformerCapsFetchResponse as PerformerCapsFetchResponsePb,
} from "../proto/performer.caps_pb";
import { PerformerServiceService } from "../proto/performer_grpc_pb";
import { Config as RunConfigPb } from "../proto/run.config_pb";
import { ConfigStreaming as ConfigStreamingPb } from "../proto/run.config_pb";
import {
  Request as TopLevelRequestPb,
  Result as TopLevelResultPb,
} from "../proto/run.top_level_pb";
import { Caps as SdkCapsPb } from "../proto/sdk.caps_pb";
import { API } from "../proto/shared.basic_pb";
import {
  ClusterConnectionCloseRequest as ClusterConnectionCloseRequestPb,
  ClusterConnectionCloseResponse as ClusterConnectionCloseResponsePb,
  ClusterConnectionCreateRequest as ClusterConnectionCreateRequestPb,
  ClusterConnectionCreateResponse as ClusterConnectionCreateResponsePb,
  DisconnectConnectionsRequest as DisconnectConnectionsRequestPb,
  DisconnectConnectionsResponse as DisconnectConnectionsResponsePb,
} from "../proto/shared.cluster_pb";
import {
  EchoRequest as EchoRequestPb,
  EchoResponse as EchoResponsePb,
} from "../proto/shared.echo_pb";
import {
  CancelRequest as CancelRequestPb,
  CancelResponse as CancelResponsePb,
  RequestItemsRequest as RequestItemsRequestPb,
  RequestItemsResponse as RequestItemsResponsePb,
} from "../proto/streams.top_level_pb";
import {
  SpanCreateRequest as SpanCreateRequestPb,
  SpanCreateResponse as SpanCreateResponsePb,
  SpanFinishRequest as SpanFinishRequestPb,
  SpanFinishResponse as SpanFinishResponsePb,
} from "../proto/observability.top_pb";
import {
  Counter as CounterPb,
  SetCounterResponse as SetCounterResponsePb,
  ClearAllCountersRequest as ClearAllCountersRequestPb,
  ClearAllCountersResponse as ClearAllCountersResponsePb,
} from "../proto/shared.bounds_pb";

import { Cluster, connect, ConnectOptions } from "couchbase";

import {
  IObservableConnection,
  IRequestTracer,
  ISpanOwner,
} from "./observability/observabilityTypes";
import { NotImplementedError } from "./error";
import { MetricsReporter } from "./metricsReporter";
import { RequestExecutor } from "./requestExecutor";
import { Connection, PerformerRegistry } from "./registry";
import { SdkUtils } from "./utils";

// The version of the couchnode SDK we are built against.  package.json is the
// single source of truth: bumping it at publish time moves any version gate
// in the FIT driver (e.g. SubdocUtil's exists() check) automatically.
import couchbasePackage from "couchbase/package.json";

const registry = new PerformerRegistry();

// couchnode reports an in-development version with a pre-release suffix, e.g.
// "4.8.0-dev".  The FIT driver only compares major.minor.patch, and pre-release
// suffixes are SDK-specific, so we strip ours here and hand the driver a clean
// semver rather than relying on its generic suffix handling.
const SDK_LIBRARY_VERSION = couchbasePackage.version.split("-")[0];

class Performer {
  [name: string]: UntypedHandleCall;

  clusterConnectionClose(
    call: ServerUnaryCall<
      ClusterConnectionCloseRequestPb,
      ClusterConnectionCloseResponsePb
    >,
    callback: sendUnaryData<ClusterConnectionCloseResponsePb>,
  ): void {
    console.info("clusterConnectionClose called");
    registry
      .unregisterConnection(call.request.getClusterConnectionId())
      .then((numConnections: number) => {
        const response = new ClusterConnectionCloseResponsePb();
        response.setClusterConnectionCount(Object.keys(numConnections).length);
        callback(null, response);
      })
      .catch((error: any) => {
        console.error(
          "connection id " +
            call.request.getClusterConnectionId() +
            " does not exist",
        );
        callback(error, null);
      });
  }

  clusterConnectionCreate(
    call: ServerUnaryCall<
      ClusterConnectionCreateRequestPb,
      ClusterConnectionCreateResponsePb
    >,
    callback: sendUnaryData<ClusterConnectionCreateResponsePb>,
  ): void {
    const numConnections = registry.registerConnection(
      call.request.getClusterConnectionId(),
    );

    const connection = registry.getConnection(
      call.request.getClusterConnectionId(),
    );
    if (!connection) {
      const errorMsg = `Failed to register connection with id ${call.request.getClusterConnectionId()}`;
      console.error(errorMsg);
      callback(new Error(errorMsg), null);
      return;
    }

    // Both certificate and JWT auth are in the C++ core's requires_tls() set, so
    // their connection strings must use the secure couchbases:// scheme.
    const requiresTls =
      (call.request.hasAuthenticator() &&
        (call.request.getAuthenticator()?.hasCertificateAuth() ||
          call.request.getAuthenticator()?.hasJwtAuth())) ||
      false;
    const connString = SdkUtils.getConnectionString(
      call.request.getClusterHostname(),
      requiresTls,
      call.request.getClusterConfig(),
    );
    console.info(`connString=${connString}`);
    let connectOpts: ConnectOptions;
    if (call.request.hasAuthenticator()) {
      const auth = call.request.getAuthenticator();
      connectOpts = SdkUtils.connectionOptions(
        {
          authenticator: auth,
          config: call.request.getClusterConfig(),
        },
        connection,
      );
    } else {
      const username = call.request.getClusterUsername();
      const password = call.request.getClusterPassword();
      connectOpts = SdkUtils.connectionOptions(
        {
          username: username,
          password: password,
          config: call.request.getClusterConfig(),
        },
        connection,
      );
    }

    // console.log('Ready to connect, opts', connectOpts);
    connect(connString, connectOpts)
      .then((cluster: Cluster) => {
        connection.setCluster(cluster);
        const returnResult = new ClusterConnectionCreateResponsePb();
        returnResult.setClusterConnectionCount(numConnections);
        callback(null, returnResult);
      })
      .catch((error: any) => {
        console.error("Failed connecting to the cluster");
        console.error(error);
        callback(error, null);
      });
  }

  disconnectConnections(
    _: ServerUnaryCall<
      DisconnectConnectionsRequestPb,
      DisconnectConnectionsResponsePb
    >,
    callback: sendUnaryData<DisconnectConnectionsResponsePb>,
  ): void {
    console.info("disconnectConnections called");
    registry
      .unregisterAllConnections()
      .then(() => {
        callback(null, new DisconnectConnectionsResponsePb());
      })
      .catch((error: any) => {
        callback(error, null);
      });
  }

  echo(
    call: ServerUnaryCall<EchoRequestPb, EchoResponsePb>,
    callback: sendUnaryData<EchoResponsePb>,
  ): void {
    console.info(
      "================ " +
        call.request.getTestname() +
        " : " +
        call.request.getMessage() +
        " ================ ",
    );
    callback(null, new EchoResponsePb());
  }

  performerCapsFetch(
    _: ServerUnaryCall<
      PerformerCapsFetchRequestPb,
      PerformerCapsFetchResponsePb
    >,
    callback: sendUnaryData<PerformerCapsFetchResponsePb>,
  ): void {
    console.info("performerCapsFetch called");
    const returnResult = new PerformerCapsFetchResponsePb();
    returnResult.setTransactionImplementationsCapsList([]);
    const sdkCaps = [
      SdkCapsPb.SUPPORTS_AUTHENTICATOR,
      SdkCapsPb.SDK_KV,
      SdkCapsPb.SDK_PRESERVE_EXPIRY,
      SdkCapsPb.SDK_QUERY_INDEX_MANAGEMENT,
      SdkCapsPb.SDK_QUERY,
      SdkCapsPb.SDK_SEARCH,
      SdkCapsPb.SDK_LOOKUP_IN,
      SdkCapsPb.SDK_BUCKET_MANAGEMENT,
    ];
    // [if:4.2.2]
    sdkCaps.push(SdkCapsPb.SDK_COLLECTION_QUERY_INDEX_MANAGEMENT);
    // [end:4.2.2]
    // [if:4.2.6]
    sdkCaps.push(SdkCapsPb.SDK_KV_RANGE_SCAN);
    sdkCaps.push(SdkCapsPb.SDK_QUERY_READ_FROM_REPLICA);
    // [end]
    // [if:4.2.7]
    sdkCaps.push(SdkCapsPb.SDK_LOOKUP_IN_REPLICAS);
    sdkCaps.push(SdkCapsPb.SDK_COLLECTION_MANAGEMENT); // Tested using 4.2.7 API
    sdkCaps.push(SdkCapsPb.SDK_MANAGEMENT_HISTORY_RETENTION);
    // [end]
    sdkCaps.push(SdkCapsPb.SDK_SEARCH_INDEX_MANAGEMENT);
    // [if:4.2.9]
    sdkCaps.push(SdkCapsPb.SDK_DOCUMENT_NOT_LOCKED);
    // [end]
    // [if:4.2.10]
    sdkCaps.push(SdkCapsPb.SDK_VECTOR_SEARCH);
    // [end]
    // [if:4.2.11]
    sdkCaps.push(SdkCapsPb.SDK_SCOPE_SEARCH_INDEX_MANAGEMENT);
    sdkCaps.push(SdkCapsPb.SDK_SCOPE_SEARCH);
    sdkCaps.push(SdkCapsPb.SDK_INDEX_MANAGEMENT_RFC_REVISION_25);
    sdkCaps.push(SdkCapsPb.SDK_SEARCH_RFC_REVISION_11);
    // [end]
    // [if:4.3.2]
    sdkCaps.push(SdkCapsPb.SDK_VECTOR_SEARCH_BASE64);
    // [end]
    // [if:4.5.0]
    sdkCaps.push(SdkCapsPb.SDK_ZONE_AWARE_READ_FROM_REPLICA);
    sdkCaps.push(SdkCapsPb.SDK_APP_TELEMETRY);
    // [end]
    // [if:4.6.0]
    sdkCaps.push(SdkCapsPb.SDK_PREFILTER_VECTOR_SEARCH);
    sdkCaps.push(SdkCapsPb.SDK_BUCKET_SETTINGS_NUM_VBUCKETS);
    // [end]
    // [if:4.7.0]
    sdkCaps.push(SdkCapsPb.SDK_SET_AUTHENTICATOR);
    sdkCaps.push(SdkCapsPb.SDK_JWT);
    sdkCaps.push(SdkCapsPb.SDK_OBSERVABILITY_RFC_REV_24);
    sdkCaps.push(SdkCapsPb.SDK_OBSERVABILITY_CLUSTER_LABELS);
    sdkCaps.push(SdkCapsPb.SDK_STABLE_OTEL_SEMANTIC_CONVENTIONS);
    sdkCaps.push(
      SdkCapsPb.SDK_STABLE_OTEL_SEMANTIC_CONVENTIONS_EMITTED_BY_DEFAULT,
    );
    // [end]
    sdkCaps.push(SdkCapsPb.SDK_QUERY_2120);
    returnResult.setSdkImplementationCapsList(sdkCaps);
    const performerCaps = [
      PerformerCapsPb.KV_SUPPORT_1,
      PerformerCapsPb.CLUSTER_CONFIG_CERT,
      PerformerCapsPb.CLUSTER_CONFIG_INSECURE,
    ];
    // [if:4.7.0]
    performerCaps.push(PerformerCapsPb.OBSERVABILITY_1);
    // [end]
    returnResult.setPerformerCapsList(performerCaps);
    returnResult.setPerformerUserAgent("node");
    returnResult.setLibraryVersion(SDK_LIBRARY_VERSION);
    returnResult.setSupportedApisList([API.DEFAULT]);
    callback(null, returnResult);
  }

  async run(
    call: ServerWritableStream<TopLevelRequestPb, TopLevelResultPb>,
  ): Promise<void> {
    console.info("run called");
    const runId = uuidv4();
    const requestExecutor = new RequestExecutor(
      call,
      registry.registryEmitter,
      runId,
      registry.counters,
    );
    registry.registerRequestExecutor(
      requestExecutor.reqRunId,
      requestExecutor.streamingEmitter,
    );
    const reqConnection = registry.getConnection(
      requestExecutor.reqConnectionId,
    );
    if (!reqConnection) {
      call.emit(
        "error",
        new Error(`Unable to find connectionId=${reqConnection}`),
      );
      call.end();
    }
    let metricsReporter = null;
    let metricsEnabled = false;
    if (call.request.hasConfig()) {
      const config = call.request.getConfig() as RunConfigPb;
      if (config.hasStreamingConfig()) {
        const streamingConfig =
          config.getStreamingConfig() as ConfigStreamingPb;
        metricsEnabled = streamingConfig.getEnableMetrics() ?? false;
      }
    }
    if (metricsEnabled) {
      metricsReporter = new MetricsReporter(call, 1000, runId);
      metricsReporter.start();
    }
    try {
      // the request executor will call call.end() when complete.
      // don't unregister request executor b/c streaming might still be wrapping up
      console.info("running request");
      await requestExecutor.executeWorkloads(
        reqConnection as Connection,
        registry.spanOwner,
      );
      if (metricsEnabled && metricsReporter) {
        metricsReporter.stop();
      }
    } catch (e) {
      console.log("Error: ", e);
      registry.unregisterRequestExecutor(requestExecutor.reqRunId);
      if (e instanceof NotImplementedError) {
        console.error(e.errorMsg());
        call.emit("error", GRPCStatus.UNIMPLEMENTED);
        if (metricsEnabled && metricsReporter) {
          metricsReporter.stop();
        }
      } else {
        console.error(e);
        call.emit("error", GRPCStatus.CANCELLED);
        if (metricsEnabled && metricsReporter) {
          metricsReporter.stop();
        }
      }
    }
  }

  streamCancel(
    call: ServerUnaryCall<CancelRequestPb, CancelResponsePb>,
    callback: sendUnaryData<CancelResponsePb>,
  ): void {
    console.info("StreamCancel called");
    registry.unregisterStream(call.request.getStreamId());
    callback(null, new CancelResponsePb());
  }

  async streamRequestItems(
    call: ServerUnaryCall<RequestItemsRequestPb, RequestItemsResponsePb>,
    callback: sendUnaryData<RequestItemsResponsePb>,
  ): Promise<void> {
    console.info("StreamRequestItems called");
    registry.requestStreamItems(
      call.request.getStreamId(),
      call.request.getNumItems(),
    );
    callback(null, new RequestItemsResponsePb());
  }

  spanCreate(
    call: ServerUnaryCall<SpanCreateRequestPb, SpanCreateResponsePb>,
    callback: sendUnaryData<SpanCreateResponsePb>,
  ): void {
    console.info("spanCreate called");
    try {
      const reqConnection = registry.getConnection(
        call.request.getClusterConnectionId(),
      );
      const tracer = (reqConnection as unknown as IObservableConnection).tracer;
      (registry.spanOwner as ISpanOwner).createSpan(
        tracer as IRequestTracer,
        call.request,
      );
      callback(null, new SpanCreateResponsePb());
    } catch (e) {
      console.log("Error: ", e);
      call.emit("error", GRPCStatus.UNKNOWN);
    }
  }

  spanFinish(
    call: ServerUnaryCall<SpanFinishRequestPb, SpanFinishResponsePb>,
    callback: sendUnaryData<SpanFinishResponsePb>,
  ): void {
    console.info("spanFinish called");
    try {
      (registry.spanOwner as ISpanOwner).finishSpan(call.request.getId());
      callback(null, new SpanFinishResponsePb());
    } catch (e) {
      console.log("Error: ", e);
      call.emit("error", GRPCStatus.UNKNOWN);
    }
  }

  setCounter(
    call: ServerUnaryCall<CounterPb, SetCounterResponsePb>,
    callback: sendUnaryData<SetCounterResponsePb>,
  ): void {
    console.info("setCounter called");
    try {
      registry.setCounter(call.request);
      callback(null, new SetCounterResponsePb());
    } catch (e) {
      console.log("Error: ", e);
      call.emit("error", GRPCStatus.UNKNOWN);
    }
  }

  clearAllCounters(
    call: ServerUnaryCall<
      ClearAllCountersRequestPb,
      ClearAllCountersResponsePb
    >,
    callback: sendUnaryData<ClearAllCountersResponsePb>,
  ): void {
    console.info("clearAllCounters called");
    try {
      registry.clearCounters();
      callback(null, new ClearAllCountersResponsePb());
    } catch (e) {
      console.log("Error: ", e);
      call.emit("error", GRPCStatus.UNKNOWN);
    }
  }
}

if (require.main === module) {
  const port = "8060";
  const server = new Server();
  server.addService(PerformerServiceService, new Performer());
  server.bindAsync(
    "0.0.0.0:" + port,
    ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        throw err;
      }
      console.log(`Listening on ${port}`);
    },
  );
}
