import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";
import { Result as ResultPb } from "../../proto/run.top_level_pb";
import {
  ClusterLevelCommand as ClusterLevelCommandPb,
  Result as SdkCommandResultPb,
  CollectionLevelCommand as CollectionLevelCommandPb,
} from "../../proto/sdk.workload_pb";
import {
  Command as QueryIndexManagerCommandPb,
  CreateIndex as CreateIndexPb,
  CreatePrimaryIndex as CreatePrimaryIndexPb,
  GetAllIndexes as GetAllIndexesPb,
  DropIndex as DropIndexPb,
  DropPrimaryIndex as DropPrimaryIndexPb,
  BuildDeferredIndexes as BuildDeferredIndexesPb,
  WatchIndexes as WatchIndexesPb,
} from "../../proto/sdk.query.index_manager_pb";
import { Command as ClusterQueryIndexManagerCommandPb } from "../../proto/sdk.cluster.query.index_manager_pb";

import {
  Cluster,
  Collection,
  CreateQueryIndexOptions,
  CreatePrimaryQueryIndexOptions,
  DropQueryIndexOptions,
  DropPrimaryQueryIndexOptions,
  GetAllQueryIndexesOptions,
  BuildQueryIndexOptions,
  WatchQueryIndexOptions,
  QueryIndex,
} from "couchbase";

import { ISdkCommand } from "./command";
import { SdkCommandQueryIndexMmgtOptions } from "../options/queryIndexMgmtOptions";
import { SdkQueryIndexMgmtCommandResult } from "../results/queryIndexMgmtResult";
import { SdkCommandResult } from "../results/result";
import { ISpanOwner } from "../observability/observabilityTypes";
import { maybeAddParentSpan } from "../observability/utils";

export interface ISdkQueryIndexMgmtCommand {
  executeCommand(): Promise<ResultPb>;
}

class CreateIndexCommand implements ISdkQueryIndexMgmtCommand {
  private _connection: Cluster | Collection;
  private _bucketName: string | undefined;
  private _indexName: string;
  private _fields: string[];
  private _initiated: Timestamp;
  private _options: CreateQueryIndexOptions;

