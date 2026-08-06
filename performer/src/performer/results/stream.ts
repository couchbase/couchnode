import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";

import { Result as ResultPb } from "../../proto/run.top_level_pb";
import { Result as SdkKeyValueCommandResultPb } from "../../proto/sdk.workload_pb";
import {
  Cancelled as StreamCancelledPb,
  Complete as StreamCompletePb,
  Created as StreamCreatedPb,
  Error as StreamErrorPb,
  Signal as StreamSignalPb,
  Type as StreamTypePb,
} from "../../proto/streams.top_level_pb";
import { ContentAs as ContentAsPb } from "../../proto/shared.content_pb";
import { Exception as ExceptionPb } from "../../proto/shared.exceptions_pb";

import { GetReplicaResult } from "couchbase";

import { SdkKeyValueCommandResult } from "../results/keyValueResult";
import { SdkCommandResult } from "../results/result";
import { StreamingEventEmitter, StreamingEventType } from "../eventEmitter";

export type StreamConfig = {
  streamId: string;
  onDemand: boolean;
  streamType: StreamTypePb;
};

class StreamSignal {
  static getStreamCreatedSignalResult(streamConfig: StreamConfig): ResultPb {
    const result = new ResultPb();
    const signal = new StreamSignalPb();
    const created = new StreamCreatedPb();
    created.setStreamId(streamConfig.streamId);
    created.setType(streamConfig.streamType);
    signal.setCreated(created);
    result.setStream(signal);
    return result;
  }

  static getStreamCancelledSignalResult(streamConfig: StreamConfig): ResultPb {
    const result = new ResultPb();
    const signal = new StreamSignalPb();
    const cancelled = new StreamCancelledPb();
    cancelled.setStreamId(streamConfig.streamId);
    signal.setCancelled(cancelled);
    result.setStream(signal);
    return result;
  }

  static getStreamCompletedSignalResult(streamConfig: StreamConfig): ResultPb {
    const result = new ResultPb();
    const signal = new StreamSignalPb();
    const completed = new StreamCompletePb();
    completed.setStreamId(streamConfig.streamId);
    signal.setComplete(completed);
    result.setStream(signal);
    return result;
  }

  static getStreamErroredSignalResult(
    streamConfig: StreamConfig,
    exception: ExceptionPb,
  ): ResultPb {
    const result = new ResultPb();
    const signal = new StreamSignalPb();
    const error = new StreamErrorPb();
    error.setStreamId(streamConfig.streamId);
    error.setException(exception);
    signal.setError(error);
    result.setStream(signal);
    return result;
  }
}

export class StreamResult {
  private readonly _streamConfig: StreamConfig;
  private _streamingEmitter: StreamingEventEmitter;
  private _cancelled: boolean;
  private _finished: boolean;
  private _numItemsToStream: number;
  private _stream: Promise<void> | Promise<GetReplicaResult[]> | undefined;
  private _streamQueue: ResultPb[] = [];
  private _started: boolean;

  constructor(
    streamConfig: StreamConfig,
    streamingEmitter: StreamingEventEmitter,
  ) {
    this._streamConfig = streamConfig;
    this._streamingEmitter = streamingEmitter;
    this._started = false;
    this._cancelled = false;
    this._finished = false;
    this._numItemsToStream = 0;
  }

  get streamId(): string {
    return this._streamConfig.streamId;
  }

  get isStreamOnDemand(): boolean {
    return this._streamConfig.onDemand;
  }

  get hasStreamStarted(): boolean {
    return this._started;
  }

  get isStreamCancelled(): boolean {
    return this._cancelled;
  }

  get isStreamFinished(): boolean {
    return this._finished;
  }

  drainStreamQueue() {
    console.log(`Stream=${this.streamId}, draining stream queue.`);
    // Once the stream is ending (finished/cancelled) we must flush every
    // remaining queued item before the terminal signal, regardless of the
    // requested-item budget; otherwise the tail of the stream is dropped.
    // During normal operation we only emit up to the requested budget.
    while (
      this._streamQueue.length > 0 &&
      (this._numItemsToStream > 0 || this._finished || this._cancelled)
    ) {
      this._streamingEmitter.emit(
        StreamingEventType.StreamResult,
        this._streamQueue.shift() as ResultPb,
      );
      if (this._numItemsToStream > 0) {
        this._numItemsToStream--;
      }
    }
  }

