import { ServerWritableStream } from "@grpc/grpc-js";
import {
  Request as RequestPb,
  Result as ResultPb,
  BatchedResult as BatchedResultPb,
} from "../proto/run.top_level_pb";
import { Config as RunConfigPb } from "../proto/run.config_pb";
import { ConfigStreaming as ConfigStreamingPb } from "../proto/run.config_pb";
import {
  HorizontalScaling as HorizontalScalingPb,
  Workload as WorkloadPb,
  Workloads as WorkloadsPb,
} from "../proto/run.workloads_pb";
import { Workload as SdkWorkloadPb } from "../proto/sdk.workload_pb";

import {
  RegistryEventEmitter,
  RegistryEventType,
  StreamingEventEmitter,
  StreamingEventType,
} from "./eventEmitter";
import { NotImplementedError } from "./error";
import { Connection, StreamRegistry } from "./registry";
import { StreamResult } from "./results/stream";
import { SdkWorkload } from "./workload";
import { ISpanOwner } from "./observability/observabilityTypes";
import { Counters } from "./bounds";

export class RequestExecutor {
  private _streamRegistry: StreamRegistry = {};
  private readonly _batchSize: number;
  private readonly _registryEmitter: RegistryEventEmitter;
  private readonly _call: ServerWritableStream<RequestPb, ResultPb>;
  private readonly _runId: string;
  private readonly _requestWorkloads: WorkloadsPb;
  private readonly _connectionId: string;
  private _counters: Counters;
  private _streamingEmitter: StreamingEventEmitter;
  private _resultQueue: ResultPb[];
  private _readyToSend: boolean;
  private _workloadsFinished: boolean;
  private _lastTimeSentToDriver: number | undefined;
  private _timeToWaitToSendToDriverMillis = 100;

  constructor(
    call: ServerWritableStream<RequestPb, ResultPb>,
    registryEmitter: RegistryEventEmitter,
    runId: string,
    counters: Counters,
  ) {
    if (!call.request.hasWorkloads())
      throw new Error("Unimplemented request type");

    this._batchSize = 1;
    this._resultQueue = [];
    this._readyToSend = true;

    this._call = call;
    if (this._call.request.hasConfig()) {
      const config = this._call.request.getConfig() as RunConfigPb;
      if (config.hasStreamingConfig()) {
        const streamingConfig =
          config.getStreamingConfig() as ConfigStreamingPb;
        this._batchSize = streamingConfig.getBatchSize() ?? 1;
      }
    }

    this._runId = runId;
    this._requestWorkloads = this._call.request.getWorkloads() as WorkloadsPb;
    this._connectionId = this._requestWorkloads.getClusterConnectionId();
    this._counters = counters;
    this._registryEmitter = registryEmitter;
    this._workloadsFinished = false;
    this._streamingEmitter = new StreamingEventEmitter();
    this._setStreamingEmitter();
  }

  get reqConnectionId(): string {
    return this._connectionId;
  }

  get streamingEmitter(): StreamingEventEmitter {
    return this._streamingEmitter;
  }

  get reqRunId(): string {
    return this._runId;
  }

  _setStreamingEmitter() {
    this._streamingEmitter.on(
      StreamingEventType.RegisterStream,
      (streamResult: StreamResult) => {
        this.registerStream(streamResult);
      },
    );
    this._streamingEmitter.on(
      StreamingEventType.CancelStream,
      (streamId: string) => {
        this.cancelStream(streamId);
      },
    );
    this._streamingEmitter.on(
      StreamingEventType.RequestStreamItems,
      (streamId: string, numItems: number) => {
        this.requestStreamItems(streamId, numItems);
      },
    );
    this._streamingEmitter.on(
      StreamingEventType.StreamResult,
      (result: ResultPb) => {
        this.handleResult(result);
      },
    );
    this._streamingEmitter.on(
      StreamingEventType.StreamFinished,
      // TODO:  should we pass in the streamId?
      () => {
        this.checkRequestComplete();
      },
    );
  }

  registerStream(streamResult: StreamResult) {
    this._streamRegistry[streamResult.streamId] = streamResult;
    this._registryEmitter.emit(
      RegistryEventType.RegisterStream,
      this._runId,
      streamResult.streamId,
    );
  }

  handleResult(result: ResultPb) {
    this._resultQueue.push(result);
    if (this.shouldSendResults()) {
      this.sendResults(() => {
        this.readyForNextBatch();
      });
    }
  }

  sendResults(callback: () => void) {
    this._readyToSend = false;
    if (this._batchSize == 1) {
      this._lastTimeSentToDriver = Date.now();
      this.sendResultToDriver(this._resultQueue.shift() as ResultPb, callback);
    } else {
      const batchedResult = new BatchedResultPb();
      batchedResult.setResultList(this._resultQueue.splice(0, this._batchSize));
      const finalResult = new ResultPb();
      finalResult.setBatched(batchedResult);
      this._lastTimeSentToDriver = Date.now();
      this.sendResultToDriver(finalResult, callback);
    }
  }

