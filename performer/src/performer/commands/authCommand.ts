import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";

import { Authenticator as AuthenticatorPb } from "../../proto/shared.cluster_pb";
import { Result as ResultPb } from "../../proto/run.top_level_pb";
import {
  ClusterLevelCommand as ClusterLevelCommandPb,
  Result as SdkCommandResultPb,
} from "../../proto/sdk.workload_pb";

import { Authenticator, Cluster } from "couchbase";

import { ISdkCommand } from "./command";
import { SdkCommandResult } from "../results/result";
import { SdkUtils } from "../utils";

export interface ISdkAuthCommand {
  executeCommand(): Promise<ResultPb>;
}

class UpdateAuthenticatorCommand implements ISdkAuthCommand {
  private _connection: Cluster;
  private _initiated: Timestamp;
  private _authenticator: Authenticator;

  constructor(
    connection: Cluster,
    initiated: Timestamp,
    authenticator: Authenticator,
  ) {
    this._connection = connection;
    this._initiated = initiated;
    this._authenticator = authenticator;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    // [if:4.7.0]
    this._connection.updateCredentials(this._authenticator);
    // [end]
    const end = performance.now();
    const sdkCommandResult = new SdkCommandResultPb();
    sdkCommandResult.setSuccess(true);
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }
}

export class SdkAuthCommand implements ISdkCommand {
  private _authCommand: ISdkAuthCommand;

  constructor(authCommand: ISdkAuthCommand) {
    this._authCommand = authCommand;
  }

  async executeCommand(): Promise<ResultPb> {
    return await this._authCommand.executeCommand();
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }

  static buildCommand(
    cmd: ClusterLevelCommandPb,
    connection: Cluster,
    initiated: Timestamp,
  ): SdkAuthCommand {
    const authenticator = SdkUtils.getAuthenticator(
      cmd.getAuthenticator() as AuthenticatorPb,
    );
    const authCommand = new UpdateAuthenticatorCommand(
      connection,
      initiated,
      authenticator,
    );
    return new SdkAuthCommand(authCommand);
  }
}
