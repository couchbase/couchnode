import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";
import { Result as ResultPb } from "../../proto/run.top_level_pb";
import {
  ClusterLevelCommand as ClusterLevelCommandPb,
  ScopeLevelCommand as ScopeLevelCommandPb,
  Result as SdkCommandResultPb,
} from "../../proto/sdk.workload_pb";
import {
  Command as SearchIndexManagerCommandPb,
  GetIndex as GetIndexPb,
  GetAllIndexes as GetAllIndexesPb,
  UpsertIndex as UpsertIndexPb,
  DropIndex as DropIndexPb,
  GetIndexedDocumentsCount as GetIndexedDocumentsCountPb,
  PauseIngest as PauseIngestPb,
  ResumeIngest as ResumeIngestPb,
  AllowQuerying as AllowQueryingPb,
  DisallowQuerying as DisallowQueryingPb,
  FreezePlan as FreezePlanPb,
  // [if:4.2.11]
  UnfreezePlan as UnfreezePlanPb,
  // [end]
  AnalyzeDocument as AnalyzeDocumentPb,
} from "../../proto/sdk.search.index_manager_pb";
// [if:4.2.11]
import { Scope as ScopePb } from "../../proto/shared.collection_pb";
// [end]

import {
  Cluster,
  SearchIndexManager,
  // [if:4.2.11]
  ScopeSearchIndexManager,
  // [end]
  GetSearchIndexOptions,
  GetAllSearchIndexesOptions,
  UpsertSearchIndexOptions,
  DropSearchIndexOptions,
  GetSearchIndexedDocumentsCountOptions,
  PauseSearchIngestOptions,
  ResumeSearchIngestOptions,
  AllowSearchQueryingOptions,
  DisallowSearchQueryingOptions,
  FreezeSearchPlanOptions,
  // [if:4.2.11]
  UnfreezeSearchPlanOptions,
  // [end]
  AnalyzeSearchDocumentOptions,
  ISearchIndex,
} from "couchbase";

import { ISdkCommand } from "./command";
import { NotImplementedError } from "../error";
import { SdkCommandSearchIndexMmgtOptions } from "../options/searchIndexMgmtOptions";
import { SdkCommandResult } from "../results/result";
import { SdkSearchIndexMgmtCommandResult } from "../results/searchIndexMgmtResult";
import { ISpanOwner } from "../observability/observabilityTypes";
import { maybeAddParentSpan } from "../observability/utils";

export interface ISdkSearchIndexMgmtCommand {
  executeCommand(): Promise<ResultPb>;
}

// prettier-ignore
type SearchIndexManagerType =
  | SearchIndexManager
// [if:4.2.11]
| ScopeSearchIndexManager
// [end]

class GetIndexCommand implements ISdkSearchIndexMgmtCommand {
  private _manager: SearchIndexManagerType;
  private _indexName: string;
  private _initiated: Timestamp;
  private _options: GetSearchIndexOptions;

  constructor(
    manager: SearchIndexManagerType,
    indexName: string,
    initiated: Timestamp,
    options?: GetSearchIndexOptions,
  ) {
    this._manager = manager;
    this._indexName = indexName;
    this._initiated = initiated;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const result = await this._manager.getIndex(this._indexName, this._options);
    const end = performance.now();
    const sdkCommandResult = new SdkCommandResultPb();
    sdkCommandResult.setSuccess(true);
    sdkCommandResult.setSearchIndexManagerResult(
      SdkSearchIndexMgmtCommandResult.toSearchIndexMgmtResultWithIndex(
        result as any,
      ),
    );
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }
}

class GetAllIndexesCommand implements ISdkSearchIndexMgmtCommand {
  private _manager: SearchIndexManagerType;
  private _initiated: Timestamp;
  private _options: GetAllSearchIndexesOptions;

  constructor(
    manager: SearchIndexManagerType,
    initiated: Timestamp,
    options?: GetAllSearchIndexesOptions,
  ) {
    this._manager = manager;
    this._initiated = initiated;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const result = await this._manager.getAllIndexes(this._options);
    const end = performance.now();
    const sdkCommandResult = new SdkCommandResultPb();
    sdkCommandResult.setSearchIndexManagerResult(
      SdkSearchIndexMgmtCommandResult.toSearchIndexMgmtResultWithIndexes(
        result as any[],
      ),
    );
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }
}

