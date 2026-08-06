import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";
import { Result as ResultPb } from "../../proto/run.top_level_pb";
import {
  BucketLevelCommand as BucketLevelCommandPb,
  Result as SdkCommandResultPb,
} from "../../proto/sdk.workload_pb";

import {
  Command as CollectionManagerCommandPb,
  CreateCollectionRequest as CreateCollectionRequestPb,
  // [if:4.2.7]
  CreateCollectionSettings as CreateCollectionSettingsPb,
  // [end]
  CreateScopeRequest as CreateScopeRequestPb,
  DropCollectionRequest as DropCollectionRequestPb,
  DropScopeRequest as DropScopeRequestPb,
  GetAllScopesRequest as GetAllScopesRequestPb,
  // [if:4.2.7]
  UpdateCollectionRequest as UpdateCollectionRequestPb,
  UpdateCollectionSettings as UpdateCollectionSettingsPb,
  // [end]
} from "../../proto/sdk.bucket.collection_manager_pb";

import {
  Bucket,
  CreateCollectionOptions,
  CreateScopeOptions,
  DropCollectionOptions,
  DropScopeOptions,
  GetAllScopesOptions,
  ScopeSpec,
  // [if:4.2.7]
  CreateCollectionSettings,
  UpdateCollectionSettings,
  UpdateCollectionOptions,
  // [end]
} from "couchbase";

import { ISdkCommand } from "./command";
import { SdkCollectionMgmtOptions } from "../options/collectionMgmtOptions";
import { SdkCollectionMgmtCommandResult } from "../results/collectionMgmtResult";
import { SdkCommandResult } from "../results/result";
import { ISpanOwner } from "../observability/observabilityTypes";
import { maybeAddParentSpan } from "../observability/utils";

export interface ISdkCollectionMgmtCommand {
  executeCommand(): Promise<ResultPb>;
}

// [if:4.2.7]
class CreateCollectionCommand implements ISdkCollectionMgmtCommand {
  private _connection: Bucket;
  private _collectionName: string;
  private _scopeName: string;
  private _settings: CreateCollectionSettings;
  private _initiated: Timestamp;
  private _options: CreateCollectionOptions | undefined;

