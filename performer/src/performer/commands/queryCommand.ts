import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";
import { ContentAs as ContentAsPb } from "../../proto/shared.content_pb";
import {
  ClusterLevelCommand as ClusterLevelCommandPb,
  ScopeLevelCommand as ScopeLevelCommandPb,
} from "../../proto/sdk.workload_pb";
import { Result as SdkCommandResultPb } from "../../proto/sdk.workload_pb";
import { Result as ResultPb } from "../../proto/run.top_level_pb";
import { Scope as ScopePb } from "../../proto/shared.collection_pb";

import { Command as QueryCommandPb } from "../../proto/sdk.query_pb";

import {
  Cluster,
  Scope,
  QueryOptions,
  QueryResult,
  // TODO:  implement when FIT adds streaming query result
  // QueryMetaData,
  // StreamableRowPromise,
} from "couchbase";

import { ISdkCommand } from "./command";
import { SdkQueryCommandResult } from "../results/queryResult";
import { SdkCommandResult } from "../results/result";
import { StreamConfig, StreamResult } from "../results/stream";
import { SdkCommandQueryOptions } from "../options/queryOptions";
import { NotImplementedError } from "../error";
import { ISpanOwner } from "../observability/observabilityTypes";
import { maybeAddParentSpan } from "../observability/utils";

export class SdkQueryCommand implements ISdkCommand {
  private _connection: Cluster | Scope;
  private _statement: string;
  private _initiated: Timestamp;
  private _returnResult: boolean | undefined;
  private _streamConfig: StreamConfig | undefined;
  private _options: QueryOptions = {};
  private _contentAs: ContentAsPb | undefined;

  constructor(
    connection: Cluster | Scope,
    statement: string,
    initiated: Timestamp,
    returnResult?: boolean,
    streamConfig?: StreamConfig,
  ) {
    this._connection = connection;
    this._statement = statement;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._streamConfig = streamConfig;
  }

  // TODO:  implement when FIT adds streaming query result
  // setStreamEvents<TRow = any>(
  //   streamablePromise: StreamableRowPromise<
  //     QueryResult<TRow>,
  //     TRow,
  //     QueryMetaData
  //   >,
  //   streamResult: StreamResult
  // ) {
  //   streamablePromise
  //     .on("row", (row: TRow) => {
  //       const sdkCommandResult = new SdkCommandResultPb();

  //       streamResult.newItem(
  //         SdkCommandResult.getTopLevelResult(this._initiated, sdkCommandResult)
  //       );
  //     })
  //     .on("meta", (metadata: any) => {
  //       let sdkCommandResult = new SdkCommandResultPb();
  //       // TODO:  streaming query metadata result
  //       let queryMetaData = SdkQueryCommandResult.toQueryMetadata(metadata);
  //       streamResult.newItem(
  //         SdkCommandResult.getTopLevelResult(this._initiated, sdkCommandResult)
  //       );
  //     })
  //     .on("end", () => {
  //       streamResult.streamFinished();
  //     })
  //     .on("error", (err) => {
  //       streamResult.streamError(err);
  //     });
  // }

  async executeCommand(streamResult?: StreamResult): Promise<void | ResultPb> {
    if (this.hasStreamConfig() && streamResult) {
      // const result = this._connection.query(this._statement, this._options);
      // this.setStreamEvents(result, streamResult);
      throw new NotImplementedError("Unimplemented scope command.");
    } else {
      const result = await this._connection.query(
        this._statement,
        this._options,
      );
      const sdkCommandResult = new SdkCommandResultPb();
      sdkCommandResult.setSuccess(result instanceof QueryResult);
      if (this._returnResult) {
        sdkCommandResult.setQueryResult(
          SdkQueryCommandResult.toQueryResult(
            result,
            this._contentAs as ContentAsPb,
          ),
        );
      }
      return SdkCommandResult.getTopLevelResult(
        this._initiated,
        sdkCommandResult,
      );
    }
  }

  hasStreamConfig(): boolean {
    return typeof this._streamConfig != "undefined";
  }

  getStreamConfig(): StreamConfig | undefined {
    return this._streamConfig;
  }

  setSdkCommandOptions(options: QueryOptions) {
    this._options = options;
  }

  setSdkCommandContentAs(contentAs: ContentAsPb) {
    this._contentAs = contentAs;
  }

  static buildCommand(
    cmd: ClusterLevelCommandPb | ScopeLevelCommandPb,
    connection: Cluster,
    initiated: Timestamp,
    returnResult: boolean,
    spanOwner?: ISpanOwner,
  ): SdkQueryCommand {
    const command = cmd.getQuery() as QueryCommandPb;
    let sdkCommand: SdkQueryCommand | undefined;
    if (cmd instanceof ScopeLevelCommandPb) {
      const scopeDetails = cmd.getScope() as ScopePb;
      const scope = connection
        .bucket(scopeDetails.getBucketName())
        .scope(scopeDetails.getScopeName());
      sdkCommand = new SdkQueryCommand(
        scope,
        command.getStatement(),
        initiated,
        returnResult,
      );
    } else {
      sdkCommand = new SdkQueryCommand(
        connection,
        command.getStatement(),
        initiated,
        returnResult,
      );
    }

    sdkCommand.setSdkCommandOptions(
      maybeAddParentSpan(
        SdkCommandQueryOptions.toSdkQueryOptions(command.getOptions()),
        command.getOptions(),
        spanOwner,
      ),
    );
    if (command.hasContentAs()) {
      sdkCommand.setSdkCommandContentAs(command.getContentAs() as ContentAsPb);
    }
    return sdkCommand;
  }
}
