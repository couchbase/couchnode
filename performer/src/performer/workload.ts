import {
  Command as SdkWorkloadCommandPb,
  Workload as SdkWorkloadPb,
  Result as SdkCommandResultPb,
} from "../proto/sdk.workload_pb";
import {
  Counter as CounterPb,
  ForTime as ForTimePb,
} from "../proto/shared.bounds_pb";
import { Type as StreamTypePb } from "../proto/streams.top_level_pb";
import { Result as ResultPb } from "../proto/run.top_level_pb";

import { GetReplicaResult } from "couchbase";

import { CommandBuilder } from "./commands/commandBuilder";
import { SdkGetAllReplicasCommand } from "./commands/keyValueCommand";
import { StreamingEventEmitter, StreamingEventType } from "./eventEmitter";
import { SdkError } from "./error";
import { Connection } from "./registry";
import { StreamConfig, StreamResult } from "./results/stream";
import { SdkCommandResult } from "./results/result";
import { SdkUtils } from "./utils";
import { ISpanOwner } from "./observability/observabilityTypes";
import {
  BoundsExecutor,
  Counter,
  CounterBoundsExecutor,
  CounterEqualsBoundsExecutor,
  Counters,
  TimeBoundsExecutor,
} from "./bounds";

/*
TODO:
- I think we can expand this to to have other workloads that handle worker_threads and maybe multiprocessing.
    - I believe we have access to SharedArrayBuffer + Atomics w/ worker_threads
    - I think w/ multiprocessing working out how to synchronize a global counter is something to think, with worker_threads
- Also, if going this route I think we add:
  - an event emitterto the workload that transfers results to the requestExecutor
  - a stream registry b/c the stream tracking would need to be done w/in the various worker_threads/process

*/

export class SdkWorkload {
  private readonly _workloadCommandCount: number;
  private readonly _workload: SdkWorkloadPb;
  private readonly _connection: Connection;
  private _counters: Counters;
  private _spanOwner: ISpanOwner | undefined;

  constructor(
    workload: SdkWorkloadPb,
    connection: Connection,
    counters: Counters,
    spanOwner?: ISpanOwner,
  ) {
    this._workload = workload;
    this._connection = connection;
    this._workloadCommandCount = this._workload.getCommandList().length;
    this._counters = counters;
    this._spanOwner = spanOwner;
  }

  async executeWorkload(streamingEmitter: StreamingEventEmitter) {
    const bounds = this.bounds();

    let executedCommandCount = 0;
    while (bounds.canExecute()) {
      const command =
        this._workload.getCommandList()[
          executedCommandCount % this._workloadCommandCount
        ];
      await this.executeCommand(command, streamingEmitter);
      executedCommandCount++;
    }
  }

  async executeCommand(
    command: SdkWorkloadCommandPb,
    streamingEmitter: StreamingEventEmitter,
  ) {
    const initiated = SdkUtils.getInitiated();
    try {
      const sdkCommand = CommandBuilder.buildSdkCommand(
        command,
        this._counters,
        this._connection,
        initiated,
        this._spanOwner,
      );
      // TODO:  Until the C++ client supports HTTP streaming, we should not "fake" streaming w/ the performer.
      const streamingSupported = CommandBuilder.isStreamingHTTPComand(command)
        ? false
        : true;

      if (streamingSupported && sdkCommand.hasStreamConfig()) {
        const streamResult = new StreamResult(
          sdkCommand.getStreamConfig() as StreamConfig,
          streamingEmitter,
        );
        // maybe a sort of hack, reasoning (needs investigation):
        //  Have the StreamResult keep the promise so that executeCommand's streamablePromise isn't destroyed
        if (
          sdkCommand.getStreamConfig()?.streamType ==
          StreamTypePb.STREAM_KV_GET_ALL_REPLICAS
        ) {
          // TODO:  I don't like this, we should add streaming to Node.js SDK!
          // For now this will add all the results into the stream
          await streamResult.registerGetAllReplicaStream(
            sdkCommand.executeCommand() as Promise<GetReplicaResult[]>,
            initiated,
            (sdkCommand as SdkGetAllReplicasCommand).getContentAsPb(),
          );
          // need to make sure we indicate the stream is finished
          streamResult.streamFinished();
        } else {
          await streamResult.registerStream(
            sdkCommand.executeCommand(streamResult) as Promise<void>,
          );
        }
      } else {
        const result = await sdkCommand.executeCommand();
        streamingEmitter.emit(
          StreamingEventType.StreamResult,
          result as ResultPb,
        );
      }
    } catch (err) {
      console.log("Error trying to execute workload command: ", err);
      const sdkCommandResult = new SdkCommandResultPb();
      sdkCommandResult.setException(SdkError.toExceptionPb(err));
      streamingEmitter.emit(
        StreamingEventType.StreamResult,
        SdkCommandResult.getTopLevelResult(initiated, sdkCommandResult),
      );
    }
  }

  bounds(): BoundsExecutor {
    const bounds = this._workload.getBounds();
    if (!bounds) {
      return new CounterBoundsExecutor(new Counter(this._workloadCommandCount));
    }
    if (bounds.hasCounter()) {
      const counterPb = bounds.getCounter() as CounterPb;
      const counter = this._counters.get(counterPb);
      return new CounterBoundsExecutor(counter);
    } else if (bounds.hasForTime()) {
      const forTimeMillis =
        (bounds.getForTime() as ForTimePb).getSeconds() * 1000;
      const deadline = Date.now() + forTimeMillis;
      return new TimeBoundsExecutor(deadline);
    } else if (bounds.hasCounterEq()) {
      const counterPb = bounds.getCounterEq() as CounterPb;
      const counter = this._counters.get(counterPb);
      return new CounterEqualsBoundsExecutor(counter);
    } else {
      throw new Error("Unimplemented bounds type.");
    }
  }
}
