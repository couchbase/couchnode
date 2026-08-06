import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";
import { Result as ResultPb } from "../../proto/run.top_level_pb";

import {
  BucketSettings as BucketSettingsPb,
  BucketType as BucketTypePb,
  Command as BucketManagerCommandPb,
  CompressionMode as CompressionModePb,
  ConflictResolutionType as ConflictResolutionTypePb,
  CreateBucketRequest as CreateBucketRequestPb,
  CreateBucketSettings as CreateBucketSettingsPb,
  DropBucketRequest as DropBucketRequestPb,
  EvictionPolicyType as EvictionPolicyTypePb,
  FlushBucketRequest as FlushBucketRequestPb,
  GetAllBucketsRequest as GetAllBucketsRequestPb,
  GetBucketRequest as GetBucketRequestPb,
  StorageBackend as StorageBackendPb,
  UpdateBucketRequest as UpdateBucketRequestPb,
} from "../../proto/sdk.cluster.bucket_manager_pb";
import {
  ClusterLevelCommand as ClusterLevelCommandPb,
  Result as SdkCommandResultPb,
} from "../../proto/sdk.workload_pb";
import { Durability as DurabilityPb } from "../../proto/shared.basic_pb";

import {
  Cluster,
  BucketSettings,
  BucketType,
  CompressionMode,
  ConflictResolutionType,
  CreateBucketOptions,
  DropBucketOptions,
  EvictionPolicy,
  FlushBucketOptions,
  GetAllBucketsOptions,
  GetBucketOptions,
  IBucketSettings,
  ICreateBucketSettings,
  StorageBackend,
  UpdateBucketOptions,
} from "couchbase";

import { ISdkCommand } from "./command";
import { NotImplementedError } from "../error";
import { SdkBucketMgmtOptions } from "../options/bucketMgmtOptions";
import { SdkBucketMgmtCommandResult } from "../results/bucketMgmtResult";
import { SdkCommandResult } from "../results/result";
import { SdkUtils } from "../utils";
import { ISpanOwner } from "../observability/observabilityTypes";
import { maybeAddParentSpan } from "../observability/utils";

export interface ISdkBucketMgmtCommand {
  executeCommand(): Promise<ResultPb>;
}

class CreateBucketCommand implements ISdkBucketMgmtCommand {
  private _connection: Cluster;
  private _createSettings: ICreateBucketSettings;
  private _initiated: Timestamp;
  private _options: CreateBucketOptions | undefined;

