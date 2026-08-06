import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";
import { Result as ResultPb } from "../../proto/run.top_level_pb";
import { Result as SdkCommandResultPb } from "../../proto/sdk.workload_pb";

export class Result {
  private readonly _resultPb: ResultPb;
  constructor(result: ResultPb) {
    this._resultPb = result;
  }

  get result(): ResultPb {
    return this._resultPb;
  }

  static createResult(result: ResultPb): Result {
    return new Result(result);
  }
}

export class SdkCommandResult {
  static getTopLevelResult(
    initiated: Timestamp,
    sdkCommandResult?: SdkCommandResultPb,
    start?: number,
    end?: number,
  ): ResultPb {
    const result = new ResultPb();
    result.setSdk(sdkCommandResult);
    if (start && end) {
      result.setElapsednanos(Math.round((end - start) * 1e6));
    }
    result.setInitiated(initiated);
    return result;
  }
}