  drainResultQueue() {
    if (this._resultQueue.length > 0) {
      // Only start draining if no external send is already in flight; that
      // send's readyForNextBatch() -> checkRequestComplete() will re-enter
      // here once it completes. Within our own drain loop we reset
      // _readyToSend after each flush so multi-batch residuals fully drain.
      if (this._readyToSend) {
        this.sendResults(() => {
          this._readyToSend = true;
          this.drainResultQueue();
        });
      }
    } else {
      this._registryEmitter.emit(
        RegistryEventType.UnregisterExecutor,
        this._runId,
      );
      this._call.end();
    }
  }

  readyForNextBatch() {
    this._readyToSend = true;
    // in case we have more to send
    if (this.shouldSendResults(false)) {
      this.sendResults(() => {
        this.readyForNextBatch();
      });
    } else {
      this.checkRequestComplete();
    }
  }

  shouldSendResults(checkReadyToSend = true): boolean {
    let sendDueToDelay = false;
    let timeDelta = Date.now();
    if (this._lastTimeSentToDriver) {
      timeDelta =
        Date.now() -
        (this._lastTimeSentToDriver + this._timeToWaitToSendToDriverMillis);
      sendDueToDelay = this._resultQueue.length > 0 && timeDelta > 0;
    }

    if (checkReadyToSend) {
      // TODO:  remove eventually, used right now for diagnostics to see if we _actually_ run into this scenario
      if (
        !(this._readyToSend && this._resultQueue.length >= this._batchSize) &&
        sendDueToDelay
      ) {
        console.debug(
          `sendDueToDelay=true, resultQueue.length=${this._resultQueue.length}, timeDelta=${timeDelta}`,
        );
      }
      return (
        (this._readyToSend && this._resultQueue.length >= this._batchSize) ||
        sendDueToDelay
      );
    }
    // TODO:  remove eventually, used right now for diagnostics to see if we _actually_ run into this scenario
    if (!(this._resultQueue.length >= this._batchSize) && sendDueToDelay) {
      console.debug(
        `sendDueToDelay=true, resultQueue.length=${this._resultQueue.length}, timeDelta=${timeDelta}`,
      );
    }
    return this._resultQueue.length >= this._batchSize || sendDueToDelay;
  }

  sendResultToDriver(result: ResultPb, cb: () => void) {
    if (!this._call.write(result)) {
      this._call.once("drain", cb);
    } else {
      process.nextTick(cb);
    }
  }

  checkRequestComplete() {
    const allStreamsDone =
      Object.keys(this._streamRegistry).length == 0 ||
      Object.values(this._streamRegistry).every(
        (s) => !s.hasStreamStarted || s.isStreamCancelled || s.isStreamFinished,
      );
    if (allStreamsDone && this._workloadsFinished) {
      this.drainResultQueue();
    }
  }

  cancelStream(streamId: string) {
    if (streamId in this._streamRegistry) {
      this._streamRegistry[streamId].cancelStream();
    } else {
      console.error(
        `RequestExecutor.cancelStream() - cannot find stream with id=${streamId}.`,
      );
    }
  }

  requestStreamItems(streamId: string, numItems: number) {
    if (streamId in this._streamRegistry) {
      this._streamRegistry[streamId].requestItems(numItems);
    } else {
      console.error(
        `RequestExecutor.requestStreamItems() - cannot find stream with id=${streamId}.`,
      );
    }
  }

  async _executeWorkload(
    hs: HorizontalScalingPb,
    connection: Connection,
    spanOwner?: ISpanOwner,
  ) {
    for (const workload of hs.getWorkloadsList()) {
      switch (workload.getWorkloadCase()) {
        case WorkloadPb.WorkloadCase.SDK: {
          const sdkWorkload = new SdkWorkload(
            workload.getSdk() as SdkWorkloadPb,
            connection,
            this._counters,
            spanOwner,
          );
          await sdkWorkload.executeWorkload(this._streamingEmitter);
          break;
        }
        case WorkloadPb.WorkloadCase.GRPC:
          throw new NotImplementedError("Meta workloads");
        case WorkloadPb.WorkloadCase.TRANSACTION:
          throw new NotImplementedError("Transaction workloads");
        default:
          throw new NotImplementedError("Unknown");
      }
    }
  }

  async executeWorkloads(connection: Connection, spanOwner?: ISpanOwner) {
    const workloads = this._requestWorkloads
      .getHorizontalScalingList()
      .map((hs) => this._executeWorkload(hs, connection, spanOwner));
    await Promise.all(workloads);
    this._workloadsFinished = true;
    this.checkRequestComplete();
  }
}