  constructor(
    connection: Bucket,
    collectionName: string,
    scopeName: string,
    settings: CreateCollectionSettings,
    initiated: Timestamp,
    options?: CreateCollectionOptions,
  ) {
    this._connection = connection;
    this._collectionName = collectionName;
    this._scopeName = scopeName;
    this._settings = settings;
    this._initiated = initiated;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._connection
      .collections()
      .createCollection(
        this._collectionName,
        this._scopeName,
        this._settings,
        this._options,
      );
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
// [end:4.2.7]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class CreateCollectionDeprecatedCommand implements ISdkCollectionMgmtCommand {
  private _connection: Bucket;
  private _collectionName: string;
  private _scopeName: string;
  private _initiated: Timestamp;
  private _options: CreateCollectionOptions | undefined;

  constructor(
    connection: Bucket,
    collectionName: string,
    scopeName: string,
    initiated: Timestamp,
    options?: CreateCollectionOptions,
  ) {
    this._connection = connection;
    this._collectionName = collectionName;
    this._scopeName = scopeName;
    this._initiated = initiated;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._connection
      .collections()
      .createCollection(this._collectionName, this._scopeName, this._options);
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

class CreateScopeCommand implements ISdkCollectionMgmtCommand {
  private _connection: Bucket;
  private _scopeName: string;
  private _initiated: Timestamp;
  private _options: CreateScopeOptions | undefined;

  constructor(
    connection: Bucket,
    scopeName: string,
    initiated: Timestamp,
    options?: CreateScopeOptions,
  ) {
    this._connection = connection;
    this._scopeName = scopeName;
    this._initiated = initiated;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._connection
      .collections()
      .createScope(this._scopeName, this._options);
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

class DropCollectionCommand implements ISdkCollectionMgmtCommand {
  private _connection: Bucket;
  private _collectionName: string;
  private _scopeName: string;
  private _initiated: Timestamp;
  private _options: DropCollectionOptions | undefined;

  constructor(
    connection: Bucket,
    collectionName: string,
    scopeName: string,
    initiated: Timestamp,
    options?: DropCollectionOptions,
  ) {
    this._connection = connection;
    this._collectionName = collectionName;
    this._scopeName = scopeName;
    this._initiated = initiated;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._connection
      .collections()
      .dropCollection(this._collectionName, this._scopeName, this._options);
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

class DropScopeCommand implements ISdkCollectionMgmtCommand {
  private _connection: Bucket;
  private _scopeName: string;
  private _initiated: Timestamp;
  private _options: DropScopeOptions | undefined;

  constructor(
    connection: Bucket,
    scopeName: string,
    initiated: Timestamp,
    options?: DropScopeOptions,
  ) {
    this._connection = connection;
    this._scopeName = scopeName;
    this._initiated = initiated;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._connection
      .collections()
      .dropScope(this._scopeName, this._options);
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

class GetAllScopesCommand implements ISdkCollectionMgmtCommand {
  private _connection: Bucket;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _options: GetAllScopesOptions | undefined;

  constructor(
    connection: Bucket,
    initiated: Timestamp,
    returnResult: boolean,
    options?: GetAllScopesOptions,
  ) {
    this._connection = connection;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const result = await this._connection
      .collections()
      .getAllScopes(this._options);
    const end = performance.now();
    const sdkCommandResult = new SdkCommandResultPb();
    sdkCommandResult.setSuccess(result.every((r) => r instanceof ScopeSpec));
    if (this._returnResult) {
      sdkCommandResult.setCollectionManagerResult(
        SdkCollectionMgmtCommandResult.toGetAllScopesMgmtResult(result),
      );
    }
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }
}

// [if:4.2.7]
class UpdateCollectionCommand implements ISdkCollectionMgmtCommand {
  private _connection: Bucket;
  private _collectionName: string;
  private _scopeName: string;
  private _settings: UpdateCollectionSettings;
  private _initiated: Timestamp;
  private _options: UpdateCollectionOptions | undefined;

  constructor(
    connection: Bucket,
    collectionName: string,
    scopeName: string,
    settings: UpdateCollectionSettings,
    initiated: Timestamp,
    options?: UpdateCollectionOptions,
  ) {
    this._connection = connection;
    this._collectionName = collectionName;
    this._scopeName = scopeName;
    this._settings = settings;
    this._initiated = initiated;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._connection
      .collections()
      .updateCollection(
        this._collectionName,
        this._scopeName,
        this._settings,
        this._options,
      );
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
// [end]

class SdkCollectionMgmtCommandBuilder {
  // [if:4.2.7]
  static toCreateCollectionSettings(
    settings?: CreateCollectionSettingsPb,
  ): CreateCollectionSettings {
    const collectionSettings: CreateCollectionSettings = {};
    if (!settings) return collectionSettings;

    if (settings.hasHistory()) {
      collectionSettings.history = settings.getHistory();
    }
    if (settings.hasExpirySecs()) {
      collectionSettings.maxExpiry = settings.getExpirySecs();
    }

    return collectionSettings;
  }

  static toUpdateCollectionSettings(
    settings?: UpdateCollectionSettingsPb,
  ): UpdateCollectionSettings {
    const collectionSettings: UpdateCollectionSettings = {};
    if (!settings) return collectionSettings;

    if (settings.hasHistory()) {
      collectionSettings.history = settings.getHistory();
    }
    if (settings.hasExpirySecs()) {
      collectionSettings.maxExpiry = settings.getExpirySecs();
    }

    return collectionSettings;
  }
  // [end]

  static buildCollectionMgmtCommand(
    connection: Bucket,
    command: CollectionManagerCommandPb,
    initiated: Timestamp,
    returnResult: boolean,
    spanOwner?: ISpanOwner,
  ): ISdkCollectionMgmtCommand {
    if (command.hasCreateCollection()) {
      const cmd = command.getCreateCollection() as CreateCollectionRequestPb;
      // [if:4.2.7]
      return new CreateCollectionCommand(
        connection,
        cmd.getName(),
        cmd.getScopeName(),
        SdkCollectionMgmtCommandBuilder.toCreateCollectionSettings(
          cmd.getSettings(),
        ),
        initiated,
        maybeAddParentSpan(
          SdkCollectionMgmtOptions.toCreateCollectionOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
      // [else]
      //? return new CreateCollectionDeprecatedCommand(
      //?   connection,
      //?   cmd.getName(),
      //?   cmd.getScopeName(),
      //?   initiated,
      //?   SdkCollectionMgmtOptions.toCreateCollectionOptions(cmd.getOptions())
      //? );
      // [end]
    } else if (command.hasCreateScope()) {
      const cmd = command.getCreateScope() as CreateScopeRequestPb;
      return new CreateScopeCommand(
        connection,
        cmd.getName(),
        initiated,
        maybeAddParentSpan(
          SdkCollectionMgmtOptions.toCreateScopeOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasDropCollection()) {
      const cmd = command.getDropCollection() as DropCollectionRequestPb;
      return new DropCollectionCommand(
        connection,
        cmd.getName(),
        cmd.getScopeName(),
        initiated,
        maybeAddParentSpan(
          SdkCollectionMgmtOptions.toDropCollectionOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasDropScope()) {
      const cmd = command.getDropScope() as DropScopeRequestPb;
      return new DropScopeCommand(
        connection,
        cmd.getName(),
        initiated,
        maybeAddParentSpan(
          SdkCollectionMgmtOptions.toDropScopeOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasGetAllScopes()) {
      const cmd = command.getGetAllScopes() as GetAllScopesRequestPb;
      return new GetAllScopesCommand(
        connection,
        initiated,
        returnResult,
        maybeAddParentSpan(
          SdkCollectionMgmtOptions.toGetAllScopesOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
      // [if:4.2.7]
    } else if (command.hasUpdateCollection()) {
      const cmd = command.getUpdateCollection() as UpdateCollectionRequestPb;
      return new UpdateCollectionCommand(
        connection,
        cmd.getName(),
        cmd.getScopeName(),
        SdkCollectionMgmtCommandBuilder.toUpdateCollectionSettings(
          cmd.getSettings(),
        ),
        initiated,
        maybeAddParentSpan(
          SdkCollectionMgmtOptions.toUpdateCollectionOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
      // [end]
    } else {
      throw new Error("Invalid query index management command type.");
    }
  }
}

export class SdkCollectionMgmtCommand implements ISdkCommand {
  private _mgmtCommand: ISdkCollectionMgmtCommand;

  constructor(mgmtCommand: ISdkCollectionMgmtCommand) {
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
    cmd: BucketLevelCommandPb,
    connection: Bucket,
    initiated: Timestamp,
    returnResult: boolean,
    spanOwner?: ISpanOwner,
  ): SdkCollectionMgmtCommand {
    const command = cmd.getCollectionManager() as CollectionManagerCommandPb;
    const mgmtCommand =
      SdkCollectionMgmtCommandBuilder.buildCollectionMgmtCommand(
        connection,
        command,
        initiated,
        returnResult,
        spanOwner,
      );
    return new SdkCollectionMgmtCommand(mgmtCommand);
  }
}
