import { Result as ResultPb } from "../../proto/run.top_level_pb";
import { GetReplicaResult } from "couchbase";
import { StreamConfig, StreamResult } from "../results/stream";

export interface ISdkCommand {
  executeCommand(
    streamResult?: StreamResult,
  ): Promise<ResultPb | void | GetReplicaResult[]>;
  hasStreamConfig(): boolean;
  getStreamConfig(): StreamConfig | undefined;
}