  constructor(
    connection: Cluster | Collection,
    indexName: string,
    fields: string[],
    initiated: Timestamp,
    bucketName?: string,
    options?: CreateQueryIndexOptions,
  ) {
    this._connection = connection;
    this._indexName = indexName;
    this._fields = fields;
    this._initiated = initiated;
    this._bucketName = bucketName;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    let start: number | undefined = undefined;
    let end: number | undefined = undefined;
    if (this._connection instanceof Cluster) {
      start = performance.now();
      await this._connection
        .queryIndexes()
        .createIndex(
          this._bucketName as string,
          this._indexName,
          this._fields,
          this._options,
        );
      end = performance.now();
    }
    // [if:4.2.2]
    else if (this._connection instanceof Collection) {
      start = performance.now();
      await this._connection
        .queryIndexes()
        .createIndex(this._indexName, this._fields, this._options);
      end = performance.now();
    }
    // [end]
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

class CreatePrimaryIndexCommand implements ISdkQueryIndexMgmtCommand {
  private _connection: Cluster | Collection;
  private _bucketName: string | undefined;
  private _initiated: Timestamp;
  private _options: CreatePrimaryQueryIndexOptions;

  constructor(
    connection: Cluster | Collection,
    initiated: Timestamp,
    bucketName?: string,
    options?: CreatePrimaryQueryIndexOptions,
  ) {
    this._connection = connection;
    this._initiated = initiated;
    this._bucketName = bucketName;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    let start: number | undefined = undefined;
    let end: number | undefined = undefined;
    if (this._connection instanceof Cluster) {
      start = performance.now();
      await this._connection
        .queryIndexes()
        .createPrimaryIndex(this._bucketName as string, this._options);
      end = performance.now();
    }
    // [if:4.2.2]
    else if (this._connection instanceof Collection) {
      start = performance.now();
      await this._connection.queryIndexes().createPrimaryIndex(this._options);
      end = performance.now();
    }
    // [end]
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

class DropQueryIndexCommand implements ISdkQueryIndexMgmtCommand {
  private _connection: Cluster | Collection;
  private _indexName: string;
  private _bucketName: string | undefined;
  private _initiated: Timestamp;
  private _options: DropQueryIndexOptions;

  constructor(
    connection: Cluster | Collection,
    indexName: string,
    initiated: Timestamp,
    bucketName?: string,
    options?: DropQueryIndexOptions,
  ) {
    this._connection = connection;
    this._indexName = indexName;
    this._initiated = initiated;
    this._bucketName = bucketName;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    let start: number | undefined = undefined;
    let end: number | undefined = undefined;
    if (this._connection instanceof Cluster) {
      start = performance.now();
      await this._connection
        .queryIndexes()
        .dropIndex(this._bucketName as string, this._indexName, this._options);
      end = performance.now();
    }
    // [if:4.2.2]
    else if (this._connection instanceof Collection) {
      start = performance.now();
      await this._connection
        .queryIndexes()
        .dropIndex(this._indexName, this._options);
      end = performance.now();
    }
    // [end]
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

class DropPrimaryQueryIndexCommand implements ISdkQueryIndexMgmtCommand {
  private _connection: Cluster | Collection;
  private _bucketName: string | undefined;
  private _initiated: Timestamp;
  private _options: DropPrimaryQueryIndexOptions;

  constructor(
    connection: Cluster | Collection,
    initiated: Timestamp,
    bucketName?: string,
    options?: DropQueryIndexOptions,
  ) {
    this._connection = connection;
    this._initiated = initiated;
    this._bucketName = bucketName;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    let start: number | undefined = undefined;
    let end: number | undefined = undefined;
    if (this._connection instanceof Cluster) {
      start = performance.now();
      await this._connection
        .queryIndexes()
        .dropPrimaryIndex(this._bucketName as string, this._options);
      end = performance.now();
    }
    // [if:4.2.2]
    else if (this._connection instanceof Collection) {
      start = performance.now();
      await this._connection.queryIndexes().dropPrimaryIndex(this._options);
      end = performance.now();
    }
    // [end]
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

class GetAllQueryIndexesCommand implements ISdkQueryIndexMgmtCommand {
  private _connection: Cluster | Collection;
  private _bucketName: string | undefined;
  private _initiated: Timestamp;
  private _options: GetAllQueryIndexesOptions;

  constructor(
    connection: Cluster | Collection,
    initiated: Timestamp,
    bucketName?: string,
    options?: GetAllQueryIndexesOptions,
  ) {
    this._connection = connection;
    this._initiated = initiated;
    this._bucketName = bucketName;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    let start: number | undefined = undefined;
    let end: number | undefined = undefined;
    let indexes: QueryIndex[] = [];
    if (this._connection instanceof Cluster) {
      start = performance.now();
      indexes = await this._connection
        .queryIndexes()
        .getAllIndexes(this._bucketName as string, this._options);
      end = performance.now();
    }
    // [if:4.2.2]
    else if (this._connection instanceof Collection) {
      start = performance.now();
      indexes = await this._connection
        .queryIndexes()
        .getAllIndexes(this._options);
      end = performance.now();
    }
    // [end]
    const sdkCommandResult = new SdkCommandResultPb();
    sdkCommandResult.setQueryIndexes(
      SdkQueryIndexMgmtCommandResult.toQueryIndexMgmtResultWithIndexes(indexes),
    );
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }
}

class BuildQueryIndexCommand implements ISdkQueryIndexMgmtCommand {
  private _connection: Cluster | Collection;
  private _bucketName: string | undefined;
  private _initiated: Timestamp;
  private _options: BuildQueryIndexOptions;

  constructor(
    connection: Cluster | Collection,
    initiated: Timestamp,
    bucketName?: string,
    options?: BuildQueryIndexOptions,
  ) {
    this._connection = connection;
    this._initiated = initiated;
    this._bucketName = bucketName;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    let start: number | undefined = undefined;
    let end: number | undefined = undefined;
    if (this._connection instanceof Cluster) {
      start = performance.now();
      await this._connection
        .queryIndexes()
        .buildDeferredIndexes(this._bucketName as string, this._options);
      end = performance.now();
    }
    // [if:4.2.2]
    else if (this._connection instanceof Collection) {
      start = performance.now();
      await this._connection.queryIndexes().buildDeferredIndexes(this._options);
      end = performance.now();
    }
    // [end]
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

class WatchQueryIndexCommand implements ISdkQueryIndexMgmtCommand {
  private _connection: Cluster | Collection;
  private _indexNames: string[];
  private _timeout: number;
  private _bucketName: string | undefined;
  private _initiated: Timestamp;
  private _options: WatchQueryIndexOptions;

  constructor(
    connection: Cluster | Collection,
    indexNames: string[],
    timeout: number,
    initiated: Timestamp,
    bucketName?: string,
    options?: WatchQueryIndexOptions,
  ) {
    this._connection = connection;
    this._indexNames = indexNames;
    this._timeout = timeout;
    this._initiated = initiated;
    this._bucketName = bucketName;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    let start: number | undefined = undefined;
    let end: number | undefined = undefined;
    if (this._connection instanceof Cluster) {
      start = performance.now();
      await this._connection
        .queryIndexes()
        .watchIndexes(
          this._bucketName as string,
          this._indexNames,
          this._timeout,
          this._options,
        );
      end = performance.now();
    }
    // [if:4.2.2]
    else if (this._connection instanceof Collection) {
      start = performance.now();
      await this._connection
        .queryIndexes()
        .watchIndexes(this._indexNames, this._timeout, this._options);
      end = performance.now();
    }
    // [end]
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

class SdkQueryIndexMgmtCommandBuilder {
  static buildQueryIndexMgmtCommand(
    connection: Cluster | Collection,
    command: QueryIndexManagerCommandPb,
    initiated: Timestamp,
    bucketName?: string,
    spanOwner?: ISpanOwner,
  ): ISdkQueryIndexMgmtCommand {
    if (command.hasCreateIndex()) {
      const cmd = command.getCreateIndex() as CreateIndexPb;
      return new CreateIndexCommand(
        connection,
        cmd.getIndexName(),
        cmd.getFieldsList(),
        initiated,
        bucketName,
        maybeAddParentSpan(
          SdkCommandQueryIndexMmgtOptions.toCreateQueryIndexOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasCreatePrimaryIndex()) {
      const cmd = command.getCreatePrimaryIndex() as CreatePrimaryIndexPb;
      return new CreatePrimaryIndexCommand(
        connection,
        initiated,
        bucketName,
        maybeAddParentSpan(
          SdkCommandQueryIndexMmgtOptions.toCreatePrimaryQueryIndexOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasGetAllIndexes()) {
      const cmd = command.getGetAllIndexes() as GetAllIndexesPb;
      return new GetAllQueryIndexesCommand(
        connection,
        initiated,
        bucketName,
        maybeAddParentSpan(
          SdkCommandQueryIndexMmgtOptions.toGetAllQueryIndexesOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasDropIndex()) {
      const cmd = command.getDropIndex() as DropIndexPb;
      return new DropQueryIndexCommand(
        connection,
        cmd.getIndexName(),
        initiated,
        bucketName,
        maybeAddParentSpan(
          SdkCommandQueryIndexMmgtOptions.toDropQueryIndexOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasDropPrimaryIndex()) {
      const cmd = command.getDropPrimaryIndex() as DropPrimaryIndexPb;
      return new DropPrimaryQueryIndexCommand(
        connection,
        initiated,
        bucketName,
        maybeAddParentSpan(
          SdkCommandQueryIndexMmgtOptions.toDropPrimaryQueryIndexOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasBuildDeferredIndexes()) {
      const cmd = command.getBuildDeferredIndexes() as BuildDeferredIndexesPb;
      return new BuildQueryIndexCommand(
        connection,
        initiated,
        bucketName,
        maybeAddParentSpan(
          SdkCommandQueryIndexMmgtOptions.toBuildQueryIndexOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasWatchIndexes()) {
      const cmd = command.getWatchIndexes() as WatchIndexesPb;
      return new WatchQueryIndexCommand(
        connection,
        cmd.getIndexNamesList(),
        cmd.getTimeoutMsecs(),
        initiated,
        bucketName,
        maybeAddParentSpan(
          SdkCommandQueryIndexMmgtOptions.toWatchQueryIndexOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else {
      throw new Error("Invalid query index management command type.");
    }
  }
}

export class SdkQueryIndexMgmtCommand implements ISdkCommand {
  private _mgmtCommand: ISdkQueryIndexMgmtCommand;

  constructor(mgmtCommand: ISdkQueryIndexMgmtCommand) {
    this._mgmtCommand = mgmtCommand;
  }

  async executeCommand(): Promise<ResultPb> {
    return await this._mgmtCommand.executeCommand();
  }

  hasStreamConfig(): boolean {
    return false;
  }

  getStreamConfig(): undefined {
    return undefined;
  }

  static buildCommand(
    cmd: ClusterLevelCommandPb | CollectionLevelCommandPb,
    connection: Cluster | Collection,
    initiated: Timestamp,
    spanOwner?: ISpanOwner,
  ): SdkQueryIndexMgmtCommand {
    const command = cmd
      .getQueryIndexManager()
      ?.getShared() as QueryIndexManagerCommandPb;
    if (cmd instanceof ClusterLevelCommandPb) {
      const bucketName = (
        cmd.getQueryIndexManager() as ClusterQueryIndexManagerCommandPb
      ).getBucketName();
      const mgmtCommand =
        SdkQueryIndexMgmtCommandBuilder.buildQueryIndexMgmtCommand(
          connection,
          command,
          initiated,
          bucketName,
          spanOwner,
        );
      return new SdkQueryIndexMgmtCommand(mgmtCommand);
    } else {
      const mgmtCommand =
        SdkQueryIndexMgmtCommandBuilder.buildQueryIndexMgmtCommand(
          connection,
          command,
          initiated,
          undefined,
          spanOwner,
        );
      return new SdkQueryIndexMgmtCommand(mgmtCommand);
    }
  }
}