  newItem(result: ResultPb) {
    if (!this.isStreamOnDemand) {
      this._streamingEmitter.emit(StreamingEventType.StreamResult, result);
    } else {
      if (!(this._cancelled || this._finished)) {
        if (this._numItemsToStream == 0) {
          this._streamQueue.push(result);
        } else {
          this._streamingEmitter.emit(StreamingEventType.StreamResult, result);
          this._numItemsToStream--;
        }
      }
    }
  }

  streamFinished() {
    this._finished = true;
    this.drainStreamQueue();
    console.log(`Sending stream END. streamId=${this._streamConfig.streamId}`);
    this._streamingEmitter.emit(
      StreamingEventType.StreamResult,
      StreamSignal.getStreamCompletedSignalResult(this._streamConfig),
    );
    this._streamingEmitter.emit(
      StreamingEventType.StreamFinished,
      this.streamId,
    );
  }

  streamError(error: ExceptionPb) {
    this._finished = true;
    this.drainStreamQueue();
    console.log(
      `Sending stream ERROR. streamId=${this._streamConfig.streamId}`,
    );
    this._streamingEmitter.emit(
      StreamingEventType.StreamResult,
      StreamSignal.getStreamErroredSignalResult(this._streamConfig, error),
    );
    this._streamingEmitter.emit(
      StreamingEventType.StreamFinished,
      this.streamId,
    );
  }

  cancelStream() {
    if (this.isStreamOnDemand) {
      this._cancelled = true;
      this.drainStreamQueue();
      console.log(
        `Sending stream CANCEL. streamId=${this._streamConfig.streamId}`,
      );
      this._streamingEmitter.emit(
        StreamingEventType.StreamResult,
        StreamSignal.getStreamCancelledSignalResult(this._streamConfig),
      );
      this._streamingEmitter.emit(
        StreamingEventType.StreamFinished,
        this.streamId,
      );
    } else {
      console.error("Cannot cancel an automatic stream.");
    }
  }

  async registerStream(stream: Promise<void>) {
    this._stream = stream;
    this._streamingEmitter.emit(StreamingEventType.RegisterStream, this);
    await this._stream;
    console.log(
      `Sending stream CREATED. streamId=${this._streamConfig.streamId}`,
    );
    this._streamingEmitter.emit(
      StreamingEventType.StreamResult,
      StreamSignal.getStreamCreatedSignalResult(this._streamConfig),
    );
    this._started = true;
  }

  // TODO:  allow streaming in the SDK??
  async registerGetAllReplicaStream(
    stream: Promise<GetReplicaResult[]>,
    initiated: Timestamp,
    contentAs?: ContentAsPb,
  ) {
    this._stream = stream;
    this._streamingEmitter.emit(StreamingEventType.RegisterStream, this);
    const replicas = await this._stream;
    console.log(
      `Sending stream CREATED (from getAllReplicas()). streamId=${this._streamConfig.streamId}`,
    );
    this._streamingEmitter.emit(
      StreamingEventType.StreamResult,
      StreamSignal.getStreamCreatedSignalResult(this._streamConfig),
    );
    this._started = true;
    for (const replica of replicas) {
      const sdkCommandResult = new SdkKeyValueCommandResultPb();
      sdkCommandResult.setGetReplicaResult(
        SdkKeyValueCommandResult.toGetReplicaResultPb(
          replica,
          contentAs,
          this._streamConfig.streamId,
        ),
      );
      this.newItem(
        SdkCommandResult.getTopLevelResult(initiated, sdkCommandResult),
      );
    }
  }

  requestItems(numItems: number) {
    if (this._numItemsToStream != 0) {
      throw new Error(
        "Cannot request more items from " +
          this.streamId +
          " as it has not finished streaming the previous items.",
      );
    }
    this._numItemsToStream += numItems;
    console.info(
      `Added ${numItems} items to stream (numItemsToStream=${this._numItemsToStream}).`,
    );
    // we might have items that have queued up
    this.drainStreamQueue();
  }
}