class UpsertIndexCommand implements ISdkSearchIndexMgmtCommand {
  private _manager: SearchIndexManagerType;
  private _index: ISearchIndex;
  private _initiated: Timestamp;
  private _options: UpsertSearchIndexOptions;

  constructor(
    manager: SearchIndexManagerType,
    index: ISearchIndex,
    initiated: Timestamp,
    options?: UpsertSearchIndexOptions,
  ) {
    this._manager = manager;
    this._index = index;
    this._initiated = initiated;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._manager.upsertIndex(this._index, this._options);
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

class DropIndexCommand implements ISdkSearchIndexMgmtCommand {
  private _manager: SearchIndexManagerType;
  private _indexName: string;
  private _initiated: Timestamp;
  private _options: DropSearchIndexOptions;

  constructor(
    manager: SearchIndexManagerType,
    indexName: string,
    initiated: Timestamp,
    options?: DropSearchIndexOptions,
  ) {
    this._manager = manager;
    this._indexName = indexName;
    this._initiated = initiated;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._manager.dropIndex(this._indexName, this._options);
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

class GetIndexedDocumentsCountCommand implements ISdkSearchIndexMgmtCommand {
  private _manager: SearchIndexManagerType;
  private _indexName: string;
  private _initiated: Timestamp;
  private _options: GetSearchIndexedDocumentsCountOptions;

  constructor(
    manager: SearchIndexManagerType,
    indexName: string,
    initiated: Timestamp,
    options?: GetSearchIndexedDocumentsCountOptions,
  ) {
    this._manager = manager;
    this._indexName = indexName;
    this._initiated = initiated;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    const result = await this._manager.getIndexedDocumentsCount(
      this._indexName,
      this._options,
    );
    const end = performance.now();
    const sdkCommandResult = new SdkCommandResultPb();
    sdkCommandResult.setSearchIndexManagerResult(
      SdkSearchIndexMgmtCommandResult.toSearchIndexMgmtResultWithDocCount(
        result,
      ),
    );
    return SdkCommandResult.getTopLevelResult(
      this._initiated,
      sdkCommandResult,
      start,
      end,
    );
  }
}

class PauseIngestCommand implements ISdkSearchIndexMgmtCommand {
  private _manager: SearchIndexManagerType;
  private _indexName: string;
  private _initiated: Timestamp;
  private _options: PauseSearchIngestOptions;

  constructor(
    manager: SearchIndexManagerType,
    indexName: string,
    initiated: Timestamp,
    options?: PauseSearchIngestOptions,
  ) {
    this._manager = manager;
    this._indexName = indexName;
    this._initiated = initiated;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._manager.pauseIngest(this._indexName, this._options);
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

class ResumeIngestCommand implements ISdkSearchIndexMgmtCommand {
  private _manager: SearchIndexManagerType;
  private _indexName: string;
  private _initiated: Timestamp;
  private _options: ResumeSearchIngestOptions;

  constructor(
    manager: SearchIndexManagerType,
    indexName: string,
    initiated: Timestamp,
    options?: ResumeSearchIngestOptions,
  ) {
    this._manager = manager;
    this._indexName = indexName;
    this._initiated = initiated;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._manager.resumeIngest(this._indexName, this._options);
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

class AllowQueryingCommand implements ISdkSearchIndexMgmtCommand {
  private _manager: SearchIndexManagerType;
  private _indexName: string;
  private _initiated: Timestamp;
  private _options: AllowSearchQueryingOptions;

  constructor(
    manager: SearchIndexManagerType,
    indexName: string,
    initiated: Timestamp,
    options?: AllowSearchQueryingOptions,
  ) {
    this._manager = manager;
    this._indexName = indexName;
    this._initiated = initiated;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._manager.allowQuerying(this._indexName, this._options);
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

class DisallowQueryingCommand implements ISdkSearchIndexMgmtCommand {
  private _manager: SearchIndexManagerType;
  private _indexName: string;
  private _initiated: Timestamp;
  private _options: DisallowSearchQueryingOptions;

  constructor(
    manager: SearchIndexManagerType,
    indexName: string,
    initiated: Timestamp,
    options?: DisallowSearchQueryingOptions,
  ) {
    this._manager = manager;
    this._indexName = indexName;
    this._initiated = initiated;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._manager.disallowQuerying(this._indexName, this._options);
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

class FreezePlanCommand implements ISdkSearchIndexMgmtCommand {
  private _manager: SearchIndexManagerType;
  private _indexName: string;
  private _initiated: Timestamp;
  private _options: FreezeSearchPlanOptions;

  constructor(
    manager: SearchIndexManagerType,
    indexName: string,
    initiated: Timestamp,
    options?: FreezeSearchPlanOptions,
  ) {
    this._manager = manager;
    this._indexName = indexName;
    this._initiated = initiated;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._manager.freezePlan(this._indexName, this._options);
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

// [if:4.2.11]
class UnfreezePlanCommand implements ISdkSearchIndexMgmtCommand {
  private _manager: SearchIndexManagerType;
  private _indexName: string;
  private _initiated: Timestamp;
  private _options: UnfreezeSearchPlanOptions;

  constructor(
    manager: SearchIndexManagerType,
    indexName: string,
    initiated: Timestamp,
    options?: UnfreezeSearchPlanOptions,
  ) {
    this._manager = manager;
    this._indexName = indexName;
    this._initiated = initiated;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._manager.unfreezePlan(this._indexName, this._options);
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

class AnalyzeDocumentCommand implements ISdkSearchIndexMgmtCommand {
  private _manager: SearchIndexManagerType;
  private _indexName: string;
  private _initiated: Timestamp;
  private _options: AnalyzeSearchDocumentOptions;

  constructor(
    manager: SearchIndexManagerType,
    indexName: string,
    initiated: Timestamp,
    options?: AnalyzeSearchDocumentOptions,
  ) {
    this._manager = manager;
    this._indexName = indexName;
    this._initiated = initiated;
    this._options = options ? options : {};
  }

  async executeCommand(): Promise<ResultPb> {
    const start = performance.now();
    await this._manager.analyzeDocument(this._indexName, this._options);
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

class SdkSearchIndexMgmtCommandBuilder {
  static toSearchIndex(definition: Uint8Array): ISearchIndex {
    const data = JSON.parse(Buffer.from(definition).toString("utf8"));
    return {
      uuid: data.uuid,
      name: data.name,
      sourceName: data.sourceName,
      type: data.type,
      params: data.params,
      sourceUuid: data.sourceUUID,
      sourceParams: data.sourceParams,
      sourceType: data.sourceType,
      planParams: data.planParams,
    };
  }

  static buildSearchIndexMgmtCommand(
    command: SearchIndexManagerCommandPb,
    searchIndexManager: SearchIndexManagerType,
    initiated: Timestamp,
    spanOwner?: ISpanOwner,
  ): ISdkSearchIndexMgmtCommand {
    if (command.hasGetIndex()) {
      const cmd = command.getGetIndex() as GetIndexPb;
      return new GetIndexCommand(
        searchIndexManager,
        cmd.getIndexName(),
        initiated,
        maybeAddParentSpan(
          SdkCommandSearchIndexMmgtOptions.toGetSearchIndexOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasGetAllIndexes()) {
      const cmd = command.getGetAllIndexes() as GetAllIndexesPb;
      return new GetAllIndexesCommand(
        searchIndexManager,
        initiated,
        maybeAddParentSpan(
          SdkCommandSearchIndexMmgtOptions.toGetAllSearchIndexesOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasUpsertIndex()) {
      const cmd = command.getUpsertIndex() as UpsertIndexPb;
      return new UpsertIndexCommand(
        searchIndexManager,
        SdkSearchIndexMgmtCommandBuilder.toSearchIndex(
          cmd.getIndexDefinition_asU8(),
        ),
        initiated,
        maybeAddParentSpan(
          SdkCommandSearchIndexMmgtOptions.toUpsertSearchIndexOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasDropIndex()) {
      const cmd = command.getDropIndex() as DropIndexPb;
      return new DropIndexCommand(
        searchIndexManager,
        cmd.getIndexName(),
        initiated,
        maybeAddParentSpan(
          SdkCommandSearchIndexMmgtOptions.toDropSearchIndexOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasGetIndexedDocumentsCount()) {
      const cmd =
        command.getGetIndexedDocumentsCount() as GetIndexedDocumentsCountPb;
      return new GetIndexedDocumentsCountCommand(
        searchIndexManager,
        cmd.getIndexName(),
        initiated,
        maybeAddParentSpan(
          SdkCommandSearchIndexMmgtOptions.toGetSearchIndexedDocumentsCountOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasPauseIngest()) {
      const cmd = command.getPauseIngest() as PauseIngestPb;
      return new PauseIngestCommand(
        searchIndexManager,
        cmd.getIndexName(),
        initiated,
        maybeAddParentSpan(
          SdkCommandSearchIndexMmgtOptions.toPauseSearchIngestOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasResumeIngest()) {
      const cmd = command.getResumeIngest() as ResumeIngestPb;
      return new ResumeIngestCommand(
        searchIndexManager,
        cmd.getIndexName(),
        initiated,
        maybeAddParentSpan(
          SdkCommandSearchIndexMmgtOptions.toResumeSearchIngestOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasAllowQuerying()) {
      const cmd = command.getAllowQuerying() as AllowQueryingPb;
      return new AllowQueryingCommand(
        searchIndexManager,
        cmd.getIndexName(),
        initiated,
        maybeAddParentSpan(
          SdkCommandSearchIndexMmgtOptions.toAllowSearchQueryingOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasDisallowQuerying()) {
      const cmd = command.getDisallowQuerying() as DisallowQueryingPb;
      return new DisallowQueryingCommand(
        searchIndexManager,
        cmd.getIndexName(),
        initiated,
        maybeAddParentSpan(
          SdkCommandSearchIndexMmgtOptions.toDisallowSearchQueryingOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else if (command.hasFreezePlan()) {
      const cmd = command.getFreezePlan() as FreezePlanPb;
      return new FreezePlanCommand(
        searchIndexManager,
        cmd.getIndexName(),
        initiated,
        maybeAddParentSpan(
          SdkCommandSearchIndexMmgtOptions.toFreezeSearchPlanOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
      // [if:4.2.11]
    } else if (command.hasUnfreezePlan()) {
      const cmd = command.getUnfreezePlan() as UnfreezePlanPb;
      return new UnfreezePlanCommand(
        searchIndexManager,
        cmd.getIndexName(),
        initiated,
        maybeAddParentSpan(
          SdkCommandSearchIndexMmgtOptions.toUnfreezeSearchPlanOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
      // [end]
    } else if (command.hasAnalyzeDocument()) {
      const cmd = command.getAnalyzeDocument() as AnalyzeDocumentPb;
      return new AnalyzeDocumentCommand(
        searchIndexManager,
        cmd.getIndexName(),
        initiated,
        maybeAddParentSpan(
          SdkCommandSearchIndexMmgtOptions.toAnalyzeSearchDocumentOptions(
            cmd.getOptions(),
          ),
          cmd.getOptions(),
          spanOwner,
        ),
      );
    } else {
      throw new Error("Invalid search index management command type.");
    }
  }
}

export class SdkSearchIndexMgmtCommand implements ISdkCommand {
  private _mgmtCommand: ISdkSearchIndexMgmtCommand;

  constructor(mgmtCommand: ISdkSearchIndexMgmtCommand) {
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
    cmd: ClusterLevelCommandPb | ScopeLevelCommandPb,
    connection: Cluster,
    initiated: Timestamp,
    spanOwner?: ISpanOwner,
  ): SdkSearchIndexMgmtCommand {
    const command = cmd
      .getSearchIndexManager()
      ?.getShared() as SearchIndexManagerCommandPb;
    if (cmd instanceof ClusterLevelCommandPb) {
      const searchIndexManager = connection.searchIndexes();
      const mgmtCommand =
        SdkSearchIndexMgmtCommandBuilder.buildSearchIndexMgmtCommand(
          command,
          searchIndexManager,
          initiated,
          spanOwner,
        );
      return new SdkSearchIndexMgmtCommand(mgmtCommand);
    }
    // [if:4.2.11]
    else {
      const scopeDetails = cmd.getScope() as ScopePb;
      const scope = connection
        .bucket(scopeDetails.getBucketName())
        .scope(scopeDetails.getScopeName());

      const searchIndexManager = scope.searchIndexes();
      const mgmtCommand =
        SdkSearchIndexMgmtCommandBuilder.buildSearchIndexMgmtCommand(
          command,
          searchIndexManager,
          initiated,
          spanOwner,
        );
      return new SdkSearchIndexMgmtCommand(mgmtCommand);
    }
    // [end]
    throw new NotImplementedError(
      "Scope search index mgmt not implemented until v4.2.11.",
    );
  }
}
