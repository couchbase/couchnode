import {
  Cluster,
  // [if:4.7.0]
  Meter,
  RequestTracer,
  getOTelMeter,
  getOTelTracer,
  // [end]
} from "couchbase";

// [if:4.7.0]
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { NodeTracerProvider as TracerProvider } from "@opentelemetry/sdk-trace-node";

import {
  MetricsConfig as MetricsConfigPb,
  TracingConfig as TracingConfigPb,
} from "../proto/observability.config_pb";
// [end]

import {
  RegistryEventEmitter,
  RegistryEventType,
  StreamingEventEmitter,
  StreamingEventType,
} from "./eventEmitter";

import {
  IObservableConnection,
  ISpanOwner,
} from "./observability/observabilityTypes";

// [if:4.7.0]
import {
  createMeterProvider,
  createTracerProvider,
} from "./observability/otel";

import { SpanOwner } from "./observability/spanOwner";
// [end]

import { StreamResult } from "./results/stream";
import { Counters } from "./bounds";
import { Counter as CounterPb } from "../proto/shared.bounds_pb";

export type StreamRegistry = {
  [streamId: string]: StreamResult;
};

export class Connection {
  private _cluster: Cluster | undefined;

  get cluster(): Cluster {
    if (!this._cluster) {
      throw new Error("Cluster is not initialized");
    }
    return this._cluster;
  }

  setCluster(cluster: Cluster) {
    this._cluster = cluster;
  }

  async shutdown(): Promise<void> {
    await this.cluster.close();
  }
}

// [if:4.7.0]
export class ObservableConnection
  extends Connection
  implements IObservableConnection
{
  private _meter: Meter | undefined;
  private _meterProvider: MeterProvider | undefined;
  private _tracer: RequestTracer | undefined;
  private _tracerProvider: TracerProvider | undefined;

  constructor() {
    super();
  }

  get meter(): Meter | undefined {
    return this._meter;
  }

  get tracer(): RequestTracer | undefined {
    return this._tracer;
  }

  createMeter(metricsConfig: MetricsConfigPb): void {
    this._meterProvider = createMeterProvider(metricsConfig);
    this._meter = getOTelMeter(this._meterProvider);
  }

  createTracer(tracingConfig: TracingConfigPb): void {
    this._tracerProvider = createTracerProvider(tracingConfig);
    this._tracer = getOTelTracer(this._tracerProvider);
  }

  async shutdown(): Promise<void> {
    if (this._meterProvider) {
      await this._meterProvider.shutdown();
    }
    if (this._tracerProvider) {
      await this._tracerProvider.shutdown();
    }
    await super.shutdown();
  }
}
// [end]

export class PerformerRegistry {
  private _connections: { [connectionId: string]: Connection } = {};
  private _streamRegistry: { [streamId: string]: string } = {};
  private _requestRegistry: { [runId: string]: StreamingEventEmitter } = {};
  private _counters: Counters = new Counters();
  private _emitter: RegistryEventEmitter;
  private _spanOwner: ISpanOwner | undefined;

  constructor() {
    this._emitter = new RegistryEventEmitter();
    this._emitter.on(
      RegistryEventType.RegisterStream,
      (runId: string, streamId: string) => {
        this.registerStream(runId, streamId);
      },
    );
    this._emitter.on(RegistryEventType.UnregisterStream, (runId: string) => {
      this.unregisterStream(runId);
    });
    this._emitter.on(RegistryEventType.UnregisterExecutor, (runId: string) => {
      this.unregisterRequestExecutor(runId);
    });
    // [if:4.7.0]
    this._spanOwner = new SpanOwner();
    // [end]
  }

  get registryEmitter(): RegistryEventEmitter {
    return this._emitter;
  }

  get spanOwner(): ISpanOwner | undefined {
    return this._spanOwner;
  }

  get counters(): Counters {
    return this._counters;
  }

  getConnection(connectionId: string): Connection | undefined {
    let connection;
    if (connectionId in this._connections) {
      connection = this._connections[connectionId];
    }
    return connection;
  }

  registerConnection(connectionId: string): number {
    if (!(connectionId in this._connections)) {
      // [if:4.7.0]
      this._connections[connectionId] = new ObservableConnection();
      // [else]
      //? this._connections[connectionId] = new Connection();
      // [end]
    }
    return Object.keys(this._connections).length;
  }

  async unregisterConnection(connectionId: string): Promise<number> {
    if (connectionId in this._connections) {
      await this._connections[connectionId].shutdown();
      delete this._connections[connectionId];
    }
    return Object.keys(this._connections).length;
  }

  async unregisterAllConnections(): Promise<void> {
    const connectionIds = Object.keys(this._connections);
    for (const connectionId of connectionIds) {
      await this.unregisterConnection(connectionId);
    }
  }

  registerRequestExecutor(runId: string, emitter: StreamingEventEmitter) {
    if (!(runId in this._requestRegistry)) {
      this._requestRegistry[runId] = emitter;
    }
  }

  unregisterRequestExecutor(runId: string) {
    if (runId in this._requestRegistry) {
      delete this._requestRegistry[runId];
    }
  }

  requestStreamItems(streamId: string, numItems: number) {
    if (streamId in this._streamRegistry) {
      const requestId = this._streamRegistry[streamId];
      if (requestId in this._requestRegistry) {
        this._requestRegistry[requestId].emit(
          StreamingEventType.RequestStreamItems,
          streamId,
          numItems,
        );
      } else {
        console.error(
          `PerformerRegistry.requestStreamItems() - cannot find stream's (id=${streamId}) request (id=${requestId}).`,
        );
      }
    } else {
      console.error(
        `PerformerRegistry.requestStreamItems() - cannot find stream with id=${streamId}.`,
      );
    }
  }

  registerStream(runId: string, streamId: string) {
    if (!(streamId in this._streamRegistry)) {
      this._streamRegistry[streamId] = runId;
    }
  }

  unregisterStream(streamId: string) {
    if (streamId in this._streamRegistry) {
      const requestId = this._streamRegistry[streamId];
      if (requestId in this._requestRegistry) {
        this._requestRegistry[requestId].emit(
          StreamingEventType.CancelStream,
          streamId,
        );
      } else {
        console.error(
          `PerformerRegistry.unregisterStream() - cannot find stream's (id=${streamId}) request (id=${requestId}).`,
        );
      }
      delete this._streamRegistry[streamId];
    } else {
      console.error(
        `PerformerRegistry.unregisterStream() - cannot find stream with id=${streamId}.`,
      );
    }
  }

  setCounter(shared: CounterPb): void {
    this._counters.set(shared);
  }

  clearCounters(): void {
    this._counters.clear();
  }
}