  constructor(
    connection: Cluster,
    createSettings: ICreateBucketSettings,
    initiated: Timestamp,
    options?: CreateBucketOptions,
  ) {
    this._connection = connection;
    this._createSettings = createSettings;
    this._initiated = initiated;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._connection
      .buckets()
      .createBucket(this._createSettings, this._options);
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

class DropBucketCommand implements ISdkBucketMgmtCommand {
  private _connection: Cluster;
  private _bucketName: string;
  private _initiated: Timestamp;
  private _options: DropBucketOptions | undefined;

  constructor(
    connection: Cluster,
    bucketName: string,
    initiated: Timestamp,
    options?: DropBucketOptions,
  ) {
    this._connection = connection;
    this._bucketName = bucketName;
    this._initiated = initiated;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._connection
      .buckets()
      .dropBucket(this._bucketName, this._options);
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

class FlushBucketCommand implements ISdkBucketMgmtCommand {
  private _connection: Cluster;
  private _bucketName: string;
  private _initiated: Timestamp;
  private _options: FlushBucketOptions | undefined;

  constructor(
    connection: Cluster,
    bucketName: string,
    initiated: Timestamp,
    options?: FlushBucketOptions,
  ) {
    this._connection = connection;
    this._bucketName = bucketName;
    this._initiated = initiated;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._connection
      .buckets()
      .flushBucket(this._bucketName, this._options);
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

class GetAllBucketsCommand implements ISdkBucketMgmtCommand {
  private _connection: Cluster;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _options: GetAllBucketsOptions | undefined;

  constructor(
    connection: Cluster,
    initiated: Timestamp,
    returnResult: boolean,
    options?: GetAllBucketsOptions,
  ) {
    this._connection = connection;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const getResult = await this._connection
      .buckets()
      .getAllBuckets(this._options);
    const end = performance.now();
    const sdkCommandResult = new SdkCommandResultPb();
    sdkCommandResult.setSuccess(
      getResult.every((r) => r instanceof BucketSettings),
    );
    if (this._returnResult) {
      sdkCommandResult.setBucketManagerResult(
        SdkBucketMgmtCommandResult.toGetAllBucketsMgmtResult(getResult),
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

class GetBucketCommand implements ISdkBucketMgmtCommand {
  private _connection: Cluster;
  private _bucketName: string;
  private _initiated: Timestamp;
  private _returnResult: boolean;
  private _options: GetBucketOptions | undefined;

  constructor(
    connection: Cluster,
    bucketName: string,
    initiated: Timestamp,
    returnResult: boolean,
    options?: GetBucketOptions,
  ) {
    this._connection = connection;
    this._bucketName = bucketName;
    this._initiated = initiated;
    this._returnResult = returnResult;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const getResult = await this._connection
      .buckets()
      .getBucket(this._bucketName, this._options);
    const end = performance.now();
    const sdkCommandResult = new SdkCommandResultPb();
    sdkCommandResult.setSuccess(getResult instanceof BucketSettings);
    if (this._returnResult) {
      sdkCommandResult.setBucketManagerResult(
        SdkBucketMgmtCommandResult.toGetBucketMgmtResult(getResult),
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

class UpdateBucketCommand implements ISdkBucketMgmtCommand {
  private _connection: Cluster;
  private _bucketSettings: BucketSettings;
  private _initiated: Timestamp;
  private _options: UpdateBucketOptions | undefined;

  constructor(
    connection: Cluster,
    bucketSettings: BucketSettings,
    initiated: Timestamp,
    options?: UpdateBucketOptions,
  ) {
    this._connection = connection;
    this._bucketSettings = bucketSettings;
    this._initiated = initiated;
    this._options = options;
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._connection
      .buckets()
      .updateBucket(this._bucketSettings, this._options);
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

class SdkBucketMgmtCommandBuilder {
  static toBucketSettings(settingsPb: BucketSettingsPb): IBucketSettings {
    const settings: IBucketSettings = {
      name: settingsPb.getName(),
      ramQuotaMB: settingsPb.getRamQuotaMb(),
    };
    if (settingsPb.hasFlushEnabled()) {
      settings.flushEnabled = settingsPb.getFlushEnabled();
    }
    if (settingsPb.hasNumReplicas()) {
      settings.numReplicas = settingsPb.getNumReplicas();
    }
    if (settingsPb.hasReplicaIndexes()) {
      settings.replicaIndexes = settingsPb.getReplicaIndexes();
    }
    if (settingsPb.hasBucketType()) {
      const bucketType = settingsPb.getBucketType() as BucketTypePb;
      if (bucketType === BucketTypePb.COUCHBASE) {
        settings.bucketType = BucketType.Couchbase;
      } else if (bucketType === BucketTypePb.MEMCACHED) {
        settings.bucketType = BucketType.Memcached;
      } else if (bucketType === BucketTypePb.EPHEMERAL) {
        settings.bucketType = BucketType.Ephemeral;
      } else {
        throw new NotImplementedError("Unknown bucket type specified");
      }
    }
    if (settingsPb.hasEvictionPolicy()) {
      const policy = settingsPb.getEvictionPolicy() as EvictionPolicyTypePb;
      if (policy === EvictionPolicyTypePb.NO_EVICTION) {
        settings.evictionPolicy = EvictionPolicy.NoEviction;
      } else if (policy === EvictionPolicyTypePb.FULL) {
        settings.evictionPolicy = EvictionPolicy.FullEviction;
      } else if (policy === EvictionPolicyTypePb.VALUE_ONLY) {
        settings.evictionPolicy = EvictionPolicy.ValueOnly;
      } else if (policy === EvictionPolicyTypePb.NOT_RECENTLY_USED) {
        settings.evictionPolicy = EvictionPolicy.NotRecentlyUsed;
      } else {
        throw new NotImplementedError("Unknown eviction policy specified");
      }
    }
    if (settingsPb.hasMaxExpirySeconds()) {
      settings.maxExpiry = settingsPb.getMaxExpirySeconds();
    }
    if (settingsPb.hasCompressionMode()) {
      const mode = settingsPb.getCompressionMode() as CompressionModePb;
      if (mode === CompressionModePb.OFF) {
        settings.compressionMode = CompressionMode.Off;
      } else if (mode === CompressionModePb.ACTIVE) {
        settings.compressionMode = CompressionMode.Active;
      } else if (mode === CompressionModePb.PASSIVE) {
        settings.compressionMode = CompressionMode.Passive;
      } else {
        throw new NotImplementedError("Unknown compression mode specified");
      }
    }
    if (settingsPb.hasMinimumDurabilityLevel()) {
      settings.minimumDurabilityLevel = SdkUtils.toDurabilityLevel(
        settingsPb.getMinimumDurabilityLevel() as DurabilityPb,
      );
    }
    if (settingsPb.hasStorageBackend()) {
      const backend = settingsPb.getStorageBackend() as StorageBackendPb;
      if (backend === StorageBackendPb.MAGMA) {
        settings.storageBackend = StorageBackend.Magma;
      } else if (backend === StorageBackendPb.COUCHSTORE) {
        settings.storageBackend = StorageBackend.Couchstore;
      } else {
        throw new NotImplementedError("Unknown storage backend specified");
      }
    }
    // [if:4.2.7]
    if (settingsPb.hasHistoryRetentionCollectionDefault()) {
      settings.historyRetentionCollectionDefault =
        settingsPb.getHistoryRetentionCollectionDefault();
    }
    if (settingsPb.hasHistoryRetentionSeconds()) {
      settings.historyRetentionDuration =
        settingsPb.getHistoryRetentionSeconds();
    }
    if (settingsPb.hasHistoryRetentionBytes()) {
      settings.historyRetentionBytes = settingsPb.getHistoryRetentionBytes();
    }
    // [end]
    // [if:4.6.0]
    if (settingsPb.hasNumVbuckets()) {
      settings.numVBuckets = settingsPb.getNumVbuckets();
    }
    // [end]
    return settings;
  }

  static toCreateBucketSettings(
    settingsPb: CreateBucketSettingsPb,
  ): ICreateBucketSettings {
    const settings = SdkBucketMgmtCommandBuilder.toBucketSettings(
      settingsPb.getSettings() as BucketSettingsPb,
    ) as ICreateBucketSettings;
    if (settingsPb.hasConflictResolutionType()) {
      const conflictType =
        settingsPb.getConflictResolutionType() as ConflictResolutionTypePb;
      if (conflictType === ConflictResolutionTypePb.CUSTOM) {
        settings.conflictResolutionType = ConflictResolutionType.Custom;
      } else if (conflictType === ConflictResolutionTypePb.SEQUENCE_NUMBER) {
        settings.conflictResolutionType = ConflictResolutionType.SequenceNumber;
      } else if (conflictType === ConflictResolutionTypePb.TIMESTAMP) {
        settings.conflictResolutionType = ConflictResolutionType.Timestamp;
      } else {
        throw new NotImplementedError(
          "Unknown conflict resolution type specified",
        );
      }
    }
    return settings;
  }

  static buildBucketMgmtCommand(
    connection: Cluster,
    command: BucketManagerCommandPb,
    initiated: Timestamp,
    returnResult: boolean,
    spanOwner?: ISpanOwner,
  ): ISdkBucketMgmtCommand {
    if (command.hasCreateBucket()) {
      const cmd = command.getCreateBucket() as CreateBucketRequestPb;
      return new CreateBucketCommand(
        connection,
        SdkBucketMgmtCommandBuilder.toCreateBucketSettings(
          cmd.getSettings() as CreateBucketSettingsPb,
        ),
        initiated,
        maybeAddParentSpan(
          SdkBucketMgmtOptions.toCreateBucketOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasDropBucket()) {
      const cmd = command.getDropBucket() as DropBucketRequestPb;
      return new DropBucketCommand(
        connection,
        cmd.getBucketName(),
        initiated,
        maybeAddParentSpan(
          SdkBucketMgmtOptions.toDropBucketOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasFlushBucket()) {
      const cmd = command.getFlushBucket() as FlushBucketRequestPb;
      return new FlushBucketCommand(
        connection,
        cmd.getBucketName(),
        initiated,
        maybeAddParentSpan(
          SdkBucketMgmtOptions.toFlushBucketOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasGetAllBuckets()) {
      const cmd = command.getGetAllBuckets() as GetAllBucketsRequestPb;
      return new GetAllBucketsCommand(
        connection,
        initiated,
        returnResult,
        maybeAddParentSpan(
          SdkBucketMgmtOptions.toGetAllBucketsOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasGetBucket()) {
      const cmd = command.getGetBucket() as GetBucketRequestPb;
      return new GetBucketCommand(
        connection,
        cmd.getBucketName(),
        initiated,
        returnResult,
        maybeAddParentSpan(
          SdkBucketMgmtOptions.toGetBucketOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasUpdateBucket()) {
      const cmd = command.getUpdateBucket() as UpdateBucketRequestPb;
      return new UpdateBucketCommand(
        connection,
        SdkBucketMgmtCommandBuilder.toBucketSettings(
          cmd.getSettings() as BucketSettingsPb,
        ) as BucketSettings,
        initiated,
        maybeAddParentSpan(
          SdkBucketMgmtOptions.toUpdateBucketOptions(cmd.getOptions()),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else {
      throw new Error("Invalid bucket management command type.");
    }
  }
}

export class SdkBucketMgmtCommand implements ISdkCommand {
  private _mgmtCommand: ISdkBucketMgmtCommand;

  constructor(mgmtCommand: ISdkBucketMgmtCommand) {
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
    cmd: ClusterLevelCommandPb,
    connection: Cluster,
    initiated: Timestamp,
    returnResult: boolean,
    spanOwner?: ISpanOwner,
  ): SdkBucketMgmtCommand {
    const command = cmd.getBucketManager() as BucketManagerCommandPb;
    const mgmtCommand = SdkBucketMgmtCommandBuilder.buildBucketMgmtCommand(
      connection,
      command,
      initiated,
      returnResult,
      spanOwner,
    );
    return new SdkBucketMgmtCommand(mgmtCommand);
  }
}
